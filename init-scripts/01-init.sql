-- ============================================
-- Orbisporte Database Initialization
-- ============================================
-- This script runs automatically when PostgreSQL container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE orbisporte TO orbisporte;

-- Create vector table for HSN embeddings (pgvector)
CREATE TABLE IF NOT EXISTS hsn_embeddings (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(10) NOT NULL,
    hsn_description TEXT NOT NULL,
    chapter VARCHAR(4),
    heading VARCHAR(6),
    embedding VECTOR(1024),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_hsn_embeddings_vector 
ON hsn_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create index on hsn_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_hsn_code ON hsn_embeddings(hsn_code);

-- Grant table permissions
GRANT ALL PRIVILEGES ON TABLE hsn_embeddings TO orbisporte;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Orbisporte database initialization complete';
    RAISE NOTICE 'pgvector extension enabled';
END $$;
