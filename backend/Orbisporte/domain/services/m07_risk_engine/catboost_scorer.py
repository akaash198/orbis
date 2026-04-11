"""
M07 CatBoost Supervised Scorer
==============================
Trains a supervised CatBoost model on historical, labeled M07 outcomes and
produces a 0-100 risk score plus GREEN/AMBER/RED tier classification.

Label strategy (from resolved operational outcomes)
---------------------------------------------------
  class 0 (GREEN): auto-cleared green records and explicitly CLEARED cases
  class 1 (AMBER): medium-risk resolved-to-clear escalations
  class 2 (RED):   REFERRED / DETAINED cases

Fallback
--------
If insufficient labeled data exists, falls back to deterministic weighted
rule-based scoring so the API remains fully operational.
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Feature order matches FeatureBuilder.FEATURE_NAMES
FEATURE_ORDER = [
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
    "fraud_composite": (0.0, 100.0),
    "doc_completeness": (0.0, 1.0),  # inverted
    "hsn_confidence": (0.0, 1.0),  # inverted
    "duty_anomaly_count": (0.0, 5.0),
    "fta_claimed": (0.0, 1.0),
    "compliance_rate": (0.0, 1.0),
    "cif_log": (0.0, 9.0),
    "country_risk": (0.0, 2.0),
    "routing_anomaly": (0.0, 1.0),
    "benford_violation": (0.0, 1.0),
    "duplicate_invoice": (0.0, 1.0),
    "temporal_anomaly": (0.0, 1.0),
}

# Used by fallback model and contribution proxy
_WEIGHTS: Dict[str, float] = {
    "fraud_composite": 0.30,
    "compliance_rate": 0.15,
    "doc_completeness": 0.10,  # inverted
    "hsn_confidence": 0.08,  # inverted
    "duty_anomaly_count": 0.10,
    "country_risk": 0.10,
    "routing_anomaly": 0.07,
    "benford_violation": 0.05,
    "cif_log": 0.02,
    "duplicate_invoice": 0.01,
    "temporal_anomaly": 0.01,
    "fta_claimed": 0.01,
}

_INVERT = {"doc_completeness", "hsn_confidence"}

FEATURE_LABELS: Dict[str, str] = {
    "fraud_composite": "M06 Fraud Score",
    "doc_completeness": "Document Completeness",
    "hsn_confidence": "HSN Classification Confidence",
    "duty_anomaly_count": "Duty Anomaly Flags",
    "fta_claimed": "FTA Benefit Claimed",
    "compliance_rate": "Compliance History (Rejection Rate)",
    "cif_log": "Shipment Value (log-scale)",
    "country_risk": "Country of Origin Risk",
    "routing_anomaly": "Routing Anomaly",
    "benford_violation": "Benford's Law Violation",
    "duplicate_invoice": "Duplicate Invoice Signal",
    "temporal_anomaly": "Sudden Trade Pattern Change",
}

_MIN_TRAIN_SAMPLES = int(os.getenv("M07_MIN_TRAIN_SAMPLES", "5"))
_REFRESH_SECONDS = int(os.getenv("M07_MODEL_REFRESH_SECONDS", "3600"))


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


class CatBoostRiskScorer:
    """
    Supervised risk scorer for M07.

    - Primary: CatBoost model trained on labeled historical outcomes
    - Fallback: weighted rule-based scoring
    """

    def __init__(self, db: Optional[Session] = None):
        self._model = None
        self._feature_importance: Dict[str, float] = dict(_WEIGHTS)
        self._model_label = "rule-based"
        self._trained_at: Optional[float] = None
        self._last_train_attempt: float = 0.0

        self._model_path, self._meta_path = self._model_paths()
        self._load_model_from_disk()
        if db is not None:
            self.maybe_retrain(db, force=self._model is None)

    @property
    def model_label(self) -> str:
        return self._model_label

    def maybe_retrain(self, db: Session, *, force: bool = False) -> None:
        now = time.time()
        if not force and now - self._last_train_attempt < _REFRESH_SECONDS:
            return
        self._last_train_attempt = now
        self._train_from_labeled_data(db)

    def score(self, features: Dict[str, float]) -> Tuple[float, str, Dict[str, float], str]:
        vec = np.array([features.get(n, 0.0) for n in FEATURE_ORDER], dtype=np.float32).reshape(1, -1)
        if self._model is not None:
            try:
                proba_by_class = self._predict_proba_map(vec)
                p_amber = proba_by_class.get(1, 0.0)
                p_red = proba_by_class.get(2, 0.0)
                score = float(p_amber * 45.0 + p_red * 100.0)
                score = max(0.0, min(100.0, score))
                tier = _tier(score)
                contribs = self._importance_weighted_contributions(features, score)
                return round(score, 2), tier, contribs, self._model_label
            except Exception as exc:
                logger.warning("[M07] CatBoost inference failed (%s) - using fallback", exc)
        return self._score_rule_based(features)

    def _predict_proba_map(self, vec: np.ndarray) -> Dict[int, float]:
        raw = self._model.predict_proba(vec)[0]
        classes = [int(c) for c in self._model.classes_]
        return {cls: float(raw[idx]) for idx, cls in enumerate(classes)}

    def _score_rule_based(self, features: Dict[str, float]) -> Tuple[float, str, Dict[str, float], str]:
        total = 0.0
        contribs: Dict[str, float] = {}
        for name in FEATURE_ORDER:
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

    def _importance_weighted_contributions(self, features: Dict[str, float], score: float) -> Dict[str, float]:
        signals: Dict[str, float] = {}
        for name in FEATURE_ORDER:
            val = _norm(name, features.get(name, 0.0))
            if name in _INVERT:
                val = 1.0 - val
            signals[name] = max(0.0, val * self._feature_importance.get(name, 0.0))
        total = sum(signals.values()) or 1.0
        return {k: round((v / total) * score, 2) for k, v in signals.items()}

    def _train_from_labeled_data(self, db: Session) -> None:
        try:
            X, y = self._fetch_labeled_training_set(db, include_weak_labels=False)
            quality = "resolved-outcomes"
            if len(X) < _MIN_TRAIN_SAMPLES or len(set(y.tolist())) < 2:
                X, y = self._fetch_labeled_training_set(db, include_weak_labels=True)
                quality = "resolved+historical-tiers"
            if len(X) < _MIN_TRAIN_SAMPLES or len(set(y.tolist())) < 2:
                logger.info(
                    "[M07] Insufficient labeled data for CatBoost (samples=%d, classes=%d); fallback active",
                    len(X), len(set(y.tolist())) if len(y) else 0,
                )
                return

            from catboost import CatBoostClassifier  # type: ignore
            from sklearn.model_selection import train_test_split

            class_counts = {cls: int((y == cls).sum()) for cls in set(y.tolist())}
            has_eval_split = all(v >= 2 for v in class_counts.values()) and len(X) >= 10
            if has_eval_split:
                X_tr, X_va, y_tr, y_va = train_test_split(
                    X,
                    y,
                    test_size=0.2,
                    random_state=42,
                    stratify=y if len(set(y.tolist())) > 1 else None,
                )
            else:
                X_tr, y_tr = X, y
                X_va, y_va = None, None

            n_classes = len(set(y.tolist()))
            params = {
                "iterations": 400,
                "depth": 6,
                "learning_rate": 0.05,
                "random_seed": 42,
                "verbose": False,
            }
            if n_classes >= 3:
                params.update({"loss_function": "MultiClass", "eval_metric": "TotalF1"})
            else:
                params.update({"loss_function": "Logloss", "eval_metric": "AUC"})

            model = CatBoostClassifier(**params)
            if has_eval_split and X_va is not None and y_va is not None:
                model.fit(X_tr, y_tr, eval_set=(X_va, y_va), use_best_model=True)
            else:
                model.fit(X_tr, y_tr, use_best_model=False)

            importances = model.get_feature_importance(type="FeatureImportance")
            self._feature_importance = self._normalise_importance(importances)
            self._model = model
            self._model_label = (
                "catboost-supervised" if quality == "resolved-outcomes"
                else "catboost-supervised-weak-labels"
            )
            self._trained_at = time.time()

            self._save_model_to_disk(X_rows=len(X), y_classes=sorted(set(y.tolist())))
            logger.info(
                "[M07] CatBoost trained successfully (samples=%d, classes=%s, labels=%s)",
                len(X), sorted(set(y.tolist())), quality,
            )
        except Exception as exc:
            logger.warning("[M07] CatBoost training failed (%s); using existing/fallback model", exc)

    def _fetch_labeled_training_set(
        self,
        db: Session,
        *,
        include_weak_labels: bool,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Build labeled training rows from historical M07 outcomes:
        - RED label (2): queue status REFERRED / DETAINED
        - AMBER label (1): queued AMBER/RED records later CLEARED
        - GREEN label (0): GREEN rows with no queue escalation, plus GREEN CLEARED
        """
        rows = db.execute(
            text(
                """
                WITH latest_q AS (
                    SELECT DISTINCT ON (analysis_uuid)
                           analysis_uuid, status, tier
                    FROM m07_review_queue
                    WHERE status IN ('CLEARED', 'REFERRED', 'DETAINED')
                    ORDER BY analysis_uuid, COALESCE(resolved_at, updated_at, created_at) DESC
                )
                SELECT s.features_json, s.tier AS score_tier, q.status AS queue_status, q.tier AS queue_tier
                FROM m07_risk_scores s
                LEFT JOIN latest_q q ON q.analysis_uuid = s.analysis_uuid
                WHERE s.features_json IS NOT NULL
                  AND (
                    s.tier = 'GREEN'
                    OR q.status IN ('CLEARED', 'REFERRED', 'DETAINED')
                  )
                """
            )
        ).fetchall()

        X_rows: List[List[float]] = []
        y_rows: List[int] = []

        for row in rows:
            rec = dict(row._mapping)
            feats = rec.get("features_json")
            if isinstance(feats, str):
                try:
                    feats = json.loads(feats)
                except Exception:
                    feats = None
            if not isinstance(feats, dict):
                continue

            label = self._derive_label(
                score_tier=(rec.get("score_tier") or "").upper(),
                queue_status=(rec.get("queue_status") or "").upper(),
                queue_tier=(rec.get("queue_tier") or "").upper(),
                include_weak_labels=include_weak_labels,
            )
            if label is None:
                continue

            X_rows.append([float(feats.get(name, 0.0) or 0.0) for name in FEATURE_ORDER])
            y_rows.append(label)

        if not X_rows:
            return np.empty((0, len(FEATURE_ORDER)), dtype=np.float32), np.empty((0,), dtype=np.int32)
        return np.array(X_rows, dtype=np.float32), np.array(y_rows, dtype=np.int32)

    @staticmethod
    def _derive_label(
        score_tier: str,
        queue_status: str,
        queue_tier: str,
        include_weak_labels: bool,
    ) -> Optional[int]:
        if queue_status in {"REFERRED", "DETAINED"}:
            return 2
        if queue_status == "CLEARED":
            if queue_tier in {"RED", "AMBER"}:
                return 1
            return 0
        if score_tier == "GREEN":
            return 0
        if include_weak_labels:
            if score_tier == "AMBER":
                return 1
            if score_tier == "RED":
                return 2
        return None

    @staticmethod
    def _normalise_importance(importances) -> Dict[str, float]:
        vals = [max(0.0, float(v)) for v in importances]
        s = sum(vals)
        if s <= 0:
            return dict(_WEIGHTS)
        return {name: vals[idx] / s for idx, name in enumerate(FEATURE_ORDER)}

    @staticmethod
    def _model_paths() -> Tuple[Path, Path]:
        backend_root = Path(__file__).resolve().parents[4]
        model_dir = backend_root / "models"
        model_dir.mkdir(parents=True, exist_ok=True)
        return model_dir / "m07_catboost_model.cbm", model_dir / "m07_catboost_model.meta.json"

    def _save_model_to_disk(self, *, X_rows: int, y_classes: List[int]) -> None:
        if self._model is None:
            return
        try:
            self._model.save_model(str(self._model_path))
            meta = {
                "model_label": self._model_label,
                "trained_at_epoch": self._trained_at,
                "samples": X_rows,
                "classes": y_classes,
                "feature_importance": self._feature_importance,
            }
            self._meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("[M07] Could not persist CatBoost model to disk: %s", exc)

    def _load_model_from_disk(self) -> None:
        if not self._model_path.exists():
            return
        try:
            from catboost import CatBoostClassifier  # type: ignore

            model = CatBoostClassifier()
            model.load_model(str(self._model_path))
            self._model = model
            self._model_label = "catboost-supervised"

            if self._meta_path.exists():
                meta = json.loads(self._meta_path.read_text(encoding="utf-8"))
                fi = meta.get("feature_importance")
                if isinstance(fi, dict):
                    self._feature_importance = {k: float(v) for k, v in fi.items()}
                self._trained_at = float(meta.get("trained_at_epoch") or time.time())

            logger.info("[M07] Loaded CatBoost model from disk: %s", self._model_path)
        except Exception as exc:
            logger.warning("[M07] Could not load persisted CatBoost model: %s", exc)
