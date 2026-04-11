"""
M02 Entity Extractor — GLiNER zero-shot NER.

GLiNER (Generalist and Lightweight Named Entity Recognition) detects
named entities without task-specific fine-tuning. We use it to validate
and supplement GPT-4o-mini field extraction with span-level confidence.

Model: urchade/gliner_medium-v2.1
  - Zero-shot: define your entity types at inference time
  - Lightweight: ~170MB, runs on CPU
  - Multilingual: handles EN/HI/ZH/AR trade documents
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Entity labels mapped to our trade document field names
TRADE_ENTITY_LABELS = [
    "invoice number",
    "invoice date",
    "exporter name",
    "importer name",
    "GST number",
    "IEC number",
    "HSN code",
    "HS code",
    "quantity",
    "unit price",
    "total value",
    "cif value",
    "currency",
    "country of origin",
    "shipment address",
    "port of loading",
    "port of discharge",
    "shipment date",
    "payment terms",
    "incoterms",
    "freight amount",
    "insurance amount",
    "bill of lading number",
    "airway bill number",
    "container number",
    "vessel name",
    "flight number",
    "purchase order number",
]

# Map GLiNER label → our canonical field name
LABEL_TO_FIELD = {
    "invoice number":        "invoice_number",
    "invoice date":          "invoice_date",
    "exporter name":         "exporter_name",
    "importer name":         "importer_name",
    "gst number":            "gst_number",
    "iec number":            "iec_number",
    "hsn code":              "hsn_code",
    "hs code":               "hsn_code",
    "quantity":              "quantity",
    "unit price":            "unit_price",
    "total value":           "total_value",
    "cif value":             "cif_value",
    "currency":              "currency",
    "country of origin":     "country_of_origin",
    "shipment address":      "shipment_address",
    "port of loading":       "port_of_loading",
    "port of discharge":     "port_of_discharge",
    "shipment date":         "shipment_date",
    "payment terms":         "payment_terms",
    "incoterms":             "incoterms",
    "freight amount":        "freight",
    "insurance amount":      "insurance",
    "bill of lading number": "bill_of_lading_number",
    "airway bill number":    "awb_number",
    "container number":      "container_number",
    "vessel name":           "vessel_name",
    "flight number":         "flight_number",
    "purchase order number": "purchase_order_number",
}

import threading as _threading

_model = None
_model_lock = _threading.Lock()
_model_load_attempted = False


def _load_model():
    """
    Thread-safe GLiNER model loader.

    The previous implementation set _model_load_attempted = True BEFORE the
    load completed, so any concurrent caller would see _model = None and
    skip inference permanently. This version holds a lock through the load.
    """
    global _model, _model_load_attempted
    # Fast path — already loaded
    if _model_load_attempted:
        return _model
    with _model_lock:
        # Double-checked locking
        if _model_load_attempted:
            return _model
        try:
            from gliner import GLiNER
            import warnings
            warnings.filterwarnings("ignore")
            _model = GLiNER.from_pretrained("urchade/gliner_medium-v2.1")
            logger.info("[GLiNER] Model loaded: urchade/gliner_medium-v2.1")
        except Exception as exc:
            logger.warning("[GLiNER] Load failed: %s — entity extraction will be skipped.", exc)
            _model = None
        finally:
            # Mark as attempted only AFTER load completes (success or failure)
            _model_load_attempted = True
    return _model


def _prewarm():
    """Load GLiNER in a background daemon thread at import time."""
    t = _threading.Thread(target=_load_model, daemon=True, name="gliner-prewarm")
    t.start()


_prewarm()


def _extract_entities_from_chunk(model, chunk: str) -> dict:
    """Run GLiNER on a single text chunk and return raw per-field span lists."""
    entities = model.predict_entities(chunk, TRADE_ENTITY_LABELS, threshold=0.4)
    result: dict = {}
    for ent in entities:
        label = ent.get("label", "").lower()
        field = LABEL_TO_FIELD.get(label)
        if not field:
            continue
        span = ent.get("text", "").strip()
        score = round(float(ent.get("score", 0.5)), 3)
        if span:
            result.setdefault(field, []).append({"text": span, "confidence": score})
    return result


def extract_entities(text: str, pages: list = None) -> dict:
    """
    Run GLiNER over ALL pages of OCR text and return per-field span detections.

    When ``pages`` is provided (list of per-page text strings from the OCR
    result) every page is chunked independently so GLiNER sees the first
    2 000 chars of *each* page rather than only the first 2 000 chars of the
    concatenated document.  This dramatically improves recall on multi-page
    trade documents where key fields (B/L number, AWB, port info) sit on
    later pages.

    Returns
    -------
    dict mapping field_name → {text, confidence}
    """
    if not text or len(text.strip()) < 20:
        return {}

    model = _load_model()
    if model is None:
        return {}

    try:
        # Build the list of text segments to run inference on.
        # Each segment is at most 2 000 chars (~450 tokens, safely within
        # GLiNER's 512-token window).
        _CHUNK_CHARS = 2000
        segments: list[str] = []

        if pages and len(pages) > 1:
            # Multi-page: sample the beginning of every page
            for page_text in pages:
                if page_text and page_text.strip():
                    segments.append(page_text[:_CHUNK_CHARS])
            # Also add the overall document tail to catch totals/footer fields
            tail = text[-_CHUNK_CHARS:]
            if tail not in segments:
                segments.append(tail)
        else:
            # Single page or no page list: chunk the full text
            start = 0
            while start < len(text):
                segments.append(text[start: start + _CHUNK_CHARS])
                start += _CHUNK_CHARS - 200  # 200-char overlap

        # Accumulate spans from every segment
        all_spans: dict = {}
        for seg in segments:
            if not seg.strip():
                continue
            chunk_result = _extract_entities_from_chunk(model, seg)
            for field, spans in chunk_result.items():
                all_spans.setdefault(field, []).extend(spans)

        # Keep highest-confidence span per field across all segments
        best: dict = {}
        for field, spans in all_spans.items():
            best[field] = max(spans, key=lambda x: x["confidence"])

        logger.info(
            "GLiNER extracted %d entities from %d segment(s).", len(best), len(segments)
        )
        return best

    except Exception as exc:
        logger.error("GLiNER inference failed: %s", exc)
        return {}
