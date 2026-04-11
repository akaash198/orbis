"""
M02 Extraction Service — multimodal parallel orchestrator.

Pipeline (target latency)
--------------------------
  Stage 1  OCR
              Digital: PyMuPDF text layer              ~50 ms
              Scanned: PaddleOCR                        ~0.6–2.0 s (Tesseract fallback)
  Stage 2  Parallel multimodal extraction
              Engine A  GPT-4o-mini detect + extract   ~500ms–1.5 s
              Engine B  LayoutLMv3 block classification ~300ms–700 ms (CPU, zero net cost)
              Engine C  GLiNER zero-shot NER            ~200ms–500 ms (CPU, zero net cost)
              Engine D  LangExtract chunked GPT         ~500ms–2 s   (conditional)
              All four engines run concurrently.
  Stage 3  Normalise fields                            ~1 ms
  Stage 4  Confidence scoring
              Rule-based (fast path)                   ~1 ms
              GLiNER-boosted (always available now)    ~1 ms
  Stage 5  Assemble output                             ~1 ms

Key improvements
----------------
  • All four engines fire in parallel after OCR — GLiNER and LayoutLMv3
    are CPU-bound and complete before GPT returns, adding zero net latency.
  • LayoutLMv3 (microsoft/layoutlmv3-base) classifies PDF blocks into
    regions (header, line_items_table, totals, …) using joint text+bbox+image
    encoding.  Falls back to keyword + position heuristics when unavailable.
  • GLiNER is now active in both fast and standard modes.
  • OCR: PyMuPDF text-layer first, PaddleOCR for scanned pages,
    Tesseract local fallback on OCR engine failure.
  • Extraction: 1 500-token limit (was 700) — fits 30 fields + line_items.
  • LangExtract: 600-token limit (was 350) — no more partial JSON.
"""
import json
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ── Single-pass prompt: detect type + extract fields ─────────────────────────
_COMBINED_PROMPT = """You are an expert trade document specialist with deep knowledge of international trade documents.

This document may contain ONE OR MORE of these document types:
- Commercial Invoice (CI) - seller to buyer, payment due, tax/GST
- Bill of Lading (B/L) - ocean shipping, vessel, container
- Air Waybill (AWB) - air freight, flight details
- Packing List - cartons, weights, dimensions
- Purchase Order - buyer to vendor

TASK 1 — Document type classification.
Choose exactly ONE from: commercial_invoice | packing_list | air_waybill | bill_of_lading | purchase_order | proforma_invoice | certificate_of_origin | customs_declaration | letter_of_credit | unknown

IMPORTANT CLASSIFICATION RULES - BE VERY SPECIFIC:
- "Invoice No" or "Invoice Number" or "Tax Invoice" or "Commercial Invoice" = commercial_invoice
- "P.O." or "Purchase Order" or "PO Number" = purchase_order
- "Packaging List" or "Packing List" or "Weight List" or "Pack List" = packing_list
- "Bill of Lading" or "B/L" or "HBL" or "MBL" or "Ocean Bill" = bill_of_lading
- "Air Waybill" or "AWB" or "MAWB" or "HAWB" or "Airbill" = air_waybill
- "Proforma Invoice" or "PI No" or "Proforma" = proforma_invoice

TRANSPORT DOCUMENT DISAMBIGUATION (CRITICAL):
- "Air Waybill", "AWB", "MAWB", "HAWB", "IATA", "flight" = air_waybill
- "Bill of Lading", "B/L", "HBL", "vessel", "voyage", "container", "sea freight" = bill_of_lading

TASK 2 — COMPREHENSIVE Field extraction from ALL document types present.
CRITICAL: Extract ALL fields from this document, regardless of document type.
Look for these fields on ANY page:

COMMERCIAL INVOICE FIELDS:
- invoice_number: Invoice number (e.g., INV-2024-001, CI-12345)
- invoice_date: Invoice date (any format - normalize to YYYY-MM-DD)
- exporter_name: Seller/exporter company name
- exporter_address: Full address of exporter
- importer_name: Buyer/importer company name
- importer_address: Full address of importer
- gst_number: GSTIN (15 chars, e.g., 29ABCDE1234F1Z5)
- iec_number: IEC (10 digits)
- hsn_code: HSN/tariff code (4-8 digits, e.g., 85171290)
- goods_description: Description of goods/products
- quantity: Numeric quantity
- unit: Unit of measure (PCS, KGS, MTR, NOS, SET)
- unit_price: Price per unit
- currency: ISO currency code (USD, INR, EUR, etc.)
- total_value: Total invoice value
- freight: Freight charges
- insurance: Insurance charges
- country_of_origin: Country where goods are made

TRANSPORT DOCUMENT FIELDS:
- bill_of_lading_number: B/L reference number
- awb_number: Air waybill number
- vessel_name: Name of vessel/ship
- container_number: Container number
- port_of_loading: Port where goods are loaded
- port_of_discharge: Port where goods are unloaded
- flight_number: Flight number (for air shipments)
- shipment_date: Date of shipment

PACKING LIST FIELDS:
- number_of_packages: Number of cartons/boxes
- gross_weight: Total gross weight
- net_weight: Total net weight

TASK 2 — Field extraction (extract every field present; use null when absent).
Normalization rules:
• invoice_date, shipment_date, expiry_date → YYYY-MM-DD format
• currency → 3-letter ISO 4217 code (USD, INR, EUR, GBP, AED …)
• country_of_origin → 2-letter ISO 3166-1 alpha-2 code (CN, US, IN, AE …)
• gst_number → 15-char GSTIN format, uppercase, no spaces (e.g. 29ABCDE1234F1Z5)
• iec_number → 10-digit IEC code (e.g. 0515072814)
• hsn_code → extract as-is (4, 6, or 8 digits — do NOT pad or truncate, e.g. 850440 stays 850440)
• quantity → numeric value only (strip currency symbols and units)
• unit → unit of measure separately (e.g. PCS, KGS, MTR, NOS, SET)
• unit_price, total_value → numeric only, no symbols or commas (e.g. 20.00, 10000)
• freight, insurance → CIF components, numeric only (e.g. freight=1200, insurance=200)
• cif_value → total CIF value numeric only; if not explicit, leave null (will be computed)
• shipment_address → full destination address as a single string
• line_items → array of objects, one per product line; each object: {hsn_code, description, quantity, unit, unit_price, total_value}
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
# Increased for multi-page documents to capture more content
_LEAD_CHARS = 15_000
_TAIL_CHARS = 5_000
# LangExtract only fires when the document is longer than the main GPT call's
# smart-truncation window (15 000 + 5 000 = 20 000 chars).  Below that the
# main call already sees the full document, so a second chunked pass adds no
# value and just wastes ~500 ms–1 s.
_LX_THRESHOLD_FAST = 10_000   # chars — Lower threshold to run LangExtract more often
_LX_THRESHOLD_STD = _LEAD_CHARS + _TAIL_CHARS
# Increased from 15 → 30 s: detail="high" OCR takes 5–8 s per page;
# multi-page documents need more time for comprehensive extraction.
_PIPELINE_TARGET_SECONDS = float(os.getenv("M02_PIPELINE_TARGET_SECONDS", "120"))
_OCR_MAX_PAGES_FAST = int(os.getenv("M02_OCR_MAX_PAGES_FAST", "0"))
_OCR_MAX_PAGES_STD = int(os.getenv("M02_OCR_MAX_PAGES_STD", "0"))
_MIN_SECONDS_FOR_LANGEXTRACT = float(os.getenv("M02_MIN_SECONDS_FOR_LANGEXTRACT", "2"))
_MIN_SECONDS_FOR_STANDARD_EXTRAS = float(os.getenv("M02_MIN_SECONDS_FOR_STANDARD_EXTRAS", "3"))
_EXTRACT_TIMEOUT_MIN_SECONDS = float(os.getenv("M02_EXTRACT_TIMEOUT_MIN_SECONDS", "20"))
_EXTRACT_TIMEOUT_MAX_SECONDS = float(os.getenv("M02_EXTRACT_TIMEOUT_MAX_SECONDS", "45"))
_EXTRACT_TIMEOUT_SAFETY_SECONDS = float(os.getenv("M02_EXTRACT_TIMEOUT_SAFETY_SECONDS", "5"))
_EXTRACT_RETRIES = int(os.getenv("M02_EXTRACT_RETRIES", "3"))
_EXTRACT_WAIT_BUFFER_SECONDS = float(os.getenv("M02_EXTRACT_WAIT_BUFFER_SECONDS", "12"))


def _seconds_left(start_ts: float, target_seconds: float = _PIPELINE_TARGET_SECONDS) -> float:
    return max(0.0, target_seconds - (time.time() - start_ts))


def _preprocess_ocr_text(text: str) -> Dict[str, Any]:
    """
    Lightweight preprocessing for OCR output.
    - Normalize spacing and noise
    - Keep section structure via line boundaries
    - Reduce token volume before LLM extraction
    """
    raw = text or ""
    lines = raw.splitlines()

    cleaned_lines = []
    prev = None
    deduped_count = 0
    for line in lines:
        ln = " ".join(str(line).replace("\t", " ").split()).strip()
        if not ln:
            continue
        if len(ln) == 1 and not ln.isalnum():
            continue
        if ln == prev:
            deduped_count += 1
            continue
        cleaned_lines.append(ln)
        prev = ln

    section_markers = [
        "invoice", "packing list", "bill of lading", "air waybill",
        "shipper", "consignee", "buyer", "seller", "total", "hsn", "hs code",
    ]
    section_hits = sum(
        1 for ln in cleaned_lines
        if any(marker in ln.lower() for marker in section_markers)
    )

    cleaned_text = "\n".join(cleaned_lines)
    return {
        "text": cleaned_text,
        "stats": {
            "raw_char_count": len(raw),
            "clean_char_count": len(cleaned_text),
            "raw_line_count": len(lines),
            "clean_line_count": len(cleaned_lines),
            "deduped_lines": deduped_count,
            "section_hits": section_hits,
        },
    }


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


def _contains_any(text: str, keywords: list[str]) -> bool:
    t = (text or "").lower()
    return any(k in t for k in keywords)


def _extract_fields_regex(ocr_text: str) -> Dict[str, Any]:
    """
    Deterministic fallback extractor when LLM extraction times out/fails.
    Returns only high-confidence key fields.
    """
    text = ocr_text or ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    lower = text.lower()

    def find(patterns, flags=re.IGNORECASE):
        for p in patterns:
            m = re.search(p, text, flags)
            if m:
                return (m.group(1) or "").strip()
        return None

    def to_num(v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = re.sub(r"[^\d.\-]", "", v)
        return cleaned or None

    invoice_number = find([
        r"invoice\s*(?:no|number|#)\s*[:\-]?\s*([A-Z0-9\-\/]+)",
        r"\binv\s*(?:no|#)\s*[:\-]?\s*([A-Z0-9\-\/]+)",
    ])
    invoice_date = find([
        r"invoice\s*date\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
        r"\bdate\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})",
    ])
    gst_number = find([r"\b(?:gstin|gst)\s*[:\-]?\s*([0-9A-Z]{15})\b"])
    iec_number = find([r"\biec\s*(?:no|number)?\s*[:\-]?\s*([0-9]{10})\b"])
    hsn_code = find([r"\b(?:hsn|hs\s*code|tariff\s*code)\s*[:\-]?\s*([0-9]{4,8})\b"])

    m_curr = re.search(r"\b(USD|INR|EUR|GBP|AED|CNY|JPY)\b", text, re.IGNORECASE)
    currency = (m_curr.group(1).upper() if m_curr else None)

    total_value = find([
        r"\b(?:total\s*(?:amount|value)?|grand\s*total)\s*[:\-]?\s*([0-9,]+\.\d{1,2}|[0-9,]+)",
    ])
    freight = find([
        r"\bfreight(?:\s*charges?)?\s*[:\-]?\s*([0-9,]+\.\d{1,2}|[0-9,]+)",
    ])
    insurance = find([
        r"\binsurance(?:\s*charges?)?\s*[:\-]?\s*([0-9,]+\.\d{1,2}|[0-9,]+)",
    ])
    country_of_origin = find([r"\bcountry\s*of\s*origin\s*[:\-]?\s*([A-Z]{2})\b"])

    exporter_name = None
    importer_name = None
    for i, ln in enumerate(lines):
        ll = ln.lower()
        if exporter_name is None and any(k in ll for k in ("exporter", "seller", "shipper")):
            exporter_name = lines[i + 1] if i + 1 < len(lines) and len(lines[i + 1]) > 2 else None
        if importer_name is None and any(k in ll for k in ("importer", "buyer", "consignee")):
            importer_name = lines[i + 1] if i + 1 < len(lines) and len(lines[i + 1]) > 2 else None

    doc_type = "unknown"
    if any(k in lower for k in ("air waybill", "awb", "mawb", "hawb")):
        doc_type = "air_waybill"
    elif any(k in lower for k in ("bill of lading", "b/l", "hbl", "mbl")):
        doc_type = "bill_of_lading"
    elif "packing list" in lower:
        doc_type = "packing_list"
    elif "invoice" in lower:
        doc_type = "commercial_invoice"

    fields = {
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "exporter_name": exporter_name,
        "importer_name": importer_name,
        "gst_number": gst_number,
        "iec_number": iec_number,
        "hsn_code": hsn_code,
        "currency": currency,
        "total_value": to_num(total_value),
        "freight": to_num(freight),
        "insurance": to_num(insurance),
        "country_of_origin": country_of_origin,
    }
    fields = {k: v for k, v in fields.items() if v not in (None, "", "null")}
    return {"doc_type": doc_type, "fields": fields}


def _disambiguate_transport_doc_type(
    ocr_text: str,
    raw_fields: Dict[str, Any],
    current_doc_type: str,
) -> str:
    """
    Correct common Air Waybill vs Bill of Lading confusion.
    Uses high-precision transport signals from OCR and extracted fields.
    """
    text = (ocr_text or "").lower()
    awb_keywords = [
        "air waybill", "airway bill", "awb", "mawb", "hawb", "iata",
        "flight no", "flight number", "airport of departure", "airport of destination",
        "air freight", "air cargo",
    ]
    bl_keywords = [
        "bill of lading", "b/l", "obl", "hbl", "mbl", "vessel", "voyage",
        "container", "sea freight", "ocean freight",
    ]

    awb_hits = sum(1 for k in awb_keywords if k in text)
    bl_hits = sum(1 for k in bl_keywords if k in text)

    awb_number = raw_fields.get("awb_number")
    flight_number = raw_fields.get("flight_number")
    bl_number = raw_fields.get("bill_of_lading_number")
    vessel_name = raw_fields.get("vessel_name")
    container_number = raw_fields.get("container_number")

    awb_field_signal = any(v not in (None, "", "null", "none") for v in [awb_number, flight_number])
    bl_field_signal = any(v not in (None, "", "null", "none") for v in [bl_number, vessel_name, container_number])

    # Strong AWB evidence should override BL prediction.
    if (awb_hits >= 1 or awb_field_signal) and not (bl_hits >= 2 or bl_field_signal):
        return "air_waybill"

    # Strong BL evidence should override AWB prediction.
    if (bl_hits >= 2 or bl_field_signal) and not (awb_hits >= 1 or awb_field_signal):
        return "bill_of_lading"

    return current_doc_type


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

    def __init__(self, openai_client=None, use_gemini: bool = None):
        """
        Initialize M02 extraction service.
        
        Args:
            openai_client: OpenAI client (optional, for fallback)
            use_gemini: If True, use Gemini; if False, use OpenAI; if None, auto-detect
        """
        from Orbisporte.infrastructure.get_llm import Config
        
        if use_gemini is None:
            # Priority:
            # 1) M02_USE_GEMINI env override
            # 2) LLM_PROVIDER default
            m02_use_gemini = os.getenv("M02_USE_GEMINI")
            if m02_use_gemini is not None:
                use_gemini = str(m02_use_gemini).strip().lower() in ("1", "true", "yes", "y", "on")
            else:
                use_gemini = Config.LLM_PROVIDER.lower() == "gemini"
        
        self._use_gemini = use_gemini
        
        if use_gemini:
            try:
                from Orbisporte.infrastructure.get_llm import gemini_client
                self._client = gemini_client()
                logger.info("[M02] Using Gemini client for extraction")
            except Exception as e:
                logger.warning(f"[M02] Gemini client init failed: {e}, falling back to OpenAI")
                self._use_gemini = False
                if openai_client is None:
                    from Orbisporte.infrastructure.get_llm import openai_client as _oc
                    openai_client = _oc()
                self._client = openai_client
        else:
            if openai_client is None:
                from Orbisporte.infrastructure.get_llm import openai_client as _oc
                openai_client = _oc()
            self._client = openai_client
            logger.info("[M02] Using OpenAI client for extraction")

    @staticmethod
    def _detect_page_count(file_path: str) -> int:
        """
        Best-effort page count resolver.
        Returns 1 for non-PDFs or when page count cannot be resolved.
        """
        try:
            if not str(file_path).lower().endswith(".pdf"):
                return 1
            import fitz
            doc = fitz.open(file_path)
            count = len(doc)
            doc.close()
            return max(int(count), 1)
        except Exception:
            return 1

    # ── Public entry point ────────────────────────────────────────────────

    def process(self, file_path: str, document_id: Optional[int] = None, 
                document_type_hint: Optional[str] = None,
                fast_mode: bool = True,
                enable_layout: bool = True,
                enable_gliner: bool = True) -> Dict[str, Any]:
        """
        Process a document and extract fields.
        
        Args:
            file_path: Path to the document file
            document_id: Optional document ID for tracking
            document_type_hint: Optional hint for document type (skip classification)
            fast_mode: If True, use optimized extraction path (keeps LangExtract for
                      coverage, skips GLiNER + advanced scoring) for speed with accuracy.
                      Default is True.
            enable_layout: Enable LayoutLMv3 layout branch.
            enable_gliner: Enable GLiNER entity extraction branch.
        """
        t0 = time.time()
        result: Dict[str, Any] = {
            "document_id":     document_id,
            "file_path":       file_path,
            "pipeline_stages": {},
            "fast_mode":       fast_mode,
        }
        result["pipeline_stages"]["sla"] = {
            "target_seconds": _PIPELINE_TARGET_SECONDS,
        }

        # ── Stage 1: OCR — PyMuPDF (text PDFs) + GPT-4o-mini Vision (scanned/images) ──
        # 
        # Strategy:
        # 1. First try PyMuPDF text layer (fast for digital PDFs)
        # 2. For pages with insufficient text, use GPT-4o-mini Vision OCR
        # 3. Handles multi-page documents uniformly
        #
        # This replaces the old dual-OCR approach with a unified hybrid engine.
        # ───────────────────────────────────────────────────────────────────────────
        logger.info("[M02] Stage 1: Hybrid OCR - PyMuPDF + GPT-4o-mini Vision")
        
        configured_ocr_max_pages = _OCR_MAX_PAGES_FAST if fast_mode else _OCR_MAX_PAGES_STD
        if configured_ocr_max_pages <= 0:
            ocr_max_pages = self._detect_page_count(file_path)
        else:
            ocr_max_pages = configured_ocr_max_pages
        # Reliability-oriented OCR budget:
        # Scale by page count for multi-page scanned PDFs to avoid early OCR timeout.
        # Keep bounded so single-page docs remain fast.
        estimated_pages = max(int(ocr_max_pages or 1), 1)
        dynamic_page_budget = float(estimated_pages * 12)
        ocr_budget_s = min(240.0, max(30.0, _PIPELINE_TARGET_SECONDS - 10.0, dynamic_page_budget))
        
        # Use the unified OCR engine - handles everything (PyMuPDF + GPT-4o-mini Vision)
        from .ocr_engine import run_ocr
        ocr = run_ocr(file_path, None, max_pages=ocr_max_pages, total_timeout_s=ocr_budget_s)
        combined_text = ocr.get("text", "") or ""
        
        result["pipeline_stages"]["ocr"] = {
            "method": ocr.get("method", "unknown"),
            "page_count": ocr.get("page_count", 0),
            "source_page_count": ocr.get("source_page_count", 0),
            "char_count": len(combined_text),
            "used_vision_ocr": ocr.get("used_vision_ocr", False),
            "truncated_pages": ocr.get("truncated_pages", False),
        }
        
        logger.info("[M02] OCR done: %s, %d chars from %d pages", 
                    ocr.get("method", "unknown"), len(combined_text), ocr.get("page_count", 0))
        ocr_text = combined_text
        preprocessed = _preprocess_ocr_text(ocr_text)
        ocr_text = preprocessed["text"]

        result["pipeline_stages"]["preprocessing"] = {
            "char_count_before": preprocessed["stats"]["raw_char_count"],
            "char_count_after": preprocessed["stats"]["clean_char_count"],
            "line_count_before": preprocessed["stats"]["raw_line_count"],
            "line_count_after": preprocessed["stats"]["clean_line_count"],
            "deduped_lines": preprocessed["stats"]["deduped_lines"],
            "section_hits": preprocessed["stats"]["section_hits"],
        }
        logger.info("[M02] Preprocessing done: %d lines, %d chars", 
                    preprocessed["stats"]["clean_line_count"], preprocessed["stats"]["clean_char_count"])

        # ── Stage 2: Multimodal parallel extraction ───────────────────────────
        #
        # All four engines fire in parallel after OCR completes:
        #
        #   Engine A  GPT-4o-mini        classify doc + extract all fields   ~500ms–1.5s
        #   Engine B  LayoutLMv3         block → region + field extraction   ~300ms–700ms (CPU)
        #   Engine C  GLiNER             zero-shot NER — all pages           ~200ms–500ms (CPU)
        #   Engine D  LangExtract        chunked GPT-4o-mini pass            ~500ms–2s (always on)
        #
        # Engines B and C are CPU-only so they finish before Engine A returns,
        # adding zero net latency.  Engine D (LangExtract) always runs for
        # multi-page documents so every page contributes field candidates.
        #
        # Merge priority:  GPT-4o-mini (A) > LayoutLMv3 fields (B) >
        #                  GLiNER spans (C) > LangExtract (D)
        # ─────────────────────────────────────────────────────────────────────

        t_parallel = time.time()

        # LangExtract decision — ALWAYS run for multi-page documents.
        # For single-page docs it fires when text exceeds the smart-truncation
        # window so the chunked GPT-4o-mini pass can cover the full document.
        page_count = len(ocr.get("pages", []))
        _lx_threshold = _LX_THRESHOLD_FAST if fast_mode else _LX_THRESHOLD_STD
        _lx_budget_ok = _seconds_left(t0) >= _MIN_SECONDS_FOR_LANGEXTRACT
        # Always run for multi-page; for single page, only when text is long enough
        run_langextract = (page_count > 1 or len(ocr_text) > _lx_threshold) and _lx_budget_ok

        # Fan-out: GPT + LayoutLMv3 + GLiNER [+ LangExtract]
        _task_count = 1  # extraction is always on
        if enable_layout:
            _task_count += 1
        if enable_gliner:
            _task_count += 1
        if run_langextract:
            _task_count += 1
        _max_workers = max(1, _task_count)
        with ThreadPoolExecutor(max_workers=_max_workers) as pool:
            # Engine A — GPT-4o-mini: detect doc type + extract all fields
            # Reliability-first timeout sizing:
            # - Avoid tiny per-attempt timeouts on large/multi-page docs.
            # - Respect overall SLA budget when available.
            _seconds_remaining = _seconds_left(t0) - _EXTRACT_TIMEOUT_SAFETY_SECONDS
            _seconds_remaining = max(0.0, _seconds_remaining)
            _extract_timeout = min(
                _EXTRACT_TIMEOUT_MAX_SECONDS,
                max(_EXTRACT_TIMEOUT_MIN_SECONDS, _seconds_remaining if _seconds_remaining > 0 else _EXTRACT_TIMEOUT_MAX_SECONDS),
            )
            fut_extract = pool.submit(
                self._combined_detect_extract,
                ocr_text,
                document_type_hint,
                _extract_timeout,
            )

            # Engine B — LayoutLMv3: block-level layout + table detection
            fut_layout = pool.submit(self._layout_lmv3, file_path, ocr_text) if enable_layout else None

            # Engine C — GLiNER: zero-shot NER on full OCR text (all pages)
            # Pass the per-page list so GLiNER samples the start of every page,
            # dramatically improving recall on multi-page documents.
            _ocr_pages = ocr.get("pages", [])
            fut_gliner = (
                pool.submit(self._gliner_safe, ocr_text, _ocr_pages)
                if enable_gliner else None
            )

            # Engine D — LangExtract: chunked GPT pass (conditional)
            # For multi-page docs, use larger chunks to capture more content
            # Always use larger chunks for better accuracy on multi-page documents
            _lx_chunk  = 15000 if page_count > 1 else (8000 if fast_mode else 10000)
            _lx_workers = 2 if page_count > 1 else (2 if fast_mode else 3)  # Reduced workers to avoid rate limiting
            fut_lx = (
                pool.submit(self._langextract_fields, ocr_text, _lx_chunk, _lx_workers)
                if run_langextract else None
            )

            # ── Collect Engine A (GPT) — must succeed ─────────────────────
            try:
                # _combined_detect_extract performs retries internally, so the
                # outer wait must account for all attempts.
                extract_wait_timeout = (
                    (_extract_timeout * max(_EXTRACT_RETRIES, 1))
                    + (_EXTRACT_WAIT_BUFFER_SECONDS * max(_EXTRACT_RETRIES - 1, 0))
                    + _EXTRACT_WAIT_BUFFER_SECONDS
                )
                combined = fut_extract.result(timeout=extract_wait_timeout)
            except Exception as exc:
                logger.error("[M02] GPT extraction failed: %s", exc)
                from .document_type_detector import _unknown_result
                combined = {"doc_type": _unknown_result(), "fields": {}}

            # ── Collect Engine B (LayoutLMv3) ─────────────────────────────
            if fut_layout is not None:
                try:
                    layout = fut_layout.result(timeout=8.0)
                except Exception as exc:
                    logger.warning("[M02] LayoutLMv3 failed: %s", exc)
                    layout = {
                        "pdf_blocks": [], "has_tables": False, "table_count": 0,
                        "quality": _quality_from_text(ocr_text), "regions": [],
                        "region_count": 0, "method": "heuristic",
                    }
            else:
                layout = {
                    "pdf_blocks": [], "has_tables": False, "table_count": 0,
                    "quality": _quality_from_text(ocr_text), "regions": [],
                    "region_count": 0, "method": "heuristic",
                }

            # ── Collect Engine C (GLiNER) ─────────────────────────────────
            # Extended timeout: multi-page docs now run GLiNER per-page chunk
            _gliner_timeout = min(20.0, max(8.0, page_count * 4.0))
            if fut_gliner is not None:
                try:
                    gliner_entities = fut_gliner.result(timeout=_gliner_timeout)
                except Exception as exc:
                    logger.warning("[M02] GLiNER failed or timed out: %s", exc)
                    gliner_entities = {}
            else:
                gliner_entities = {}

            # ── Collect Engine D (LangExtract) ────────────────────────────
            lx_fields = {}
            if fut_lx is not None:
                _lx_deadline = max(2.0, min(8.0, _seconds_left(t0) - 1.0))
                try:
                    lx_fields = fut_lx.result(timeout=_lx_deadline)
                except Exception as exc:
                    logger.warning("[M02] LangExtract failed or timed out: %s", exc)

        prelim_fields       = dict(combined.get("fields") or {})
        prelim_fields_found = sum(
            1 for v in prelim_fields.values()
            if v is not None and str(v).strip().lower() not in ("", "null", "none", "n/a")
        )
        prelim_doc_type = (combined.get("doc_type") or {}).get("document_type", "unknown")

        # If GPT found very few fields and LangExtract wasn't run, try a single
        # retry pass now (budget permitting) — handles edge-case blank responses
        if prelim_fields_found < 4 and not run_langextract and _seconds_left(t0) >= 3.0:
            logger.info("[M02] GPT returned only %d fields — running LangExtract recovery pass.", prelim_fields_found)
            try:
                lx_fields = self._langextract_fields(ocr_text, 6000, 2)
            except Exception as exc:
                logger.warning("[M02] LangExtract recovery failed: %s", exc)

        logger.info(
            "[M02] Stage 2 done in %.2fs — GPT fields=%d doc_type=%s "
            "GLiNER=%d LayoutLMv3=%s LX=%d",
            time.time() - t_parallel,
            prelim_fields_found,
            prelim_doc_type,
            len(gliner_entities),
            layout.get("method", "?"),
            len(lx_fields),
        )

        # ── Unpack combined detect+extract result ─────────────────────────
        doc_type_result = combined["doc_type"]
        raw_fields = dict(combined["fields"] or {})

        # Multi-page + multi-document handling:
        # For documents with multiple pages, always try to extract per-page to capture
        # all document types (invoice, BL, AWB, packing list) in mixed uploads.
        page_count = len(ocr.get("pages", []))
        
        # Always use multi-doc extraction for multi-page documents
        if page_count > 1 and _seconds_left(t0) >= 3.0:
            logger.info("[M02] Processing %d-page document with multi-page extraction", page_count)
            multi_doc = self._extract_multi_document_pages(
                ocr.get("pages", []),
                ocr.get("page_indices"),
            )
            # Merge multi-doc fields with main extraction for comprehensive coverage
            raw_fields = self._merge_field_dicts(raw_fields, multi_doc.get("merged_fields", {}))
            logger.info("[M02] Multi-doc extraction found %d document types: %s", 
                       len(multi_doc.get("documents", [])), multi_doc.get("document_types", []))
        else:
            if page_count > 1:
                logger.info("[M02] %d pages detected but insufficient time for multi-doc extraction", page_count)
            multi_doc = {
                "documents": [],
                "document_types": [],
                "page_classifications": [],
                "merged_fields": {},
                "primary_document_type": None,
                "primary_confidence": 0.0,
            }

        # Prefer page-derived primary type when full-document call is uncertain.
        if multi_doc.get("documents"):
            primary_type = multi_doc.get("primary_document_type")
            primary_conf = float(multi_doc.get("primary_confidence", 0.0) or 0.0)
            primary_doc = None
            for d in (multi_doc.get("documents") or []):
                if isinstance(d, dict) and d.get("document_type") == primary_type:
                    primary_doc = d
                    break

            llm_type = doc_type_result.get("document_type", "unknown")
            llm_conf = float(doc_type_result.get("confidence", 0.0) or 0.0)
            llm_present_in_pages = llm_type in (multi_doc.get("document_types") or [])

            should_override_with_primary = (
                primary_type is not None
                and primary_type != "unknown"
                and (
                    llm_type == "unknown"
                    or llm_conf < 0.60
                    or (
                        llm_conf < 0.80
                        and not llm_present_in_pages
                        and primary_conf >= 0.70
                    )
                    or (
                        primary_doc is not None
                        and int(primary_doc.get("page_count", 0) or 0) >= 2
                        and primary_conf >= 0.75
                        and llm_conf < 0.80
                    )
                )
            )

            if should_override_with_primary:
                from .document_type_detector import get_type_meta
                meta = get_type_meta(primary_type)
                doc_type_result = {
                    "document_type": primary_type,
                    "display_name": meta["display_name"],
                    "icon": meta["icon"],
                    "color": meta["color"],
                    "confidence": max(llm_conf, primary_conf),
                    "signals": doc_type_result.get("signals", []),
                    "reasoning": "Derived from per-page classification consensus across document pages.",
                    "description": meta["description"],
                }

        # ── Merge LangExtract fields (override GPT where LX found a value) ───
        # LangExtract does span-level chunked extraction over the full text,
        # so it can catch fields that GPT's smart-truncated single call missed.
        lx_overrides = 0
        lx_additions = 0
        for field, lx_val in lx_fields.items():
            gpt_val = raw_fields.get(field)
            gpt_missing = gpt_val is None or str(gpt_val).strip().lower() in ("", "null", "none", "n/a")
            if gpt_missing:
                raw_fields[field] = lx_val
                lx_additions += 1
            elif len(str(lx_val)) > len(str(gpt_val)):
                # LangExtract returned a longer (more complete) span — prefer it
                raw_fields[field] = lx_val
                lx_overrides += 1

        if lx_fields:
            logger.info(
                "[M02] LangExtract: %d fields — %d additions, %d overrides applied.",
                len(lx_fields), lx_additions, lx_overrides,
            )

        # Final deterministic fallback if LLM-based extraction yielded insufficient fields.
        # Run regex extraction to supplement missing fields
        fields_found_count = sum(
            1 for v in raw_fields.values()
            if v is not None and str(v).strip().lower() not in ("", "null", "none", "n/a")
        )
        
        # Run regex fallback if fewer than 5 fields were extracted
        if fields_found_count < 5:
            logger.info("[M02] Only %d fields extracted by LLM, running regex fallback", fields_found_count)
            regex_fallback = _extract_fields_regex(ocr_text)
            fb_fields = regex_fallback.get("fields", {})
            if fb_fields:
                raw_fields = self._merge_field_dicts(raw_fields, fb_fields)
                result["pipeline_stages"]["fallback"] = {
                    "used": True,
                    "method": "regex",
                    "fields_found": len(fb_fields),
                }
                # If doc type was unknown, trust regex high-confidence transport/invoice signals.
                if doc_type_result.get("document_type") == "unknown" and regex_fallback.get("doc_type", "unknown") != "unknown":
                    from .document_type_detector import get_type_meta
                    fb_type = regex_fallback["doc_type"]
                    meta = get_type_meta(fb_type)
                    doc_type_result = {
                        **doc_type_result,
                        "document_type": fb_type,
                        "display_name": meta["display_name"],
                        "icon": meta["icon"],
                        "color": meta["color"],
                        "confidence": max(doc_type_result.get("confidence", 0.0), 0.55),
                        "reasoning": f'{doc_type_result.get("reasoning", "")} | regex fallback applied',
                        "description": meta["description"],
                    }
            else:
                result["pipeline_stages"]["fallback"] = {
                    "used": False,
                    "method": "regex",
                    "fields_found": 0,
                }

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
            "region_count": layout.get("region_count", len(layout.get("regions", []))),
            "method":       layout.get("method", "heuristic"),
        }
        result["pipeline_stages"]["gliner"] = {
            "entities_found": len(gliner_entities),
            "fields":         list(gliner_entities.keys()),
        }
        result["pipeline_stages"]["langextract"] = {
            "fields_found": len(lx_fields),
            "additions":    lx_additions,
            "overrides":    lx_overrides,
        }
        result["pipeline_stages"]["multi_document"] = {
            "detected_document_types": multi_doc.get("document_types", []),
            "document_count": len(multi_doc.get("documents", [])),
            "page_classifications": len(multi_doc.get("page_classifications", [])),
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

        # ── Stage 4: Confidence scoring (skipped in fast mode) ───────────
        # In fast mode: Use simple heuristic scores, skip expensive LLM calls
        # In full mode: Use rule-based or Gemini scoring
        
        if fast_mode:
            # Fast mode: rule-based scoring; GLiNER entities now available from
            # the parallel stage so pass them in for span-level confidence boost
            from .confidence_scorer import score_all_fields
            raw_scores = score_all_fields(normalised, gliner_entities)
            field_scores = raw_scores
            cal_deltas = {}
            overall = sum(v for v in raw_scores.values()) / max(len(raw_scores), 1)
            routing = {"queue": "soft_review" if overall >= 0.75 else "hard_review"}
            scorer_used = "rule-based-fast"
            
            result["pipeline_stages"]["confidence"] = {
                "overall":   overall,
                "queue":     routing["queue"],
                "scorer":    scorer_used,
                "fast_mode": True,
            }
        else:
            # Full mode: Use proper confidence scoring
            from .confidence_scorer import (
                score_fields_with_gpt, score_all_fields,
                compute_overall_confidence, route_document,
            )
            from .confidence_trainer import load_calibration, apply_calibration

            _fields_found = result["pipeline_stages"]["extraction"]["fields_found"]
            _doc_conf     = doc_type_result["confidence"]
            _use_fast     = _doc_conf >= 0.85 and _fields_found >= 8

            if _use_fast:
                logger.info(
                    "[M02] High-confidence doc (%.0f%%, %d fields) — rule-based scoring.",
                    _doc_conf * 100, _fields_found,
                )
                raw_scores  = score_all_fields(normalised, gliner_entities)
                scorer_used = "rule-based-fast"
            else:
                raw_scores = score_fields_with_gpt(normalised, ocr_text, self._client)
                if raw_scores is None:
                    logger.info("[M02] GPT confidence unavailable — using rule-based fallback.")
                    raw_scores = score_all_fields(normalised, gliner_entities)
                    scorer_used = "rule-based-fallback"
                else:
                    scorer_used = "gemini-3.1-flash-lite"
                    if self._use_gemini:
                        try:
                            from Orbisporte.infrastructure.get_llm import get_gemini_model_candidates
                            gm = get_gemini_model_candidates()
                            if gm:
                                scorer_used = gm[0]
                        except Exception:
                            pass
            if _seconds_left(t0) < 3.0 and "rule-based" not in scorer_used:
                logger.warning("[M02] Forcing rule-based confidence scoring due to SLA budget.")
                raw_scores = score_all_fields(normalised, gliner_entities)
                scorer_used = "rule-based-sla-fallback"

            calibration              = load_calibration()
            field_scores, cal_deltas = apply_calibration(raw_scores, calibration)
            overall                  = compute_overall_confidence(field_scores)
            routing                  = route_document(overall, field_scores)

            result["pipeline_stages"]["confidence"] = {
                "overall":           overall,
                "queue":             routing["queue"],
                "scorer":            scorer_used,
                "calibrated_fields": len(cal_deltas),
            }

        # ── Stage 5: Assemble output ──────────────────────────────────────
        duration_ms = int((time.time() - t0) * 1000)

        # ── Stage 5: Assemble output ──────────────────────────────────────
        duration_ms = int((time.time() - t0) * 1000)

        result.update({
            "document_type":           doc_type_result["document_type"],
            "document_type_display":   doc_type_result["display_name"],
            "ocr_text":              ocr_text,
            "extracted_fields":      raw_fields,
            "normalised_fields":     normalised,
            "documents":             multi_doc.get("documents", []),
            "document_types":        multi_doc.get("document_types", []),
            "page_classifications":  multi_doc.get("page_classifications", []),
            "gliner_entities":       {k: v["text"] for k, v in gliner_entities.items()},
            "confidence_scores":     field_scores,
            "raw_confidence_scores": raw_scores,
            "calibration_deltas":    cal_deltas,
            "overall_confidence":    overall,
            "review_queue":          routing["queue"],
            "fields_auto":           routing.get("fields_auto", []),
            "fields_soft_review":    routing.get("fields_soft", []),
            "fields_hard_review":    routing.get("fields_hard", []),
            "fields_low":            routing.get("fields_low", []),
            "quality_alert":         routing.get("quality_alert", False),
            "pipeline_duration_ms":  duration_ms,
            "sla_target_ms":        int(_PIPELINE_TARGET_SECONDS * 1000),
            "sla_met":              duration_ms <= int(_PIPELINE_TARGET_SECONDS * 1000),
            "document_quality":      layout["quality"],
            "fast_mode":            fast_mode,
        })

        logger.info(
            "[M02] COMPLETE in %dms — type=%s queue=%s confidence=%.2f fast=%s",
            duration_ms, doc_type_result["document_type"], routing["queue"], overall, fast_mode,
        )
        return result

    # ── Task A: GPT extraction — detect type + extract fields ──────────────

    def _combined_detect_extract(
        self,
        ocr_text: str,
        document_type_hint: Optional[str] = None,
        timeout_s: float = 30.0,  # Increased timeout
    ) -> dict:
        """
        One GPT-4o-mini call that returns both the document type and all fields.
        Uses smart truncation: first LEAD_CHARS + last TAIL_CHARS chars of OCR text.
        Uses GPT-4o-mini for extraction and document type classification.
        """
        from .document_type_detector import DOCUMENT_TYPES, _unknown_result

        if document_type_hint and document_type_hint in DOCUMENT_TYPES:
            pre_doc_type = document_type_hint
        else:
            pre_doc_type = None

        truncated = _smart_truncate(ocr_text)
        prompt = _COMBINED_PROMPT.replace("{text}", truncated)
        raw = {}

        def _extract_with_openai_fallback() -> Dict[str, Any]:
            from Orbisporte.infrastructure.get_llm import openai_client as _oc
            max_retries_local = max(_EXTRACT_RETRIES, 1)
            openai_cli = self._client
            if not hasattr(openai_cli, "chat"):
                openai_cli = _oc()
            for attempt_local in range(max_retries_local):
                try:
                    resp = openai_cli.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0,
                        max_tokens=2000,
                        timeout=timeout_s,
                    )
                    logger.info("[M02] OpenAI fallback extraction succeeded on attempt %d", attempt_local + 1)
                    return json.loads(resp.choices[0].message.content)
                except Exception as exc_local:
                    logger.warning("[M02] OpenAI fallback attempt %d failed: %s", attempt_local + 1, exc_local)
                    if attempt_local < max_retries_local - 1:
                        time.sleep((attempt_local + 1) * 2)
            return {}

        # Use Gemini model from config, otherwise fall back to OpenAI
        if self._use_gemini:
            from Orbisporte.infrastructure.get_llm import Config
            gemini_model = Config.GEMINI_MODEL or "gemini-2.5-pro"
            logger.info(f"[M02] Using {gemini_model} for extraction")
            max_retries = max(_EXTRACT_RETRIES, 1)
            for attempt in range(max_retries):
                try:
                    response = self._client.models.generate_content(
                        model=gemini_model,
                        contents=[{"role": "user", "parts": [{"text": prompt}]}],
                        config={
                            "response_mime_type": "application/json",
                            "temperature": 0,
                            "max_output_tokens": 4000,
                        }
                    )
                    raw_text = response.text if hasattr(response, 'text') else ""
                    raw = json.loads(raw_text)
                    logger.info(f"[M02] {gemini_model} extraction succeeded on attempt %d", attempt + 1)
                    break
                except Exception as exc:
                    logger.warning("[M02] Gemini extraction attempt %d failed: %s", attempt + 1, exc)
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 3
                        logger.info("[M02] Waiting %ds before retry...", wait_time)
                        time.sleep(wait_time)
                    else:
                        logger.error("[M02] Gemini extraction all %d attempts failed; switching to OpenAI fallback", max_retries)
                        raw = _extract_with_openai_fallback()
                        if not raw:
                            return {"doc_type": _unknown_result(), "fields": {}}
        else:
            # Fallback to OpenAI GPT-4o-mini
            logger.info("[M02] Using OpenAI GPT-4o-mini for extraction")
            max_retries = max(_EXTRACT_RETRIES, 1)
            for attempt in range(max_retries):
                try:
                    resp = self._client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0,
                        max_tokens=2000,
                        timeout=timeout_s,
                    )
                    raw = json.loads(resp.choices[0].message.content)
                    logger.info("[M02] GPT extraction succeeded on attempt %d", attempt + 1)
                    break
                except Exception as exc:
                    logger.warning("[M02] GPT extraction attempt %d failed: %s", attempt + 1, exc)
                    if attempt < max_retries - 1:
                        wait_time = (attempt + 1) * 3
                        logger.info("[M02] Waiting %ds before retry...", wait_time)
                        time.sleep(wait_time)
                    else:
                        logger.error("[M02] GPT extraction all %d attempts failed", max_retries)
                        return {"doc_type": _unknown_result(), "fields": {}}

        # ── Unpack document type ──────────────────────────────────────────
        if pre_doc_type:
            doc_type = pre_doc_type
        else:
            doc_type = str(raw.get("document_type", "unknown")).lower().strip()
            if doc_type not in DOCUMENT_TYPES:
                doc_type = "unknown"

        meta = DOCUMENT_TYPES[doc_type]
        reasoning_text = "User-confirmed type" if pre_doc_type else (
            f"Single-pass {gemini_model} classification: {doc_type}" if self._use_gemini
            else f"Single-pass GPT-4o-mini classification: {doc_type}"
        )
        doc_type_result = {
            "document_type": doc_type,
            "display_name":  meta["display_name"],
            "icon":          meta["icon"],
            "color":         meta["color"],
            "confidence":    round(float(raw.get("doc_confidence", 0.9 if pre_doc_type else 0.5)), 3),
            "signals":       raw.get("doc_signals", [])[:8],
            "reasoning":     reasoning_text,
            "description":   meta["description"],
        }

        # Heuristic validation: only use as fallback when LLM is uncertain
        # Don't override if LLM already has high confidence
        from .document_type_detector import _heuristic_detect
        heuristic = _heuristic_detect(ocr_text)
        
        # Only override if LLM returned unknown OR very low confidence (< 0.35)
        # Don't override if GPT already has reasonable confidence
        if heuristic and (
            doc_type_result["document_type"] == "unknown" or
            doc_type_result["confidence"] < 0.35
        ):
            if heuristic["confidence"] >= 0.75:  # Higher threshold for override
                doc_type_result = heuristic
                logger.info("[DocType] Heuristic override applied: %s", doc_type_result["document_type"])

        # ── Unpack fields ─────────────────────────────────────────────────
        raw_fields = raw.get("fields", {})
        if not isinstance(raw_fields, dict):
            raw_fields = {}

        clean_fields = {
            k: (None if str(v).strip().lower() in ("null", "none", "n/a", "") else v)
            for k, v in raw_fields.items()
            if not k.startswith("_") and not isinstance(v, dict)
        }

        # Resolve AWB vs B/L ambiguity with deterministic transport signals.
        adjusted_doc_type = _disambiguate_transport_doc_type(
            ocr_text=ocr_text,
            raw_fields=clean_fields,
            current_doc_type=doc_type_result["document_type"],
        )
        if adjusted_doc_type != doc_type_result["document_type"]:
            from .document_type_detector import DOCUMENT_TYPES
            meta = DOCUMENT_TYPES.get(adjusted_doc_type, DOCUMENT_TYPES["unknown"])
            doc_type_result = {
                **doc_type_result,
                "document_type": adjusted_doc_type,
                "display_name": meta["display_name"],
                "icon": meta["icon"],
                "color": meta["color"],
                "reasoning": f'{doc_type_result.get("reasoning", "")} | transport disambiguation applied',
            }

        return {"doc_type": doc_type_result, "fields": clean_fields}

    @staticmethod
    def _has_value(value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return value.strip().lower() not in ("", "null", "none", "n/a")
        if isinstance(value, list):
            return len(value) > 0
        return True

    def _merge_field_dicts(self, base: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two field dictionaries, keeping the best value for each field.
        Priority: longer non-null value wins.
        For line_items: concatenate and deduplicate.
        """
        merged = dict(base or {})
        
        for key, value in (incoming or {}).items():
            # Skip internal keys
            if key.startswith("_"):
                continue
                
            # Handle line_items specially - concatenate all items
            if key == "line_items":
                current_items = merged.get("line_items", [])
                if not isinstance(current_items, list):
                    current_items = []
                    
                new_items = value if isinstance(value, list) else []
                
                # Deduplicate items using a stable signature so repeated line
                # descriptions with different qty/rates are not collapsed.
                seen = set()
                unique_items = []
                for item in current_items + new_items:
                    if not isinstance(item, dict):
                        continue
                    sig = (
                        str(item.get("description") or item.get("goods_description") or item.get("product_description") or "").strip().lower(),
                        str(item.get("hsn_code") or item.get("hs_code") or "").strip(),
                        str(item.get("quantity") or "").strip(),
                        str(item.get("unit") or "").strip().lower(),
                        str(item.get("unit_price") or "").strip(),
                        str(item.get("total_price") or item.get("total_value") or "").strip(),
                    )
                    if sig not in seen:
                        seen.add(sig)
                        unique_items.append(item)
                        
                if unique_items:
                    merged["line_items"] = unique_items
                continue
            
            # Skip null/empty values
            if not self._has_value(value):
                continue
                
            current = merged.get(key)
            
            # If base doesn't have this field, take incoming value
            if not self._has_value(current):
                merged[key] = value
                continue

            # If both have values, keep the longer/more complete one
            if isinstance(current, str) and isinstance(value, str):
                # Strip and compare lengths
                current_clean = current.strip()
                value_clean = value.strip()
                # If incoming is significantly longer, use it
                if len(value_clean) > len(current_clean) * 1.2:
                    merged[key] = value
                # If current is just numbers/dates and incoming has more context, use incoming
                elif len(current_clean) <= 20 and len(value_clean) > len(current_clean):
                    merged[key] = value
            elif isinstance(current, str) and isinstance(value, (int, float)):
                # Prefer structured numeric values produced by normalisation.
                merged[key] = value

        return merged

    def _extract_multi_document_pages(
        self,
        pages: list[str],
        page_indices: Optional[list[int]] = None,
    ) -> Dict[str, Any]:
        """
        Run page-wise document classification/extraction and return merged segments.
        This enables mixed uploads (invoice + BL + packing list + AWB) in one PDF.

        Pages are processed IN PARALLEL (previously serial, one GPT call per page
        blocking the next — a 5-page doc wasted ~2–4 s here).  Max 6 concurrent
        calls to avoid OpenAI rate-limit bursts.
        """
        if not pages:
            return {"documents": [], "document_types": [], "page_classifications": [], "merged_fields": {}}

        # Skip per-page calls for single-page documents: the main extraction call
        # already processed the full text, so there is nothing more to gain.
        valid_pages = []
        for local_idx, p in enumerate(pages, start=1):
            page_text = _preprocess_ocr_text((p or "").strip())["text"]
            if page_text and len(page_text) >= 30:
                if isinstance(page_indices, list) and (local_idx - 1) < len(page_indices):
                    page_number = int(page_indices[local_idx - 1]) + 1
                else:
                    page_number = local_idx
                valid_pages.append((page_number, page_text))
        if not valid_pages:
            return {"documents": [], "document_types": [], "page_classifications": [], "merged_fields": {}}
        if len(valid_pages) == 1:
            return {"documents": [], "document_types": [], "page_classifications": [], "merged_fields": {}}

        def _extract_page(idx_text):
            idx, text = idx_text
            try:
                extracted = self._combined_detect_extract(text)
                doc    = extracted.get("doc_type", {})
                fields = extracted.get("fields", {})
                return {
                    "page_number":            idx,
                    "document_type":          doc.get("document_type", "unknown"),
                    "document_type_display":  doc.get("display_name", "Unknown"),
                    "confidence":             float(doc.get("confidence", 0.0) or 0.0),
                    "fields":                 fields if isinstance(fields, dict) else {},
                }
            except Exception as exc:
                logger.warning("[M02] Page-level extraction failed for page %d: %s", idx, exc)
                return None

        page_rows = []
        with ThreadPoolExecutor(max_workers=min(len(valid_pages), 6)) as pool:
            futures = {pool.submit(_extract_page, iv): iv[0] for iv in valid_pages}
            for fut in as_completed(futures):
                row = fut.result()
                if row:
                    page_rows.append(row)

        page_rows.sort(key=lambda r: r["page_number"])

        if not page_rows:
            return {"documents": [], "document_types": [], "page_classifications": [], "merged_fields": {}}

        # Smooth noisy page labels:
        # If an "unknown" page sits between same-type neighbors, treat it as continuation.
        for i, row in enumerate(page_rows):
            if row.get("document_type") != "unknown":
                continue
            prev_row = page_rows[i - 1] if i > 0 else None
            next_row = page_rows[i + 1] if i + 1 < len(page_rows) else None
            if not prev_row or not next_row:
                continue
            prev_type = prev_row.get("document_type")
            next_type = next_row.get("document_type")
            prev_page = int(prev_row.get("page_number", -999))
            cur_page = int(row.get("page_number", -998))
            next_page = int(next_row.get("page_number", -997))
            if (
                prev_type
                and prev_type == next_type
                and prev_type != "unknown"
                and prev_page + 1 == cur_page
                and cur_page + 1 == next_page
            ):
                row["document_type"] = prev_type
                row["document_type_display"] = prev_row.get("document_type_display", row.get("document_type_display", "Unknown"))
                row["confidence"] = max(float(row.get("confidence", 0.0) or 0.0), min(float(prev_row.get("confidence", 0.0) or 0.0), float(next_row.get("confidence", 0.0) or 0.0)) * 0.9)

        # Build contiguous segments so mixed documents are preserved even when
        # the same type reappears later in the file.
        segments: list[list[Dict[str, Any]]] = []
        current_segment: list[Dict[str, Any]] = []
        for row in page_rows:
            if not current_segment:
                current_segment.append(row)
                continue
            prev = current_segment[-1]
            same_type = row["document_type"] == prev["document_type"]
            contiguous = row["page_number"] == (prev["page_number"] + 1)
            if same_type and contiguous:
                current_segment.append(row)
            else:
                segments.append(current_segment)
                current_segment = [row]
        if current_segment:
            segments.append(current_segment)

        documents = []
        for segment in segments:
            first = segment[0]
            pages_sorted = [r["page_number"] for r in segment]
            merged_fields: Dict[str, Any] = {}
            conf_sum = 0.0
            for r in segment:
                conf_sum += float(r.get("confidence", 0.0) or 0.0)
                merged_fields = self._merge_field_dicts(merged_fields, r.get("fields", {}))

            avg_conf = round(conf_sum / max(len(segment), 1), 3)
            documents.append({
                "document_type": first["document_type"],
                "document_type_display": first["document_type_display"],
                "pages": pages_sorted,
                "page_start": pages_sorted[0],
                "page_end": pages_sorted[-1],
                "page_count": len(pages_sorted),
                "confidence": avg_conf,
                "fields": merged_fields,
            })

        documents.sort(key=lambda d: d["page_start"])
        document_types = []
        for d in documents:
            if d["document_type"] not in document_types:
                document_types.append(d["document_type"])

        merged_fields: Dict[str, Any] = {}
        for doc in documents:
            merged_fields = self._merge_field_dicts(merged_fields, doc.get("fields", {}))

        known_docs = [d for d in documents if d.get("document_type") != "unknown"]
        
        # Primary selection: prefer commercial_invoice > packing_list > other types
        # when page counts are similar (within 1 page)
        def doc_priority(d):
            doc_type = d.get("document_type", "")
            page_count = d.get("page_count", 0)
            conf = d.get("confidence", 0.0)
            # Priority order: commercial_invoice (highest), then packing_list, then others
            type_priority = {
                "commercial_invoice": 100,
                "packing_list": 80,
                "bill_of_lading": 60,
                "air_waybill": 60,
                "proforma_invoice": 70,
                "purchase_order": 50,
                "certificate_of_origin": 40,
                "customs_declaration": 30,
                "letter_of_credit": 20,
                "unknown": 0,
            }
            return (type_priority.get(doc_type, 10), page_count, conf)
        
        primary = max(known_docs, key=doc_priority) if known_docs else (
            max(documents, key=lambda d: (d["page_count"], d["confidence"])) if documents else None
        )

        return {
            "documents": documents,
            "document_types": document_types,
            "page_classifications": [
                {
                    "page_number": r["page_number"],
                    "document_type": r["document_type"],
                    "document_type_display": r["document_type_display"],
                    "confidence": r["confidence"],
                }
                for r in page_rows
            ],
            "merged_fields": merged_fields,
            "primary_document_type": primary["document_type"] if primary else None,
            "primary_confidence": primary["confidence"] if primary else 0.0,
        }

    # ── Task B: LayoutLMv3 layout detection ──────────────────────────────

    def _layout_lmv3(self, file_path: str, ocr_text: str) -> dict:
        """
        Layout detection using LayoutLMv3 (microsoft/layoutlmv3-base).

        Jointly encodes text + 2D bounding boxes + image patches to classify
        each PyMuPDF block into a document region (header, sender_info,
        receiver_info, line_items_table, totals, payment_terms, footer).
        Falls back to keyword + position heuristics when the model is not yet
        loaded or the document has no native text layer.

        Called in parallel with GPT extraction and GLiNER — adds ~0 net
        latency because it completes before the GPT call returns.
        """
        try:
            from .layout_detector import detect_layout
            return detect_layout(file_path, ocr_text)
        except Exception as exc:
            logger.warning("[M02] LayoutLMv3 layout detection failed: %s", exc)
            from pathlib import Path
            pdf_blocks: list = []
            if Path(file_path).suffix.lower() == ".pdf":
                try:
                    from .layout_detector import detect_layout_from_pdf
                    pdf_blocks = detect_layout_from_pdf(file_path)
                except Exception:
                    pass
            return _layout_from_text(ocr_text, pdf_blocks)

    # ── Task C: GLiNER — non-blocking, 4 s hard cap via thread timeout ───

    def _gliner_safe(self, ocr_text: str, pages: list = None) -> dict:
        """Run GLiNER across all pages for comprehensive NER coverage."""
        try:
            from .entity_extractor import extract_entities
            return extract_entities(ocr_text, pages=pages)
        except Exception as exc:
            logger.warning("[M02] GLiNER error: %s", exc)
            return {}

    # ── Task D: LangExtract — chunked span-level extraction ──────────────
    # Runs in parallel with Task A.  Handles long documents without the
    # head+tail smart-truncation workaround needed by the single GPT call.
    # Results are merged into raw_fields after the fan-out completes.

    def _langextract_fields(
        self,
        ocr_text: str,
        max_char_buffer: int = 8000,
        max_workers: int = 4,
    ) -> dict:
        """
        Extract fields using GPT-4o-mini with chunking.

        Returns {field_name: value} for all fields found, or {} on failure.
        Timeout is enforced by the caller via ThreadPoolExecutor.
        """
        try:
            from .langextract_extractor import extract_fields
            import os
            api_key = os.getenv("OPENAI_API_KEY")
            return extract_fields(
                ocr_text,
                openai_api_key=api_key,
                max_char_buffer=max_char_buffer,
                max_workers=max_workers,
                prefer_gemini=self._use_gemini,
            )
        except Exception as exc:
            logger.warning("[M02] LangExtract task error: %s", exc)
            return {}

    # ── Simplified extraction: essential fields only, no confidence scores ─────

    # Essential fields - the only fields that should appear in the output
    ESSENTIAL_FIELDS = {
        "invoice_number", "invoice_date", "exporter_name", "exporter_address",
        "importer_name", "importer_address", "gst_number", "iec_number",
        "shipment_address", "hsn_code", "goods_description", "quantity",
        "unit", "unit_price", "currency", "total_value", "freight",
        "insurance", "cif_value", "country_of_origin", "port_of_loading",
        "port_of_discharge", "shipment_date", "payment_terms", "incoterms",
        "bill_of_lading_number", "awb_number", "container_number",
        "vessel_name", "purchase_order_number", "flight_number", "line_items",
    }

    # Line item fields to keep
    LINE_ITEM_FIELDS = {
        "description", "goods_description", "product_description", "hsn_code",
        "hs_code", "quantity", "unit", "unit_price", "total_price",
        "country_of_origin", "sku", "part_number", "item_number",
    }

    def extract_essential(self, file_path: str, document_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Extract only essential fields, with robust mixed multi-page support.
        Uses the full M02 pipeline internally so multi-document uploads
        (invoice + BL + packing list + AWB in one file) are handled reliably.

        Returns:
            {
                "document_type": str,
                "fields": { <field_name>: <value>, ... },
                "line_items": [ { <field>: <value>, ... }, ... ],
                "documents": [
                    {
                        "document_type": str,
                        "pages": [int, ...],
                        "fields": { ... },
                        "line_items": [ ... ]
                    }
                ],
                "document_types": [str, ...],
                "page_classifications": [ {"page_number": int, "document_type": str}, ... ]
            }
        """
        import os

        def _is_present(value: Any) -> bool:
            if value is None:
                return False
            if isinstance(value, str):
                return value.strip().lower() not in ("", "null", "none", "n/a")
            if isinstance(value, list):
                return len(value) > 0
            return True

        def _extract_clean_fields(source: Dict[str, Any]) -> Dict[str, Any]:
            clean: Dict[str, Any] = {}
            for key in self.ESSENTIAL_FIELDS:
                if key == "line_items":
                    continue
                value = source.get(key)
                if _is_present(value):
                    clean[key] = value
            return clean

        def _extract_clean_line_items(source: Dict[str, Any]) -> list[Dict[str, Any]]:
            line_items = source.get("line_items") or []
            if not isinstance(line_items, list):
                return []
            clean_items = []
            for item in line_items:
                if not isinstance(item, dict):
                    continue
                clean_item: Dict[str, Any] = {}
                for field in self.LINE_ITEM_FIELDS:
                    value = item.get(field)
                    if _is_present(value):
                        clean_item[field] = value
                if clean_item:
                    clean_items.append(clean_item)
            return clean_items

        def _count_present(fields: Dict[str, Any]) -> int:
            return sum(1 for _, value in (fields or {}).items() if _is_present(value))

        def _infer_doc_type_from_fields(fields: Dict[str, Any], fallback_doc_type: str = "unknown") -> str:
            if _is_present(fields.get("awb_number")) or _is_present(fields.get("flight_number")):
                return "air_waybill"
            if any(_is_present(fields.get(k)) for k in ("bill_of_lading_number", "vessel_name", "container_number")):
                return "bill_of_lading"
            if any(_is_present(fields.get(k)) for k in ("invoice_number", "invoice_date", "gst_number", "iec_number")):
                return "commercial_invoice"
            return fallback_doc_type or "unknown"

        def _pipeline_weak(pipeline_result: Dict[str, Any]) -> bool:
            fields = pipeline_result.get("extracted_fields") or {}
            normalised = pipeline_result.get("normalised_fields") or {}
            merged = self._merge_field_dicts(fields, normalised)
            field_count = _count_present(merged)
            doc_type = pipeline_result.get("document_type", "unknown")
            return field_count < 8 or doc_type == "unknown"

        # Resolve file path
        if not os.path.exists(file_path):
            possible_paths = [
                file_path,
                os.path.join("uploads", os.path.basename(file_path)),
                os.path.join("data", "uploads", os.path.basename(file_path)),
                os.path.join("Orbisporte", "uploads", os.path.basename(file_path)),
            ]

            found_path = None
            for p in possible_paths:
                if os.path.exists(p):
                    found_path = p
                    break

            if not found_path:
                logger.warning(f"[Essential Extraction] File not found: {file_path}")
                return {
                    "document_type": "commercial_invoice",
                    "fields": {},
                    "line_items": [],
                    "documents": [],
                    "document_types": [],
                    "page_classifications": [],
                    "note": "Document file not found on server"
                }

            file_path = found_path

        try:
            from .field_normalizer import normalise_fields

            # First pass: fast but complete branch set.
            pipeline = self.process(
                file_path=file_path,
                document_id=document_id,
                fast_mode=True,
                enable_layout=True,
                enable_gliner=True,
            )

            # Reliability fallback pass when first pass is weak.
            if _pipeline_weak(pipeline):
                logger.warning("[Essential Extraction] Weak first-pass result; retrying with robust mode.")
                retry_pipeline = self.process(
                    file_path=file_path,
                    document_id=document_id,
                    fast_mode=False,
                    enable_layout=True,
                    enable_gliner=True,
                )
                if not _pipeline_weak(retry_pipeline):
                    pipeline = retry_pipeline
                else:
                    # Keep whichever has more populated fields.
                    p1_fields = self._merge_field_dicts(
                        pipeline.get("extracted_fields") or {},
                        pipeline.get("normalised_fields") or {},
                    )
                    p2_fields = self._merge_field_dicts(
                        retry_pipeline.get("extracted_fields") or {},
                        retry_pipeline.get("normalised_fields") or {},
                    )
                    if _count_present(p2_fields) > _count_present(p1_fields):
                        pipeline = retry_pipeline

            extracted_fields = pipeline.get("extracted_fields") or {}
            normalised_fields = pipeline.get("normalised_fields") or {}
            merged_fields = self._merge_field_dicts(extracted_fields, normalised_fields)

            fields_output = _extract_clean_fields(merged_fields)
            clean_line_items = _extract_clean_line_items(merged_fields)

            # Auto-lookup HSN codes if no HSN code found in document
            current_hsn = fields_output.get("hsn_code") or fields_output.get("hs_code")
            if not current_hsn:
                try:
                    from Orbisporte.domain.services.hsn_search_service import search_hsn

                    product_desc = None
                    if clean_line_items:
                        first_item = clean_line_items[0]
                        product_desc = (
                            first_item.get("description")
                            or first_item.get("goods_description")
                            or first_item.get("product_description")
                            or first_item.get("name")
                        )
                    if not product_desc:
                        product_desc = (
                            fields_output.get("goods_description")
                            or fields_output.get("product_description")
                            or fields_output.get("description")
                            or fields_output.get("product")
                        )

                    if product_desc and len(str(product_desc)) > 3:
                        logger.info(f"[Essential] Auto-searching HSN for: {str(product_desc)[:100]}")
                        hsn_result = search_hsn(str(product_desc))
                        if hsn_result and hsn_result.get("selected_hsn"):
                            found_hsn = hsn_result["selected_hsn"]
                            logger.info(f"[Essential] Found HSN {found_hsn}")
                            fields_output["hsn_code"] = found_hsn
                except Exception as hsn_err:
                    logger.warning(f"[Essential] HSN auto-lookup failed: {hsn_err}")

            # Build essential per-document entries for mixed-content files.
            documents = []
            for doc in pipeline.get("documents", []) or []:
                doc_fields_raw = doc.get("fields", {}) if isinstance(doc, dict) else {}
                if not isinstance(doc_fields_raw, dict):
                    doc_fields_raw = {}
                doc_fields_norm = normalise_fields(doc_fields_raw)
                doc_merged = self._merge_field_dicts(doc_fields_raw, doc_fields_norm)
                documents.append({
                    "document_type": doc.get("document_type", "unknown"),
                    "document_type_display": doc.get("document_type_display", "Unknown"),
                    "pages": doc.get("pages", []),
                    "page_start": doc.get("page_start"),
                    "page_end": doc.get("page_end"),
                    "page_count": doc.get("page_count", 0),
                    "fields": _extract_clean_fields(doc_merged),
                    "line_items": _extract_clean_line_items(doc_merged),
                })

            result_doc_type = pipeline.get("document_type", "unknown")
            if result_doc_type == "unknown":
                result_doc_type = _infer_doc_type_from_fields(fields_output, fallback_doc_type=result_doc_type)

            result_document_types = pipeline.get("document_types", []) or []
            if not result_document_types and result_doc_type and result_doc_type != "unknown":
                result_document_types = [result_doc_type]

            # Ensure only essential fields are returned.
            fields_output = _extract_clean_fields(fields_output)

            # Guarantee at least one document block for consumers that expect
            # per-document entries even when multi-doc segmentation is absent.
            if not documents:
                documents = [{
                    "document_type": result_doc_type or "unknown",
                    "document_type_display": pipeline.get("document_type_display", "Unknown"),
                    "pages": [],
                    "page_start": None,
                    "page_end": None,
                    "page_count": (
                        (pipeline.get("pipeline_stages", {}) or {})
                        .get("ocr", {})
                        .get("source_page_count", 0)
                    ) or 0,
                    "fields": dict(fields_output),
                    "line_items": list(clean_line_items),
                }]

            return {
                "document_type": result_doc_type,
                "fields": fields_output,
                "line_items": clean_line_items,
                "documents": documents,
                "document_types": result_document_types,
                "page_classifications": [
                    {
                        "page_number": r.get("page_number"),
                        "document_type": r.get("document_type"),
                        "document_type_display": r.get("document_type_display"),
                    }
                    for r in (pipeline.get("page_classifications", []) or [])
                    if isinstance(r, dict)
                ],
                "source_page_count": (
                    (pipeline.get("pipeline_stages", {}) or {})
                    .get("ocr", {})
                    .get("source_page_count")
                ),
            }
        except Exception as e:
            logger.exception(f"[Essential Extraction] Extraction failed: {e}")
            return {
                "document_type": "commercial_invoice",
                "fields": {},
                "line_items": [],
                "documents": [],
                "document_types": [],
                "page_classifications": [],
                "note": f"Extraction encountered an error: {str(e)}"
            }
