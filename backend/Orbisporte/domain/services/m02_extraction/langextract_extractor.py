"""
M02 LangExtract Extractor — chunked field extraction via Gemini (or GPT-4o-mini fallback).

Uses high-performance Gemini models for accurate field extraction from trade documents.
Implements chunking strategy similar to langextract for handling long documents.

Advantages:
   • Fast extraction using Gemini Flash models (~300-1200ms per chunk)
   • Chunking handles documents longer than model context limits
   • Parallel chunk processing for faster results
   • Structured JSON output with field-level confidence

Integration note:
   This extractor runs in parallel alongside the main extraction call.
   Results are merged with main extraction values taking priority.
"""

import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────
# LangExtract uses GPT-4o-mini as the primary extraction model (cost-efficient,
# consistently fast, and avoids Gemini quota limits during heavy batch runs).
# Set LANGEXTRACT_USE_GEMINI=1 in the environment to switch back to Gemini.
_LANGEXTRACT_MODEL = "gpt-4o-mini"
_USE_GEMINI = os.getenv("LANGEXTRACT_USE_GEMINI", "0").strip().lower() in ("1", "true", "yes", "on")

# Increased buffer size for multi-page documents to capture more content per chunk
_LANGEXTRACT_CHUNK_SIZE = int(os.getenv("LANGEXTRACT_CHUNK_SIZE", "12000"))
_LANGEXTRACT_MAX_TOKENS = int(os.getenv("LANGEXTRACT_MAX_TOKENS", "800"))


def _get_llm_client():
    """Get LLM client - prefer Gemini."""
    global _USE_GEMINI
    if _USE_GEMINI:
        try:
            from Orbisporte.infrastructure.get_llm import gemini_client
            return gemini_client()
        except Exception as e:
            logger.warning(f"[LangExtract] Gemini client failed: {e}, falling back to OpenAI")
            _USE_GEMINI = False
    
    from Orbisporte.infrastructure.get_llm import openai_client
    return openai_client()


def _get_gemini_models() -> List[str]:
    from Orbisporte.infrastructure.get_llm import get_gemini_model_candidates
    models = get_gemini_model_candidates()
    return models or ["gemini-2.5-flash"]


# ── Extraction prompt for Gemini ─────────────────────────────────────────────

_PROMPT_TEMPLATE = """You are an expert trade document field extractor. Extract structured fields from this document text.

For each field found, provide the exact text as it appears in the document.

Fields to extract:
- invoice_number: Invoice or document reference number
- invoice_date: Invoice date (prefer YYYY-MM-DD)
- exporter_name: Name of the exporter/seller/shipper
- exporter_address: Full address of the exporter
- importer_name: Name of the importer/buyer/consignee
- importer_address: Full address of the importer
- gst_number: GST/GSTIN number (15-char Indian tax ID)
- iec_number: IEC number (10-digit)
- shipment_address: Destination/delivery address
- hsn_code: HSN/HS tariff code (4-8 digits)
- goods_description: Description of goods or products
- quantity: Numeric quantity value only
- unit: Unit of measure (PCS, KGS, MTR, NOS, SET)
- unit_price: Unit price numeric only
- currency: 3-letter ISO currency code (USD, INR, EUR)
- total_value: Total invoice value numeric only
- freight: Freight/shipping charges numeric only
- insurance: Insurance charges numeric only
- cif_value: CIF total value numeric only
- country_of_origin: 2-letter ISO country code
- port_of_loading: Port of loading/origin
- port_of_discharge: Port of discharge/destination
- shipment_date: Shipment/dispatch date
- payment_terms: Payment terms
- incoterms: Incoterms code (CIF, FOB, EXW, DAP, DDP)
- bill_of_lading_number: Bill of lading reference
- awb_number: Air waybill number
- container_number: Shipping container number
- vessel_name: Name of vessel/ship
- purchase_order_number: Purchase order reference
- flight_number: Flight number for air shipments

Document text (chunk):
{chunk_text}

Return a JSON object with only the fields you found. Use null for fields not present.
Example: {{"invoice_number": "INV-2024-001", "invoice_date": "2024-03-15", "hsn_code": "85171290"}}
"""

# ── Field name normalisation ──────────────────────────────────────────────────

_CLASS_TO_FIELD: Dict[str, str] = {
    "invoice_number":        "invoice_number",
    "invoice_date":          "invoice_date",
    "exporter_name":         "exporter_name",
    "exporter_address":      "exporter_address",
    "importer_name":         "importer_name",
    "importer_address":      "importer_address",
    "gst_number":            "gst_number",
    "iec_number":            "iec_number",
    "shipment_address":      "shipment_address",
    "hsn_code":              "hsn_code",
    "goods_description":     "goods_description",
    "quantity":              "quantity",
    "unit":                  "unit",
    "unit_price":            "unit_price",
    "currency":              "currency",
    "total_value":           "total_value",
    "freight":               "freight",
    "insurance":             "insurance",
    "cif_value":             "cif_value",
    "country_of_origin":     "country_of_origin",
    "port_of_loading":       "port_of_loading",
    "port_of_discharge":     "port_of_discharge",
    "shipment_date":         "shipment_date",
    "payment_terms":         "payment_terms",
    "incoterms":             "incoterms",
    "bill_of_lading_number": "bill_of_lading_number",
    "awb_number":            "awb_number",
    "container_number":      "container_number",
    "vessel_name":           "vessel_name",
    "purchase_order_number": "purchase_order_number",
    "flight_number":         "flight_number",
}

_NULL_VALUES = {"none", "null", "n/a", "na", "-", "", "not applicable", "unknown"}


def _chunk_text(text: str, chunk_size: int = None, overlap: int = 300) -> List[str]:
    """
    Split text into overlapping chunks for parallel processing.
    
    Args:
        text: Full text to chunk
        chunk_size: Maximum characters per chunk (default from _LANGEXTRACT_CHUNK_SIZE)
        overlap: Overlapping characters between chunks
    
    Returns:
        List of text chunks
    """
    if chunk_size is None:
        chunk_size = _LANGEXTRACT_CHUNK_SIZE
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = min(start + chunk_size, len(text))
        
        # Try to break at sentence or paragraph boundary
        if end < len(text):
            # Look for paragraph break first, then sentence
            break_point = text.rfind('\n\n', start, end)
            if break_point > start:
                end = break_point + 2
            else:
                break_point = text.rfind('. ', start, end)
                if break_point > start:
                    end = break_point + 2
        
        chunks.append(text[start:end])
        start = end - overlap if end < len(text) else end
    
    return chunks


def _extract_chunk(chunk_text: str, chunk_idx: int, client, gemini_models: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Extract fields from a single text chunk using Gemini with retry logic.

    Args:
        chunk_text: Text chunk to process
        chunk_idx: Index of the chunk (for logging)
        client: LLM client (Gemini or OpenAI)

    Returns:
        Dictionary of extracted fields
    """
    global _USE_GEMINI
    max_retries = 2
    
    for attempt in range(max_retries):
        try:
            prompt = _PROMPT_TEMPLATE.replace("{chunk_text}", chunk_text)

            if _USE_GEMINI:
                raw = {}
                last_error: Optional[Exception] = None
                model_candidates = gemini_models or _get_gemini_models()
                for model_name in model_candidates:
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=[{"role": "user", "parts": [{"text": prompt}]}],
                            config={
                                "response_mime_type": "application/json",
                                "temperature": 0,
                                "max_output_tokens": 1000,
                            }
                        )
                        raw_text = response.text if hasattr(response, 'text') else ""
                        raw = json.loads(raw_text)
                        break
                    except Exception as exc:
                        last_error = exc
                        logger.warning("[LangExtract] Chunk %d model %s failed: %s", chunk_idx, model_name, exc)
                        continue
                if not raw:
                    if last_error is not None:
                        raise last_error
                    return {}
            else:
                # Fallback to OpenAI
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0,
                    max_tokens=1000,
                    timeout=30.0,
                )
                raw = json.loads(response.choices[0].message.content)
            
            if not isinstance(raw, dict):
                return {}
            
            # Clean up null values
            cleaned = {}
            for field, value in raw.items():
                if value is None:
                    continue
                val_str = str(value).strip()
                if val_str.lower() in _NULL_VALUES or not val_str:
                    continue
                cleaned[field] = value
            
            logger.info(f"[LangExtract] Chunk {chunk_idx}: extracted {len(cleaned)} fields")
            return cleaned
            
        except json.JSONDecodeError as exc:
            logger.warning(f"[LangExtract] Chunk {chunk_idx}: JSON parse error (attempt {attempt + 1}): {exc}")
            if attempt == max_retries - 1:
                return {}
        except Exception as exc:
            logger.warning(f"[LangExtract] Chunk {chunk_idx}: extraction failed (attempt {attempt + 1}): {exc}")
            if attempt == max_retries - 1:
                return {}
            # Wait before retry
            time.sleep(2 * (attempt + 1))
    
    return {}


def extract_fields(
    ocr_text: str,
    openai_api_key: Optional[str] = None,
    max_char_buffer: int = None,
    max_workers: int = 4,
    prefer_gemini: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Extract trade document fields from OCR text using Gemini.

    Uses chunking strategy to handle long documents efficiently.
    Parallel processing of chunks for faster results.

    Parameters
    ----------
    ocr_text:
        Full OCR text from the document.
    openai_api_key:
        OpenAI API key. Falls back to OPENAI_API_KEY env var.
    max_char_buffer:
        Characters per chunk sent to LLM. Default from _LANGEXTRACT_CHUNK_SIZE.
        Larger chunks = better extraction for multi-page documents.
    max_workers:
        Maximum parallel API calls for multi-chunk documents.

    Returns
    -------
    dict:
        ``{field_name: extracted_value}`` for all discovered fields.
        Empty dict on failure or when no fields are found.
    """
    global _USE_GEMINI

    if prefer_gemini is not None:
        _USE_GEMINI = bool(prefer_gemini)
    
    if max_char_buffer is None:
        max_char_buffer = _LANGEXTRACT_CHUNK_SIZE
    if not ocr_text or len(ocr_text.strip()) < 20:
        return {}

    try:
        # Get the appropriate LLM client
        client = _get_llm_client()
        
        gemini_models = _get_gemini_models() if _USE_GEMINI else []
        if _USE_GEMINI:
            logger.info("[LangExtract] Using Gemini models for extraction: %s", gemini_models)
        else:
            logger.info("[LangExtract] Using OpenAI GPT-4o-mini for extraction")

        # Split text into overlapping chunks
        chunks = _chunk_text(ocr_text, chunk_size=max_char_buffer, overlap=200)

        if not chunks:
            return {}

        logger.info(
            "[LangExtract] Processing %d chunks with %s",
            len(chunks), _LANGEXTRACT_MODEL
        )

        # Process chunks in parallel
        all_results: List[Dict[str, Any]] = []

        if len(chunks) == 1:
            # Single chunk - no need for parallel processing
            all_results.append(_extract_chunk(chunks[0], 0, client, gemini_models))
        else:
            # Multiple chunks - process in parallel with shared client
            with ThreadPoolExecutor(max_workers=min(max_workers, len(chunks))) as executor:
                futures = {
                    executor.submit(_extract_chunk, chunk, idx, client, gemini_models): idx
                    for idx, chunk in enumerate(chunks)
                }

                for future in as_completed(futures):
                    try:
                        result = future.result(timeout=8)
                        if result:
                            all_results.append(result)
                    except Exception as exc:
                        chunk_idx = futures[future]
                        logger.warning(f"[LangExtract] Chunk {chunk_idx} failed: {exc}")

        if not all_results:
            logger.info("[LangExtract] No extractions returned.")
            return {}

        # Merge results - keep longest value per field (more complete text)
        merged: Dict[str, str] = {}
        for result in all_results:
            for field, value in result.items():
                if field not in _CLASS_TO_FIELD:
                    continue
                    
                normalized_field = _CLASS_TO_FIELD[field]
                val_str = str(value).strip()
                
                if not val_str or val_str.lower() in _NULL_VALUES:
                    continue
                
                # Keep longer value (more complete across chunks)
                if normalized_field not in merged or len(val_str) > len(str(merged[normalized_field])):
                    merged[normalized_field] = val_str

        total_extractions = sum(len(r) for r in all_results)
        logger.info(
            "[LangExtract] Extracted %d fields from %d chunks (%d total extractions)",
            len(merged), len(chunks), total_extractions,
        )
        return merged

    except Exception as exc:
        logger.warning("[LangExtract] Extraction failed: %s", exc)
        return {}
