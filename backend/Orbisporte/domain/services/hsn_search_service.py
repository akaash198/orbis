"""
HSN Classification Service — Optimized for Speed

Fast Mode: PostgreSQL FTS + ILIKE → immediate results (<100ms)
Full Mode: PostgreSQL FTS → OpenAI embed → Gemini 3.1 Flash reasoning (accurate but slower)

Pipeline (Fast Mode)
-------------------
1. Synonym expansion — bridge modern product names to ITC(HS) 2012 vocabulary
2. PostgreSQL FTS — to_tsvector / plainto_tsquery, ranked by ts_rank
3. ILIKE widening — keyword fallback for names not in FTS index
4. Return top-3 results immediately with FTS rank as confidence

Pipeline (Full Mode)
-------------------
1. Synonym expansion
2. PostgreSQL FTS — up to 20 candidates
3. OpenAI text-embedding-3-small — cosine similarity re-rank
4. Gemini 3.1 Flash — GRI chain-of-thought reasoning → top-3 with confidence
5. Post-process — SCOMET / trade remedy / country restriction checks
6. Route — ≥0.92 confidence → auto, <0.92 → human review
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

TOP_FTS        = 20
MIN_CANDIDATES = 5
TOP_RESULTS    = 3
MAX_WORKERS    = 4

# ── Synonym / vocabulary bridge ───────────────────────────────────────────────
_SYNONYMS: dict = {
    # Mobile / telecom
    "smartphone":   "telephone cellular wireless network",
    "iphone":       "telephone cellular wireless network",
    "android":      "telephone cellular wireless network",
    "mobile phone": "telephone cellular wireless network",
    "cell phone":   "telephone cellular wireless network",
    "feature phone":"telephone sets",
    # Computers
    "laptop":       "portable automatic data processing machine",
    "notebook":     "portable automatic data processing machine",
    "macbook":      "portable automatic data processing machine",
    "chromebook":   "portable automatic data processing machine",
    "ultrabook":    "portable automatic data processing machine",
    "desktop":      "automatic data processing machine",
    "pc":           "automatic data processing machine",
    # Tablets
    "ipad":         "tablet automatic data processing machine",
    "tablet":       "automatic data processing machine input output unit",
    # Wearables
    "smartwatch":   "watch wrist electronic",
    "fitness band": "watch wrist electronic",
    # Audio/video
    "headphone":    "headphone microphone loudspeaker sound",
    "earphone":     "headphone microphone loudspeaker sound",
    "earbuds":      "headphone microphone loudspeaker sound",
    "airpods":      "headphone microphone loudspeaker sound",
    "speaker":      "loudspeaker",
    "television":   "television reception apparatus",
    "tv":           "television reception apparatus",
    "smart tv":     "television reception apparatus",
    # Storage
    "ssd":          "solid state storage unit data processing",
    "hard disk":    "magnetic disk storage unit data processing",
    "hard drive":   "magnetic disk storage unit data processing",
    "pendrive":     "flash memory storage",
    "usb drive":    "flash memory storage",
    # Cameras
    "dslr":         "camera photographic",
    "mirrorless":   "camera photographic",
    "webcam":       "camera photographic",
    # Power
    "power bank":   "electric accumulator battery",
    "charger":      "electric transformer rectifier",
    "adapter":      "electric transformer rectifier",
    # Networking
    "router":       "network transmission apparatus",
    "modem":        "network transmission apparatus",
    "wifi":         "wireless transmission apparatus",
}


def _expand_query(query: str):
    lower = query.lower()
    matched: list = []
    for term, expansion in sorted(_SYNONYMS.items(), key=lambda x: -len(x[0])):
        if term in lower:
            matched.append(expansion)
    if matched:
        db_query = " ".join(matched)
        logger.debug("Query bridged: %r → DB search: %r", query, db_query)
        return query, db_query
    return query, query


def _db_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql://postgres:PRATHAM@localhost:5432/orbisporte_db")
    return url.replace("postgresql+psycopg2://", "postgresql://", 1)


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Stage 1: PostgreSQL candidate retrieval (optimized with connection pool) ────

_conn_cache = None

def _get_conn():
    global _conn_cache
    if _conn_cache is None:
        _conn_cache = psycopg2.connect(_db_url())
    return _conn_cache


def _fetch_candidates(query: str) -> List[Dict[str, Any]]:
    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        seen: dict = {}

        # FTS query with optimized ranking
        cur.execute("""
            SELECT
                hsn_code, description, chapter, chapter_name, policy,
                ts_rank(
                    to_tsvector('english',
                        COALESCE(description,'') || ' ' ||
                        COALESCE(hs4,'')         || ' ' ||
                        COALESCE(hs5,'')
                    ),
                    plainto_tsquery('english', %s)
                ) AS rank,
                COALESCE(length(description), 0) as desc_len
            FROM hsn_codes
            WHERE to_tsvector('english',
                      COALESCE(description,'') || ' ' ||
                      COALESCE(hs4,'')         || ' ' ||
                      COALESCE(hs5,'')
                  ) @@ plainto_tsquery('english', %s)
            ORDER BY rank DESC, desc_len ASC
            LIMIT %s
        """, (query, query, TOP_FTS))

        for r in cur.fetchall():
            seen[r["hsn_code"]] = dict(r)

        fts_count = len(seen)

        # ILIKE per keyword (parallel execution potential)
        keywords = [w for w in query.split() if len(w) > 2]
        if keywords:
            like_clauses = " OR ".join(["description ILIKE %s"] * len(keywords))
            like_params = [f"%{kw}%" for kw in keywords]
            cur.execute(
                f"""
                SELECT hsn_code, description, chapter, chapter_name, policy,
                       0.0::float AS rank
                FROM hsn_codes
                WHERE {like_clauses}
                LIMIT %s
                """,
                like_params + [TOP_FTS],
            )
            for r in cur.fetchall():
                if r["hsn_code"] not in seen:
                    seen[r["hsn_code"]] = dict(r)

        cur.close()
        rows = list(seen.values())
        logger.info(
            "PostgreSQL: FTS=%d  ILIKE=%d  total=%d candidates for: %.60s",
            fts_count, len(rows) - fts_count, len(rows), query,
        )
        return rows
    except Exception:
        conn.rollback()
        raise


# ── Stage 2: OpenAI embed + cosine rank ─────────────────────────────────────

def _embed_texts(texts: List[str]) -> List[List[float]]:
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY is not set")
    client = OpenAI(api_key=api_key)
    response = client.embeddings.create(
        input=texts,
        model="text-embedding-3-small",
    )
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


def _rank_by_similarity(query: str, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not candidates:
        return []
    texts = [query] + [c["description"] or "" for c in candidates]
    embeddings = _embed_texts(texts)
    query_emb = embeddings[0]
    candidate_embs = embeddings[1:]
    for i, candidate in enumerate(candidates):
        candidate["similarity"] = round(_cosine(query_emb, candidate_embs[i]), 4)
    return sorted(candidates, key=lambda c: c["similarity"], reverse=True)


# ── Stage 3: Gemini 3.1 Flash GRI reasoning ─────────────────────────────────

_GRI_PROMPT = """\
You are a Senior Indian Customs HSN Tariff Classification Specialist.

## Product Description
{product_description}

## Top Candidate HSN Codes
{candidates_text}

## Task
Select the BEST 3 HSN codes. Apply WCO GRI rules (GRI 1, GRI 3, GRI 6).

Return ONLY valid JSON:
{{"top3": [{{"hsn_code": "XXXXXXXX", "confidence": 0.XX, "reasoning": "...", "gri_rule": "GRI X"}}]}}"""


def _classify_with_gemini(product_description: str, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    import google.genai as genai
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY is not set")
    
    client = genai.Client(api_key=api_key)

    candidates_text = "\n".join(
        f"{i+1}. HSN {c['hsn_code']:8s} | sim={float(c.get('similarity',0)):.3f} | {c['description']}"
        for i, c in enumerate(candidates[:10])
    )

    prompt = _GRI_PROMPT.format(
        product_description=product_description,
        candidates_text=candidates_text,
    )

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
        }
    )
    return json.loads(response.text)


# Backward compatibility alias
_classify_with_gpt = _classify_with_gemini


# ── Stage 4: Post-process rule engine ────────────────────────────────────────

def _post_process(predictions: List[Dict], country_of_origin: Optional[str] = None) -> Dict[str, Any]:
    from Orbisporte.domain.services.m03_classification.post_processor import post_process
    return post_process(predictions, country_of_origin)


# ════════════════════════════════════════════════════════════════════════════
# FAST MODE — PostgreSQL FTS only, returns in <100ms
# ════════════════════════════════════════════════════════════════════════════

def classify_hsn_fast(product_description: str) -> Dict[str, Any]:
    """
    Fast HSN classification using PostgreSQL FTS only.
    Returns results in <100ms without API calls.
    """
    t0 = time.time()
    query = product_description.strip()
    if not query:
        return {"error": "product_description is required"}

    original_query, db_query = _expand_query(query)

    try:
        candidates = _fetch_candidates(db_query)
    except Exception as exc:
        # Common first-run scenario: HSN dataset table not loaded yet.
        # Fall back to the lightweight, file-backed lookup so the UI workflow remains usable.
        logger.error("PostgreSQL fetch failed: %s", exc)
        try:
            from Orbisporte.domain.services.simple_hscode_lookup import get_simple_hscode_lookup

            simple = get_simple_hscode_lookup().get_hs_code_details(original_query)
            hs_code = str(simple.get("hs_code") or "").replace(".", "").strip()
            found = bool(simple.get("found")) and bool(hs_code)
            confidence = float(simple.get("confidence") or 0.0)

            top3_predictions = []
            if found:
                top3_predictions = [
                    {
                        "hsn_code": hs_code,
                        "description": simple.get("description") or "",
                        "confidence": confidence,
                        "reasoning": f"Matched by {simple.get('method', 'simple_lookup')}",
                        "gri_rule": "GRI 1",
                        "chapter": simple.get("chapter"),
                        "chapter_name": None,
                        "policy": None,
                    }
                ]

            duration_ms = int((time.time() - t0) * 1000)
            routing = "auto" if confidence >= 0.85 and found else "human_review"

            return {
                "product_description": original_query,
                "selected_hsn": hs_code if found else None,
                "selected_confidence": confidence if found else 0.0,
                "overall_confidence": confidence if found else 0.0,
                "top3_predictions": top3_predictions,
                "candidates_retrieved": len(top3_predictions),
                "routing": routing,
                "method": "simple_lookup",
                "pipeline_duration_ms": duration_ms,
                "message": simple.get("note") or ("No candidates found." if not found else None),
                "top_result": {"hsn_code": hs_code, "similarity": confidence} if found else None,
                "hs_code": hs_code if found else None,
            }
        except Exception as fallback_exc:
            logger.error("Simple HS lookup fallback failed: %s", fallback_exc)
            return {"error": f"Database error: {exc}"}

    if not candidates:
        return {
            "product_description": original_query,
            "selected_hsn": None,
            "selected_confidence": 0.0,
            "overall_confidence": 0.0,
            "top3_predictions": [],
            "candidates_retrieved": 0,
            "routing": "human_review",
            "method": "postgres_fts",
            "pipeline_duration_ms": int((time.time() - t0) * 1000),
            "message": "No candidates found.",
        }

    # Normalize FTS rank to 0-1 confidence scale
    max_rank = max((c.get("rank", 0) for c in candidates), default=1)
    for c in candidates:
        raw_rank = float(c.get("rank", 0))
        c["similarity"] = round(min(raw_rank / max_rank if max_rank > 0 else 0, 1.0), 4)
        c["confidence"] = c["similarity"]

    top3_predictions = [
        {
            "hsn_code": c["hsn_code"],
            "description": c["description"],
            "confidence": c["confidence"],
            "reasoning": f"Matched by keyword similarity in Chapter {c.get('chapter', 'N/A')}",
            "gri_rule": "GRI 1",
            "chapter": c.get("chapter"),
            "chapter_name": c.get("chapter_name"),
            "policy": c.get("policy"),
        }
        for c in candidates[:TOP_RESULTS]
    ]

    duration_ms = int((time.time() - t0) * 1000)
    selected = top3_predictions[0] if top3_predictions else {}
    confidence = float(selected.get("confidence", 0))
    
    # Auto-route high confidence matches
    routing = "auto" if confidence >= 0.85 else "human_review"

    logger.info("[FAST] HSN=%s conf=%.2f dur=%dms", selected.get("hsn_code"), confidence, duration_ms)

    return {
        "product_description": original_query,
        "selected_hsn": selected.get("hsn_code"),
        "selected_confidence": confidence,
        "overall_confidence": confidence,
        "top3_predictions": top3_predictions,
        "candidates_retrieved": len(candidates),
        "routing": routing,
        "method": "postgres_fts",
        "pipeline_duration_ms": duration_ms,
        "top_result": {"hsn_code": selected.get("hsn_code"), "similarity": confidence},
        "hs_code": selected.get("hsn_code"),
    }


# ════════════════════════════════════════════════════════════════════════════
# FULL MODE — PostgreSQL FTS + OpenAI + GPT-4o-mini (accurate but slower)
# ════════════════════════════════════════════════════════════════════════════

def classify_hsn_full(
    product_description: str,
    country_of_origin: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full HSN classification pipeline with Gemini 3.1 Flash reasoning.
    More accurate but takes 2-5 seconds.
    """
    t0 = time.time()
    query = product_description.strip()
    if not query:
        return {"error": "product_description is required"}

    original_query, db_query = _expand_query(query)

    try:
        candidates = _fetch_candidates(db_query)
    except Exception as exc:
        logger.error("PostgreSQL fetch failed: %s", exc)
        return {"error": f"Database error: {exc}"}

    if not candidates:
        return {
            "product_description": original_query,
            "selected_hsn": None,
            "selected_confidence": 0.0,
            "overall_confidence": 0.0,
            "top3_predictions": [],
            "candidates_retrieved": 0,
            "routing": "human_review",
            "scomet_flag": False,
            "trade_remedy_alert": False,
            "method": "postgres_fts+gemini",
            "pipeline_duration_ms": int((time.time() - t0) * 1000),
            "top_result": None,
            "hs_code": None,
        }

    # OpenAI cosine re-rank
    try:
        ranked = _rank_by_similarity(original_query, candidates)
    except Exception as exc:
        logger.warning("OpenAI ranking failed (%s) — using FTS rank", exc)
        ranked = candidates
        for c in ranked:
            c["similarity"] = round(float(c.get("rank", 0)), 4)

    # Gemini 3.1 Flash reasoning
    try:
        llm_result = _classify_with_gemini(original_query, ranked)
        top3_raw = llm_result.get("top3", [])
        notes = llm_result.get("classification_notes", "")
    except Exception as exc:
        logger.warning("Gemini 3.1 Flash failed (%s) — using similarity ranking", exc)
        top3_raw = [
            {
                "hsn_code": r["hsn_code"],
                "confidence": r.get("similarity", 0.0),
                "reasoning": r.get("description", ""),
                "gri_rule": "GRI 1",
            }
            for r in ranked[:3]
        ]
        notes = "Gemini unavailable — ranked by semantic similarity."

    # Normalize HSN codes
    for pred in top3_raw:
        pred["hsn_code"] = str(pred.get("hsn_code", "")).replace(".", "").strip()

    # Post-process
    try:
        validated = _post_process(top3_raw, country_of_origin)
        top3_predictions = validated.get("predictions", top3_raw)
        scomet_flag = validated.get("scomet_flag", False)
        trade_remedy = validated.get("trade_remedy_alert", False)
        restricted = validated.get("restricted_countries", [])
    except Exception as exc:
        logger.warning("Post-processor failed (%s)", exc)
        top3_predictions = top3_raw
        scomet_flag = False
        trade_remedy = False
        restricted = []

    # Routing
    top1 = top3_predictions[0] if top3_predictions else {}
    confidence = float(top1.get("confidence", 0.0))
    routing = "auto" if confidence >= 0.92 else "human_review"
    selected = top1.get("hsn_code")

    duration_ms = int((time.time() - t0) * 1000)
    logger.info("[FULL] HSN=%s conf=%.2f routing=%s dur=%dms", selected, confidence, routing, duration_ms)

    return {
        "product_description": original_query,
        "selected_hsn": selected,
        "selected_confidence": confidence,
        "overall_confidence": confidence,
        "top3_predictions": top3_predictions,
        "candidates_retrieved": len(candidates),
        "classification_notes": notes,
        "routing": routing,
        "scomet_flag": scomet_flag,
        "trade_remedy_alert": trade_remedy,
        "restricted_countries": restricted,
        "method": "postgres_fts+gemini",
        "pipeline_duration_ms": duration_ms,
        "top_result": {"hsn_code": selected, "similarity": confidence} if selected else None,
        "hs_code": selected,
    }


# ════════════════════════════════════════════════════════════════════════════
# UNIFIED API — chooses fast or full based on use_agentic flag
# ════════════════════════════════════════════════════════════════════════════

def classify_hsn(
    product_description: str,
    country_of_origin: Optional[str] = None,
    use_agentic: bool = False,
) -> Dict[str, Any]:
    """
    Main entry point. Chooses fast or full mode based on use_agentic flag.
    
    Args:
        product_description: Product name/description
        country_of_origin: Optional country code for trade checks
        use_agentic: If True, use GPT-4o-mini for detailed reasoning (slower)
                    If False, use fast PostgreSQL FTS mode (<100ms)
    """
    if use_agentic:
        return classify_hsn_full(product_description, country_of_origin)
    else:
        return classify_hsn_fast(product_description)


# Alias for backward compatibility
search_hsn = classify_hsn_fast
