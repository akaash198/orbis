-- Migration 017: Ensure m02_extraction_results has all columns required by the current model.
-- Safe to re-run: every statement uses IF NOT EXISTS / idempotent DDL.
-- Run this if you see "UndefinedColumn" errors on m02_extraction_results.

-- Columns added in migration 016 (document type identification)
ALTER TABLE m02_extraction_results
    ADD COLUMN IF NOT EXISTS document_type            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS document_type_confidence FLOAT,
    ADD COLUMN IF NOT EXISTS document_type_signals    JSONB;

-- Core pipeline columns (from migration 009 — safe to re-add if missing)
ALTER TABLE m02_extraction_results
    ADD COLUMN IF NOT EXISTS ocr_text             TEXT,
    ADD COLUMN IF NOT EXISTS layout_blocks        JSONB,
    ADD COLUMN IF NOT EXISTS raw_entities         JSONB,
    ADD COLUMN IF NOT EXISTS extracted_fields     JSONB,
    ADD COLUMN IF NOT EXISTS normalised_fields    JSONB,
    ADD COLUMN IF NOT EXISTS confidence_scores    JSONB,
    ADD COLUMN IF NOT EXISTS overall_confidence   FLOAT,
    ADD COLUMN IF NOT EXISTS review_queue         VARCHAR(30) DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS fields_auto          JSONB,
    ADD COLUMN IF NOT EXISTS fields_soft_review   JSONB,
    ADD COLUMN IF NOT EXISTS fields_hard_review   JSONB,
    ADD COLUMN IF NOT EXISTS quality_alert        BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reviewed_fields      JSONB,
    ADD COLUMN IF NOT EXISTS review_status        VARCHAR(30) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reviewed_by          INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pipeline_duration_ms INTEGER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_m02_doc_type   ON m02_extraction_results (document_type);
CREATE INDEX IF NOT EXISTS idx_m02_document_id ON m02_extraction_results (document_id);
CREATE INDEX IF NOT EXISTS idx_m02_user_id     ON m02_extraction_results (user_id);
CREATE INDEX IF NOT EXISTS idx_m02_queue       ON m02_extraction_results (review_queue);
CREATE INDEX IF NOT EXISTS idx_m02_status      ON m02_extraction_results (review_status);
