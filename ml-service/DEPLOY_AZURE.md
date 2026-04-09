# Azure Deployment Guide (ML Service + .NET Bridge)

## 1) Deploy Python ML service

From repo root:

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 scripts/build_social_media_cache.py
```

Deploy `ml-service` as a separate Azure App Service (Python).

### Required App Settings

- `SOCIAL_MEDIA_CACHE_PATH=artifacts/social_media_analytics_cache.json`
- `SOCIAL_MEDIA_DATASET_PATH=../datasets/social_media_posts.csv` (optional fallback)
- `DONATIONS_DATASET_PATH=../datasets/donations.csv` (optional; defaults under repo root `datasets/donations.csv` when deployed from this layout)
- `DONATIONS_METRICS_PATH=../ml-pipelines/artifacts/donations_model_metrics.csv` (optional; enriches `/donations/analytics` with pipeline holdout metrics when present)
- Tier-1 program analytics (`GET /reports/tier1-analytics`) prefer the **same PostgreSQL** as social media: set `SOCIAL_MEDIA_DB_URL` or `ConnectionStrings__DefaultConnection` on the ML app so it can read `residents`, `education_records`, and `health_wellbeing_records`. On query failure, it falls back to CSVs. Notebook drivers still load from `ml-pipelines/artifacts/*` relative to repo root. If you deploy only the `ml-service` folder without the full repo, set optional CSV paths, for example:
  - `RESIDENTS_DATASET_PATH=../datasets/residents.csv`
  - `EDUCATION_DATASET_PATH=../datasets/education_records.csv`
  - `HEALTH_WELLBEING_DATASET_PATH=../datasets/health_wellbeing_records.csv`

### Startup command (recommended)

```bash
bash /home/site/wwwroot/startup.sh
```

Verify:

- `GET https://<ml-service>.azurewebsites.net/health`
- `GET https://<ml-service>.azurewebsites.net/social-media/analytics`
- `GET https://<ml-service>.azurewebsites.net/reports/tier1-analytics`
- `GET https://<ml-service>.azurewebsites.net/donations/analytics`

### App settings for stable deploy behavior

- `SCM_DO_BUILD_DURING_DEPLOYMENT=true` (keep this true in current setup)
- `SOCIAL_MEDIA_DB_URL=<your PostgreSQL connection string>` (or `ConnectionStrings__DefaultConnection`)
- optional:
  - `GUNICORN_WORKERS=4`
  - `GUNICORN_TIMEOUT=120`

## 2) Configure .NET backend bridge

Set backend App Service settings:

- `SocialMediaMlApi__BaseUrl=https://<ml-service>.azurewebsites.net`
- `SocialMediaMlApi__AnalyticsPath=/social-media/analytics`
- `SocialMediaMlApi__DonationsAnalyticsPath=/donations/analytics` (optional; this is the default)
- `SocialMediaMlApi__ProgramsTier1AnalyticsPath=/reports/tier1-analytics` (optional; this is the default)
- `SocialMediaMlApi__ApiKey=` (optional if you add key auth)

Redeploy backend.

Verify backend endpoint:

- `GET https://<backend>.azurewebsites.net/api/admin/analytics/social-media`
- `GET https://<backend>.azurewebsites.net/api/admin/analytics/donations-ml` (admin session required)
- `GET https://<backend>.azurewebsites.net/api/admin/analytics/programs-tier1` (admin session required)

## 3) Frontend validation

Redeploy frontend and login as admin.

Open:

- `/Admin/SocialMedia`
- `/Admin/Analytics` (Reports & analytics — tier-1 program cards when ml-service paths resolve)

Expected:

- KPI cards populated
- platform donation chart visible
- recommendations list visible
- best posting windows table visible

## 4) Refreshing precomputed analytics

Any time you refresh the notebook outputs:

```bash
cd ml-service
source .venv/bin/activate
python3 scripts/build_social_media_cache.py
```

Then redeploy/restart ML service so new cache is served.

## 5) Safe production checklist (every release)

1. Merge to `main` (workflow deploys `./ml-service`).
2. Wait for GitHub Action success.
3. In App Service, restart once (optional but recommended after endpoint additions).
4. Run smoke checks:

```bash
curl -sS "https://<ml-service>.azurewebsites.net/health"
curl -sS "https://<ml-service>.azurewebsites.net/openapi.json" | jq '.info, .paths | keys'
curl -sS "https://<ml-service>.azurewebsites.net/reports/tier1-analytics" | jq '.generatedAtUtc, .residents.dataSource'
curl -sS "https://<ml-service>.azurewebsites.net/donations/analytics" | jq '.dataSource, .summary, (.channelMix | length), (.giftTypeMix | length)'
```

Expected:
- `/health` returns `status: ok` and a `buildId`.
- OpenAPI includes both `/reports/tier1-analytics` and `/donations/analytics`.
- Tier1 endpoint responds with JSON payload.
- Donations endpoint returns `dataSource: "database"` in production (or clear warning if fallback used).

## 6) Kudu diagnostics (if anything drifts)

Open Kudu SSH and run:

```bash
cd /home/site/wwwroot
wc -l app/main.py
grep -n "title='Lighthouse ML API'" app/main.py
grep -n "/reports/tier1-analytics\\|/donations/analytics" app/main.py
bash startup.sh
```

If `bash startup.sh` fails, the error text is the source of truth (missing deps, bad env, etc.).

## 7) Team release playbook (required)

Use this checklist every time anyone adds or changes ML API routes.

### A. Before merge

1. Ensure route is added in `ml-service/app/main.py`.
2. Ensure workflow validation still passes:
   - `/.github/workflows/main_ml-pipelines.yml` route grep checks
   - smoke test checks `/openapi.json` and `/health`
3. Run local sanity checks:

```bash
cd ml-service
python3 -m py_compile app/main.py
bash -n startup.sh
```

### B. Deploy

1. Merge to `main`.
2. Run GitHub Actions workflow:
   - **Build and deploy ml-service to Azure Web App - ml-pipelines**
3. Wait for **all jobs to pass**, especially:
   - `Verify startup script does not build venv at runtime`
   - `Smoke test deployed API shape`

### C. Post-deploy verification (must pass)

Run:

```bash
BASE_URL="https://<ml-service>.azurewebsites.net"
curl -fSs "$BASE_URL/health" | jq .
curl -fSs "$BASE_URL/openapi.json" | jq '.info, (.paths | keys)'
```

Expected:
- `/health` returns `status: "ok"` and `buildId`.
- `buildId` matches the workflow commit SHA (`GITHUB_SHA`) from the run you just deployed.
- OpenAPI path list includes all expected routes (including new ones).

### D. Production data verification (admin analytics)

```bash
BASE_URL="https://<ml-service>.azurewebsites.net"
curl -fSs "$BASE_URL/reports/tier1-analytics" | jq '.generatedAtUtc, .residents.dataSource'
curl -fSs "$BASE_URL/donations/analytics" | jq '.dataSource, .loadWarning, .summary, (.channelMix|length), (.giftTypeMix|length)'
```

Expected:
- Tier1 returns valid payload and usually `dataSource: "database"` in production.
- Donations endpoint returns non-empty summary/mix when DB access is healthy.
- If donations returns `missing-file` or CSV warnings, treat as a deployment/config bug, not expected production behavior.

### E. If deploy is green but app is stale or failing

1. Check runtime file on Kudu:

```bash
cd /home/site/wwwroot
wc -l app/main.py
grep -n "title='Lighthouse ML API'" app/main.py
grep -n "/reports/tier1-analytics\|/donations/analytics" app/main.py
head -n 60 startup.sh
```

2. Confirm App Service startup command:

```text
bash /home/site/wwwroot/startup.sh
```

3. Confirm App Setting:

```text
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

4. Restart app, rerun post-deploy verification commands.

### F. Rules of engagement

- Do not change startup command ad hoc in production without documenting it here.
- Do not reintroduce runtime venv creation in `startup.sh` (`python3 -m venv` in App Service startup has caused outages).
- Always verify with `/health` and `/openapi.json` after deploy; never assume green CI means live app is current.

## 8) Option A (recommended): container deploy on same App Service

This is the deterministic path that removes Oryx/runtime drift while keeping the same
`ml-pipelines` hostname.

### What this changes

- App runs a Docker image built from `ml-service/Dockerfile`.
- GitHub Actions builds/pushes image to ACR and updates App Service image tag.
- `/health.buildId` is stamped with `GITHUB_SHA` each deploy.

### One-time Azure setup

1. Create or choose an Azure Container Registry (ACR).
2. Add these GitHub secrets in repo settings:
   - `ACR_LOGIN_SERVER` (for example `myregistry.azurecr.io`)
   - `ACR_USERNAME`
   - `ACR_PASSWORD`
3. Keep existing Azure login secrets already used by workflows.
4. In App Service (`ml-pipelines`) set startup mode to container (no startup command required).
5. Keep existing runtime app settings (`SOCIAL_MEDIA_DB_URL`, etc.).

### Workflow to use

- New workflow: `.github/workflows/main_ml-pipelines-container.yml`
- It will:
  1) validate Python app
  2) build and push image tags (`sha`, `latest`)
  3) configure `ml-pipelines` to use `sha` tag
  4) set `WEBSITES_PORT=8000` and `ML_API_BUILD_ID=$GITHUB_SHA`
  5) restart and smoke test

### Safe migration steps (production)

1. Preferred: create a staging slot on `ml-pipelines`.
2. Run container workflow once and point slot to image.
3. Validate:
   - `/health`
   - `/openapi.json`
   - `/reports/tier1-analytics`
   - `/donations/analytics`
4. Swap slot to production.

### Rollback

If needed, point App Service back to previous known-good image tag:

```bash
az webapp config container set \
  --name ml-pipelines \
  --resource-group ml-pipelines_group \
  --container-image-name <acr-login-server>/ml-service:<previous-sha>
```

Then restart:

```bash
az webapp restart --name ml-pipelines --resource-group ml-pipelines_group
```

### Notes

- During container mode, the old Python code zip/Oryx path is no longer authoritative.
- This is the strongest fix for "workflow passed but stale code served" issues.
