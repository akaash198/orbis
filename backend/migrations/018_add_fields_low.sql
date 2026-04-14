-- Migration 018: Add fields_low column for quality_alert manual corrections.
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE m02_extraction_results
    ADD COLUMN IF NOT EXISTS fields_low JSONB;

CREATE INDEX IF NOT EXISTS idx_m02_fields_low ON m02_extraction_results USING GIN (fields_low);
