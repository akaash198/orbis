-- Migration 009: M02 Document Processing & Extraction results table

CREATE TABLE IF NOT EXISTS m02_extraction_results (
    id                  SERIAL PRIMARY KEY,
    document_id         INTEGER REFERENCES "ProcessedDocuments"(id) ON DELETE CASCADE,
    user_id             INTEGER REFERENCES "User"(id) ON DELETE SET NULL,

    -- Pipeline stage outputs
    ocr_text            TEXT,
    layout_blocks       JSONB,               -- detected layout regions
    raw_entities        JSONB,               -- GLiNER raw output
    extracted_fields    JSONB,               -- GPT-4o-mini field extraction
    normalised_fields   JSONB,               -- after normalization

    -- Per-field confidence scores  { field_name: score }
    confidence_scores   JSONB,
    overall_confidence  FLOAT,

    -- Routing (SOP DE-003)
    -- auto | soft_review | hard_review | quality_alert
    review_queue        VARCHAR(30) DEFAULT 'auto',
    fields_auto         JSONB,               -- fields >= 0.95
    fields_soft_review  JSONB,               -- 0.90 - 0.94
    fields_hard_review  JSONB,               -- < 0.90
    quality_alert       BOOLEAN DEFAULT FALSE,

    -- Human review state
    reviewed_fields     JSONB,               -- human-corrected values
    review_status       VARCHAR(30) DEFAULT 'pending',  -- pending|in_review|approved
    reviewed_by         INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,

    -- Timestamps
    pipeline_duration_ms INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_m02_document_id ON m02_extraction_results (document_id);
CREATE INDEX IF NOT EXISTS idx_m02_user_id     ON m02_extraction_results (user_id);
CREATE INDEX IF NOT EXISTS idx_m02_queue       ON m02_extraction_results (review_queue);
CREATE INDEX IF NOT EXISTS idx_m02_status      ON m02_extraction_results (review_status);
