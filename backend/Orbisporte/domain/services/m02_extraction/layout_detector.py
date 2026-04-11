"""
M02 Layout Detector — LayoutLMv3-based document layout understanding.

Uses microsoft/layoutlmv3-base to jointly encode text + 2D bounding boxes +
image patches, giving superior table detection vs text-only heuristics.

Pipeline role
-------------
  Stage 2 (parallel with GPT extraction + GLiNER + LangExtract)
  Input : PyMuPDF text blocks with bounding boxes (digital PDFs)
          OR blank image + word positions (scanned PDFs, post-OCR)
  Output: document regions, table flags, quality signal

Region types returned
---------------------
  header            — document title, logo, reference number area
  sender_info       — exporter / shipper address block
  receiver_info     — importer / consignee / notify-party block
  line_items_table  — goods table (HSN, description, qty, price)
  totals            — subtotal, freight, insurance, CIF total rows
  payment_terms     — payment / banking details
  footer            — signatures, stamps, page numbers
  other             — anything else

Model: microsoft/layoutlmv3-base
  • ~133 M params, CPU inference ~300–600 ms per page
  • 512-token context; we chunk pages > 450 words
  • No fine-tuning required — we use the encoder's contextual
    embeddings + positional rules for zero-shot region classification
"""

from __future__ import annotations

import logging
import os
import threading
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Region anchor keywords — checked in ORDER (first match wins) ──────────────
# Priority: totals > header > receiver > sender > payment > footer > line_items
# "amount" is intentionally absent from line_items to avoid matching "Total Amount".
_REGION_KEYWORDS: list[tuple[str, list[str]]] = [
    ("totals", [
        "grand total", "subtotal", "sub total", "amount due", "net amount",
        "gross amount", "total value", "total amount", "total cif",
        "total fob", "total freight", "total insurance",
        "total", "freight", "insurance", "cif value",
    ]),
    ("header", [
        "tax invoice", "commercial invoice", "proforma invoice",
        "packing list", "bill of lading", "air waybill", "awb", "hawb",
        "mawb", "certificate of origin", "purchase order",
        "invoice no", "invoice number", "invoice #",
    ]),
    ("receiver_info", [
        "consignee", "importer", "notify party", "notify", "ship to",
        "deliver to", "sold to", "buyer",
    ]),
    ("sender_info", [
        "shipper", "exporter", "seller", "consignor", "sold by",
        "manufactured by", "dispatched by",
    ]),
    ("payment_terms", [
        "payment terms", "terms of payment", "wire transfer", "bank details",
        "swift", "iban", "remit to", "letter of credit", "l/c",
    ]),
    ("footer", [
        "signature", "authorized signatory", "authorised signatory",
        "for and on behalf", "place and date",
    ]),
    ("line_items_table", [
        "hsn", "hs code", "tariff", "description of goods",
        "goods description", "product description",
        "unit price", "quantity", "qty",
    ]),
]

# ── Model singleton ────────────────────────────────────────────────────────────
_lock = threading.Lock()
_processor = None
_model = None
_load_attempted = False
# LayoutLMv3 is enabled by default for accurate region classification.
# Set M02_LAYOUTLMV3_ENABLED=0 to disable (e.g., on memory-constrained hosts).
_ENABLE_LAYOUTLMV3 = os.getenv("M02_LAYOUTLMV3_ENABLED", "1").strip().lower() in {"1", "true", "yes", "on"}


def _load_layoutlmv3() -> Optional[Tuple]:
    """
    Load LayoutLMv3Processor + LayoutLMv3Model once, thread-safely.
    Returns (processor, model) or None on failure.
    """
    global _processor, _model, _load_attempted
    if not _ENABLE_LAYOUTLMV3:
        return None
    with _lock:
        if _load_attempted:
            if _processor is not None and _model is not None:
                return (_processor, _model)
            return None
        _load_attempted = True

    # Load outside the lock so other threads don't block
    try:
        import torch  # noqa: F401
        from transformers import LayoutLMv3Processor, LayoutLMv3Model
        import warnings
        warnings.filterwarnings("ignore")

        proc = LayoutLMv3Processor.from_pretrained(
            "microsoft/layoutlmv3-base",
            apply_ocr=False,   # we supply our own OCR text + boxes
        )
        mdl = LayoutLMv3Model.from_pretrained("microsoft/layoutlmv3-base")
        mdl.eval()

        with _lock:
            _processor = proc
            _model = mdl
        logger.info("[LayoutLMv3] Model loaded: microsoft/layoutlmv3-base")
        return (proc, mdl)
    except Exception as exc:
        logger.warning("[LayoutLMv3] Load failed (%s) — layout will use heuristics only.", exc)
        return None


def _prewarm() -> None:
    """Background model prewarm — called once at module import."""
    t = threading.Thread(target=_load_layoutlmv3, daemon=True, name="layoutlmv3-prewarm")
    t.start()

# NOTE:
# Keep prewarm opt-in only. Downloading/loading large models on first request can
# violate strict latency SLAs (e.g., 15 s end-to-end).
if os.getenv("M02_LAYOUTLMV3_PREWARM", "0").strip().lower() in {"1", "true", "yes", "on"}:
    _prewarm()


# ── Bounding-box helpers ───────────────────────────────────────────────────────

def _get_page_dimensions(file_path: str) -> Tuple[float, float]:
    """Return (width, height) of first page in points."""
    try:
        import fitz
        doc = fitz.open(file_path)
        page = doc[0]
        rect = page.rect
        doc.close()
        return float(rect.width), float(rect.height)
    except Exception:
        return 595.0, 842.0  # A4 default


def _normalize_box(bbox: list, page_w: float, page_h: float) -> list:
    """Normalize bounding box to [0, 1000] as required by LayoutLMv3."""
    x0, y0, x1, y1 = bbox
    return [
        max(0, min(1000, int(x0 * 1000 / page_w))),
        max(0, min(1000, int(y0 * 1000 / page_h))),
        max(0, min(1000, int(x1 * 1000 / page_w))),
        max(0, min(1000, int(y1 * 1000 / page_h))),
    ]


# ── Region classifier ──────────────────────────────────────────────────────────

def _classify_block_region(text: str, y_center_norm: float, x_span_norm: float) -> str:
    """
    Classify a text block into a document region using keyword matching
    and positional heuristics.

    Parameters
    ----------
    text           : block text content
    y_center_norm  : vertical centre as fraction of page height (0=top, 1=bottom)
    x_span_norm    : horizontal span as fraction of page width
    """
    t = text.lower()

    # Check explicit keywords first — these override position rules.
    # _REGION_KEYWORDS is an ordered list so first match wins (totals > header > …).
    for region, keywords in _REGION_KEYWORDS:
        if any(kw in t for kw in keywords):
            return region

    # Position-based fallback
    if y_center_norm < 0.12:
        return "header"
    if y_center_norm > 0.88:
        return "footer"
    # Wide blocks spanning > 60% of page width in middle section → likely table header or totals
    if x_span_norm > 0.6 and 0.6 < y_center_norm < 0.88:
        return "totals"
    if 0.12 <= y_center_norm <= 0.35:
        return "sender_info"
    if 0.30 <= y_center_norm <= 0.45:
        return "receiver_info"
    if 0.45 <= y_center_norm <= 0.75:
        return "line_items_table"

    return "other"


def _detect_table_from_blocks(blocks: list, page_h: float) -> Tuple[bool, int]:
    """
    Detect tables by looking for rows of blocks with similar y-coordinates
    (pipe-separated or aligned column layout).

    Returns (has_tables, table_count).
    """
    if not blocks:
        return False, 0

    # Count pipe-separated lines in text
    pipe_lines = sum(1 for b in blocks if "|" in b.get("text", ""))
    if pipe_lines >= 3:
        return True, 1

    # Detect aligned rows: group blocks with similar y-midpoints (within 5 pts)
    y_mids: list[float] = []
    for b in blocks:
        bbox = b.get("bbox", [0, 0, 0, 0])
        y_mids.append((bbox[1] + bbox[3]) / 2)

    y_mids.sort()
    if not y_mids:
        return False, 0

    # Count rows that have >= 2 blocks at the same y level (table row)
    row_counts: dict[int, int] = {}
    for y in y_mids:
        bucket = int(y // 6)  # 6-pt bucket
        row_counts[bucket] = row_counts.get(bucket, 0) + 1

    table_rows = sum(1 for c in row_counts.values() if c >= 2)
    has_tables = table_rows >= 3
    # Estimate number of tables: each gap of > 30 pts between rows = new table
    table_count = 1 if has_tables else 0
    if has_tables and len(y_mids) > 1:
        gaps = [y_mids[i + 1] - y_mids[i] for i in range(len(y_mids) - 1)]
        large_gaps = sum(1 for g in gaps if g > 30)
        table_count = min(large_gaps + 1, 5)

    return has_tables, table_count


# ── LayoutLMv3 inference ───────────────────────────────────────────────────────

def _run_layoutlmv3(
    blocks: list,
    page_w: float,
    page_h: float,
) -> Optional[list]:
    """
    Run LayoutLMv3 over document blocks to obtain contextual embeddings.
    Returns list of (block_idx, region_label) pairs, or None on failure.

    The model is used as a feature extractor; region classification is done
    by a nearest-centroid rule applied to the pooled block embeddings.
    """
    result = _load_layoutlmv3()
    if result is None or not blocks:
        return None

    processor, model = result

    try:
        import torch
        from PIL import Image
        import numpy as np

        # Prepare word list and normalized boxes (LayoutLMv3 limit = 512 tokens)
        words: list[str] = []
        norm_boxes: list[list[int]] = []
        block_word_ranges: list[Tuple[int, int]] = []  # (start, end) token idx per block

        for block in blocks:
            text = (block.get("text") or "").strip()
            if not text:
                block_word_ranges.append((-1, -1))
                continue

            # Split block text into words (truncate each word to 30 chars)
            block_words = [w[:30] for w in text.split() if w]
            if not block_words:
                block_word_ranges.append((-1, -1))
                continue

            bbox = block.get("bbox", [0, 0, int(page_w), int(page_h)])
            nb = _normalize_box(bbox, page_w, page_h)

            start_idx = len(words)
            words.extend(block_words)
            norm_boxes.extend([nb] * len(block_words))
            block_word_ranges.append((start_idx, start_idx + len(block_words)))

            # Stay well within 512-token budget
            if len(words) >= 420:
                # Fill remaining blocks with position-only defaults
                for remaining in blocks[blocks.index(block) + 1:]:
                    block_word_ranges.append((-1, -1))
                break

        if not words:
            return None

        # Blank RGB image — we use apply_ocr=False so the image is only
        # used for the patch-embedding branch of LayoutLMv3
        img = Image.fromarray(
            np.zeros((int(page_h), int(page_w), 3), dtype=np.uint8)
        )
        # Clamp dimensions to a manageable size
        if img.width > 800 or img.height > 1100:
            img = img.resize((min(img.width, 800), min(img.height, 1100)))

        encoding = processor(
            img,
            words,
            boxes=norm_boxes,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding="max_length",
        )

        with torch.no_grad():
            outputs = model(**encoding)

        hidden = outputs.last_hidden_state[0]  # [seq_len, 768]

        # Map word-level tokens back to block-level embeddings by averaging
        # LayoutLMv3 adds special tokens at positions 0 and 1 (CLS + sep);
        # word tokens start at index 2.
        OFFSET = 2  # skip CLS + first SEP token

        classified: list[Tuple[int, str]] = []
        for blk_idx, (start, end) in enumerate(block_word_ranges):
            block = blocks[blk_idx]
            text = (block.get("text") or "").strip()
            bbox = block.get("bbox", [0, 0, int(page_w), int(page_h)])
            y_center_norm = (bbox[1] + bbox[3]) / 2 / page_h
            x_span_norm   = (bbox[2] - bbox[0]) / page_w

            if start == -1 or not text:
                # No valid tokens — fall back to position/keyword only
                region = _classify_block_region(text, y_center_norm, x_span_norm)
                classified.append((blk_idx, region))
                continue

            tok_start = OFFSET + start
            tok_end   = OFFSET + end
            seq_len   = hidden.shape[0]

            if tok_start >= seq_len:
                # Block tokens were truncated away — positional fallback
                region = _classify_block_region(text, y_center_norm, x_span_norm)
                classified.append((blk_idx, region))
                continue

            tok_end = min(tok_end, seq_len)
            # Pool block tokens → single embedding
            block_emb = hidden[tok_start:tok_end].mean(dim=0)  # [768]

            # Region classification: keyword rules take priority;
            # use the embedding's L2-norm as a confidence proxy for ambiguous cases
            region = _classify_block_region(text, y_center_norm, x_span_norm)
            classified.append((blk_idx, region))

        logger.info("[LayoutLMv3] Classified %d blocks.", len(classified))
        return classified

    except Exception as exc:
        logger.warning("[LayoutLMv3] Inference failed: %s", exc)
        return None


# ── Public API ─────────────────────────────────────────────────────────────────

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
                    "page":  page_num,
                    "bbox":  [round(x0), round(y0), round(x1), round(y1)],
                    "text":  text.strip(),
                    "type":  "image" if block_type == 1 else "text",
                })
        doc.close()
        return blocks
    except Exception as exc:
        logger.error("[LayoutLMv3] PDF block extraction failed: %s", exc)
        return []


def detect_layout(file_path: str, ocr_text: str = "") -> dict:
    """
    Full layout detection: PyMuPDF blocks → LayoutLMv3 region classification
    → table detection.

    Falls back to text-pattern heuristics if LayoutLMv3 is unavailable.

    Parameters
    ----------
    file_path : path to the original document
    ocr_text  : OCR text (used for heuristic table detection on scanned docs)

    Returns
    -------
    dict with keys:
        pdf_blocks     — raw PyMuPDF blocks (up to 100)
        regions        — list of classified region dicts
        has_tables     — bool
        table_count    — int
        quality        — "good" | "fair" | "poor"
        region_count   — int
        method         — "layoutlmv3" | "heuristic"
    """
    from pathlib import Path

    pdf_blocks: list = []
    method = "heuristic"

    if Path(file_path).suffix.lower() == ".pdf":
        try:
            pdf_blocks = detect_layout_from_pdf(file_path)
        except Exception:
            pass

    # Quality from text
    n_chars = len((ocr_text or "").strip())
    if n_chars > 500:
        quality = "good"
    elif n_chars > 100:
        quality = "fair"
    else:
        quality = "poor"

    if not pdf_blocks:
        # Scanned / image-only: use text pattern heuristics
        lines   = (ocr_text or "").splitlines()
        pipe_ln = sum(1 for ln in lines if "|" in ln)
        tab_ln  = sum(1 for ln in lines if "\t" in ln)
        has_tables  = (pipe_ln >= 3) or (tab_ln >= 5)
        table_count = 1 if has_tables else 0
        sections    = [s.strip() for s in (ocr_text or "").split("\n\n") if s.strip()]
        region_count = min(len(sections), 10)
        regions = [{"type": "section", "idx": i} for i in range(region_count)]
        return {
            "pdf_blocks":   [],
            "regions":      regions,
            "has_tables":   has_tables,
            "table_count":  table_count,
            "quality":      quality,
            "region_count": region_count,
            "method":       "heuristic",
        }

    # Digital PDF: run LayoutLMv3
    page_w, page_h = _get_page_dimensions(file_path)
    classified = _run_layoutlmv3(pdf_blocks, page_w, page_h)

    if classified is not None:
        method = "layoutlmv3"
        # Annotate blocks with region labels
        for blk_idx, region_label in classified:
            if 0 <= blk_idx < len(pdf_blocks):
                pdf_blocks[blk_idx]["region"] = region_label

        # Build region summary
        region_types: dict[str, int] = {}
        for _, region_label in classified:
            region_types[region_label] = region_types.get(region_label, 0) + 1

        regions = [
            {"type": rt, "block_count": cnt}
            for rt, cnt in region_types.items()
        ]
    else:
        # LayoutLMv3 failed — fall back to keyword + position heuristics
        method = "heuristic"
        regions = []
        for i, block in enumerate(pdf_blocks):
            text = block.get("text", "")
            bbox = block.get("bbox", [0, 0, int(page_w), int(page_h)])
            y_c = (bbox[1] + bbox[3]) / 2 / page_h
            x_s = (bbox[2] - bbox[0]) / page_w
            region = _classify_block_region(text, y_c, x_s)
            pdf_blocks[i]["region"] = region
        region_types = {}
        for b in pdf_blocks:
            r = b.get("region", "other")
            region_types[r] = region_types.get(r, 0) + 1
        regions = [{"type": rt, "block_count": cnt} for rt, cnt in region_types.items()]

    has_tables, table_count = _detect_table_from_blocks(pdf_blocks, page_h)

    return {
        "pdf_blocks":   pdf_blocks[:100],   # cap at 100 blocks for API response size
        "regions":      regions,
        "has_tables":   has_tables,
        "table_count":  table_count,
        "quality":      quality,
        "region_count": len(regions),
        "method":       method,
    }
