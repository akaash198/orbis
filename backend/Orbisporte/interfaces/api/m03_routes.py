"""
M03 HSN Classification Engine API.

Endpoints
---------
  POST  /m03/classify           Run full M03 pipeline on a product description
  POST  /m03/classify-batch     Classify multiple line-items in one call
  GET   /m03/result/{id}        Retrieve stored classification result
  PATCH /m03/review/{id}        Submit human review (approve/reject/override)
  GET   /m03/queue              List results pending human review
  GET   /m03/seed-status        How many HSN codes are embedded in pgvector
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from Orbisporte.infrastructure.db import get_db, UserRepository
from Orbisporte.interfaces.api.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/m03", tags=["M03 HSN Classification"])


# ── Auth (same pattern as M02) ────────────────────────────────────────────────

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


# ── Service factory (singleton per worker) ────────────────────────────────────

_service_instance = None

def _get_service():
    global _service_instance
    if _service_instance is None:
        from Orbisporte.domain.services.m03_classification import M03ClassificationService
        _service_instance = M03ClassificationService()
    return _service_instance


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/classify", summary="Classify a product description under 8-digit HSN")
def classify_hsn(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run the full M03 pipeline:
    normalize → embed (Voyage-4-large) → retrieve (pgvector top-10)
    → classify (GPT-4o-mini) → post-process → route

    Body fields:
      product_description : str (required)
      country_of_origin   : str (optional, ISO-2 or full name)
      document_id         : int (optional, link to ProcessedDocuments)
    """
    desc = (payload.get("product_description") or "").strip()
    if not desc:
        raise HTTPException(status_code=400, detail="product_description is required")

    try:
        svc    = _get_service()
        result = svc.classify(
            product_description=desc,
            country_of_origin=payload.get("country_of_origin"),
            document_id=payload.get("document_id"),
        )
    except Exception as exc:
        logger.error("[M03] classify failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    # Persist to DB
    try:
        from Orbisporte.domain.models import M03ClassificationResult
        row = M03ClassificationResult(
            document_id            = payload.get("document_id"),
            user_id                = current_user.id,
            product_description    = desc,
            normalized_description = result.get("normalized_description"),
            detected_language      = result.get("detected_language"),
            top3_predictions       = result.get("top3_predictions"),
            selected_hsn           = result.get("selected_hsn"),
            selected_confidence    = result.get("selected_confidence"),
            overall_confidence     = result.get("overall_confidence"),
            classification_notes   = result.get("classification_notes"),
            candidates_retrieved   = result.get("candidates_retrieved", 0),
            routing                = result.get("routing"),
            scomet_flag            = result.get("scomet_flag", False),
            trade_remedy_alert     = result.get("trade_remedy_alert", False),
            restricted_countries   = result.get("restricted_countries") or [],
            pipeline_stages        = result.get("pipeline_stages"),
            pipeline_duration_ms   = result.get("pipeline_duration_ms"),
        )
        db.add(row)
        db.commit()
        result["result_id"] = row.id
    except Exception as exc:
        logger.warning("[M03] DB persist failed (non-fatal): %s", exc)

    return result


@router.post("/classify-batch", summary="Classify multiple line-items in one request")
def classify_batch(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Classify a list of product items extracted from a document (e.g. M02 line_items).

    Body:
      items: [{description, country_of_origin?, document_id?}]
    """
    items: List[Dict] = payload.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="items list is required and must not be empty")

    try:
        svc     = _get_service()
        results = svc.classify_batch(items)
    except Exception as exc:
        logger.error("[M03] batch classify failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    # Persist each result
    saved_ids = []
    for r in results:
        try:
            from Orbisporte.domain.models import M03ClassificationResult
            row = M03ClassificationResult(
                user_id                = current_user.id,
                document_id            = r.get("document_id"),
                product_description    = r.get("product_description", ""),
                normalized_description = r.get("normalized_description"),
                detected_language      = r.get("detected_language"),
                top3_predictions       = r.get("top3_predictions"),
                selected_hsn           = r.get("selected_hsn"),
                selected_confidence    = r.get("selected_confidence"),
                overall_confidence     = r.get("overall_confidence"),
                routing                = r.get("routing", "human_review"),
                scomet_flag            = r.get("scomet_flag", False),
                trade_remedy_alert     = r.get("trade_remedy_alert", False),
                restricted_countries   = r.get("restricted_countries") or [],
                pipeline_stages        = r.get("pipeline_stages"),
                pipeline_duration_ms   = r.get("pipeline_duration_ms"),
            )
            db.add(row)
            db.flush()
            r["result_id"] = row.id
            saved_ids.append(row.id)
        except Exception as exc:
            logger.warning("[M03] Batch DB persist failed for one item: %s", exc)

    db.commit()
    return {"count": len(results), "results": results}


@router.get("/result/{result_id}", summary="Get a stored M03 classification result")
def get_result(
    result_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from Orbisporte.domain.models import M03ClassificationResult
    row = db.query(M03ClassificationResult).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    return {
        "result_id":            row.id,
        "product_description":  row.product_description,
        "top3_predictions":     row.top3_predictions,
        "selected_hsn":         row.selected_hsn,
        "selected_confidence":  row.selected_confidence,
        "overall_confidence":   row.overall_confidence,
        "routing":              row.routing,
        "review_status":        row.review_status,
        "classification_notes": row.classification_notes,
        "scomet_flag":          row.scomet_flag,
        "trade_remedy_alert":   row.trade_remedy_alert,
        "restricted_countries": row.restricted_countries,
        "detected_language":    row.detected_language,
        "pipeline_stages":      row.pipeline_stages,
        "pipeline_duration_ms": row.pipeline_duration_ms,
        "created_at":           row.created_at.isoformat() if row.created_at else None,
    }


@router.patch("/review/{result_id}", summary="Approve, reject, or override M03 classification")
def review_result(
    result_id: int,
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Body fields:
      approved          : bool (true = approved, false = rejected)
      reviewer_hsn_override : str (optional 8-digit HSN to override)
      notes             : str (optional reviewer comments)
    """
    from Orbisporte.domain.models import M03ClassificationResult
    row = db.query(M03ClassificationResult).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")

    row.review_status         = "approved" if payload.get("approved") else "rejected"
    row.reviewed_by           = current_user.id
    row.reviewed_at           = datetime.utcnow()
    row.reviewer_notes        = payload.get("notes", "")
    row.reviewer_hsn_override = payload.get("reviewer_hsn_override")

    if row.reviewer_hsn_override:
        row.selected_hsn = row.reviewer_hsn_override

    db.commit()
    return {
        "result_id":    row.id,
        "review_status": row.review_status,
        "selected_hsn":  row.selected_hsn,
    }


@router.get("/queue", summary="List M03 results pending human review")
def get_review_queue(
    limit: int = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from Orbisporte.domain.models import M03ClassificationResult
    rows = (
        db.query(M03ClassificationResult)
        .filter_by(routing="human_review", review_status="pending")
        .order_by(M03ClassificationResult.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "count": len(rows),
        "results": [
            {
                "result_id":           r.id,
                "product_description": r.product_description[:120],
                "selected_hsn":        r.selected_hsn,
                "selected_confidence": r.selected_confidence,
                "scomet_flag":         r.scomet_flag,
                "created_at":          r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/seed-status", summary="How many HSN codes are embedded in pgvector")
def seed_status(current_user=Depends(get_current_user)):
    try:
        from Orbisporte.domain.services.m03_classification.retriever import count_embedded
        count = count_embedded()
        return {"embedded_count": count, "status": "ok"}
    except Exception as exc:
        return {"embedded_count": 0, "status": "error", "detail": str(exc)}
