"""
Load donations predictive model artifacts (from donations.ipynb) and print one prediction.

Does not import or change ml-service/app/main.py (social media API).

Usage (from repo root):
  python ml-pipelines/predict_donation_value.py
  python ml-pipelines/predict_donation_value.py --json path/to/row.json

Run after: donations.ipynb has written artifacts/donations_sklearn_pipelines.joblib
Requires: joblib, pandas, scikit-learn (same env as notebooks).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

_HERE = Path(__file__).resolve().parent
_ART = _HERE / "artifacts"
_BUNDLE = _ART / "donations_sklearn_pipelines.joblib"
_SCHEMA = _ART / "donations_model_schema.json"

_DEFAULT_ROW: dict = {
    "donation_type": "Monetary",
    "is_recurring": 0,
    "campaign_name": None,
    "channel_source": "Direct",
    "currency_code": "PHP",
    "impact_unit": "pesos",
    "donation_year": 2025,
    "donation_month": 6,
    "has_social_referral": 0,
}


def _row_to_frame(row: dict, columns: list[str]) -> pd.DataFrame:
    """Build one-row DataFrame; use float NaN for missing categoricals (not pd.NA — sklearn imputers reject it)."""
    out: dict = {}
    for c in columns:
        v = row.get(c, None)
        if v is None or (isinstance(v, str) and v.strip() == ""):
            out[c] = np.nan
        elif c in ("is_recurring", "has_social_referral", "donation_year", "donation_month"):
            out[c] = int(v)
        else:
            out[c] = v
    return pd.DataFrame([out])


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict estimated_value from donations_sklearn_pipelines.joblib")
    parser.add_argument("--json", type=Path, default=None, help="JSON object with keys from donations_model_schema.json")
    args = parser.parse_args()

    if not _BUNDLE.is_file():
        print(f"Missing {_BUNDLE}. Run donations.ipynb (pipeline_kit cell) first.", file=sys.stderr)
        sys.exit(1)
    if not _SCHEMA.is_file():
        print(f"Missing {_SCHEMA}.", file=sys.stderr)
        sys.exit(1)

    schema = json.loads(_SCHEMA.read_text(encoding="utf-8"))
    columns = list(schema["feature_columns"])

    if args.json is not None:
        row = json.loads(args.json.read_text(encoding="utf-8"))
    else:
        row = dict(_DEFAULT_ROW)

    bundle = joblib.load(_BUNDLE)
    pipe = bundle.get("predictive_pipeline")
    if pipe is None:
        print("Bundle has no predictive_pipeline key.", file=sys.stderr)
        sys.exit(1)

    X = _row_to_frame(row, columns)
    pred = float(pipe.predict(X)[0])
    print(json.dumps({"predictedEstimatedValue": pred, "target": schema.get("target", "estimated_value")}, indent=2))


if __name__ == "__main__":
    main()
