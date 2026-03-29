"""
M02 Confidence Scorer — SOP DE-003.

Primary scorer: LightGBM gradient-boosted model (confidence_lgbm.py).
Fallback scorer: rule-based heuristics (when LightGBM is unavailable).

Rule-based signals (used as fallback AND as pseudo-labels for LightGBM bootstrap):
  1. Presence      — was the field extracted at all? (0 or 0.65)
  2. Format        — does the value match the expected pattern? (0–0.25)
                     Fields with no defined pattern get a neutral +0.15.
  3. GLiNER bonus  — does GLiNER independently agree? (0–0.10)
  4. Plausibility  — is the value semantically reasonable? (0.05)

Routing thresholds (SOP DE-003)
--------------------------------
  >= 0.95  →  auto          (auto-accepted)
  0.90–0.94 → soft_review   (AI pre-fills, human confirms)
  0.70–0.89 → hard_review   (human re-enters field)
  < 0.70   →  quality_alert (request re-scan)
"""

import re
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)

# ── Scoring weights ───────────────────────────────────────────────────────────
W_PRESENCE   = 0.65   # field is present and non-empty
W_FORMAT_HIT = 0.25   # value matches the field's regex pattern
W_FORMAT_NEU = 0.15   # no pattern defined — neutral partial credit
W_GLINER     = 0.10   # GLiNER independently agrees (bonus; not required)
W_PLAUSIBLE  = 0.05   # value passes sanity checks

# Penalty per missing required field applied to overall score
REQUIRED_FIELD_PENALTY = 0.08

# ── Field format validators ───────────────────────────────────────────────────
PATTERNS = {
    # Identifiers
    "invoice_number":        r"[A-Z0-9/\-]{3,30}",
    "gst_number":            r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]",
    "iec_number":            r"[0-9]{10}",
    "bill_of_lading_number": r"[A-Z0-9]{6,20}",
    "awb_number":            r"[0-9]{3}[-\s]?[0-9]{8}|[A-Z0-9]{6,15}",
    "container_number":      r"[A-Z]{4}\d{7}|[A-Z0-9]{8,12}",
    "purchase_order_number": r"[A-Z0-9/\-]{3,25}",
    "flight_number":         r"[A-Z]{2,3}\s?\d{2,4}",
    # Codes
    "hsn_code":              r"[0-9]{4,8}",
    "currency":              r"USD|INR|EUR|GBP|JPY|CNY|AED|SGD|AUD|CAD|THB|MYR|IDR|VND|BDT|TWD|KRW",
    "country_of_origin":     r"[A-Z]{2}|[A-Za-z ]{3,30}",
    "incoterms":             r"EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF",
    # Dates
    "invoice_date":          r"\d{4}-\d{2}-\d{2}|\d{2}[/\-\.]\d{2}[/\-\.]\d{4}|\d{1,2}\s+\w+\s+\d{4}",
    "shipment_date":         r"\d{4}-\d{2}-\d{2}|\d{2}[/\-\.]\d{2}[/\-\.]\d{4}|\d{1,2}\s+\w+\s+\d{4}",
    # Numerics
    "total_value":           r"[\d,]+\.?\d*",
    "unit_price":            r"[\d,]+\.?\d*",
    "quantity":              r"[\d,]+\.?\d*",
    "freight":               r"[\d,]+\.?\d*",
    "insurance":             r"[\d,]+\.?\d*",
    "cif_value":             r"[\d,]+\.?\d*",
}

# Pre-compiled patterns — eliminates regex recompilation on every field call
_COMPILED_PATTERNS: Dict[str, re.Pattern] = {
    k: re.compile(v, re.IGNORECASE) for k, v in PATTERNS.items()
}

# Required core fields — missing each one penalises the overall score
REQUIRED_FIELDS = {
    "invoice_number", "invoice_date", "exporter_name",
    "importer_name", "total_value", "currency",
    "country_of_origin", "hsn_code",
}


# ── Signal functions ──────────────────────────────────────────────────────────

def _presence(value: Any) -> float:
    if value is None:
        return 0.0
    s = str(value).strip()
    if not s or s.lower() in ("none", "n/a", "unknown", "null", "-", ""):
        return 0.0
    return W_PRESENCE


def _format_score(field: str, value: Any) -> float:
    if value is None:
        return 0.0
    compiled = _COMPILED_PATTERNS.get(field)
    if not compiled:
        return W_FORMAT_NEU   # no pattern → neutral partial credit
    try:
        return W_FORMAT_HIT if compiled.search(str(value)) else 0.0
    except Exception:
        return 0.0


def _gliner_agreement(field: str, gpt_value: Any, gliner_entities: dict) -> float:
    """
    Compare GPT-extracted value against GLiNER's independent span.
    Returns 0–W_GLINER. Returns 0 if GLiNER is unavailable (graceful degradation).
    """
    if not gliner_entities or field not in gliner_entities:
        return 0.0
    if gpt_value is None:
        return 0.0

    entity      = gliner_entities[field]
    gliner_text = str(entity.get("text", "")).lower().strip()
    gpt_text    = str(gpt_value).lower().strip()
    gliner_conf = float(entity.get("confidence", 0.5))

    if gliner_text and (gliner_text in gpt_text or gpt_text in gliner_text):
        return round(W_GLINER * gliner_conf, 4)
    return 0.0


def _plausibility(field: str, value: Any) -> float:
    """Sanity checks for numeric fields; flat bonus for everything else."""
    if value is None:
        return 0.0
    v = str(value).strip()
    try:
        if field in ("total_value", "unit_price", "freight", "insurance", "cif_value"):
            num = float(re.sub(r"[^\d.]", "", v.replace(",", "")))
            return W_PLAUSIBLE if 0 < num < 1_000_000_000 else 0.0
        if field == "quantity":
            num = float(re.sub(r"[^\d.]", "", v.replace(",", "")) or "0")
            return W_PLAUSIBLE if 0 < num < 1_000_000 else 0.0
    except Exception:
        pass
    return W_PLAUSIBLE   # present text field — default bonus


# ── Field & overall scoring ───────────────────────────────────────────────────

def score_field(field: str, value: Any, gliner_entities: dict) -> float:
    """
    Compute confidence for one field (0.0–1.0).

    Tries CatBoost first (ordered boosting, better calibration on small
    datasets); falls back to rule-based heuristics if CatBoost is not
    installed or the model call fails.
    """
    # ── CatBoost path (primary) ───────────────────────────────────────────
    try:
        from .confidence_catboost import score_field_catboost
        cb_score = score_field_catboost(field, value, gliner_entities)
        if cb_score is not None:
            return cb_score
    except Exception:
        pass   # fall through to rule-based

    # ── Rule-based fallback ───────────────────────────────────────────────
    p = _presence(value)
    if p == 0.0:
        return 0.0

    f = _format_score(field, value)
    g = _gliner_agreement(field, value, gliner_entities)
    s = _plausibility(field, value)
    return round(min(p + f + g + s, 1.0), 3)


def score_all_fields(extracted: dict, gliner_entities: dict) -> dict:
    """
    Score every scalar field in the extracted dict.
    Returns {field_name: confidence_score}.

    Uses CatBoost batched inference (one predict() call for all fields)
    for speed; falls back to per-field rule-based scoring if unavailable.
    """
    # ── CatBoost batch path (primary) ─────────────────────────────────────
    try:
        from .confidence_catboost import score_all_fields_catboost
        batch = score_all_fields_catboost(extracted, gliner_entities)
        if batch is not None:
            return batch
    except Exception:
        pass

    # ── Rule-based fallback (per field) ──────────────────────────────────
    scores = {}
    for field, value in extracted.items():
        if field.startswith("_") or isinstance(value, (dict, list)):
            continue
        scores[field] = score_field(field, value, gliner_entities)
    return scores


def compute_overall_confidence(scores: dict) -> float:
    """
    Overall confidence = average of PRESENT fields only.

    Absent fields (score == 0.0) are not counted — they represent optional
    fields that are simply not on this document, not extraction errors.
    Each missing required field subtracts REQUIRED_FIELD_PENALTY from the average.
    """
    if not scores:
        return 0.0

    present = {f: s for f, s in scores.items() if s > 0.0}
    if not present:
        return 0.0

    avg = sum(present.values()) / len(present)

    missing_required = sum(
        1 for f in REQUIRED_FIELDS if scores.get(f, 0.0) == 0.0
    )
    penalty = missing_required * REQUIRED_FIELD_PENALTY

    return round(max(0.0, min(avg - penalty, 1.0)), 3)


def route_document(overall: float, field_scores: dict) -> dict:
    """
    SOP DE-003 confidence routing.

    Queue is determined solely by overall score — it already encodes
    required-field penalties and present-field quality.

    Returns dict with:
        queue         – auto | soft_review | hard_review | quality_alert
        fields_auto   – present fields with score >= 0.95
        fields_soft   – present fields with score 0.90–0.94
        fields_hard   – present fields with score 0.70–0.89
        fields_low    – present fields with score < 0.70
        quality_alert – bool
    """
    present = {f: s for f, s in field_scores.items() if s > 0.0}

    auto  = {f: s for f, s in present.items() if s >= 0.95}
    soft  = {f: s for f, s in present.items() if 0.90 <= s < 0.95}
    hard  = {f: s for f, s in present.items() if 0.70 <= s < 0.90}
    low   = {f: s for f, s in present.items() if s < 0.70}

    if overall >= 0.95:
        queue = "auto"
    elif overall >= 0.90:
        queue = "soft_review"
    elif overall >= 0.70:
        queue = "hard_review"
    else:
        queue = "quality_alert"

    return {
        "queue":          queue,
        "fields_auto":    auto,
        "fields_soft":    soft,
        "fields_hard":    hard,
        "fields_low":     low,
        "quality_alert":  overall < 0.70,
    }
