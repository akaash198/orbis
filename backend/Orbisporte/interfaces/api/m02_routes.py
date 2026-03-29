"""
M02 Document Processing & Extraction API.

Endpoints
---------
  POST /m02/process/{document_id}   Run full M02 pipeline on uploaded document
  GET  /m02/result/{document_id}    Get M02 result for a document
  PATCH /m02/review/{result_id}     Submit human-reviewed field corrections
  GET  /m02/queue/{queue_name}      List documents in a review queue
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from Orbisporte.domain.models import M02ExtractionResult, ProcessedDocument
from Orbisporte.domain.services.m02_extraction import M02ExtractionService
from Orbisporte.infrastructure.db import get_db, UserRepository
from Orbisporte.interfaces.api.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/m02", tags=["M02 Document Extraction"])


# ── Auth ──────────────────────────────────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None),
                     db: Session = Depends(get_db)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = UserRepository.get_by_id(db, int(payload.get("sub")))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Run M02 pipeline ──────────────────────────────────────────────────────────
class ProcessRequest(BaseModel):
    document_type: Optional[str] = None  # Optional hint from frontend classification


@router.post("/process/{document_id}", summary="Run M02 extraction pipeline on a document")
async def process_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    body: ProcessRequest = Body(default=ProcessRequest()),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Triggers the full M02 pipeline:
    OCR → Layout → Field Extraction → GLiNER → Normalise → Confidence → Route
    Returns immediately with result_id; processing runs in background.
    Optional body: { "document_type": "commercial_invoice" } to hint the classifier.
    """
    doc = db.query(ProcessedDocument).filter_by(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    hint_type = body.document_type if body else None

    # Create a placeholder result row
    m02 = M02ExtractionResult(
        document_id=document_id,
        user_id=current_user.id,
        review_status="processing",
        review_queue="pending",
    )
    db.add(m02)
    db.flush()       # sends INSERT → auto-assigns m02.id from RETURNING
    result_id = m02.id  # capture before commit() expires all attributes
    db.commit()

    def _run(doc_id: int, result_id: int, file_path: str, document_type_hint: Optional[str]):
        from Orbisporte.core import SessionLocal
        inner_db = SessionLocal()
        try:
            svc = M02ExtractionService()
            output = svc.process(file_path, document_id=doc_id, document_type_hint=document_type_hint)

            row = inner_db.query(M02ExtractionResult).filter_by(id=result_id).first()
            if row:
                row.document_type            = output.get("document_type")
                row.document_type_confidence = output.get("document_type_confidence")
                row.document_type_signals    = output.get("document_type_signals")
                row.ocr_text                 = output.get("ocr_text", "")[:50000]
                row.layout_blocks            = output.get("layout_blocks")
                row.raw_entities             = output.get("gliner_entities")
                row.extracted_fields         = output.get("extracted_fields")
                row.normalised_fields        = output.get("normalised_fields")
                row.confidence_scores        = output.get("confidence_scores")
                row.overall_confidence       = output.get("overall_confidence")
                row.review_queue             = output.get("review_queue", "hard_review")
                row.fields_auto              = output.get("fields_auto")
                row.fields_soft_review       = output.get("fields_soft_review")
                row.fields_hard_review       = output.get("fields_hard_review")
                row.fields_low               = output.get("fields_low")
                row.quality_alert            = output.get("quality_alert", False)
                row.pipeline_duration_ms     = output.get("pipeline_duration_ms")
                row.review_status            = "pending"
                inner_db.commit()
                logger.info("[M02] Result saved: result_id=%d queue=%s", result_id, row.review_queue)
        except Exception as exc:
            logger.exception("[M02] Pipeline failed for result_id=%d: %s", result_id, exc)
            row = inner_db.query(M02ExtractionResult).filter_by(id=result_id).first()
            if row:
                row.review_status = "error"
                row.review_queue  = "quality_alert"
                inner_db.commit()
        finally:
            inner_db.close()

    background_tasks.add_task(_run, document_id, result_id, doc.file_path, hint_type)

    return JSONResponse(status_code=202, content={
        "result_id":   result_id,
        "document_id": document_id,
        "status":      "processing",
        "message":     "M02 pipeline started. Poll /m02/result/{document_id} for updates.",
    })


# ── Get result ────────────────────────────────────────────────────────────────
@router.get("/result/{document_id}", summary="Get M02 extraction result")
def get_result(
    document_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = (db.query(M02ExtractionResult)
           .filter_by(document_id=document_id)
           .order_by(M02ExtractionResult.created_at.desc())
           .first())
    if not row:
        raise HTTPException(status_code=404, detail="No M02 result found for this document.")
    if row.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    # Enrich document_type with display metadata
    from Orbisporte.domain.services.m02_extraction.document_type_detector import get_type_meta
    doc_type = row.document_type or "unknown"
    doc_meta = get_type_meta(doc_type)

    return {
        "result_id":                  row.id,
        "document_id":                row.document_id,
        "review_status":              row.review_status,
        "review_queue":               row.review_queue,
        "overall_confidence":         row.overall_confidence,
        "quality_alert":              row.quality_alert,
        "document_type":              doc_type,
        "document_type_display":      doc_meta["display_name"],
        "document_type_icon":         doc_meta["icon"],
        "document_type_color":        doc_meta["color"],
        "document_type_confidence":   row.document_type_confidence,
        "document_type_signals":      row.document_type_signals or [],
        "document_type_description":  doc_meta["description"],
        "normalised_fields":          row.normalised_fields,
        "extracted_fields":           row.extracted_fields,
        "confidence_scores":          row.confidence_scores,
        "fields_auto":                row.fields_auto,
        "fields_soft_review":         row.fields_soft_review,
        "fields_hard_review":         row.fields_hard_review,
        "fields_low":                 row.fields_low,
        "reviewed_fields":            row.reviewed_fields,
        "pipeline_duration_ms":       row.pipeline_duration_ms,
        "created_at":                 row.created_at.isoformat() if row.created_at else None,
    }


# ── Human review submission ───────────────────────────────────────────────────
class ReviewPayload(BaseModel):
    reviewed_fields: dict
    approved: bool = False


@router.patch("/review/{result_id}", summary="Submit human review corrections")
def submit_review(
    result_id: int,
    payload: ReviewPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(M02ExtractionResult).filter_by(id=result_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found.")
    if row.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    row.reviewed_fields = payload.reviewed_fields
    row.review_status   = "approved" if payload.approved else "in_review"
    row.reviewed_by     = current_user.id
    row.reviewed_at     = datetime.utcnow()
    db.commit()

    return {
        "result_id":     result_id,
        "review_status": row.review_status,
        "reviewed_at":   row.reviewed_at.isoformat(),
    }


# ── Queue listing ─────────────────────────────────────────────────────────────
@router.get("/queue/{queue_name}", summary="List documents in a review queue")
def list_queue(
    queue_name: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    valid_queues = {"auto", "soft_review", "hard_review", "quality_alert", "pending"}
    if queue_name not in valid_queues:
        raise HTTPException(status_code=400, detail=f"Invalid queue. Choose from: {valid_queues}")

    rows = (db.query(M02ExtractionResult)
            .filter_by(user_id=current_user.id, review_queue=queue_name)
            .order_by(M02ExtractionResult.created_at.desc())
            .limit(50)
            .all())

    return {
        "queue": queue_name,
        "count": len(rows),
        "items": [
            {
                "result_id":          r.id,
                "document_id":        r.document_id,
                "overall_confidence": r.overall_confidence,
                "review_status":      r.review_status,
                "quality_alert":      r.quality_alert,
                "created_at":         r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


# ── Confidence training ───────────────────────────────────────────────────────
@router.post("/train", summary="Train confidence calibration from approved reviews")
def train_confidence(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Reads all approved M02 reviews, computes per-field accuracy rates,
    and saves a calibration file used to adjust future confidence scores.
    Returns training stats including worst-performing fields.
    """
    from Orbisporte.domain.services.m02_extraction.confidence_trainer import train_from_reviews
    return train_from_reviews(db)


@router.get("/calibration", summary="View current confidence calibration")
def get_calibration(current_user=Depends(get_current_user)):
    """Return the current calibration stats (per-field accuracy rates)."""
    from Orbisporte.domain.services.m02_extraction.confidence_trainer import load_calibration
    cal = load_calibration()
    if not cal:
        return {"calibrated": False, "fields": 0, "calibration": {}}
    worst = sorted(cal.items(), key=lambda x: x[1]["accuracy"])[:10]
    best  = sorted(cal.items(), key=lambda x: x[1]["accuracy"], reverse=True)[:10]
    return {
        "calibrated":        True,
        "fields":            len(cal),
        "worst_fields":      [{"field": f, **v} for f, v in worst],
        "best_fields":       [{"field": f, **v} for f, v in best],
        "calibration":       cal,
    }
