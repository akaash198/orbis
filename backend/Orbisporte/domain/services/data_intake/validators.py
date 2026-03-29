"""
DM-002: File format, size, and structure validation.

Accepted formats per channel
-----------------------------
  REST API / Portal  → PDF, JPEG, PNG, TIFF, XML, JSON
  SFTP batch         → EDI, bulk invoice exports (XML, JSON, CSV)
  Email              → PDF, JPEG, PNG, TIFF, XML, JSON
  Barcode / QR       → Raw barcode data (string payload)
  Voice / Audio      → WAV, MP3, M4A, OGG, FLAC

Maximum sizes
-------------
  Web portal         → 50 MB  (SS2.1)
  All other channels → 100 MB
"""

import hashlib
import io
import logging
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── MIME / magic-byte maps ────────────────────────────────────────────────────
MAGIC_SIGNATURES: dict = {
    b"%PDF":            ("pdf",  "application/pdf"),
    b"\xff\xd8\xff":   ("jpeg", "image/jpeg"),
    b"\x89PNG\r\n":    ("png",  "image/png"),
    b"II*\x00":        ("tiff", "image/tiff"),      # little-endian TIFF
    b"MM\x00*":        ("tiff", "image/tiff"),      # big-endian TIFF
    b"<?xml":          ("xml",  "application/xml"),
    b"<xml":           ("xml",  "application/xml"),
    b"ISA*":           ("edi",  "application/edi-x12"),   # EDI X12
    b"UNA":            ("edi",  "application/edifact"),   # EDIFACT
    b"RIFF":           ("wav",  "audio/wav"),
    b"\xff\xfb":       ("mp3",  "audio/mpeg"),
    b"ID3":            ("mp3",  "audio/mpeg"),
    b"OggS":           ("ogg",  "audio/ogg"),
    b"fLaC":           ("flac", "audio/flac"),
}

EXTENSION_TO_TYPE: dict = {
    ".pdf":  "pdf",  ".jpg":  "jpeg", ".jpeg": "jpeg",
    ".png":  "png",  ".tiff": "tiff", ".tif":  "tiff",
    ".xml":  "xml",  ".json": "json", ".edi":  "edi",
    ".x12":  "edi",  ".edifact": "edi",
    ".wav":  "wav",  ".mp3":  "mp3",  ".m4a":  "m4a",
    ".ogg":  "ogg",  ".flac": "flac", ".csv":  "csv",
}

CHANNEL_ALLOWED_TYPES: dict = {
    "api":     {"pdf", "jpeg", "png", "tiff", "xml", "json"},
    "portal":  {"pdf", "jpeg", "png", "tiff", "xml", "json"},
    "sftp":    {"edi", "xml", "json", "csv"},
    "email":   {"pdf", "jpeg", "png", "tiff", "xml", "json"},
    "barcode": set(),       # payload is a string, no binary validation
    "voice":   {"wav", "mp3", "m4a", "ogg", "flac"},
}

MAX_SIZE_BYTES: dict = {
    "portal": 50 * 1024 * 1024,    # 50 MB — SS2.1
    "default": 100 * 1024 * 1024,  # 100 MB
}


# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class ValidationResult:
    valid: bool
    file_type: Optional[str] = None
    content_type: Optional[str] = None
    content_hash: Optional[str] = None
    file_size: int = 0
    errors: List[str] = field(default_factory=list)

    def add_error(self, msg: str):
        self.errors.append(msg)
        self.valid = False


# ─────────────────────────────────────────────────────────────────────────────
def _detect_file_type(data: bytes) -> tuple[Optional[str], Optional[str]]:
    """Detect file type from magic bytes. Returns (type_key, mime_type)."""
    for magic, (ftype, mime) in MAGIC_SIGNATURES.items():
        if data[:len(magic)] == magic:
            return ftype, mime
    # JSON detection (UTF-8 text starting with { or [)
    try:
        text = data[:512].decode("utf-8", errors="ignore").lstrip()
        if text.startswith(("{", "[")):
            return "json", "application/json"
    except Exception:
        pass
    return None, None


def validate(
    file_bytes: bytes,
    original_filename: str,
    source_channel: str,
) -> ValidationResult:
    """
    Run all DM-002 checks.

    Parameters
    ----------
    file_bytes        : Raw bytes of the uploaded file.
    original_filename : Original name including extension.
    source_channel    : One of api | sftp | email | portal | barcode | voice.

    Returns
    -------
    ValidationResult with .valid flag and list of .errors.
    """
    result = ValidationResult(valid=True)
    result.file_size = len(file_bytes)

    # ── 1. Size check ────────────────────────────────────────────────────
    max_size = MAX_SIZE_BYTES.get(source_channel, MAX_SIZE_BYTES["default"])
    if result.file_size == 0:
        result.add_error("File is empty.")
    elif result.file_size > max_size:
        mb = result.file_size / (1024 * 1024)
        max_mb = max_size / (1024 * 1024)
        result.add_error(f"File size {mb:.1f} MB exceeds limit of {max_mb:.0f} MB.")

    # ── 2. Extension check ───────────────────────────────────────────────
    ext = ("." + original_filename.rsplit(".", 1)[-1].lower()) if "." in original_filename else ""
    ext_type = EXTENSION_TO_TYPE.get(ext)

    # ── 3. Magic-byte detection ──────────────────────────────────────────
    detected_type, detected_mime = _detect_file_type(file_bytes)

    # Reconcile extension vs magic bytes
    if detected_type:
        result.file_type = detected_type
        result.content_type = detected_mime
    elif ext_type:
        result.file_type = ext_type
        logger.warning("Could not verify '%s' via magic bytes; trusting extension.", original_filename)
    else:
        result.add_error(f"Unrecognised file format for '{original_filename}'.")

    # ── 4. Channel allow-list check ──────────────────────────────────────
    allowed = CHANNEL_ALLOWED_TYPES.get(source_channel, set())
    if allowed and result.file_type and result.file_type not in allowed:
        result.add_error(
            f"File type '{result.file_type}' is not accepted via the '{source_channel}' channel. "
            f"Allowed: {sorted(allowed)}."
        )

    # ── 5. Basic structure checks ────────────────────────────────────────
    if result.file_type == "json" and result.valid:
        import json
        try:
            json.loads(file_bytes.decode("utf-8", errors="replace"))
        except Exception:
            result.add_error("JSON file is malformed / not valid JSON.")

    if result.file_type == "xml" and result.valid:
        import xml.etree.ElementTree as ET
        try:
            ET.fromstring(file_bytes)
        except Exception as exc:
            result.add_error(f"XML file failed structure check: {exc}")

    # ── 6. Content hash ──────────────────────────────────────────────────
    result.content_hash = hashlib.sha256(file_bytes).hexdigest()

    if result.errors:
        logger.warning("Validation failed for '%s': %s", original_filename, result.errors)
    else:
        logger.info("Validation passed for '%s' (%s, %d bytes).",
                    original_filename, result.file_type, result.file_size)

    return result


def validate_barcode_payload(payload: str) -> ValidationResult:
    """Validate a decoded barcode / QR string payload (non-binary)."""
    result = ValidationResult(valid=True, file_type="barcode", content_type="text/plain")
    result.file_size = len(payload.encode("utf-8"))
    if not payload or not payload.strip():
        result.add_error("Barcode payload is empty.")
    result.content_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return result
