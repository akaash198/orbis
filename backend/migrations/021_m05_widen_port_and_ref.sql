-- ============================================================================
-- Migration 021 — Widen M05 filing columns for real-world port names/ref formats
-- ============================================================================

ALTER TABLE m05_boe_filings
  ALTER COLUMN port_of_import TYPE VARCHAR(100);

DO $$
DECLARE
  ref_type text;
  ref_len  integer;
BEGIN
  SELECT data_type, character_maximum_length
    INTO ref_type, ref_len
    FROM information_schema.columns
   WHERE table_name = 'm05_boe_filings'
     AND column_name = 'filing_ref';

  IF ref_type = 'character varying' AND COALESCE(ref_len, 0) < 36 THEN
    EXECUTE 'ALTER TABLE m05_boe_filings ALTER COLUMN filing_ref TYPE VARCHAR(64)';
  END IF;
END $$;
