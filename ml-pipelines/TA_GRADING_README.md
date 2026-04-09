# TA grading: ML pipelines vs website deployment

This file is for **instructors and TAs**. It distinguishes notebooks whose outputs and contracts are **wired into the Lighthouse website** (via `ml-service` APIs and the app) from other notebooks the team **used to explore data and relationships** without treating them as production-facing analytics.

**Production site:** [https://intext-w2026.vercel.app/](https://intext-w2026.vercel.app/) (“Light on a Hill Foundation”). Pipeline-backed **admin** pages use the same host with `/Admin/...` paths (see the table).

---

## Notebooks deployed to the website (with paths)

These paths are relative to the repo root unless noted. **Production URL(s)** use the base host `https://intext-w2026.vercel.app`; when two pages use the same pipeline, both are listed.

| Notebook | Path | How it shows up for users | Production URL(s) |
|----------|------|---------------------------|-------------------|
| Social media analytics | `ml-pipelines/social_media_posts_pipeline.ipynb` | Admin **Social Media** and **Reports & analytics** (social-related cards; backend proxies to ML service). | https://intext-w2026.vercel.app/Admin/SocialMedia<br>https://intext-w2026.vercel.app/Admin/Analytics |
| Donations analytics | `ml-pipelines/donations.ipynb` | **Admin dashboard** donation trends chart and **Reports & analytics** (channels, gift types, outreach-oriented views aligned with donations aggregations). | https://intext-w2026.vercel.app/Admin<br>https://intext-w2026.vercel.app/Admin/Analytics |
| Next-month donation forecast | `ml-pipelines/donation_prediction.ipynb` | **Reports & analytics** — next-month estimated donations card; model artifact consumed by `/donations/next-month-forecast`. | https://intext-w2026.vercel.app/Admin/Analytics |
| Residents (tier-1 “Caring”) | `ml-pipelines/residents.ipynb` | **Reports & analytics** — residents in care / risk-oriented summaries from tier-1 payload (`GET /reports/tier1-analytics`). | https://intext-w2026.vercel.app/Admin/Analytics |
| Resident transfer risk | `ml-pipelines/resident_transfer_risk_pipeline.ipynb` | **Admin dashboard** — “Residents to Reach Out” (chart + prioritized list). Live scoring via `GET /residents/transfer-risk-summary` (bundled `resident_transfer_risk_model.joblib`; DB: residents, incident_reports, education_records). Backend: `GET /api/admin/analytics/residents-transfer-risk`. | https://intext-w2026.vercel.app/Admin |
| Education records | `ml-pipelines/education_records.ipynb` | **Reports & analytics** — Teaching / education card (same tier-1 endpoint; artifacts + schema). | https://intext-w2026.vercel.app/Admin/Analytics |
| Health & wellbeing | `ml-pipelines/health_wellbeing_records.ipynb` | **Reports & analytics** — Healing / health & wellbeing card (tier-1). | https://intext-w2026.vercel.app/Admin/Analytics |
| Safehouse monthly metrics | `ml-pipelines/safehouse_monthly_metrics_pipeline.ipynb` | **Reports & analytics** — safehouse performance comparison (safehouse block under tier-1 analytics; pipeline-first data with DB fallback). | https://intext-w2026.vercel.app/Admin/Analytics |
| Public impact snapshots | `ml-pipelines/public_impact_snapshots_pipeline.ipynb` | **Impact** experience and `GET /impact/analytics` (cache / payload aligned with this notebook). | https://intext-w2026.vercel.app/impact |

**Reintegration KPIs** on **Reports & analytics** are built in code from resident fields (e.g. case status / reintegration dates), not from a separate grading notebook—see `ml-service/IntegratedPipelines.txt` §6 and `ml-service/app/tier1_analytics.py`. Verify on https://intext-w2026.vercel.app/Admin/Analytics (admin login below).

---

## How to find what you need for grading (quick)

1. **Start at the top of the notebook.** Integrated course notebooks include an **“Appendix: Rubric mapping”** (or similar) markdown cell that maps checklist items (problem framing → deployment) to **where that narrative lives** in that file. Use it as a table of contents.

2. **Follow the numbered rubric sections in order.** Look for headings such as `## 1. Problem Framing` … `## 6. Deployment Notes`, or `## 1) … ## 6)` in `education_records.ipynb`. **Safehouse** and **social media** interleave those sections with **Chapter \* ** cells—each rubric block sits immediately **above** the related chapter block.

3. **Match narrative to code.** Phases (e.g. “Phase 2: Data…”) or chapter cells should appear **below** the section that explains them; grading evidence is the **markdown plus executed outputs** (metrics, plots, saved artifacts).

4. **Deployment section.** For integration credit, check the notebook’s deployment markdown against **`ml-service/IntegratedPipelines.txt`** and, if needed, `ml-service/app/main.py` (route names, cache paths). Many notebooks reference **`ml-pipelines/artifacts/`** (`.joblib`, `.json`, `.csv`, metrics).

---

## Admin access for grading

Most rows in the table use **admin-only** routes. Sign in at [https://intext-w2026.vercel.app/login](https://intext-w2026.vercel.app/login) with:

- **Email:** `ShanNon@Profit.com`  
- **Password:** `ilikemypassword`

Then open the URLs in the **Production URL(s)** column (or use **Reports & analytics**, **Social Media**, etc. in the nav). The **Impact** row is **public**—no admin login.

Authoritative integration detail also lives in **`ml-service/IntegratedPipelines.txt`**.

---

## How `ml-service` connects to the website

The **`ml-service/`** folder contains the code that **defines and runs the ML analytics HTTP API**: a **FastAPI** app rooted at `ml-service/app/main.py`, with supporting modules such as `app/tier1_analytics.py` and `app/db_access.py`. Notebooks under **`ml-pipelines/`** produce **artifacts** (for example `.joblib` models, JSON caches, and CSVs, often under `ml-pipelines/artifacts/`). **ml-service** reads those artifacts—and, when configured, **PostgreSQL** or **CSV** sources—to assemble JSON responses. The **Lighthouse .NET backend** does not reimplement that logic for grading-critical views; it **proxies** admin requests to ml-service and forwards JSON to the **React** admin UI. The canonical mapping from notebook → endpoint → UI is **`ml-service/IntegratedPipelines.txt`**.

---

## Other `ml-pipelines/*.ipynb` files (exploration; not deployed)

Many additional notebooks live under `ml-pipelines/`—for example `donation_allocations.ipynb`, `lighthouse_analysis.ipynb`, `supporters_pipeline.ipynb`, `safehouses.ipynb`, `incident_reports.ipynb`, `intervention_plans.ipynb`, `partners.ipynb`, `partner_assignments.ipynb`, `in_kind_donation_items.ipynb`, `process_recordings.ipynb`, `home_visitations.ipynb`, plus blank/template notebooks (`blank_notebook.ipynb`, `additional_datasets_blank.ipynb`). **`run_all_pipelines.ipynb`** is helper orchestration, not a website integration surface.

The team used those files to **explore relationships**, joins, and data quality. They were **not** prioritized for the same admin/public product paths as the table above because they were **less central to the user problems** the shipped experience solves (donor-facing analytics, tier-1 program cards, impact storytelling, social, and safehouse oversight). TAs can skim them for context but **need not** hold them to the same deployment bar as integrated pipelines.

---



If something is ambiguous, **`ml-service/IntegratedPipelines.txt`** is the single checklist of which notebook path backs which user-facing capability.
