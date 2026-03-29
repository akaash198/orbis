"""
M07 Risk Score Engine API
==========================
Endpoints
---------
  POST  /m07/score              Auto-score a shipment (uses filing_id / document_id)
  GET   /m07/recent-filings     M05 filing picker for the UI
  GET   /m07/queue              Review queue (AMBER + RED items)
  PATCH /m07/queue/{item_id}    Officer resolves a queue item
  GET   /m07/history            Scoring history
  GET   /m07/result/{uuid}      Retrieve stored scoring result

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
router = APIRouter(prefix="/m07", tags=["M07 Risk Score Engine"])


# ── Auth helper ───────────────────────────────────────────────────────────────

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


# ── Service factory ───────────────────────────────────────────────────────────

def _get_engine(db: Session):
    from Orbisporte.domain.services.m07_risk_engine import M07RiskEngine
    return M07RiskEngine(db)


# ── Request / Response schemas ────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    """
    Auto-score request — pass at least one upstream identifier.
    The engine pulls all necessary features automatically from M02/M03/M04/M05/M06.
    Optionally pass m06_result if the fraud analysis was just run in the same session
    to avoid an extra DB round-trip.
    """
    filing_id:   Optional[int]            = Field(None, description="M05 BoE filing ID")
    document_id: Optional[int]            = Field(None, description="M02 document ID (fallback)")
    m06_result:  Optional[Dict[str, Any]] = Field(None, description="M06 result payload (optional pass-through)")


class UpdateQueueRequest(BaseModel):
    status:     Optional[str] = Field(None, description="PENDING | UNDER_REVIEW | CLEARED | REFERRED | DETAINED")
    resolution: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/score", summary="Auto-score a shipment using upstream module data")
async def score_shipment(
    request: ScoreRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Execute the full M07 risk scoring pipeline automatically:

    - **RISK-001** Pull feature vector from M02 / M03 / M04 / M05 / M06
    - **RISK-002** TabPFN-2.5 inference (rule-based fallback if package absent)
    - **RISK-003** SHAP-style feature contribution decomposition
    - **RISK-004** Tier assignment + automated routing action
    - **RISK-005** Persist result; create review queue item for AMBER / RED

    Risk tiers:
    - **GREEN** (0–30) — Auto-clearance (Faceless First Check)
    - **AMBER** (31–60) — Review queue (Second Check / Scrutiny — 2h SLA)
    - **RED** (61–100) — Investigation (Detailed Examination / DRI Referral)
    """
    if not request.filing_id and not request.document_id:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of: filing_id or document_id",
        )
    try:
        engine = _get_engine(db)
        result = engine.score_auto(
            filing_id   = request.filing_id,
            document_id = request.document_id,
            m06_result  = request.m06_result,
            user_id     = current_user.id,
        )
        if not result.get("success"):
            raise HTTPException(status_code=422, detail=result.get("error", "Scoring failed"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M07] /score failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Risk scoring failed: {exc}")


@router.get("/recent-filings", summary="List recent M05 BoE filings for the scoring picker")
async def get_recent_filings(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Returns the user's recent M05 BoE filings for the risk scoring UI picker."""
    try:
        engine  = _get_engine(db)
        filings = engine.get_recent_filings(current_user.id, limit)
        return {"filings": filings, "count": len(filings)}
    except Exception as exc:
        logger.exception("[M07] /recent-filings failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch filings: {exc}")


@router.get("/queue", summary="List review queue items (AMBER + RED)")
async def get_queue(
    tier:   Optional[str] = Query(None, description="Filter by tier: AMBER | RED"),
    status: Optional[str] = Query(None, description="Filter by status: PENDING | UNDER_REVIEW | CLEARED | REFERRED | DETAINED"),
    limit:  int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return AMBER and RED review queue items for the authenticated user's organisation."""
    try:
        engine = _get_engine(db)
        items  = engine.get_queue(current_user.id, tier=tier, status=status, limit=limit)
        return {"items": items, "count": len(items)}
    except Exception as exc:
        logger.exception("[M07] /queue failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Queue fetch failed: {exc}")


@router.patch("/queue/{item_id}", summary="Officer resolves a review queue item")
async def update_queue_item(
    item_id: int,
    request: UpdateQueueRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Update a review queue item with the officer's resolution.

    Statuses: PENDING | UNDER_REVIEW | CLEARED | REFERRED | DETAINED
    """
    try:
        engine = _get_engine(db)
        result = engine.update_queue_item(
            item_id    = item_id,
            status     = request.status,
            resolution = request.resolution,
            user_id    = current_user.id,
        )
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M07] /queue PATCH failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Queue update failed: {exc}")


@router.get("/history", summary="Risk scoring history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the authenticated user's recent M07 risk scoring records."""
    try:
        engine  = _get_engine(db)
        history = engine.get_history(current_user.id, limit)
        return {"scores": history, "count": len(history)}
    except Exception as exc:
        logger.exception("[M07] /history failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"History fetch failed: {exc}")


@router.get("/result/{analysis_uuid}", summary="Retrieve stored risk score result")
async def get_result(
    analysis_uuid: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve the full risk scoring result including feature contributions for a given UUID."""
    try:
        engine = _get_engine(db)
        result = engine.get_result(analysis_uuid, current_user.id)
        if not result:
            raise HTTPException(status_code=404, detail="Result not found or access denied")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M07] /result failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Result fetch failed: {exc}")
