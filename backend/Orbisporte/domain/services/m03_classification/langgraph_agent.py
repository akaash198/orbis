"""
M03 LangGraph Agent — Multi-step HSN classification workflow.

Why LangGraph?
  - Explicit state machine: every stage is a named node → easy to trace/debug
  - Conditional retry: if LLM call fails, retry up to MAX_RETRIES before
    falling through to human_review (graceful degradation, never crashes)
  - Human-in-the-loop ready: graph can be extended with interrupt() for
    SOP HSN-003 human handoff without restructuring the code
  - Separation of concerns: each node is a pure function, independently testable

Workflow
--------
  normalize ──► embed ──► retrieve ──► classify ──► post_process ──► route ──► END
                  │                        │
                 fail                   retry (≤2)
                  │                        │
                 END                    fail → END
"""

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

logger = logging.getLogger(__name__)

MAX_RETRIES   = 2
AUTO_THRESHOLD = 0.92   # SOP HSN-003: top-1 confidence >= 0.92 → auto-classify


# ── Shared state schema ───────────────────────────────────────────────────────

class M03State(TypedDict):
    # ─ Input
    product_description: str
    country_of_origin:   Optional[str]
    document_id:         Optional[int]

    # ─ Intermediate
    normalized_text:   str
    detected_language: str
    embedding:         Optional[List[float]]
    candidates:        List[Dict[str, Any]]

    # ─ LLM output
    top3_predictions:     List[Dict[str, Any]]
    classification_notes: str

    # ─ Post-processed
    validated: Dict[str, Any]

    # ─ Routing
    overall_confidence: float
    routing:            str     # "auto" | "human_review"

    # ─ Control flow
    retry_count:   int
    error:         Optional[str]
    stage_timings: Dict[str, int]   # ms per stage


# ── Agent factory ─────────────────────────────────────────────────────────────

def build_agent(openai_client):
    """
    Build and compile the M03 LangGraph state machine.

    Parameters
    ----------
    openai_client : Initialised OpenAI client (passed in to allow DI / testing)

    Returns
    -------
    Compiled LangGraph runnable (call with .invoke(initial_state))
    """

    # ── Nodes ─────────────────────────────────────────────────────────────────

    def node_normalize(state: M03State) -> dict:
        """Stage 1: XLM-RoBERTa multilingual normalisation."""
        from .multilingual import normalize_text
        t0 = time.time()
        try:
            normalized, lang = normalize_text(state["product_description"])
            return {
                "normalized_text":   normalized,
                "detected_language": lang,
                "stage_timings": {
                    **state.get("stage_timings", {}),
                    "normalize_ms": int((time.time() - t0) * 1000),
                },
            }
        except Exception as exc:
            logger.warning("Normalize failed (non-fatal): %s", exc)
            # Fall back to raw input — pipeline continues
            return {
                "normalized_text":   state["product_description"],
                "detected_language": "en",
            }

    def node_embed_and_retrieve(state: M03State) -> dict:
        """
        Stage 2+3 combined: run OpenAI embedding and PostgreSQL FTS in parallel.

        - Embedding (OpenAI ~300ms) and FTS retrieval (PostgreSQL ~10ms) are
          independent so they execute concurrently via ThreadPoolExecutor.
        - When pgvector is available the embedding is used for ANN search.
        - When pgvector is absent the FTS candidates are cosine-ranked by embedding.
        """
        from .embedder import get_embedding
        from .retriever import retrieve_candidates, _pgvector_available, _retrieve_postgres_fts, TOP_K_DEFAULT

        t0           = time.time()
        normalized   = state.get("normalized_text", "")
        embedding    = None
        candidates   = []
        embed_error  = None

        def _do_embed():
            return get_embedding(normalized)

        def _do_fts():
            # Pre-fetch FTS candidates so they are ready when embedding arrives
            return _retrieve_postgres_fts(normalized, TOP_K_DEFAULT)

        use_pgvector = _pgvector_available()

        if use_pgvector:
            # pgvector path: only need the embedding
            try:
                embedding  = _do_embed()
                candidates = retrieve_candidates(embedding, normalized_text=normalized)
            except Exception as exc:
                embed_error = str(exc)
                logger.error("pgvector path failed: %s", exc)
        else:
            # FTS path: run embedding + FTS in parallel
            with ThreadPoolExecutor(max_workers=2) as pool:
                f_embed = pool.submit(_do_embed)
                f_fts   = pool.submit(_do_fts)

                fts_candidates = []
                try:
                    fts_candidates = f_fts.result()
                except Exception as exc:
                    logger.error("FTS retrieval failed: %s", exc)

                try:
                    embedding = f_embed.result()
                except Exception as exc:
                    embed_error = str(exc)
                    logger.error("Embedding failed: %s", exc)

            # Cosine re-rank FTS results with the embedding
            if embedding and fts_candidates:
                from .retriever import _cosine_rerank
                candidates = _cosine_rerank(embedding, fts_candidates)
            else:
                candidates = fts_candidates

        elapsed = int((time.time() - t0) * 1000)
        logger.info("embed+retrieve: %d candidates in %dms (pgvector=%s)",
                    len(candidates), elapsed, use_pgvector)

        if embed_error and not candidates:
            return {"embedding": None, "candidates": [], "error": f"Embedding failed: {embed_error}"}

        return {
            "embedding":  embedding,
            "candidates": candidates,
            "stage_timings": {
                **state.get("stage_timings", {}),
                "embed_retrieve_ms": elapsed,
            },
        }

    def node_classify(state: M03State) -> dict:
        """Stage 4: GPT-4o-mini chain-of-thought over candidates."""
        from .llm_classifier import classify
        t0 = time.time()
        try:
            result = classify(
                state["normalized_text"],
                state["candidates"],
                openai_client,
            )
            return {
                "top3_predictions":     result.get("top3", []),
                "classification_notes": result.get("classification_notes", ""),
                "error": None,
                "stage_timings": {
                    **state.get("stage_timings", {}),
                    "classify_ms": int((time.time() - t0) * 1000),
                },
            }
        except Exception as exc:
            logger.warning(
                "LLM classify failed (attempt %d): %s",
                state.get("retry_count", 0) + 1, exc
            )
            return {
                "error":       f"Classification failed: {exc}",
                "retry_count": state.get("retry_count", 0) + 1,
            }

    def node_post_process(state: M03State) -> dict:
        """Stage 5: SCOMET / trade remedy / country restriction checks."""
        from .post_processor import post_process
        t0 = time.time()
        try:
            validated = post_process(
                state["top3_predictions"],
                state.get("country_of_origin"),
            )
        except Exception as exc:
            logger.warning("Post-processor failed (non-fatal): %s", exc)
            validated = {
                "predictions":          state["top3_predictions"],
                "scomet_flag":          False,
                "trade_remedy_alert":   False,
                "restricted_countries": [],
            }
        return {
            "validated": validated,
            "stage_timings": {
                **state.get("stage_timings", {}),
                "post_process_ms": int((time.time() - t0) * 1000),
            },
        }

    def node_route(state: M03State) -> dict:
        """Stage 6: SOP HSN-003 confidence threshold routing."""
        preds      = state.get("top3_predictions", [])
        top1_conf  = float(preds[0].get("confidence", 0.0)) if preds else 0.0
        routing    = "auto" if top1_conf >= AUTO_THRESHOLD else "human_review"

        logger.info(
            "M03 routing: top1_conf=%.3f → %s", top1_conf, routing
        )
        return {
            "overall_confidence": top1_conf,
            "routing":            routing,
        }

    # ── Conditional edge functions ────────────────────────────────────────────

    def after_embed_and_retrieve(state: M03State) -> str:
        """Skip classification if no candidates were retrieved."""
        if state.get("error") and not state.get("candidates"):
            return "fail"
        if not state.get("candidates"):
            return "fail"
        return "ok"

    def after_classify(state: M03State) -> str:
        """Retry classification on transient LLM errors (max MAX_RETRIES)."""
        if state.get("error"):
            if state.get("retry_count", 0) < MAX_RETRIES:
                return "retry"
            return "fail"
        return "ok"

    # ── Build graph ───────────────────────────────────────────────────────────

    graph = StateGraph(M03State)

    graph.add_node("normalize",          node_normalize)
    graph.add_node("embed_and_retrieve", node_embed_and_retrieve)
    graph.add_node("classify",           node_classify)
    graph.add_node("post_process",       node_post_process)
    graph.add_node("route",              node_route)

    graph.set_entry_point("normalize")
    graph.add_edge("normalize", "embed_and_retrieve")

    graph.add_conditional_edges(
        "embed_and_retrieve",
        after_embed_and_retrieve,
        {"ok": "classify", "fail": END},
    )

    graph.add_conditional_edges(
        "classify",
        after_classify,
        {"ok": "post_process", "retry": "classify", "fail": END},
    )

    graph.add_edge("post_process", "route")
    graph.add_edge("route",        END)

    return graph.compile()
