"""
M03 Retriever — pgvector ANN top-K search.

Queries the hsn_embeddings table using HNSW cosine similarity index
to retrieve the K most semantically similar HSN code descriptions.

Why pgvector over ChromaDB/FAISS?
  - Transactional consistency with the rest of the application DB
  - HNSW index gives sub-millisecond ANN search on 20,000+ vectors
  - No separate vector DB infrastructure to maintain
  - cosine similarity is optimal for normalised embedding spaces
"""

import logging
import os
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

TOP_K_DEFAULT = 10    # candidates returned to LLM


def _cosine(a, b) -> float:
    dot    = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    return dot / (norm_a * norm_b) if (norm_a and norm_b) else 0.0


def _cosine_rerank(embedding, candidates):
    """Re-rank FTS candidates by cosine similarity with the query embedding."""
    for c in candidates:
        c["similarity"] = round(_cosine(embedding, c.get("embedding") or []), 4) if c.get("embedding") else 0.0
    # Sort by similarity descending; fall back to original FTS order if no stored embeddings
    ranked = sorted(candidates, key=lambda c: c["similarity"], reverse=True)
    # If all similarities are 0 (no stored embeddings), return original order
    if all(c["similarity"] == 0.0 for c in ranked):
        return candidates
    return ranked


def _db_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql://postgres:PRATHAM@localhost:5432/orbisporte_db")
    return url.replace("postgresql+psycopg2://", "postgresql://", 1)


def _pgvector_available() -> bool:
    """Check whether pgvector extension and hsn_embeddings table exist."""
    import psycopg2
    try:
        conn = psycopg2.connect(_db_url())
        cur  = conn.cursor()
        cur.execute(
            "SELECT EXISTS(SELECT FROM pg_extension WHERE extname='vector') "
            "AND EXISTS(SELECT FROM information_schema.tables WHERE table_name='hsn_embeddings')"
        )
        result = cur.fetchone()[0]
        cur.close()
        conn.close()
        return bool(result)
    except Exception:
        return False


def _retrieve_pgvector(embedding: List[float], k: int) -> List[Dict[str, Any]]:
    """ANN cosine search via pgvector HNSW index on hsn_embeddings."""
    import psycopg2
    import psycopg2.extras

    vec_literal = "[" + ",".join(f"{x:.8f}" for x in embedding) + "]"
    sql = """
        SELECT
            hsn_code,
            description,
            chapter,
            chapter_name,
            unit,
            ROUND((1 - (embedding <=> %s::vector))::numeric, 4) AS similarity
        FROM hsn_embeddings
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """
    conn = psycopg2.connect(_db_url())
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, (vec_literal, vec_literal, k))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    logger.info("pgvector: %d candidates (top sim=%.4f)", len(rows), rows[0]["similarity"] if rows else 0)
    return rows


def _retrieve_postgres_fts(normalized_text: str, k: int) -> List[Dict[str, Any]]:
    """
    Fallback when pgvector is not installed.
    Uses hsn_codes table with FTS + ILIKE to get candidates.
    Applies synonym expansion so modern product names (iPhone, laptop, etc.)
    are mapped to ITC(HS) 2012 vocabulary before searching.
    """
    import psycopg2
    import psycopg2.extras

    # Expand consumer product names → ITC(HS) vocabulary
    try:
        from Orbisporte.domain.services.hsn_search_service import _expand_query
        _, db_text = _expand_query(normalized_text)
    except Exception:
        db_text = normalized_text

    conn = psycopg2.connect(_db_url())
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    seen: dict = {}

    # FTS
    try:
        cur.execute("""
            SELECT hsn_code, description, chapter, chapter_name,
                   0.0::float AS similarity
            FROM hsn_codes
            WHERE to_tsvector('english',
                      COALESCE(description,'') || ' ' ||
                      COALESCE(hs4,'') || ' ' || COALESCE(hs5,'')
                  ) @@ plainto_tsquery('english', %s)
            ORDER BY ts_rank(
                to_tsvector('english', COALESCE(description,'')),
                plainto_tsquery('english', %s)
            ) DESC
            LIMIT %s
        """, (db_text, db_text, k))
        for r in cur.fetchall():
            seen[r["hsn_code"]] = dict(r)
    except Exception as exc:
        logger.error("FTS query failed: %s", exc)
        conn.rollback()

    # ILIKE widening (use expanded keywords only, not brand names)
    keywords = [w for w in db_text.split() if len(w) > 2]
    if keywords and len(seen) < k:
        try:
            like_clauses = " OR ".join(["description ILIKE %s"] * len(keywords))
            like_params  = [f"%{kw}%" for kw in keywords]
            cur.execute(
                f"SELECT hsn_code, description, chapter, chapter_name, "
                f"0.0::float AS similarity FROM hsn_codes "
                f"WHERE {like_clauses} LIMIT %s",
                like_params + [k],
            )
            for r in cur.fetchall():
                if r["hsn_code"] not in seen:
                    seen[r["hsn_code"]] = dict(r)
        except Exception as exc:
            logger.error("ILIKE query failed: %s", exc)
            conn.rollback()

    cur.close()
    conn.close()

    rows = list(seen.values())
    logger.info("PostgreSQL FTS fallback: %d candidates for: %.60s", len(rows), normalized_text)
    return rows


def retrieve_candidates(
    embedding: List[float],
    k: int = TOP_K_DEFAULT,
    normalized_text: str = "",
) -> List[Dict[str, Any]]:
    """
    Retrieve top-K HSN candidates.

    Primary  : pgvector HNSW cosine ANN on hsn_embeddings (when pgvector installed)
    Fallback : PostgreSQL FTS + ILIKE on hsn_codes        (when pgvector not available)

    Parameters
    ----------
    embedding       : 1536-dim query vector from OpenAI embedder
    k               : number of candidates to return
    normalized_text : plain-text query used for FTS fallback
    """
    try:
        if _pgvector_available():
            return _retrieve_pgvector(embedding, k)
        else:
            logger.warning(
                "pgvector not available — falling back to PostgreSQL FTS on hsn_codes. "
                "Install pgvector and seed hsn_embeddings for full accuracy."
            )
            return _retrieve_postgres_fts(normalized_text or " ".join(
                [w for w in (normalized_text or "").split() if w]
            ) or "product", k)
    except Exception as exc:
        logger.error("retrieve_candidates failed: %s", exc)
        raise


def count_embedded() -> int:
    """Return number of HSN codes that have been embedded."""
    import psycopg2
    try:
        conn = psycopg2.connect(_db_url())
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM hsn_embeddings WHERE embedding IS NOT NULL")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return count
    except Exception:
        return 0
