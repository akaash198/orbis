"""
M06 Trade Fraud Detection Engine API
======================================
Endpoints
---------
  POST  /m06/analyse              Run full fraud detection pipeline on a transaction
  GET   /m06/cases                List investigation cases (SIIB/DRI)
  PATCH /m06/cases/{case_id}      Update case status / analyst findings
  GET   /m06/history              User's fraud analysis history
  GET   /m06/result/{uuid}        Retrieve stored analysis by UUID

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from Orbisporte.infrastructure.db import get_db, UserRepository
from Orbisporte.interfaces.api.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/m06", tags=["M06 Trade Fraud Detection Engine"])


# ── Auth helper ────────────────────────────────────────────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = UserRepository.get_by_id(db, int(payload.get("sub")))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Service factory ────────────────────────────────────────────────────────────

def _get_engine(db: Session):
    from Orbisporte.domain.services.m06_fraud_engine import M06FraudEngine
    return M06FraudEngine(db)


# ── Request / Response schemas ─────────────────────────────────────────────────

class TransactionInput(BaseModel):
    """
    Normalised transaction record for fraud analysis.
    Accepts output from M04/M05 directly or manual entry.
    """
    # Identity
    importer_iec: Optional[str]   = Field(None, description="10-digit IEC number")
    importer_name: Optional[str]  = None
    exporter_name: Optional[str]  = None

    # Goods
    hsn_code: Optional[str]       = Field(None, description="HSN / HS tariff code")
    description_of_goods: Optional[str] = None

    # Geography
    country_of_origin: Optional[str]   = Field(None, description="ISO 3166 alpha-3")
    country_of_shipment: Optional[str] = Field(None, description="ISO 3166 alpha-3")
    port_of_import: Optional[str]      = None
    port_of_shipment: Optional[str]    = None

    # Financial
    cif_value_inr: Optional[float]     = Field(None, ge=0)
    freight_inr: Optional[float]       = Field(0.0, ge=0)
    insurance_inr: Optional[float]     = Field(0.0, ge=0)
    customs_duty_inr: Optional[float]  = Field(None, ge=0)
    hsn_bcd_rate: Optional[float]      = Field(0.10, ge=0, le=1)

    # Shipment
    bill_of_lading_number: Optional[str] = None
    shipping_line: Optional[str]         = None
    arrival_date: Optional[str]          = None

    # FTA
    fta_claimed: bool = False

    # Pass-through from M04/M05
    m04_computation_uuid: Optional[str] = None
    filing_id: Optional[int]            = None

    # Line items (optional — used for split shipment + Benford)
    line_items: Optional[List[Dict[str, Any]]] = None


class AnalyseRequest(BaseModel):
    transaction: TransactionInput


class AnalyseAutoRequest(BaseModel):
    """Auto-analysis: pull everything from M05 BoE + M04 duty records."""
    filing_id: Optional[int]             = Field(None, description="M05 BoE filing ID")
    document_id: Optional[int]           = Field(None, description="M02 document ID (fallback)")
    m04_computation_uuid: Optional[str]  = Field(None, description="M04 computation UUID (optional override)")


class UpdateCaseRequest(BaseModel):
    status: Optional[str]            = Field(None, description="OPEN | UNDER_REVIEW | ESCALATED | CLOSED")
    analyst_findings: Optional[str]  = None
    action: Optional[str]            = Field(None, description="WARN | DETAIN | PROSECUTE | CLEAR")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/analyse", summary="Run full fraud detection pipeline on a transaction")
async def analyse_transaction(
    request: AnalyseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Execute the complete M06 fraud detection pipeline:

    - **FRAUD-003** ECOD anomaly detection (under/over-invoicing, freight manipulation)
    - **FRAUD-004** PrefixSpan pattern mining (HSN manipulation, split shipments)
    - **FRAUD-005** HCLNet hypergraph + contrastive learning (shell company networks)
    - **FRAUD-006** Benford's Law chi-square + routing anomaly analysis
    - **FRAUD-007** Composite score (0–100) + automatic case creation for HIGH_RISK / CRITICAL

    Risk levels:
    - **CLEAN** (0–39) — no action required
    - **SUSPICIOUS** (40–59) — flagged for manual review
    - **HIGH_RISK** (60–79) — assigned to SIIB analyst
    - **CRITICAL** (80–100) — auto-creates DRI investigation case
    """
    try:
        engine = _get_engine(db)
        tx_dict = request.transaction.model_dump(exclude_none=False)
        result = engine.analyse_transaction(tx_dict, current_user.id)
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result.get("error", "Analysis failed"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M06] /analyse failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Fraud analysis failed: {exc}")


@router.post("/analyse-auto", summary="Auto-analyse using M05 BoE + M04 duty data")
async def analyse_auto(
    request: AnalyseAutoRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Fully automatic fraud analysis — no manual input required.

    Pass a `filing_id` (from M05) **or** a `document_id` (from M02).
    The engine automatically pulls:
    - Importer identity, goods, ports, BL number → from M05 BoE fields
    - CIF value, duties, FX rate, anomaly flags → from M04 duty computation
    - Any remaining fields → from M02 document extraction

    Then runs the complete FRAUD-001 → FRAUD-007 pipeline.
    """
    if not request.filing_id and not request.document_id:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of: filing_id or document_id"
        )
    try:
        engine = _get_engine(db)
        result = engine.analyse_auto(
            filing_id            = request.filing_id,
            document_id          = request.document_id,
            m04_computation_uuid = request.m04_computation_uuid,
            user_id              = current_user.id,
        )
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result.get("error", "Analysis failed"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M06] /analyse-auto failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Auto fraud analysis failed: {exc}")


@router.get("/recent-filings", summary="List recent M05 BoE filings for the fraud analysis picker")
async def get_recent_filings(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns the user's recent M05 BoE filings to populate the
    'Select filing' dropdown in the fraud analysis UI.
    Each entry includes importer, HSN, CIF value and filing status.
    """
    try:
        engine = _get_engine(db)
        filings = engine.get_recent_filings(current_user.id, limit)
        return {"filings": filings, "count": len(filings)}
    except Exception as exc:
        logger.exception("[M06] /recent-filings failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch filings: {exc}")


@router.get("/cases", summary="List SIIB/DRI investigation cases")
async def get_cases(
    status: Optional[str] = Query(None, description="Filter by case status"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return investigation cases created by M06 for the authenticated user's organisation.
    Filter by status: OPEN | UNDER_REVIEW | ESCALATED | CLOSED.
    """
    try:
        engine = _get_engine(db)
        cases = engine.get_cases(current_user.id, status=status, limit=limit)
        return {"cases": cases, "count": len(cases)}
    except Exception as exc:
        logger.exception("[M06] /cases failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Cases fetch failed: {exc}")


@router.patch("/cases/{case_id}", summary="Update investigation case")
async def update_case(
    case_id: int,
    request: UpdateCaseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Update an investigation case with analyst findings and action taken.

    Actions: WARN | DETAIN | PROSECUTE | CLEAR
    """
    try:
        engine = _get_engine(db)
        result = engine.update_case(
            case_id          = case_id,
            status           = request.status,
            analyst_findings = request.analyst_findings,
            action           = request.action,
            user_id          = current_user.id,
        )
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M06] /cases PATCH failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Case update failed: {exc}")


@router.get("/history", summary="Fraud analysis history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the authenticated user's recent M06 fraud analysis records."""
    try:
        engine = _get_engine(db)
        history = engine.get_history(current_user.id, limit)
        return {"analyses": history, "count": len(history)}
    except Exception as exc:
        logger.exception("[M06] /history failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"History fetch failed: {exc}")


@router.get("/result/{analysis_uuid}", summary="Retrieve stored fraud analysis")
async def get_result(
    analysis_uuid: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve the full fraud analysis result for a given UUID."""
    try:
        engine = _get_engine(db)
        result = engine.get_analysis(analysis_uuid, current_user.id)
        if not result:
            raise HTTPException(status_code=404, detail="Analysis not found or access denied")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M06] /result failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Result fetch failed: {exc}")
