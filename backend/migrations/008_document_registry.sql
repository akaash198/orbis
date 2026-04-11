-- Migration 008: Document Registry and Data Lake tracking tables
-- Supports the three-tier data lake (Raw → Processed → Curated)
-- and multi-channel ingestion (API, SFTP, Email, Portal, Barcode, Voice)

CREATE TABLE IF NOT EXISTS document_registry (
    id                    SERIAL PRIMARY KEY,
    document_id           VARCHAR(36)  UNIQUE NOT NULL,   -- UUID v4
    source_channel        VARCHAR(50)  NOT NULL,           -- api | sftp | email | portal | barcode | voice
    original_filename     TEXT,
    file_type             VARCHAR(20),                     -- pdf | jpeg | png | tiff | xml | json | edi | wav | mp3
    file_size_bytes       BIGINT,
    content_hash          VARCHAR(64),                     -- SHA-256

    -- Classification results (DM-004)
    document_type         TEXT,                            -- invoice | bill_of_entry | shipping_bill | packing_list …
    language              VARCHAR(20),                     -- ISO 639-1 code, e.g. en | hi | zh
    classification_confidence FLOAT,

    -- Source metadata
    source_system         TEXT,                            -- sender domain / SFTP host / scanner ID / etc.
    sender_info           TEXT,                            -- email From / SFTP user / API caller

    -- Three-tier data lake paths
    raw_lake_path         TEXT,
    processed_lake_path   TEXT,
    curated_lake_path     TEXT,
    current_tier          VARCHAR(20) DEFAULT 'raw',       -- raw | processed | curated

    -- Processing pipeline status
    ingestion_status      VARCHAR(50) DEFAULT 'pending',   -- pending | validated | registered | preprocessed | classified | stored | failed
    validation_errors     JSONB,
    metadata_tags         JSONB,

    -- Deduplication (FAISS semantic search)
    is_duplicate          BOOLEAN     DEFAULT FALSE,
    duplicate_of          VARCHAR(36),                     -- document_id of the original
    duplicate_confidence  FLOAT,

    -- Foreign keys
    user_id               INTEGER REFERENCES "User"(id)    ON DELETE SET NULL,
    company_id            INTEGER REFERENCES "Company"(id) ON DELETE SET NULL,

    -- Timestamps
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    processed_at          TIMESTAMPTZ
);

-- Indexes for hot query paths
CREATE INDEX IF NOT EXISTS idx_dr_document_id      ON document_registry (document_id);
CREATE INDEX IF NOT EXISTS idx_dr_content_hash     ON document_registry (content_hash);
CREATE INDEX IF NOT EXISTS idx_dr_source_channel   ON document_registry (source_channel);
CREATE INDEX IF NOT EXISTS idx_dr_ingestion_status ON document_registry (ingestion_status);
CREATE INDEX IF NOT EXISTS idx_dr_user_id          ON document_registry (user_id);
CREATE INDEX IF NOT EXISTS idx_dr_company_id       ON document_registry (company_id);
CREATE INDEX IF NOT EXISTS idx_dr_created_at       ON document_registry (created_at DESC);

-- Audit / event log — one row per pipeline transition
CREATE TABLE IF NOT EXISTS intake_event_log (
    id            SERIAL PRIMARY KEY,
    document_id   VARCHAR(36) REFERENCES document_registry (document_id) ON DELETE CASCADE,
    event_type    VARCHAR(100) NOT NULL,   -- INGESTED | VALIDATED | PREPROCESSED | CLASSIFIED | STORED_RAW | …
    event_data    JSONB,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iel_document_id ON intake_event_log (document_id);
CREATE INDEX IF NOT EXISTS idx_iel_event_type  ON intake_event_log (event_type);

-- Auto-update updated_at on document_registry changes
CREATE OR REPLACE FUNCTION update_document_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_registry_updated_at ON document_registry;
CREATE TRIGGER trg_document_registry_updated_at
    BEFORE UPDATE ON document_registry
    FOR EACH ROW EXECUTE FUNCTION update_document_registry_updated_at();
