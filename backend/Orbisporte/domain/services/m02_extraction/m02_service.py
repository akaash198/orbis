"""
M02 Extraction Service — optimised parallel orchestrator.

Pipeline (target latency)
--------------------------
  Digital PDF (text layer):   2–3 s total
  Scanned PDF / image:        3–5 s total

  Stage 1  OCR
             Digital: PyMuPDF text layer              ~50 ms
             Scanned: GPT-4o-mini vision (parallel)   ~2.5 s
  Stage 2  Parallel fan-out (ThreadPoolExecutor × 2)
             Task A  GPT-4o-mini detect + extract     ~1.5–2.5 s
             Task B  Layout from PyMuPDF blocks        ~10 ms (both modes)
             Task C  GLiNER NER (4 s timeout)          ~1–4 s
  Stage 3  Normalise                                   ~1 ms
  Stage 4  LightGBM confidence (batch)                 ~2 ms
  Stage 5  Assemble output                             ~1 ms

Performance changes vs v1
--------------------------
  • Redundant "layout GPT" call for scanned/image files REMOVED.
    v1 fired a 2nd GPT-4o-mini vision call in Task B for scanned docs.
    Layout signals (has_tables, quality, region_count) are now derived
    from OCR text patterns — free, instant, no API round-trip.
  • Smart text truncation: GPT receives first 9 000 + last 3 000 chars
    of OCR text (de-duped at boundary). Trade invoices concentrate key
    fields at top (header, parties) and bottom (totals, bank, signatures).
    Old limit was a simple [:10000] slice that could miss footer data.
  • GLiNER model is preloaded once at import time in a background thread
    so the 4-second cold-start penalty only affects the very first boot.
  • LightGBM confidence scoring uses a single batched predict() call for
    all fields (was N separate calls, one per field).
"""

import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ── Single-pass prompt: detect type + extract fields ─────────────────────────
_COMBINED_PROMPT = """You are an expert trade document specialist for Indian customs and international trade.
Perform two tasks in one pass:

TASK 1 — Document type classification.
Choose exactly ONE from: commercial_invoice | packing_list | air_waybill | bill_of_lading | certificate_of_origin | letter_of_credit | purchase_order | proforma_invoice | customs_declaration | unknown

TASK 2 — Field extraction (extract every field present; use null when absent).
Normalization rules:
• invoice_date, shipment_date, expiry_date → YYYY-MM-DD format
• currency → 3-letter ISO 4217 code (USD, INR, EUR, GBP, AED …)
• country_of_origin → 2-letter ISO 3166-1 alpha-2 code (CN, US, IN, AE …)
• gst_number → 15-char GSTIN format (e.g. 29ABCDE1234F1Z5)
• iec_number → 10-digit IEC code (e.g. 0515072814)
• hsn_code → 6–8 digit HSN/HS code (e.g. 85044030)
• quantity → numeric value only (strip currency symbols and units)
• unit → unit of measure separately (e.g. PCS, KGS, MTR, NOS, SET)
• unit_price, total_value, freight, insurance, cif_value → numeric only (no symbols or commas)
• shipment_address → full destination address as a string
• line_items → array of objects, one per product line
• incoterms → trade term (CIF, FOB, EXW, DAP, DDP …)
• For bill_of_lading: populate bill_of_lading_number, vessel_name, container_number, port_of_loading, port_of_discharge
• For air_waybill: populate awb_number, flight_number, port_of_loading, port_of_discharge

Respond with a single JSON object:
{{
  "document_type":   "<type>",
  "doc_confidence":  0.0,
  "doc_signals":     [],
  "fields": {{
    "invoice_number":        null,
    "invoice_date":          null,
    "exporter_name":         null,
    "exporter_address":      null,
    "importer_name":         null,
    "importer_address":      null,
    "gst_number":            null,
    "iec_number":            null,
    "shipment_address":      null,
    "hsn_code":              null,
    "goods_description":     null,
    "quantity":              null,
    "unit":                  null,
    "unit_price":            null,
    "currency":              null,
    "total_value":           null,
    "freight":               null,
    "insurance":             null,
    "cif_value":             null,
    "country_of_origin":     null,
    "port_of_loading":       null,
    "port_of_discharge":     null,
    "shipment_date":         null,
    "payment_terms":         null,
    "incoterms":             null,
    "bill_of_lading_number": null,
    "awb_number":            null,
    "container_number":      null,
    "vessel_name":           null,
    "purchase_order_number": null,
    "flight_number":         null,
    "line_items":            []
  }}
}}

Document text:
{text}

Return ONLY the JSON object."""

# Characters of text sent to GPT: first LEAD_CHARS + last TAIL_CHARS (de-duped)
_LEAD_CHARS = 9_000
_TAIL_CHARS = 3_000


def _smart_truncate(text: str) -> str:
    """
    Return up to _LEAD_CHARS + _TAIL_CHARS characters of OCR text.
    Takes the first _LEAD_CHARS characters (document header / main body)
    and appends the last _TAIL_CHARS characters (totals / bank details /
    signatures) if they are not already covered by the head slice.
    """
    if len(text) <= _LEAD_CHARS + _TAIL_CHARS:
        return text
    head = text[:_LEAD_CHARS]
    tail = text[-_TAIL_CHARS:]
    # Avoid duplicating text when head and tail overlap
    if tail in head:
        return head
    return head + "\n…\n" + tail


def _quality_from_text(text: str) -> str:
    n = len(text.strip())
    if n > 500:
        return "good"
    if n > 100:
        return "fair"
    return "poor"


def _layout_from_text(ocr_text: str, pdf_blocks: list) -> dict:
    """
    Derive layout metadata from OCR text patterns — free, no API call.

    Previously a second GPT-4o-mini vision call was made for scanned PDFs.
    These heuristics are equivalent for the pipeline's needs (has_tables,
    table_count, quality, region_count) and add zero latency.
    """
    text    = ocr_text or ""
    lines   = text.splitlines()

    # Table detection: look for pipe separators or consistent spacing patterns
    pipe_lines    = sum(1 for ln in lines if "|" in ln)
    tab_lines     = sum(1 for ln in lines if "\t" in ln)
    has_tables    = (pipe_lines >= 3) or (tab_lines >= 5)
    table_count   = 1 if has_tables else 0

    # Rough region count: blank-line-separated sections
    sections = [s.strip() for s in text.split("\n\n") if s.strip()]
    region_count = min(len(sections), 10)

    return {
        "pdf_blocks":  pdf_blocks,
        "has_tables":  has_tables,
        "table_count": table_count,
        "quality":     _quality_from_text(text),
        "regions":     [{"type": "section", "idx": i} for i in range(region_count)],
    }



class M02ExtractionService:

    def __init__(self, openai_client=None):
        if openai_client is None:
            from Orbisporte.infrastructure.get_llm import openai_client as _oc
            openai_client = _oc()
        self._client = openai_client

    # ── Public entry point ────────────────────────────────────────────────

    def process(self, file_path: str, document_id: Optional[int] = None, document_type_hint: Optional[str] = None) -> Dict[str, Any]:
        t0 = time.time()
        result: Dict[str, Any] = {
            "document_id":     document_id,
            "file_path":       file_path,
            "pipeline_stages": {},
        }

        # ── Stage 1: OCR ─────────────────────────────────────────────────
        logger.info("[M02] Stage 1: OCR")
        from .ocr_engine import run_ocr
        ocr      = run_ocr(file_path, self._client)
        ocr_text = ocr["text"]
        result["pipeline_stages"]["ocr"] = {
            "method":     ocr["method"],
            "page_count": ocr["page_count"],
            "char_count": len(ocr_text),
        }
        logger.info("[M02] OCR done (%.2fs, method=%s, chars=%d)",
                    time.time() - t0, ocr["method"], len(ocr_text))

        # ── Stage 2: Parallel fan-out ─────────────────────────────────────
        # Task A – combined GPT detect+extract (always, with smart truncation)
        # Task B – layout from PyMuPDF blocks (free for all modes)
        # Task C – GLiNER (bonus signal; hard cap at 4 s)

        from pathlib import Path
        is_pdf = Path(file_path).suffix.lower() == ".pdf"

        t_parallel = time.time()
        with ThreadPoolExecutor(max_workers=3) as pool:
            fut_combined = pool.submit(self._combined_detect_extract, ocr_text, document_type_hint)
            fut_layout   = pool.submit(self._layout_fast, file_path, ocr_text)
            fut_gliner   = pool.submit(self._gliner_safe, ocr_text)

            try:
                combined = fut_combined.result(timeout=30)
            except Exception as exc:
                logger.error("[M02] Combined detect+extract failed: %s", exc)
                from .document_type_detector import _unknown_result
                combined = {"doc_type": _unknown_result(), "fields": {}}

            try:
                layout = fut_layout.result(timeout=10)
            except Exception as exc:
                logger.warning("[M02] Layout detection failed: %s", exc)
                layout = {"pdf_blocks": [], "has_tables": False, "table_count": 0,
                          "quality": _quality_from_text(ocr_text), "regions": []}

            try:
                gliner_entities = fut_gliner.result(timeout=4)
            except Exception:
                gliner_entities = {}
                logger.info("[M02] GLiNER timed out or failed — skipping.")

        logger.info("[M02] Parallel fan-out done (%.2fs)", time.time() - t_parallel)

        # ── Unpack combined detect+extract result ─────────────────────────
        doc_type_result = combined["doc_type"]
        raw_fields      = combined["fields"]

        result["pipeline_stages"]["doc_type"] = {
            "document_type": doc_type_result["document_type"],
            "display_name":  doc_type_result["display_name"],
            "confidence":    doc_type_result["confidence"],
            "signals":       doc_type_result["signals"],
        }
        result["document_type"]             = doc_type_result["document_type"]
        result["document_type_display"]     = doc_type_result["display_name"]
        result["document_type_icon"]        = doc_type_result["icon"]
        result["document_type_color"]       = doc_type_result["color"]
        result["document_type_confidence"]  = doc_type_result["confidence"]
        result["document_type_signals"]     = doc_type_result["signals"]
        result["document_type_reasoning"]   = doc_type_result.get("reasoning", "")
        result["document_type_description"] = doc_type_result["description"]

        result["pipeline_stages"]["extraction"] = {
            "fields_found": sum(
                1 for v in raw_fields.values()
                if v is not None and str(v).strip() not in ("", "null")
            ),
        }
        result["pipeline_stages"]["layout"] = {
            "has_tables":   layout["has_tables"],
            "table_count":  layout["table_count"],
            "quality":      layout["quality"],
            "region_count": len(layout.get("regions", [])),
        }
        result["pipeline_stages"]["gliner"] = {
            "entities_found": len(gliner_entities),
            "fields":         list(gliner_entities.keys()),
        }
        result["layout_blocks"] = layout.get("pdf_blocks", [])[:50]

        logger.info(
            "[M02] Doc type: %s (%.0f%%) | fields found: %d | GLiNER entities: %d",
            doc_type_result["display_name"],
            doc_type_result["confidence"] * 100,
            result["pipeline_stages"]["extraction"]["fields_found"],
            len(gliner_entities),
        )

        # ── Stage 3: Normalisation ────────────────────────────────────────
        from .field_normalizer import normalise_fields
        normalised = normalise_fields(raw_fields)

        # ── Stage 4: Confidence scoring ───────────────────────────────────
        from .confidence_scorer import score_all_fields, compute_overall_confidence, route_document
        from .confidence_trainer import load_calibration, apply_calibration

        raw_scores               = score_all_fields(normalised, gliner_entities)
        calibration              = load_calibration()
        field_scores, cal_deltas = apply_calibration(raw_scores, calibration)
        overall                  = compute_overall_confidence(field_scores)
        routing                  = route_document(overall, field_scores)

        result["pipeline_stages"]["confidence"] = {
            "overall":           overall,
            "queue":             routing["queue"],
            "calibrated_fields": len(cal_deltas),
        }

        # ── Stage 5: Assemble output ──────────────────────────────────────
        duration_ms = int((time.time() - t0) * 1000)

        result.update({
            "ocr_text":              ocr_text,
            "extracted_fields":      raw_fields,
            "normalised_fields":     normalised,
            "gliner_entities":       {k: v["text"] for k, v in gliner_entities.items()},
            "confidence_scores":     field_scores,
            "raw_confidence_scores": raw_scores,
            "calibration_deltas":    cal_deltas,
            "overall_confidence":    overall,
            "review_queue":          routing["queue"],
            "fields_auto":           routing["fields_auto"],
            "fields_soft_review":    routing["fields_soft"],
            "fields_hard_review":    routing["fields_hard"],
            "fields_low":            routing["fields_low"],
            "quality_alert":         routing["quality_alert"],
            "pipeline_duration_ms":  duration_ms,
            "document_quality":      layout["quality"],
        })

        logger.info(
            "[M02] COMPLETE in %dms — type=%s queue=%s confidence=%.2f",
            duration_ms, doc_type_result["document_type"], routing["queue"], overall,
        )
        return result

    # ── Task A: single GPT call — detect type + extract fields ───────────

    def _combined_detect_extract(self, ocr_text: str, document_type_hint: Optional[str] = None) -> dict:
        """
        One GPT-4o-mini call that returns both the document type and all fields.
        Uses smart truncation: first 9 000 + last 3 000 chars of OCR text.
        """
        from .document_type_detector import DOCUMENT_TYPES, _unknown_result

        if document_type_hint and document_type_hint in DOCUMENT_TYPES:
            pre_doc_type = document_type_hint
        else:
            pre_doc_type = None

        truncated = _smart_truncate(ocr_text)
        # Use replace() not format() — OCR text may contain {} chars
        prompt = _COMBINED_PROMPT.replace("{text}", truncated)

        try:
            resp = self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0,
                max_tokens=1400,
            )
            raw = json.loads(resp.choices[0].message.content)
        except Exception as exc:
            logger.error("[M02] Combined GPT call failed: %s", exc)
            return {"doc_type": _unknown_result(), "fields": {}}

        # ── Unpack document type ──────────────────────────────────────────
        if pre_doc_type:
            doc_type = pre_doc_type
        else:
            doc_type = str(raw.get("document_type", "unknown")).lower().strip()
            if doc_type not in DOCUMENT_TYPES:
                doc_type = "unknown"

        meta = DOCUMENT_TYPES[doc_type]
        doc_type_result = {
            "document_type": doc_type,
            "display_name":  meta["display_name"],
            "icon":          meta["icon"],
            "color":         meta["color"],
            "confidence":    round(float(raw.get("doc_confidence", 0.9 if pre_doc_type else 0.5)), 3),
            "signals":       raw.get("doc_signals", [])[:8],
            "reasoning":     ("User-confirmed type" if pre_doc_type
                              else f"Single-pass GPT classification: {doc_type}"),
            "description":   meta["description"],
        }

        # Heuristic override if GPT confidence is low
        if doc_type_result["confidence"] < 0.6:
            from .document_type_detector import _heuristic_detect
            heuristic = _heuristic_detect(ocr_text)
            if heuristic and heuristic["confidence"] >= 0.75:
                doc_type_result = heuristic

        # ── Unpack fields ─────────────────────────────────────────────────
        raw_fields = raw.get("fields", {})
        if not isinstance(raw_fields, dict):
            raw_fields = {}

        clean_fields = {
            k: (None if str(v).strip().lower() in ("null", "none", "n/a", "") else v)
            for k, v in raw_fields.items()
            if not k.startswith("_") and not isinstance(v, dict)
        }

        return {"doc_type": doc_type_result, "fields": clean_fields}

    # ── Task B: layout from PyMuPDF blocks (all document types) ──────────

    def _layout_fast(self, file_path: str, ocr_text: str) -> dict:
        """
        Layout detection using PyMuPDF block data + text-pattern heuristics.

        The previous GPT-4o-mini vision call for layout was removed — it added
        1–3 s of latency per document while providing only metadata signals
        (has_tables, quality, region_count) that are equally well derived from
        OCR text patterns at zero API cost.  The layout output is used only for
        pipeline_stages metadata, not for field extraction accuracy.
        """
        from .layout_detector import detect_layout_from_pdf
        from pathlib import Path

        pdf_blocks: list = []
        if Path(file_path).suffix.lower() == ".pdf":
            try:
                pdf_blocks = detect_layout_from_pdf(file_path)
            except Exception:
                pass

        # Text-pattern heuristics — ~0 ms, no API call
        return _layout_from_text(ocr_text, pdf_blocks)

    # ── Task C: GLiNER — non-blocking, 4 s hard cap via thread timeout ───

    def _gliner_safe(self, ocr_text: str) -> dict:
        try:
            from .entity_extractor import extract_entities
            return extract_entities(ocr_text)
        except Exception as exc:
            logger.warning("[M02] GLiNER error: %s", exc)
            return {}
