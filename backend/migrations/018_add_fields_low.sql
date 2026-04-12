-- Migration 018: Add fields_low column for quality_alert manual corrections.
-- Safe to re-run: uses IF NOT EXISTS.

ALTER TABLE m02_extraction_results
    ADD COLUMN IF NOT EXISTS fields_low JSONB;

-- If the column already existed as JSON (older schema), promote it to JSONB so GIN indexing works.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'm02_extraction_results'
          AND column_name = 'fields_low'
          AND data_type = 'json'
    ) THEN
        ALTER TABLE m02_extraction_results
            ALTER COLUMN fields_low TYPE JSONB USING fields_low::jsonb;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_m02_fields_low
    ON m02_extraction_results USING GIN (fields_low jsonb_path_ops);
