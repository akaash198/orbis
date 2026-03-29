"""
Confidence Trainer — learns from human-approved reviews.

How it works
------------
Every time a reviewer approves a document via PATCH /m02/review/{id}, the
system records which fields were corrected (human changed the value) vs which
were accepted as-is.

Over many reviews this gives us per-field accuracy rates:

    accuracy(field) = correct_extractions / total_reviewed

These rates are used to calibrate raw confidence scores:

    calibrated_score = raw_score * (ALPHA + (1-ALPHA) * accuracy)

Where ALPHA = 0.5 means:
  • 100% accurate field → score unchanged
  • 50%  accurate field → score * 0.75
  •  0%  accurate field → score * 0.50

Calibration is stored in a JSON file next to this module and reloaded each
pipeline run.  Re-run POST /m02/train to refresh after more reviews arrive.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)

CALIBRATION_FILE = Path(__file__).parent / "confidence_calibration.json"
ALPHA = 0.5   # prior weight: 0 = trust data completely, 1 = ignore data

# In-process calibration cache — avoids a disk read on every pipeline run
_CAL_CACHE:    Dict[str, Dict] = {}
_CAL_CACHE_TS: float           = 0.0
_CAL_TTL:      float           = 300.0   # 5 minutes


# ── Training ──────────────────────────────────────────────────────────────────

def train_from_reviews(db) -> Dict[str, Any]:
    """
    Read all approved M02 reviews from the DB, compute per-field accuracy,
    persist the calibration file, and return a stats summary.
    """
    from Orbisporte.domain.models import M02ExtractionResult

    approved = (
        db.query(M02ExtractionResult)
        .filter(
            M02ExtractionResult.review_status == "approved",
            M02ExtractionResult.reviewed_fields.isnot(None),
        )
        .all()
    )

    if not approved:
        return {
            "trained": False,
            "reason": "No approved reviews found yet. Approve some documents first.",
            "samples": 0,
            "fields_calibrated": 0,
        }

    # field → { correct: int, total: int, errors: list[str] }
    field_stats: Dict[str, Dict] = {}

    for row in approved:
        extracted = row.normalised_fields or row.extracted_fields or {}
        reviewed  = row.reviewed_fields or {}

        for field, ext_val in extracted.items():
            if field.startswith("_") or isinstance(ext_val, (dict, list)):
                continue

            stats = field_stats.setdefault(field, {"correct": 0, "total": 0, "errors": []})
            stats["total"] += 1

            ext_str = str(ext_val or "").strip().lower()
            rev_str = str(reviewed.get(field, "")).strip().lower() if field in reviewed else None

            # Correct = human didn't touch this field OR set the same value
            if rev_str is None or rev_str == ext_str:
                stats["correct"] += 1
            else:
                # Log up to 5 example errors per field for debugging
                if len(stats["errors"]) < 5:
                    stats["errors"].append({"extracted": ext_str, "reviewed": rev_str})

    # Build calibration with Laplace smoothing: (correct+1)/(total+2)
    calibration: Dict[str, Dict] = {}
    for field, s in field_stats.items():
        accuracy = (s["correct"] + 1) / (s["total"] + 2)
        calibration[field] = {
            "accuracy":    round(accuracy, 4),
            "correct":     s["correct"],
            "total":       s["total"],
            "error_rate":  round(1 - accuracy, 4),
            "examples":    s["errors"],
        }

    CALIBRATION_FILE.write_text(json.dumps(calibration, indent=2), encoding="utf-8")
    # Invalidate in-process cache so next pipeline run picks up new calibration
    global _CAL_CACHE, _CAL_CACHE_TS
    _CAL_CACHE    = calibration
    _CAL_CACHE_TS = time.monotonic()
    logger.info(
        "[Trainer] Calibration saved: %d fields from %d reviews.",
        len(calibration), len(approved),
    )

    # Rank worst fields
    worst = sorted(calibration.items(), key=lambda x: x[1]["accuracy"])[:5]

    # ── Retrain CatBoost on human review data ─────────────────────────────
    catboost_result = _retrain_catboost_from_reviews(approved)

    return {
        "trained":           True,
        "samples":           len(approved),
        "fields_calibrated": len(calibration),
        "worst_fields":      [{"field": f, **v} for f, v in worst],
        "calibration":       calibration,
        "catboost":          catboost_result,
    }


# ── CatBoost retraining ───────────────────────────────────────────────────────

def _retrain_catboost_from_reviews(approved_rows) -> Dict:
    """
    Convert approved review DB rows to CatBoost training samples and retrain.

    Label logic:
        - Human accepted field as-is  → label 1.0 (correct extraction)
        - Human corrected the field   → label 0.0 (wrong extraction)
    """
    try:
        from .confidence_catboost import retrain_catboost
    except ImportError:
        return {"trained": False, "reason": "confidence_catboost module not found"}

    review_rows = []
    for row in approved_rows:
        extracted = row.normalised_fields or row.extracted_fields or {}
        reviewed  = row.reviewed_fields or {}
        gliner    = row.raw_entities or {}

        for field, ext_val in extracted.items():
            if field.startswith("_") or isinstance(ext_val, (dict, list)):
                continue

            ext_str = str(ext_val or "").strip().lower()
            rev_str = str(reviewed.get(field, "")).strip().lower() if field in reviewed else None

            # 1.0 = human accepted; 0.0 = human corrected
            label = 1.0 if (rev_str is None or rev_str == ext_str) else 0.0
            review_rows.append({
                "field":           field,
                "value":           ext_val,
                "gliner_entities": gliner,
                "label":           label,
            })

    return retrain_catboost(review_rows)


# ── Inference helpers ─────────────────────────────────────────────────────────

def load_calibration() -> Dict[str, Dict]:
    """
    Load persisted calibration.  Results are cached in-process for 5 minutes
    so the JSON file is not read on every pipeline invocation.
    Cache is invalidated automatically after train_from_reviews() saves new data.
    """
    global _CAL_CACHE, _CAL_CACHE_TS
    now = time.monotonic()
    if _CAL_CACHE and (now - _CAL_CACHE_TS) < _CAL_TTL:
        return _CAL_CACHE

    if not CALIBRATION_FILE.exists():
        return {}
    try:
        _CAL_CACHE    = json.loads(CALIBRATION_FILE.read_text(encoding="utf-8"))
        _CAL_CACHE_TS = now
        return _CAL_CACHE
    except Exception as exc:
        logger.warning("[Trainer] Could not load calibration: %s", exc)
        return {}


def apply_calibration(
    field_scores: Dict[str, float],
    calibration: Dict[str, Dict],
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Apply historical accuracy rates to raw confidence scores.

    Returns
    -------
    calibrated_scores  : adjusted scores (used for routing)
    calibration_deltas : delta per field (for transparency in the API response)
    """
    if not calibration:
        return field_scores, {}

    calibrated: Dict[str, float] = {}
    deltas:     Dict[str, float] = {}

    for field, raw in field_scores.items():
        if field in calibration:
            acc    = calibration[field]["accuracy"]
            factor = ALPHA + (1.0 - ALPHA) * acc
            adj    = round(min(1.0, raw * factor), 3)
        else:
            adj    = raw
            factor = 1.0

        calibrated[field] = adj
        delta = round(adj - raw, 3)
        if delta != 0:
            deltas[field] = delta

    return calibrated, deltas
