-- ============================================================
-- Migration 010: M03 HSN Classification Engine
-- pgvector extension + HSN embeddings table + results table
-- ============================================================

-- Enable pgvector (must be installed on PostgreSQL server)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── HSN Embeddings Table ──────────────────────────────────────────────────────
-- Stores 1536-dim OpenAI text-embedding-3-small vectors for every HSN code.
-- Used by pgvector ANN index for top-10 candidate retrieval.

CREATE TABLE IF NOT EXISTS hsn_embeddings (
    id              SERIAL PRIMARY KEY,
    hsn_code        VARCHAR(8)  NOT NULL UNIQUE,
    description     TEXT        NOT NULL,
    chapter         SMALLINT    NOT NULL,
    chapter_name    TEXT,
    section         VARCHAR(10),
    unit            VARCHAR(50),
    notes           TEXT,
    embedding       vector(1536),          -- OpenAI text-embedding-3-small output dimension
    embedded_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for cosine ANN search (better recall than IVFFlat for < 1M vectors)
-- m=16 (graph connectivity), ef_construction=64 (build quality)
CREATE INDEX IF NOT EXISTS hsn_embeddings_hnsw_idx
    ON hsn_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS hsn_embeddings_chapter_idx ON hsn_embeddings(chapter);
CREATE INDEX IF NOT EXISTS hsn_embeddings_code_idx    ON hsn_embeddings(hsn_code);

-- ── M03 Classification Results Table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS m03_classification_results (
    id                      SERIAL PRIMARY KEY,
    document_id             INT  REFERENCES "ProcessedDocuments"(id) ON DELETE SET NULL,
    user_id                 INT  REFERENCES "User"(id) ON DELETE SET NULL,

    -- Input
    product_description     TEXT        NOT NULL,
    normalized_description  TEXT,
    detected_language       VARCHAR(10) DEFAULT 'en',

    -- Pipeline output
    top3_predictions        JSONB,      -- [{hsn_code, confidence, reasoning, gri_rule, scomet_controlled}]
    selected_hsn            VARCHAR(8),
    selected_confidence     FLOAT,
    overall_confidence      FLOAT,
    classification_notes    TEXT,
    candidates_retrieved    SMALLINT    DEFAULT 0,

    -- Routing (SOP HSN-003)
    routing                 VARCHAR(30) DEFAULT 'human_review',  -- auto | human_review

    -- Post-processing flags
    scomet_flag             BOOLEAN     DEFAULT FALSE,
    trade_remedy_alert      BOOLEAN     DEFAULT FALSE,
    restricted_countries    JSONB,

    -- Pipeline telemetry
    pipeline_stages         JSONB,
    pipeline_duration_ms    INT,

    -- Human review
    review_status           VARCHAR(30) DEFAULT 'pending',  -- pending | approved | rejected
    reviewed_by             INT REFERENCES "User"(id) ON DELETE SET NULL,
    reviewed_at             TIMESTAMPTZ,
    reviewer_notes          TEXT,
    reviewer_hsn_override   VARCHAR(8),  -- if reviewer picks a different code

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS m03_doc_idx    ON m03_classification_results(document_id);
CREATE INDEX IF NOT EXISTS m03_user_idx   ON m03_classification_results(user_id);
CREATE INDEX IF NOT EXISTS m03_route_idx  ON m03_classification_results(routing, review_status);
CREATE INDEX IF NOT EXISTS m03_hsn_idx    ON m03_classification_results(selected_hsn);
