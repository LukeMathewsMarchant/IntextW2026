# TA grading: ML pipelines vs website deployment

This file is for **instructors and TAs**. It distinguishes notebooks whose outputs and contracts are **wired into the Lighthouse website** (via `ml-service` APIs and the admin app) from other notebooks the team **used to explore data and relationships** without treating them as production-facing analytics.

Authoritative integration detail also lives in **`ml-service/IntegratedPipelines.txt`** 

---

## Notebooks deployed to the website (with paths)

These paths are relative to the repo root unless noted.

| Notebook | Path | How it shows up for users |
|----------|------|---------------------------|
| Social media analytics | `ml-pipelines/social_media_posts_pipeline.ipynb` | Admin **Social Media** and **Reports & analytics** (social-related cards; backend proxies to ML service). |
| Donations analytics | `ml-pipelines/donations.ipynb` | **Reports & analytics** — donation trends, channels, gift types, outreach-oriented views aligned with donations aggregations. |
| Next-month donation forecast | `ml-pipelines/donation_prediction.ipynb` | **Reports & analytics** — next-month estimated donations card; model artifact consumed by `/donations/next-month-forecast`. |
| Residents (tier-1 “Caring”) | `ml-pipelines/residents.ipynb` | **Reports & analytics** — residents in care / risk-oriented summaries from tier-1 payload (`GET /reports/tier1-analytics`). |
| Education records | `ml-pipelines/education_records.ipynb` | **Reports & analytics** — Teaching / education card (same tier-1 endpoint; artifacts + schema). |
| Health & wellbeing | `ml-pipelines/health_wellbeing_records.ipynb` | **Reports & analytics** — Healing / health & wellbeing card (tier-1). |
| Safehouse monthly metrics | `ml-pipelines/safehouse_monthly_metrics_pipeline.ipynb` | **Reports & analytics** — safehouse performance comparison (safehouse block under tier-1 analytics; pipeline-first data with DB fallback). |
| Public impact snapshots | `ml-pipelines/public_impact_snapshots_pipeline.ipynb` | **Impact** experience and `GET /impact/analytics` (cache / payload aligned with this notebook). |

**Reintegration KPIs** on **Reports & analytics** are built in code from resident fields (e.g. case status / reintegration dates), not from a separate grading notebook—see `ml-service/IntegratedPipelines.txt` §6 and `ml-service/app/tier1_analytics.py`.

---

## Other `ml-pipelines/*.ipynb` files (exploration; not deployed)

Many additional notebooks live under `ml-pipelines/`—for example `donation_allocations.ipynb`, `lighthouse_analysis.ipynb`, `supporters_pipeline.ipynb`, `safehouses.ipynb`, `incident_reports.ipynb`, `intervention_plans.ipynb`, `partners.ipynb`, `partner_assignments.ipynb`, `in_kind_donation_items.ipynb`, `process_recordings.ipynb`, `home_visitations.ipynb`, plus blank/template notebooks (`blank_notebook.ipynb`, `additional_datasets_blank.ipynb`). **`run_all_pipelines.ipynb`** is helper orchestration, not a website integration surface.

The team used those files to **explore relationships**, joins, and data quality. They were **not** prioritized for the same admin/public product paths as the table above because they were **less central to the user problems** the shipped experience solves (donor-facing analytics, tier-1 program cards, impact storytelling, social, and safehouse oversight). TAs can skim them for context but **need not** hold them to the same deployment bar as integrated pipelines.

---

## How to find what you need for grading (quick)

1. **Start at the top of the notebook.** Integrated course notebooks include an **“Appendix: Rubric mapping”** (or similar) markdown cell that maps checklist items (problem framing → deployment) to **where that narrative lives** in that file. Use it as a table of contents.

2. **Follow the numbered rubric sections in order.** Look for headings such as `## 1. Problem Framing` … `## 6. Deployment Notes`, or `## 1) … ## 6)` in `education_records.ipynb`. **Safehouse** and **social media** interleave those sections with **Chapter \* ** cells—each rubric block sits immediately **above** the related chapter block.

3. **Match narrative to code.** Phases (e.g. “Phase 2: Data…”) or chapter cells should appear **below** the section that explains them; grading evidence is the **markdown plus executed outputs** (metrics, plots, saved artifacts).

4. **Deployment section.** For integration credit, check the notebook’s deployment markdown against **`ml-service/IntegratedPipelines.txt`** and, if needed, `ml-service/app/main.py` (route names, cache paths). Many notebooks reference **`ml-pipelines/artifacts/`** (`.joblib`, `.json`, `.csv`, metrics).

5. **Reproducibility.** Students should state running from **`ml-pipelines/`** as the working directory where the notebook says so; **Restart & Run All** should match committed outputs for full credit when execution is required.

If something is ambiguous, **`ml-service/IntegratedPipelines.txt`** is the single checklist of which notebook path backs which user-facing capability.
