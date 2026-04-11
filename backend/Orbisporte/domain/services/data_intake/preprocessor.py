"""
DM-003: Document preprocessing pipeline.

Operations
----------
  Images (JPEG / PNG / TIFF)
    1. Deskew          – detect and correct skew angle using Hough transform
    2. Noise removal   – Gaussian blur + adaptive thresholding
    3. Orientation     – auto-rotate based on detected text orientation

  PDFs
    1. Validate PDF structure
    2. Extract raw text for downstream processing

  Text files (JSON / XML / EDI / CSV)
    1. Encoding normalisation → UTF-8
    2. Strip BOM if present

  Audio (WAV / MP3 / …)
    1. Resample to 16 kHz mono (required by Whisper ASR)
"""

import io
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── Optional imports (degrade gracefully) ────────────────────────────────────
try:
    import cv2
    import numpy as np
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False
    logger.warning("opencv-python not installed — image preprocessing will be limited.")

try:
    from PIL import Image
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

try:
    import fitz  # PyMuPDF
    _PYMUPDF_AVAILABLE = True
except ImportError:
    _PYMUPDF_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────────────

def _deskew_image(image_array) -> Tuple:
    """
    Detect skew angle via Hough line transform and rotate to correct it.
    Returns corrected image array.
    """
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY) if len(image_array.shape) == 3 else image_array
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=10)

    angle = 0.0
    if lines is not None:
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if x2 - x1 != 0:
                angles.append(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
        if angles:
            angle = float(np.median(angles))
            # Only correct if skew is significant
            if abs(angle) < 0.5 or abs(angle) > 45:
                angle = 0.0

    if abs(angle) > 0.5:
        h, w = image_array.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        image_array = cv2.warpAffine(image_array, M, (w, h),
                                     flags=cv2.INTER_CUBIC,
                                     borderMode=cv2.BORDER_REPLICATE)
        logger.debug("Deskewed image by %.2f°", angle)

    return image_array


def _denoise_image(image_array):
    """Apply fast NL-means denoising on grayscale channel."""
    if len(image_array.shape) == 3:
        image_array = cv2.fastNlMeansDenoisingColored(image_array, None, 10, 10, 7, 21)
    else:
        image_array = cv2.fastNlMeansDenoising(image_array, None, 10, 7, 21)
    return image_array


def preprocess_image(file_bytes: bytes, file_type: str) -> bytes:
    """
    Image preprocessing pipeline — deskew only.

    Denoising (`cv2.fastNlMeansDenoisingColored`) was removed: it took 1–3 s
    per image on CPU and provided no measurable OCR improvement when the
    downstream consumer is GPT-4o-mini vision.  Deskewing is kept because
    a rotated image does reduce LLM extraction accuracy.
    """
    if not _CV2_AVAILABLE or not _PIL_AVAILABLE:
        logger.warning("Skipping image preprocessing — OpenCV/Pillow not available.")
        return file_bytes

    try:
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        img = _deskew_image(img)
        # _denoise_image removed — ~1-3 s CPU cost with negligible LLM quality gain

        success, buffer = cv2.imencode(".png", img)
        if success:
            return buffer.tobytes()
    except Exception as exc:
        logger.error("Image preprocessing failed: %s — returning original.", exc)

    return file_bytes


def preprocess_pdf(file_bytes: bytes) -> bytes:
    """Validate PDF integrity; return original bytes (PDFs are not modified)."""
    if not _PYMUPDF_AVAILABLE:
        return file_bytes
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = len(doc)
        logger.debug("PDF has %d pages.", page_count)
        doc.close()
    except Exception as exc:
        logger.error("PDF integrity check failed: %s", exc)
    return file_bytes


def normalise_text_encoding(file_bytes: bytes) -> bytes:
    """
    Normalise text-based formats to UTF-8.
    Detects and strips BOM; tries common encodings.
    """
    # Strip UTF BOM variants
    for bom, encoding in [
        (b"\xef\xbb\xbf", "utf-8-sig"),
        (b"\xff\xfe",     "utf-16-le"),
        (b"\xfe\xff",     "utf-16-be"),
    ]:
        if file_bytes.startswith(bom):
            return file_bytes[len(bom):].decode(encoding, errors="replace").encode("utf-8")

    # Try UTF-8 first
    try:
        file_bytes.decode("utf-8")
        return file_bytes
    except UnicodeDecodeError:
        pass

    # Fallback encodings
    for enc in ("latin-1", "cp1252", "iso-8859-1"):
        try:
            return file_bytes.decode(enc).encode("utf-8")
        except Exception:
            continue

    return file_bytes  # Return original if all attempts fail


def preprocess(file_bytes: bytes, file_type: str) -> bytes:
    """
    Dispatch preprocessing based on detected file type.
    Always returns bytes ready for storage and downstream extraction.
    """
    file_type = (file_type or "").lower()

    if file_type in ("jpeg", "png", "tiff"):
        return preprocess_image(file_bytes, file_type)
    elif file_type == "pdf":
        return preprocess_pdf(file_bytes)
    elif file_type in ("json", "xml", "edi", "csv"):
        return normalise_text_encoding(file_bytes)
    elif file_type in ("wav", "mp3", "m4a", "ogg", "flac"):
        # Audio preprocessing is handled by the voice channel (ASR step)
        return file_bytes
    else:
        return file_bytes
