-- ============================================================================
-- Migration 014 — M06 Trade Fraud Detection Engine
-- ============================================================================
-- Tables:
--   m06_fraud_analyses        — per-transaction fraud analysis results
--   m06_fraud_flags           — individual fraud flag records per analysis
--   m06_investigation_cases   — SIIB/DRI investigation case management
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fraud analysis results (one row per analysed transaction)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m06_fraud_analyses (
    id                  SERIAL PRIMARY KEY,
    analysis_uuid       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id             INTEGER NOT NULL,

    -- Importer identity
    importer_iec        VARCHAR(20),
    importer_name       VARCHAR(255),

    -- Composite result
    composite_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
    risk_level          VARCHAR(20)  NOT NULL DEFAULT 'CLEAN',
    fraud_types_count   INTEGER      NOT NULL DEFAULT 0,

    -- Individual sub-scores
    ecod_score          NUMERIC(5,2) DEFAULT 0,
    hclnet_score        NUMERIC(5,2) DEFAULT 0,
    hsn_score           NUMERIC(5,2) DEFAULT 0,
    benford_score       NUMERIC(5,2) DEFAULT 0,
    routing_score       NUMERIC(5,2) DEFAULT 0,
    duplicate_score     NUMERIC(5,2) DEFAULT 0,
    temporal_score      NUMERIC(5,2) DEFAULT 0,

    -- Detailed results (JSONB)
    fraud_flags_json    JSONB,
    result_json         JSONB,        -- full pipeline output including transaction

    -- Link to investigation case if created
    case_id             INTEGER,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m06_analyses_user
    ON m06_fraud_analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m06_analyses_iec
    ON m06_fraud_analyses (importer_iec, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m06_analyses_risk
    ON m06_fraud_analyses (risk_level, composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_m06_analyses_uuid
    ON m06_fraud_analyses (analysis_uuid);


-- ---------------------------------------------------------------------------
-- 2. Individual fraud flags (one row per fraud type detected per analysis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m06_fraud_flags (
    id              SERIAL PRIMARY KEY,
    analysis_id     INTEGER NOT NULL REFERENCES m06_fraud_analyses(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL,
    fraud_type      VARCHAR(60) NOT NULL,
    score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    algorithm       VARCHAR(80),
    evidence        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m06_flags_analysis
    ON m06_fraud_flags (analysis_id);

CREATE INDEX IF NOT EXISTS idx_m06_flags_type
    ON m06_fraud_flags (fraud_type, score DESC);


-- ---------------------------------------------------------------------------
-- 3. Investigation cases (SIIB / DRI case management)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m06_investigation_cases (
    id                  SERIAL PRIMARY KEY,
    case_ref            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id             INTEGER NOT NULL,
    analysis_uuid       UUID,

    -- Subject
    importer_iec        VARCHAR(20),
    importer_name       VARCHAR(255),

    -- Risk assessment
    composite_score     NUMERIC(5,2) NOT NULL,
    risk_level          VARCHAR(20)  NOT NULL,
    fraud_types_json    JSONB,

    -- Case workflow
    status              VARCHAR(30)  NOT NULL DEFAULT 'OPEN',
    -- status values: OPEN | UNDER_REVIEW | ESCALATED | CLOSED

    analyst_id          INTEGER,                    -- assigned analyst user_id
    analyst_findings    TEXT,
    action_taken        VARCHAR(30),
    -- action values: WARN | DETAIN | PROSECUTE | CLEAR

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m06_cases_user
    ON m06_investigation_cases (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m06_cases_iec
    ON m06_investigation_cases (importer_iec);

CREATE INDEX IF NOT EXISTS idx_m06_cases_status
    ON m06_investigation_cases (status, composite_score DESC);

CREATE INDEX IF NOT EXISTS idx_m06_cases_risk
    ON m06_investigation_cases (risk_level, created_at DESC);
