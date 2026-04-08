# Light on a Hill Foundation — Database Setup Guide

## Overview

This document explains the full PostgreSQL schema for the Light on a Hill Foundation website. It covers every design decision, table, relationship, and deployment instruction. Use this as your reference when continuing development in Cursor, VS Code, or any other environment.

The database is hosted in **Supabase** and uses plain PostgreSQL. There are two files:

| File | Purpose |
|---|---|
| `schema.sql` | Creates all types, tables, indexes, triggers, and sequence resets |
| `seed_data.sql` | Populates all tables with the full dataset from the provided CSVs |

**Always run `schema.sql` first, then `seed_data.sql`.**

---

## How to Deploy in Supabase

1. Open your Supabase project → **SQL Editor**
2. Paste and run `schema.sql` in full
3. Paste and run `seed_data.sql` in full
4. The sequence reset statements at the bottom of `schema.sql` run automatically as part of the schema file — they ensure auto-increment IDs start after the seeded data so future inserts don't collide

---

## Design Decisions

### Authentication: Custom `users` table (no Supabase Auth)

By design choice (for the security coursework), authentication is handled manually via a `users` table rather than Supabase's built-in `auth.users`. Key implications:

- Passwords **must be stored as bcrypt hashes** — never store plaintext. Use `bcryptjs` (Node) or `bcrypt` (Python) to hash on the server before inserting
- The `role` column (`admin`, `staff`, `viewer`) is the access control mechanism — your API/middleware must check this on every authenticated request
- `viewer` role: read-only access to non-sensitive data
- `staff` role: can create/update case records, process recordings, visitations
- `admin` role: full access including donor management and user administration

If you later want to migrate to Supabase Auth, add a `auth_user_id UUID REFERENCES auth.users(id)` column to the `users` table and keep the `role` column — Supabase Auth handles login but your `role` column still drives authorization.

### Social Workers: Text codes, not user accounts

Social workers are stored as text identifiers (`SW-01`, `SW-15`, etc.) across `residents`, `process_recordings`, and `home_visitations`. This matches the source data and keeps things simple. If you later want full social worker profiles, create a `social_workers` table and add a foreign key.

### Enums for all domain values

Every column with a fixed set of valid values uses a PostgreSQL `ENUM` type rather than a plain `VARCHAR`. Benefits: the database rejects invalid values at the column level, the schema is self-documenting, and UI dropdowns can be driven directly from the enum definition. Downside: adding a new valid value requires an `ALTER TYPE` migration. All enum values were derived from inspecting the full unique value sets in the CSVs.

### Social media posts: excluded from this database

The `social_media_posts.csv` is excluded. It is an engagement analytics table (800+ rows of Instagram/Facebook/LinkedIn/WhatsApp metrics) and has no foreign key relationship to operational data. The `referral_post_id` column in `donations` is kept as a plain `INTEGER` (no FK constraint) as a soft reference for the analytics pipeline to join on if needed.

### Public impact dashboard: live queries, no snapshot dependency

Rather than seeding a `public_impact_snapshots` table and reading from it, the public dashboard should query the live underlying tables (donations, residents, health_wellbeing_records, education_records) and aggregate on the fly. The `public_impact_snapshots` table **is still seeded** as a historical record and as a fallback/cache, but it should not be the primary data source for the live dashboard.

### Comma-separated multi-value fields

Two columns store multiple values as comma-separated text rather than a junction table:

- `process_recordings.interventions_applied` — e.g., `"Caring, Healing, Teaching"`
- `intervention_plans.services_provided` — same value set

This matches the source data structure and is acceptable for this application's query patterns (filtering is not done on individual intervention types). If you need to filter by intervention type, split on commas in application code or use PostgreSQL's `string_to_array` + `ANY` operator.

### Age/length-of-stay as text snapshots

`residents.age_upon_admission`, `present_age`, and `length_of_stay` are stored as `VARCHAR` strings (e.g., `"15 Years 9 months"`). These are point-in-time snapshots from the case intake process, not computed values. If you need live-computed age, derive it from `date_of_birth` in your query: `EXTRACT(YEAR FROM AGE(NOW(), date_of_birth))`.

### JSONB for impact snapshot payloads

`public_impact_snapshots.metric_payload_json` uses `JSONB` instead of separate columns because the payload structure may vary over time and the public dashboard will render it as-is. Example payload:
```json
{
  "month": "2023-01",
  "avg_health_score": 3.03,
  "avg_education_progress": 33.9,
  "total_residents": 60,
  "donations_total_for_month": 1379.92
}
```

### `notes_restricted` flag

Both `residents` and `process_recordings` have a `notes_restricted BOOLEAN` column. This is a content sensitivity flag — when `TRUE`, the record's narrative/notes fields should be hidden from users with the `viewer` role. Your API layer must enforce this; the database does not enforce it automatically (it would require row-level security policies).

---

## Table Reference

### `users`
Custom staff/admin authentication. No dependency on Supabase Auth.

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID PK | auto-generated via `gen_random_uuid()` |
| `username` | VARCHAR(50) UNIQUE | login identifier |
| `email` | VARCHAR(255) UNIQUE | |
| `password_hash` | TEXT | bcrypt hash only |
| `role` | user_role | `admin`, `staff`, or `viewer` |
| `is_active` | BOOLEAN | soft-disable accounts without deleting |
| `last_login` | TIMESTAMPTZ | update on each successful login |

---

### `safehouses`
9 physical shelter locations across Luzon, Visayas, and Mindanao.

| Column | Type | Notes |
|---|---|---|
| `safehouse_id` | SERIAL PK | |
| `safehouse_code` | VARCHAR(10) UNIQUE | e.g., `SH01` |
| `region` | ph_region | `Luzon`, `Visayas`, `Mindanao` |
| `capacity_girls` | INTEGER | max resident capacity |
| `current_occupancy` | INTEGER | updated as residents are admitted/closed |

---

### `supporters`
60 supporters of all contribution types.

| Column | Type | Notes |
|---|---|---|
| `supporter_type` | supporter_type | MonetaryDonor, InKindDonor, Volunteer, SkillsContributor, SocialMediaAdvocate, PartnerOrganization |
| `organization_name` | VARCHAR | NULL for individuals |
| `first_name` / `last_name` | VARCHAR | NULL for organizations |
| `display_name` | VARCHAR | always populated; use for display |
| `acquisition_channel` | acquisition_channel | how they found the org |

---

### `donations`
420 donation records across all types.

| Column | Type | Notes |
|---|---|---|
| `donation_type` | donation_type | Monetary, InKind, Time, Skills, SocialMedia |
| `amount` | NUMERIC(12,2) | NULL for non-monetary types |
| `estimated_value` | NUMERIC(12,2) | PHP equivalent for all types |
| `currency_code` | CHAR(3) | always `PHP` in current data |
| `referral_post_id` | INTEGER | soft reference to analytics DB; no FK constraint |

---

### `donation_allocations`
521 allocation records. Each donation can be split across multiple safehouses and program areas.

| Column | Type | Notes |
|---|---|---|
| `program_area` | program_area | Education, Wellbeing, Operations, Transport, Maintenance, Outreach |
| `amount_allocated` | NUMERIC(12,2) | must be > 0 |

---

### `in_kind_donation_items`
129 line items for InKind donations.

| Column | Type | Notes |
|---|---|---|
| `item_category` | item_category | Food, Clothing, Furniture, Hygiene, Medical, SchoolMaterials, Supplies |
| `received_condition` | received_condition | New, Good, Fair |
| `intended_use` | intended_use | Education, Health, Hygiene, Meals, Shelter |

---

### `partners` / `partner_assignments`
30 partners (organizations and individuals) with 48 safehouse assignments. Partners have operational roles (logistics, education, safehouse operations, etc.) distinct from supporters who make contributions.

---

### `residents`
60 resident records. This is the most complex table, following Philippine DSWD case management format.

Key field groups:
- **Demographics**: `sex`, `date_of_birth`, `birth_status`, `religion`, `place_of_birth`
- **Case classification**: `case_category` (primary) + 10 `sub_cat_*` boolean flags for detailed classification
- **Disability**: `is_pwd`, `pwd_type`, `has_special_needs`, `special_needs_diagnosis`
- **Family profile**: 5 `family_*` boolean flags (4Ps beneficiary, solo parent, indigenous, etc.)
- **Admission**: `date_of_admission`, snapshot age/stay strings, referral details
- **Case management**: assigned social worker, risk levels, reintegration tracking
- **Privacy**: `notes_restricted` flag for sensitive records

---

### `education_records`
534 monthly education snapshots. Multiple records per resident (one per month tracked).

- `attendance_rate` is stored as a decimal (0.0–1.0), e.g., `0.966` = 96.6%
- `progress_percent` is 0–100

---

### `health_wellbeing_records`
534 monthly health snapshots. Multiple records per resident.

- Health scores (`general_health_score`, `nutrition_score`, etc.) are on a 1–5 scale
- `bmi` is stored as a pre-calculated value matching the source data

---

### `intervention_plans`
180 formal intervention plan records from case conferences. One resident typically has multiple plans across different categories (Safety, Education, Physical Health).

---

### `home_visitations`
1,337 field visit records. Covers the full visit lifecycle from initial assessment through post-placement monitoring.

---

### `process_recordings`
2,819 counseling session notes. This is the largest table and the primary healing journey log. Queried chronologically per resident for the Process Recording page.

---

### `incident_reports`
100 incident records linked to both a resident and a safehouse.

---

### `safehouse_monthly_metrics`
450 pre-aggregated monthly rollups (one per safehouse per month). Use these for fast dashboard charts instead of re-aggregating raw tables every page load.

---

### `public_impact_snapshots`
50 monthly public-facing impact summaries. Seeded for historical reference. The live public dashboard should compute fresh aggregates from underlying tables, but can fall back to these for historical months.

---

## Useful Queries

### Admin Dashboard — active residents per safehouse
```sql
SELECT s.name, s.current_occupancy, s.capacity_girls,
       COUNT(r.resident_id) AS active_case_count
FROM safehouses s
LEFT JOIN residents r ON r.safehouse_id = s.safehouse_id AND r.case_status = 'Active'
GROUP BY s.safehouse_id
ORDER BY s.safehouse_id;
```

### Donation totals by month (for trend chart)
```sql
SELECT DATE_TRUNC('month', donation_date) AS month,
       SUM(estimated_value) AS total_php,
       COUNT(*) AS donation_count
FROM donations
GROUP BY 1
ORDER BY 1;
```

### Donation allocations by program area
```sql
SELECT program_area,
       SUM(amount_allocated) AS total_allocated
FROM donation_allocations
GROUP BY program_area
ORDER BY total_allocated DESC;
```

### Public impact dashboard — latest aggregated metrics
```sql
SELECT
    COUNT(DISTINCT r.resident_id) FILTER (WHERE r.case_status = 'Active') AS active_residents,
    AVG(h.general_health_score) AS avg_health_score,
    AVG(e.progress_percent) AS avg_education_progress,
    SUM(d.estimated_value) AS total_donations_php
FROM residents r
LEFT JOIN health_wellbeing_records h ON h.resident_id = r.resident_id
    AND h.record_date = (SELECT MAX(record_date) FROM health_wellbeing_records WHERE resident_id = r.resident_id)
LEFT JOIN education_records e ON e.resident_id = r.resident_id
    AND e.record_date = (SELECT MAX(record_date) FROM education_records WHERE resident_id = r.resident_id)
CROSS JOIN (SELECT SUM(estimated_value) FROM donations) d(estimated_value);
```

### Caseload inventory — search/filter residents
```sql
SELECT r.resident_id, r.internal_code, r.case_control_no,
       r.case_status, r.case_category, r.current_risk_level,
       r.assigned_social_worker, r.reintegration_status,
       s.name AS safehouse_name
FROM residents r
JOIN safehouses s ON s.safehouse_id = r.safehouse_id
WHERE r.case_status = 'Active'          -- swap for filter
  AND r.safehouse_id = 1                -- swap for filter
ORDER BY r.date_of_admission DESC;
```

### Process recordings for a resident (chronological)
```sql
SELECT recording_id, session_date, social_worker, session_type,
       emotional_state_observed, emotional_state_end,
       session_narrative, interventions_applied, follow_up_actions,
       progress_noted, concerns_flagged
FROM process_recordings
WHERE resident_id = $1
  AND (notes_restricted = FALSE OR $user_role IN ('admin', 'staff'))
ORDER BY session_date ASC;
```

### Reintegration success rate (for Reports page)
```sql
SELECT reintegration_type,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE reintegration_status = 'Completed') AS completed,
       ROUND(100.0 * COUNT(*) FILTER (WHERE reintegration_status = 'Completed') / COUNT(*), 1) AS success_rate_pct
FROM residents
WHERE reintegration_type IS NOT NULL
GROUP BY reintegration_type
ORDER BY success_rate_pct DESC;
```

---

## CSV Files and Their Database Mapping

| CSV File | Included | Table | Notes |
|---|---|---|---|
| `safehouses.csv` | ✅ | `safehouses` | All 9 rows |
| `supporters.csv` | ✅ | `supporters` | All 60 rows |
| `donations.csv` | ✅ | `donations` | All 420 rows |
| `donation_allocations.csv` | ✅ | `donation_allocations` | All 521 rows |
| `in_kind_donation_items.csv` | ✅ | `in_kind_donation_items` | All 129 rows |
| `residents.csv` | ✅ | `residents` | All 60 rows |
| `education_records.csv` | ✅ | `education_records` | All 534 rows |
| `health_wellbeing_records.csv` | ✅ | `health_wellbeing_records` | All 534 rows |
| `intervention_plans.csv` | ✅ | `intervention_plans` | All 180 rows |
| `home_visitations.csv` | ✅ | `home_visitations` | All 1,337 rows |
| `process_recordings.csv` | ✅ | `process_recordings` | All 2,819 rows |
| `incident_reports.csv` | ✅ | `incident_reports` | All 100 rows |
| `safehouse_monthly_metrics.csv` | ✅ | `safehouse_monthly_metrics` | All 450 rows |
| `public_impact_snapshots.csv` | ✅ | `public_impact_snapshots` | All 50 rows |
| `partners.csv` | ✅ | `partners` | All 30 rows |
| `partner_assignments.csv` | ✅ | `partner_assignments` | All 48 rows |
| `social_media_posts.csv` | ❌ | — | Analytics pipeline only; ML API will handle |

---

## Tables Not Backed by CSV Data

| Table | Seeded? | Notes |
|---|---|---|
| `users` | ❌ | No CSV provided. Create admin accounts manually after deployment |

To create the first admin user (example using SQL — hash the password in your app first):
```sql
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES ('admin', 'admin@lightonahillfoundation.ph', '<bcrypt_hash_here>', 'System Admin', 'admin');
```

---

## Entity Relationship Summary

```
users                          (standalone — no FK to other tables)

safehouses
  ├── residents (safehouse_id)
  │     ├── education_records
  │     ├── health_wellbeing_records
  │     ├── intervention_plans
  │     ├── home_visitations
  │     ├── process_recordings
  │     └── incident_reports (also → safehouses)
  ├── donation_allocations (also → donations)
  ├── safehouse_monthly_metrics
  └── partner_assignments (also → partners)

supporters
  └── donations
        ├── donation_allocations
        └── in_kind_donation_items

public_impact_snapshots        (standalone — no FK; populated by analytics pipeline)
```
