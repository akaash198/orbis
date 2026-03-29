"""
M06 — Trade Fraud Detection Engine  (SOP FRAUD-001 to FRAUD-007)
================================================================
Orchestrates the complete fraud analysis pipeline for every incoming
customs transaction.

SOPs
----
  FRAUD-001  Receive & normalise transaction data from M04/M05
  FRAUD-002  Build / update entity relationship hypergraph
  FRAUD-003  ECOD anomaly detection  (value-based fraud)
  FRAUD-004  PrefixSpan pattern mining  (HSN manipulation, split shipments)
  FRAUD-005  HCLNet inference  (network-based fraud)
  FRAUD-006  Benford's Law + routing anomaly analysis
  FRAUD-007  Composite scoring + case creation + analyst assignment

Fraud types detected
--------------------
  1  Under-invoicing             (ECOD)
  2  Over-invoicing              (ECOD)
  3  HSN manipulation            (PrefixSpan)
  4  Misdeclaration of goods     (ECOD + HSN pattern)
  5  Shell company network       (HCLNet + Louvain)
  6  Country-of-origin fraud     (RoutingAnalyser)
  7  Transshipment routing fraud (RoutingAnalyser)
  8  Duplicate invoicing         (ECOD dedup)
  9  Benford's Law violation     (chi-square)
  10 Split shipment fraud        (PrefixSpan)
  11 Freight/insurance manipulation (ECOD freight)
  12 Related-party pricing abuse (HCLNet)
  13 Sudden trade pattern change (temporal z-score)
  14 Restricted goods masking    (routing + HSN)
  15 Document forgery            (multi-signal composite)

Composite score weights
-----------------------
  ECOD value anomaly     20%
  HCLNet network score   25%
  HSN manipulation       15%
  Benford's Law          10%
  Routing anomaly        15%
  Duplicate invoice       5%
  Temporal change        10%

Risk levels
-----------
  0–39  : CLEAN      — no action
  40–59 : SUSPICIOUS — flag for review
  60–79 : HIGH_RISK  — assign to SIIB analyst
  80–100: CRITICAL   — auto-create DRI/SIIB enforcement case

DB Tables used
--------------
  m06_fraud_analyses      — per-transaction fraud analysis result
  m06_fraud_flags         — individual fraud flag records (1 per fraud type found)
  m06_investigation_cases — SIIB/DRI investigation case management
  m06_entity_graph_cache  — serialised graph state per importer group

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from Orbisporte.domain.services.m06_fraud_engine.ecod_detector import (
    detect_value_fraud,
    detect_freight_anomaly,
    detect_duty_ratio_anomaly,
    detect_duplicate_invoice,
)
from Orbisporte.domain.services.m06_fraud_engine.benford import analyse as benford_analyse
from Orbisporte.domain.services.m06_fraud_engine.routing_analyzer import analyse as routing_analyse
from Orbisporte.domain.services.m06_fraud_engine.pattern_miner import (
    detect_hsn_manipulation,
    detect_split_shipments,
    detect_temporal_change,
)
from Orbisporte.domain.services.m06_fraud_engine.graph_builder import HypergraphBuilder
from Orbisporte.domain.services.m06_fraud_engine.hclnet import get_predictor

logger = logging.getLogger(__name__)

# Risk level thresholds
_THRESHOLD_SUSPICIOUS = 40
_THRESHOLD_HIGH_RISK  = 60
_THRESHOLD_CRITICAL   = 80

# Composite score weights (must sum to 1.0)
_WEIGHTS = {
    "ecod"      : 0.20,
    "hclnet"    : 0.25,
    "hsn"       : 0.15,
    "benford"   : 0.10,
    "routing"   : 0.15,
    "duplicate" : 0.05,
    "temporal"  : 0.10,
}

# Peer comparison window: max transactions fetched for ECOD / Benford
_PEER_WINDOW = 200


class M06FraudEngine:
    """Main M06 orchestrator — called from m06_routes.py."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._hclnet = get_predictor()

    # =========================================================================
    # FRAUD-001 to FRAUD-007 — Full analysis pipeline
    # =========================================================================

    def analyse_transaction(
        self,
        transaction: Dict[str, Any],
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Run the complete fraud detection pipeline on one transaction.

        Parameters
        ----------
        transaction : normalised transaction dict (from M04/M05 or direct input)
        user_id     : authenticated user

        Returns
        -------
        Full analysis result including composite score, individual fraud flags,
        HCLNet scores, case ID if created, and model versions used.
        """
        analysis_uuid = str(uuid.uuid4())
        logger.info("[M06] analyse_transaction uuid=%s iec=%s",
                    analysis_uuid, transaction.get("importer_iec"))

        try:
            # ── FRAUD-001: Normalise input ────────────────────────────────
            tx = self._normalise(transaction)
            iec = str(tx.get("importer_iec") or "")

            # ── Fetch historical context ──────────────────────────────────
            peer_txns    = self._get_peer_transactions(iec, user_id, limit=_PEER_WINDOW)
            recent_txns  = self._get_recent_transactions(iec, user_id, days=60)
            shipment_hist= self._get_shipment_history(iec, user_id, limit=50)
            monthly_vols = self._get_monthly_volumes(iec, user_id, months=12)

            # ── FRAUD-003: ECOD anomaly detection ─────────────────────────
            all_txns_for_ecod = peer_txns + [tx]
            ecod_result   = detect_value_fraud(all_txns_for_ecod, target_idx=-1)
            freight_result= detect_freight_anomaly(
                cif_inr      = float(tx.get("cif_value_inr") or 0),
                freight_inr  = float(tx.get("freight_inr") or 0),
                insurance_inr= float(tx.get("insurance_inr") or 0),
            )
            duty_result = detect_duty_ratio_anomaly(
                cif_inr         = float(tx.get("cif_value_inr") or 0),
                declared_duty_inr = float(tx.get("customs_duty_inr") or 0),
                hsn_bcd_rate    = float(tx.get("hsn_bcd_rate") or 0.1),
            )
            dup_result = detect_duplicate_invoice(
                bl_number        = str(tx.get("bill_of_lading_number") or ""),
                invoice_value_inr= float(tx.get("cif_value_inr") or 0),
                recent_transactions = recent_txns,
            )

            # Combined ECOD score
            ecod_score = max(
                ecod_result["anomaly_score"],
                freight_result["anomaly_score"] * 0.7,
                duty_result["anomaly_score"] * 0.6,
            )

            # ── FRAUD-004: Pattern mining ─────────────────────────────────
            hsn_result   = detect_hsn_manipulation(shipment_hist, iec)
            split_result = detect_split_shipments(recent_txns, tx)
            temporal_result = detect_temporal_change(monthly_vols, float(tx.get("cif_value_inr") or 0))

            hsn_score = max(hsn_result["anomaly_score"], split_result["anomaly_score"])

            # ── FRAUD-006: Benford's Law ──────────────────────────────────
            all_values = [float(t.get("cif_value_inr") or 0) for t in peer_txns + [tx]]
            benford_result = benford_analyse(all_values)

            # ── FRAUD-006: Routing anomaly ────────────────────────────────
            routing_result = routing_analyse(
                country_of_origin  = str(tx.get("country_of_origin") or ""),
                country_of_shipment= str(tx.get("country_of_shipment") or ""),
                hsn_code           = str(tx.get("hsn_code") or ""),
                fta_claimed        = bool(tx.get("fta_claimed", False)),
            )

            # ── FRAUD-002 + FRAUD-005: Hypergraph + HCLNet ───────────────
            hclnet_score, community_id, community_size, graph_summary = (
                self._run_hclnet_pipeline(tx, peer_txns, ecod_result, benford_result)
            )

            # ── FRAUD-007: Composite score ────────────────────────────────
            duplicate_score = dup_result["anomaly_score"]
            composite = round(
                ecod_score          * _WEIGHTS["ecod"]
                + hclnet_score      * _WEIGHTS["hclnet"]
                + hsn_score         * _WEIGHTS["hsn"]
                + benford_result["anomaly_score"] * _WEIGHTS["benford"]
                + routing_result["anomaly_score"] * _WEIGHTS["routing"]
                + duplicate_score   * _WEIGHTS["duplicate"]
                + temporal_result["anomaly_score"] * _WEIGHTS["temporal"],
                1,
            )

            risk_level = self._risk_level(composite)

            # ── Build fraud flags list ────────────────────────────────────
            fraud_flags = self._build_fraud_flags(
                ecod_result, freight_result, duty_result, dup_result,
                hsn_result, split_result, temporal_result,
                benford_result, routing_result, hclnet_score,
            )

            # ── Recommendation ────────────────────────────────────────────
            recommendation = self._recommendation(risk_level, fraud_flags)

            # ── FRAUD-007: Create investigation case if warranted ─────────
            case_id = None
            if composite >= _THRESHOLD_HIGH_RISK:
                case_id = self._create_case(
                    analysis_uuid = analysis_uuid,
                    tx            = tx,
                    composite     = composite,
                    risk_level    = risk_level,
                    fraud_flags   = fraud_flags,
                    user_id       = user_id,
                )

            # ── Persist analysis ──────────────────────────────────────────
            analysis_id = self._persist_analysis(
                analysis_uuid  = analysis_uuid,
                tx             = tx,
                composite      = composite,
                risk_level     = risk_level,
                ecod_score     = ecod_score,
                hclnet_score   = hclnet_score,
                hsn_score      = hsn_score,
                benford_score  = benford_result["anomaly_score"],
                routing_score  = routing_result["anomaly_score"],
                duplicate_score= duplicate_score,
                temporal_score = temporal_result["anomaly_score"],
                fraud_flags    = fraud_flags,
                case_id        = case_id,
                user_id        = user_id,
            )

            return {
                "success"         : True,
                "analysis_uuid"   : analysis_uuid,
                "analysis_id"     : analysis_id,
                "composite_score" : composite,
                "risk_level"      : risk_level,
                "fraud_flags"     : fraud_flags,
                "scores": {
                    "ecod"      : round(ecod_score, 1),
                    "hclnet"    : round(hclnet_score, 1),
                    "hsn"       : round(hsn_score, 1),
                    "benford"   : round(benford_result["anomaly_score"], 1),
                    "routing"   : round(routing_result["anomaly_score"], 1),
                    "duplicate" : round(duplicate_score, 1),
                    "temporal"  : round(temporal_result["anomaly_score"], 1),
                },
                "details": {
                    "ecod"          : ecod_result,
                    "freight"       : freight_result,
                    "duty_ratio"    : duty_result,
                    "duplicate"     : dup_result,
                    "hsn_patterns"  : hsn_result,
                    "split_shipment": split_result,
                    "temporal"      : temporal_result,
                    "benford"       : benford_result,
                    "routing"       : routing_result,
                    "graph_summary" : graph_summary,
                },
                "hclnet": {
                    "score"         : round(hclnet_score, 1),
                    "community_id"  : community_id,
                    "community_size": community_size,
                    "model_used"    : self._hclnet.model_used,
                },
                "recommendation"  : recommendation,
                "case_id"         : case_id,
                "model_versions": {
                    "hclnet"  : self._hclnet.model_used,
                    "ecod"    : "pyod_ecod" if _ecod_available() else "iqr_fallback",
                    "pattern" : "prefixspan" if _prefixspan_available() else "bigram_fallback",
                    "benford" : "scipy_chisq" if _scipy_available() else "manual_chisq",
                    "routing" : "rule_based",
                },
            }

        except Exception as exc:
            logger.exception("[M06] analyse_transaction failed: %s", exc)
            return {"success": False, "error": str(exc)}

    # =========================================================================
    # HCLNet pipeline  (FRAUD-002 + FRAUD-005)
    # =========================================================================

    def _run_hclnet_pipeline(
        self,
        tx: Dict[str, Any],
        peer_txns: List[Dict[str, Any]],
        ecod_result: Dict[str, Any],
        benford_result: Dict[str, Any],
    ):
        """Build hypergraph from peers + current tx, run HCLNet, return score."""
        try:
            builder = HypergraphBuilder()

            # Add all peer transactions
            for ptx in peer_txns[-100:]:  # cap at 100 for performance
                builder.add_transaction(ptx)

            # Add current transaction with ECOD / Benford flags
            builder.add_transaction(
                tx,
                ecod_anomaly=ecod_result.get("is_anomaly", False),
                benford_flag=benford_result.get("violated", False),
            )

            if builder.node_count < 2 or builder.edge_count == 0:
                return 0.0, -1, 1, builder.to_summary()

            # Build matrices
            H, node_ids, features = builder.build_matrices()
            W = builder.get_edge_weights()

            # Community detection
            partition = builder.detect_communities()
            community_sizes = builder.get_community_sizes(partition)

            # HCLNet inference
            scores = self._hclnet.predict(features, H, node_ids, community_sizes)

            # Find the importer node for this transaction
            iec = str(tx.get("importer_iec") or "")
            imp_node = f"IMP:{iec}"
            hclnet_score = scores.get(imp_node, 0.0)

            # Community info
            community_id = partition.get(imp_node, -1)
            community_size = community_sizes.get(imp_node, 1)

            return (
                float(hclnet_score),
                int(community_id),
                int(community_size),
                builder.to_summary(),
            )

        except Exception as exc:
            logger.warning("[M06] HCLNet pipeline error: %s", exc)
            return 0.0, -1, 1, {}

    # =========================================================================
    # Fraud flag builder
    # =========================================================================

    def _build_fraud_flags(
        self,
        ecod, freight, duty, dup, hsn, split, temporal, benford, routing, hclnet_score,
    ) -> List[Dict[str, Any]]:
        flags = []

        def _add(fraud_type, score, evidence, algorithm):
            if score >= 20:
                flags.append({
                    "fraud_type" : fraud_type,
                    "score"      : round(score, 1),
                    "evidence"   : evidence,
                    "algorithm"  : algorithm,
                })

        # Value fraud
        if ecod.get("direction") == "under":
            _add("UNDER_INVOICING", ecod["anomaly_score"],
                 f"CIF value ₹{ecod.get('peer_median_inr',0):,.0f} peer median — "
                 "declared value is abnormally low",
                 "ECOD (PyOD)")
        elif ecod.get("direction") == "over":
            _add("OVER_INVOICING", ecod["anomaly_score"],
                 "Declared CIF value is abnormally high relative to peer shipments",
                 "ECOD (PyOD)")

        # Freight
        for ev in freight.get("evidence", []):
            _add("FREIGHT_INSURANCE_MANIPULATION", freight["anomaly_score"], ev,
                 "Ratio analysis")

        # Duty ratio
        for ev in duty.get("evidence", []):
            _add("HSN_MANIPULATION", duty["anomaly_score"], ev, "Duty ratio check")

        # Duplicate
        for ev in dup.get("evidence", []):
            _add("DUPLICATE_INVOICING", dup["anomaly_score"], ev, "BL deduplication")

        # HSN manipulation
        for ev in hsn.get("evidence", []):
            _add("HSN_MANIPULATION", hsn["anomaly_score"], ev, "PrefixSpan")

        # Split shipment
        for ev in split.get("evidence", []):
            _add("SPLIT_SHIPMENT_FRAUD", split["anomaly_score"], ev, "PrefixSpan")

        # Temporal
        if temporal.get("is_anomaly"):
            _add("SUDDEN_TRADE_PATTERN_CHANGE", temporal["anomaly_score"],
                 temporal.get("evidence", ""), "Z-score temporal")

        # Benford
        if benford.get("violated"):
            _add("BENFORD_LAW_VIOLATION", benford["anomaly_score"],
                 benford.get("evidence", ""), "Chi-square Benford")

        # Routing
        for ev in routing.get("evidence", []):
            for ft in routing.get("fraud_types_detected", ["TRANSSHIPMENT_ROUTING_FRAUD"]):
                _add(ft, routing["anomaly_score"], ev, "Routing graph analysis")
            break  # one flag per routing issue

        # HCLNet network
        if hclnet_score >= 40:
            _add("SHELL_COMPANY_NETWORK", hclnet_score,
                 f"Entity embedding distance to known fraud prototype: {hclnet_score:.1f}/100",
                 "HCLNet (Hypergraph Contrastive Learning)")

        # Deduplicate by fraud_type (keep highest score)
        seen: Dict[str, Dict] = {}
        for flag in flags:
            ft = flag["fraud_type"]
            if ft not in seen or flag["score"] > seen[ft]["score"]:
                seen[ft] = flag
        return sorted(seen.values(), key=lambda f: -f["score"])

    # =========================================================================
    # Investigation case management
    # =========================================================================

    # =========================================================================
    # FRAUD-001 (auto) — Pull transaction data from M05 BoE + M04 Duty
    # =========================================================================

    def analyse_auto(
        self,
        filing_id: Optional[int],
        document_id: Optional[int],
        m04_computation_uuid: Optional[str],
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Fully automatic fraud analysis — no manual input required.

        Data source priority:
          1. M05 BoE filing  (filing_id)  → boe_fields_json + line_items_json
          2. M04 duty computation          → CIF, duties, FX, anomaly flags
          3. M02 extracted document        → fallback for any missing fields

        The user only needs to provide one of: filing_id or document_id.
        Everything else is fetched automatically from the DB.
        """
        logger.info("[M06] analyse_auto filing=%s doc=%s uuid=%s user=%s",
                    filing_id, document_id, m04_computation_uuid, user_id)

        # ── Step 1: Pull M05 BoE filing ───────────────────────────────────
        boe_fields: Dict[str, Any] = {}
        line_items: List[Dict[str, Any]] = []

        if filing_id:
            boe_fields, line_items = self._fetch_boe_filing(filing_id, user_id)
            if not boe_fields:
                return {"success": False, "error": f"BoE filing {filing_id} not found or access denied"}

        # ── Step 2: Pull M04 duty computation ─────────────────────────────
        m04_data: Dict[str, Any] = {}
        if m04_computation_uuid:
            m04_data = self._fetch_m04_by_uuid(m04_computation_uuid, user_id)
        elif document_id or boe_fields.get("document_id"):
            did = document_id or boe_fields.get("document_id")
            m04_data = self._fetch_m04_by_document(int(did), user_id)

        # ── Step 3: Pull M02 extraction if no filing ──────────────────────
        extracted: Dict[str, Any] = {}
        if not boe_fields and document_id:
            extracted = self._fetch_m02_extraction(document_id, user_id)

        if not boe_fields and not m04_data and not extracted:
            return {"success": False,
                    "error": "No data found. Please complete M04 duty computation first."}

        # ── Step 4: Build unified transaction dict ─────────────────────────
        tx = self._build_transaction_from_modules(boe_fields, m04_data, extracted, line_items)

        # ── Step 5: Run the full analysis pipeline ─────────────────────────
        result = self.analyse_transaction(tx, user_id)
        result["source"] = {
            "filing_id"          : filing_id,
            "document_id"        : document_id,
            "m04_computation_uuid": m04_computation_uuid,
            "auto_populated_fields": list(tx.keys()),
        }
        return result

    def get_recent_filings(self, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Return M05 BoE filings for the filing picker in the UI.
        Each entry has enough info to identify the filing and show a summary.
        """
        rows = self.db.execute(text("""
            SELECT
                f.id                AS filing_id,
                f.filing_ref,
                f.port_of_import,
                f.filing_status,
                f.icegate_status,
                f.risk_score,
                f.risk_band,
                f.created_at,
                f.boe_fields_json,
                -- pull importer + goods info from the JSON for display
                f.boe_fields_json->>'importer_name'        AS importer_name,
                f.boe_fields_json->>'importer_iec'         AS importer_iec,
                f.boe_fields_json->>'hsn_code'             AS hsn_code,
                f.boe_fields_json->>'description_of_goods' AS description_of_goods,
                f.boe_fields_json->>'country_of_origin'    AS country_of_origin,
                f.boe_fields_json->>'custom_value_inr'     AS custom_value_inr,
                f.boe_fields_json->>'custom_duty'          AS custom_duty,
                f.boe_fields_json->>'document_id'          AS document_id,
                f.boe_fields_json->>'m04_computation_uuid' AS m04_computation_uuid
            FROM m05_boe_filings f
            WHERE f.user_id = :uid
            ORDER BY f.created_at DESC
            LIMIT :lim
        """), {"uid": user_id, "lim": limit}).fetchall()

        result = []
        for row in rows:
            d = dict(row._mapping)
            d.pop("boe_fields_json", None)  # don't send full JSON to the picker
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            result.append(d)
        return result

    # ─── Private fetch helpers ────────────────────────────────────────────

    def _fetch_boe_filing(
        self, filing_id: int, user_id: int
    ) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
        row = self.db.execute(text("""
            SELECT boe_fields_json, line_items_json, document_id
            FROM m05_boe_filings
            WHERE id = :fid AND user_id = :uid
        """), {"fid": filing_id, "uid": user_id}).fetchone()
        if not row:
            return {}, []

        boe_fields = row[0] or {}
        if isinstance(boe_fields, str):
            try:
                boe_fields = json.loads(boe_fields)
            except Exception:
                boe_fields = {}

        # Inject the direct DB column document_id into boe_fields so
        # downstream code can use it to look up M04
        if row[2] and not boe_fields.get("document_id"):
            boe_fields["document_id"] = row[2]

        line_items = row[1] or []
        if isinstance(line_items, str):
            try:
                line_items = json.loads(line_items)
            except Exception:
                line_items = []

        return boe_fields, line_items

    def _fetch_m04_by_uuid(
        self, computation_uuid: str, user_id: int
    ) -> Dict[str, Any]:
        row = self.db.execute(text("""
            SELECT hsn_code, country_of_origin, quantity, unit,
                   assessable_value_inr, exchange_rate, input_currency,
                   bcd_amount, sws_amount, igst_amount, add_amount, cvd_amount,
                   total_duty_inr, anomaly_flags, sop_steps_json
            FROM m04_duty_computations
            WHERE CAST(computation_uuid AS TEXT) = :uuid AND user_id = :uid
            ORDER BY computed_at DESC LIMIT 1
        """), {"uuid": computation_uuid, "uid": user_id}).fetchone()
        return dict(row._mapping) if row else {}

    def _fetch_m04_by_document(
        self, document_id: int, user_id: int
    ) -> Dict[str, Any]:
        row = self.db.execute(text("""
            SELECT hsn_code, country_of_origin, quantity, unit,
                   assessable_value_inr, exchange_rate, input_currency,
                   bcd_amount, sws_amount, igst_amount, add_amount, cvd_amount,
                   total_duty_inr, anomaly_flags, sop_steps_json
            FROM m04_duty_computations
            WHERE document_id = :did AND user_id = :uid
            ORDER BY computed_at DESC LIMIT 1
        """), {"did": document_id, "uid": user_id}).fetchone()
        return dict(row._mapping) if row else {}

    def _fetch_m02_extraction(
        self, document_id: int, user_id: int
    ) -> Dict[str, Any]:
        try:
            row = self.db.execute(text("""
                SELECT normalised_fields, extracted_fields, overall_confidence
                FROM m02_extraction_results
                WHERE document_id = :did AND user_id = :uid
                ORDER BY created_at DESC LIMIT 1
            """), {"did": document_id, "uid": user_id}).fetchone()
        except Exception:
            self.db.rollback()
            return {}
        if not row:
            return {}
        data = row[0] or row[1] or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}
        return data

    def _build_transaction_from_modules(
        self,
        boe_fields: Dict[str, Any],
        m04_data: Dict[str, Any],
        extracted: Dict[str, Any],
        line_items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Merge M05 BoE fields, M04 duty data, and M02 extraction into one
        unified transaction dict for the fraud analysis pipeline.

        Priority: M05 BoE > M04 duty computation > M02 extraction
        Financial values always come from M04 (authoritative).
        """
        def _pick(*keys, sources=None):
            for src in (sources or [boe_fields, extracted]):
                for k in keys:
                    v = src.get(k)
                    if v is not None and str(v).strip() not in ("", "None", "null", "N/A"):
                        return v
            return None

        # Financial — M04 is always authoritative
        anomaly_flags = m04_data.get("anomaly_flags") or {}
        if isinstance(anomaly_flags, str):
            try:
                anomaly_flags = json.loads(anomaly_flags)
            except Exception:
                anomaly_flags = {}

        # CIF: M04 assessable_value_inr is the canonical figure
        cif_inr = float(m04_data.get("assessable_value_inr") or
                        boe_fields.get("custom_value_inr") or 0)

        # Freight / insurance: extract from boe_fields or extracted
        # M05 stores these as derived fields; fall back to extracted
        inv_data = extracted.get("invoice_data") or {}
        freight  = float(_pick("freight_inr", "freight", "freight_amount",
                               sources=[boe_fields, inv_data]) or 0)
        insurance= float(_pick("insurance_inr", "insurance", "insurance_amount",
                               sources=[boe_fields, inv_data]) or 0)

        # Duties — M04 flat columns
        bcd_rate = 0.10  # default; ideally pulled from M03 tariff DB
        total_duty = float(m04_data.get("total_duty_inr") or
                           boe_fields.get("custom_duty") or 0)

        # Build first line item HSN if not in boe_fields header
        first_item = line_items[0] if line_items else {}
        hsn = (str(m04_data.get("hsn_code") or "")
               or str(boe_fields.get("hsn_code") or "")
               or str(first_item.get("hsn_code") or ""))

        return {
            # Identity
            "importer_iec"         : _pick("importer_iec", "iec"),
            "importer_name"        : _pick("importer_name", "buyer_name"),
            "exporter_name"        : _pick("exporter_name", "supplier_name",
                                           sources=[boe_fields, inv_data]),
            # Goods
            "hsn_code"             : hsn,
            "description_of_goods" : _pick("description_of_goods", "description",
                                           "product_description"),
            # Geography
            "country_of_origin"    : (str(m04_data.get("country_of_origin") or "")
                                      or _pick("country_of_origin", "origin_country")),
            "country_of_shipment"  : _pick("country_of_shipment", "country_of_consignment"),
            "port_of_import"       : boe_fields.get("port_of_import", "INMAA1"),
            "port_of_shipment"     : _pick("port_of_shipment", "port_of_loading"),
            # Financial — M04 authoritative
            "cif_value_inr"        : cif_inr,
            "freight_inr"          : freight,
            "insurance_inr"        : insurance,
            "customs_duty_inr"     : total_duty,
            "hsn_bcd_rate"         : bcd_rate,
            # Shipment
            "bill_of_lading_number": _pick("bill_of_lading_number", "bl_number",
                                           "bill_of_lading"),
            "shipping_line"        : _pick("shipping_line", "carrier", "vessel_name"),
            "arrival_date"         : _pick("arrival_date", "eta"),
            # Flags
            "fta_claimed"          : bool(boe_fields.get("fta_rate_applied", False)),
            "freight_anomaly_flag" : int(anomaly_flags.get("has_anomalies", 0)),
            # Pass-through references
            "document_id"          : boe_fields.get("document_id"),
            "m04_computation_uuid" : boe_fields.get("m04_computation_uuid"),
            # Line items (for split shipment + Benford)
            "line_items"           : line_items,
        }

    def get_cases(
        self,
        user_id: int,
        status: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        try:
            q = """
                SELECT id, case_ref, importer_iec, importer_name,
                       composite_score, risk_level, status,
                       fraud_types_json, analyst_id, created_at, updated_at
                FROM m06_investigation_cases
                WHERE user_id = :uid
            """
            params: Dict[str, Any] = {"uid": user_id, "lim": limit}
            if status:
                q += " AND status = :status"
                params["status"] = status
            q += " ORDER BY composite_score DESC, created_at DESC LIMIT :lim"
            rows = self.db.execute(text(q), params).fetchall()
            return [self._row_to_dict(r) for r in rows]
        except Exception:
            self.db.rollback()
            return []

    def update_case(
        self,
        case_id: int,
        status: Optional[str],
        analyst_findings: Optional[str],
        action: Optional[str],
        user_id: int,
    ) -> Dict[str, Any]:
        try:
            existing = self.db.execute(text(
                "SELECT id FROM m06_investigation_cases WHERE id=:cid AND user_id=:uid"
            ), {"cid": case_id, "uid": user_id}).fetchone()
        except Exception:
            self.db.rollback()
            return {"success": False, "error": "Case not found or access denied"}

        if not existing:
            return {"success": False, "error": "Case not found or access denied"}

        updates = []
        params: Dict[str, Any] = {"cid": case_id, "uid": user_id}
        if status:
            updates.append("status = :status")
            params["status"] = status
        if analyst_findings:
            updates.append("analyst_findings = :findings")
            params["findings"] = analyst_findings
        if action:
            updates.append("action_taken = :action")
            params["action"] = action
        updates.append("updated_at = NOW()")

        if updates:
            self.db.execute(text(
                f"UPDATE m06_investigation_cases SET {', '.join(updates)} "
                f"WHERE id = :cid AND user_id = :uid"
            ), params)
            self.db.commit()

        return {"success": True, "case_id": case_id}

    def get_history(self, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        try:
            rows = self.db.execute(text("""
                SELECT analysis_uuid, importer_iec, importer_name,
                       composite_score, risk_level, fraud_types_count,
                       case_id, created_at
                FROM m06_fraud_analyses
                WHERE user_id = :uid
                ORDER BY created_at DESC
                LIMIT :lim
            """), {"uid": user_id, "lim": limit}).fetchall()
            return [self._row_to_dict(r) for r in rows]
        except Exception:
            self.db.rollback()
            return []

    def get_analysis(self, analysis_uuid: str, user_id: int) -> Optional[Dict[str, Any]]:
        try:
            row = self.db.execute(text("""
                SELECT * FROM m06_fraud_analyses
                WHERE analysis_uuid = :uuid AND user_id = :uid
            """), {"uuid": analysis_uuid, "uid": user_id}).fetchone()
        except Exception:
            self.db.rollback()
            return None
        if not row:
            return None
        d = self._row_to_dict(row)
        # Deserialise JSONB blobs
        for key in ("scores_json", "fraud_flags_json", "details_json", "hclnet_json"):
            if d.get(key) and isinstance(d[key], str):
                try:
                    d[key] = json.loads(d[key])
                except Exception:
                    pass
        return d

    # =========================================================================
    # Internal helpers
    # =========================================================================

    def _normalise(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure all required fields exist with sensible types."""
        out = dict(tx)
        for field, default in [
            ("cif_value_inr", 0.0),
            ("freight_inr", 0.0),
            ("insurance_inr", 0.0),
            ("customs_duty_inr", 0.0),
            ("hsn_bcd_rate", 0.10),
            ("fta_claimed", False),
        ]:
            try:
                out[field] = type(default)(out.get(field) or default)
            except (TypeError, ValueError):
                out[field] = default
        out.setdefault("country_of_shipment", out.get("country_of_origin", ""))
        return out

    def _get_peer_transactions(
        self, iec: str, user_id: int, limit: int
    ) -> List[Dict[str, Any]]:
        """Fetch historical transactions for ECOD / Benford peer comparison.
        Returns [] silently if m06_fraud_analyses table does not exist yet."""
        try:
            if not iec:
                rows = self.db.execute(text("""
                    SELECT result_json FROM m06_fraud_analyses
                    WHERE user_id = :uid
                    ORDER BY created_at DESC LIMIT :lim
                """), {"uid": user_id, "lim": limit}).fetchall()
            else:
                rows = self.db.execute(text("""
                    SELECT result_json FROM m06_fraud_analyses
                    WHERE user_id = :uid AND importer_iec = :iec
                    ORDER BY created_at DESC LIMIT :lim
                """), {"uid": user_id, "iec": iec, "lim": limit}).fetchall()
        except Exception:
            self.db.rollback()
            return []

        out = []
        for row in rows:
            try:
                rj = row[0]
                if isinstance(rj, str):
                    rj = json.loads(rj)
                if isinstance(rj, dict):
                    out.append(rj.get("transaction", rj))
            except Exception:
                pass
        return out

    def _get_recent_transactions(
        self, iec: str, user_id: int, days: int
    ) -> List[Dict[str, Any]]:
        if not iec:
            return []
        try:
            rows = self.db.execute(text("""
                SELECT result_json FROM m06_fraud_analyses
                WHERE user_id = :uid AND importer_iec = :iec
                  AND created_at >= NOW() - (:days * INTERVAL '1 day')
                ORDER BY created_at DESC LIMIT 50
            """), {"uid": user_id, "iec": iec, "days": days}).fetchall()
        except Exception:
            self.db.rollback()
            return []

        out = []
        for row in rows:
            try:
                rj = row[0]
                if isinstance(rj, str):
                    rj = json.loads(rj)
                if isinstance(rj, dict):
                    out.append(rj.get("transaction", rj))
            except Exception:
                pass
        return out

    def _get_shipment_history(
        self, iec: str, user_id: int, limit: int
    ) -> List[Dict[str, Any]]:
        return self._get_peer_transactions(iec, user_id, limit)

    def _get_monthly_volumes(
        self, iec: str, user_id: int, months: int
    ) -> List[float]:
        if not iec:
            return []
        try:
            rows = self.db.execute(text("""
                SELECT DATE_TRUNC('month', created_at) AS month,
                       SUM((result_json->>'cif_value_inr')::numeric) AS total_cif
                FROM m06_fraud_analyses
                WHERE user_id = :uid AND importer_iec = :iec
                  AND created_at >= NOW() - (:months * INTERVAL '1 month')
                GROUP BY 1
                ORDER BY 1
            """), {"uid": user_id, "iec": iec, "months": months}).fetchall()
        except Exception:
            self.db.rollback()
            return []
        return [float(row[1] or 0) for row in rows]

    def _risk_level(self, score: float) -> str:
        if score >= _THRESHOLD_CRITICAL:
            return "CRITICAL"
        if score >= _THRESHOLD_HIGH_RISK:
            return "HIGH_RISK"
        if score >= _THRESHOLD_SUSPICIOUS:
            return "SUSPICIOUS"
        return "CLEAN"

    def _recommendation(self, risk_level: str, flags: List[Dict]) -> str:
        if risk_level == "CRITICAL":
            return "REFER_TO_DRI"
        if risk_level == "HIGH_RISK":
            return "ASSIGN_TO_SIIB"
        if risk_level == "SUSPICIOUS":
            return "FLAG_FOR_REVIEW"
        return "CLEAR_FOR_PROCESSING"

    def _create_case(
        self,
        analysis_uuid: str,
        tx: Dict[str, Any],
        composite: float,
        risk_level: str,
        fraud_flags: List[Dict],
        user_id: int,
    ) -> Optional[int]:
        case_ref = str(uuid.uuid4())
        fraud_types = [f["fraud_type"] for f in fraud_flags]
        try:
            row = self.db.execute(text("""
                INSERT INTO m06_investigation_cases
                  (case_ref, user_id, analysis_uuid, importer_iec, importer_name,
                   composite_score, risk_level, status, fraud_types_json, created_at, updated_at)
                VALUES
                  (:ref, :uid, :auuid, :iec, :name,
                   :score, :level, 'OPEN', :ftypes, NOW(), NOW())
                RETURNING id
            """), {
                "ref"   : case_ref,
                "uid"   : user_id,
                "auuid" : analysis_uuid,
                "iec"   : tx.get("importer_iec"),
                "name"  : tx.get("importer_name"),
                "score" : composite,
                "level" : risk_level,
                "ftypes": json.dumps(fraud_types),
            }).fetchone()
            self.db.commit()
            return int(row[0]) if row else None
        except Exception as exc:
            logger.error("[M06] Case creation failed: %s", exc)
            self.db.rollback()
            return None

    def _persist_analysis(self, *, analysis_uuid, tx, composite, risk_level,
                           ecod_score, hclnet_score, hsn_score, benford_score,
                           routing_score, duplicate_score, temporal_score,
                           fraud_flags, case_id, user_id) -> Optional[int]:
        try:
            row = self.db.execute(text("""
                INSERT INTO m06_fraud_analyses
                  (analysis_uuid, user_id, importer_iec, importer_name,
                   composite_score, risk_level, fraud_types_count,
                   ecod_score, hclnet_score, hsn_score, benford_score,
                   routing_score, duplicate_score, temporal_score,
                   fraud_flags_json, result_json, case_id, created_at)
                VALUES
                  (:uuid, :uid, :iec, :name,
                   :comp, :level, :ftcount,
                   :ecod, :hcl, :hsn, :ben,
                   :rout, :dup, :temp,
                   :flags, :result, :cid, NOW())
                RETURNING id
            """), {
                "uuid"   : analysis_uuid,
                "uid"    : user_id,
                "iec"    : tx.get("importer_iec"),
                "name"   : tx.get("importer_name"),
                "comp"   : composite,
                "level"  : risk_level,
                "ftcount": len(fraud_flags),
                "ecod"   : ecod_score,
                "hcl"    : hclnet_score,
                "hsn"    : hsn_score,
                "ben"    : benford_score,
                "rout"   : routing_score,
                "dup"    : duplicate_score,
                "temp"   : temporal_score,
                "flags"  : json.dumps(fraud_flags),
                "result" : json.dumps({"transaction": tx}),
                "cid"    : case_id,
            }).fetchone()
            self.db.commit()
            return int(row[0]) if row else None
        except Exception as exc:
            logger.error("[M06] Analysis persist failed: %s", exc)
            self.db.rollback()
            return None

    @staticmethod
    def _row_to_dict(row) -> Dict[str, Any]:
        d = dict(row._mapping)
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()
        return d


# ── Capability probes (used in model_versions reporting) ─────────────────────

def _ecod_available() -> bool:
    try:
        from pyod.models.ecod import ECOD
        return True
    except ImportError:
        return False

def _prefixspan_available() -> bool:
    try:
        from prefixspan import PrefixSpan
        return True
    except ImportError:
        return False

def _scipy_available() -> bool:
    try:
        from scipy.stats import chisquare
        return True
    except ImportError:
        return False
