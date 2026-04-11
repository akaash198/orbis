"""
M03 Classification Service — main orchestrator.

Pipeline
--------
  1. Normalize    – XLM-RoBERTa multilingual input normalisation
  2. Embed        – OpenAI text-embedding-3-small 1536-dim semantic vector
  3. Retrieve     – pgvector ANN top-10 HSN candidate codes
  4. Classify     – GPT-4o-mini chain-of-thought reasoning over candidates
  5. Post-process – SCOMET / trade remedy / country restriction rule engine
  6. Route        – top-1 confidence >= 0.92 → auto-classify (SOP HSN-003)
                    top-1 confidence <  0.92 → human expert review queue

Architecture: LangGraph state machine with retry + graceful degradation.
The agent is built once and reused across requests (singleton pattern).
"""

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class M03ClassificationService:

    def __init__(self, openai_client=None):
        if openai_client is None:
            from Orbisporte.infrastructure.get_llm import openai_client as _oc
            openai_client = _oc()
        self._client = openai_client
        self._agent  = None   # lazy-built LangGraph agent

    # ── Public API ────────────────────────────────────────────────────────────

    def classify(
        self,
        product_description: str,
        country_of_origin: Optional[str] = None,
        document_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Run the full M03 pipeline and return a structured result.

        Parameters
        ----------
        product_description : Free-text product description (any language)
        country_of_origin   : Optional country name or ISO-2 code
        document_id         : ProcessedDocuments.id for DB linking

        Returns
        -------
        Dict with keys:
            product_description, detected_language, normalized_description,
            top3_predictions, selected_hsn, selected_confidence,
            overall_confidence, routing, classification_notes,
            candidates_retrieved, scomet_flag, trade_remedy_alert,
            restricted_countries, pipeline_stages, pipeline_duration_ms, error
        """
        t0 = time.time()

        initial_state = {
            "product_description": product_description,
            "country_of_origin":   country_of_origin,
            "document_id":         document_id,
            # Intermediate (initialised empty)
            "normalized_text":     "",
            "detected_language":   "en",
            "embedding":           None,
            "candidates":          [],
            # Output
            "top3_predictions":     [],
            "classification_notes": "",
            "validated":            {},
            # Routing
            "overall_confidence": 0.0,
            "routing":            "human_review",
            # Control
            "retry_count":   0,
            "error":         None,
            "stage_timings": {},
        }

        agent = self._get_agent()
        final = agent.invoke(initial_state)

        duration_ms = int((time.time() - t0) * 1000)

        validated = final.get("validated", {})
        top3      = validated.get("predictions", final.get("top3_predictions", []))
        top1      = top3[0] if top3 else {}

        result = {
            "product_description":    product_description,
            "detected_language":      final.get("detected_language", "en"),
            "normalized_description": final.get("normalized_text", product_description),
            "top3_predictions":       top3,
            "selected_hsn":           top1.get("hsn_code"),
            "selected_confidence":    top1.get("confidence", 0.0),
            "overall_confidence":     final.get("overall_confidence", 0.0),
            "routing":                final.get("routing", "human_review"),
            "classification_notes":   final.get("classification_notes", ""),
            "candidates_retrieved":   len(final.get("candidates", [])),
            "scomet_flag":            validated.get("scomet_flag", False),
            "trade_remedy_alert":     validated.get("trade_remedy_alert", False),
            "restricted_countries":   validated.get("restricted_countries", []),
            "pipeline_stages":        final.get("stage_timings", {}),
            "pipeline_duration_ms":   duration_ms,
            "error":                  final.get("error"),
        }

        logger.info(
            "[M03] Complete in %dms — HSN=%s conf=%.2f routing=%s",
            duration_ms,
            result["selected_hsn"],
            result["selected_confidence"],
            result["routing"],
        )
        return result

    def classify_batch(
        self,
        items: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Classify a list of line-items (e.g. from an M02 extraction).
        Each item dict must have 'description'; optionally 'country_of_origin'.
        """
        results = []
        for item in items:
            try:
                r = self.classify(
                    product_description=item.get("description", ""),
                    country_of_origin=item.get("country_of_origin"),
                    document_id=item.get("document_id"),
                )
            except Exception as exc:
                logger.error("Batch classify item failed: %s", exc)
                r = {"error": str(exc), "selected_hsn": None, "routing": "human_review"}
            results.append(r)
        return results

    # ── Private ───────────────────────────────────────────────────────────────

    def _get_agent(self):
        """Build the LangGraph agent once and cache it."""
        if self._agent is None:
            from .langgraph_agent import build_agent
            self._agent = build_agent(self._client)
            logger.info("[M03] LangGraph agent compiled and cached.")
        return self._agent
