-- ============================================================================
-- Migration 019 — Add boe_number to m05_boe_filings
-- ============================================================================
-- Adds a human-readable BOE reference number generated at filing creation time.
-- Format: BOE/{YEAR}/{PORT_CODE}/{ID:06d}
-- Example: BOE/2026/INMAA1/000042
-- ============================================================================

ALTER TABLE m05_boe_filings
    ADD COLUMN IF NOT EXISTS boe_number VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_m05_filings_boe_number
    ON m05_boe_filings (boe_number)
    WHERE boe_number IS NOT NULL;
