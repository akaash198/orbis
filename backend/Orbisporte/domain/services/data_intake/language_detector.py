"""
DM-004 / DM-005: Language detection and document type classification.

Language detection
------------------
  Uses langdetect (Google's language-detection library) with a small
  sample of extracted text for speed. Falls back to 'unknown' on failure.

Document type detection
-----------------------
  Heuristic keyword scan over extracted text, producing a best-guess
  document_type and a confidence score (0.0–1.0).

  Supported types
  ---------------
    invoice           – Commercial invoices
    bill_of_entry     – Indian customs BoE (BE)
    shipping_bill     – Export shipping bills
    packing_list      – Packing / weight lists
    certificate_of_origin – CoO documents
    airway_bill       – Air waybills (AWB)
    bill_of_lading    – Ocean bills of lading (BL/BoL)
    purchase_order    – POs from buyers
    edi_transaction   – EDI X12/EDIFACT messages
    barcode_payload   – Decoded barcode / QR data
    audio_transcript  – Speech-to-text output
    unknown           – Could not classify
"""

import logging
import re
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from langdetect import detect, DetectorFactory
    DetectorFactory.seed = 42          # reproducible results
    _LANGDETECT_AVAILABLE = True
except ImportError:
    _LANGDETECT_AVAILABLE = False
    logger.warning("langdetect not installed — language detection will return 'unknown'.")

# ─────────────────────────────────────────────────────────────────────────────
# Keyword sets for document-type heuristics
# Each entry: (doc_type_key, required_keywords[], optional_boost_keywords[], weight)
_DOC_RULES = [
    ("bill_of_entry",      ["bill of entry", "be number", "import general manifest", "icegate", "customs duty"],     ["importer", "port of entry", "iec"], 1.5),
    ("shipping_bill",      ["shipping bill", "sb number", "let export", "export general manifest", "are-1"],         ["exporter", "port of loading"], 1.5),
    ("invoice",            ["invoice", "invoice number", "inv no", "bill to", "sold to", "unit price", "total amount"], ["vat", "gst", "hsn", "amount due"], 1.0),
    ("packing_list",       ["packing list", "net weight", "gross weight", "carton", "marks and numbers"],            ["package", "dimensions"], 1.0),
    ("certificate_of_origin", ["certificate of origin", "country of origin", "chamber of commerce"],                ["fta", "preferential"], 1.2),
    ("airway_bill",        ["air waybill", "awb", "airway bill", "iata", "airport of destination"],                  ["flight", "cargo"], 1.0),
    ("bill_of_lading",     ["bill of lading", "b/l", "vessel", "port of discharge", "shipper", "consignee"],         ["ocean", "container", "freight"], 1.0),
    ("purchase_order",     ["purchase order", "po number", "p.o.", "ordered by", "delivery date"],                   ["buyer", "supplier", "quantity"], 1.0),
    ("edi_transaction",    ["isa*", "una:", "st*", "gs*", "ge*", "iea*", "edifact"],                                 [], 2.0),
    ("barcode_payload",    ["gs1", "sscc", "gtin", "barcode", "qr code"],                                            [], 1.5),
    ("audio_transcript",   ["[speaker", "[pause", "[inaudible", "transcript", "spoken by"],                          [], 1.2),
]


def _extract_text_sample(file_bytes: bytes, file_type: str, max_chars: int = 3000) -> str:
    """Extract a text sample for analysis (fast, not full extraction)."""
    file_type = (file_type or "").lower()

    if file_type in ("json", "xml", "edi", "csv"):
        try:
            return file_bytes[:max_chars].decode("utf-8", errors="replace")
        except Exception:
            return ""

    if file_type == "pdf":
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
                if len(text) >= max_chars:
                    break
            doc.close()
            return text[:max_chars]
        except Exception:
            return ""

    if file_type in ("jpeg", "png", "tiff"):
        # OCR would be ideal here; return empty for now (OCR done in extraction step)
        return ""

    return ""


def detect_language(text: str) -> str:
    """
    Detect language from text.
    Returns ISO 639-1 code (e.g. 'en', 'hi', 'zh') or 'unknown'.
    """
    if not text or len(text.strip()) < 20:
        return "unknown"

    if not _LANGDETECT_AVAILABLE:
        return "unknown"

    try:
        lang = detect(text[:2000])
        return lang
    except Exception as exc:
        logger.debug("Language detection failed: %s", exc)
        return "unknown"


def classify_document_type(text: str) -> Tuple[str, float]:
    """
    Heuristic keyword-based document type classification.

    Returns
    -------
    (document_type, confidence)  where confidence ∈ [0.0, 1.0]
    """
    if not text:
        return "unknown", 0.0

    text_lower = text.lower()
    scores: dict = {}

    for doc_type, required_kws, boost_kws, weight in _DOC_RULES:
        # Count required keywords present
        req_hits = sum(1 for kw in required_kws if kw in text_lower)
        if req_hits == 0:
            continue
        req_ratio = req_hits / len(required_kws)

        # Optional boost keywords
        boost_hits = sum(1 for kw in boost_kws if kw in text_lower)
        boost = boost_hits / max(len(boost_kws), 1) * 0.3

        scores[doc_type] = (req_ratio + boost) * weight

    if not scores:
        return "unknown", 0.0

    best_type = max(scores, key=scores.__getitem__)
    raw_score = scores[best_type]
    # Normalise to [0, 1]
    confidence = min(raw_score / 2.0, 1.0)
    return best_type, round(confidence, 3)


def detect_language_and_type(
    file_bytes: bytes,
    file_type: str,
    source_channel: Optional[str] = None,
) -> dict:
    """
    Unified DM-004 + DM-005 entry point.

    Parameters
    ----------
    file_bytes     : Raw or preprocessed file bytes.
    file_type      : Detected file type key (pdf, jpeg, json, edi, …).
    source_channel : Optional channel hint (barcode → barcode_payload, voice → audio_transcript).

    Returns
    -------
    dict with keys: language, document_type, classification_confidence, text_sample
    """
    # Channel overrides
    if source_channel == "barcode":
        return {
            "language": "unknown",
            "document_type": "barcode_payload",
            "classification_confidence": 1.0,
            "text_sample": file_bytes.decode("utf-8", errors="replace")[:500],
        }
    if source_channel == "voice":
        return {
            "language": "unknown",
            "document_type": "audio_transcript",
            "classification_confidence": 1.0,
            "text_sample": "",
        }

    text_sample = _extract_text_sample(file_bytes, file_type)
    language = detect_language(text_sample)
    doc_type, confidence = classify_document_type(text_sample)

    logger.info("Detected: language=%s, doc_type=%s (conf=%.2f)", language, doc_type, confidence)

    return {
        "language": language,
        "document_type": doc_type,
        "classification_confidence": confidence,
        "text_sample": text_sample[:500],
    }
