"""
M07 Feature Builder
====================
Extracts and normalises the 12-feature vector from upstream modules
(M02, M03, M04, M05, M06) for TabPFN-2.5 scoring.

Features
--------
  f01  fraud_composite      float [0,100]   M06 composite fraud score
  f02  doc_completeness     float [0,1]     M02 extraction completeness
  f03  hsn_confidence       float [0,1]     M03 top-1 classification confidence
  f04  duty_anomaly_count   int   [0,∞]     M04 anomaly flag count
  f05  fta_claimed          int   {0,1}     FTA benefit claimed
  f06  compliance_rate      float [0,1]     importer past rejection rate (24 mths)
  f07  cif_log              float           log10(CIF_INR + 1)
  f08  country_risk         int   {0,1,2}   0=normal 1=watch 2=restricted
  f09  routing_anomaly      int   {0,1}     M06 routing anomaly flag
  f10  benford_violation    int   {0,1}     M06 Benford violation flag
  f11  duplicate_invoice    int   {0,1}     M06 duplicate invoice flag
  f12  temporal_anomaly     int   {0,1}     M06 temporal pattern anomaly

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Countries at elevated / restricted risk (ISO-3166 alpha-3)
_WATCH_COUNTRIES = {
    "PRK", "IRN", "SYR", "CUB", "SDN", "YEM", "LBY", "SOM",
    "COD", "CAF", "ZWE", "BLR", "MMR",
}
_RESTRICTED_COUNTRIES = {"PRK", "IRN", "SYR", "CUB", "SDN"}


def _safe_float(v, default: float = 0.0) -> float:
    try:
        return float(v or default)
    except (TypeError, ValueError):
        return default


def _safe_int(v, default: int = 0) -> int:
    try:
        return int(v or default)
    except (TypeError, ValueError):
        return default


class FeatureBuilder:
    """Pulls and normalises the 12-feature vector for a shipment."""

    FEATURE_NAMES: List[str] = [
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

    def __init__(self, db: Session):
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # Public entry point
    # ─────────────────────────────────────────────────────────────────────────

    def build(
        self,
        *,
        filing_id: Optional[int] = None,
        document_id: Optional[int] = None,
        m06_result: Optional[Dict[str, Any]] = None,
        user_id: int,
    ) -> Tuple[Dict[str, float], Dict[str, Any]]:
        """
        Returns (feature_dict, metadata_dict).
        feature_dict maps each feature name → normalised value.
        metadata_dict carries raw source values for the audit trail.
        """
        meta: Dict[str, Any] = {
            "filing_id": filing_id,
            "document_id": document_id,
            "sources": [],
        }

        # ── Pull raw module data ──────────────────────────────────────────────
        boe = self._fetch_boe(filing_id) if filing_id else {}
        m04 = self._fetch_m04(filing_id, document_id)
        m03 = self._fetch_m03(document_id or _dig(boe, "document_id"))
        m02 = self._fetch_m02(document_id or _dig(boe, "document_id"))
        m06 = m06_result or self._fetch_latest_m06(filing_id, document_id, user_id)

        if boe: meta["sources"].append("M05_BoE")
        if m04: meta["sources"].append("M04_Duty")
        if m03: meta["sources"].append("M03_HSN")
        if m02: meta["sources"].append("M02_Doc")
        if m06: meta["sources"].append("M06_Fraud")

        # ── Expand BOE JSON blob ──────────────────────────────────────────────
        boe_fields = boe.get("boe_fields_json") or {}
        if isinstance(boe_fields, str):
            try:
                boe_fields = json.loads(boe_fields)
            except Exception:
                boe_fields = {}

        # ── f01 fraud_composite ───────────────────────────────────────────────
        fraud_composite = _safe_float(m06.get("composite_score") if m06 else 0)
        meta["fraud_composite_raw"] = fraud_composite

        # ── f02 doc_completeness ──────────────────────────────────────────────
        doc_completeness = _safe_float(
            m02.get("confidence_score")
            or m02.get("extraction_confidence")
            or m02.get("completeness_score"),
            default=0.75,
        )
        doc_completeness = max(0.0, min(1.0, doc_completeness))
        meta["doc_completeness_raw"] = doc_completeness

        # ── f03 hsn_confidence ────────────────────────────────────────────────
        hsn_confidence = _safe_float(
            m03.get("confidence") or m03.get("top1_confidence"),
            default=0.8,
        )
        hsn_confidence = max(0.0, min(1.0, hsn_confidence))
        meta["hsn_confidence_raw"] = hsn_confidence

        # ── f04 duty_anomaly_count ────────────────────────────────────────────
        raw_flags = m04.get("anomaly_flags") or m04.get("flags_json") or {}
        if isinstance(raw_flags, str):
            try:
                raw_flags = json.loads(raw_flags)
            except Exception:
                raw_flags = {}
        duty_anomaly_count = _safe_int(
            raw_flags.get("count")
            or sum(1 for v in raw_flags.values() if v)
        )
        meta["duty_anomaly_count_raw"] = duty_anomaly_count

        # ── f05 fta_claimed ───────────────────────────────────────────────────
        fta_claimed = int(bool(
            boe_fields.get("fta_claimed")
            or boe.get("fta_claimed")
            or (m06 or {}).get("transaction", {}).get("fta_claimed")
        ))

        # ── f06 compliance_rate ───────────────────────────────────────────────
        iec = (
            boe_fields.get("importer_iec")
            or boe.get("importer_iec")
            or (m06 or {}).get("transaction", {}).get("importer_iec")
            or ""
        )
        meta["importer_iec"] = iec
        meta["importer_name"] = (
            boe_fields.get("importer_name")
            or boe.get("importer_name")
            or (m06 or {}).get("transaction", {}).get("importer_name")
            or ""
        )
        compliance_rate = self._get_compliance_rate(iec, user_id)
        meta["compliance_rate_raw"] = compliance_rate

        # ── f07 cif_log ───────────────────────────────────────────────────────
        cif_raw = _safe_float(
            m04.get("cif_value_inr")
            or boe_fields.get("cif_value_inr")
            or boe.get("cif_value_inr")
        )
        cif_log = math.log10(cif_raw + 1) if cif_raw > 0 else 0.0
        meta["cif_value_inr"] = cif_raw

        # ── f08 country_risk ──────────────────────────────────────────────────
        coo = (
            boe_fields.get("country_of_origin")
            or (m06 or {}).get("transaction", {}).get("country_of_origin")
            or ""
        ).upper()
        country_risk = (
            2 if coo in _RESTRICTED_COUNTRIES
            else (1 if coo in _WATCH_COUNTRIES else 0)
        )
        meta["country_of_origin"] = coo

        # ── f09-f12 from M06 fraud flags / sub-scores ─────────────────────────
        m06_flags   = (m06 or {}).get("fraud_flags") or []
        flag_str    = " ".join(f.get("fraud_type", "").upper() for f in m06_flags)
        m06_scores  = (m06 or {}).get("scores") or {}

        routing_anomaly   = int("ROUTING"   in flag_str or _safe_float(m06_scores.get("routing"))   > 40)
        benford_violation = int("BENFORD"   in flag_str or _safe_float(m06_scores.get("benford"))   > 40)
        duplicate_invoice = int("DUPLICATE" in flag_str)
        temporal_anomaly  = int("TEMPORAL"  in flag_str or _safe_float(m06_scores.get("temporal")) > 40)

        features = {
            "fraud_composite":    fraud_composite,
            "doc_completeness":   doc_completeness,
            "hsn_confidence":     hsn_confidence,
            "duty_anomaly_count": float(duty_anomaly_count),
            "fta_claimed":        float(fta_claimed),
            "compliance_rate":    compliance_rate,
            "cif_log":            cif_log,
            "country_risk":       float(country_risk),
            "routing_anomaly":    float(routing_anomaly),
            "benford_violation":  float(benford_violation),
            "duplicate_invoice":  float(duplicate_invoice),
            "temporal_anomaly":   float(temporal_anomaly),
        }

        return features, meta

    # ─────────────────────────────────────────────────────────────────────────
    # DB fetch helpers — all wrapped in try/except for graceful degradation
    # ─────────────────────────────────────────────────────────────────────────

    def _fetch_boe(self, filing_id: int) -> Dict[str, Any]:
        try:
            row = self.db.execute(text("""
                SELECT id, document_id, boe_fields_json, filing_status,
                       port_of_import
                FROM m05_boe_filings
                WHERE id = :fid
            """), {"fid": filing_id}).fetchone()
            return dict(row._mapping) if row else {}
        except Exception:
            self.db.rollback()
            return {}

    def _fetch_m04(
        self,
        filing_id: Optional[int],
        document_id: Optional[int],
    ) -> Dict[str, Any]:
        # m04_duty_computations links via document_id only (no filing_id column).
        # If we only have a filing_id, resolve document_id from m05_boe_filings first.
        resolved_did = document_id
        if not resolved_did and filing_id:
            try:
                r = self.db.execute(text(
                    "SELECT document_id FROM m05_boe_filings WHERE id = :fid"
                ), {"fid": filing_id}).fetchone()
                resolved_did = r[0] if r else None
            except Exception:
                self.db.rollback()

        if not resolved_did:
            return {}
        try:
            row = self.db.execute(text("""
                SELECT assessable_value_inr,
                       cif_foreign, exchange_rate,
                       total_duty_inr, anomaly_flags,
                       country_of_origin, hsn_code, fta_applicable
                FROM m04_duty_computations
                WHERE document_id = :did
                ORDER BY computed_at DESC LIMIT 1
            """), {"did": resolved_did}).fetchone()
            if not row:
                return {}
            d = dict(row._mapping)
            # Synthesise a cif_value_inr for downstream consumers
            d["cif_value_inr"] = float(
                d.get("assessable_value_inr")
                or (d.get("cif_foreign") or 0) * (d.get("exchange_rate") or 1)
                or 0
            )
            return d
        except Exception:
            self.db.rollback()
            return {}

    def _fetch_m03(self, document_id) -> Dict[str, Any]:
        if not document_id:
            return {}
        try:
            row = self.db.execute(text("""
                SELECT selected_hsn AS top1_hsn,
                       selected_confidence AS confidence,
                       overall_confidence
                FROM m03_classification_results
                WHERE document_id = :did
                ORDER BY created_at DESC LIMIT 1
            """), {"did": document_id}).fetchone()
            return dict(row._mapping) if row else {}
        except Exception:
            self.db.rollback()
            return {}

    def _fetch_m02(self, document_id) -> Dict[str, Any]:
        if not document_id:
            return {}
        try:
            row = self.db.execute(text("""
                SELECT overall_confidence AS confidence_score,
                       overall_confidence AS extraction_confidence
                FROM m02_extraction_results
                WHERE document_id = :did
                ORDER BY created_at DESC LIMIT 1
            """), {"did": document_id}).fetchone()
            return dict(row._mapping) if row else {}
        except Exception:
            self.db.rollback()
            return {}

    def _fetch_latest_m06(
        self,
        filing_id: Optional[int],
        document_id: Optional[int],
        user_id: int,
    ) -> Dict[str, Any]:
        """Pull the most recent M06 analysis for this filing / user."""
        try:
            row = self.db.execute(text("""
                SELECT composite_score, risk_level,
                       fraud_flags_json, result_json,
                       ecod_score, hclnet_score, hsn_score,
                       benford_score, routing_score,
                       duplicate_score, temporal_score
                FROM m06_fraud_analyses
                WHERE user_id = :uid
                ORDER BY created_at DESC LIMIT 1
            """), {"uid": user_id}).fetchone()
            if not row:
                return {}
            d = dict(row._mapping)
            rj = d.get("result_json")
            if isinstance(rj, str):
                try:
                    rj = json.loads(rj)
                except Exception:
                    rj = {}
            d["transaction"] = (rj or {}).get("transaction", {})
            d["scores"] = {
                "ecod":      d.get("ecod_score", 0),
                "hclnet":    d.get("hclnet_score", 0),
                "hsn":       d.get("hsn_score", 0),
                "benford":   d.get("benford_score", 0),
                "routing":   d.get("routing_score", 0),
                "duplicate": d.get("duplicate_score", 0),
                "temporal":  d.get("temporal_score", 0),
            }
            ff = d.get("fraud_flags_json")
            if isinstance(ff, str):
                try:
                    ff = json.loads(ff)
                except Exception:
                    ff = []
            d["fraud_flags"] = ff or []
            return d
        except Exception:
            self.db.rollback()
            return {}

    def _get_compliance_rate(self, iec: str, user_id: int) -> float:
        """Fraction of past filings rejected / queried over 24 months (0–1)."""
        if not iec:
            return 0.0
        try:
            row = self.db.execute(text("""
                SELECT
                    COUNT(*) FILTER (WHERE filing_status IN ('REJECTED','QUERY')) AS bad,
                    COUNT(*)                                                       AS total
                FROM m05_boe_filings
                WHERE boe_fields_json->>'importer_iec' = :iec
                  AND user_id = :uid
                  AND created_at >= NOW() - INTERVAL '24 months'
            """), {"iec": iec, "uid": user_id}).fetchone()
            if not row or not row[1]:
                return 0.0
            return round(row[0] / row[1], 4)
        except Exception:
            self.db.rollback()
            return 0.0


# ─── helpers ─────────────────────────────────────────────────────────────────

def _dig(d: Dict, key: str):
    return d.get(key) if d else None
