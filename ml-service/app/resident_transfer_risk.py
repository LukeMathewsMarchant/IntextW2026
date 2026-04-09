"""Resident transfer-risk scoring: live PostgreSQL + notebook-aligned features (see resident_transfer_risk_pipeline)."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.db_access import fetch_dataframe

PREDICTION_WINDOW_DAYS = 30
SEVERITY_MAP = {'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4}

LEAKAGE_COLS = [
    'target_transferred',
    'case_status',
    'resident_id',
    'case_control_no',
    'internal_code',
    'date_closed',
    'days_enrolled_to_closed',
    'notes_restricted',
    'created_at',
    'reintegration_status',
]

RESIDENTS_SQL = 'SELECT * FROM residents'

INCIDENTS_SQL = """
SELECT
    incident_id,
    resident_id,
    incident_date::timestamp AS incident_date,
    severity::text AS severity,
    resolved,
    follow_up_required
FROM incident_reports
"""

EDUCATION_SQL = """
SELECT
    education_record_id,
    resident_id,
    record_date::timestamp AS record_date,
    education_level,
    school_name,
    enrollment_status,
    attendance_rate,
    progress_percent,
    completion_status::text AS completion_status
FROM education_records
"""


def _service_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _repo_root() -> Path:
    return _service_root().parent


def _resolve_model_path() -> Path:
    env = (os.getenv('RESIDENT_TRANSFER_RISK_MODEL_PATH') or '').strip()
    if env:
        return Path(env)
    service = _service_root()
    for p in (
        service / 'artifacts' / 'resident_transfer_risk_model.joblib',
        _repo_root() / 'ml-pipelines' / 'artifacts' / 'resident_transfer_risk_model.joblib',
    ):
        if p.is_file():
            return p
    return service / 'artifacts' / 'resident_transfer_risk_model.joblib'


def _resolve_metrics_path() -> Path:
    env = (os.getenv('RESIDENT_TRANSFER_RISK_METRICS_PATH') or '').strip()
    if env:
        return Path(env)
    service = _service_root()
    for p in (
        service / 'artifacts' / 'resident_transfer_risk_metrics.csv',
        _repo_root() / 'ml-pipelines' / 'artifacts' / 'resident_transfer_risk_metrics.csv',
    ):
        if p.is_file():
            return p
    return service / 'artifacts' / 'resident_transfer_risk_metrics.csv'


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


def _boolish_to_num(s: pd.Series) -> pd.Series:
    def one(x: Any) -> int:
        if x is True:
            return 1
        if x is False:
            return 0
        t = str(x).strip().lower()
        if t in ('true', '1', 'yes', 't'):
            return 1
        return 0

    return s.map(one)


def _engineer_joined_active(res: pd.DataFrame, inc: pd.DataFrame, edu: pd.DataFrame) -> pd.DataFrame:
    """Active residents only; same 30-day incident/education windows as the training notebook."""
    if res.empty:
        return pd.DataFrame()

    cs = res['case_status'].astype(str).str.strip().str.lower()
    base = res[cs == 'active'].copy()
    if base.empty:
        return pd.DataFrame()

    base = base[base['date_enrolled'].notna()].copy()
    if base.empty:
        return pd.DataFrame()

    base['prediction_cutoff_date'] = base['date_enrolled'] + pd.Timedelta(days=PREDICTION_WINDOW_DAYS)

    inc2 = inc.copy()
    if not inc2.empty and 'severity' in inc2.columns:
        inc2['severity_num'] = inc2['severity'].map(SEVERITY_MAP)
    else:
        inc2['severity_num'] = pd.NA

    if 'resolved' in inc2.columns:
        inc2['resolved_num'] = _boolish_to_num(inc2['resolved'])
    else:
        inc2['resolved_num'] = 0

    if 'follow_up_required' in inc2.columns:
        inc2['follow_up_num'] = _boolish_to_num(inc2['follow_up_required'])
    else:
        inc2['follow_up_num'] = 0

    inc2['unresolved_high'] = ((inc2['resolved_num'] == 0) & (inc2['severity_num'] >= 3)).astype(int)

    inc30 = base[['resident_id', 'date_enrolled', 'prediction_cutoff_date']].merge(inc2, on='resident_id', how='left')
    inc30 = inc30[
        inc30['incident_date'].notna()
        & inc30['date_enrolled'].notna()
        & (inc30['incident_date'] >= inc30['date_enrolled'])
        & (inc30['incident_date'] <= inc30['prediction_cutoff_date'])
    ].copy()

    inc_agg = inc30.groupby('resident_id', as_index=False).agg(
        incident_count_30d=('incident_id', 'count'),
        incident_severity_mean_30d=('severity_num', 'mean'),
        incident_severity_max_30d=('severity_num', 'max'),
        unresolved_ratio_30d=('resolved_num', lambda s: 1 - s.fillna(0).mean()),
        unresolved_high_count_30d=('unresolved_high', 'sum'),
        follow_up_ratio_30d=('follow_up_num', 'mean'),
    )

    edu30 = base[['resident_id', 'date_enrolled', 'prediction_cutoff_date']].merge(edu, on='resident_id', how='left')
    edu30 = edu30[
        edu30['record_date'].notna()
        & edu30['date_enrolled'].notna()
        & (edu30['record_date'] >= edu30['date_enrolled'])
        & (edu30['record_date'] <= edu30['prediction_cutoff_date'])
    ].copy()

    edu_agg = edu30.sort_values(['resident_id', 'record_date']).groupby('resident_id', as_index=False).agg(
        edu_records_30d=('education_record_id', 'count'),
        attendance_mean_30d=('attendance_rate', 'mean'),
        attendance_last_30d=('attendance_rate', 'last'),
        progress_mean_30d=('progress_percent', 'mean'),
        progress_last_30d=('progress_percent', 'last'),
    )
    edu_agg['progress_delta_30d'] = edu_agg['progress_last_30d'] - edu_agg['progress_mean_30d']
    edu_agg['attendance_delta_30d'] = edu_agg['attendance_last_30d'] - edu_agg['attendance_mean_30d']

    joined = base.merge(inc_agg, on='resident_id', how='left').merge(edu_agg, on='resident_id', how='left')
    return joined


def _model_metrics_from_csv(metrics_path: Path) -> dict[str, Any] | None:
    if not metrics_path.is_file():
        return None
    try:
        mdf = pd.read_csv(metrics_path)
        if len(mdf) == 0:
            return None
        row = mdf.iloc[0]
        return {
            'selectedModel': str(row.get('selected_model', '')),
            'threshold': _safe_float(row.get('threshold')),
            'rocAuc': _safe_float(row.get('roc_auc')),
            'avgPrecision': _safe_float(row.get('avg_precision')),
            'precisionAtThreshold': _safe_float(row.get('precision_at_threshold')),
            'recallAtThreshold': _safe_float(row.get('recall_at_threshold')),
            'f1AtThreshold': _safe_float(row.get('f1_at_threshold')),
        }
    except Exception:
        return None


def _pack_scored_response(
    scored: pd.DataFrame,
    tier_col: str,
    metrics_path: Path,
    data_source: str,
    load_warning: str = '',
) -> dict[str, Any]:
    tier_counts: list[dict[str, Any]] = []
    for label, count in scored[tier_col].fillna('Unknown').value_counts().items():
        tier_counts.append({'tier': str(label), 'count': int(count)})

    top_residents: list[dict[str, Any]] = []
    has_ids = all(c in scored.columns for c in ('resident_id', 'case_control_no'))
    if has_ids:
        tier_rank = {'High': 3, 'Medium': 2, 'Monitor': 1}
        ranked = scored.copy()
        ranked['__tier_rank'] = ranked[tier_col].astype(str).map(tier_rank).fillna(0)
        ranked = ranked.sort_values(['__tier_rank', 'pred_transfer_prob'], ascending=[False, False]).head(5)
        for _, row in ranked.iterrows():
            top_residents.append(
                {
                    'residentId': _safe_int(row.get('resident_id')),
                    'caseControlNo': str(row.get('case_control_no') or ''),
                    'internalCode': str(row.get('internal_code') or ''),
                    'assignedSocialWorker': str(row.get('assigned_social_worker') or ''),
                    'safehouseId': str(row.get('safehouse_id') or ''),
                    'riskTier': str(row.get(tier_col) or ''),
                    'predTransferProb': round(_safe_float(row.get('pred_transfer_prob')), 4),
                }
            )

    n = int(len(scored))
    high_count = int((scored[tier_col].astype(str) == 'High').sum())
    high_share = round(high_count / n, 4) if n else 0.0
    avg_prob = round(float(scored['pred_transfer_prob'].mean()), 4) if n else 0.0

    return {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'dataSource': data_source,
        'loadWarning': load_warning,
        'endpointVersion': '1.1.0',
        'question': 'Which residents are at risk of transfer instead of closure?',
        'summary': {
            'scoredResidents': n,
            'highRiskResidents': high_count,
            'highRiskShare': high_share,
            'avgTransferProbability': avg_prob,
        },
        'modelMetrics': _model_metrics_from_csv(metrics_path),
        'riskTierCounts': tier_counts,
        'topResidents': top_residents,
    }


def build_resident_transfer_risk_summary_from_database(conn: str) -> dict[str, Any]:
    """Score **active** residents using the bundled sklearn pipeline and live DB rows."""
    res = fetch_dataframe(conn, RESIDENTS_SQL)
    inc = fetch_dataframe(conn, INCIDENTS_SQL)
    edu = fetch_dataframe(conn, EDUCATION_SQL)

    for c in ('date_of_admission', 'date_enrolled', 'date_closed', 'created_at'):
        if c in res.columns:
            res[c] = pd.to_datetime(res[c], errors='coerce')

    if 'incident_date' in inc.columns:
        inc['incident_date'] = pd.to_datetime(inc['incident_date'], errors='coerce')
    if 'record_date' in edu.columns:
        edu['record_date'] = pd.to_datetime(edu['record_date'], errors='coerce')

    joined = _engineer_joined_active(res, inc, edu)
    if joined.empty:
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'dataSource': 'database',
            'loadWarning': 'No active residents with a known enrollment date to score.',
            'endpointVersion': '1.1.0',
            'question': 'Which residents are at risk of transfer instead of closure?',
            'summary': {
                'scoredResidents': 0,
                'highRiskResidents': 0,
                'highRiskShare': 0.0,
                'avgTransferProbability': 0.0,
            },
            'modelMetrics': _model_metrics_from_csv(_resolve_metrics_path()),
            'riskTierCounts': [],
            'topResidents': [],
        }

    model_path = _resolve_model_path()
    if not model_path.is_file():
        raise FileNotFoundError(f'Resident transfer risk model not found: {model_path}')

    pipeline = joblib.load(model_path)

    meta_cols = ['resident_id', 'case_control_no', 'internal_code', 'assigned_social_worker', 'safehouse_id']
    for c in meta_cols:
        if c not in joined.columns:
            joined[c] = ''

    X = joined.drop(columns=[c for c in LEAKAGE_COLS if c in joined.columns], errors='ignore')
    for c in list(X.columns):
        if str(X[c].dtype).startswith('datetime64'):
            X = X.drop(columns=[c])

    if hasattr(pipeline, 'feature_names_in_') and getattr(pipeline, 'feature_names_in_', None) is not None:
        X = X.reindex(columns=list(pipeline.feature_names_in_))

    proba = pipeline.predict_proba(X)[:, 1]
    scored = joined[meta_cols].reset_index(drop=True).copy()
    scored['pred_transfer_prob'] = proba
    scored['risk_tier'] = pd.cut(
        scored['pred_transfer_prob'],
        bins=[-0.001, 0.5, 0.75, 1.0],
        labels=['Monitor', 'Medium', 'High'],
    )
    tier_col = 'risk_tier'

    return _pack_scored_response(
        scored,
        tier_col,
        _resolve_metrics_path(),
        'database',
        '',
    )
