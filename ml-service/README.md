# ML Service (Social Media Analytics)

This service deploys the social media pipeline outputs from `ml-pipelines/social_media_posts_pipeline.ipynb` as an API that can be called by the .NET backend.

## Endpoints

- `GET /health`
- `GET /social-media/summary`
- `GET /social-media/platform-ranking`
- `GET /social-media/recommendations`
- `GET /social-media/analytics` (combined payload used by backend)
- `GET /donations/analytics` (donations CSV + optional notebook metrics; proxied as `api/admin/analytics/donations-ml`)
- `GET /reports/tier1-analytics` (residents, education, health & wellbeing tier-1 summaries; proxied as `api/admin/analytics/programs-tier1`). When `SOCIAL_MEDIA_DB_URL` or `ConnectionStrings__DefaultConnection` is set (same as social media), charts use **live** `residents`, `education_records`, and `health_wellbeing_records` tables; otherwise CSV fallbacks. Top drivers still come from `ml-pipelines/artifacts`. Response is rebuilt on each request.

## Response Contract (`/social-media/analytics`)

```json
{
  "generatedAtUtc": "2026-04-08T00:00:00Z",
  "currency": "PHP",
  "summary": {
    "totalPosts": 812,
    "totalDonationReferrals": 10388,
    "totalEstimatedDonationValuePhp": 1234567.89,
    "avgEngagementRate": 0.1234
  },
  "platformRanking": [
    {
      "platform": "Instagram",
      "posts": 240,
      "donationReferrals": 2220,
      "estimatedDonationValuePhp": 530000.0,
      "avgEngagementRate": 0.18,
      "shareOfDonationValue": 0.43
    }
  ],
  "recommendations": [
    {
      "platform": "Instagram",
      "priority": "High",
      "reason": "Highest donation value and strong engagement.",
      "recommendedAction": "Increase post frequency by 20% and prioritize donation CTAs.",
      "suggestedPostHours": ["11", "15", "18"],
      "estimatedMonthlyLiftPhp": 95000.0
    }
  ],
  "bestPostingWindows": [
    {
      "platform": "Instagram",
      "dayOfWeek": "Friday",
      "postHour": 11,
      "avgDonationValuePhp": 24000.0,
      "avgReferrals": 8.2
    }
  ]
}
```

## Run locally

```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Build cache artifact

```bash
cd ml-service
python3 scripts/build_social_media_cache.py
```

This creates/updates `ml-service/artifacts/social_media_analytics_cache.json`.

## Azure deployment notes

- Deploy this folder as a separate Azure Web App (Python runtime).
- Set optional app settings:
  - `SOCIAL_MEDIA_CACHE_PATH` (defaults to `artifacts/social_media_analytics_cache.json`)
  - `SOCIAL_MEDIA_DATASET_PATH` (fallback defaults to `../datasets/social_media_posts.csv`)\n  - `SOCIAL_MEDIA_DB_URL` (optional; if set, service reads live data from `social_media_posts`)
- App startup command:
  - `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT`
