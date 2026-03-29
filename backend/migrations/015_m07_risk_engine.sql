-- ============================================================================
-- Migration 015 — M07 Risk Score Engine
-- ============================================================================
-- Tables:
--   m07_risk_scores     — per-shipment composite risk score + feature vector
--   m07_review_queue    — AMBER / RED items assigned to reviewing officers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Risk score records (one row per scored shipment)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m07_risk_scores (
    id              SERIAL PRIMARY KEY,
    analysis_uuid   UUID         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id         INTEGER      NOT NULL,

    -- Source references
    filing_id       INTEGER,     -- M05 BoE filing
    document_id     INTEGER,     -- M02 document

    -- Importer identity
    importer_iec    VARCHAR(20),
    importer_name   VARCHAR(255),

    -- Risk result
    score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    tier            VARCHAR(10)  NOT NULL DEFAULT 'GREEN',
    -- tier: GREEN | AMBER | RED
    action          VARCHAR(30)  NOT NULL DEFAULT 'AUTO_CLEARANCE',
    -- action: AUTO_CLEARANCE | ASSIGN_REVIEW | REFER_INVESTIGATION

    -- Model metadata
    model_label     VARCHAR(40)  NOT NULL DEFAULT 'rule-based',

    -- Feature vector + contributions (JSONB for full audit trail)
    features_json      JSONB,
    contributions_json JSONB,
    meta_json          JSONB,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m07_scores_user
    ON m07_risk_scores (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m07_scores_iec
    ON m07_risk_scores (importer_iec, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m07_scores_tier
    ON m07_risk_scores (tier, score DESC);

CREATE INDEX IF NOT EXISTS idx_m07_scores_uuid
    ON m07_risk_scores (analysis_uuid);

CREATE INDEX IF NOT EXISTS idx_m07_scores_filing
    ON m07_risk_scores (filing_id) WHERE filing_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. Review queue (AMBER + RED items awaiting officer action)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS m07_review_queue (
    id                  SERIAL PRIMARY KEY,
    analysis_uuid       UUID         NOT NULL,
    user_id             INTEGER      NOT NULL,

    -- Source references
    filing_id           INTEGER,
    document_id         INTEGER,

    -- Importer identity
    importer_iec        VARCHAR(20),
    importer_name       VARCHAR(255),

    -- Risk result
    score               NUMERIC(5,2) NOT NULL,
    tier                VARCHAR(10)  NOT NULL,
    action              VARCHAR(30)  NOT NULL,

    -- Workflow
    status              VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
    -- status: PENDING | UNDER_REVIEW | CLEARED | REFERRED | DETAINED

    assigned_officer_id INTEGER,
    resolution          TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_m07_queue_user
    ON m07_review_queue (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m07_queue_tier
    ON m07_review_queue (tier, score DESC);

CREATE INDEX IF NOT EXISTS idx_m07_queue_status
    ON m07_review_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m07_queue_iec
    ON m07_review_queue (importer_iec);
