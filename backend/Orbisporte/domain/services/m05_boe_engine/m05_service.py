"""
M05 — Bill of Entry Filing Engine  (SOP BOE-001 to BOE-006)
============================================================
Orchestrates the complete BoE lifecycle:

  BOE-001  Aggregate M01–M04 data into a complete BoE payload
  BOE-002  Pre-filing error prediction (XGBoost / rule-based)
  BOE-003  Field validation (IEC, HSN, COO, invoice values)
  BOE-004  ICEGATE JSON payload generation & submission
  BOE-005  Response handling + LLM query resolution draft
  BOE-006  BoE record persistence and PDF generation

DB Tables used
--------------
  m05_boe_filings      — master BoE record
  m05_boe_line_items   — per-item breakdown
  m05_icegate_log      — full audit trail of ICEGATE interactions

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from Orbisporte.domain.services.m05_boe_engine.predictor import predict_rejection_risk
from Orbisporte.domain.services.m05_boe_engine.icegate_client import ICEGATEClient
from Orbisporte.domain.services.m05_boe_engine.query_resolver import draft_query_response
from Orbisporte.domain.services.m05_boe_engine.pdf_generator import generate_boe_pdf

logger = logging.getLogger(__name__)


class M05BoEEngine:
    """Main M05 orchestrator — called from m05_routes.py."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._icegate = ICEGATEClient()
        self._soft_delete_supported: Optional[bool] = None

    # =========================================================================
    # BOE-001  Aggregate M01–M04 data
    # =========================================================================

    def prepare_boe(
        self,
        document_id: int,
        user_id: int,
        port_of_import: str = "INMAA1",
        m04_computation_uuid: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Aggregate document extraction (M01/M02), classification (M03),
        and duty computation (M04) results into a pre-filled BoE payload.

        Returns
        -------
        {
          "success"     : bool,
          "boe_fields"  : dict  — all 22 BoE header fields,
          "line_items"  : list  — per-item fields,
          "risk"        : dict  — predictor output,
          "filing_id"   : int | None,
        }
        """
        logger.info("[M05] Preparing BoE | doc=%s user=%s port=%s uuid=%s",
                    document_id, user_id, port_of_import, m04_computation_uuid)

        try:
            # ── Pull document extraction data ─────────────────────────────
            doc = self._get_document(document_id, user_id)
            if not doc:
                return {"success": False, "error": "Document not found or access denied"}

            extracted = doc.get("extracted_data") or {}
            if isinstance(extracted, str):
                extracted = json.loads(extracted)

            # ── Pull M04 duty computation ─────────────────────────────────
            m04_data = self._get_m04_computation(m04_computation_uuid, document_id, user_id)

            # ── Pull company / importer profile ──────────────────────────
            company = self._get_company_info(user_id)

            # ── Build the 22-field BoE header ─────────────────────────────
            boe_fields = self._build_boe_fields(
                extracted=extracted,
                m04_data=m04_data,
                company=company,
                document_id=document_id,
                port_of_import=port_of_import,
            )

            # ── Build line items ─────────────────────────────────────────
            line_items = self._build_line_items(extracted, m04_data)

            # ── Pre-filing risk prediction ────────────────────────────────
            risk = predict_rejection_risk(boe_fields, line_items)

            # ── Persist draft filing record ───────────────────────────────
            filing_id = self._upsert_filing(
                boe_fields=boe_fields,
                line_items=line_items,
                risk=risk,
                user_id=user_id,
                document_id=document_id,
            )
            boe_fields["filing_id"] = filing_id

            return {
                "success": True,
                "boe_fields": boe_fields,
                "line_items": line_items,
                "risk": risk,
                "filing_id": filing_id,
                "boe_number": boe_fields.get("boe_number"),
            }

        except Exception as exc:
            logger.exception("[M05] prepare_boe failed: %s", exc)
            return {"success": False, "error": str(exc)}

    # =========================================================================
    # BOE-003  Field validation
    # =========================================================================

    def validate_boe(
        self, boe_fields: Dict[str, Any], line_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Run all field-level validations and return a report."""
        errors: List[str] = []
        warnings: List[str] = []
        field_errors: Dict[str, List[str]] = {}

        def _add_field_error(field: str, message: str) -> None:
            errors.append(message)
            field_errors.setdefault(field, []).append(message)

        # IEC: 10-digit numeric
        iec = str(boe_fields.get("importer_iec") or "")
        if not iec:
            _add_field_error("importer_iec", "Importer IEC is required")
        elif not (len(iec) == 10 and iec.isdigit()):
            _add_field_error("importer_iec", f"IEC must be 10 numeric digits — got '{iec}'")

        # Mandatory text fields
        for field, label in [
            ("importer_name", "Importer Name"),
            ("importer_address", "Importer Address"),
            ("bill_of_lading_number", "Bill of Lading Number"),
            ("country_of_origin", "Country of Origin"),
            ("port_of_import", "Port of Import"),
            ("port_of_shipment", "Port of Shipment"),
            ("arrival_date", "Arrival Date"),
        ]:
            if not boe_fields.get(field):
                _add_field_error(field, f"{label} is required")

        # Country of origin — 3-letter ISO
        coo = str(boe_fields.get("country_of_origin") or "")
        if coo and (len(coo) != 3 or not coo.isalpha()):
            warnings.append(f"Country of Origin '{coo}' should be a 3-letter ISO code (e.g. CHN, USA)")

        # Custom value
        try:
            cif = float(boe_fields.get("custom_value_inr") or 0)
            if cif <= 0:
                _add_field_error("custom_value_inr", "Custom Value (INR) must be greater than zero")
        except (TypeError, ValueError):
            _add_field_error("custom_value_inr", "Custom Value (INR) is not a valid number")

        # Line items
        if not line_items:
            _add_field_error("line_items", "At least one line item is required")
        for idx, item in enumerate(line_items, start=1):
            hsn = str(item.get("hsn_code") or "").replace(" ", "")
            if not hsn or len(hsn) < 4:
                _add_field_error(f"line_items[{idx - 1}].hsn_code", f"Line {idx}: HSN code is missing or too short (min 4 digits)")
            if not item.get("description_of_goods") and not item.get("product_description"):
                _add_field_error(f"line_items[{idx - 1}].description_of_goods", f"Line {idx}: Description of goods is required")
            try:
                qty = float(item.get("quantity") or 0)
                if qty <= 0:
                    warnings.append(f"Line {idx}: Quantity should be a positive number")
            except (TypeError, ValueError):
                warnings.append(f"Line {idx}: Quantity is not a valid number")

        valid = len(errors) == 0
        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "field_errors": field_errors,
            "failed_fields": sorted(field_errors.keys()),
            "errors_count": len(errors),
            "warnings_count": len(warnings),
        }

    # =========================================================================
    # BOE-004 / BOE-005  Submit to ICEGATE & handle response
    # =========================================================================

    def submit_boe(
        self,
        filing_id: int,
        boe_fields: Dict[str, Any],
        line_items: List[Dict[str, Any]],
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Build ICEGATE payload, submit, persist response, return result.
        """
        logger.info("[M05] Submitting BoE filing_id=%s", filing_id)

        try:
            filing = self._get_filing(filing_id, user_id)
            if not filing:
                return {"success": False, "error": "Filing not found or access denied"}

            # Keep server-side registry in sync with latest user-edited form data
            # before validation / submit, so history always reflects what was filed.
            if filing.get("boe_number") and not boe_fields.get("boe_number"):
                boe_fields["boe_number"] = filing.get("boe_number")

            validation = self.validate_boe(boe_fields, line_items)
            if not validation.get("valid"):
                return {
                    "success": False,
                    "status": "VALIDATION_ERROR",
                    "error": "Validation failed",
                    "validation": validation,
                    "failed_fields": validation.get("failed_fields", []),
                }

            risk = predict_rejection_risk(boe_fields, line_items)
            self._persist_filing_payload(
                filing_id=filing_id,
                boe_fields=boe_fields,
                line_items=line_items,
                risk=risk,
                user_id=user_id,
            )
            if risk.get("risk_score", 0) > 30:
                failed_fields = self._derive_failed_fields_from_risk(risk, validation)
                return {
                    "success": False,
                    "status": "PREVALIDATION_BLOCKED",
                    "error": "Pre-validation blocked this filing (rejection risk above 30%)",
                    "risk": risk,
                    "failed_fields": failed_fields,
                }

            duplicate = self._find_duplicate_filing(filing_id, user_id, boe_fields)
            if duplicate:
                return {
                    "success": False,
                    "status": "DUPLICATE_BLOCKED",
                    "error": "Duplicate filing detected for the same importer/document context",
                    "failed_fields": ["importer_iec", "invoice_number", "bill_of_lading_number", "hsn_code"],
                    "duplicate_filing_id": duplicate,
                }

            # Build payload
            payload = self._icegate.build_payload(boe_fields, line_items)
            structured_payload = self._build_structured_payload(boe_fields, line_items)

            # Submit
            response = self._icegate.submit_boe(payload)

            # Persist ICEGATE interaction
            self._log_icegate_interaction(
                filing_id=filing_id,
                action="SUBMIT",
                payload=payload,
                response=response,
                user_id=user_id,
            )

            # Update filing record with ICEGATE result
            self._update_filing_status(
                filing_id=filing_id,
                status=response["status"],
                ack_number=response.get("ack_number"),
                icegate_boe_number=response.get("boe_number"),
                user_id=user_id,
            )

            # If QUERY was raised, generate LLM draft response
            query_draft = None
            if response["status"] == "QUERY" and response.get("query_text"):
                draft_result = draft_query_response(
                    query_text=response["query_text"],
                    boe_fields=boe_fields,
                    line_items=line_items,
                )
                query_draft = draft_result.get("draft")

            return {
                "success": True,
                "status": response["status"],
                "ack_number": response.get("ack_number"),
                "icegate_boe_number": response.get("boe_number"),
                "errors": response.get("errors", []),
                "query_text": response.get("query_text"),
                "query_draft": query_draft,
                "filing_id": filing_id,
                "risk": risk,
                "validation": validation,
                "structured_payload": structured_payload,
                "icegate_payload": payload,
            }

        except Exception as exc:
            logger.exception("[M05] submit_boe failed: %s", exc)
            return {"success": False, "error": str(exc)}

    # =========================================================================
    # BOE-006  PDF generation
    # =========================================================================

    def generate_pdf(
        self,
        filing_id: int,
        user_id: int,
    ) -> Optional[bytes]:
        """Retrieve a persisted BoE filing and render it as PDF bytes."""
        filing = self._get_filing(filing_id, user_id)
        if not filing:
            return None

        boe_fields = filing.get("boe_fields_json") or {}
        if isinstance(boe_fields, str):
            boe_fields = json.loads(boe_fields)

        line_items = self._get_filing_line_items(filing_id)

        icegate_resp = {
            "status": filing.get("icegate_status", "DRAFT"),
            "ack_number": filing.get("icegate_ack_number"),
            "boe_number": filing.get("icegate_boe_number"),
        } if filing.get("icegate_ack_number") else None

        return generate_boe_pdf(boe_fields, line_items, icegate_resp)

    # =========================================================================
    # Query resolution proxy
    # =========================================================================

    def resolve_query(
        self,
        filing_id: int,
        query_text: str,
        user_id: int,
        additional_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Draft an LLM response to a customs query for the given filing."""
        filing = self._get_filing(filing_id, user_id)
        if not filing:
            return {"success": False, "error": "Filing not found or access denied"}

        boe_fields = filing.get("boe_fields_json") or {}
        if isinstance(boe_fields, str):
            boe_fields = json.loads(boe_fields)

        line_items = self._get_filing_line_items(filing_id)

        result = draft_query_response(query_text, boe_fields, line_items, additional_context)
        result["success"] = True
        return result

    # =========================================================================
    # History
    # =========================================================================

    def get_filing_history(
        self,
        user_id: int,
        limit: int = 20,
        include_deleted: bool = False,
    ) -> List[Dict[str, Any]]:
        if self._has_soft_delete_columns():
            rows = self.db.execute(text("""
                SELECT id, filing_ref, boe_number, icegate_boe_number, icegate_ack_number,
                       icegate_status, filing_status, risk_score, risk_band,
                       created_at, updated_at, port_of_import,
                       COALESCE((boe_fields_json->>'importer_name'), '') AS importer_name,
                       COALESCE((boe_fields_json->>'hsn_code'), '') AS hsn_code,
                       COALESCE(NULLIF(boe_fields_json->>'custom_value_inr', '')::NUMERIC, 0) AS custom_value_inr,
                       COALESCE(NULLIF(boe_fields_json->>'custom_duty', '')::NUMERIC, 0) AS custom_duty,
                       COALESCE((boe_fields_json->>'date_of_filing'), '') AS date_of_filing,
                       is_deleted, deleted_at
                FROM m05_boe_filings
                WHERE user_id = :uid
                  AND (:include_deleted OR is_deleted = FALSE)
                ORDER BY updated_at DESC, created_at DESC
                LIMIT :lim
            """), {"uid": user_id, "lim": limit, "include_deleted": include_deleted}).fetchall()
        else:
            rows = self.db.execute(text("""
                SELECT id, filing_ref, boe_number, icegate_boe_number, icegate_ack_number,
                       icegate_status, filing_status, risk_score, risk_band,
                       created_at, updated_at, port_of_import,
                       COALESCE((boe_fields_json->>'importer_name'), '') AS importer_name,
                       COALESCE((boe_fields_json->>'hsn_code'), '') AS hsn_code,
                       COALESCE(NULLIF(boe_fields_json->>'custom_value_inr', '')::NUMERIC, 0) AS custom_value_inr,
                       COALESCE(NULLIF(boe_fields_json->>'custom_duty', '')::NUMERIC, 0) AS custom_duty,
                       COALESCE((boe_fields_json->>'date_of_filing'), '') AS date_of_filing,
                       FALSE AS is_deleted,
                       NULL::timestamptz AS deleted_at
                FROM m05_boe_filings
                WHERE user_id = :uid
                ORDER BY updated_at DESC, created_at DESC
                LIMIT :lim
            """), {"uid": user_id, "lim": limit}).fetchall()

        result = []
        for row in rows:
            d = dict(row._mapping)
            for k in ("created_at", "updated_at", "deleted_at"):
                if d.get(k):
                    d[k] = d[k].isoformat()
            result.append(d)
        return result

    def _derive_failed_fields_from_risk(
        self,
        risk: Dict[str, Any],
        validation: Dict[str, Any],
    ) -> List[str]:
        failed = set(validation.get("failed_fields") or [])
        features = risk.get("features") or {}
        if features.get("has_iec") == 0:
            failed.add("importer_iec")
        if features.get("all_hsn_valid") == 0:
            failed.add("hsn_code")
            failed.add("line_items[0].hsn_code")
        if features.get("has_bl") == 0:
            failed.add("bill_of_lading_number")
        if features.get("missing_field_count", 0) > 0:
            failed.update(["country_of_origin", "port_of_import", "custom_value_inr"])
        return sorted(failed)

    def _find_duplicate_filing(
        self,
        filing_id: int,
        user_id: int,
        boe_fields: Dict[str, Any],
    ) -> Optional[int]:
        where_deleted = "AND is_deleted = FALSE" if self._has_soft_delete_columns() else ""
        row = self.db.execute(text(f"""
            SELECT id
            FROM m05_boe_filings
            WHERE user_id = :uid
              AND id <> :fid
              {where_deleted}
              AND filing_status = 'FILED'
              AND COALESCE(boe_fields_json->>'importer_iec', '') = :iec
              AND COALESCE(boe_fields_json->>'bill_of_lading_number', '') = :bl
              AND COALESCE(boe_fields_json->>'hsn_code', '') = :hsn
              AND ABS(COALESCE(NULLIF(boe_fields_json->>'custom_value_inr', '')::NUMERIC, 0) - :cif) < 0.5
            ORDER BY created_at DESC
            LIMIT 1
        """), {
            "uid": user_id,
            "fid": filing_id,
            "iec": str(boe_fields.get("importer_iec") or ""),
            "bl": str(boe_fields.get("bill_of_lading_number") or ""),
            "hsn": str(boe_fields.get("hsn_code") or ""),
            "cif": float(boe_fields.get("custom_value_inr") or 0),
        }).fetchone()
        return int(row[0]) if row else None

    def _build_structured_payload(
        self,
        boe_fields: Dict[str, Any],
        line_items: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        first = line_items[0] if line_items else {}
        m04 = boe_fields.get("m04_duty_breakdown") or {}
        return {
            "importer": boe_fields.get("importer_name"),
            "IEC": boe_fields.get("importer_iec"),
            "port_of_entry": boe_fields.get("port_of_import"),
            "HSN": boe_fields.get("hsn_code") or first.get("hsn_code"),
            "description": boe_fields.get("description_of_goods") or first.get("description_of_goods"),
            "CIF_value_USD": m04.get("cif_foreign"),
            "CIF_value_INR": boe_fields.get("custom_value_inr"),
            "BCD_rate_pct": m04.get("bcd_rate"),
            "IGST_rate_pct": m04.get("igst_rate"),
            "total_duty_INR": boe_fields.get("custom_duty"),
            "country_of_origin": boe_fields.get("country_of_origin"),
            "invoice_number": boe_fields.get("invoice_number"),
            "bill_of_lading": boe_fields.get("bill_of_lading_number"),
        }

    # =========================================================================
    # Internal helpers — data aggregation
    # =========================================================================

    def _get_document(self, document_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        row = self.db.execute(text("""
            SELECT id, original_filename, extracted_data, processing_status
            FROM "ProcessedDocuments"
            WHERE id = :did AND user_id = :uid
        """), {"did": document_id, "uid": user_id}).fetchone()
        return dict(row._mapping) if row else None

    def _get_m04_computation(
        self,
        computation_uuid: Optional[str],
        document_id: int,
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Fetch the most recent M04 computation for this document / user.

        Returns a dict shaped to match what _build_boe_fields / _build_line_items
        expect, reconstructed from the flat columns of m04_duty_computations.
        """
        _SELECT = """
            SELECT computation_uuid, hsn_code, country_of_origin, quantity, unit,
                   port_code, input_currency,
                   fob_cost, freight, insurance, cif_foreign,
                   exchange_rate, exchange_rate_source, exchange_rate_date,
                   assessable_value_inr,
                   bcd_rate, bcd_amount,
                   sws_rate, sws_amount,
                   igst_base, igst_rate, igst_amount,
                   add_rate, add_amount, add_notification_ref,
                   cvd_rate, cvd_amount,
                   sgd_rate, sgd_amount,
                   fta_applicable, fta_agreement_code, fta_preferential_bcd,
                   fta_roo_eligible, fta_exemption_amount,
                   total_duty_inr, total_payable_inr,
                   sop_steps_json, formula_text, anomaly_flags, calculation_time_ms
            FROM m04_duty_computations
        """
        if computation_uuid:
            row = self.db.execute(
                text(_SELECT + " WHERE CAST(computation_uuid AS TEXT) = :uuid AND user_id = :uid ORDER BY computed_at DESC LIMIT 1"),
                {"uuid": computation_uuid, "uid": user_id},
            ).fetchone()
        else:
            row = self.db.execute(
                text(_SELECT + " WHERE document_id = :did AND user_id = :uid ORDER BY computed_at DESC LIMIT 1"),
                {"did": document_id, "uid": user_id},
            ).fetchone()

        if not row:
            return {}

        d = dict(row._mapping)

        def _f(col, default=None):
            v = d.get(col)
            return float(v) if v is not None else default

        return {
            # ── Identity ─────────────────────────────────────────────────────
            "computation_uuid":    str(d.get("computation_uuid") or ""),

            # ── SOP Step 1 — CIF components ──────────────────────────────────
            "fob_cost":            _f("fob_cost"),
            "freight":             _f("freight"),
            "insurance":           _f("insurance"),
            "cif_foreign":         _f("cif_foreign"),
            "input_currency":      d.get("input_currency", "USD"),

            # ── SOP Step 2 — AV ─────────────────────────────────────────────
            "assessable_value_inr": _f("assessable_value_inr"),
            "cif_inr":              _f("assessable_value_inr"),   # alias
            "exchange_rate_used":   _f("exchange_rate"),
            "exchange_rate_source": d.get("exchange_rate_source"),
            "exchange_rate_date":   str(d.get("exchange_rate_date") or ""),

            # ── SOP Step 3 — BCD ────────────────────────────────────────────
            "bcd_rate":   _f("bcd_rate"),
            "bcd_inr":    _f("bcd_amount"),

            # ── SOP Step 4 — SWS ────────────────────────────────────────────
            "sws_rate":   _f("sws_rate", 10.0),
            "sws_inr":    _f("sws_amount"),

            # ── SOP Step 5 — IGST ───────────────────────────────────────────
            "igst_base":  _f("igst_base"),
            "igst_rate":  _f("igst_rate"),
            "igst_inr":   _f("igst_amount"),

            # ── SOP Step 6 — ADD ────────────────────────────────────────────
            "add_rate":             _f("add_rate", 0.0),
            "add_inr":              _f("add_amount", 0.0),
            "add_notification_ref": d.get("add_notification_ref") or "",

            # ── SOP Step 7 — CVD / SGD ──────────────────────────────────────
            "cvd_rate":  _f("cvd_rate", 0.0),
            "cvd_inr":   _f("cvd_amount", 0.0),
            "sgd_rate":  _f("sgd_rate", 0.0),
            "sgd_inr":   _f("sgd_amount", 0.0),

            # ── SOP Step 8 — FTA ────────────────────────────────────────────
            "fta_applicable":      bool(d.get("fta_applicable")),
            "fta_agreement_code":  d.get("fta_agreement_code") or "",
            "fta_preferential_bcd": _f("fta_preferential_bcd"),
            "fta_roo_eligible":    d.get("fta_roo_eligible"),
            "fta_exemption_amount": _f("fta_exemption_amount", 0.0),

            # ── Totals ───────────────────────────────────────────────────────
            "total_duty_inr":    _f("total_duty_inr"),
            "total_payable_inr": _f("total_payable_inr"),

            # ── Audit ────────────────────────────────────────────────────────
            "formula_text":         d.get("formula_text") or "",
            "anomaly_flags":        d.get("anomaly_flags") or {},
            "steps":                d.get("sop_steps_json") or {},
            "calculation_time_ms":  d.get("calculation_time_ms"),

            # ── Flat inputs (used in field builders) ─────────────────────────
            "inputs": {
                "hsn_code":          d.get("hsn_code", ""),
                "country_of_origin": d.get("country_of_origin", ""),
                "port_code":         d.get("port_code", ""),
                "quantity":          d.get("quantity"),
                "unit":              d.get("unit", "NOS"),
                "currency":          d.get("input_currency", "USD"),
                "product_description": "",
            },
        }

    def _get_company_info(self, user_id: int) -> Dict[str, Any]:
        row = self.db.execute(text("""
            SELECT c.name AS company_name, c.iec_number, c.gst_number,
                   c.id AS company_id
            FROM "Company" c
            JOIN "User" u ON u.company_id = c.id
            WHERE u.id = :uid
        """), {"uid": user_id}).fetchone()
        return dict(row._mapping) if row else {}

    def _build_boe_fields(
        self,
        extracted: Dict[str, Any],
        m04_data: Dict[str, Any],
        company: Dict[str, Any],
        document_id: int,
        port_of_import: str,
    ) -> Dict[str, Any]:
        """
        Exhaustively map every available M01-M04 data source to all 22 BoE fields.

        Priority order:
          1. M04 duty computation (authoritative for all financial figures)
          2. extracted_data.invoice_data  (from _extract_invoice_metadata)
          3. extracted_data.duty_summary.invoice_data
          4. extracted_data.line_items[0] / items[0]  (first line item)
          5. extracted_data root / combined
          6. Company profile (importer identity)
          7. Sensible default or None
        """
        m04_inputs = m04_data.get("inputs") or {}

        # ── Unpack all stored extraction layers ───────────────────────────────
        inv_data  = extracted.get("invoice_data") or {}                     # primary invoice metadata
        duty_sum  = extracted.get("duty_summary") or {}                     # full result saved at processing time
        ds_inv    = duty_sum.get("invoice_data") or {}                      # invoice_data inside duty_summary
        combined  = extracted.get("combined") or {}

        # Collect all raw item sources
        raw_items = (
            extracted.get("line_items")
            or extracted.get("items")
            or duty_sum.get("items")
            or combined.get("items")
            or combined.get("line_items")
            or []
        )
        first_item = raw_items[0] if raw_items else {}

        def _pick(*keys: str, extra_sources: list = None) -> Any:
            """Return first non-null, non-empty value found across all key aliases and sources."""
            sources = [inv_data, ds_inv, combined, first_item] + (extra_sources or [])
            for src in sources:
                if not isinstance(src, dict):
                    continue
                for k in keys:
                    v = src.get(k)
                    if v is not None and str(v).strip() not in ("", "None", "null", "N/A", "n/a"):
                        return v
            return None

        # ── ISO-3166-1 alpha-3 normaliser ─────────────────────────────────────
        _iso2_to_3 = {
            "CN": "CHN", "US": "USA", "DE": "DEU", "GB": "GBR", "JP": "JPN",
            "KR": "KOR", "SG": "SGP", "AE": "ARE", "AU": "AUS", "BR": "BRA",
            "ZA": "ZAF", "MY": "MYS", "TH": "THA", "VN": "VNM", "ID": "IDN",
            "TW": "TWN", "IT": "ITA", "FR": "FRA", "IN": "IND", "CA": "CAN",
            "NL": "NLD", "CH": "CHE", "BE": "BEL", "PL": "POL", "SE": "SWE",
            "NO": "NOR", "DK": "DNK", "IE": "IRL", "PH": "PHL", "HK": "HKG",
            "SA": "SAU", "TR": "TUR", "RU": "RUS", "MX": "MEX", "ES": "ESP",
            "BD": "BGD", "LK": "LKA", "PK": "PAK", "NP": "NPL",
        }
        _name_to_3 = {
            "CHINA": "CHN", "UNITED STATES": "USA", "USA": "USA", "US": "USA",
            "GERMANY": "DEU", "UNITED KINGDOM": "GBR", "UK": "GBR",
            "JAPAN": "JPN", "SOUTH KOREA": "KOR", "KOREA": "KOR",
            "SINGAPORE": "SGP", "UAE": "ARE", "UNITED ARAB EMIRATES": "ARE",
            "AUSTRALIA": "AUS", "BRAZIL": "BRA", "SOUTH AFRICA": "ZAF",
            "MALAYSIA": "MYS", "THAILAND": "THA", "VIETNAM": "VNM",
            "INDONESIA": "IDN", "TAIWAN": "TWN", "ITALY": "ITA",
            "FRANCE": "FRA", "INDIA": "IND", "CANADA": "CAN",
            "NETHERLANDS": "NLD", "SWITZERLAND": "CHE", "BELGIUM": "BEL",
            "SWEDEN": "SWE", "POLAND": "POL", "SPAIN": "ESP",
            "SRI LANKA": "LKA", "PAKISTAN": "PAK", "BANGLADESH": "BGD",
        }
        def _iso3(v: Any) -> Optional[str]:
            if not v:
                return None
            s = str(v).strip().upper()
            if len(s) == 2:
                return _iso2_to_3.get(s, s)
            if len(s) == 3 and s.isalpha():
                return s
            return _name_to_3.get(s) or (s[:3] if len(s) >= 3 else s)

        # ── Financial values (M04 is authoritative) ───────────────────────────
        custom_value_inr = m04_data.get("assessable_value_inr") or m04_data.get("cif_inr")
        custom_duty      = m04_data.get("total_duty_inr")
        gst              = m04_data.get("igst_inr")
        try:
            total_payable = round(float(custom_value_inr or 0) + float(custom_duty or 0), 2) if custom_value_inr else None
        except (TypeError, ValueError):
            total_payable = None

        ex_rate  = m04_data.get("exchange_rate_used") or _pick("exchange_rate")
        currency = m04_inputs.get("currency") or _pick("currency") or "USD"
        freight_anomaly = 1 if (m04_data.get("anomaly_flags") or {}).get("has_anomalies") else 0

        # ── CIF components ─────────────────────────────────────────────────────
        fob_cost_foreign  = m04_data.get("fob_cost")
        freight_foreign   = m04_data.get("freight")
        insurance_foreign = m04_data.get("insurance")
        cif_foreign       = m04_data.get("cif_foreign")

        # ── Individual duty figures ────────────────────────────────────────────
        bcd_amount = m04_data.get("bcd_inr")
        sws_amount = m04_data.get("sws_inr")
        add_amount = m04_data.get("add_inr") or 0
        cvd_amount = m04_data.get("cvd_inr") or 0
        sgd_amount = m04_data.get("sgd_inr") or 0

        # ── Duty rates ────────────────────────────────────────────────────────
        bcd_rate  = m04_data.get("bcd_rate")
        sws_rate  = m04_data.get("sws_rate", 10.0)
        igst_rate = m04_data.get("igst_rate")
        igst_base = m04_data.get("igst_base")
        add_rate  = m04_data.get("add_rate", 0.0)
        cvd_rate  = m04_data.get("cvd_rate", 0.0)
        sgd_rate  = m04_data.get("sgd_rate", 0.0)
        add_notification_ref = m04_data.get("add_notification_ref", "")

        # ── FTA ───────────────────────────────────────────────────────────────
        fta_applicable     = m04_data.get("fta_applicable", False)
        fta_agreement_code = m04_data.get("fta_agreement_code", "")
        fta_pref_bcd       = m04_data.get("fta_preferential_bcd")
        fta_roo_eligible   = m04_data.get("fta_roo_eligible")
        fta_exemption      = m04_data.get("fta_exemption_amount", 0.0)

        today = date.today().isoformat()

        # ── Country fields ─────────────────────────────────────────────────────
        coo_raw = (
            m04_inputs.get("country_of_origin")
            or _pick("country_of_origin", "origin_country")
            or _pick("supplier_country", "vendor_country")
        )
        coo = _iso3(coo_raw)
        cos_raw = _pick("country_of_shipment", "country_of_consignment") or coo_raw
        cos = _iso3(cos_raw)

        # ── Importer identity ─────────────────────────────────────────────────
        importer_name = (
            company.get("company_name")
            or _pick("buyer_name", "buyer", "customer_name", "customer",
                     "consignee_name", "importer_name", "to")
        )
        importer_address = _pick(
            "buyer_address", "customer_address", "consignee_address",
            "importer_address", "billing_address", "ship_to_address"
        )
        importer_iec = (
            company.get("iec_number")
            or _pick("buyer_iec", "iec", "importer_iec", "customer_iec", "iec_number")
        )
        importer_gstin = (
            company.get("gst_number")
            or _pick("buyer_gst", "gstin", "gst", "buyer_gstin", "gst_number")
        )

        # ── Goods description (first line item preferred) ─────────────────────
        description_of_goods = (
            _pick("description", "product_description", "item_name",
                  "item_description", extra_sources=[first_item])
            or m04_inputs.get("product_description")
            or _pick("product_description", "description", "goods_description")
        )

        # ── Quantity / unit ───────────────────────────────────────────────────
        quantity = (
            m04_inputs.get("quantity")
            or _pick("quantity", "qty", "total_quantity", extra_sources=[first_item])
            or _pick("quantity", "qty", "total_quantity")
        )
        unit = (
            m04_inputs.get("unit")
            or _pick("unit", "uom", "unit_of_measure", extra_sources=[first_item])
            or "NOS"
        )

        # ── HSN code ──────────────────────────────────────────────────────────
        hsn_code = (
            m04_inputs.get("hsn_code")
            or _pick("hsn_code", "hs_code", "hs_tariff_code", extra_sources=[first_item])
            or _pick("hsn_code", "hs_code")
        )

        # ── Shipment fields ───────────────────────────────────────────────────
        bill_of_lading = _pick(
            "bill_of_lading", "bl_number", "bol_number", "bl_no",
            "bill_of_lading_number", "b_l_number", "lading_number"
        )
        invoice_number = _pick(
            "invoice_number", "invoice_no", "inv_no", "commercial_invoice_number"
        )
        invoice_date = _pick(
            "invoice_date", "date_of_invoice", "inv_date", "commercial_invoice_date"
        )
        # Vessel name used as shipping line when no dedicated field exists
        vessel = _pick("vessel_name", "ship_name", "vessel")
        shipping_line = _pick(
            "shipping_line", "carrier", "shipping_company",
            "steamship_line", "ocean_carrier"
        ) or vessel

        port_of_shipment = _pick(
            "port_of_loading", "port_of_shipment", "origin_port",
            "loading_port", "pol", "departure_port", "from_port",
            extra_sources=[extracted]
        )

        # Arrival date — direct field, then ETA, then BL date + 21 days estimate
        arrival_date = _pick(
            "arrival_date", "eta", "estimated_arrival",
            "date_of_arrival", "expected_arrival", "vessel_arrival_date"
        )
        if not arrival_date:
            bl_date_raw = _pick("bl_date", "bill_of_lading_date", "date_of_bl", "b_l_date")
            if bl_date_raw:
                try:
                    from datetime import timedelta
                    bl_dt = date.fromisoformat(str(bl_date_raw)[:10])
                    arrival_date = (bl_dt + timedelta(days=21)).isoformat()
                except (ValueError, TypeError):
                    pass

        return {
            # 1.  Bill of Entry Number — assigned by ICEGATE post-submission
            "boe_number": None,
            # 2.  Date of Filing
            "date_of_filing": today,
            # 3.  Port of Import
            "port_of_import": port_of_import,
            # 4.  Type of Bill of Entry
            "boe_type": "HOME_CONSUMPTION",
            # 5.  Importer Name
            "importer_name": importer_name,
            # 6.  Importer Address
            "importer_address": importer_address,
            # 7.  Importer IEC
            "importer_iec": importer_iec,
            # 8.  Description of Goods
            "description_of_goods": description_of_goods,
            # 9.  Quantity
            "quantity": quantity,
            # 10. HS Code
            "hsn_code": hsn_code,
            # 11. Custom Value (INR)
            "custom_value_inr": custom_value_inr,
            # 12. Country of Origin
            "country_of_origin": coo,
            # 13. Country of Shipment
            "country_of_shipment": cos,
            # 14. Custom Duty (INR)
            "custom_duty": custom_duty,
            # 15. GST / IGST (INR)
            "gst": gst,
            # 16. Bill of Lading Number
            "bill_of_lading_number": bill_of_lading,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            # 17. Shipping Line
            "shipping_line": shipping_line,
            # 18. Port of Shipment
            "port_of_shipment": port_of_shipment,
            # 19. Arrival Date (direct or estimated from B/L date + 21 days)
            "arrival_date": arrival_date,
            # 20. Custom Officer — assigned post-clearance by customs authority
            "custom_officer": None,
            # 21. Date of Clearance — assigned post-clearance
            "date_of_clearance": None,
            # 22. Importer Signature
            "importer_signature": "DIGITAL",
            # Custom Officer Signature — post-clearance
            "custom_officer_signature": None,

            # ── Supporting / derived fields ───────────────────────────────────
            "importer_gstin": importer_gstin,
            "unit": unit,
            "total_payable": total_payable,
            "currency": currency,
            "exchange_rate": ex_rate,
            "exchange_rate_source": m04_data.get("exchange_rate_source"),
            "freight_anomaly_flag": freight_anomaly,
            "document_id": document_id,
            "m04_computation_uuid": m04_data.get("computation_uuid"),

            # ── Full M04 duty breakdown (all SOP steps) ───────────────────────
            "m04_duty_breakdown": {
                # Step 1 — CIF
                "fob_cost_foreign":  fob_cost_foreign,
                "freight_foreign":   freight_foreign,
                "insurance_foreign": insurance_foreign,
                "cif_foreign":       cif_foreign,
                "input_currency":    currency,
                # Step 2 — AV
                "assessable_value_inr": custom_value_inr,
                "exchange_rate":     ex_rate,
                "exchange_rate_source": m04_data.get("exchange_rate_source"),
                # Step 3 — BCD
                "bcd_rate":    bcd_rate,
                "bcd_amount":  bcd_amount,
                # Step 4 — SWS
                "sws_rate":    sws_rate,
                "sws_amount":  sws_amount,
                # Step 5 — IGST
                "igst_base":   igst_base,
                "igst_rate":   igst_rate,
                "igst_amount": gst,
                # Step 6 — ADD
                "add_rate":             add_rate,
                "add_amount":           add_amount,
                "add_notification_ref": add_notification_ref,
                # Step 7 — CVD / SGD
                "cvd_rate":   cvd_rate,
                "cvd_amount": cvd_amount,
                "sgd_rate":   sgd_rate,
                "sgd_amount": sgd_amount,
                # Step 8 — FTA
                "fta_applicable":      fta_applicable,
                "fta_agreement_code":  fta_agreement_code,
                "fta_preferential_bcd": fta_pref_bcd,
                "fta_roo_eligible":    fta_roo_eligible,
                "fta_exemption_amount": fta_exemption,
                # Totals
                "total_duty_inr":    custom_duty,
                "total_payable_inr": total_payable,
                # Audit
                "formula_text":        m04_data.get("formula_text"),
                "calculation_time_ms": m04_data.get("calculation_time_ms"),
                "anomaly_flags":       m04_data.get("anomaly_flags") or {},
            } if m04_data else None,
        }

    def _build_line_items(
        self,
        extracted: Dict[str, Any],
        m04_data: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Build per-item BoE line items from M04 + extraction data.
        Each item is enriched with M04 computed duty figures.
        """
        m04_inputs = m04_data.get("inputs") or {}

        # Collect raw items from every possible location in extracted_data
        duty_sum  = extracted.get("duty_summary") or {}
        combined  = extracted.get("combined") or {}
        raw_items = (
            extracted.get("line_items")
            or extracted.get("items")
            or duty_sum.get("items")
            or combined.get("items")
            or combined.get("line_items")
            or []
        )

        # ISO-3 helper (reuse same logic)
        _iso2_to_3 = {
            "CN": "CHN", "US": "USA", "DE": "DEU", "GB": "GBR", "JP": "JPN",
            "KR": "KOR", "SG": "SGP", "AE": "ARE", "AU": "AUS", "IN": "IND",
            "TW": "TWN", "IT": "ITA", "FR": "FRA", "MY": "MYS", "TH": "THA",
            "VN": "VNM", "ID": "IDN", "BR": "BRA", "ZA": "ZAF",
        }
        def _iso3(v: Any) -> str:
            if not v:
                return ""
            s = str(v).strip().upper()
            if len(s) == 2:
                return _iso2_to_3.get(s, s)
            return s

        def _build_item(raw: Dict[str, Any]) -> Dict[str, Any]:
            # Duty figures: M04 computed values are authoritative; fall back to raw item values
            duty_calc = raw.get("duty_calculation") or {}
            duties    = duty_calc.get("duties") or {}
            rates_d   = duty_calc.get("rates") or {}

            coo = _iso3(
                raw.get("country_of_origin")
                or m04_inputs.get("country_of_origin")
                or ""
            )

            return {
                "description_of_goods": (
                    raw.get("description")
                    or raw.get("item_name")
                    or raw.get("product_description")
                    or raw.get("item_description")
                    or m04_inputs.get("product_description", "")
                ),
                "hsn_code": (
                    raw.get("hsn_code")
                    or raw.get("hs_code")
                    or raw.get("hs_tariff_code")
                    or m04_inputs.get("hsn_code", "")
                ),
                "quantity": raw.get("quantity") or m04_inputs.get("quantity"),
                "unit": raw.get("unit") or raw.get("uom") or m04_inputs.get("unit", "NOS"),
                "country_of_origin": coo,
                # Financial — M04 computed values preferred, raw item as fallback
                "custom_value_inr": (
                    m04_data.get("assessable_value_inr")
                    or duty_calc.get("assessable_value")
                    or raw.get("total_value")
                    or raw.get("amount")
                ),
                "assessable_value": (
                    m04_data.get("assessable_value_inr")
                    or duty_calc.get("assessable_value")
                ),
                # ── Duty amounts ─────────────────────────────────────────────
                "bcd_amount":  m04_data.get("bcd_inr")  or duties.get("bcd")  or 0,
                "sws_amount":  m04_data.get("sws_inr")  or duties.get("sws")  or 0,
                "igst_amount": m04_data.get("igst_inr") or duties.get("igst") or 0,
                "add_amount":  m04_data.get("add_inr")  or duties.get("add")  or 0,
                "cvd_amount":  m04_data.get("cvd_inr")  or duties.get("cvd")  or 0,
                "sgd_amount":  m04_data.get("sgd_inr")  or 0,
                "total_duty":  (
                    m04_data.get("total_duty_inr")
                    or duty_calc.get("total_duty")
                    or raw.get("total_duty")
                ),
                # ── Duty rates ───────────────────────────────────────────────
                "bcd_rate":   m04_data.get("bcd_rate"),
                "sws_rate":   m04_data.get("sws_rate", 10.0),
                "igst_rate":  m04_data.get("igst_rate"),
                "igst_base":  m04_data.get("igst_base"),
                "add_rate":   m04_data.get("add_rate", 0.0),
                "cvd_rate":   m04_data.get("cvd_rate", 0.0),
                "sgd_rate":   m04_data.get("sgd_rate", 0.0),
                "add_notification_ref": m04_data.get("add_notification_ref", ""),
                # ── FTA ──────────────────────────────────────────────────────
                "fta_applicable":      m04_data.get("fta_applicable", False),
                "fta_agreement_code":  m04_data.get("fta_agreement_code", ""),
                "fta_preferential_bcd": m04_data.get("fta_preferential_bcd"),
                "fta_roo_eligible":    m04_data.get("fta_roo_eligible"),
                "fta_exemption_amount": m04_data.get("fta_exemption_amount", 0.0),
                # ── CIF components ───────────────────────────────────────────
                "fob_cost_foreign":    m04_data.get("fob_cost"),
                "freight_foreign":     m04_data.get("freight"),
                "insurance_foreign":   m04_data.get("insurance"),
                "cif_foreign":         m04_data.get("cif_foreign"),
                "input_currency":      m04_data.get("input_currency", "USD"),
                "exchange_rate":       m04_data.get("exchange_rate_used"),
                # ── Unit price for reference ─────────────────────────────────
                "unit_price":  raw.get("unit_price") or raw.get("price"),
                "total_value": raw.get("total_value") or raw.get("amount") or raw.get("total"),
                # ── M04 audit ref ────────────────────────────────────────────
                "m04_computation_uuid": m04_data.get("computation_uuid", ""),
            }

        if raw_items:
            return [_build_item(r) for r in raw_items]

        # No extracted items — synthesise a single item from M04 inputs
        return [_build_item({})]

    # =========================================================================
    # Internal helpers — DB persistence
    # =========================================================================

    def _upsert_filing(
        self,
        boe_fields: Dict[str, Any],
        line_items: List[Dict[str, Any]],
        risk: Dict[str, Any],
        user_id: int,
        document_id: int,
    ) -> int:
        """Insert or update a draft m05_boe_filings record."""
        filing_ref = str(uuid.uuid4())

        row = self.db.execute(text("""
            INSERT INTO m05_boe_filings (
                filing_ref, user_id, document_id,
                port_of_import, filing_status,
                risk_score, risk_band, block_submit,
                boe_fields_json, line_items_json,
                icegate_status, created_at, updated_at
            ) VALUES (
                :ref, :uid, :did,
                :port, 'DRAFT',
                :rs, :rb, :bs,
                CAST(:bfj AS JSONB), CAST(:lij AS JSONB),
                'NOT_SUBMITTED', NOW(), NOW()
            )
            ON CONFLICT (filing_ref) DO UPDATE
              SET boe_fields_json = CAST(:bfj AS JSONB),
                  line_items_json = CAST(:lij AS JSONB),
                  risk_score = :rs, risk_band = :rb,
                  block_submit = :bs, updated_at = NOW()
            RETURNING id
        """), {
            "ref": filing_ref,
            "uid": user_id,
            "did": document_id,
            "port": boe_fields.get("port_of_import", "INMAA1"),
            "rs": risk.get("risk_score", 0),
            "rb": risk.get("risk_band", "LOW"),
            "bs": risk.get("block_submit", False),
            "bfj": json.dumps(boe_fields, default=str),
            "lij": json.dumps(line_items, default=str),
        }).fetchone()

        self.db.commit()
        filing_id = row[0]

        # ── Generate human-readable BOE number ────────────────────────────
        # Format: BOE/{YEAR}/{PORT}/{ID:06d}  e.g. BOE/2026/INMAA1/000042
        year = date.today().year
        port = str(boe_fields.get("port_of_import") or "INMAA1").upper().replace("/", "-")
        boe_number = f"BOE/{year}/{port}/{filing_id:06d}"

        # Stamp it into both the dedicated column and the boe_fields_json blob
        boe_fields["boe_number"] = boe_number
        self.db.execute(text("""
            UPDATE m05_boe_filings
               SET boe_number      = :bn,
                   boe_fields_json = CAST(:bfj AS JSONB)
             WHERE id = :fid
        """), {
            "bn":  boe_number,
            "bfj": json.dumps(boe_fields, default=str),
            "fid": filing_id,
        })
        self.db.commit()

        # Insert line items
        self.db.execute(text(
            "DELETE FROM m05_boe_line_items WHERE filing_id = :fid"
        ), {"fid": filing_id})
        for idx, item in enumerate(line_items, start=1):
            self.db.execute(text("""
                INSERT INTO m05_boe_line_items (
                    filing_id, line_number, item_json
                ) VALUES (:fid, :ln, CAST(:ij AS JSONB))
            """), {"fid": filing_id, "ln": idx, "ij": json.dumps(item, default=str)})

        self.db.commit()
        return filing_id

    def _update_filing_status(
        self,
        filing_id: int,
        status: str,
        ack_number: Optional[str],
        icegate_boe_number: Optional[str],
        user_id: int,
    ) -> None:
        self.db.execute(text("""
            UPDATE m05_boe_filings
            SET icegate_status = :status,
                icegate_ack_number = :ack,
                icegate_boe_number = :boe,
                filing_status = CASE WHEN :status = 'ACCEPTED' THEN 'FILED' ELSE 'DRAFT' END,
                updated_at = NOW()
            WHERE id = :fid
              AND user_id = :uid
        """), {"fid": filing_id, "uid": user_id, "status": status, "ack": ack_number, "boe": icegate_boe_number})
        self.db.commit()

    def _persist_filing_payload(
        self,
        filing_id: int,
        boe_fields: Dict[str, Any],
        line_items: List[Dict[str, Any]],
        risk: Dict[str, Any],
        user_id: int,
    ) -> None:
        """Persist the latest BoE form payload so registry always shows submitted data."""
        self.db.execute(text("""
            UPDATE m05_boe_filings
               SET port_of_import = :port,
                   boe_fields_json = CAST(:bfj AS JSONB),
                   line_items_json = CAST(:lij AS JSONB),
                   risk_score = :rs,
                   risk_band = :rb,
                   block_submit = :bs,
                   updated_at = NOW()
             WHERE id = :fid
               AND user_id = :uid
        """), {
            "fid": filing_id,
            "uid": user_id,
            "port": boe_fields.get("port_of_import", "INMAA1"),
            "bfj": json.dumps(boe_fields, default=str),
            "lij": json.dumps(line_items, default=str),
            "rs": risk.get("risk_score", 0),
            "rb": risk.get("risk_band", "LOW"),
            "bs": risk.get("block_submit", False),
        })

        self.db.execute(text("DELETE FROM m05_boe_line_items WHERE filing_id = :fid"), {"fid": filing_id})
        for idx, item in enumerate(line_items, start=1):
            self.db.execute(text("""
                INSERT INTO m05_boe_line_items (filing_id, line_number, item_json)
                VALUES (:fid, :ln, CAST(:ij AS JSONB))
            """), {"fid": filing_id, "ln": idx, "ij": json.dumps(item, default=str)})
        self.db.commit()

    def _log_icegate_interaction(
        self,
        filing_id: int,
        action: str,
        payload: Dict[str, Any],
        response: Dict[str, Any],
        user_id: int,
    ) -> None:
        self.db.execute(text("""
            INSERT INTO m05_icegate_log (
                filing_id, user_id, action,
                request_json, response_json, icegate_status,
                created_at
            ) VALUES (
                :fid, :uid, :act,
                CAST(:req AS JSONB), CAST(:res AS JSONB), :stat,
                NOW()
            )
        """), {
            "fid": filing_id,
            "uid": user_id,
            "act": action,
            "req": json.dumps(payload, default=str),
            "res": json.dumps(response, default=str),
            "stat": response.get("status", "UNKNOWN"),
        })
        self.db.commit()

    def _get_filing(self, filing_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        where_deleted = "AND is_deleted = FALSE" if self._has_soft_delete_columns() else ""
        row = self.db.execute(text(f"""
            SELECT * FROM m05_boe_filings
            WHERE id = :fid AND user_id = :uid {where_deleted}
        """), {"fid": filing_id, "uid": user_id}).fetchone()
        if not row:
            return None
        d = dict(row._mapping)
        for k in ("created_at", "updated_at"):
            if d.get(k):
                d[k] = d[k].isoformat()
        return d

    def _has_soft_delete_columns(self) -> bool:
        if self._soft_delete_supported is not None:
            return self._soft_delete_supported
        row = self.db.execute(text("""
            SELECT COUNT(*)::int AS cnt
            FROM information_schema.columns
            WHERE table_name = 'm05_boe_filings'
              AND column_name IN ('is_deleted', 'deleted_at', 'deleted_by')
        """)).fetchone()
        self._soft_delete_supported = bool(row and row[0] == 3)
        return self._soft_delete_supported

    def _get_filing_line_items(self, filing_id: int) -> List[Dict[str, Any]]:
        rows = self.db.execute(text("""
            SELECT item_json FROM m05_boe_line_items
            WHERE filing_id = :fid ORDER BY line_number
        """), {"fid": filing_id}).fetchall()
        items = []
        for row in rows:
            item = row[0]
            if isinstance(item, str):
                item = json.loads(item)
            items.append(item)
        return items
