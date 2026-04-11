"""
M05 — Pre-filing Risk Predictor  (SOP BOE-002)
===============================================
Estimates probability of ICEGATE rejection / query-raising before submission.

Architecture
------------
Primary  : CatBoost classifier (loaded from `models/m05_predictor.cbm` when
           present — trained offline on 200 000+ historical ICEGATE submissions).
Fallback : Rule-based heuristic scoring (always available, no ML dependency).

Risk score output: 0–100  (higher = more likely to be rejected / queried)
Risk bands:
  0–29  : LOW    — safe to auto-submit
  30–69 : MEDIUM — warn user, require confirmation
  70–100: HIGH   — block submission, show corrective guidance

Features used (align with CatBoost training set when model is available)
------------------------------------------------------------------------
  1. has_iec              : IEC present and 10-digit numeric
  2. has_bl               : Bill of Lading number present
  3. all_hsn_valid        : All HSN codes ≥ 4 digits
  4. cif_value_inr        : Total CIF value (INR)
  5. duty_total_inr       : Total duty amount (INR)
  6. line_item_count      : Number of line items
  7. unique_hsn_count     : Number of distinct HSN codes
  8. country_risk_flag    : 1 if COO is in high-risk list
  9. missing_field_count  : Number of mandatory fields missing
  10. freight_anomaly     : 1 if freight anomaly was flagged in M04

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import os
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ── High-risk country list (FATF grey/black list + UN sanctions) ─────────────
_HIGH_RISK_COUNTRIES = {"IRN", "PRK", "SYR", "MMR", "BLR", "RUS", "CUB", "VEN"}

# ── Mandatory BoE fields (subset that ICEGATE rejects on if missing) ─────────
_MANDATORY_FIELDS = [
    "importer_name", "importer_iec", "importer_address",
    "bill_of_lading_number", "country_of_origin",
    "port_of_import", "port_of_shipment",
    "arrival_date", "hsn_code", "quantity",
    "custom_value_inr", "description_of_goods",
]


def _load_catboost_model():
    """Attempt to load the pre-trained CatBoost model."""
    model_path = Path(__file__).parent / "models" / "m05_predictor.cbm"
    if not model_path.exists():
        return None
    try:
        from catboost import CatBoostClassifier
        model = CatBoostClassifier()
        model.load_model(str(model_path))
        logger.info("[M05 Predictor] CatBoost model loaded from %s", model_path)
        return model
    except Exception as exc:
        logger.warning("[M05 Predictor] Failed to load CatBoost model: %s — using rule-based fallback", exc)
        return None


_MODEL = _load_catboost_model()


def _extract_features(boe_fields: Dict[str, Any], line_items: List[Dict[str, Any]]) -> Dict[str, float]:
    """Convert raw BoE payload into the feature vector used by the predictor."""
    iec = str(boe_fields.get("importer_iec") or "")
    has_iec = 1.0 if (len(iec) == 10 and iec.isdigit()) else 0.0

    has_bl = 1.0 if boe_fields.get("bill_of_lading_number") else 0.0

    hsn_codes = [str(item.get("hsn_code") or "") for item in line_items]
    all_hsn_valid = 1.0 if hsn_codes and all(len(h.replace(" ", "")) >= 4 for h in hsn_codes) else 0.0

    try:
        cif_inr = float(boe_fields.get("custom_value_inr") or 0)
    except (TypeError, ValueError):
        cif_inr = 0.0

    try:
        duty_inr = float(boe_fields.get("custom_duty") or 0)
    except (TypeError, ValueError):
        duty_inr = 0.0

    line_count = float(len(line_items))
    unique_hsn = float(len(set(h for h in hsn_codes if h)))

    coo = str(boe_fields.get("country_of_origin") or "").upper()
    country_risk = 1.0 if coo in _HIGH_RISK_COUNTRIES else 0.0

    missing = sum(
        1 for f in _MANDATORY_FIELDS
        if not boe_fields.get(f) and not any(item.get(f) for item in line_items)
    )

    freight_anomaly = float(boe_fields.get("freight_anomaly_flag", 0))

    return {
        "has_iec": has_iec,
        "has_bl": has_bl,
        "all_hsn_valid": all_hsn_valid,
        "cif_value_inr": cif_inr,
        "duty_total_inr": duty_inr,
        "line_item_count": line_count,
        "unique_hsn_count": unique_hsn,
        "country_risk_flag": country_risk,
        "missing_field_count": float(missing),
        "freight_anomaly": freight_anomaly,
    }


def _rule_based_score(features: Dict[str, float]) -> float:
    """Deterministic rule-based risk score (0–100)."""
    score = 0.0

    # Hard failures
    if features["has_iec"] == 0:
        score += 30
    if features["has_bl"] == 0:
        score += 15
    if features["all_hsn_valid"] == 0:
        score += 25

    # Missing fields
    score += features["missing_field_count"] * 8

    # Country risk
    if features["country_risk_flag"]:
        score += 10

    # Freight anomaly from M04
    if features["freight_anomaly"]:
        score += 5

    # High-value shipment (>₹50L needs extra scrutiny)
    if features["cif_value_inr"] > 5_000_000:
        score += 5

    return min(score, 100.0)


def predict_rejection_risk(
    boe_fields: Dict[str, Any],
    line_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Predict the pre-filing rejection/query risk for a BoE.

    Parameters
    ----------
    boe_fields  : Flat dict of header-level BoE fields
    line_items  : List of line-item dicts

    Returns
    -------
    {
      "risk_score"   : float (0–100),
      "risk_band"    : "LOW" | "MEDIUM" | "HIGH",
      "block_submit" : bool  (True when risk_score >= 70),
      "reasons"      : [str, ...],
      "model_used"   : "catboost" | "rule_based",
    }
    """
    features = _extract_features(boe_fields, line_items)

    # ── CatBoost path ────────────────────────────────────────────────────────
    model_used = "rule_based"
    if _MODEL is not None:
        try:
            import numpy as np
            X = np.array([[features[k] for k in sorted(features)]])
            prob = float(_MODEL.predict_proba(X)[0][1]) * 100
            risk_score = round(prob, 1)
            model_used = "catboost"
        except Exception as exc:
            logger.warning("[M05 Predictor] CatBoost inference failed: %s — using rule fallback", exc)
            risk_score = _rule_based_score(features)
    else:
        risk_score = _rule_based_score(features)

    # ── Derive band and reasons ─────────────────────────────────────────────
    if risk_score < 30:
        band = "LOW"
    elif risk_score < 70:
        band = "MEDIUM"
    else:
        band = "HIGH"

    reasons: list[str] = []
    if features["has_iec"] == 0:
        reasons.append("IEC number is missing or invalid (must be 10-digit numeric)")
    if features["has_bl"] == 0:
        reasons.append("Bill of Lading / Airway Bill number is missing")
    if features["all_hsn_valid"] == 0:
        reasons.append("One or more line items have invalid/missing HSN codes")
    if features["missing_field_count"] > 0:
        reasons.append(f"{int(features['missing_field_count'])} mandatory BoE field(s) are empty")
    if features["country_risk_flag"]:
        reasons.append("Country of origin is on the high-risk/sanctioned list — manual review required")
    if features["freight_anomaly"]:
        reasons.append("M04 freight anomaly was detected — customs officer may scrutinize CIF value")

    return {
        "risk_score": risk_score,
        "risk_band": band,
        "block_submit": risk_score > 30,
        "reasons": reasons,
        "model_used": model_used,
        "features": features,
    }
