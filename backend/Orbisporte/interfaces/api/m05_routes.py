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
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from Orbisporte.infrastructure.db import get_db, UserRepository
from Orbisporte.interfaces.api.auth import verify_token
from Orbisporte.domain.services.m05_boe_engine.pdf_generator import generate_boe_pdf

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
    _ensure_m05_column_sizes(db)
    from Orbisporte.domain.services.m05_boe_engine import M05BoEEngine
    return M05BoEEngine(db)


def _soft_delete_enabled(db: Session) -> bool:
    from sqlalchemy import text
    row = db.execute(text("""
        SELECT COUNT(*)::int
        FROM information_schema.columns
        WHERE table_name = 'm05_boe_filings'
          AND column_name IN ('is_deleted', 'deleted_at', 'deleted_by')
    """)).fetchone()
    return bool(row and row[0] == 3)


def _ensure_soft_delete_columns(db: Session) -> None:
    """
    Ensure recycle-bin columns exist so BOE delete is always soft-delete.
    Safe to call repeatedly.
    """
    from sqlalchemy import text
    if _soft_delete_enabled(db):
        return
    db.execute(text("""
        ALTER TABLE m05_boe_filings
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE
    """))
    db.execute(text("""
        ALTER TABLE m05_boe_filings
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    """))
    db.execute(text("""
        ALTER TABLE m05_boe_filings
            ADD COLUMN IF NOT EXISTS deleted_by INTEGER
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_m05_filings_deleted
            ON m05_boe_filings (user_id, is_deleted, updated_at DESC)
    """))
    db.commit()


def _ensure_m05_column_sizes(db: Session) -> None:
    """
    Ensure key m05_boe_filings columns are large enough for real-world values.
    Handles legacy schemas where port_of_import was VARCHAR(20).
    """
    from sqlalchemy import text

    rows = db.execute(text("""
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'm05_boe_filings'
          AND column_name IN ('port_of_import', 'filing_ref')
    """)).fetchall()

    col_meta = {r[0]: {"type": r[1], "max_len": r[2]} for r in rows}
    changed = False

    port = col_meta.get("port_of_import")
    if port and port["type"] == "character varying":
        current_len = int(port["max_len"] or 0)
        if current_len < 100:
            db.execute(text("""
                ALTER TABLE m05_boe_filings
                ALTER COLUMN port_of_import TYPE VARCHAR(100)
            """))
            changed = True
            logger.info("[M05] Expanded m05_boe_filings.port_of_import from VARCHAR(%s) to VARCHAR(100)", current_len)

    filing_ref = col_meta.get("filing_ref")
    if filing_ref and filing_ref["type"] == "character varying":
        current_len = int(filing_ref["max_len"] or 0)
        if current_len < 36:
            db.execute(text("""
                ALTER TABLE m05_boe_filings
                ALTER COLUMN filing_ref TYPE VARCHAR(64)
            """))
            changed = True
            logger.info("[M05] Expanded m05_boe_filings.filing_ref from VARCHAR(%s) to VARCHAR(64)", current_len)

    if changed:
        db.commit()


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
            raise HTTPException(status_code=422, detail=result)
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
            raise HTTPException(status_code=422, detail=result)
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
        filing = engine._get_filing(filing_id, current_user.id)
        if not filing:
            raise HTTPException(status_code=404, detail="Filing not found or access denied")

        boe_fields = filing.get("boe_fields_json") or {}
        if isinstance(boe_fields, str):
            import json
            boe_fields = json.loads(boe_fields)

        line_items = engine._get_filing_line_items(filing_id)
        icegate_resp = {
            "status": filing.get("icegate_status", "DRAFT"),
            "ack_number": filing.get("icegate_ack_number"),
            "boe_number": filing.get("icegate_boe_number"),
        } if filing.get("icegate_ack_number") else None

        # Render PDF in a worker thread so long-running document generation
        # does not block the API event loop and stall unrelated requests.
        pdf_bytes = await run_in_threadpool(
            generate_boe_pdf,
            boe_fields,
            line_items,
            icegate_resp,
        )

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
    """Soft-delete a BoE filing and move it to recycle bin."""
    from sqlalchemy import text
    _ensure_soft_delete_columns(db)
    select_sql = "SELECT id FROM m05_boe_filings WHERE id = :fid AND user_id = :uid AND is_deleted = FALSE"
    # Verify the filing belongs to this user
    row = db.execute(
        text(select_sql),
        {"fid": filing_id, "uid": current_user.id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Filing not found or access denied")
    try:
        db.execute(text("""
            UPDATE m05_boe_filings
               SET is_deleted = TRUE,
                   deleted_at = NOW(),
                   deleted_by = :uid,
                   updated_at = NOW()
             WHERE id = :fid AND user_id = :uid
        """), {"fid": filing_id, "uid": current_user.id})
        db.commit()
        logger.info("[M05] Filing %d deleted by user %d", filing_id, current_user.id)
        return {"success": True, "deleted_filing_id": filing_id, "mode": "soft"}
    except Exception as exc:
        db.rollback()
        logger.exception("[M05] /filing delete failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Delete failed: {exc}")


@router.post("/filing/{filing_id}/restore", summary="Restore a soft-deleted BoE filing")
async def restore_filing(
    filing_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    from sqlalchemy import text
    _ensure_soft_delete_columns(db)
    row = db.execute(
        text("SELECT id FROM m05_boe_filings WHERE id = :fid AND user_id = :uid AND is_deleted = TRUE"),
        {"fid": filing_id, "uid": current_user.id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Deleted filing not found or access denied")
    try:
        db.execute(text("""
            UPDATE m05_boe_filings
               SET is_deleted = FALSE,
                   deleted_at = NULL,
                   deleted_by = NULL,
                   updated_at = NOW()
             WHERE id = :fid AND user_id = :uid
        """), {"fid": filing_id, "uid": current_user.id})
        db.commit()
        return {"success": True, "restored_filing_id": filing_id}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restore failed: {exc}")


@router.delete("/filing/{filing_id}/permanent", summary="Permanently delete a BoE filing from recycle bin")
async def permanently_delete_filing(
    filing_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    from sqlalchemy import text
    _ensure_soft_delete_columns(db)
    row = db.execute(
        text("SELECT id FROM m05_boe_filings WHERE id = :fid AND user_id = :uid AND is_deleted = TRUE"),
        {"fid": filing_id, "uid": current_user.id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Deleted filing not found or access denied")
    try:
        # Delete downstream risk-engine records referencing this filing (if present).
        table_rows = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('m07_review_queue', 'm07_risk_scores')
        """)).fetchall()
        existing_tables = {r[0] for r in table_rows}

        if "m07_review_queue" in existing_tables:
            db.execute(text("DELETE FROM m07_review_queue WHERE filing_id = :fid"), {"fid": filing_id})
        if "m07_risk_scores" in existing_tables:
            db.execute(text("DELETE FROM m07_risk_scores WHERE filing_id = :fid"), {"fid": filing_id})

        db.execute(text("DELETE FROM m05_icegate_log WHERE filing_id = :fid"), {"fid": filing_id})
        db.execute(text("DELETE FROM m05_boe_line_items WHERE filing_id = :fid"), {"fid": filing_id})
        db.execute(text("DELETE FROM m05_boe_filings WHERE id = :fid"), {"fid": filing_id})
        db.commit()
        return {"success": True, "deleted_filing_id": filing_id, "mode": "permanent"}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Permanent delete failed: {exc}")


@router.get("/recycle-bin", summary="List soft-deleted BoE filings")
async def recycle_bin(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    from sqlalchemy import text
    _ensure_soft_delete_columns(db)
    rows = db.execute(text("""
        SELECT id, filing_ref, boe_number, icegate_status, filing_status,
               created_at, updated_at, deleted_at, port_of_import,
               COALESCE((boe_fields_json->>'importer_name'), '') AS importer_name,
               COALESCE((boe_fields_json->>'hsn_code'), '') AS hsn_code,
               COALESCE(NULLIF(boe_fields_json->>'custom_value_inr', '')::NUMERIC, 0) AS custom_value_inr,
               COALESCE(NULLIF(boe_fields_json->>'custom_duty', '')::NUMERIC, 0) AS custom_duty
        FROM m05_boe_filings
        WHERE user_id = :uid
          AND is_deleted = TRUE
        ORDER BY deleted_at DESC NULLS LAST, updated_at DESC
        LIMIT :lim
    """), {"uid": current_user.id, "lim": limit}).fetchall()

    filings = []
    for row in rows:
        d = dict(row._mapping)
        for k in ("created_at", "updated_at", "deleted_at"):
            if d.get(k):
                d[k] = d[k].isoformat()
        filings.append(d)
    return {"filings": filings, "count": len(filings)}


@router.get("/history", summary="User's BoE filing history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the authenticated user's recent M05 BoE filings."""
    try:
        engine = _get_engine(db)
        history = engine.get_filing_history(current_user.id, limit, include_deleted=include_deleted)
        return {"filings": history, "count": len(history)}
    except Exception as exc:
        logger.exception("[M05] /history failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"History fetch failed: {exc}")
