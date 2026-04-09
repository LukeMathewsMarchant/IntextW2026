from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI

from app.db_access import fetch_dataframe, resolve_db_connection_value
from app.tier1_analytics import safe_build_tier1_analytics


@dataclass
class Recommendation:
    platform: str
    priority: str
    reason: str
    recommendedAction: str
    suggestedPostHours: list[str]
    estimatedMonthlyLiftPhp: float


def _safe_float(value: Any) -> float:
    try:
        if pd.isna(value):
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def _safe_int(value: Any) -> int:
    try:
        if pd.isna(value):
            return 0
        return int(value)
    except Exception:
        return 0


def _artifact_root() -> Path:
    return Path(__file__).resolve().parents[1]


load_dotenv(_artifact_root() / '.env', override=False)

# Build marker is injected by CI as ML_API_BUILD_ID (fallback keeps local dev readable).
_ML_API_BUILD_ID = os.getenv('ML_API_BUILD_ID', 'dev-local')


def _load_from_database(db_url: str) -> pd.DataFrame:
    query = """
        SELECT
            post_id, platform, platform_post_id, post_url, created_at, day_of_week, post_hour, post_type, media_type,
            caption, hashtags, num_hashtags, mentions_count, has_call_to_action, call_to_action_type, content_topic,
            sentiment_tone, caption_length, features_resident_story, campaign_name, is_boosted, boost_budget_php,
            impressions, reach, likes, comments, shares, saves, click_throughs, video_views, engagement_rate,
            profile_visits, donation_referrals, estimated_donation_value_php, follower_count_at_post,
            watch_time_seconds, avg_view_duration_seconds, subscriber_count_at_post, forwards
        FROM social_media_posts
    """
    return fetch_dataframe(db_url, query)


def _load_donations_from_database(db_url: str) -> pd.DataFrame:
    query = """
        SELECT
            donation_id,
            supporter_id,
            donation_type::text AS donation_type,
            donation_date,
            is_recurring,
            campaign_name,
            channel_source::text AS channel_source,
            amount,
            estimated_value,
            referral_post_id
        FROM donations
    """
    return fetch_dataframe(db_url, query)


def _load_cached_or_build() -> dict[str, Any]:
    project_root = _artifact_root().parents[0]
    cache_path = Path(os.getenv('SOCIAL_MEDIA_CACHE_PATH', _artifact_root() / 'artifacts' / 'social_media_analytics_cache.json'))
    dataset_path = Path(os.getenv('SOCIAL_MEDIA_DATASET_PATH', project_root / 'datasets' / 'social_media_posts.csv'))

    db_url = resolve_db_connection_value()
    data_source = 'empty'
    load_warning = ''

    if db_url:
        try:
            df = _load_from_database(db_url)
            data_source = 'database'
        except Exception as ex:
            df = pd.DataFrame()
            data_source = 'database-error'
            load_warning = f'Database connection/query failed: {ex}'
    elif cache_path.exists():
        payload = json.loads(cache_path.read_text(encoding='utf-8'))
        payload.setdefault('dataSource', 'cache')
        payload.setdefault('loadWarning', '')
        return payload
    elif dataset_path.exists():
        df = pd.read_csv(dataset_path)
        data_source = 'csv'
    else:
        df = pd.DataFrame()

    if df.empty:
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'currency': 'PHP',
            'dataSource': data_source,
            'loadWarning': load_warning,
            'summary': {
                'totalPosts': 0,
                'totalDonationReferrals': 0,
                'totalEstimatedDonationValuePhp': 0.0,
                'avgEngagementRate': 0.0,
            },
            'platformRanking': [],
            'recommendations': [],
            'bestPostingWindows': [],
        }

    for col in ['donation_referrals', 'estimated_donation_value_php', 'engagement_rate', 'post_hour']:
        if col not in df.columns:
            df[col] = 0

    summary = {
        'totalPosts': int(len(df)),
        'totalDonationReferrals': int(df['donation_referrals'].fillna(0).sum()),
        'totalEstimatedDonationValuePhp': round(float(df['estimated_donation_value_php'].fillna(0).sum()), 2),
        'avgEngagementRate': round(float(df['engagement_rate'].fillna(0).mean()) if len(df) else 0.0, 4),
    }

    grouped = df.groupby('platform', dropna=False).agg(
        posts=('post_id', 'count'),
        donationReferrals=('donation_referrals', 'sum'),
        estimatedDonationValuePhp=('estimated_donation_value_php', 'sum'),
        avgEngagementRate=('engagement_rate', 'mean'),
    ).reset_index().sort_values('estimatedDonationValuePhp', ascending=False)

    total_value = max(float(grouped['estimatedDonationValuePhp'].sum()), 1.0)
    platform_ranking: list[dict[str, Any]] = []
    for _, row in grouped.iterrows():
        platform_ranking.append({
            'platform': str(row['platform']) if pd.notna(row['platform']) else 'Unknown',
            'posts': _safe_int(row['posts']),
            'donationReferrals': _safe_int(row['donationReferrals']),
            'estimatedDonationValuePhp': round(_safe_float(row['estimatedDonationValuePhp']), 2),
            'avgEngagementRate': round(_safe_float(row['avgEngagementRate']), 4),
            'shareOfDonationValue': round(_safe_float(row['estimatedDonationValuePhp']) / total_value, 4),
        })

    recommendations: list[dict[str, Any]] = []
    if platform_ranking:
        value_series = [p['estimatedDonationValuePhp'] for p in platform_ranking]
        median_value = pd.Series(value_series).median() if value_series else 0
        for item in platform_ranking[:5]:
            priority = 'High' if item['estimatedDonationValuePhp'] >= median_value else 'Medium'
            lift = round(item['estimatedDonationValuePhp'] * (0.2 if priority == 'High' else 0.1), 2)
            platform_df = df[df['platform'] == item['platform']]
            top_hours = (
                platform_df.groupby('post_hour')['estimated_donation_value_php'].mean().sort_values(ascending=False).head(3).index.tolist()
                if len(platform_df) else []
            )
            recommendations.append(Recommendation(
                platform=item['platform'],
                priority=priority,
                reason='Strong donation contribution relative to other platforms.',
                recommendedAction='Post more CTA-led impact stories and appeals on this platform.',
                suggestedPostHours=[str(int(h)) for h in top_hours if pd.notna(h)],
                estimatedMonthlyLiftPhp=lift,
            ).__dict__)

    best_windows = (
        df.groupby(['platform', 'day_of_week', 'post_hour'], dropna=False)
        .agg(avgDonationValuePhp=('estimated_donation_value_php', 'mean'), avgReferrals=('donation_referrals', 'mean'))
        .reset_index()
        .sort_values('avgDonationValuePhp', ascending=False)
        .head(12)
    )
    best_posting_windows: list[dict[str, Any]] = []
    for _, row in best_windows.iterrows():
        best_posting_windows.append({
            'platform': str(row['platform']) if pd.notna(row['platform']) else 'Unknown',
            'dayOfWeek': str(row['day_of_week']) if pd.notna(row['day_of_week']) else 'Unknown',
            'postHour': _safe_int(row['post_hour']),
            'avgDonationValuePhp': round(_safe_float(row['avgDonationValuePhp']), 2),
            'avgReferrals': round(_safe_float(row['avgReferrals']), 2),
        })

    payload = {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'currency': 'PHP',
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': summary,
        'platformRanking': platform_ranking,
        'recommendations': recommendations,
        'bestPostingWindows': best_posting_windows,
    }

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    return payload


def _repo_root() -> Path:
    """Repository root (parent of ml-service/)."""
    return _artifact_root().resolve().parent


def _donations_analytics_empty(load_warning: str = '', data_source: str = 'empty') -> dict[str, Any]:
    return {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': {
            'totalGifts': 0,
            'totalEstimatedValue': 0.0,
            'avgEstimatedValue': 0.0,
            'recurringShare': 0.0,
            'withSocialReferralCount': 0,
        },
        'channelMix': [],
        'giftTypeMix': [],
        'monthlyTotals': [],
        'pipelineModel': None,
    }


def _load_donations_prepared_dataframe() -> tuple[pd.DataFrame | None, str, str]:
    """
    Load donations from DB or CSV; coerce estimated_value; drop nulls.
    Returns (None, data_source, load_warning) on failure; otherwise (df, data_source, load_warning).
    Empty df means no usable rows (caller may distinguish via load_warning).
    """
    root = _repo_root()
    csv_path = Path(os.getenv('DONATIONS_DATASET_PATH', str(root / 'datasets' / 'donations.csv')))

    db_url = resolve_db_connection_value()
    data_source = 'empty'
    load_warning = ''

    if db_url:
        try:
            df = _load_donations_from_database(db_url)
            data_source = 'database'
        except Exception as ex:
            load_warning = f'Database query failed ({ex}); trying CSV fallback.'
            if csv_path.is_file():
                try:
                    df = pd.read_csv(csv_path)
                    data_source = 'csv'
                except Exception as ex2:
                    return None, 'error', f'Database: {ex}; CSV: {ex2}'
            else:
                return None, 'database-error', load_warning
    elif csv_path.is_file():
        try:
            df = pd.read_csv(csv_path)
            data_source = 'csv'
        except Exception as ex:
            return None, 'error', f'Failed to read donations CSV: {ex}'
    else:
        return None, 'missing-file', f'Donations CSV not found: {csv_path}'

    if df.empty:
        return df, data_source, ''

    value_col = 'estimated_value'
    if value_col not in df.columns:
        return None, 'error', 'Column estimated_value missing in donations file.'

    df = df.copy()
    df[value_col] = pd.to_numeric(df[value_col], errors='coerce')
    df = df.dropna(subset=[value_col])

    if df.empty:
        return df, data_source, 'No rows with numeric estimated_value.'

    return df, data_source, load_warning


def _build_donations_analytics() -> dict[str, Any]:
    """
    Donation trends for the admin dashboard (live DB preferred, CSV fallback, optional ML metrics).
    Isolated from social-media logic; failures never affect /social-media/*.
    """
    root = _repo_root()
    metrics_path = Path(
        os.getenv(
            'DONATIONS_METRICS_PATH',
            str(root / 'ml-pipelines' / 'artifacts' / 'donations_model_metrics.csv'),
        )
    )

    loaded = _load_donations_prepared_dataframe()
    df, data_source, load_warning = loaded
    if df is None:
        return _donations_analytics_empty(load_warning, data_source)
    if df.empty:
        if load_warning:
            return _donations_analytics_empty(load_warning, 'empty')
        return _donations_analytics_empty('', 'empty')

    value_col = 'estimated_value'

    if 'donation_date' in df.columns:
        df['donation_date'] = pd.to_datetime(df['donation_date'], errors='coerce')
        df['_month'] = df['donation_date'].dt.strftime('%Y-%m')
    else:
        df['_month'] = 'Unknown'

    n = int(len(df))
    total_val = float(df[value_col].sum())
    avg_val = float(df[value_col].mean()) if n else 0.0

    recurring_share = 0.0
    if 'is_recurring' in df.columns:
        rec = df['is_recurring'].astype(str).str.lower().isin(('true', '1', 'yes'))
        recurring_share = round(float(rec.mean()), 4)

    ref_count = 0
    if 'referral_post_id' in df.columns:
        ref_count = int(df['referral_post_id'].notna().sum())

    monthly = (
        df.groupby('_month', dropna=False)[value_col]
        .sum()
        .reset_index()
        .rename(columns={'_month': 'month', value_col: 'totalEstimatedValue'})
    )
    monthly_totals: list[dict[str, Any]] = []
    for _, row in monthly.sort_values('month').iterrows():
        monthly_totals.append(
            {
                'month': str(row['month']) if pd.notna(row['month']) else 'Unknown',
                'totalEstimatedValue': round(_safe_float(row['totalEstimatedValue']), 2),
            }
        )

    ch_col = 'channel_source' if 'channel_source' in df.columns else None
    channel_mix: list[dict[str, Any]] = []
    if ch_col:
        g = df.groupby(ch_col, dropna=False).agg(giftCount=(value_col, 'count'), totalEstimatedValue=(value_col, 'sum'))
        g = g.reset_index().sort_values('totalEstimatedValue', ascending=False)
        for _, row in g.iterrows():
            gc = _safe_int(row['giftCount'])
            tv = _safe_float(row['totalEstimatedValue'])
            avg_ev = round(tv / gc, 2) if gc else 0.0
            channel_mix.append(
                {
                    'channelSource': str(row[ch_col]) if pd.notna(row[ch_col]) else 'Unknown',
                    'giftCount': gc,
                    'totalEstimatedValue': round(tv, 2),
                    'avgEstimatedValue': avg_ev,
                }
            )

    type_col = 'donation_type' if 'donation_type' in df.columns else None
    gift_type_mix: list[dict[str, Any]] = []
    if type_col:
        g2 = df.groupby(type_col, dropna=False).agg(giftCount=(value_col, 'count'), totalEstimatedValue=(value_col, 'sum'))
        g2 = g2.reset_index().sort_values('totalEstimatedValue', ascending=False)
        for _, row in g2.iterrows():
            gift_type_mix.append(
                {
                    'donationType': str(row[type_col]) if pd.notna(row[type_col]) else 'Unknown',
                    'giftCount': _safe_int(row['giftCount']),
                    'totalEstimatedValue': round(_safe_float(row['totalEstimatedValue']), 2),
                }
            )

    pipeline_model: dict[str, Any] | None = None
    if metrics_path.is_file():
        try:
            mdf = pd.read_csv(metrics_path)
            if len(mdf):
                row = mdf.iloc[0].to_dict()
                pipeline_model = {
                    'name': 'donations',
                    'targetDescription': 'estimated_value (regression from ml-pipelines/pipeline_kit)',
                    'holdoutMaePredictive': _safe_float(row.get('predictive_mae')),
                    'holdoutR2Predictive': _safe_float(row.get('predictive_r2')),
                    'holdoutMaeExplanatory': _safe_float(row.get('explanatory_mae')),
                    'holdoutR2Explanatory': _safe_float(row.get('explanatory_r2')),
                }
        except Exception:
            pipeline_model = None

    return {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': {
            'totalGifts': n,
            'totalEstimatedValue': round(total_val, 2),
            'avgEstimatedValue': round(avg_val, 2),
            'recurringShare': recurring_share,
            'withSocialReferralCount': ref_count,
        },
        'channelMix': channel_mix,
        'giftTypeMix': gift_type_mix,
        'monthlyTotals': monthly_totals,
        'pipelineModel': pipeline_model,
    }


def _donations_explore_empty(load_warning: str, data_source: str) -> dict[str, Any]:
    return {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'dataSource': data_source,
        'loadWarning': load_warning,
        'endpointVersion': '1.0.1',
        'notebookRef': 'ml-pipelines/donations.ipynb §2 (distributions & exploration)',
        'estimatedValue': None,
        'iqrOutliers': None,
        'meanByDonationType': [],
        'meanByChannelSource': [],
        'dataQuality': None,
    }


def _build_donations_explore_summary() -> dict[str, Any]:
    """
    EDA stats aligned with donations.ipynb early cells: value distribution, IQR outliers,
    group means by type and channel, light data-quality counts.
    """
    df, data_source, load_warning = _load_donations_prepared_dataframe()
    if df is None:
        return _donations_explore_empty(load_warning, data_source)
    if df.empty:
        return _donations_explore_empty(load_warning or '', 'empty')

    value_col = 'estimated_value'
    ev = df[value_col]
    desc = ev.describe()
    q1 = float(ev.quantile(0.25))
    q3 = float(ev.quantile(0.75))
    iqr = q3 - q1
    low = q1 - 1.5 * iqr
    high = q3 + 1.5 * iqr
    outlier_mask = (ev < low) | (ev > high)

    mean_by_type: list[dict[str, Any]] = []
    if 'donation_type' in df.columns:
        g = df.groupby('donation_type', dropna=False)[value_col].agg(['mean', 'count']).reset_index()
        g = g.sort_values('mean', ascending=False)
        for _, row in g.iterrows():
            mean_by_type.append(
                {
                    'donationType': str(row['donation_type']) if pd.notna(row['donation_type']) else 'Unknown',
                    'giftCount': _safe_int(row['count']),
                    'meanEstimatedValue': round(_safe_float(row['mean']), 2),
                }
            )

    mean_by_channel: list[dict[str, Any]] = []
    if 'channel_source' in df.columns:
        g2 = df.groupby('channel_source', dropna=False)[value_col].agg(['mean', 'count']).reset_index()
        g2 = g2.sort_values('mean', ascending=False)
        for _, row in g2.iterrows():
            mean_by_channel.append(
                {
                    'channelSource': str(row['channel_source']) if pd.notna(row['channel_source']) else 'Unknown',
                    'giftCount': _safe_int(row['count']),
                    'meanEstimatedValue': round(_safe_float(row['mean']), 2),
                }
            )

    dup_ids = 0
    if 'donation_id' in df.columns:
        dup_ids = int(df['donation_id'].duplicated().sum())

    missing_dates = 0
    date_min: str | None = None
    date_max: str | None = None
    if 'donation_date' in df.columns:
        ddt = pd.to_datetime(df['donation_date'], errors='coerce')
        missing_dates = int(ddt.isna().sum())
        valid = ddt.dropna()
        if len(valid):
            date_min = valid.min().isoformat()
            date_max = valid.max().isoformat()

    neg_ev = int((ev < 0).sum())
    miss_campaign = 0.0
    if 'campaign_name' in df.columns:
        miss_campaign = round(float(df['campaign_name'].isna().mean()), 4)

    return {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'dataSource': data_source,
        'loadWarning': load_warning,
        'endpointVersion': '1.0.1',
        'notebookRef': 'ml-pipelines/donations.ipynb §2 (distributions & exploration)',
        'estimatedValue': {
            'count': int(desc['count']),
            'mean': round(_safe_float(desc['mean']), 2),
            'std': round(_safe_float(desc['std']), 2),
            'min': round(_safe_float(desc['min']), 2),
            'q25': round(q1, 2),
            'median': round(_safe_float(ev.median()), 2),
            'q75': round(q3, 2),
            'max': round(_safe_float(desc['max']), 2),
        },
        'iqrOutliers': {
            'lowerBound': round(low, 2),
            'upperBound': round(high, 2),
            'count': int(outlier_mask.sum()),
        },
        'meanByDonationType': mean_by_type,
        'meanByChannelSource': mean_by_channel,
        'dataQuality': {
            'duplicateDonationIds': dup_ids,
            'missingDonationDates': missing_dates,
            'dateRangeStart': date_min,
            'dateRangeEnd': date_max,
            'negativeEstimatedValues': neg_ev,
            'missingCampaignNameShare': miss_campaign,
            'distinctDonationTypes': int(df['donation_type'].nunique()) if 'donation_type' in df.columns else 0,
            'distinctChannelSources': int(df['channel_source'].nunique()) if 'channel_source' in df.columns else 0,
        },
    }


def _safe_load_donations_analytics() -> dict[str, Any]:
    try:
        return _build_donations_analytics()
    except Exception as ex:
        return _donations_analytics_empty(f'Donations analytics build failed: {ex}', 'error')


def _safe_load_donations_explore_summary() -> dict[str, Any]:
    try:
        return _build_donations_explore_summary()
    except Exception as ex:
        return _donations_explore_empty(f'Explore summary failed: {ex}', 'error')


app = FastAPI(
    title='Lighthouse ML API',
    description='Social media analytics, donations pipeline trends, and tier-1 program analytics for admin dashboard.',
    version='1.3.0',
)
_cache = _load_cached_or_build()
@app.get('/health')
def health() -> dict[str, str]:
    return {
        'status': 'ok',
        'buildId': _ML_API_BUILD_ID,
        'hint': 'If buildId is missing here, this site is not running the latest ml-service code.',
    }


@app.get('/social-media/summary')
def social_media_summary() -> dict[str, Any]:
    return _cache['summary']


@app.get('/social-media/platform-ranking')
def social_media_platform_ranking() -> list[dict[str, Any]]:
    return _cache['platformRanking']


@app.get('/social-media/recommendations')
def social_media_recommendations() -> list[dict[str, Any]]:
    return _cache['recommendations']


@app.get('/social-media/analytics')
def social_media_analytics() -> dict[str, Any]:
    return _cache


@app.get('/donations/analytics')
def donations_analytics() -> dict[str, Any]:
    """Trends + channel/type mix from live DB (fallback CSV); optional metrics from notebook artifacts."""
    return _safe_load_donations_analytics()


@app.get('/donations/explore-summary')
def donations_explore_summary() -> dict[str, Any]:
    """Notebook-aligned EDA (distributions, IQR outliers, means by type/channel) for deploy verification."""
    return _safe_load_donations_explore_summary()


@app.get('/reports/tier1-analytics')
def reports_tier1_analytics() -> dict[str, Any]:
    """Residents, education, and health & wellbeing from live DB (when configured) or CSV + notebook artifacts."""
    return safe_build_tier1_analytics()
