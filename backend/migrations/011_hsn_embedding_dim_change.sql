-- ============================================================
-- Migration 011: Change hsn_embeddings vector dimension
-- Voyage-4-large (3072-dim) → OpenAI text-embedding-3-small (1536-dim)
--
-- Run this ONLY if migration 010 was already applied.
-- Safe to run multiple times (checks column type first).
-- ============================================================

-- Drop the HNSW index (must be done before altering column type)
DROP INDEX IF EXISTS hsn_embeddings_hnsw_idx;

-- Clear all existing embeddings (they were 3072-dim; incompatible with 1536-dim)
UPDATE hsn_embeddings SET embedding = NULL, embedded_at = NULL;

-- Change the vector column dimension from 3072 to 1536
ALTER TABLE hsn_embeddings
    ALTER COLUMN embedding TYPE vector(1536)
    USING NULL;   -- existing values are dropped (all nulled above anyway)

-- Recreate HNSW index for new dimension
CREATE INDEX IF NOT EXISTS hsn_embeddings_hnsw_idx
    ON hsn_embeddings USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
