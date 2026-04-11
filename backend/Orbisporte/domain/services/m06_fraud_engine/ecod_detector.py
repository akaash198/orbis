"""
ECOD Anomaly Detector  (SOP FRAUD-003)
=======================================
Detects value-based fraud:
  - Under-invoicing  : CIF value far below market/historical distribution
  - Over-invoicing   : CIF value far above market/historical distribution
  - Freight anomaly  : Freight/CIF ratio outside normal bounds
  - Duty ratio anomaly: Declared duty too low relative to CIF + HSN rate

Why ECOD (Empirical Cumulative Distribution-Based Outlier Detection)?
----------------------------------------------------------------------
- Non-parametric: makes NO assumptions about the distribution of invoice values
  (customs data is heavy-tailed, multi-modal, never normally distributed)
- Unsupervised: works without labelled fraud examples
- Interpretable: anomaly score directly reflects how far a value lies in
  the tails of its empirical CDF — explainable to customs officers
- Low compute: no matrix inversion or gradient descent needed
- Primary: PyOD ECOD model
- Fallback: IQR + z-score rule if PyOD not installed

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import statistics
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ── Optional PyOD import ──────────────────────────────────────────────────────
try:
    from pyod.models.ecod import ECOD as _ECOD
    _PYOD_AVAILABLE = True
except ImportError:
    _PYOD_AVAILABLE = False
    logger.warning("[ECOD] PyOD not found — using IQR/z-score fallback")

# Minimum sample size before statistical models are meaningful
_MIN_SAMPLES = 10

# Freight-to-CIF ratio bounds (typical range for sea freight: 2%–25%)
_FREIGHT_RATIO_LOW  = 0.005
_FREIGHT_RATIO_HIGH = 0.35

# Insurance-to-CIF ratio bounds (typical: 0.1%–1%)
_INS_RATIO_HIGH = 0.03


# =============================================================================
# Core ECOD wrapper
# =============================================================================

def _ecod_scores(values: np.ndarray) -> np.ndarray:
    """
    Fit ECOD on `values` and return anomaly scores (higher = more anomalous).
    Scores are normalised to 0–100.
    """
    X = values.reshape(-1, 1)
    if _PYOD_AVAILABLE and len(X) >= _MIN_SAMPLES:
        try:
            clf = _ECOD(contamination=0.1)
            clf.fit(X)
            raw = clf.decision_scores_  # higher = more anomalous
            # Normalise to 0–100
            lo, hi = raw.min(), raw.max()
            if hi > lo:
                return ((raw - lo) / (hi - lo) * 100).astype(float)
            return np.zeros(len(X), dtype=float)
        except Exception as exc:
            logger.warning("[ECOD] PyOD fit failed: %s — using IQR fallback", exc)

    # IQR fallback
    return _iqr_scores(values)


def _iqr_scores(values: np.ndarray) -> np.ndarray:
    """
    IQR-based outlier score.  Score = distance from IQR fence / IQR width,
    scaled to 0–100. Values inside fence score 0.
    """
    if len(values) < 4:
        return np.zeros(len(values), dtype=float)
    q1, q3 = np.percentile(values, [25, 75])
    iqr = q3 - q1 + 1e-9
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    scores = np.zeros(len(values), dtype=float)
    for i, v in enumerate(values):
        if v < lower:
            scores[i] = min((lower - v) / iqr * 33, 100.0)
        elif v > upper:
            scores[i] = min((v - upper) / iqr * 33, 100.0)
    return scores


# =============================================================================
# Value fraud detection
# =============================================================================

def detect_value_fraud(
    transactions: List[Dict[str, Any]],
    target_idx: int = -1,
) -> Dict[str, Any]:
    """
    Detect under/over-invoicing using ECOD on CIF values.

    Parameters
    ----------
    transactions : list of transaction dicts; each must have
                   'cif_value_inr', 'hsn_code' (optional), 'transaction_id'
    target_idx   : index of the transaction to score in context of all others.
                   -1 = score the last entry (new transaction).

    Returns
    -------
    {
      "anomaly_score"   : float 0–100,
      "is_anomaly"      : bool,
      "direction"       : "under" | "over" | "normal",
      "peer_median_inr" : float,
      "peer_count"      : int,
      "algorithm"       : "ecod" | "iqr",
    }
    """
    if not transactions:
        return _null_result()

    values = np.array([
        float(t.get("cif_value_inr") or 0) for t in transactions
    ], dtype=float)

    idx = target_idx % len(values)

    if len(values) < 2:
        return _null_result()

    scores = _ecod_scores(values)
    score = round(float(scores[idx]), 1)

    target_val = values[idx]
    peers = np.delete(values, idx)
    peer_median = float(np.median(peers)) if len(peers) else target_val

    direction = "normal"
    if score >= 30:
        direction = "under" if target_val < peer_median else "over"

    return {
        "anomaly_score"   : score,
        "is_anomaly"      : score >= 30,
        "direction"       : direction,
        "peer_median_inr" : round(peer_median, 2),
        "peer_count"      : len(peers),
        "algorithm"       : "ecod" if (_PYOD_AVAILABLE and len(values) >= _MIN_SAMPLES) else "iqr",
    }


# =============================================================================
# Freight anomaly detection
# =============================================================================

def detect_freight_anomaly(
    cif_inr: float,
    freight_inr: float,
    insurance_inr: float,
) -> Dict[str, Any]:
    """
    Detect freight/insurance manipulation.

    Checks:
    1. Freight-to-CIF ratio outside [0.5%, 35%]
    2. Insurance-to-CIF ratio above 3%
    3. Zero freight on a sea shipment (suspicious)
    4. Freight > CIF (impossible under normal trade)

    Returns score 0–100 and textual evidence.
    """
    if cif_inr <= 0:
        return {"anomaly_score": 0.0, "is_anomaly": False, "evidence": []}

    evidence: List[str] = []
    score = 0.0

    freight_ratio = freight_inr / cif_inr if cif_inr > 0 else 0
    ins_ratio = insurance_inr / cif_inr if cif_inr > 0 else 0

    if freight_inr == 0:
        score += 20.0
        evidence.append("Freight declared as zero — CIF value may be manipulated")

    elif freight_inr > cif_inr:
        score += 60.0
        evidence.append(
            f"Freight (₹{freight_inr:,.0f}) exceeds CIF value (₹{cif_inr:,.0f}) — "
            "physically impossible, indicates document manipulation"
        )

    elif freight_ratio < _FREIGHT_RATIO_LOW:
        score += 25.0
        evidence.append(
            f"Freight/CIF ratio {freight_ratio:.2%} is abnormally low "
            f"(normal: {_FREIGHT_RATIO_LOW:.1%}–{_FREIGHT_RATIO_HIGH:.0%})"
        )

    elif freight_ratio > _FREIGHT_RATIO_HIGH:
        score += 35.0
        evidence.append(
            f"Freight/CIF ratio {freight_ratio:.2%} is abnormally high "
            f"(normal: {_FREIGHT_RATIO_LOW:.1%}–{_FREIGHT_RATIO_HIGH:.0%}) — "
            "inflated freight to increase CIF base for refund claims"
        )

    if ins_ratio > _INS_RATIO_HIGH:
        score += 20.0
        evidence.append(
            f"Insurance/CIF ratio {ins_ratio:.2%} exceeds normal maximum "
            f"{_INS_RATIO_HIGH:.0%} — potential CIF inflation"
        )

    return {
        "anomaly_score" : round(min(score, 100.0), 1),
        "is_anomaly"    : score >= 20.0,
        "freight_ratio" : round(freight_ratio, 4),
        "insurance_ratio": round(ins_ratio, 4),
        "evidence"      : evidence,
    }


# =============================================================================
# Duty ratio anomaly
# =============================================================================

def detect_duty_ratio_anomaly(
    cif_inr: float,
    declared_duty_inr: float,
    hsn_bcd_rate: float,  # basic customs duty rate for this HSN (0–1)
) -> Dict[str, Any]:
    """
    Detect if declared duty is suspiciously low relative to the CIF value
    and the applicable BCD rate.

    Expected minimum duty ≈ CIF × BCD_rate × 0.5 (allowing for legitimate
    exemptions, FTAs, partial consignments).
    """
    if cif_inr <= 0 or hsn_bcd_rate <= 0:
        return {"anomaly_score": 0.0, "is_anomaly": False, "evidence": []}

    expected_min = cif_inr * hsn_bcd_rate * 0.5
    evidence: List[str] = []
    score = 0.0

    if declared_duty_inr < expected_min * 0.3:
        score = 70.0
        evidence.append(
            f"Declared duty ₹{declared_duty_inr:,.0f} is less than 30% of "
            f"expected minimum ₹{expected_min:,.0f} for HSN BCD rate {hsn_bcd_rate:.0%}"
        )
    elif declared_duty_inr < expected_min * 0.6:
        score = 35.0
        evidence.append(
            f"Declared duty ₹{declared_duty_inr:,.0f} is unusually low relative to "
            f"CIF ₹{cif_inr:,.0f} at BCD rate {hsn_bcd_rate:.0%}"
        )

    return {
        "anomaly_score"    : round(score, 1),
        "is_anomaly"       : score >= 30.0,
        "expected_min_duty": round(expected_min, 2),
        "evidence"         : evidence,
    }


# =============================================================================
# Duplicate invoice detection
# =============================================================================

def detect_duplicate_invoice(
    bl_number: str,
    invoice_value_inr: float,
    recent_transactions: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Detect duplicate BL numbers or near-identical value submissions.
    """
    if not bl_number or not recent_transactions:
        return {"anomaly_score": 0.0, "is_anomaly": False, "evidence": []}

    evidence: List[str] = []
    score = 0.0

    # Exact BL match
    bl_matches = [
        t for t in recent_transactions
        if t.get("bill_of_lading_number") == bl_number
    ]
    if len(bl_matches) >= 2:
        score = 90.0
        evidence.append(
            f"BL number '{bl_number}' appears {len(bl_matches)} times — "
            "potential duplicate invoice submission"
        )
    elif len(bl_matches) == 1:
        # BL seen once before — check if value is identical
        prev_val = float(bl_matches[0].get("cif_value_inr") or 0)
        if prev_val > 0 and abs(prev_val - invoice_value_inr) / prev_val < 0.01:
            score = 75.0
            evidence.append(
                f"BL '{bl_number}' with near-identical CIF value ₹{invoice_value_inr:,.0f} "
                "seen in a previous submission"
            )

    return {
        "anomaly_score": round(score, 1),
        "is_anomaly"   : score >= 50.0,
        "evidence"     : evidence,
    }


# =============================================================================
# Helpers
# =============================================================================

def _null_result() -> Dict[str, Any]:
    return {
        "anomaly_score"  : 0.0,
        "is_anomaly"     : False,
        "direction"      : "normal",
        "peer_median_inr": 0.0,
        "peer_count"     : 0,
        "algorithm"      : "none",
    }
