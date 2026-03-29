-- Migration 016: Add document type identification columns to m02_extraction_results
-- Supports Stage 0 of the M02 pipeline (GPT-4o-mini + heuristic classifier)

ALTER TABLE m02_extraction_results
    ADD COLUMN IF NOT EXISTS document_type            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS document_type_confidence FLOAT,
    ADD COLUMN IF NOT EXISTS document_type_signals    JSONB;

CREATE INDEX IF NOT EXISTS idx_m02_doc_type ON m02_extraction_results (document_type);
