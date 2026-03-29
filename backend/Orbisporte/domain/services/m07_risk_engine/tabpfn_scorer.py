"""
M07 TabPFN-2.5 Scorer
======================
Wraps TabPFN-2.5 (Tabular Prior-Fitted Network) to produce a 0–100 composite
risk score from the 12-feature vector built by FeatureBuilder.

TabPFN-2.5 is a 2025 tabular foundation model that uses in-context learning —
it requires no hyperparameter tuning and no domain training data.

The scorer bootstraps TabPFN with a synthetic anchor dataset that covers the
full risk spectrum (GREEN/AMBER/RED) so probability calibration is sensible
from the first inference call.

Fallback
--------
When the tabpfn package is not installed, a weighted linear rule-based scorer
is used with identical feature weights, ensuring consistent behaviour in all
environments.

Score → Tier
------------
  0–30   GREEN  Auto-clearance  (p_red < 0.3)
  31–60  AMBER  Review queue    (p_red 0.3–0.6)
  61–100 RED    Investigation   (p_red > 0.6)

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ── Feature metadata ──────────────────────────────────────────────────────────

# Feature order matches FeatureBuilder.FEATURE_NAMES
_FEATURE_ORDER = [
    "fraud_composite",
    "doc_completeness",
    "hsn_confidence",
    "duty_anomaly_count",
    "fta_claimed",
    "compliance_rate",
    "cif_log",
    "country_risk",
    "routing_anomaly",
    "benford_violation",
    "duplicate_invoice",
    "temporal_anomaly",
]

# Normalisation bounds (lo, hi) for each feature
_BOUNDS: Dict[str, Tuple[float, float]] = {
    "fraud_composite":    (0.0, 100.0),
    "doc_completeness":   (0.0, 1.0),    # inverted — low completeness = higher risk
    "hsn_confidence":     (0.0, 1.0),    # inverted
    "duty_anomaly_count": (0.0, 5.0),
    "fta_claimed":        (0.0, 1.0),
    "compliance_rate":    (0.0, 1.0),
    "cif_log":            (0.0, 9.0),    # log10(1B INR) ≈ 9
    "country_risk":       (0.0, 2.0),
    "routing_anomaly":    (0.0, 1.0),
    "benford_violation":  (0.0, 1.0),
    "duplicate_invoice":  (0.0, 1.0),
    "temporal_anomaly":   (0.0, 1.0),
}

# Weights for rule-based composite and SHAP-proxy contributions
_WEIGHTS: Dict[str, float] = {
    "fraud_composite":    0.30,
    "compliance_rate":    0.15,
    "doc_completeness":   0.10,   # inverted
    "hsn_confidence":     0.08,   # inverted
    "duty_anomaly_count": 0.10,
    "country_risk":       0.10,
    "routing_anomaly":    0.07,
    "benford_violation":  0.05,
    "cif_log":            0.02,
    "duplicate_invoice":  0.01,
    "temporal_anomaly":   0.01,
    "fta_claimed":        0.01,
}

# High-value = lower risk for these features (flip before weighting)
_INVERT = {"doc_completeness", "hsn_confidence"}

# Human-readable labels for each feature
FEATURE_LABELS: Dict[str, str] = {
    "fraud_composite":    "M06 Fraud Score",
    "doc_completeness":   "Document Completeness",
    "hsn_confidence":     "HSN Classification Confidence",
    "duty_anomaly_count": "Duty Anomaly Flags",
    "fta_claimed":        "FTA Benefit Claimed",
    "compliance_rate":    "Compliance History (Rejection Rate)",
    "cif_log":            "Shipment Value (log-scale)",
    "country_risk":       "Country of Origin Risk",
    "routing_anomaly":    "Routing Anomaly",
    "benford_violation":  "Benford's Law Violation",
    "duplicate_invoice":  "Duplicate Invoice Signal",
    "temporal_anomaly":   "Sudden Trade Pattern Change",
}


def _norm(name: str, val: float) -> float:
    lo, hi = _BOUNDS[name]
    if hi == lo:
        return 0.0
    return max(0.0, min(1.0, (val - lo) / (hi - lo)))


def _tier(score: float) -> str:
    if score <= 30:
        return "GREEN"
    if score <= 60:
        return "AMBER"
    return "RED"


# ── Scorer ────────────────────────────────────────────────────────────────────

class TabPFNScorer:
    """
    Produces a 0–100 risk score using TabPFN-2.5 with a rule-based fallback.
    Instantiated once at module level as a singleton.
    """

    def __init__(self):
        self._clf = None
        self._tabpfn_available = False
        self._try_load_tabpfn()

    def _try_load_tabpfn(self):
        try:
            import os
            from tabpfn import TabPFNClassifier  # type: ignore
            # Use the locally downloaded V2 default checkpoint (non-gated).
            # Falls back to auto-download path if file is absent.
            v2_ckpt = os.path.join(
                os.path.expanduser("~"), "AppData", "Roaming", "tabpfn",
                "tabpfn-v2-classifier-v2_default.ckpt",
            )
            model_path = v2_ckpt if os.path.exists(v2_ckpt) else "auto"
            X_ref, y_ref = _synthetic_anchor_data()
            clf = TabPFNClassifier(
                n_estimators=4,
                device="cpu",
                random_state=42,
                model_path=model_path,
            )
            clf.fit(X_ref, y_ref)
            self._clf = clf
            self._tabpfn_available = True
            logger.info("[M07] TabPFN V2 loaded (path=%s) — fitted on %d anchor rows",
                        model_path, len(y_ref))
        except Exception as exc:
            logger.warning("[M07] TabPFN not available (%s) — using rule-based fallback", exc)

    def score(
        self,
        features: Dict[str, float],
    ) -> Tuple[float, str, Dict[str, float], str]:
        """
        Returns (score_0_100, tier, feature_contributions, model_label).

        feature_contributions maps feature_name → contribution to risk score (0-100 scale).
        """
        feat_vec = np.array(
            [features.get(n, 0.0) for n in _FEATURE_ORDER],
            dtype=np.float32,
        ).reshape(1, -1)

        if self._tabpfn_available and self._clf is not None:
            return self._score_tabpfn(features, feat_vec)
        return self._score_rule_based(features)

    # ─────────────────────────────────────────────────────────────────────────

    def _score_tabpfn(
        self,
        features: Dict[str, float],
        feat_vec: np.ndarray,
    ) -> Tuple[float, str, Dict[str, float], str]:
        try:
            proba = self._clf.predict_proba(feat_vec)[0]   # [p_green, p_amber, p_red]
            # Map 3-class probabilities → continuous 0–100 score
            score = float(proba[1] * 45.0 + proba[2] * 100.0)
            score = max(0.0, min(100.0, score))
            tier  = _tier(score)
            contribs = _approx_contributions(features, float(proba[2]))
            return round(score, 2), tier, contribs, "tabpfn-2.5"
        except Exception as exc:
            logger.warning("[M07] TabPFN inference failed (%s) — falling back", exc)
            return self._score_rule_based(features)

    def _score_rule_based(
        self,
        features: Dict[str, float],
    ) -> Tuple[float, str, Dict[str, float], str]:
        total = 0.0
        contribs: Dict[str, float] = {}
        for name in _FEATURE_ORDER:
            weight = _WEIGHTS.get(name, 0.0)
            val = features.get(name, 0.0)
            normalised = _norm(name, val)
            if name in _INVERT:
                normalised = 1.0 - normalised
            contribution = normalised * weight * 100.0
            total += contribution
            contribs[name] = round(contribution, 2)
        total = max(0.0, min(100.0, total))
        return round(total, 2), _tier(total), contribs, "rule-based"

    @property
    def model_label(self) -> str:
        return "tabpfn-2.5" if self._tabpfn_available else "rule-based"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _approx_contributions(
    features: Dict[str, float],
    p_red: float,
) -> Dict[str, float]:
    """
    Approximate SHAP-style feature contributions for TabPFN.
    (TabPFN does not expose native SHAP; we use weight × normalised_value × p_red
    as an audit-friendly proxy that is consistent across model/fallback modes.)
    """
    contribs: Dict[str, float] = {}
    for name in _FEATURE_ORDER:
        weight = _WEIGHTS.get(name, 0.0)
        normalised = _norm(name, features.get(name, 0.0))
        if name in _INVERT:
            normalised = 1.0 - normalised
        contribs[name] = round(normalised * weight * p_red * 100.0, 2)
    return contribs


def _synthetic_anchor_data() -> Tuple[np.ndarray, np.ndarray]:
    """
    90-row synthetic anchor dataset for TabPFN in-context fitting.
    30 GREEN / 30 AMBER / 30 RED rows covering the full feature space.

    Feature column order matches _FEATURE_ORDER:
      fraud_composite, doc_completeness, hsn_confidence, duty_anomaly_count,
      fta_claimed, compliance_rate, cif_log, country_risk,
      routing_anomaly, benford_violation, duplicate_invoice, temporal_anomaly
    """
    rng = np.random.default_rng(42)
    rows, labels = [], []

    # GREEN (label 0): low fraud, high completeness, clean routing
    for _ in range(30):
        rows.append([
            rng.uniform(0, 28),      # fraud_composite
            rng.uniform(0.82, 1.0),  # doc_completeness
            rng.uniform(0.82, 1.0),  # hsn_confidence
            float(rng.integers(0, 2)),  # duty_anomaly_count
            0.0,                     # fta_claimed
            rng.uniform(0, 0.04),    # compliance_rate
            rng.uniform(4.0, 6.5),   # cif_log
            0.0,                     # country_risk
            0.0,                     # routing_anomaly
            0.0,                     # benford_violation
            0.0,                     # duplicate_invoice
            0.0,                     # temporal_anomaly
        ])
        labels.append(0)

    # AMBER (label 1): moderate signals across features
    for _ in range(30):
        rows.append([
            rng.uniform(28, 62),
            rng.uniform(0.5, 0.82),
            rng.uniform(0.5, 0.82),
            float(rng.integers(1, 3)),
            float(rng.integers(0, 2)),
            rng.uniform(0.04, 0.20),
            rng.uniform(5.0, 8.0),
            float(rng.integers(0, 2)),
            float(rng.integers(0, 2)),
            float(rng.integers(0, 2)),
            0.0,
            float(rng.integers(0, 2)),
        ])
        labels.append(1)

    # RED (label 2): high fraud, poor docs, restricted countries
    for _ in range(30):
        rows.append([
            rng.uniform(62, 100),
            rng.uniform(0.0, 0.50),
            rng.uniform(0.0, 0.50),
            float(rng.integers(2, 6)),
            float(rng.integers(0, 2)),
            rng.uniform(0.20, 1.0),
            rng.uniform(6.0, 9.0),
            float(rng.integers(1, 3)),
            1.0,
            float(rng.integers(0, 2)),
            float(rng.integers(0, 2)),
            float(rng.integers(0, 2)),
        ])
        labels.append(2)

    return np.array(rows, dtype=np.float32), np.array(labels, dtype=int)
