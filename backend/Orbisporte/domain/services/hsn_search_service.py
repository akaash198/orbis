"""
HSN Classification Service — PostgreSQL FTS + OpenAI embeddings + GPT-4o-mini.

Pipeline
--------
  1. Synonym expansion — bridge modern product names to ITC(HS) 2012 vocabulary
  2. PostgreSQL FTS    — to_tsvector / plainto_tsquery, up to 20 candidates
  3. ILIKE widening    — keyword fallback for names not in FTS index
  4. OpenAI embed      — text-embedding-3-small cosine re-rank of candidates
  5. GPT-4o-mini       — GRI chain-of-thought reasoning over top-10 candidates
                         → top-3 HSN codes with confidence + reasoning
  6. Post-process      — SCOMET / trade remedy / country restriction rule checks
  7. Route             — top-1 confidence ≥ 0.92 → auto-classify
                         top-1 confidence <  0.92 → human review queue
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

TOP_FTS        = 20    # candidates from PostgreSQL FTS
MIN_CANDIDATES = 5     # if FTS returns fewer, widen with ILIKE
TOP_RESULTS    = 3     # final results returned to caller

# ── Synonym / vocabulary bridge ───────────────────────────────────────────────
# ITC(HS) 2012 uses pre-smartphone trade vocabulary. Map modern consumer product
# names to the equivalent ITC(HS) terms so FTS/ILIKE can find candidates.
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
    """
    Map consumer product names to ITC(HS) vocabulary terms.

    Returns (original_query, db_search_query) where:
      - original_query   : what the user typed (used for OpenAI similarity)
      - db_search_query  : ITC(HS) vocabulary terms (used for FTS / ILIKE)

    When no synonym matches, both are the same string so the normal
    FTS path runs unchanged (e.g. searching "cotton yarn" directly).
    """
    lower = query.lower()
    matched: list = []
    for term, expansion in sorted(_SYNONYMS.items(), key=lambda x: -len(x[0])):
        if term in lower:
            matched.append(expansion)

    if matched:
        # Use ONLY the ITC(HS) expansion terms for DB search so brand
        # syllables like "Pro" never pollute the ILIKE keyword list.
        db_query = " ".join(matched)
        logger.debug("Query bridged: %r → DB search: %r", query, db_query)
        return query, db_query

    return query, query


def _db_url() -> str:
    url = os.getenv("DATABASE_URL", "postgresql://postgres:PRATHAM@localhost:5432/orbisporte_db")
    return url.replace("postgresql+psycopg2://", "postgresql://", 1)


def _cosine(a: List[float], b: List[float]) -> float:
    dot  = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── Stage 1: PostgreSQL candidate retrieval ───────────────────────────────────

def _fetch_candidates(query: str) -> List[Dict[str, Any]]:
    """
    Query hsn_codes using both FTS and ILIKE simultaneously, merge results.

    Two PostgreSQL queries run on every search:
      1. FTS  (to_tsvector / plainto_tsquery) — high-precision, ranked by ts_rank
      2. ILIKE per keyword                    — high-recall, catches product names
         not present verbatim in HSN descriptions (e.g. "laptop" → "Personal computer")

    Results are merged (deduped by hsn_code) so OpenAI sees the widest
    relevant candidate set before cosine re-ranking.
    """
    conn = psycopg2.connect(_db_url())
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        seen: dict = {}

        # ── Query 1: Full-text search ─────────────────────────────────────────
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
                ) AS rank
            FROM hsn_codes
            WHERE to_tsvector('english',
                      COALESCE(description,'') || ' ' ||
                      COALESCE(hs4,'')         || ' ' ||
                      COALESCE(hs5,'')
                  ) @@ plainto_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
        """, (query, query, TOP_FTS))

        for r in cur.fetchall():
            seen[r["hsn_code"]] = dict(r)

        fts_count = len(seen)

        # ── Query 2: ILIKE per keyword ────────────────────────────────────────
        keywords = [w for w in query.split() if len(w) > 2]
        if keywords:
            like_clauses = " OR ".join(["description ILIKE %s"] * len(keywords))
            like_params  = [f"%{kw}%" for kw in keywords]
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

        ilike_count = len(seen) - fts_count

        cur.close()
        rows = list(seen.values())
        logger.info(
            "PostgreSQL: FTS=%d  ILIKE=%d  total=%d candidates for: %.60s",
            fts_count, ilike_count, len(rows), query,
        )
        return rows

    finally:
        conn.close()


# ── Stage 2 & 3: OpenAI embed + cosine rank ───────────────────────────────────

def _embed_texts(texts: List[str]) -> List[List[float]]:
    """Batch-embed texts with OpenAI text-embedding-3-small."""
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


def _rank_by_similarity(
    query: str,
    candidates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Embed query + candidate descriptions, compute cosine similarity,
    return candidates sorted by similarity descending.
    """
    if not candidates:
        return []

    texts = [query] + [c["description"] or "" for c in candidates]
    embeddings = _embed_texts(texts)

    query_emb      = embeddings[0]
    candidate_embs = embeddings[1:]

    for i, candidate in enumerate(candidates):
        candidate["similarity"] = round(_cosine(query_emb, candidate_embs[i]), 4)

    return sorted(candidates, key=lambda c: c["similarity"], reverse=True)


# ── Public API ────────────────────────────────────────────────────────────────

def search_hsn(product_description: str) -> Dict[str, Any]:
    """
    Search HSN codes for a product description using PostgreSQL + OpenAI.

    Returns
    -------
    {
      query: str,
      top_result: { hsn_code, description, chapter, chapter_name, policy, similarity },
      top3: [ ... ],
      candidates_retrieved: int,
      method: "postgres_fts+openai_similarity"
    }
    """
    query = product_description.strip()
    if not query:
        return {"error": "product_description is required"}

    # Bridge consumer product names → ITC(HS) vocabulary for DB search
    original_query, db_query = _expand_query(query)

    # Stage 1 — PostgreSQL (search with ITC(HS) terms)
    try:
        candidates = _fetch_candidates(db_query)
    except Exception as exc:
        logger.error("PostgreSQL candidate fetch failed: %s", exc)
        return {"error": f"Database error: {exc}"}

    if not candidates:
        return {
            "query":               original_query,
            "top_result":          None,
            "top3":                [],
            "candidates_retrieved": 0,
            "method":              "postgres_fts+openai_similarity",
            "message":             "No candidates found in HSN database for this description.",
        }

    # Stage 2 & 3 — OpenAI embed + cosine rank (use original query for accuracy)
    try:
        ranked = _rank_by_similarity(original_query, candidates)
    except Exception as exc:
        logger.error("OpenAI similarity ranking failed: %s", exc)
        # Fall back to FTS rank order if OpenAI fails
        ranked = candidates
        for c in ranked:
            c["similarity"] = round(float(c.get("rank", 0)), 4)

    top3 = [
        {
            "hsn_code":    r["hsn_code"],
            "description": r["description"],
            "chapter":     r["chapter"],
            "chapter_name": r.get("chapter_name") or "",
            "policy":      r.get("policy") or "Free",
            "similarity":  r.get("similarity", 0.0),
        }
        for r in ranked[:TOP_RESULTS]
    ]

    return {
        "query":               original_query,
        "top_result":          top3[0] if top3 else None,
        "top3":                top3,
        "candidates_retrieved": len(candidates),
        "method":              "postgres_fts+openai_similarity",
    }


# ── Stage 4: GPT-4o-mini GRI reasoning ───────────────────────────────────────

_GRI_PROMPT = """\
You are a Senior Indian Customs HSN Tariff Classification Specialist with 20+ years of experience \
classifying goods under the Indian Customs Tariff (WCO Harmonized System 2022).

## Product Description
{product_description}

## Top Candidate HSN Codes (retrieved by semantic similarity from ITC(HS) 2012)
{candidates_text}

## Task
Analyse the product description and select the BEST 3 HSN codes from the candidates above.

Apply WCO General Rules of Interpretation (GRI) in strict order:
- GRI 1: Classify by terms of the heading and section/chapter notes
- GRI 3: Most specific description wins; essential character rule
- GRI 6: Sub-heading level classification

For each selection provide:
1. The exact 8-digit HSN code (from the candidates list only)
2. A confidence score (0.00–1.00)
3. One sentence explaining WHY this code applies
4. Which GRI rule was decisive

Confidence scale:
- 0.92–1.00: Unambiguous single correct code
- 0.75–0.91: Highly likely, minor uncertainty
- 0.50–0.74: Probable, plausible alternatives exist
- Below 0.50: Cannot classify reliably, expert review required

Return ONLY valid JSON:
{{
  "top3": [
    {{"hsn_code": "XXXXXXXX", "confidence": 0.XX, "reasoning": "...", "gri_rule": "GRI 1"}}
  ],
  "classification_notes": "Any chapter exclusions, ambiguities, or additional guidance"
}}"""


def _classify_with_gpt(product_description: str, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run GPT-4o-mini chain-of-thought reasoning over the top candidates."""
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY is not set")
    client = OpenAI(api_key=api_key)

    candidates_text = "\n".join(
        f"{i+1:2d}. HSN {c['hsn_code']:8s} | sim={float(c.get('similarity',0)):.3f} | {c['description']}"
        for i, c in enumerate(candidates[:10])
    )

    prompt = _GRI_PROMPT.format(
        product_description=product_description,
        candidates_text=candidates_text,
    )

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=1024,
    )

    result = json.loads(resp.choices[0].message.content)
    top3   = result.get("top3", [])
    logger.info("GPT-4o-mini: top-1 HSN=%s conf=%.2f",
                top3[0].get("hsn_code") if top3 else "N/A",
                top3[0].get("confidence", 0) if top3 else 0)
    return result


# ── Stage 5: Post-process rule engine ────────────────────────────────────────

def _post_process(predictions: List[Dict], country_of_origin: Optional[str] = None) -> Dict[str, Any]:
    """Apply SCOMET / trade remedy / country restriction checks."""
    from Orbisporte.domain.services.m03_classification.post_processor import post_process
    return post_process(predictions, country_of_origin)


# ── Public API: full classification pipeline ──────────────────────────────────

AUTO_THRESHOLD = 0.92


def classify_hsn(
    product_description: str,
    country_of_origin: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full HSN classification pipeline.

    Flow: synonym expand → PostgreSQL FTS/ILIKE → OpenAI cosine rank
          → GPT-4o-mini GRI reasoning → SCOMET/trade checks → route

    Returns M03-compatible response dict.
    """
    t0    = time.time()
    query = product_description.strip()
    if not query:
        return {"error": "product_description is required"}

    # Stage 1 — synonym expansion
    original_query, db_query = _expand_query(query)

    # Stage 2 — PostgreSQL candidate retrieval
    try:
        candidates = _fetch_candidates(db_query)
    except Exception as exc:
        logger.error("PostgreSQL fetch failed: %s", exc)
        return {"error": f"Database error: {exc}", "selected_hsn": None, "top3_predictions": []}

    if not candidates:
        return {
            "product_description":  original_query,
            "selected_hsn":         None,
            "selected_confidence":  0.0,
            "overall_confidence":   0.0,
            "top3_predictions":     [],
            "candidates_retrieved": 0,
            "routing":              "human_review",
            "scomet_flag":          False,
            "trade_remedy_alert":   False,
            "restricted_countries": [],
            "classification_notes": "No candidates found. Try a more specific product description.",
            "pipeline_duration_ms": int((time.time() - t0) * 1000),
            "top_result":           None,
            "hs_code":              None,
        }

    # Stage 3 — OpenAI cosine re-rank
    try:
        ranked = _rank_by_similarity(original_query, candidates)
    except Exception as exc:
        logger.warning("OpenAI similarity failed (%s) — using FTS rank order", exc)
        ranked = candidates
        for c in ranked:
            c["similarity"] = round(float(c.get("rank", 0)), 4)

    # Stage 4 — GPT-4o-mini GRI reasoning
    try:
        llm_result = _classify_with_gpt(original_query, ranked)
        top3_raw   = llm_result.get("top3", [])
        notes      = llm_result.get("classification_notes", "")
    except Exception as exc:
        logger.warning("GPT-4o-mini classification failed (%s) — using similarity ranking", exc)
        # Fallback: convert similarity scores to predictions without LLM reasoning
        top3_raw = [
            {
                "hsn_code":   r["hsn_code"],
                "confidence": r.get("similarity", 0.0),
                "reasoning":  r.get("description", ""),
                "gri_rule":   "GRI 1",
            }
            for r in ranked[:3]
        ]
        notes = "GPT-4o-mini unavailable — ranked by semantic similarity only."

    # Normalise HSN codes (remove dots)
    for pred in top3_raw:
        pred["hsn_code"] = str(pred.get("hsn_code", "")).replace(".", "").strip()

    # Stage 5 — post-process rule checks
    try:
        validated = _post_process(top3_raw, country_of_origin)
        top3_predictions = validated.get("predictions", top3_raw)
        scomet_flag      = validated.get("scomet_flag", False)
        trade_remedy     = validated.get("trade_remedy_alert", False)
        restricted       = validated.get("restricted_countries", [])
    except Exception as exc:
        logger.warning("Post-processor failed (%s) — skipping trade checks", exc)
        top3_predictions = top3_raw
        scomet_flag      = False
        trade_remedy     = False
        restricted       = []

    # Stage 6 — routing
    top1       = top3_predictions[0] if top3_predictions else {}
    confidence = float(top1.get("confidence", 0.0))
    routing    = "auto" if confidence >= AUTO_THRESHOLD else "human_review"
    selected   = top1.get("hsn_code")

    duration_ms = int((time.time() - t0) * 1000)
    logger.info("[classify_hsn] HSN=%s conf=%.2f routing=%s dur=%dms",
                selected, confidence, routing, duration_ms)

    return {
        "product_description":  original_query,
        "selected_hsn":         selected,
        "selected_confidence":  confidence,
        "overall_confidence":   confidence,
        "top3_predictions":     top3_predictions,
        "candidates_retrieved": len(candidates),
        "classification_notes": notes,
        "routing":              routing,
        "scomet_flag":          scomet_flag,
        "trade_remedy_alert":   trade_remedy,
        "restricted_countries": restricted,
        "pipeline_duration_ms": duration_ms,
        # backward-compat fields
        "top_result": {
            "hsn_code":   selected,
            "similarity": confidence,
        } if selected else None,
        "hs_code": selected,
    }
