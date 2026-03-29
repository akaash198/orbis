"""
Barcode / QR Code input channel.

Supports
--------
  GS1 barcodes  – SSCC-18, GTIN-14, GS1-128, GS1 DataMatrix, GS1 QR
  QR codes      – Arbitrary URLs or JSON payloads containing:
                    shipment metadata | invoice references | tracking IDs

Input types accepted
--------------------
  1. Image bytes (JPEG / PNG) — scanned via pyzbar + OpenCV
  2. Raw decoded string        — from a hardware scanner (already decoded)

Output
------
  BarcodeResult dataclass with:
    - raw_value    : The decoded barcode string
    - barcode_type : QRCODE | CODE128 | EAN13 | DATAMATRIX | …
    - parsed       : Dict of structured fields (GS1 AIs, JSON, key=value)
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from pyzbar.pyzbar import decode as pyzbar_decode, ZBarSymbol
    _PYZBAR_AVAILABLE = True
except (ImportError, OSError, FileNotFoundError, Exception):
    _PYZBAR_AVAILABLE = False
    logger.warning("pyzbar native library not available — image-based barcode scanning disabled.")

try:
    from PIL import Image
    import io
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────────────
# GS1 Application Identifier (AI) mapping (common subset)
GS1_AI_MAP: Dict[str, str] = {
    "00": "sscc",               "01": "gtin",
    "02": "content_gtin",       "10": "lot_number",
    "11": "production_date",    "13": "packaging_date",
    "15": "best_before_date",   "17": "expiry_date",
    "20": "variant",            "21": "serial_number",
    "30": "quantity",           "310": "net_weight_kg",
    "320": "net_weight_lb",     "400": "order_number",
    "401": "consignment_number","402": "shipment_id",
    "403": "routing_code",      "410": "ship_to_gln",
    "411": "bill_to_gln",       "412": "purchase_from_gln",
    "414": "location_gln",      "420": "ship_to_postal",
    "421": "ship_to_country_postal",
}


@dataclass
class BarcodeResult:
    raw_value: str
    barcode_type: str = "UNKNOWN"
    parsed: Dict = field(default_factory=dict)
    scan_confidence: float = 1.0
    errors: List[str] = field(default_factory=list)


def _parse_gs1_application_identifiers(value: str) -> dict:
    """
    Parse a GS1 element string containing Application Identifiers (AIs).
    Handles both FNC1-separated and fixed-length AI structures.
    """
    result = {}
    i = 0
    value = value.replace("\x1d", "")  # strip GS (FNC1) separator
    while i < len(value):
        matched = False
        for ai_len in (4, 3, 2):
            ai = value[i:i + ai_len]
            if ai in GS1_AI_MAP:
                field_name = GS1_AI_MAP[ai]
                # Variable-length AIs end at next GS or EOS
                rest = value[i + ai_len:]
                gs_pos = rest.find("\x1d")
                field_val = rest[:gs_pos] if gs_pos >= 0 else rest
                result[field_name] = field_val.strip()
                i += ai_len + len(field_val)
                matched = True
                break
        if not matched:
            i += 1
    return result


def _parse_payload(raw: str, barcode_type: str) -> dict:
    """
    Attempt to extract structured data from any barcode payload.
    Priority: GS1 → JSON → URL params → key=value pairs → plain string.
    """
    raw_stripped = raw.strip()

    # 1. GS1 structure (starts with ']' or contains AI pattern)
    gs1_match = re.match(r"^\]?[A-Z]\d?(.+)", raw_stripped)
    if gs1_match or barcode_type in ("CODE128", "DATA_MATRIX", "QR_CODE"):
        gs1 = _parse_gs1_application_identifiers(raw_stripped)
        if gs1:
            return {"format": "gs1", **gs1}

    # 2. JSON payload
    if raw_stripped.startswith(("{", "[")):
        try:
            return {"format": "json", "data": json.loads(raw_stripped)}
        except json.JSONDecodeError:
            pass

    # 3. URL query string
    if "=" in raw_stripped:
        pairs = {}
        for segment in re.split(r"[&;]", raw_stripped.split("?")[-1]):
            if "=" in segment:
                k, _, v = segment.partition("=")
                pairs[k.strip()] = v.strip()
        if pairs:
            return {"format": "key_value", **pairs}

    # 4. Plain string
    return {"format": "plain", "value": raw_stripped}


def scan_image(image_bytes: bytes) -> List[BarcodeResult]:
    """
    Decode all barcodes / QR codes found in an image.

    Parameters
    ----------
    image_bytes : JPEG or PNG image bytes from a scanner or camera.

    Returns
    -------
    List of BarcodeResult (one per symbol found in the image).
    """
    if not _PYZBAR_AVAILABLE or not _PIL_AVAILABLE:
        return [BarcodeResult(
            raw_value="",
            errors=["pyzbar/Pillow not installed — cannot decode image barcodes."]
        )]

    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        decoded = pyzbar_decode(pil_img)
    except Exception as exc:
        logger.error("Barcode image decode failed: %s", exc)
        return [BarcodeResult(raw_value="", errors=[str(exc)])]

    results = []
    for symbol in decoded:
        raw = symbol.data.decode("utf-8", errors="replace")
        btype = symbol.type  # e.g. QRCODE, CODE128, EAN13
        parsed = _parse_payload(raw, btype)
        results.append(BarcodeResult(raw_value=raw, barcode_type=btype, parsed=parsed))
        logger.info("Barcode decoded: type=%s, value=%s…", btype, raw[:60])

    if not results:
        logger.info("No barcodes found in image.")

    return results


def decode_raw_payload(payload: str) -> BarcodeResult:
    """
    Process a barcode string already decoded by a hardware scanner.

    Parameters
    ----------
    payload : The raw string emitted by the scanner.
    """
    if not payload or not payload.strip():
        return BarcodeResult(raw_value="", errors=["Empty barcode payload."])

    parsed = _parse_payload(payload, "UNKNOWN")
    return BarcodeResult(raw_value=payload.strip(), barcode_type="RAW_SCAN", parsed=parsed)
