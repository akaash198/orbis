"""
M02 GPT-4o-mini OCR Engine - Vision-based document text extraction.

This module uses GPT-4o-mini's vision capabilities to extract text from PDF pages
and images. It replaces PyMuPDF, PaddleOCR, and Tesseract with a single GPT-4o-mini
based extraction method.

Advantages:
  • Single model for all document types (PDF, scanned, images)
  • No dependency on PyMuPDF, PaddleOCR, or Tesseract
  • Consistent quality across all page types
  • Handles multilingual documents
  • Uses GPT-4o-mini for cost efficiency

Usage:
  ocr_result = run_gpt4o_ocr(file_path, client)
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

# OpenAI Configuration
_LANGEXTRACT_MODEL = "gpt-4o-mini"

# Page rendering settings
_PAGE_DPI = int(os.getenv("M02_OCR_DPI", "100"))  # Lower DPI for faster processing
_MAX_PAGES = int(os.getenv("M02_GPT4O_MAX_PAGES", "0"))
_TIMEOUT_SECONDS = int(os.getenv("M02_GPT4O_TIMEOUT", "120"))  # Increased timeout
_MAX_RETRIES = 3

# Text extraction prompt
_TEXT_EXTRACTION_PROMPT = """You are an expert OCR system. Extract ALL text from this document image with perfect accuracy.

IMPORTANT RULES:
1. Extract text exactly as it appears in the document
2. Preserve line breaks and spacing
3. Include ALL text: headers, tables, footers, labels, values
4. For tables, extract each cell's content separated by |
5. Preserve numbers, codes, dates exactly as shown
6. Include currency symbols and formatting
7. Do NOT summarize or paraphrase - copy text exactly

Return the extracted text maintaining the document's structure."""


def _render_page_to_image(file_path: str, page_num: int) -> Optional[bytes]:
    """
    Render a PDF page to image bytes using fitz (PyMuPDF).
    If fitz is not available, returns None.
    """
    try:
        import fitz
        doc = fitz.open(file_path)
        if page_num >= len(doc):
            doc.close()
            return None
        
        page = doc[page_num]
        mat = fitz.Matrix(_PAGE_DPI / 72, _PAGE_DPI / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        img_bytes = pix.tobytes("png")
        doc.close()
        return img_bytes
    except Exception as exc:
        logger.warning(f"[GPT4O-OCR] Failed to render page {page_num}: {exc}")
        return None


def _encode_image_to_base64(image_bytes: bytes) -> str:
    """Encode image bytes to base64 string for API transmission."""
    return base64.b64encode(image_bytes).decode("utf-8")


def _extract_text_from_image(client, image_base64: str, page_num: int, retry_count: int = 0) -> str:
    """
    Extract text from a single image using GPT-4o-mini vision with retry logic.
    
    Args:
        client: OpenAI client
        image_base64: Base64 encoded image
        page_num: Page number for logging
        retry_count: Current retry attempt
    
    Returns:
        Extracted text string
    """
    try:
        response = client.chat.completions.create(
            model=_LANGEXTRACT_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": _TEXT_EXTRACTION_PROMPT
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}",
                                "detail": "low"  # Use low detail for faster processing
                            }
                        }
                    ]
                }
            ],
            max_tokens=4000,  # Reduced for faster processing
            temperature=0,
            timeout=60.0,  # 60 second timeout per page
        )
        
        text = response.choices[0].message.content.strip()
        logger.info(f"[GPT4O-OCR] Page {page_num + 1}: extracted {len(text)} chars")
        return text
        
    except Exception as exc:
        logger.warning(f"[GPT4O-OCR] Page {page_num + 1} failed (attempt {retry_count + 1}): {exc}")
        
        # Retry logic
        if retry_count < _MAX_RETRIES:
            wait_time = (retry_count + 1) * 2  # Exponential backoff: 2s, 4s, 6s
            logger.info(f"[GPT4O-OCR] Retrying page {page_num + 1} in {wait_time}s...")
            time.sleep(wait_time)
            return _extract_text_from_image(client, image_base64, page_num, retry_count + 1)
        
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


def run_gpt4o_ocr(file_path: str, client, max_pages: int = None) -> Dict[str, Any]:
    """
    Extract text from a document using GPT-4o-mini vision OCR.
    
    This is the PRIMARY OCR method that replaces PyMuPDF text extraction,
    PaddleOCR, and Tesseract. It uses GPT-4o-mini's vision capabilities
    to extract text from all page types consistently.
    
    Args:
        file_path: Path to the PDF or image file
        client: OpenAI client
        max_pages: Maximum pages to process (default from env)
    
    Returns:
        {
            "text": combined text from all pages,
            "pages": list of page texts,
            "method": "gpt4o-mini-vision",
            "page_count": number of pages processed,
            "source_page_count": total pages in document
        }
    """
    if max_pages is None:
        max_pages = _MAX_PAGES
    
    start_time = time.time()
    ext = Path(file_path).suffix.lower()
    
    # Handle images
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif"):
        try:
            with open(file_path, "rb") as f:
                image_bytes = f.read()
            
            image_base64 = _encode_image_to_base64(image_bytes)
            text = _extract_text_from_image(client, image_base64, 0)
            
            return {
                "text": text,
                "pages": [text] if text else [],
                "method": "gpt4o-mini-vision",
                "page_count": 1,
                "source_page_count": 1,
            }
        except Exception as exc:
            logger.error(f"[GPT4O-OCR] Image extraction failed: {exc}")
            return {
                "text": "",
                "pages": [],
                "method": "gpt4o-mini-vision",
                "page_count": 0,
                "source_page_count": 0,
            }
    
    # Handle PDFs
    if ext != ".pdf":
        logger.warning(f"[GPT4O-OCR] Unsupported file type: {ext}")
        return {
            "text": "",
            "pages": [],
            "method": "gpt4o-mini-vision",
            "page_count": 0,
            "source_page_count": 0,
        }
    
    try:
        total_pages = _get_page_count(file_path)
        pages_to_process = total_pages if max_pages <= 0 else min(total_pages, max_pages)
        timeout_budget_s = max(_TIMEOUT_SECONDS, pages_to_process * 45)
        
        logger.info(f"[GPT4O-OCR] Processing {pages_to_process}/{total_pages} pages from {file_path}")
        
        page_texts: Dict[int, str] = {}
        page_indices: List[int] = list(range(pages_to_process))
        timed_out = False
        
        # Process pages sequentially for reliability (avoid rate limiting)
        for i in range(pages_to_process):
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed > timeout_budget_s:
                logger.warning(f"[GPT4O-OCR] Timeout reached after {elapsed:.1f}s, stopping at page {i+1}")
                timed_out = True
                break
            
            img_bytes = _render_page_to_image(file_path, i)
            if img_bytes is None:
                continue
            
            image_base64 = _encode_image_to_base64(img_bytes)
            text = _extract_text_from_image(client, image_base64, i)
            
            page_texts[i] = text or ""

        pages = [page_texts.get(i, "") for i in page_indices]
        extracted_page_count = sum(1 for t in pages if t)
        combined_text = "\n\n--- PAGE BREAK ---\n\n".join(t for t in pages if t)
        
        duration = time.time() - start_time
        logger.info(f"[GPT4O-OCR] Completed in {duration:.2f}s: {extracted_page_count}/{pages_to_process} pages, {len(combined_text)} total chars")
        
        return {
            "text": combined_text,
            "pages": pages,
            "method": "gpt4o-mini-vision",
            "page_count": len(pages),
            "source_page_count": total_pages,
            "page_indices": page_indices,
            "truncated_pages": (total_pages > pages_to_process) or timed_out,
            "timed_out": timed_out,
            "processing_duration_s": round(duration, 2),
        }
        
    except Exception as exc:
        logger.error(f"[GPT4O-OCR] PDF extraction failed: {exc}")
        return {
            "text": "",
            "pages": [],
            "method": "gpt4o-mini-vision",
            "page_count": 0,
            "source_page_count": 0,
        }


def run_gpt4o_ocr_simple(file_path: str, client, max_pages: int = None) -> Dict[str, Any]:
    """
    Simplified synchronous OCR call for single documents.
    Use this for quick extractions where parallel processing is not needed.
    """
    return run_gpt4o_ocr(file_path, client, max_pages)
