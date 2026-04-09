from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from dotenv import load_dotenv

# Import psycopg only when connecting to Postgres (allows cache-only runs on platforms
# without psycopg wheels, e.g. Windows ARM64 without libpq).
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

def _normalize_connection_value(raw: str) -> str:
    value = raw.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def _parse_dotnet_style_conn_str(conn_str: str) -> dict[str, Any]:
    mapping = {
        'host': 'host',
        'server': 'host',
        'port': 'port',
        'database': 'dbname',
        'initial catalog': 'dbname',
        'username': 'user',
        'user id': 'user',
        'userid': 'user',
        'uid': 'user',
        'password': 'password',
    }
    options: dict[str, Any] = {}
    for segment in conn_str.split(';'):
        if '=' not in segment:
            continue
        key, value = segment.split('=', 1)
        key = key.strip().lower()
        value = value.strip()
        if not key:
            continue
        normalized = mapping.get(key)
        if normalized:
            options[normalized] = value
            continue
        if key == 'ssl mode' and value:
            options['sslmode'] = value.lower()
        elif key == 'trust server certificate' and value.lower() == 'true':
            options['sslmode'] = options.get('sslmode', 'require')
    return options


def _resolve_db_connection_value() -> str:
    direct = _normalize_connection_value(os.getenv('SOCIAL_MEDIA_DB_URL', ''))
    if direct:
        return direct
    return _normalize_connection_value(os.getenv('ConnectionStrings__DefaultConnection', ''))


def _connect_db(conn_value: str):
    import psycopg  # noqa: PLC0415

    if conn_value.startswith('postgres://') or conn_value.startswith('postgresql://'):
        return psycopg.connect(conn_value)
    if ';' in conn_value:
        kwargs = _parse_dotnet_style_conn_str(conn_value)
        return psycopg.connect(**kwargs)
    return psycopg.connect(conn_value)

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


def _load_supporters_for_donations(db_url: str) -> pd.DataFrame:
    query = """
        SELECT
            supporter_id,
            acquisition_channel,
            status
        FROM supporters
    """
    return fetch_dataframe(db_url, query)


def _load_social_posts_for_referrals(db_url: str) -> pd.DataFrame:
    query = """
        SELECT
            post_id,
            engagement_rate
        FROM social_media_posts
    """
    return fetch_dataframe(db_url, query)


def _load_allocations_for_donations(db_url: str) -> pd.DataFrame:
    query = """
        SELECT
            donation_id,
            program_area,
            amount_allocated
        FROM donation_allocations
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


def _normalize_impact_pipeline_payload(p: dict[str, Any]) -> dict[str, Any]:
    p.setdefault('generatedAtUtc', datetime.now(timezone.utc).isoformat())
    p.setdefault('pipelineName', 'public_impact_snapshots_pipeline')
    p.setdefault('dataSource', 'cache')
    p.setdefault('headline', '')
    p.setdefault('summary', '')
    p.setdefault('metricHighlights', {})
    p.setdefault('loadWarning', '')
    p.setdefault('relatedPipelines', [])
    return p


def _load_impact_pipeline() -> dict[str, Any]:
    """Overlay for Impact page: aligns with ml-pipelines/public_impact_snapshots_pipeline.ipynb."""
    root = _artifact_root()
    cache_path = Path(os.getenv('IMPACT_PIPELINE_CACHE_PATH', root / 'artifacts' / 'impact_pipeline_cache.json'))
    repo_root = root.parent
    sample_path = repo_root / 'artifacts' / 'public_impact_snapshots_sample_payload.json'

    if cache_path.exists():
        data = json.loads(cache_path.read_text(encoding='utf-8'))
        return _normalize_impact_pipeline_payload(data)

    if sample_path.exists():
        sample = json.loads(sample_path.read_text(encoding='utf-8'))
        return _normalize_impact_pipeline_payload(
            {
                'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
                'pipelineName': 'public_impact_snapshots_pipeline',
                'dataSource': 'sample_payload',
                'headline': 'Pipeline-aligned impact indicators',
                'summary': (
                    'Illustrative metrics from the public impact snapshots sample; '
                    'place impact_pipeline_cache.json under ml-service/artifacts/ or set IMPACT_PIPELINE_CACHE_PATH.'
                ),
                'metricHighlights': sample,
                'loadWarning': '',
                'relatedPipelines': [
                    'public_impact_snapshots_pipeline',
                    'donations.ipynb',
                    'residents.ipynb',
                    'safehouse_monthly_metrics_pipeline.ipynb',
                ],
            }
        )

    return _normalize_impact_pipeline_payload(
        {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'pipelineName': 'public_impact_snapshots_pipeline',
            'dataSource': 'empty',
            'headline': '',
            'summary': '',
            'metricHighlights': {},
            'loadWarning': 'No impact cache or repo artifacts sample found.',
            'relatedPipelines': [],
        }
    )


app = FastAPI(title='Lighthouse ML API (Social + Impact)', version='1.0.0')
_cache = _load_cached_or_build()
_impact_pipeline_cache = _load_impact_pipeline()


@app.get('/')
def root() -> dict[str, Any]:
    """FastAPI has no HTML home by default; this avoids a bare 404 on GET /."""
    return {
        'service': 'Lighthouse ML API (Social + Impact)',
        'docs': '/docs',
        'health': '/health',
        'socialMediaAnalytics': '/social-media/analytics',
        'impactAnalytics': '/impact/analytics',
    }
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


_donations_forecast_cache: dict[str, Any] = {
    'signature': None,
    'payload': None,
}
_donations_forecast_refreshing = False
_donations_forecast_lock = threading.Lock()


def _compute_donations_signature(df: pd.DataFrame) -> str:
    if df.empty:
        return 'empty'
    max_id = int(pd.to_numeric(df.get('donation_id'), errors='coerce').fillna(0).max()) if 'donation_id' in df.columns else 0
    max_date = ''
    if 'donation_date' in df.columns:
        dd = pd.to_datetime(df['donation_date'], errors='coerce')
        if dd.notna().any():
            max_date = str(dd.max().date())
    total = float(pd.to_numeric(df.get('estimated_value'), errors='coerce').fillna(0).sum()) if 'estimated_value' in df.columns else 0.0
    return f"n={len(df)}|maxId={max_id}|maxDate={max_date}|sum={round(total,2)}"


def _forecast_cache_path() -> Path:
    root = _repo_root()
    return Path(
        os.getenv(
            'DONATIONS_FORECAST_CACHE_PATH',
            str(root / 'ml-service' / 'artifacts' / 'donations_next_month_forecast_cache.json'),
        )
    )


def _read_forecast_cache_file() -> tuple[str | None, dict[str, Any] | None]:
    path = _forecast_cache_path()
    if not path.is_file():
        return None, None
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
        sig = payload.get('_signature')
        data = payload.get('data')
        if isinstance(sig, str) and isinstance(data, dict):
            return sig, data
    except Exception:
        return None, None
    return None, None


def _write_forecast_cache_file(signature: str, payload: dict[str, Any]) -> None:
    path = _forecast_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'_signature': signature, 'data': payload}, indent=2), encoding='utf-8')


def _build_monthly_prediction_frame(
    donations_df: pd.DataFrame,
    supporters_df: pd.DataFrame | None,
    social_df: pd.DataFrame | None,
    allocations_df: pd.DataFrame | None,
) -> pd.DataFrame:
    work = donations_df.copy()
    work['donation_date'] = pd.to_datetime(work['donation_date'], errors='coerce')
    work = work[work['donation_date'].notna()].copy()
    work['estimated_value'] = pd.to_numeric(work['estimated_value'], errors='coerce')
    work = work[work['estimated_value'].notna()].copy()
    work['month'] = work['donation_date'].dt.to_period('M').astype(str)

    if work.empty:
        return pd.DataFrame()

    monthly = work.groupby('month', as_index=False).agg(
        month_total_estimated_value=('estimated_value', 'sum'),
        gift_count=('donation_id', 'count'),
        avg_gift_value=('estimated_value', 'mean'),
        recurring_share=('is_recurring', lambda s: s.astype(str).str.lower().isin(['true', '1', 'yes']).mean()),
        unique_supporters=('supporter_id', 'nunique'),
    )

    type_mix = (
        work.pivot_table(index='month', columns='donation_type', values='donation_id', aggfunc='count', fill_value=0)
        .add_prefix('type_count_')
        .reset_index()
    )
    channel_mix = (
        work.pivot_table(index='month', columns='channel_source', values='donation_id', aggfunc='count', fill_value=0)
        .add_prefix('channel_count_')
        .reset_index()
    )

    if supporters_df is not None and len(supporters_df):
        sup_small = supporters_df[['supporter_id', 'acquisition_channel', 'status']].copy()
        work_sup = work.merge(sup_small, on='supporter_id', how='left')
        sup_month = work_sup.groupby('month', as_index=False).agg(
            active_supporter_share=('status', lambda s: (s.fillna('') == 'Active').mean()),
            social_acquisition_share=('acquisition_channel', lambda s: (s.fillna('') == 'SocialMedia').mean()),
        )
    else:
        sup_month = pd.DataFrame({'month': monthly['month'], 'active_supporter_share': 0.0, 'social_acquisition_share': 0.0})

    if social_df is not None and len(social_df):
        sm_small = social_df[['post_id', 'engagement_rate']].copy()
        work_sm = work.merge(sm_small, left_on='referral_post_id', right_on='post_id', how='left')
        sm_month = work_sm.groupby('month', as_index=False).agg(
            social_referral_count=('referral_post_id', lambda s: s.notna().sum()),
            referred_post_avg_engagement=('engagement_rate', 'mean'),
        )
    else:
        sm_month = pd.DataFrame({'month': monthly['month'], 'social_referral_count': 0.0, 'referred_post_avg_engagement': 0.0})

    if allocations_df is not None and len(allocations_df):
        alloc_month = (
            work[['donation_id', 'month']]
            .merge(allocations_df[['donation_id', 'program_area', 'amount_allocated']], on='donation_id', how='left')
            .groupby('month', as_index=False)
            .agg(
                allocated_amount_total=('amount_allocated', 'sum'),
                allocated_program_areas=('program_area', lambda s: s.nunique()),
            )
        )
    else:
        alloc_month = pd.DataFrame({'month': monthly['month'], 'allocated_amount_total': 0.0, 'allocated_program_areas': 0.0})

    feat = monthly.merge(type_mix, on='month', how='left')
    feat = feat.merge(channel_mix, on='month', how='left')
    feat = feat.merge(sup_month, on='month', how='left')
    feat = feat.merge(sm_month, on='month', how='left')
    feat = feat.merge(alloc_month, on='month', how='left')

    feat = feat.sort_values('month').reset_index(drop=True)
    feat['month_start'] = pd.to_datetime(feat['month'] + '-01')
    feat['month_num'] = feat['month_start'].dt.month
    feat['year'] = feat['month_start'].dt.year

    # Winsorize monthly totals before lag/rolling features to reduce spike sensitivity in production.
    lo_q = float(os.getenv('DONATIONS_FORECAST_LOWER_Q', '0.05'))
    hi_q = float(os.getenv('DONATIONS_FORECAST_UPPER_Q', '0.95'))
    lo = float(feat['month_total_estimated_value'].quantile(lo_q))
    hi = float(feat['month_total_estimated_value'].quantile(hi_q))
    feat['month_total_for_features'] = feat['month_total_estimated_value'].clip(lower=lo, upper=hi)

    for lag in [1, 2, 3, 6]:
        feat[f'lag_total_{lag}'] = feat['month_total_for_features'].shift(lag)
        if lag <= 3:
            feat[f'lag_gift_count_{lag}'] = feat['gift_count'].shift(lag)

    feat['rolling3_total_mean'] = feat['month_total_for_features'].shift(1).rolling(3).mean()
    feat['rolling3_total_std'] = feat['month_total_for_features'].shift(1).rolling(3).std()
    feat['rolling6_total_mean'] = feat['month_total_for_features'].shift(1).rolling(6).mean()
    return feat


def _build_donations_next_month_forecast() -> dict[str, Any]:
    root = _repo_root()
    model_path = Path(
        os.getenv(
            'DONATIONS_FORECAST_MODEL_PATH',
            str(root / 'ml-pipelines' / 'artifacts' / 'donation_prediction_next_month_model.joblib'),
        )
    )
    if not model_path.is_file():
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'dataSource': 'error',
            'loadWarning': f'Forecast model artifact not found: {model_path}',
            'endpointVersion': '2.0.0',
            'modelName': '',
            'modelMetrics': None,
            'latestObservedMonth': None,
            'predictedMonth': None,
            'predictedTotalEstimatedValue': None,
            'predictionRange': None,
            'featureSnapshot': {},
        }

    donations_df, data_source, load_warning = _load_donations_prepared_dataframe()
    if donations_df is None or donations_df.empty:
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'dataSource': data_source,
            'loadWarning': load_warning or 'No donations available for forecast.',
            'endpointVersion': '2.0.0',
            'modelName': '',
            'modelMetrics': None,
            'latestObservedMonth': None,
            'predictedMonth': None,
            'predictedTotalEstimatedValue': None,
            'predictionRange': None,
            'featureSnapshot': {},
        }

    signature = _compute_donations_signature(donations_df)
    cached_sig = _donations_forecast_cache.get('signature')
    cached_payload = _donations_forecast_cache.get('payload')
    if cached_sig == signature and isinstance(cached_payload, dict):
        return cached_payload

    db_url = resolve_db_connection_value()
    supporters_df = social_df = allocations_df = None
    if db_url:
        try:
            supporters_df = _load_supporters_for_donations(db_url)
        except Exception:
            supporters_df = None
        try:
            social_df = _load_social_posts_for_referrals(db_url)
        except Exception:
            social_df = None
        try:
            allocations_df = _load_allocations_for_donations(db_url)
        except Exception:
            allocations_df = None

    feat = _build_monthly_prediction_frame(donations_df, supporters_df, social_df, allocations_df)
    feat = feat.dropna(subset=['lag_total_1', 'lag_total_2', 'lag_total_3']).reset_index(drop=True)
    if feat.empty:
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'dataSource': data_source,
            'loadWarning': 'Not enough monthly history for lag features.',
            'endpointVersion': '2.0.0',
            'modelName': '',
            'modelMetrics': None,
            'latestObservedMonth': None,
            'predictedMonth': None,
            'predictedTotalEstimatedValue': None,
            'predictionRange': None,
            'featureSnapshot': {},
        }

    bundle = joblib.load(model_path)
    model = bundle.get('model')
    feature_columns = list(bundle.get('feature_columns', []))
    model_name = str(bundle.get('model_name') or '')
    model_metrics = bundle.get('metrics_test')

    latest = feat.iloc[-1].copy()
    x_in = pd.DataFrame([latest.to_dict()])
    for c in feature_columns:
        if c not in x_in.columns:
            x_in[c] = 0.0
    x_in = x_in[feature_columns]
    x_in = x_in.fillna(0.0)

    pred = float(model.predict(x_in)[0])
    pred = max(pred, 0.0)
    uncertainty = max(pred * 0.2, 500.0)

    latest_month = pd.Period(str(latest['month']), freq='M')
    pred_month = str(latest_month + 1)

    payload = {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'dataSource': data_source,
        'loadWarning': load_warning,
        'endpointVersion': '2.0.0',
        'modelName': model_name,
        'modelMetrics': model_metrics,
        'latestObservedMonth': str(latest['month']),
        'predictedMonth': pred_month,
        'predictedTotalEstimatedValue': round(pred, 2),
        'predictionRange': {
            'lower': round(max(pred - uncertainty, 0.0), 2),
            'upper': round(pred + uncertainty, 2),
        },
        'featureSnapshot': {
            'lagTotal1': round(_safe_float(latest.get('lag_total_1')), 2),
            'rolling6TotalMean': round(_safe_float(latest.get('rolling6_total_mean')), 2),
            'monthNum': _safe_int(latest.get('month_num')),
            'avgGiftValue': round(_safe_float(latest.get('avg_gift_value')), 2),
            'uniqueSupporters': _safe_int(latest.get('unique_supporters')),
        },
    }
    _donations_forecast_cache['signature'] = signature
    _donations_forecast_cache['payload'] = payload
    _write_forecast_cache_file(signature, payload)
    return payload


def _safe_load_donations_next_month_forecast() -> dict[str, Any]:
    try:
        donations_df, _, _ = _load_donations_prepared_dataframe()
        if donations_df is None:
            return _build_donations_next_month_forecast()
        current_signature = _compute_donations_signature(donations_df)

        mem_sig = _donations_forecast_cache.get('signature')
        mem_payload = _donations_forecast_cache.get('payload')
        if mem_sig == current_signature and isinstance(mem_payload, dict):
            return mem_payload

        file_sig, file_payload = _read_forecast_cache_file()
        if file_sig == current_signature and isinstance(file_payload, dict):
            _donations_forecast_cache['signature'] = file_sig
            _donations_forecast_cache['payload'] = file_payload
            return file_payload

        # Stale-while-refresh: if we have any previous payload, return it immediately
        # and refresh in background so dashboards never go blank.
        fallback_payload = mem_payload if isinstance(mem_payload, dict) else file_payload
        if isinstance(fallback_payload, dict):
            global _donations_forecast_refreshing
            with _donations_forecast_lock:
                should_start = not _donations_forecast_refreshing
                if should_start:
                    _donations_forecast_refreshing = True

            if should_start:
                def _refresh():
                    global _donations_forecast_refreshing
                    try:
                        _build_donations_next_month_forecast()
                    finally:
                        with _donations_forecast_lock:
                            _donations_forecast_refreshing = False

                threading.Thread(target=_refresh, daemon=True).start()
            stale = dict(fallback_payload)
            stale['isRefreshing'] = True
            stale['generatedAtUtc'] = stale.get('generatedAtUtc') or datetime.now(timezone.utc).isoformat()
            return stale

        return _build_donations_next_month_forecast()
    except Exception as ex:
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'dataSource': 'error',
            'loadWarning': f'Forecast build failed: {ex}',
            'endpointVersion': '2.0.0',
            'modelName': '',
            'modelMetrics': None,
            'latestObservedMonth': None,
            'predictedMonth': None,
            'predictedTotalEstimatedValue': None,
            'predictionRange': None,
            'featureSnapshot': {},
        }


app = FastAPI(
    title='Lighthouse ML API',
    description='Social media analytics, donations pipeline trends, and tier-1 program analytics for admin dashboard.',
    version='1.3.0',
)
_cache = _load_cached_or_build()
_impact_pipeline_cache = _load_impact_pipeline()
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


@app.get('/impact/analytics')
def impact_analytics() -> dict[str, Any]:
    """Public impact / snapshot pipeline overlay consumed by Lighthouse GET /api/impact."""
    return _impact_pipeline_cache

@app.get('/donations/analytics')
def donations_analytics() -> dict[str, Any]:
    """Trends + channel/type mix from live DB (fallback CSV); optional metrics from notebook artifacts."""
    return _safe_load_donations_analytics()


@app.get('/donations/explore-summary')
def donations_explore_summary() -> dict[str, Any]:
    """Notebook-aligned EDA (distributions, IQR outliers, means by type/channel) for deploy verification."""
    return _safe_load_donations_explore_summary()


@app.get('/donations/next-month-forecast')
def donations_next_month_forecast() -> dict[str, Any]:
    """Predict next calendar month total donation value using model artifact and live DB features."""
    return _safe_load_donations_next_month_forecast()


@app.get('/reports/tier1-analytics')
def reports_tier1_analytics() -> dict[str, Any]:
    """Residents, education, and health & wellbeing from live DB (when configured) or CSV + notebook artifacts."""
    return safe_build_tier1_analytics()
