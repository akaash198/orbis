-- ============================================================================
-- Migration 020 — M05 soft delete + recycle bin support
-- ============================================================================

ALTER TABLE m05_boe_filings
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE m05_boe_filings
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE m05_boe_filings
    ADD COLUMN IF NOT EXISTS deleted_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_m05_filings_deleted
    ON m05_boe_filings (user_id, is_deleted, updated_at DESC);

