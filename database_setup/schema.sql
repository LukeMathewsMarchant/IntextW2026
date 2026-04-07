-- ============================================================
-- LIGHT ON A HILL FOUNDATION DATABASE SCHEMA
-- PostgreSQL / Supabase
-- ============================================================
-- Run this file first, then run seed_data.sql
-- ============================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()


-- ================================================================
-- SECTION 1: ENUMS
-- All domain values are encoded as PostgreSQL enums so the
-- database enforces valid values at the column level.
-- ================================================================

-- Users / auth
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'viewer');

-- Supporters / donors
CREATE TYPE supporter_type    AS ENUM ('MonetaryDonor','InKindDonor','Volunteer','SkillsContributor','SocialMediaAdvocate','PartnerOrganization');
CREATE TYPE relationship_type AS ENUM ('Local','International','PartnerOrganization');
CREATE TYPE supporter_status  AS ENUM ('Active','Inactive');
CREATE TYPE acquisition_channel AS ENUM ('SocialMedia','Website','Event','Church','WordOfMouth','PartnerReferral');

-- Donations
CREATE TYPE donation_type   AS ENUM ('Monetary','InKind','Time','Skills','SocialMedia');
CREATE TYPE channel_source  AS ENUM ('Direct','Campaign','Event','SocialMedia','PartnerReferral');
CREATE TYPE impact_unit     AS ENUM ('pesos','hours','items','campaigns');
CREATE TYPE program_area    AS ENUM ('Education','Wellbeing','Operations','Transport','Maintenance','Outreach');

-- In-kind items
CREATE TYPE item_category      AS ENUM ('Food','Clothing','Furniture','Hygiene','Medical','SchoolMaterials','Supplies');
CREATE TYPE intended_use       AS ENUM ('Education','Health','Hygiene','Meals','Shelter');
CREATE TYPE received_condition AS ENUM ('New','Good','Fair');

-- Safehouses
CREATE TYPE ph_region       AS ENUM ('Luzon','Visayas','Mindanao');
CREATE TYPE safehouse_status AS ENUM ('Active','Inactive','Closed');

-- Residents / case management
CREATE TYPE case_status         AS ENUM ('Active','Closed','Transferred');
CREATE TYPE birth_status        AS ENUM ('Marital','Non-Marital');
CREATE TYPE case_category       AS ENUM ('Neglected','Abandoned','Surrendered','Foundling');
CREATE TYPE referral_source     AS ENUM ('NGO','Government Agency','Court Order','Police','Community','Self-Referral');
CREATE TYPE initial_assessment  AS ENUM ('For Reunification','For Continued Care','For Foster Care','For Adoption','For Independent Living');
CREATE TYPE reintegration_type  AS ENUM ('Family Reunification','Foster Care','Adoption (Domestic)','Adoption (Inter-Country)','Independent Living');
CREATE TYPE reintegration_status AS ENUM ('Not Started','In Progress','Completed','On Hold');
CREATE TYPE risk_level           AS ENUM ('Low','Medium','High','Critical');

-- Process recordings
CREATE TYPE session_type    AS ENUM ('Individual','Group');
CREATE TYPE emotional_state AS ENUM ('Angry','Anxious','Calm','Distressed','Happy','Hopeful','Sad','Withdrawn');
CREATE TYPE follow_up_action AS ENUM ('Referral to specialist','Schedule follow-up session','Monitor progress','Continue current approach','Coordinate with family');

-- Home visitations
CREATE TYPE visit_type         AS ENUM ('Initial Assessment','Routine Follow-Up','Reintegration Assessment','Post-Placement Monitoring','Emergency');
CREATE TYPE cooperation_level  AS ENUM ('Highly Cooperative','Cooperative','Neutral','Uncooperative');
CREATE TYPE visit_outcome      AS ENUM ('Favorable','Inconclusive','Needs Improvement','Unfavorable');

-- Intervention plans
CREATE TYPE plan_category   AS ENUM ('Safety','Education','Physical Health');
CREATE TYPE plan_status     AS ENUM ('Open','In Progress','On Hold','Achieved','Closed');

-- Incident reports
CREATE TYPE incident_type   AS ENUM ('Medical','Security','Behavioral','ConflictWithPeer','RunawayAttempt','SelfHarm','PropertyDamage');
CREATE TYPE severity_level  AS ENUM ('Low','Medium','High');

-- Education records
CREATE TYPE education_level    AS ENUM ('Primary','Secondary','CollegePrep','Vocational');
CREATE TYPE enrollment_status  AS ENUM ('Enrolled','Unenrolled','Graduated');
CREATE TYPE completion_status  AS ENUM ('NotStarted','InProgress','Completed');

-- Partners
CREATE TYPE partner_type       AS ENUM ('Organization','Individual');
CREATE TYPE partner_role_type  AS ENUM ('SafehouseOps','Education','Evaluation','FindSafehouse','Logistics','Maintenance','Transport');
CREATE TYPE partner_status     AS ENUM ('Active','Inactive');
CREATE TYPE assignment_status  AS ENUM ('Active','Ended');


-- ================================================================
-- SECTION 2: CORE TABLES
-- ================================================================

-- ----------------------------------------------------------------
-- users
-- Custom authentication table (no Supabase Auth).
-- Passwords must be stored as bcrypt hashes — never plaintext.
-- ----------------------------------------------------------------
CREATE TABLE users (
    user_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)   NOT NULL UNIQUE,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash TEXT          NOT NULL,           -- bcrypt hash
    full_name     VARCHAR(100),
    role          user_role     NOT NULL DEFAULT 'staff',
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- safehouses
-- Physical shelter locations. All case records link back here.
-- ----------------------------------------------------------------
CREATE TABLE safehouses (
    safehouse_id      SERIAL        PRIMARY KEY,
    safehouse_code    VARCHAR(10)   NOT NULL UNIQUE,
    name              VARCHAR(100)  NOT NULL,
    region            ph_region     NOT NULL,
    city              VARCHAR(100)  NOT NULL,
    province          VARCHAR(100)  NOT NULL,
    country           VARCHAR(50)   NOT NULL DEFAULT 'Philippines',
    open_date         DATE          NOT NULL,
    status            safehouse_status NOT NULL DEFAULT 'Active',
    capacity_girls    INTEGER       NOT NULL CHECK (capacity_girls > 0),
    capacity_staff    INTEGER       NOT NULL CHECK (capacity_staff > 0),
    current_occupancy INTEGER       NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
    notes             TEXT
);

-- ----------------------------------------------------------------
-- supporters
-- Anyone who contributes to the organization in any form.
-- Individual donors have first_name/last_name; organizations use
-- organization_name. The display_name column holds the display
-- value for both cases.
-- ----------------------------------------------------------------
CREATE TABLE supporters (
    supporter_id        SERIAL           PRIMARY KEY,
    supporter_type      supporter_type   NOT NULL,
    display_name        VARCHAR(150)     NOT NULL,
    organization_name   VARCHAR(150),
    first_name          VARCHAR(75),
    last_name           VARCHAR(75),
    relationship_type   relationship_type NOT NULL,
    region              ph_region,
    country             VARCHAR(50)      NOT NULL DEFAULT 'Philippines',
    email               VARCHAR(255)     UNIQUE,
    phone               VARCHAR(30),
    status              supporter_status NOT NULL DEFAULT 'Active',
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    first_donation_date DATE,
    acquisition_channel acquisition_channel
);

-- ----------------------------------------------------------------
-- donations
-- One row per donation event regardless of type.
-- Monetary donations use `amount` + `currency_code`.
-- Non-monetary donations leave `amount` NULL and use
-- `estimated_value` for a PHP equivalent.
-- referral_post_id is a soft reference to social media posts
-- (that table lives outside this DB in the analytics pipeline).
-- ----------------------------------------------------------------
CREATE TABLE donations (
    donation_id      SERIAL          PRIMARY KEY,
    supporter_id     INTEGER         NOT NULL REFERENCES supporters(supporter_id),
    donation_type    donation_type   NOT NULL,
    donation_date    DATE            NOT NULL,
    is_recurring     BOOLEAN         NOT NULL DEFAULT FALSE,
    campaign_name    VARCHAR(150),
    channel_source   channel_source,
    currency_code    CHAR(3)         DEFAULT 'PHP',
    amount           NUMERIC(12,2),                  -- NULL for non-monetary
    estimated_value  NUMERIC(12,2),                  -- PHP equivalent for all types
    impact_unit      impact_unit,
    notes            TEXT,
    referral_post_id INTEGER,                        -- soft ref; social_media_posts lives in analytics DB
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- donation_allocations
-- Tracks how each donation is distributed across safehouses
-- and program areas. One donation can split across many rows.
-- ----------------------------------------------------------------
CREATE TABLE donation_allocations (
    allocation_id    SERIAL        PRIMARY KEY,
    donation_id      INTEGER       NOT NULL REFERENCES donations(donation_id),
    safehouse_id     INTEGER       NOT NULL REFERENCES safehouses(safehouse_id),
    program_area     program_area  NOT NULL,
    amount_allocated NUMERIC(12,2) NOT NULL CHECK (amount_allocated > 0),
    allocation_date  DATE          NOT NULL,
    allocation_notes TEXT
);

-- ----------------------------------------------------------------
-- in_kind_donation_items
-- Line items for donations of type 'InKind'.
-- One donation can have multiple item rows.
-- ----------------------------------------------------------------
CREATE TABLE in_kind_donation_items (
    item_id               SERIAL             PRIMARY KEY,
    donation_id           INTEGER            NOT NULL REFERENCES donations(donation_id),
    item_name             VARCHAR(150)       NOT NULL,
    item_category         item_category      NOT NULL,
    quantity              INTEGER            NOT NULL CHECK (quantity > 0),
    unit_of_measure       VARCHAR(30),
    estimated_unit_value  NUMERIC(12,2),
    intended_use          intended_use,
    received_condition    received_condition
);

-- ----------------------------------------------------------------
-- partners
-- External organizations or individuals in formal partnerships.
-- Separate from supporters — partners have operational roles
-- at safehouses (e.g., logistics, education providers).
-- ----------------------------------------------------------------
CREATE TABLE partners (
    partner_id    SERIAL            PRIMARY KEY,
    partner_name  VARCHAR(150)      NOT NULL,
    partner_type  partner_type      NOT NULL,
    role_type     partner_role_type NOT NULL,
    contact_name  VARCHAR(100),
    email         VARCHAR(255),
    phone         VARCHAR(30),
    region        ph_region,
    status        partner_status    NOT NULL DEFAULT 'Active',
    start_date    DATE,
    end_date      DATE,
    notes         TEXT
);

-- ----------------------------------------------------------------
-- partner_assignments
-- Maps partners to specific safehouses and program areas.
-- A partner can be assigned to multiple safehouses.
-- ----------------------------------------------------------------
CREATE TABLE partner_assignments (
    assignment_id        SERIAL            PRIMARY KEY,
    partner_id           INTEGER           NOT NULL REFERENCES partners(partner_id),
    safehouse_id         INTEGER           REFERENCES safehouses(safehouse_id),
    program_area         program_area      NOT NULL,
    assignment_start     DATE              NOT NULL,
    assignment_end       DATE,
    responsibility_notes TEXT,
    is_primary           BOOLEAN           NOT NULL DEFAULT FALSE,
    status               assignment_status NOT NULL DEFAULT 'Active'
);

-- ----------------------------------------------------------------
-- residents
-- Core case management record following Philippine DSWD format.
-- Boolean sub_cat_* columns capture multi-select case categories.
-- Age/length-of-stay are stored as TEXT strings matching the
-- source data (e.g. "15 Years 9 months") because they are
-- computed snapshots, not live-computed values.
-- ----------------------------------------------------------------
CREATE TABLE residents (
    resident_id               SERIAL              PRIMARY KEY,
    case_control_no           VARCHAR(20)         NOT NULL UNIQUE,
    internal_code             VARCHAR(20)         NOT NULL UNIQUE,
    safehouse_id              INTEGER             NOT NULL REFERENCES safehouses(safehouse_id),
    case_status               case_status         NOT NULL DEFAULT 'Active',

    -- Demographics
    sex                       CHAR(1)             NOT NULL DEFAULT 'F',
    date_of_birth             DATE                NOT NULL,
    birth_status              birth_status,
    place_of_birth            VARCHAR(100),
    religion                  VARCHAR(50),

    -- Case classification
    case_category             case_category       NOT NULL,
    sub_cat_orphaned          BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_trafficked        BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_child_labor       BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_physical_abuse    BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_sexual_abuse      BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_osaec             BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_cicl              BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_at_risk           BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_street_child      BOOLEAN             NOT NULL DEFAULT FALSE,
    sub_cat_child_with_hiv    BOOLEAN             NOT NULL DEFAULT FALSE,

    -- Disability / special needs
    is_pwd                    BOOLEAN             NOT NULL DEFAULT FALSE,
    pwd_type                  VARCHAR(100),
    has_special_needs         BOOLEAN             NOT NULL DEFAULT FALSE,
    special_needs_diagnosis   VARCHAR(200),

    -- Family socio-demographic profile (DSWD fields)
    family_is_4ps             BOOLEAN             NOT NULL DEFAULT FALSE,
    family_solo_parent        BOOLEAN             NOT NULL DEFAULT FALSE,
    family_indigenous         BOOLEAN             NOT NULL DEFAULT FALSE,
    family_parent_pwd         BOOLEAN             NOT NULL DEFAULT FALSE,
    family_informal_settler   BOOLEAN             NOT NULL DEFAULT FALSE,

    -- Admission details
    date_of_admission         DATE                NOT NULL,
    age_upon_admission        VARCHAR(30),        -- snapshot string, e.g. "15 Years 9 months"
    present_age               VARCHAR(30),        -- snapshot string
    length_of_stay            VARCHAR(30),        -- snapshot string

    -- Referral
    referral_source           referral_source,
    referring_agency_person   VARCHAR(100),
    date_colb_registered      DATE,               -- Certificate of Live Birth
    date_colb_obtained        DATE,

    -- Case management
    assigned_social_worker    VARCHAR(20),        -- e.g. SW-01
    initial_case_assessment   initial_assessment,
    date_case_study_prepared  DATE,
    reintegration_type        reintegration_type,
    reintegration_status      reintegration_status NOT NULL DEFAULT 'Not Started',
    initial_risk_level        risk_level,
    current_risk_level        risk_level,
    date_enrolled             DATE,
    date_closed               DATE,
    created_at                TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    notes_restricted          BOOLEAN             NOT NULL DEFAULT FALSE  -- hides notes from viewer role
);

-- ----------------------------------------------------------------
-- education_records
-- Monthly education progress snapshots per resident.
-- ----------------------------------------------------------------
CREATE TABLE education_records (
    education_record_id  SERIAL             PRIMARY KEY,
    resident_id          INTEGER            NOT NULL REFERENCES residents(resident_id),
    record_date          DATE               NOT NULL,
    education_level      education_level    NOT NULL,
    school_name          VARCHAR(150),
    enrollment_status    enrollment_status  NOT NULL DEFAULT 'Enrolled',
    attendance_rate      NUMERIC(5,4)       CHECK (attendance_rate BETWEEN 0 AND 1),
    progress_percent     NUMERIC(5,2)       CHECK (progress_percent BETWEEN 0 AND 100),
    completion_status    completion_status  NOT NULL DEFAULT 'NotStarted',
    notes                TEXT
);

-- ----------------------------------------------------------------
-- health_wellbeing_records
-- Monthly health snapshot per resident. Scores are on a 1–5 scale.
-- ----------------------------------------------------------------
CREATE TABLE health_wellbeing_records (
    health_record_id            SERIAL   PRIMARY KEY,
    resident_id                 INTEGER  NOT NULL REFERENCES residents(resident_id),
    record_date                 DATE     NOT NULL,
    general_health_score        NUMERIC(4,2),
    nutrition_score             NUMERIC(4,2),
    sleep_quality_score         NUMERIC(4,2),
    energy_level_score          NUMERIC(4,2),
    height_cm                   NUMERIC(5,1),
    weight_kg                   NUMERIC(5,2),
    bmi                         NUMERIC(5,2),
    medical_checkup_done        BOOLEAN  NOT NULL DEFAULT FALSE,
    dental_checkup_done         BOOLEAN  NOT NULL DEFAULT FALSE,
    psychological_checkup_done  BOOLEAN  NOT NULL DEFAULT FALSE,
    notes                       TEXT
);

-- ----------------------------------------------------------------
-- intervention_plans
-- Formal case conference intervention plans per resident.
-- services_provided is stored as a comma-separated list
-- (e.g. "Caring, Healing, Teaching") matching the source data.
-- ----------------------------------------------------------------
CREATE TABLE intervention_plans (
    plan_id              SERIAL        PRIMARY KEY,
    resident_id          INTEGER       NOT NULL REFERENCES residents(resident_id),
    plan_category        plan_category NOT NULL,
    plan_description     TEXT,
    services_provided    TEXT,                  -- comma-separated: Caring, Healing, Teaching, Legal Services
    target_value         NUMERIC(8,2),
    target_date          DATE,
    status               plan_status   NOT NULL DEFAULT 'Open',
    case_conference_date DATE,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- home_visitations
-- Field visit records including home visits and case conferences.
-- ----------------------------------------------------------------
CREATE TABLE home_visitations (
    visitation_id            SERIAL             PRIMARY KEY,
    resident_id              INTEGER            NOT NULL REFERENCES residents(resident_id),
    visit_date               DATE               NOT NULL,
    social_worker            VARCHAR(20)        NOT NULL,
    visit_type               visit_type         NOT NULL,
    location_visited         VARCHAR(150),
    family_members_present   TEXT,
    purpose                  TEXT,
    observations             TEXT,
    family_cooperation_level cooperation_level,
    safety_concerns_noted    BOOLEAN            NOT NULL DEFAULT FALSE,
    follow_up_needed         BOOLEAN            NOT NULL DEFAULT FALSE,
    follow_up_notes          TEXT,
    visit_outcome            visit_outcome
);

-- ----------------------------------------------------------------
-- process_recordings
-- Dated counseling session notes — the primary healing journey log.
-- interventions_applied is stored as comma-separated text to
-- preserve multi-value data from the source CSV.
-- notes_restricted flags entries that should only be visible
-- to admin/staff roles (not viewer).
-- ----------------------------------------------------------------
CREATE TABLE process_recordings (
    recording_id              SERIAL        PRIMARY KEY,
    resident_id               INTEGER       NOT NULL REFERENCES residents(resident_id),
    session_date              DATE          NOT NULL,
    social_worker             VARCHAR(20)   NOT NULL,
    session_type              session_type  NOT NULL,
    session_duration_minutes  INTEGER,
    emotional_state_observed  emotional_state,
    emotional_state_end       emotional_state,
    session_narrative         TEXT,
    interventions_applied     TEXT,                  -- comma-separated
    follow_up_actions         TEXT,
    progress_noted            BOOLEAN       NOT NULL DEFAULT FALSE,
    concerns_flagged          BOOLEAN       NOT NULL DEFAULT FALSE,
    referral_made             BOOLEAN       NOT NULL DEFAULT FALSE,
    notes_restricted          BOOLEAN       NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------
-- incident_reports
-- Security, medical, and behavioral incidents at safehouses.
-- ----------------------------------------------------------------
CREATE TABLE incident_reports (
    incident_id       SERIAL         PRIMARY KEY,
    resident_id       INTEGER        NOT NULL REFERENCES residents(resident_id),
    safehouse_id      INTEGER        NOT NULL REFERENCES safehouses(safehouse_id),
    incident_date     DATE           NOT NULL,
    incident_type     incident_type  NOT NULL,
    severity          severity_level NOT NULL,
    description       TEXT,
    response_taken    TEXT,
    resolved          BOOLEAN        NOT NULL DEFAULT FALSE,
    resolution_date   DATE,
    reported_by       VARCHAR(20),
    follow_up_required BOOLEAN       NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------
-- safehouse_monthly_metrics
-- Pre-aggregated monthly rollups per safehouse.
-- These are generated by the analytics pipeline and stored here
-- for fast dashboard queries without hitting the raw tables.
-- ----------------------------------------------------------------
CREATE TABLE safehouse_monthly_metrics (
    metric_id                SERIAL   PRIMARY KEY,
    safehouse_id             INTEGER  NOT NULL REFERENCES safehouses(safehouse_id),
    month_start              DATE     NOT NULL,
    month_end                DATE     NOT NULL,
    active_residents         INTEGER  NOT NULL DEFAULT 0,
    avg_education_progress   NUMERIC(6,2),
    avg_health_score         NUMERIC(4,2),
    process_recording_count  INTEGER  NOT NULL DEFAULT 0,
    home_visitation_count    INTEGER  NOT NULL DEFAULT 0,
    incident_count           INTEGER  NOT NULL DEFAULT 0,
    notes                    TEXT,
    UNIQUE (safehouse_id, month_start)
);

-- ----------------------------------------------------------------
-- public_impact_snapshots
-- Pre-computed monthly impact summaries for the public dashboard.
-- metric_payload_json is a JSONB column storing the full payload
-- (avg health score, avg education progress, donation totals, etc.)
-- so the public page can render without touching private tables.
-- ----------------------------------------------------------------
CREATE TABLE public_impact_snapshots (
    snapshot_id          SERIAL      PRIMARY KEY,
    snapshot_date        DATE        NOT NULL UNIQUE,
    headline             VARCHAR(300) NOT NULL,
    summary_text         TEXT,
    metric_payload_json  JSONB,
    is_published         BOOLEAN     NOT NULL DEFAULT FALSE,
    published_at         DATE
);


-- ================================================================
-- SECTION 3: INDEXES
-- Added on all foreign keys and common filter/sort columns.
-- ================================================================

-- donations
CREATE INDEX idx_donations_supporter    ON donations(supporter_id);
CREATE INDEX idx_donations_date         ON donations(donation_date);
CREATE INDEX idx_donations_type         ON donations(donation_type);

-- donation_allocations
CREATE INDEX idx_alloc_donation         ON donation_allocations(donation_id);
CREATE INDEX idx_alloc_safehouse        ON donation_allocations(safehouse_id);
CREATE INDEX idx_alloc_program          ON donation_allocations(program_area);

-- in_kind_donation_items
CREATE INDEX idx_inkind_donation        ON in_kind_donation_items(donation_id);

-- partner_assignments
CREATE INDEX idx_pa_partner             ON partner_assignments(partner_id);
CREATE INDEX idx_pa_safehouse           ON partner_assignments(safehouse_id);

-- residents
CREATE INDEX idx_residents_safehouse    ON residents(safehouse_id);
CREATE INDEX idx_residents_status       ON residents(case_status);
CREATE INDEX idx_residents_category     ON residents(case_category);
CREATE INDEX idx_residents_sw           ON residents(assigned_social_worker);
CREATE INDEX idx_residents_reint_status ON residents(reintegration_status);

-- education_records
CREATE INDEX idx_edu_resident           ON education_records(resident_id);
CREATE INDEX idx_edu_date               ON education_records(record_date);

-- health_wellbeing_records
CREATE INDEX idx_health_resident        ON health_wellbeing_records(resident_id);
CREATE INDEX idx_health_date            ON health_wellbeing_records(record_date);

-- intervention_plans
CREATE INDEX idx_plans_resident         ON intervention_plans(resident_id);
CREATE INDEX idx_plans_status           ON intervention_plans(status);

-- home_visitations
CREATE INDEX idx_hv_resident            ON home_visitations(resident_id);
CREATE INDEX idx_hv_date                ON home_visitations(visit_date);
CREATE INDEX idx_hv_sw                  ON home_visitations(social_worker);

-- process_recordings
CREATE INDEX idx_pr_resident            ON process_recordings(resident_id);
CREATE INDEX idx_pr_date                ON process_recordings(session_date);
CREATE INDEX idx_pr_sw                  ON process_recordings(social_worker);

-- incident_reports
CREATE INDEX idx_inc_resident           ON incident_reports(resident_id);
CREATE INDEX idx_inc_safehouse          ON incident_reports(safehouse_id);
CREATE INDEX idx_inc_date               ON incident_reports(incident_date);

-- safehouse_monthly_metrics
CREATE INDEX idx_smm_safehouse          ON safehouse_monthly_metrics(safehouse_id);
CREATE INDEX idx_smm_month              ON safehouse_monthly_metrics(month_start);

-- public_impact_snapshots
CREATE INDEX idx_pis_published          ON public_impact_snapshots(is_published, snapshot_date DESC);


-- ================================================================
-- SECTION 4: UPDATED_AT TRIGGER
-- Auto-updates updated_at on users and intervention_plans.
-- ================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plans_updated_at
    BEFORE UPDATE ON intervention_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ================================================================
-- SECTION 5: SEQUENCE RESETS
-- After seeding, advance sequences past the max seeded IDs so
-- future INSERTs get fresh IDs and don't collide with seed data.
-- Run this block AFTER seed_data.sql has been loaded.
-- ================================================================
SELECT setval('safehouses_safehouse_id_seq',          (SELECT MAX(safehouse_id)          FROM safehouses));
SELECT setval('supporters_supporter_id_seq',           (SELECT MAX(supporter_id)          FROM supporters));
SELECT setval('donations_donation_id_seq',             (SELECT MAX(donation_id)           FROM donations));
SELECT setval('donation_allocations_allocation_id_seq',(SELECT MAX(allocation_id)         FROM donation_allocations));
SELECT setval('in_kind_donation_items_item_id_seq',    (SELECT MAX(item_id)               FROM in_kind_donation_items));
SELECT setval('partners_partner_id_seq',               (SELECT MAX(partner_id)            FROM partners));
SELECT setval('partner_assignments_assignment_id_seq', (SELECT MAX(assignment_id)         FROM partner_assignments));
SELECT setval('residents_resident_id_seq',             (SELECT MAX(resident_id)           FROM residents));
SELECT setval('education_records_education_record_id_seq',(SELECT MAX(education_record_id) FROM education_records));
SELECT setval('health_wellbeing_records_health_record_id_seq',(SELECT MAX(health_record_id) FROM health_wellbeing_records));
SELECT setval('intervention_plans_plan_id_seq',        (SELECT MAX(plan_id)               FROM intervention_plans));
SELECT setval('home_visitations_visitation_id_seq',    (SELECT MAX(visitation_id)         FROM home_visitations));
SELECT setval('process_recordings_recording_id_seq',   (SELECT MAX(recording_id)          FROM process_recordings));
SELECT setval('incident_reports_incident_id_seq',      (SELECT MAX(incident_id)           FROM incident_reports));
SELECT setval('safehouse_monthly_metrics_metric_id_seq',(SELECT MAX(metric_id)            FROM safehouse_monthly_metrics));
SELECT setval('public_impact_snapshots_snapshot_id_seq',(SELECT MAX(snapshot_id)          FROM public_impact_snapshots));
