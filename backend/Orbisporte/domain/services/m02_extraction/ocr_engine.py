"""
M02 OCR Engine — PyMuPDF + GPT-4o-mini Vision hybrid.

Architecture:
  1) Digital PDFs: use native text layer via PyMuPDF (ultra-fast, zero OCR)
  2) Scanned PDFs / images: use GPT-4o-mini Vision for OCR
     - Handles rotated text, low-quality scans, multiple languages, stamps

No PaddleOCR or Tesseract used — only GPT-4o-mini for OCR on non-text documents.
"""

import base64
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_MAX_PDF_OCR_PAGES = int(os.getenv("M02_OCR_MAX_PAGES", "20"))
DEFAULT_OCR_TOTAL_TIMEOUT_S = float(os.getenv("M02_OCR_TOTAL_TIMEOUT_S", "120"))


def _get_openai_client():
    """Get OpenAI client for GPT-4o-mini Vision OCR."""
    from Orbisporte.infrastructure.get_llm import openai_client
    return openai_client()


def _get_gemini_client():
    """Get Gemini client for Vision OCR (fallback)."""
    try:
        from Orbisporte.infrastructure.get_llm import gemini_client
        return gemini_client()
    except Exception as e:
        logger.warning(f"[OCR] Gemini client failed: {e}")
        return None


def _render_pdf_page_bytes(file_path: str, page_num: int, dpi: int = 150) -> Optional[bytes]:
    """Render PDF page to PNG bytes."""
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
        logger.warning(f"[OCR] Failed to render page {page_num}: {exc}")
        return None


def _select_page_indices(page_count: int, max_pages: int) -> List[int]:
    """Evenly sample pages across the document."""
    if page_count <= max_pages:
        return list(range(page_count))
    if max_pages <= 1:
        return [0]
    idx = []
    for i in range(max_pages):
        pos = round(i * (page_count - 1) / (max_pages - 1))
        idx.append(int(pos))
    return sorted(set(idx))


def _extract_pdf_text_pages(file_path: str) -> List[str]:
    """Extract per-page text from native PDF text layer."""
    try:
        import fitz
        doc = fitz.open(file_path)
        texts = [page.get_text().strip() for page in doc]
        doc.close()
        return texts
    except Exception:
        return []


def _normalize_ocr_text(text: str) -> str:
    """Normalize OCR output text."""
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    return "\n".join(lines)


def _ocr_page_with_gpt4o(client, image_base64: str, page_num: int, retry: int = 2) -> str:
    """Extract text from a page image using GPT-4o-mini Vision."""
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

    for attempt in range(retry):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4096,
                timeout=60.0,
            )
            text = response.choices[0].message.content
            return _normalize_ocr_text(text or "")
        except Exception as exc:
            if attempt < retry - 1:
                logger.warning(f"[OCR] GPT-4o-mini page {page_num + 1} attempt {attempt + 1} failed: {exc}")
                time.sleep(2)
            else:
                logger.error(f"[OCR] GPT-4o-mini page {page_num + 1} failed after {retry} attempts: {exc}")
    return ""


def _ocr_page_with_gemini(client, image_base64: str, page_num: int) -> str:
    """Extract text from a page image using Gemini Vision."""
    prompt = """You are an expert OCR system. Extract ALL text from this document image with perfect accuracy.

Extract text exactly as it appears. Preserve structure and formatting."""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                {"role": "user", "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/png", "data": image_base64}}
                ]}
            ],
            config={"temperature": 0, "max_output_tokens": 4096}
        )
        text = response.text if hasattr(response, 'text') else ""
        return _normalize_ocr_text(text or "")
    except Exception as exc:
        logger.error(f"[OCR] Gemini page {page_num + 1} failed: {exc}")
        return ""


def run_ocr(
    file_path: str,
    client,  # kept for compatibility
    *,
    max_pages: Optional[int] = None,
    total_timeout_s: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Run OCR on PDF/image using PyMuPDF + GPT-4o-mini Vision hybrid.
    
    Returns:
      {
        text, pages, method, page_count,
        source_page_count?, page_indices?, truncated_pages?
      }
    """
    if max_pages is None:
        max_pages = DEFAULT_MAX_PDF_OCR_PAGES
    if total_timeout_s is None:
        total_timeout_s = DEFAULT_OCR_TOTAL_TIMEOUT_S
        
    ext = Path(file_path).suffix.lower()

    # Handle images directly with GPT-4o-mini Vision
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp"):
        return _ocr_image_file(file_path, max_pages)

    if ext != ".pdf":
        logger.warning(f"[OCR] Unsupported file type: {ext}")
        return {"text": "", "pages": [], "method": "unsupported", "page_count": 0}

    return _ocr_pdf_file(file_path, max_pages, total_timeout_s)


def _ocr_image_file(file_path: str, max_pages: int = 1) -> Dict[str, Any]:
    """OCR for image files using GPT-4o-mini Vision."""
    try:
        # Try GPT-4o-mini first
        client = _get_openai_client()
        with open(file_path, "rb") as f:
            image_bytes = f.read()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        text = _ocr_page_with_gpt4o(client, image_base64, 0)
        
        if text.strip():
            return {
                "text": text,
                "pages": [text],
                "method": "gpt4o-mini-vision",
                "page_count": 1,
                "source_page_count": 1,
            }
        
        # Fallback to Gemini if GPT fails
        gemini_client = _get_gemini_client()
        if gemini_client:
            text = _ocr_page_with_gemini(gemini_client, image_base64, 0)
            if text.strip():
                return {
                    "text": text,
                    "pages": [text],
                    "method": "gemini-vision",
                    "page_count": 1,
                    "source_page_count": 1,
                }
        
        return {"text": "", "pages": [], "method": "gpt4o-mini-failed", "page_count": 0}
        
    except Exception as exc:
        logger.error(f"[OCR] Image OCR failed: {exc}")
        return {"text": "", "pages": [], "method": "error", "page_count": 0}


def _ocr_pdf_file(file_path: str, max_pages: int, total_timeout_s: float) -> Dict[str, Any]:
    """OCR for PDF files - PyMuPDF text layer first, then GPT-4o-mini Vision for scanned pages."""
    start_time = time.time()
    
    # Step 1: Try to extract native text layer from all pages
    native_pages = _extract_pdf_text_pages(file_path)
    page_count = len(native_pages) if native_pages else 0
    
    # If no pages from PyMuPDF, count pages manually
    if page_count == 0:
        try:
            import fitz
            doc = fitz.open(file_path)
            page_count = len(doc)
            doc.close()
        except Exception:
            page_count = 1

    # Determine which pages to process
    if max_pages <= 0 or max_pages > page_count:
        max_pages = page_count
    indices = _select_page_indices(page_count, max_pages=max_pages)

    logger.info(f"[OCR] Processing PDF: {page_count} total pages, extracting {len(indices)} pages")

    # Get OpenAI client for Vision OCR
    gpt_client = None
    gemini_client = None
    
    # Check if we need Vision OCR (some pages have insufficient text)
    need_vision = False
    for idx in indices:
        native_text = native_pages[idx] if idx < len(native_pages) else ""
        if len(native_text.strip()) < 40:
            need_vision = True
            break

    if need_vision:
        try:
            gpt_client = _get_openai_client()
        except Exception as exc:
            logger.warning(f"[OCR] OpenAI client failed: {exc}, trying Gemini")
            gemini_client = _get_gemini_client()

    page_texts = []
    used_vision = False
    timed_out = False

    for idx in indices:
        # Check timeout
        if (time.time() - start_time) > total_timeout_s:
            logger.warning("[OCR] OCR timeout reached")
            timed_out = True
            break

        # Get native text first
        native_text = ""
        if idx < len(native_pages):
            native_text = native_pages[idx] or ""

        # If sufficient native text, use it
        if len(native_text.strip()) >= 40:
            page_texts.append(native_text.strip())
            continue

        # Otherwise use Vision OCR
        if gpt_client is None and gemini_client is None:
            # Try to get clients if not yet initialized
            try:
                gpt_client = _get_openai_client()
            except:
                gemini_client = _get_gemini_client()

        # Render page to image
        img_bytes = _render_pdf_page_bytes(file_path, idx)
        if img_bytes is None:
            page_texts.append(native_text or "")
            continue

        image_base64 = base64.b64encode(img_bytes).decode("utf-8")
        
        # Try GPT-4o-mini first
        if gpt_client:
            text = _ocr_page_with_gpt4o(gpt_client, image_base64, idx)
            if text.strip():
                used_vision = True
                page_texts.append(text)
                continue

        # Fallback to Gemini
        if gemini_client:
            text = _ocr_page_with_gemini(gemini_client, image_base64, idx)
            if text.strip():
                used_vision = True
                page_texts.append(text)
                continue

        # If both fail, use native text
        page_texts.append(native_text or "")

    # Combine all page texts
    full_text = "\n\n--- PAGE BREAK ---\n\n".join(p for p in page_texts if p)

    # Determine method
    if not used_vision:
        method = "pymupdf_text_layer"
    elif gpt_client:
        method = "hybrid_pymupdf_gpt4o-mini-vision"
    else:
        method = "hybrid_pymupdf_gemini-vision"

    return {
        "text": full_text,
        "pages": page_texts,
        "method": method,
        "page_count": len(page_texts),
        "source_page_count": page_count,
        "page_indices": indices,
        "truncated_pages": (page_count > len(indices)) or timed_out,
        "timed_out": timed_out,
        "used_vision_ocr": used_vision,
    }


def run_ocr_simple(file_path: str, max_pages: int = 20) -> Dict[str, Any]:
    """Simple synchronous OCR call for single documents."""
    try:
        from Orbisporte.infrastructure.get_llm import openai_client
        client = openai_client()
        return run_ocr(file_path, client, max_pages=max_pages)
    except Exception as exc:
        logger.error(f"[OCR] Simple OCR failed: {exc}")
        return {"text": "", "pages": [], "method": "error", "page_count": 0}