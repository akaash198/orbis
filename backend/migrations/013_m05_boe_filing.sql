-- ============================================================================
-- Migration 013 — M05 Bill of Entry Filing System
-- ============================================================================

CREATE TABLE IF NOT EXISTS m05_boe_filings (
    id                   SERIAL PRIMARY KEY,
    filing_ref           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id              INTEGER NOT NULL,
    document_id          INTEGER,
    port_of_import       VARCHAR(20) DEFAULT 'INMAA1',
    filing_status        VARCHAR(30) DEFAULT 'DRAFT',
    risk_score           NUMERIC(5,2) DEFAULT 0,
    risk_band            VARCHAR(10)  DEFAULT 'LOW',
    block_submit         BOOLEAN      DEFAULT FALSE,
    boe_fields_json      JSONB,
    line_items_json      JSONB,
    icegate_status       VARCHAR(30) DEFAULT 'NOT_SUBMITTED',
    icegate_ack_number   VARCHAR(50),
    icegate_boe_number   VARCHAR(50),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m05_filings_user   ON m05_boe_filings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_m05_filings_doc    ON m05_boe_filings (document_id);

CREATE INDEX IF NOT EXISTS idx_m05_filings_status ON m05_boe_filings (icegate_status);

CREATE TABLE IF NOT EXISTS m05_boe_line_items (
    id           SERIAL PRIMARY KEY,
    filing_id    INTEGER NOT NULL REFERENCES m05_boe_filings(id) ON DELETE CASCADE,
    line_number  INTEGER NOT NULL,
    item_json    JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m05_line_items_filing ON m05_boe_line_items (filing_id, line_number);

CREATE TABLE IF NOT EXISTS m05_icegate_log (
    id              SERIAL PRIMARY KEY,
    filing_id       INTEGER NOT NULL REFERENCES m05_boe_filings(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL,
    action          VARCHAR(30) NOT NULL,
    request_json    JSONB,
    response_json   JSONB,
    icegate_status  VARCHAR(30),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m05_icegate_log_filing ON m05_icegate_log (filing_id, created_at DESC);
