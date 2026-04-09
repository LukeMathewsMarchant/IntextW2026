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
python -m py_compile app/main.py
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

Verify (public impact):

- `GET .../api/impact`
- Confirm `pipelineInsights` is present when ml-service `GET /impact/analytics` is reachable.

---

## Frontend

Redeploy the frontend when UI changes. As admin, open:

- `/Admin/SocialMedia`
- `/Admin/Analytics` (Reports & analytics — donations ML, tier-1, **Donations notebook EDA** card when the new endpoints are live)

---

## Production smoke checks (after each ML deploy)

```bash
BASE_URL="https://<ml-service>.azurewebsites.net"
curl -fsS "$BASE_URL/health" | jq .
curl -fsS "$BASE_URL/openapi.json" | jq '.info, (.paths | keys)'
curl -fsS "$BASE_URL/donations/analytics" | jq '.dataSource, .summary'
curl -fsS "$BASE_URL/donations/explore-summary" | jq '.endpointVersion, .generatedAtUtc, .dataSource'
curl -fsS "$BASE_URL/donations/next-month-forecast" | jq '.endpointVersion, .predictedMonth, .predictedTotalEstimatedValue, .predictionRange'
curl -fsS "$BASE_URL/reports/tier1-analytics" | jq '.generatedAtUtc, .residents.dataSource'
curl -fsS "$BASE_URL/impact/analytics" | jq '.pipelineName, .generatedAtUtc, .metricHighlights'
```

Expected:

- `/health`: `status: ok`, `buildId` = deployed commit SHA.
- OpenAPI lists routes you care about (`/donations/analytics`, `/donations/explore-summary`, `/donations/next-month-forecast`, `/reports/tier1-analytics`, `/impact/analytics`, etc.).
- Donations endpoints: usually `dataSource: "database"` in production when DB is configured.
- `/impact/analytics` returns pipeline metadata (`pipelineName`, `generatedAtUtc`) and highlights payload for Lighthouse merge.

---

## Team release playbook (routes & quality)

### Before merge

1. Add or change routes in `ml-service/app/main.py` (and dependencies if needed).
2. CI validates: `py_compile`, route greps, `startup.sh` safety checks (see `main_ml-pipelines-container.yml`).
3. Local: `python -m py_compile app/main.py` (and `bash -n startup.sh` if you touch it).

### After merge

1. Confirm **Build and deploy ml-service container** succeeded on `main`.
2. If you added a **backend** proxy route, merge and deploy the **.NET** app too.
3. If you changed **admin UI**, deploy the **frontend**.

### If deploy is green but the site looks wrong

- **Container:** confirm image tag/digest in the portal, **Log stream**, and `/health.buildId`. Do not use Kudu `wwwroot` as proof of running code.
- **503:** empty **Startup Command**, **`WEBSITES_PORT=8000`**, image pull logs — see “Smoke test returns 503” below.

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
