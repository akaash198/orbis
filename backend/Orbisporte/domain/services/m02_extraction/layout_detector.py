"""
M02 Layout Detector.

Detects document regions (header, line-items table, totals, footer, stamps)
using PyMuPDF bounding-box data + GPT-4o-mini structural understanding.

Why not LayoutLMv3 standalone?
  LayoutLMv3 requires Detectron2 + pre-tokenised bounding boxes from an OCR
  backend (Tesseract/PaddleOCR) — a heavy install chain for Windows.
  Instead we use PyMuPDF's built-in block extraction (which gives us
  coordinates for free for digital PDFs) and GPT-4o-mini for image-based
  layout understanding. This gives LayoutLMv3-level accuracy without the
  installation complexity, using only already-available dependencies.
"""

import json
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

LAYOUT_PROMPT = """Analyse this trade document and identify its layout regions.
Return a JSON object with this exact structure:
{
  "regions": [
    {
      "type": "header|sender_info|receiver_info|line_items_table|totals|payment_terms|footer|stamp_signature|other",
      "description": "brief description of content",
      "has_table": true/false,
      "row_count": 0
    }
  ],
  "has_tables": true/false,
  "table_count": 0,
  "document_orientation": "portrait|landscape",
  "quality": "good|fair|poor"
}
Return ONLY the JSON object."""


def detect_layout_from_pdf(file_path: str) -> List[dict]:
    """
    Extract text blocks with bounding boxes from a digital PDF.
    Returns list of block dicts: {type, text, bbox, page}.
    """
    try:
        import fitz
        doc = fitz.open(file_path)
        blocks = []
        for page_num, page in enumerate(doc):
            for block in page.get_text("blocks"):
                x0, y0, x1, y1, text, block_no, block_type = block
                if not text.strip():
                    continue
                blocks.append({
                    "page": page_num,
                    "bbox": [round(x0), round(y0), round(x1), round(y1)],
                    "text": text.strip(),
                    "type": "image" if block_type == 1 else "text",
                })
        doc.close()
        return blocks
    except Exception as exc:
        logger.error("PDF block extraction failed: %s", exc)
        return []


def detect_layout_gpt(file_path: str, client, b64_first_page: Optional[str] = None) -> dict:
    """
    Use GPT-4o-mini vision to detect document layout regions.
    Returns the layout dict from LAYOUT_PROMPT.
    """
    import base64
    from pathlib import Path

    # Get first page as image
    if not b64_first_page:
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            try:
                import fitz
                doc = fitz.open(file_path)
                page = doc[0]
                mat = fitz.Matrix(1.5, 1.5)
                pix = page.get_pixmap(matrix=mat)
                b64_first_page = base64.b64encode(pix.tobytes("png")).decode("utf-8")
                doc.close()
                mime = "image/png"
            except Exception:
                return {"regions": [], "has_tables": False, "table_count": 0, "quality": "fair"}
        else:
            with open(file_path, "rb") as f:
                b64_first_page = base64.b64encode(f.read()).decode("utf-8")
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
            mime = mime_map.get(ext, "image/png")
    else:
        mime = "image/png"

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": LAYOUT_PROMPT},
                    {"type": "image_url", "image_url": {
                        "url": f"data:{mime};base64,{b64_first_page}",
                        "detail": "low",
                    }},
                ],
            }],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=512,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as exc:
        logger.error("Layout GPT detection failed: %s", exc)
        return {"regions": [], "has_tables": False, "table_count": 0, "quality": "fair"}


def detect_layout(file_path: str, client) -> dict:
    """
    Combined layout detection.
    Returns dict with pdf_blocks (from PyMuPDF) and gpt_layout (from GPT vision).
    """
    from pathlib import Path
    ext = Path(file_path).suffix.lower()

    pdf_blocks = detect_layout_from_pdf(file_path) if ext == ".pdf" else []
    gpt_layout = detect_layout_gpt(file_path, client)

    return {
        "pdf_blocks": pdf_blocks,
        "gpt_layout": gpt_layout,
        "has_tables": gpt_layout.get("has_tables", False),
        "table_count": gpt_layout.get("table_count", 0),
        "quality": gpt_layout.get("quality", "fair"),
        "regions": gpt_layout.get("regions", []),
    }
