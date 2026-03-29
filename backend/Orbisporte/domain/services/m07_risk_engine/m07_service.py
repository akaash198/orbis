"""
M07 — Risk Score Engine  (SOP RISK-001 to RISK-006)
=====================================================
Aggregates signals from all upstream modules into a single 0–100 composite
risk score per shipment. Drives automated routing to clearance, review queue,
or investigation. Uses TabPFN-2.5 with SHAP-style explainability for
regulatory audit compliance.

SOPs
----
  RISK-001  Pull feature vector from M02 / M03 / M04 / M05 / M06
  RISK-002  TabPFN-2.5 scoring (rule-based fallback when package absent)
  RISK-003  SHAP-proxy feature contribution decomposition
  RISK-004  Tier assignment + automated routing action
  RISK-005  Persist result; create review queue item for AMBER / RED
  RISK-006  Expose history, review queue, and audit trail

Risk tiers
----------
  0–30   GREEN  Auto-clearance  (Faceless First Check)
  31–60  AMBER  Review queue    (Second Check / Scrutiny — 2h SLA)
  61–100 RED    Investigation   (Detailed Examination / DRI referral)

Feature weights (SHAP-proxy reference)
---------------------------------------
  Compliance history     15%
  Document completeness  10%
  M06 Fraud score        30%
  HSN confidence          8%
  Duty anomalies         10%
  Country risk           10%
  Routing anomaly         7%
  Benford's Law           5%
  (minor signals)         5%

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from Orbisporte.domain.services.m07_risk_engine.feature_builder import FeatureBuilder
from Orbisporte.domain.services.m07_risk_engine.tabpfn_scorer import (
    TabPFNScorer,
    FEATURE_LABELS,
)

logger = logging.getLogger(__name__)

# Module-level scorer singleton — TabPFN is loaded once
_scorer: Optional[TabPFNScorer] = None


def _get_scorer() -> TabPFNScorer:
    global _scorer
    if _scorer is None:
        _scorer = TabPFNScorer()
    return _scorer


# ── Tier metadata ─────────────────────────────────────────────────────────────

_TIER_ACTION = {
    "GREEN": "AUTO_CLEARANCE",
    "AMBER": "ASSIGN_REVIEW",
    "RED":   "REFER_INVESTIGATION",
}

_TIER_LABEL = {
    "GREEN": "Green — Auto-Clearance",
    "AMBER": "Amber — Review Queue",
    "RED":   "Red — Investigation",
}

_TIER_CUSTOMS = {
    "GREEN": "Faceless First Check",
    "AMBER": "Second Check / Scrutiny",
    "RED":   "Detailed Examination / DRI Referral",
}

_TIER_SLA = {
    "GREEN": None,
    "AMBER": 2,    # hours
    "RED":   None,
}


# ── Main service ──────────────────────────────────────────────────────────────

class M07RiskEngine:
    """Orchestrates the full M07 risk scoring pipeline."""

    def __init__(self, db: Session):
        self.db      = db
        self._fb     = FeatureBuilder(db)
        self._scorer = _get_scorer()

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def score_auto(
        self,
        *,
        filing_id:   Optional[int],
        document_id: Optional[int],
        m06_result:  Optional[Dict[str, Any]],
        user_id:     int,
    ) -> Dict[str, Any]:
        """
        RISK-001 → RISK-006: full automatic pipeline.
        Pulls features from upstream modules, scores, explains, persists, routes.
        """
        analysis_uuid = str(uuid.uuid4())
        try:
            # RISK-001: build feature vector
            features, meta = self._fb.build(
                filing_id   = filing_id,
                document_id = document_id,
                m06_result  = m06_result,
                user_id     = user_id,
            )

            # RISK-002 + RISK-003: score + SHAP-proxy contributions
            score, tier, contributions, model_label = self._scorer.score(features)

            # RISK-004: routing
            action       = _TIER_ACTION[tier]
            tier_label   = _TIER_LABEL[tier]
            customs_equiv = _TIER_CUSTOMS[tier]
            sla_hours    = _TIER_SLA[tier]

            # Enrich contributions with labels for UI rendering
            contrib_rich = {
                name: {
                    "value":       features.get(name, 0.0),
                    "contribution": contributions.get(name, 0.0),
                    "label":        FEATURE_LABELS.get(name, name),
                }
                for name in features
            }

            # RISK-005: persist
            queue_id = self._persist(
                analysis_uuid = analysis_uuid,
                user_id       = user_id,
                filing_id     = filing_id,
                document_id   = document_id,
                score         = score,
                tier          = tier,
                action        = action,
                features      = features,
                contributions = contributions,
                model_label   = model_label,
                meta          = meta,
            )

            return {
                "success":        True,
                "analysis_uuid":  analysis_uuid,
                "score":          score,
                "tier":           tier,
                "tier_label":     tier_label,
                "customs_equiv":  customs_equiv,
                "action":         action,
                "sla_hours":      sla_hours,
                "model":          model_label,
                "features":       features,
                "contributions":  contrib_rich,
                "sources":        meta.get("sources", []),
                "importer_iec":   meta.get("importer_iec"),
                "importer_name":  meta.get("importer_name"),
                "cif_value_inr":  meta.get("cif_value_inr"),
                "country_of_origin": meta.get("country_of_origin"),
                "filing_id":      filing_id,
                "document_id":    document_id,
                "queue_id":       queue_id,
            }

        except Exception as exc:
            logger.exception("[M07] score_auto failed: %s", exc)
            return {"success": False, "error": str(exc)}

    def get_recent_filings(self, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        """Recent M05 BoE filings for the UI picker."""
        try:
            rows = self.db.execute(text("""
                SELECT f.id,
                       f.boe_fields_json->>'importer_name'    AS importer_name,
                       f.boe_fields_json->>'importer_iec'     AS importer_iec,
                       f.boe_fields_json->>'hsn_code'         AS hsn_code,
                       f.boe_fields_json->>'country_of_origin' AS country_of_origin,
                       f.boe_fields_json->>'port_of_import'   AS port_of_import,
                       f.boe_fields_json->>'cif_value_inr'    AS cif_value_inr,
                       f.filing_status                        AS status,
                       f.created_at
                FROM m05_boe_filings f
                WHERE f.user_id = :uid
                ORDER BY f.created_at DESC
                LIMIT :lim
            """), {"uid": user_id, "lim": limit}).fetchall()
            return [self._row_to_dict(r) for r in rows]
        except Exception:
            self.db.rollback()
            return []

    def get_queue(
        self,
        user_id: int,
        tier:   Optional[str] = None,
        status: Optional[str] = None,
        limit:  int = 20,
    ) -> List[Dict[str, Any]]:
        """Return AMBER + RED review queue items."""
        try:
            q = """
                SELECT id, analysis_uuid, filing_id, document_id,
                       importer_iec, importer_name,
                       score, tier, action, status,
                       assigned_officer_id, resolution,
                       created_at, resolved_at
                FROM m07_review_queue
                WHERE user_id = :uid
            """
            params: Dict[str, Any] = {"uid": user_id, "lim": limit}
            if tier:
                q += " AND tier = :tier"
                params["tier"] = tier
            if status:
                q += " AND status = :status"
                params["status"] = status
            q += " ORDER BY score DESC, created_at DESC LIMIT :lim"
            rows = self.db.execute(text(q), params).fetchall()
            return [self._row_to_dict(r) for r in rows]
        except Exception:
            self.db.rollback()
            return []

    def update_queue_item(
        self,
        item_id:    int,
        status:     Optional[str],
        resolution: Optional[str],
        user_id:    int,
    ) -> Dict[str, Any]:
        """Officer resolves a review queue item."""
        try:
            existing = self.db.execute(text(
                "SELECT id FROM m07_review_queue WHERE id=:id AND user_id=:uid"
            ), {"id": item_id, "uid": user_id}).fetchone()
        except Exception:
            self.db.rollback()
            return {"success": False, "error": "Item not found"}

        if not existing:
            return {"success": False, "error": "Queue item not found or access denied"}

        updates = ["updated_at = NOW()"]
        params: Dict[str, Any] = {"id": item_id, "uid": user_id}
        if status:
            updates.append("status = :status")
            params["status"] = status
        if resolution:
            updates.append("resolution = :resolution")
            params["resolution"] = resolution
        if status in ("CLEARED", "REFERRED", "DETAINED"):
            updates.append("resolved_at = NOW()")

        try:
            self.db.execute(text(
                f"UPDATE m07_review_queue SET {', '.join(updates)} "
                f"WHERE id = :id AND user_id = :uid"
            ), params)
            self.db.commit()
        except Exception as exc:
            self.db.rollback()
            return {"success": False, "error": str(exc)}

        return {"success": True, "item_id": item_id}

    def get_history(self, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        try:
            rows = self.db.execute(text("""
                SELECT analysis_uuid, filing_id, document_id,
                       importer_iec, importer_name,
                       score, tier, action, model_label,
                       created_at
                FROM m07_risk_scores
                WHERE user_id = :uid
                ORDER BY created_at DESC
                LIMIT :lim
            """), {"uid": user_id, "lim": limit}).fetchall()
            return [self._row_to_dict(r) for r in rows]
        except Exception:
            self.db.rollback()
            return []

    def get_result(self, analysis_uuid: str, user_id: int) -> Optional[Dict[str, Any]]:
        try:
            row = self.db.execute(text("""
                SELECT * FROM m07_risk_scores
                WHERE analysis_uuid = :uuid AND user_id = :uid
            """), {"uuid": analysis_uuid, "uid": user_id}).fetchone()
        except Exception:
            self.db.rollback()
            return None
        if not row:
            return None
        d = self._row_to_dict(row)
        for key in ("features_json", "contributions_json", "meta_json"):
            if d.get(key) and isinstance(d[key], str):
                try:
                    d[key] = json.loads(d[key])
                except Exception:
                    pass
        return d

    # ─────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _persist(
        self,
        *,
        analysis_uuid: str,
        user_id: int,
        filing_id: Optional[int],
        document_id: Optional[int],
        score: float,
        tier: str,
        action: str,
        features: Dict[str, float],
        contributions: Dict[str, float],
        model_label: str,
        meta: Dict[str, Any],
    ) -> Optional[int]:
        """RISK-005: save score row; create review queue item for AMBER / RED."""
        # Save score record
        try:
            self.db.execute(text("""
                INSERT INTO m07_risk_scores
                  (analysis_uuid, user_id, filing_id, document_id,
                   importer_iec, importer_name, score, tier, action,
                   model_label, features_json, contributions_json, meta_json,
                   created_at)
                VALUES
                  (:uuid, :uid, :fid, :did,
                   :iec, :name, :score, :tier, :action,
                   :model, :feats, :contribs, :meta,
                   NOW())
            """), {
                "uuid":    analysis_uuid,
                "uid":     user_id,
                "fid":     filing_id,
                "did":     document_id,
                "iec":     meta.get("importer_iec"),
                "name":    meta.get("importer_name"),
                "score":   score,
                "tier":    tier,
                "action":  action,
                "model":   model_label,
                "feats":   json.dumps(features),
                "contribs": json.dumps(contributions),
                "meta":    json.dumps(meta),
            })
            self.db.commit()
        except Exception as exc:
            logger.error("[M07] Persist score failed: %s", exc)
            self.db.rollback()
            return None

        # Create review queue item for AMBER / RED
        if tier not in ("AMBER", "RED"):
            return None

        try:
            row = self.db.execute(text("""
                INSERT INTO m07_review_queue
                  (analysis_uuid, user_id, filing_id, document_id,
                   importer_iec, importer_name, score, tier, action,
                   status, created_at, updated_at)
                VALUES
                  (:uuid, :uid, :fid, :did,
                   :iec, :name, :score, :tier, :action,
                   'PENDING', NOW(), NOW())
                RETURNING id
            """), {
                "uuid":  analysis_uuid,
                "uid":   user_id,
                "fid":   filing_id,
                "did":   document_id,
                "iec":   meta.get("importer_iec"),
                "name":  meta.get("importer_name"),
                "score": score,
                "tier":  tier,
                "action": action,
            }).fetchone()
            self.db.commit()
            return int(row[0]) if row else None
        except Exception as exc:
            logger.error("[M07] Queue insert failed: %s", exc)
            self.db.rollback()
            return None

    @staticmethod
    def _row_to_dict(row) -> Dict[str, Any]:
        d = dict(row._mapping)
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        return d
