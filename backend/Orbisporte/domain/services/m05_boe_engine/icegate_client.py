"""
M05 — ICEGATE REST API Client  (SOP BOE-004)
=============================================
Wraps the ICEGATE Electronic Filing API for Indian Customs BoE submission.

Endpoints used
--------------
  POST /icegate/api/boe/submit     — Submit new Bill of Entry
  GET  /icegate/api/boe/status     — Poll submission status by reference
  POST /icegate/api/boe/amend      — Amend a previously submitted BoE

Environment variables
---------------------
  ICEGATE_BASE_URL   : Base URL of ICEGATE API  (default: sandbox)
  ICEGATE_API_KEY    : Issued API key
  ICEGATE_USER_ID    : Filing agent user-ID registered with ICEGATE
  ICEGATE_IEC        : IEC of the importer (or blank for agent filing)

Response handling (SOP BOE-005)
--------------------------------
  ACCEPTED  — BoE number assigned; record ack_number + boe_number
  REJECTED  — Parse error codes; surface corrective messages
  QUERY     — Customs officer raised clarification query; LLM drafts reply
  PENDING   — Not yet processed; return status for polling

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
_BASE_URL  = os.getenv("ICEGATE_BASE_URL",  "https://sandbox.icegate.gov.in")
_API_KEY   = os.getenv("ICEGATE_API_KEY",   "")
_USER_ID   = os.getenv("ICEGATE_USER_ID",   "DEMO_AGENT")
_TIMEOUT   = 30  # seconds

# ── ICEGATE response-code → internal status mapping ─────────────────────────
_STATUS_MAP: Dict[str, str] = {
    "00": "ACCEPTED",
    "01": "REJECTED",
    "02": "QUERY",
    "03": "PENDING",
    "04": "AMENDMENT_REQUIRED",
}


class ICEGATEClient:
    """
    Thin HTTP wrapper around ICEGATE BoE filing API.

    All methods return a normalised dict — the caller never needs to parse
    raw ICEGATE response objects directly.
    """

    def __init__(self) -> None:
        self._base = _BASE_URL.rstrip("/")
        self._headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-API-Key": _API_KEY,
            "X-User-ID": _USER_ID,
        }
        self._sandbox = "sandbox" in self._base.lower() or not _API_KEY

    # ── Public API ────────────────────────────────────────────────────────────

    def submit_boe(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit a BoE payload to ICEGATE.

        Returns a normalised response:
        {
          "status"     : "ACCEPTED" | "REJECTED" | "QUERY" | "PENDING",
          "ack_number" : str | None,
          "boe_number" : str | None,
          "errors"     : [{"code": str, "message": str}],
          "query_text" : str | None,
          "raw"        : dict,
        }
        """
        if self._sandbox:
            logger.info("[ICEGATEClient] Sandbox mode — simulating submission")
            return self._simulate_submission(payload)

        url = f"{self._base}/icegate/api/boe/submit"
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.post(url, json=payload, headers=self._headers)
                resp.raise_for_status()
                return self._parse_response(resp.json())
        except httpx.HTTPStatusError as exc:
            logger.error("[ICEGATEClient] HTTP %s: %s", exc.response.status_code, exc.response.text)
            return {
                "status": "ERROR",
                "ack_number": None,
                "boe_number": None,
                "errors": [{"code": str(exc.response.status_code), "message": exc.response.text[:500]}],
                "query_text": None,
                "raw": {},
            }
        except Exception as exc:
            logger.error("[ICEGATEClient] Submission failed: %s", exc)
            return {
                "status": "ERROR",
                "ack_number": None,
                "boe_number": None,
                "errors": [{"code": "NETWORK_ERROR", "message": str(exc)}],
                "query_text": None,
                "raw": {},
            }

    def get_status(self, ack_number: str) -> Dict[str, Any]:
        """Poll ICEGATE for submission status by acknowledgement number."""
        if self._sandbox:
            return {
                "status": "ACCEPTED",
                "ack_number": ack_number,
                "boe_number": f"BOE{ack_number[-6:]}",
                "errors": [],
                "query_text": None,
                "raw": {"simulated": True},
            }

        url = f"{self._base}/icegate/api/boe/status"
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.get(url, params={"ack_number": ack_number}, headers=self._headers)
                resp.raise_for_status()
                return self._parse_response(resp.json())
        except Exception as exc:
            logger.error("[ICEGATEClient] Status check failed: %s", exc)
            return {
                "status": "ERROR",
                "ack_number": ack_number,
                "boe_number": None,
                "errors": [{"code": "NETWORK_ERROR", "message": str(exc)}],
                "query_text": None,
                "raw": {},
            }

    # ── ICEGATE JSON payload builder ─────────────────────────────────────────

    @staticmethod
    def build_payload(boe_fields: Dict[str, Any], line_items: list[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Assemble the ICEGATE-compliant JSON payload from normalised BoE fields.

        Field names follow ICEGATE EDI Message Format (ICES 1.5 schema).
        """
        def _s(v: Any) -> str:
            return str(v).strip() if v is not None else ""

        def _f(v: Any) -> float:
            try:
                return round(float(v), 2)
            except (TypeError, ValueError):
                return 0.0

        payload: Dict[str, Any] = {
            "filing_details": {
                "filing_type": _s(boe_fields.get("boe_type", "HOME_CONSUMPTION")),
                "port_code": _s(boe_fields.get("port_of_import", "INMAA1")),
                "filing_date": _s(boe_fields.get("date_of_filing") or datetime.utcnow().date().isoformat()),
                "agent_user_id": _USER_ID,
            },
            "importer": {
                "name": _s(boe_fields.get("importer_name")),
                "address": _s(boe_fields.get("importer_address")),
                "iec": _s(boe_fields.get("importer_iec")),
                "gstin": _s(boe_fields.get("importer_gstin", "")),
            },
            "shipment": {
                "bl_number": _s(boe_fields.get("bill_of_lading_number")),
                "shipping_line": _s(boe_fields.get("shipping_line")),
                "port_of_shipment": _s(boe_fields.get("port_of_shipment")),
                "arrival_date": _s(boe_fields.get("arrival_date")),
                "country_of_origin": _s(boe_fields.get("country_of_origin")),
                "country_of_shipment": _s(boe_fields.get("country_of_shipment")),
            },
            "financials": {
                "custom_value_inr": _f(boe_fields.get("custom_value_inr")),
                "total_custom_duty": _f(boe_fields.get("custom_duty")),
                "total_gst": _f(boe_fields.get("gst")),
                "total_payable": _f(boe_fields.get("total_payable", 0)),
                "currency": _s(boe_fields.get("currency", "INR")),
                "exchange_rate": _f(boe_fields.get("exchange_rate", 1.0)),
            },
            "line_items": [
                {
                    "sr_no": idx + 1,
                    "description": _s(item.get("description_of_goods") or item.get("product_description")),
                    "hsn_code": _s(item.get("hsn_code")),
                    "quantity": _f(item.get("quantity")),
                    "unit": _s(item.get("unit", "NOS")),
                    "custom_value_inr": _f(item.get("custom_value_inr") or item.get("assessable_value")),
                    "bcd_amount": _f(item.get("bcd_amount")),
                    "sws_amount": _f(item.get("sws_amount")),
                    "igst_amount": _f(item.get("igst_amount")),
                    "add_amount": _f(item.get("add_amount", 0)),
                    "cvd_amount": _f(item.get("cvd_amount", 0)),
                    "total_duty": _f(item.get("total_duty")),
                    "country_of_origin": _s(item.get("country_of_origin")),
                }
                for idx, item in enumerate(line_items)
            ],
            "declarations": {
                "importer_signature": _s(boe_fields.get("importer_signature", "DIGITAL")),
                "submission_timestamp": datetime.utcnow().isoformat() + "Z",
            },
        }
        return payload

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _parse_response(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        """Normalise a raw ICEGATE API response dict."""
        code = str(raw.get("responseCode") or raw.get("status_code") or "03")
        status = _STATUS_MAP.get(code, "PENDING")

        errors = []
        for e in raw.get("errors") or []:
            if isinstance(e, dict):
                errors.append({"code": e.get("errorCode", ""), "message": e.get("errorMessage", str(e))})
            else:
                errors.append({"code": "ERR", "message": str(e)})

        return {
            "status": status,
            "ack_number": raw.get("ackNumber") or raw.get("ack_number"),
            "boe_number": raw.get("boeNumber") or raw.get("boe_number"),
            "errors": errors,
            "query_text": raw.get("queryText") or raw.get("query_text"),
            "raw": raw,
        }

    @staticmethod
    def _simulate_submission(payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sandbox simulation — returns ACCEPTED with a dummy BoE number.
        Used when ICEGATE_API_KEY is not configured or the URL is a sandbox.
        """
        ack = f"ACK{uuid.uuid4().hex[:12].upper()}"
        port = (payload.get("filing_details") or {}).get("port_code", "INMAA1")
        prefix = {"INMAA1": "MUM", "INMAA4": "CHN", "INCCU1": "KOL", "INBLR4": "BLR"}.get(port, "IMP")
        boe_num = f"{prefix}/{datetime.utcnow().year}/{ack[-6:]}"

        return {
            "status": "ACCEPTED",
            "ack_number": ack,
            "boe_number": boe_num,
            "errors": [],
            "query_text": None,
            "raw": {"simulated": True, "ack_number": ack, "boe_number": boe_num},
        }
