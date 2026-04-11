"""
M02 Gemini Extraction Service - Uses Google's Gemini for document extraction.

This module provides Gemini-based OCR and field extraction for trade documents.
It uses a high-performance Gemini model with automatic fallbacks.
"""

import base64
import json
import logging
import os
import time
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = int(os.getenv("M02_GEMINI_TIMEOUT", "120"))
_MAX_RETRIES = 3


def _get_gemini_client():
    """Get or create Gemini client."""
    from Orbisporte.infrastructure.get_llm import gemini_client
    return gemini_client()


def _get_gemini_models() -> List[str]:
    """Ordered Gemini model candidates for resilient extraction."""
    from Orbisporte.infrastructure.get_llm import get_gemini_model_candidates
    models = get_gemini_model_candidates()
    return models or ["gemini-2.5-flash"]


def _render_page_to_image(file_path: str, page_num: int, dpi: int = 150) -> Optional[bytes]:
    """Render a PDF page to image bytes using PyMuPDF."""
    try:
        import fitz
        doc = fitz.open(file_path)
        if page_num >= len(doc):
            doc.close()
            return None
        
        page = doc[page_num]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        img_bytes = pix.tobytes("png")
        doc.close()
        return img_bytes
    except Exception as exc:
        logger.warning(f"[Gemini-OCR] Failed to render page {page_num}: {exc}")
        return None


def run_gemini_ocr(file_path: str, max_pages: int = 0) -> Dict[str, Any]:
    """
    Extract text from a document using Gemini vision model.
    
    Args:
        file_path: Path to the PDF or image file
        max_pages: Maximum pages to process
    
    Returns:
        {
            "text": combined text from all pages,
            "pages": list of page texts,
            "method": "gemini-vision",
            "page_count": number of pages processed,
            "source_page_count": total pages in document
        }
    """
    start_time = time.time()
    ext = Path(file_path).suffix.lower()
    
    # Handle images
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif"):
        return _extract_single_image(file_path, max_pages)
    
    # Handle PDFs
    if ext != ".pdf":
        logger.warning(f"[Gemini-OCR] Unsupported file type: {ext}")
        return {
            "text": "",
            "pages": [],
            "method": "gemini-vision",
            "page_count": 0,
            "source_page_count": 0,
        }
    
    try:
        client = _get_gemini_client()
        total_pages = _get_page_count(file_path)
        pages_to_process = total_pages if max_pages <= 0 else min(total_pages, max_pages)
        timeout_budget_s = max(_TIMEOUT_SECONDS, pages_to_process * 20)
        
        logger.info(f"[Gemini-OCR] Processing {pages_to_process}/{total_pages} pages from {file_path}")
        
        page_texts: Dict[int, str] = {}
        timed_out = False
        
        for i in range(pages_to_process):
            elapsed = time.time() - start_time
            if elapsed > timeout_budget_s:
                logger.warning(f"[Gemini-OCR] Timeout reached after {elapsed:.1f}s, stopping at page {i+1}")
                timed_out = True
                break
            
            img_bytes = _render_page_to_image(file_path, i)
            if img_bytes is None:
                continue
            
            text = _extract_page_with_gemini(client, img_bytes, i)
            
            page_texts[i] = text or ""

        page_indices = list(range(pages_to_process))
        pages = [page_texts.get(i, "") for i in page_indices]
        combined_text = "\n\n--- PAGE BREAK ---\n\n".join(t for t in pages if t)
        extracted_page_count = sum(1 for t in pages if t)
        
        duration = time.time() - start_time
        logger.info(f"[Gemini-OCR] Completed in {duration:.2f}s: {extracted_page_count}/{pages_to_process} pages, {len(combined_text)} total chars")
        
        return {
            "text": combined_text,
            "pages": pages,
            "method": "gemini-vision",
            "page_count": len(pages),
            "source_page_count": total_pages,
            "page_indices": page_indices,
            "truncated_pages": (total_pages > pages_to_process) or timed_out,
            "timed_out": timed_out,
            "processing_duration_s": round(duration, 2),
        }
        
    except Exception as exc:
        logger.error(f"[Gemini-OCR] PDF extraction failed: {exc}")
        return {
            "text": "",
            "pages": [],
            "method": "gemini-vision",
            "page_count": 0,
            "source_page_count": 0,
        }


def _extract_single_image(file_path: str, max_pages: int = 1) -> Dict[str, Any]:
    """Extract text from a single image using Gemini."""
    try:
        client = _get_gemini_client()
        
        with open(file_path, "rb") as f:
            image_bytes = f.read()
        
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """You are an expert OCR system. Extract ALL text from this document image with perfect accuracy.

IMPORTANT RULES:
1. Extract text exactly as it appears in the document
2. Preserve line breaks and spacing
3. Include ALL text: headers, tables, footers, labels, values
4. For tables, extract each cell's content separated by |
5. Preserve numbers, codes, dates exactly as shown
6. Include currency symbols and formatting
7. Do NOT summarize or paraphrase - copy text exactly

Return the extracted text maintaining the document's structure."""

        text = ""
        last_error: Optional[Exception] = None
        for model_name in _get_gemini_models():
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        {"role": "user", "parts": [
                            {"text": prompt},
                            {"inline_data": {"mime_type": "image/png", "data": image_base64}}
                        ]}
                    ]
                )
                text = response.text.strip() if hasattr(response, 'text') else ""
                if text:
                    break
            except Exception as exc:
                last_error = exc
                logger.warning("[Gemini-OCR] Model %s failed for image OCR: %s", model_name, exc)
                continue

        if not text and last_error is not None:
            raise last_error

        return {
            "text": text,
            "pages": [text] if text else [],
            "method": "gemini-vision",
            "page_count": 1,
            "source_page_count": 1,
        }
    except Exception as exc:
        logger.error(f"[Gemini-OCR] Image extraction failed: {exc}")
        return {
            "text": "",
            "pages": [],
            "method": "gemini-vision",
            "page_count": 0,
            "source_page_count": 0,
        }


def _extract_page_with_gemini(client, image_bytes: bytes, page_num: int, retry_count: int = 0) -> str:
    """Extract text from a single page using Gemini vision."""
    try:
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = """You are an expert OCR system. Extract ALL text from this document image with perfect accuracy.

IMPORTANT RULES:
1. Extract text exactly as it appears in the document
2. Preserve line breaks and spacing
3. Include ALL text: headers, tables, footers, labels, values
4. For tables, extract each cell's content separated by |
5. Preserve numbers, codes, dates exactly as shown
6. Include currency symbols and formatting
7. Do NOT summarize or paraphrase - copy text exactly

Return the extracted text maintaining the document's structure."""

        text = ""
        last_error: Optional[Exception] = None
        for model_name in _get_gemini_models():
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        {"role": "user", "parts": [
                            {"text": prompt},
                            {"inline_data": {"mime_type": "image/png", "data": image_base64}}
                        ]}
                    ]
                )
                text = response.text.strip() if hasattr(response, 'text') else ""
                if text:
                    break
            except Exception as exc:
                last_error = exc
                logger.warning("[Gemini-OCR] Model %s failed for page %d: %s", model_name, page_num + 1, exc)
                continue

        if not text and last_error is not None:
            raise last_error

        logger.info(f"[Gemini-OCR] Page {page_num + 1}: extracted {len(text)} chars")
        return text
        
    except Exception as exc:
        logger.warning(f"[Gemini-OCR] Page {page_num + 1} failed (attempt {retry_count + 1}): {exc}")
        
        if retry_count < _MAX_RETRIES:
            wait_time = (retry_count + 1) * 2
            logger.info(f"[Gemini-OCR] Retrying page {page_num + 1} in {wait_time}s...")
            time.sleep(wait_time)
            return _extract_page_with_gemini(client, image_bytes, page_num, retry_count + 1)
        
        return ""


def _get_page_count(file_path: str) -> int:
    """Get the number of pages in a PDF document."""
    try:
        import fitz
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
    except Exception:
        return 1


def run_gemini_extract_fields(ocr_text: str, document_type_hint: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract document type and fields using Gemini.
    
    Args:
        ocr_text: OCR text from the document
        document_type_hint: Optional hint for document type
    
    Returns:
        {"doc_type": {...}, "fields": {...}}
    """
    from .document_type_detector import DOCUMENT_TYPES, _unknown_result
    
    # Use the combined prompt from m02_service
    from m02_service import _COMBINED_PROMPT
    
    truncated = ocr_text[:20000] if len(ocr_text) > 20000 else ocr_text
    prompt = _COMBINED_PROMPT.replace("{text}", truncated)
    
    client = _get_gemini_client()
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            raw = {}
            last_error: Optional[Exception] = None
            for model_name in _get_gemini_models():
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[{"role": "user", "parts": [{"text": prompt}]}],
                        config={
                            "response_mime_type": "application/json",
                            "temperature": 0,
                            "max_output_tokens": 4000,
                        }
                    )
                    raw_text = response.text if hasattr(response, 'text') else ""
                    raw = json.loads(raw_text)
                    break
                except Exception as exc:
                    last_error = exc
                    logger.warning("[M02] Gemini model %s extraction attempt %d failed: %s", model_name, attempt + 1, exc)
                    continue

            if not raw:
                if last_error is not None:
                    raise last_error
                raise RuntimeError("Gemini extraction returned empty response")
            
            logger.info("[M02] Gemini extraction succeeded on attempt %d", attempt + 1)
            
            # Extract document type
            if document_type_hint and document_type_hint in DOCUMENT_TYPES:
                doc_type = document_type_hint
            else:
                doc_type = str(raw.get("document_type", "unknown")).lower().strip()
                if doc_type not in DOCUMENT_TYPES:
                    doc_type = "unknown"
            
            meta = DOCUMENT_TYPES[doc_type]
            doc_type_result = {
                "document_type": doc_type,
                "display_name": meta["display_name"],
                "icon": meta["icon"],
                "color": meta["color"],
                "confidence": round(float(raw.get("doc_confidence", 0.9 if document_type_hint else 0.5)), 3),
                "signals": raw.get("doc_signals", [])[:8],
                "reasoning": "Gemini extraction",
                "description": meta["description"],
            }
            
            # Extract fields
            raw_fields = raw.get("fields", {})
            if not isinstance(raw_fields, dict):
                raw_fields = {}
            
            clean_fields = {
                k: (None if str(v).strip().lower() in ("null", "none", "n/a", "") else v)
                for k, v in raw_fields.items()
                if not k.startswith("_") and not isinstance(v, dict)
            }
            
            return {"doc_type": doc_type_result, "fields": clean_fields}
            
        except Exception as exc:
            logger.warning("[M02] Gemini extraction attempt %d failed: %s", attempt + 1, exc)
            if attempt < max_retries - 1:
                wait_time = (attempt + 1) * 3
                logger.info("[M02] Waiting %ds before retry...", wait_time)
                time.sleep(wait_time)
            else:
                logger.error("[M02] Gemini extraction all %d attempts failed", max_retries)
                return {"doc_type": _unknown_result(), "fields": {}}
    
    return {"doc_type": _unknown_result(), "fields": {}}


def run_gemini_simple(file_path: str, max_pages: int = None) -> Dict[str, Any]:
    """Simplified synchronous OCR call for single documents."""
    if max_pages is None:
        max_pages = 0
    return run_gemini_ocr(file_path, max_pages)
