"""
M05 Bill of Entry Filing System API
=====================================
Endpoints
---------
  POST  /m05/prepare              Aggregate M01–M04 data → pre-filled BoE payload
  POST  /m05/validate             Field-level validation
  POST  /m05/submit               Submit BoE to ICEGATE
  GET   /m05/status/{filing_id}   Submission status + ICEGATE response
  POST  /m05/resolve-query        LLM query resolution draft
  GET   /m05/pdf/{filing_id}      Download BoE as PDF
  GET   /m05/history              User's BoE filing history

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from Orbisporte.infrastructure.db import get_db, UserRepository
from Orbisporte.interfaces.api.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/m05", tags=["M05 Bill of Entry Filing System"])


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
    from Orbisporte.domain.services.m05_boe_engine import M05BoEEngine
    return M05BoEEngine(db)


# ── Request schemas ────────────────────────────────────────────────────────────

class PrepareRequest(BaseModel):
    document_id: int
    port_of_import: str = Field("INMAA1", description="ICEGATE port code, e.g. INMAA1")
    m04_computation_uuid: Optional[str] = None


class ValidateRequest(BaseModel):
    boe_fields: Dict[str, Any]
    line_items: List[Dict[str, Any]]


class SubmitRequest(BaseModel):
    filing_id: int
    boe_fields: Dict[str, Any]
    line_items: List[Dict[str, Any]]


class ResolveQueryRequest(BaseModel):
    filing_id: int
    query_text: str
    additional_context: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/prepare", summary="Aggregate M01–M04 data into pre-filled BoE payload")
async def prepare_boe(
    request: PrepareRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Pull document extraction (M01/M02), HSN classification (M03), and
    duty computation (M04) results and map them into all 22 required BoE fields.

    Also runs the pre-filing risk predictor and returns a risk score + risk band.
    """
    try:
        engine = _get_engine(db)
        result = engine.prepare_boe(
            document_id=request.document_id,
            user_id=current_user.id,
            port_of_import=request.port_of_import,
            m04_computation_uuid=request.m04_computation_uuid,
        )
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result.get("error", "Preparation failed"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M05] /prepare failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"BoE preparation failed: {exc}")


@router.post("/validate", summary="Validate all BoE fields before submission")
async def validate_boe(
    request: ValidateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Run field-level validation on BoE header fields and line items.
    Returns a report with errors and warnings.
    """
    try:
        engine = _get_engine(db)
        return engine.validate_boe(request.boe_fields, request.line_items)
    except Exception as exc:
        logger.exception("[M05] /validate failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Validation failed: {exc}")


@router.post("/submit", summary="Submit BoE to ICEGATE")
async def submit_boe(
    request: SubmitRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Build ICEGATE-compliant payload and submit the BoE.

    Response status values:
    - **ACCEPTED** — BoE reference number assigned by ICEGATE
    - **REJECTED** — List of error codes returned; must correct and resubmit
    - **QUERY**    — Customs officer raised a query; LLM draft response provided
    - **PENDING**  — Not yet processed; poll `/m05/status/{filing_id}`
    """
    try:
        engine = _get_engine(db)
        result = engine.submit_boe(
            filing_id=request.filing_id,
            boe_fields=request.boe_fields,
            line_items=request.line_items,
            user_id=current_user.id,
        )
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result.get("error", "Submission failed"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M05] /submit failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"BoE submission failed: {exc}")


@router.get("/status/{filing_id}", summary="Get BoE filing status")
async def get_filing_status(
    filing_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve the current status of a BoE filing, including ICEGATE response."""
    try:
        engine = _get_engine(db)
        filing = engine._get_filing(filing_id, current_user.id)
        if not filing:
            raise HTTPException(status_code=404, detail="Filing not found or access denied")
        return filing
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M05] /status failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Status lookup failed: {exc}")


@router.post("/resolve-query", summary="Draft LLM response to ICEGATE customs query")
async def resolve_query(
    request: ResolveQueryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Use GPT-4o-mini to draft a professional response to a customs query
    raised by ICEGATE for the given BoE filing.
    """
    try:
        engine = _get_engine(db)
        result = engine.resolve_query(
            filing_id=request.filing_id,
            query_text=request.query_text,
            user_id=current_user.id,
            additional_context=request.additional_context,
        )
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M05] /resolve-query failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Query resolution failed: {exc}")


@router.get("/pdf/{filing_id}", summary="Download BoE as PDF")
async def download_pdf(
    filing_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Response:
    """
    Generate and stream the Bill of Entry as a downloadable PDF.
    Falls back to a UTF-8 plain-text document if ReportLab is not installed.
    """
    try:
        engine = _get_engine(db)
        pdf_bytes = engine.generate_pdf(filing_id, current_user.id)
        if pdf_bytes is None:
            raise HTTPException(status_code=404, detail="Filing not found or access denied")

        # Detect format: PDFs start with %PDF-
        if pdf_bytes[:4] == b"%PDF":
            media_type = "application/pdf"
            filename = f"BoE_{filing_id}.pdf"
        else:
            media_type = "text/plain; charset=utf-8"
            filename = f"BoE_{filing_id}.txt"

        return Response(
            content=pdf_bytes,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M05] /pdf failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")


@router.delete("/filing/{filing_id}", summary="Delete a BoE filing")
async def delete_filing(
    filing_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Permanently delete a BoE filing and its associated line items and ICEGATE logs."""
    from sqlalchemy import text
    # Verify the filing belongs to this user
    row = db.execute(
        text("SELECT id FROM m05_boe_filings WHERE id = :fid AND user_id = :uid"),
        {"fid": filing_id, "uid": current_user.id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Filing not found or access denied")
    try:
        db.execute(text("DELETE FROM m05_icegate_log WHERE filing_id = :fid"), {"fid": filing_id})
        db.execute(text("DELETE FROM m05_boe_line_items WHERE filing_id = :fid"), {"fid": filing_id})
        db.execute(text("DELETE FROM m05_boe_filings WHERE id = :fid"), {"fid": filing_id})
        db.commit()
        logger.info("[M05] Filing %d deleted by user %d", filing_id, current_user.id)
        return {"success": True, "deleted_filing_id": filing_id}
    except Exception as exc:
        db.rollback()
        logger.exception("[M05] /filing delete failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Delete failed: {exc}")


@router.get("/history", summary="User's BoE filing history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the authenticated user's recent M05 BoE filings."""
    try:
        engine = _get_engine(db)
        history = engine.get_filing_history(current_user.id, limit)
        return {"filings": history, "count": len(history)}
    except Exception as exc:
        logger.exception("[M05] /history failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"History fetch failed: {exc}")
