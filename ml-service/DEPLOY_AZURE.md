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

### Startup command

```bash
gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT
```

Verify:

- `GET https://<ml-service>.azurewebsites.net/health`
- `GET https://<ml-service>.azurewebsites.net/social-media/analytics`

## 2) Configure .NET backend bridge

Set backend App Service settings:

- `SocialMediaMlApi__BaseUrl=https://<ml-service>.azurewebsites.net`
- `SocialMediaMlApi__AnalyticsPath=/social-media/analytics`
- `SocialMediaMlApi__DonationsAnalyticsPath=/donations/analytics` (optional; this is the default)
- `SocialMediaMlApi__ApiKey=` (optional if you add key auth)

Redeploy backend.

Verify backend endpoint:

- `GET https://<backend>.azurewebsites.net/api/admin/analytics/social-media`
- `GET https://<backend>.azurewebsites.net/api/admin/analytics/donations-ml` (admin session required)

## 3) Frontend validation

Redeploy frontend and login as admin.

Open:

- `/Admin/SocialMedia`

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
