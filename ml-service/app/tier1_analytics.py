"""
Tier-1 program analytics for Reports & analytics: residents, education, health & wellbeing.
Prefers live PostgreSQL (same connection as social media: SOCIAL_MEDIA_DB_URL or
ConnectionStrings__DefaultConnection), falls back to datasets/*.csv. Notebook artifacts
still supply top drivers and model metadata.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from app.db_access import fetch_dataframe, resolve_db_connection_value

RESIDENTS_SQL = """
SELECT
    resident_id,
    safehouse_id,
    case_status::text AS case_status,
    current_risk_level::text AS current_risk_level
FROM residents
"""

EDUCATION_SQL = """
SELECT
    education_record_id,
    resident_id,
    record_date,
    education_level,
    school_name,
    enrollment_status,
    attendance_rate,
    progress_percent,
    completion_status::text AS completion_status
FROM education_records
"""

HEALTH_SQL = """
SELECT
    health_record_id,
    resident_id,
    record_date,
    general_health_score,
    nutrition_score,
    sleep_quality_score,
    energy_level_score,
    height_cm,
    weight_kg,
    medical_checkup_done,
    dental_checkup_done,
    psychological_checkup_done
FROM health_wellbeing_records
"""


def _normalize_frame_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    out.columns = [str(c).lower() for c in out.columns]
    return out


def _read_csv_normalized(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    return _normalize_frame_columns(df)


def _load_residents_frame(root: Path) -> tuple[pd.DataFrame, str, str]:
    csv_path = Path(os.getenv('RESIDENTS_DATASET_PATH', str(root / 'datasets' / 'residents.csv')))
    conn = resolve_db_connection_value()
    if conn:
        try:
            df = fetch_dataframe(conn, RESIDENTS_SQL)
            return df, 'database', ''
        except Exception as ex:
            err = str(ex)
            if csv_path.is_file():
                try:
                    return _read_csv_normalized(csv_path), 'csv', f'Database query failed ({err}); using CSV fallback.'
                except Exception as ex2:
                    return pd.DataFrame(), 'error', f'Database: {err}; CSV: {ex2}'
            return pd.DataFrame(), 'database-error', err
    if csv_path.is_file():
        try:
            return _read_csv_normalized(csv_path), 'csv', ''
        except Exception as ex:
            return pd.DataFrame(), 'error', str(ex)
    return pd.DataFrame(), 'missing-file', f'No database URL and residents CSV missing: {csv_path}'


def _load_education_frame(root: Path) -> tuple[pd.DataFrame, str, str]:
    csv_path = Path(os.getenv('EDUCATION_DATASET_PATH', str(root / 'datasets' / 'education_records.csv')))
    conn = resolve_db_connection_value()
    if conn:
        try:
            df = fetch_dataframe(conn, EDUCATION_SQL)
            return df, 'database', ''
        except Exception as ex:
            err = str(ex)
            if csv_path.is_file():
                try:
                    return _read_csv_normalized(csv_path), 'csv', f'Database query failed ({err}); using CSV fallback.'
                except Exception as ex2:
                    return pd.DataFrame(), 'error', f'Database: {err}; CSV: {ex2}'
            return pd.DataFrame(), 'database-error', err
    if csv_path.is_file():
        try:
            return _read_csv_normalized(csv_path), 'csv', ''
        except Exception as ex:
            return pd.DataFrame(), 'error', str(ex)
    return pd.DataFrame(), 'missing-file', f'No database URL and education CSV missing: {csv_path}'


def _load_health_frame(root: Path) -> tuple[pd.DataFrame, str, str]:
    csv_path = Path(
        os.getenv('HEALTH_WELLBEING_DATASET_PATH', str(root / 'datasets' / 'health_wellbeing_records.csv'))
    )
    conn = resolve_db_connection_value()
    if conn:
        try:
            df = fetch_dataframe(conn, HEALTH_SQL)
            return df, 'database', ''
        except Exception as ex:
            err = str(ex)
            if csv_path.is_file():
                try:
                    return _read_csv_normalized(csv_path), 'csv', f'Database query failed ({err}); using CSV fallback.'
                except Exception as ex2:
                    return pd.DataFrame(), 'error', f'Database: {err}; CSV: {ex2}'
            return pd.DataFrame(), 'database-error', err
    if csv_path.is_file():
        try:
            return _read_csv_normalized(csv_path), 'csv', ''
        except Exception as ex:
            return pd.DataFrame(), 'error', str(ex)
    return pd.DataFrame(), 'missing-file', f'No database URL and health CSV missing: {csv_path}'


def _append_live_note(model_note: str | None, data_source: str) -> str | None:
    if data_source != 'database':
        return model_note
    extra = ' Live data from PostgreSQL.'
    return (model_note + extra) if model_note else extra.strip()


def _repo_root(ml_service_dir: Path) -> Path:
    return ml_service_dir.resolve().parent


def _artifacts(ml_service_dir: Path) -> Path:
    return _repo_root(ml_service_dir) / 'ml-pipelines' / 'artifacts'


def _humanize_feature(raw: str) -> str:
    s = (raw or '').strip()
    if not s or s.lower().startswith('unnamed'):
        return s
    s = re.sub(r'^(cat__|num__)', '', s)
    s = s.replace('__', ' · ').replace('_', ' ')
    return s[:80] + ('…' if len(s) > 80 else '')


def _read_top_features(path: Path, max_n: int = 8) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        df = pd.read_csv(path)
    except Exception:
        return []

    if df.empty:
        return []

    # residents / standard
    if 'feature' in df.columns and 'importance' in df.columns:
        df = df.sort_values('importance', ascending=False)
        out = []
        for _, row in df.head(max_n).iterrows():
            label = _humanize_feature(str(row['feature']))
            if not label:
                continue
            out.append({'label': label, 'importance': round(float(row['importance']), 6)})
        return out

    # education
    if 'feature' in df.columns and 'rf_importance_agg' in df.columns:
        df = df.sort_values('rf_importance_agg', ascending=False)
        out = []
        for _, row in df.head(max_n).iterrows():
            label = _humanize_feature(str(row['feature']))
            if label.lower() == 'resident id':
                continue
            if not label:
                continue
            out.append({'label': label, 'importance': round(float(row['rf_importance_agg']), 6)})
        return out

    # health (first column unnamed)
    imp_col = 'importance' if 'importance' in df.columns else None
    if imp_col:
        feat_col = [c for c in df.columns if c != imp_col][0]
        df = df.sort_values(imp_col, ascending=False)
        out = []
        for _, row in df.head(max_n).iterrows():
            label = _humanize_feature(str(row[feat_col]))
            if not label:
                continue
            out.append({'label': label, 'importance': round(float(row[imp_col]), 6)})
        return out

    return []


def _share_counts(counts: dict[str, int]) -> list[dict[str, Any]]:
    total = max(sum(counts.values()), 1)
    rows = []
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        rows.append({'label': str(k) if k else 'Unknown', 'count': int(v), 'share': round(v / total, 4)})
    return rows


def _empty_section(data_source: str, load_warning: str) -> dict[str, Any]:
    return {
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': {},
        'chartRows': [],
        'secondaryChartRows': [],
        'safehouseRows': [],
        'topDrivers': [],
        'pipelineTarget': None,
        'modelNote': None,
        'businessQuestion': None,
        'modelQuality': None,
    }


def _empty_residents_section(data_source: str, load_warning: str) -> dict[str, Any]:
    d = _empty_section(data_source, load_warning)
    d['summary'] = {'totalResidents': 0, 'activeResidents': 0, 'distinctSafehouses': 0}
    return d


def _empty_education_section(data_source: str, load_warning: str) -> dict[str, Any]:
    d = _empty_section(data_source, load_warning)
    d['summary'] = {
        'totalRecords': 0,
        'uniqueResidents': 0,
        'avgAttendancePercent': None,
        'avgProgressPercent': None,
    }
    return d


def _empty_health_section(data_source: str, load_warning: str) -> dict[str, Any]:
    d = _empty_section(data_source, load_warning)
    d['summary'] = {
        'totalRecords': 0,
        'uniqueResidents': 0,
        'avgGeneralHealthScore': None,
        'medianGeneralHealthScore': None,
        'avgNutritionScore': None,
        'avgSleepQualityScore': None,
        'avgEnergyLevelScore': None,
        'medicalCheckupShare': None,
        'dentalCheckupShare': None,
        'psychologicalCheckupShare': None,
    }
    return d


def build_residents_section(root: Path, art: Path) -> dict[str, Any]:
    schema_path = art / 'residents_model_schema.json'
    features_path = art / 'residents_top_features.csv'

    df, data_source, load_warning = _load_residents_frame(root)

    if data_source == 'missing-file':
        return _empty_residents_section('missing-file', load_warning)

    if data_source in ('error', 'database-error') and df.empty:
        return _empty_residents_section(data_source, load_warning)

    if df.empty:
        return _empty_residents_section(data_source if data_source in ('database', 'csv') else 'empty', load_warning)

    pipeline_target = None
    if schema_path.is_file():
        try:
            schema = json.loads(schema_path.read_text(encoding='utf-8'))
            pipeline_target = schema.get('target')
        except Exception:
            pass

    risk_col = 'current_risk_level' if 'current_risk_level' in df.columns else None
    risk_counts: dict[str, int] = {}
    if risk_col:
        for v in df[risk_col].fillna('Unknown').astype(str):
            risk_counts[v] = risk_counts.get(v, 0) + 1
    chart_rows = _share_counts(risk_counts)

    status_counts: dict[str, int] = {}
    if 'case_status' in df.columns:
        for v in df['case_status'].fillna('Unknown').astype(str):
            status_counts[v] = status_counts.get(v, 0) + 1
    secondary = _share_counts(status_counts)

    sh_counts: dict[str, int] = {}
    if 'safehouse_id' in df.columns:
        for v in df['safehouse_id'].fillna('Unassigned'):
            sh_counts[str(v)] = sh_counts.get(str(v), 0) + 1
    top_sh = sorted(sh_counts.items(), key=lambda x: -x[1])[:8]
    safehouse_rows = [{'safehouseId': k, 'count': v} for k, v in top_sh]

    active = 0
    if 'case_status' in df.columns:
        active = int(df['case_status'].astype(str).str.lower().eq('active').sum())

    summary = {
        'totalResidents': int(len(df)),
        'activeResidents': active,
        'distinctSafehouses': len(sh_counts),
    }

    top_drivers = _read_top_features(features_path, 8)

    model_note = (
        'Multiclass model context from ml-pipelines (current risk level). '
        'Drivers are aggregate feature importances—indicative, not individual predictions.'
        if pipeline_target
        else None
    )
    model_note = _append_live_note(model_note, data_source)

    return {
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': summary,
        'chartRows': chart_rows,
        'secondaryChartRows': secondary,
        'safehouseRows': safehouse_rows,
        'topDrivers': top_drivers,
        'pipelineTarget': pipeline_target,
        'modelNote': model_note,
        'businessQuestion': None,
        'modelQuality': None,
    }


def build_education_section(root: Path, art: Path) -> dict[str, Any]:
    schema_path = art / 'education_records_model_schema.json'
    features_path = art / 'education_records_top_features.csv'

    df, data_source, load_warning = _load_education_frame(root)

    if data_source == 'missing-file':
        return _empty_education_section('missing-file', load_warning)

    if data_source in ('error', 'database-error') and df.empty:
        return _empty_education_section(data_source, load_warning)

    if df.empty:
        return _empty_education_section(data_source if data_source in ('database', 'csv') else 'empty', load_warning)

    pipeline_target = None
    if schema_path.is_file():
        try:
            schema = json.loads(schema_path.read_text(encoding='utf-8'))
            pipeline_target = schema.get('target')
        except Exception:
            pass

    comp_counts: dict[str, int] = {}
    if 'completion_status' in df.columns:
        for v in df['completion_status'].fillna('Unknown').astype(str):
            comp_counts[v] = comp_counts.get(v, 0) + 1
    chart_rows = _share_counts(comp_counts)

    att = prog = None
    if 'attendance_rate' in df.columns:
        s = pd.to_numeric(df['attendance_rate'], errors='coerce').dropna()
        if len(s):
            att = round(float(s.mean()), 2)
    if 'progress_percent' in df.columns:
        s2 = pd.to_numeric(df['progress_percent'], errors='coerce').dropna()
        if len(s2):
            prog = round(float(s2.mean()), 2)

    uniq_r = 0
    if 'resident_id' in df.columns:
        uniq_r = int(df['resident_id'].nunique())

    summary = {
        'totalRecords': int(len(df)),
        'uniqueResidents': uniq_r,
        'avgAttendancePercent': att,
        'avgProgressPercent': prog,
    }

    top_drivers = _read_top_features(features_path, 8)

    model_note = (
        'Progress and completion patterns from the education records pipeline. '
        'Top drivers are notebook feature importances.'
        if pipeline_target
        else None
    )
    model_note = _append_live_note(model_note, data_source)

    return {
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': summary,
        'chartRows': chart_rows,
        'secondaryChartRows': [],
        'safehouseRows': [],
        'topDrivers': top_drivers,
        'pipelineTarget': pipeline_target,
        'modelNote': model_note,
        'businessQuestion': None,
        'modelQuality': None,
    }


def _bool_share(series: pd.Series) -> float | None:
    if series.empty:
        return None
    s = series.astype(str).str.lower().isin(('true', '1', 'yes', 't'))
    return round(float(s.mean()), 4)


def build_health_section(root: Path, art: Path) -> dict[str, Any]:
    schema_path = art / 'health_wellbeing_model_schema.json'
    features_path = art / 'health_wellbeing_top_features.csv'

    df, data_source, load_warning = _load_health_frame(root)

    if data_source == 'missing-file':
        return _empty_health_section('missing-file', load_warning)

    if data_source in ('error', 'database-error') and df.empty:
        return _empty_health_section(data_source, load_warning)

    if df.empty:
        return _empty_health_section(data_source if data_source in ('database', 'csv') else 'empty', load_warning)

    ghs = pd.to_numeric(df['general_health_score'], errors='coerce') if 'general_health_score' in df.columns else pd.Series(dtype=float)
    ghs_clean = ghs.dropna()

    mean_s = med_s = None
    if len(ghs_clean):
        mean_s = round(float(ghs_clean.mean()), 3)
        med_s = round(float(ghs_clean.median()), 3)

    medical = _bool_share(df['medical_checkup_done']) if 'medical_checkup_done' in df.columns else None
    dental = _bool_share(df['dental_checkup_done']) if 'dental_checkup_done' in df.columns else None
    psych = _bool_share(df['psychological_checkup_done']) if 'psychological_checkup_done' in df.columns else None

    nu = 0
    if 'resident_id' in df.columns:
        nu = int(df['resident_id'].nunique())

    nut = sleep = energy = None
    for col, name in (
        ('nutrition_score', 'avgNutritionScore'),
        ('sleep_quality_score', 'avgSleepQualityScore'),
        ('energy_level_score', 'avgEnergyLevelScore'),
    ):
        if col in df.columns:
            s = pd.to_numeric(df[col], errors='coerce').dropna()
            val = round(float(s.mean()), 3) if len(s) else None
            if name == 'avgNutritionScore':
                nut = val
            elif name == 'avgSleepQualityScore':
                sleep = val
            else:
                energy = val

    model_quality: dict[str, Any] | None = None
    business_q = None
    pipeline_target = None
    if schema_path.is_file():
        try:
            schema = json.loads(schema_path.read_text(encoding='utf-8'))
            pipeline_target = schema.get('target')
            business_q = schema.get('business_question')
            mblock = schema.get('metrics') or {}
            sel = schema.get('selected_model') or 'RandomForest'
            metrics = mblock.get(sel) or mblock.get('RandomForest')
            if isinstance(metrics, dict):
                model_quality = {
                    'selectedModel': sel,
                    'holdoutMae': metrics.get('MAE'),
                    'holdoutRmse': metrics.get('RMSE'),
                    'holdoutR2': metrics.get('R2'),
                }
        except Exception:
            pass

    top_drivers = _read_top_features(features_path, 8)

    model_note = (
        'Regression on general health score (notebook RandomForest holdout metrics where available). '
        'Scores are operational indicators, not clinical diagnoses.'
        if pipeline_target
        else None
    )
    model_note = _append_live_note(model_note, data_source)

    summary = {
        'totalRecords': int(len(df)),
        'uniqueResidents': nu,
        'avgGeneralHealthScore': mean_s,
        'medianGeneralHealthScore': med_s,
        'avgNutritionScore': nut,
        'avgSleepQualityScore': sleep,
        'avgEnergyLevelScore': energy,
        'medicalCheckupShare': medical,
        'dentalCheckupShare': dental,
        'psychologicalCheckupShare': psych,
    }

    return {
        'dataSource': data_source,
        'loadWarning': load_warning,
        'summary': summary,
        'chartRows': [],
        'secondaryChartRows': [],
        'safehouseRows': [],
        'topDrivers': top_drivers,
        'pipelineTarget': pipeline_target,
        'modelNote': model_note,
        'businessQuestion': business_q,
        'modelQuality': model_quality,
    }


def _ml_service_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def build_tier1_analytics() -> dict[str, Any]:
    """Full payload for GET /reports/tier1-analytics."""
    mls = _ml_service_dir()
    root = _repo_root(mls)
    art = _artifacts(mls)
    return {
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'residents': build_residents_section(root, art),
        'education': build_education_section(root, art),
        'healthWellbeing': build_health_section(root, art),
    }


def safe_build_tier1_analytics() -> dict[str, Any]:
    try:
        return build_tier1_analytics()
    except Exception as ex:
        return {
            'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
            'residents': _empty_residents_section('error', str(ex)),
            'education': _empty_education_section('error', str(ex)),
            'healthWellbeing': _empty_health_section('error', str(ex)),
        }
