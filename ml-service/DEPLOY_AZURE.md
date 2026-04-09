# Azure Deployment Guide (ML Service + .NET Bridge)

## Current production strategy (container)

The **ml-pipelines** Web App runs a **Docker image** built from `ml-service/Dockerfile`. GitHub Actions builds the image, pushes it to **ACR**, updates the Web App’s container image tag, sets app settings, clears any legacy **Startup Command**, and runs a smoke test.

**Teammate workflow (ML API changes):**

1. Edit code under **`ml-service/`** (for example `ml-service/app/main.py`).
2. Commit and push to **`main`**.
3. GitHub runs **Build and deploy ml-service container** when **any** of these change:
   - `ml-service/**`
   - `.github/workflows/main_ml-pipelines-container.yml`
4. Wait for the workflow to finish (especially **Smoke test deployed container**).
5. Confirm **`/health.buildId`** matches that commit’s SHA (or use OpenAPI `info.version` / a feature flag like `endpointVersion` on `/donations/explore-summary`).

You do **not** manually zip-deploy the `ml-service` folder in normal operation. The image is the source of truth for Python code in production.

---

## One-time / ongoing Azure & GitHub setup

### GitHub

- **ACR:** `ACR_LOGIN_SERVER`, `ACR_USERNAME`, `ACR_PASSWORD`
- **Web App target:** repository **variables or secrets** `AZURE_WEBAPP_NAME`, `AZURE_RESOURCE_GROUP` (the App Service that **runs** the container, not the registry resource group)
- **Azure login** for `az` in Actions (existing OIDC / client secrets as configured in the workflow)

### App Service (Linux, custom container)

| Setting | Purpose |
|--------|---------|
| **Startup Command** | **Empty** — the image’s `CMD` runs **gunicorn** (`Dockerfile`). If this is set to `bash /home/site/wwwroot/startup.sh` from an old zip deploy, the container will **503**. |
| **WEBSITES_PORT** | **`8000`** (set by the workflow each deploy) |
| **SCM_DO_BUILD_DURING_DEPLOYMENT** | **`false`** for container mode (workflow sets this; avoids Oryx fighting the container) |
| **ML_API_BUILD_ID** | Set by CI to **`GITHUB_SHA`** for `/health` verification |

**Deployment Center:** If **GitHub** is connected there for the same app, **disconnect** it so it does not compete with your custom Actions workflow.

### Runtime data & optional paths

- **`SOCIAL_MEDIA_DB_URL`** or **`ConnectionStrings__DefaultConnection`** — PostgreSQL for social posts, **donations**, and tier-1 program tables when available.
- Optional fallbacks if the full repo layout is not in the image (usually not needed when DB is set):
  - `SOCIAL_MEDIA_DATASET_PATH`, `DONATIONS_DATASET_PATH`, `DONATIONS_METRICS_PATH`, tier-1 CSV paths (see older comments in `app/main.py` / env examples).
- Forecast artifact path (optional override):
  - `DONATIONS_FORECAST_MODEL_PATH=/app/artifacts/donation_prediction_next_month_model.joblib`
  - default runtime expects the model inside the container image under `/app/artifacts/`.
- **Resident transfer risk** (`GET /residents/transfer-risk-summary`, admin dashboard):
  - In **production**, use the same PostgreSQL settings as social/tier-1 (`SOCIAL_MEDIA_DB_URL` or `ConnectionStrings__DefaultConnection`). The service reads **`residents`**, **`incident_reports`**, and **`education_records`**, engineers the same early-window features as `resident_transfer_risk_pipeline.ipynb`, runs the bundled **`resident_transfer_risk_model.joblib`**, and returns **`dataSource: "database"`**.
  - GitHub Actions copies `resident_transfer_risk_model.joblib` and `resident_transfer_risk_metrics.csv` from `ml-pipelines/artifacts/` into `ml-service/artifacts/` before the Docker build (same pattern as the donations forecast model).
  - If **no** DB URL is set (typical local dev), the endpoint falls back to the precomputed scored CSV under `ml-pipelines/artifacts/` (`dataSource: "artifact_csv"`).

Local-only / artifact refresh (optional):

- `SOCIAL_MEDIA_CACHE_PATH` — precomputed JSON if you run `scripts/build_social_media_cache.py` locally and ship the file (most production setups use **database** instead).

---

## Local development (not production)

From repo root:

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m py_compile app/main.py app/resident_transfer_risk.py
```

Optional: build a social cache file for offline work:

```bash
python3 scripts/build_social_media_cache.py
```

Run the API locally with uvicorn/gunicorn as you prefer; production uses **`Dockerfile`** `CMD` with gunicorn on **port 8000**.

**`startup.sh`** is for **legacy zip / Oryx** App Service layout only — do **not** set it as the container **Startup Command**.

---

## Configure .NET backend (bridge)

On the **backend** App Service (or `appsettings` for the environment):

- `SocialMediaMlApi__BaseUrl=https://<ml-service>.azurewebsites.net`
- `SocialMediaMlApi__AnalyticsPath=/social-media/analytics` (optional; default)
- `SocialMediaMlApi__DonationsAnalyticsPath=/donations/analytics` (optional; default)
- `SocialMediaMlApi__DonationsExploreSummaryPath=/donations/explore-summary` (optional; default)
- `SocialMediaMlApi__DonationsForecastPath=/donations/next-month-forecast` (optional; default)
- `SocialMediaMlApi__ProgramsTier1AnalyticsPath=/reports/tier1-analytics` (optional; default)
- `SocialMediaMlApi__ResidentsTransferRiskSummaryPath=/residents/transfer-risk-summary` (optional; default)
- `SocialMediaMlApi__ApiKey=` (optional)
- `ImpactMlApi__Enabled=true`
- `ImpactMlApi__BaseUrl=` (optional; leave empty to inherit `SocialMediaMlApi__BaseUrl`)
- `ImpactMlApi__AnalyticsPath=/impact/analytics` (optional; default)

Redeploy the **backend** when you add new proxy routes or change client code.

Verify (admin session where required):

- `GET .../api/admin/analytics/social-media`
- `GET .../api/admin/analytics/donations-ml`
- `GET .../api/admin/analytics/donations-explore`
- `GET .../api/admin/analytics/donations-forecast`
- `GET .../api/admin/analytics/programs-tier1`
- `GET .../api/admin/analytics/residents-transfer-risk`

Verify (public impact):

- `GET .../api/impact`
- Confirm `pipelineInsights` is present when ml-service `GET /impact/analytics` is reachable.

---

## Frontend

Redeploy the frontend when UI changes. As admin, open:

- `/Admin/SocialMedia`
- `/Admin/Analytics` (Reports & analytics — donations ML, forecast, tier-1, safehouse comparison, reintegration)

---

## Production smoke checks (after each ML deploy)

```bash
BASE_URL="https://<ml-service>.azurewebsites.net"
curl -fsS "$BASE_URL/health" | jq .
curl -fsS "$BASE_URL/openapi.json" | jq '.info, (.paths | keys)'
curl -fsS "$BASE_URL/donations/analytics" | jq '.dataSource, .summary'
curl -fsS "$BASE_URL/donations/explore-summary" | jq '.endpointVersion, .generatedAtUtc, .dataSource'
curl -fsS "$BASE_URL/donations/next-month-forecast" | jq '.endpointVersion, .predictedMonth, .predictedTotalEstimatedValue, .predictionRange'
curl -fsS "$BASE_URL/reports/tier1-analytics" | jq '.generatedAtUtc, .residents.dataSource, .safehousePerformance.dataSource, .reintegration.summary'
curl -fsS "$BASE_URL/residents/transfer-risk-summary" | jq '.generatedAtUtc, .summary, .riskTierCounts'
curl -fsS "$BASE_URL/impact/analytics" | jq '.pipelineName, .generatedAtUtc, .metricHighlights'
```

Expected:

- `/health`: `status: ok`, `buildId` = deployed commit SHA.
- OpenAPI lists routes you care about (`/donations/analytics`, `/donations/explore-summary`, `/donations/next-month-forecast`, `/reports/tier1-analytics`, `/residents/transfer-risk-summary`, `/impact/analytics`, etc.).
- Donations endpoints: usually `dataSource: "database"` in production when DB is configured.
- Tier-1 endpoint includes non-null `safehousePerformance` and `reintegration` blocks.
- `/impact/analytics` returns pipeline metadata (`pipelineName`, `generatedAtUtc`) and highlights payload for Lighthouse merge.

---

## Team release playbook (routes & quality)

### Before merge

1. Add or change routes in `ml-service/app/main.py` (and dependencies if needed).
2. CI validates: `py_compile`, route greps, `startup.sh` safety checks (see `main_ml-pipelines-container.yml`).
3. Local: `python -m py_compile app/main.py app/resident_transfer_risk.py` (and `bash -n startup.sh` if you touch it).
4. If `main.py` imports a new package (for example `joblib`, `scikit-learn`), add it to `ml-service/requirements.txt` in the same PR.

### After merge

1. Confirm **Build and deploy ml-service container** succeeded on `main`.
2. If you added a **backend** proxy route, merge and deploy the **.NET** app too.
3. If you changed **admin UI**, deploy the **frontend**.

### If deploy is green but the site looks wrong

- **Container:** confirm image tag/digest in the portal, **Log stream**, and `/health.buildId`. Do not use Kudu `wwwroot` as proof of running code.
- **503:** empty **Startup Command**, **`WEBSITES_PORT=8000`**, image pull logs — see “Smoke test returns 503” below.
- **502 from backend analytics cards (local):** check `backend/Lighthouse.Web/appsettings.Development.json` `SocialMediaMlApi.BaseUrl` matches your local ml-service port (`http://127.0.0.1:8001` if using `uvicorn --port 8001`).

### Forecast endpoint troubleshooting (`/donations/next-month-forecast`)

If forecast is blank in UI, run this first:

```bash
curl -fsS "https://<ml-service>.azurewebsites.net/donations/next-month-forecast" | jq .
```

Common outcomes:

- `dataSource: "error"` + `Forecast model artifact not found: ...`
  - The container image does not include `donation_prediction_next_month_model.joblib`.
  - Ensure workflow copies `ml-pipelines/artifacts/donation_prediction_next_month_model.joblib` into `ml-service/artifacts/` **before Docker build**.
  - Ensure Dockerfile includes `COPY artifacts /app/artifacts`.
  - Redeploy container image.
- `No module named 'joblib'` or `No module named 'sklearn'`
  - Add missing package(s) to `ml-service/requirements.txt` and rebuild.
- `dataSource: "database-error"`
  - Verify DB connection settings (`SOCIAL_MEDIA_DB_URL` or `ConnectionStrings__DefaultConnection`) and DB reachability.

To confirm model file exists in running container (App Service SSH):

```bash
ls -la /app/artifacts
python - <<'PY'
import os
print(os.path.isfile('/app/artifacts/donation_prediction_next_month_model.joblib'))
PY
```

Expected: `True`.

### Tier-1 safehouse/reintegration troubleshooting (`/reports/tier1-analytics`)

Run:

```bash
curl -fsS "https://<ml-service>.azurewebsites.net/reports/tier1-analytics" | jq '.safehousePerformance, .reintegration'
```

Interpretation:

- `safehousePerformance.dataSource` of `database-pipeline` or `csv-pipeline`
  - Preferred pipeline-first source (`safehouse_monthly_metrics` table or dataset).
- `safehousePerformance.dataSource` of `derived-db-fallback`
  - Pipeline source unavailable; service derived safehouse KPIs from residents + education + health tables.
- `reintegration.summary.successRate` near `0` with non-zero `eligibleCount`
  - Check `case_status`, `reintegration_status`, and `date_closed` quality in `residents`.
- `loadWarning` is populated
  - Endpoint is still serving data, but warns that fallback mode is active or an upstream source failed.

---

## Smoke test returns 503

1. **Startup Command** must be **empty** (portal → Configuration → General settings).
2. **`WEBSITES_PORT=8000`**
3. **Log stream** / **Diagnose and solve problems** — image pull auth, Python tracebacks, `Listening at: http://0.0.0.0:8000`.
4. **Cold start** — first request can take a long time (imports + cache); the workflow retries for several minutes.

---

## Rollback (container)

Point the Web App at a previous image tag (known-good SHA), then restart:

```bash
az webapp config container set \
  --name <app> \
  --resource-group <rg> \
  --container-image-name <acr-login-server>/ml-service:<previous-sha>

az webapp restart --name <app> --resource-group <rg>
```

---

## Appendix: legacy zip / Oryx (do not use for current production)

If someone ever revives zip deploy to the same app:

- Startup: `bash /home/site/wwwroot/startup.sh`
- **`SCM_DO_BUILD_DURING_DEPLOYMENT=true`**
- Kudu: inspect `/home/site/wwwroot/app/main.py`

This conflicts with **container** mode; pick **one** deploy path per Web App.

### Rules of engagement

- Do not set a **Startup Command** that points at host paths unless they exist **inside** the running image.
- Do not reintroduce **`python3 -m venv`** in `startup.sh` on App Service (broken `ensurepip` on some images).
- After any deploy, verify **`/health`** and **`/openapi.json`**; green CI alone is not enough if the wrong process is running.
