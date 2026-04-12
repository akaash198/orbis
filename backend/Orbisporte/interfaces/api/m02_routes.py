"""
M02 Document Processing & Extraction API.

Endpoints
---------
  POST /m02/process/{document_id}   Run full M02 pipeline on uploaded document
  GET  /m02/result/{document_id}    Get M02 result for a document
  PATCH /m02/review/{result_id}     Submit human-reviewed field corrections
  GET  /m02/queue/{queue_name}      List documents in a review queue
"""

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Body, Query
from fastapi.responses import JSONResponse, Response
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
    fast_mode: bool = True  # Use fast extraction (optimized LangExtract + GPT-4o-mini)


@router.post("/process/{document_id}", summary="Run M02 extraction pipeline on a document")
async def process_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    body: ProcessRequest = Body(default=ProcessRequest()),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Triggers the M02 pipeline:
    GPT-4o-mini OCR/Text-layer OCR → Preprocessing → Field Extraction → Normalise → Confidence
    SLA mode applies adaptive page/time budgets targeting completion within ~15 seconds.
    
    Fast mode (default): Uses GPT-4o-mini + optimized LangExtract for structured extraction only,
    skips GLiNER and advanced scoring
    Full mode: Includes all pipeline stages (~3-5s)
    
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

    def _run(doc_id: int, result_id: int, file_path: str, document_type_hint: Optional[str], fast_mode: bool = True):
        from Orbisporte.core import SessionLocal
        inner_db = SessionLocal()
        try:
            svc = M02ExtractionService()
            output = svc.process(file_path, document_id=doc_id, document_type_hint=document_type_hint, fast_mode=fast_mode)

            # Auto-lookup HSN codes for products if no HSN code found
            normalised = output.get("normalised_fields", {})
            extracted = output.get("extracted_fields", {})
            fields = {**extracted, **normalised}
            
            current_hsn = fields.get("hsn_code") or fields.get("hs_code")
            
            if not current_hsn:
                # Get product descriptions to search for HSN
                product_descriptions = []
                
                # Check line items
                line_items = fields.get("line_items", [])
                if line_items and isinstance(line_items, list):
                    for item in line_items:
                        desc = (item.get("description") or item.get("goods_description") 
                              or item.get("product_description") or item.get("name"))
                        if desc:
                            product_descriptions.append({"description": desc, "item": item})
                
                # Check top-level fields
                top_desc = (fields.get("goods_description") or fields.get("product_description")
                          or fields.get("description") or fields.get("product"))
                if top_desc:
                    product_descriptions.append({"description": top_desc, "item": None})
                
                # Auto-lookup HSN for each product
                if product_descriptions:
                    try:
                        from Orbisporte.domain.services.hsn_search_service import search_hsn
                        
                        for prod in product_descriptions:
                            desc = prod["description"]
                            item = prod["item"]
                            
                            if desc and len(str(desc)) > 3:
                                logger.info(f"[M02] Auto-searching HSN for: {desc[:100]}")
                                hsn_result = search_hsn(desc, mode="fast")
                                
                                if hsn_result and hsn_result.get("selected_hsn"):
                                    found_hsn = hsn_result["selected_hsn"]
                                    logger.info(f"[M02] Found HSN {found_hsn} for: {desc[:50]}")
                                    
                                    if item is not None:
                                        # Update line item
                                        item["hsn_code"] = found_hsn
                                        item["hsn_source"] = "auto_lookup"
                                        item["hsn_confidence"] = hsn_result.get("confidence", 0.8)
                                    else:
                                        # Update top-level field
                                        output["normalised_fields"] = output.get("normalised_fields", {})
                                        output["normalised_fields"]["hsn_code"] = found_hsn
                                        output["normalised_fields"]["hsn_source"] = "auto_lookup"
                                        output["normalised_fields"]["hsn_confidence"] = hsn_result.get("confidence", 0.8)
                                    break  # Stop after finding first HSN
                    except Exception as hsn_err:
                        logger.warning(f"[M02] HSN auto-lookup failed: {hsn_err}")

            row = inner_db.query(M02ExtractionResult).filter_by(id=result_id).first()
            if row:
                row.document_type            = output.get("document_type")
                row.document_type_confidence = output.get("document_type_confidence")
                row.document_type_signals    = output.get("document_type_signals")
                row.ocr_text                 = output.get("ocr_text", "")[:50000]
                row.layout_blocks            = output.get("layout_blocks")
                row.raw_entities             = {
                    "gliner_entities": output.get("gliner_entities") or {},
                    "documents": output.get("documents") or [],
                    "document_types": output.get("document_types") or [],
                    "page_classifications": output.get("page_classifications") or [],
                }
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

    background_tasks.add_task(_run, document_id, result_id, doc.file_path, hint_type, body.fast_mode if body else True)

    return JSONResponse(status_code=202, content={
        "result_id":   result_id,
        "document_id": document_id,
        "status":      "processing",
        "fast_mode":   body.fast_mode if body else True,
        "message":     "M02 pipeline started. Poll /m02/result/{document_id} for updates.",
    })


# ── Synchronous extraction endpoint ──────────────────────────────────────────
@router.post("/extract/{document_id}", summary="Extract fields synchronously (returns result immediately)")
def extract_document_sync(
    document_id: int,
    fast_mode: bool = Query(True, description="Use fast mode for lower latency (recommended for UI)."),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Synchronous extraction that runs the M02 pipeline and returns results immediately.
    Use this endpoint when you need immediate results without polling.
    """
    import time
    import os
    t0 = time.time()
    
    doc = db.query(ProcessedDocument).filter_by(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    
    # Get file path - try multiple possible locations
    file_path = doc.file_path
    if not file_path:
        raise HTTPException(status_code=400, detail="Document file path not available.")
    
    # Check if file exists and try to find it
    if not os.path.exists(file_path):
        possible_paths = [
            file_path,
            os.path.join("uploads", os.path.basename(file_path)),
            os.path.join("data", "uploads", os.path.basename(file_path)),
            os.path.join("Orbisporte", "uploads", os.path.basename(file_path)),
            os.path.join("backend", "uploads", os.path.basename(file_path)),
            os.path.join("..", "uploads", os.path.basename(file_path)),
            os.path.join("..", "data", "uploads", os.path.basename(file_path)),
        ]
        found_path = None
        for p in possible_paths:
            if os.path.exists(p):
                found_path = p
                break
        if found_path:
            file_path = found_path
            logger.info(f"[SyncExtract] Found file at: {file_path}")
        else:
            logger.error(f"[SyncExtract] File not found. Searched in: {possible_paths}")
            raise HTTPException(status_code=400, detail=f"Document file not found on server: {doc.filename}")
    
    logger.info(f"[SyncExtract] Starting extraction for document {document_id}, file: {file_path}")
    
    try:
        from Orbisporte.domain.services.m02_extraction.m02_service import M02ExtractionService
        from Orbisporte.domain.services.m02_extraction.document_type_detector import get_type_meta
        
        svc = M02ExtractionService()

        # Keep synchronous extraction latency bounded for interactive UI flows.
        output = svc.process(file_path, document_id=document_id, fast_mode=fast_mode)
        
        # Log pipeline stages for debugging
        pipeline_stages = output.get("pipeline_stages", {})
        logger.info(f"[SyncExtract] Pipeline stages: {json.dumps(pipeline_stages, indent=2)[:1000]}")
        
        # Log what was extracted
        normalised = output.get("normalised_fields", {})
        extracted = output.get("extracted_fields", {})
        fields = {**extracted, **normalised}
        
        # Log individual fields for debugging
        extracted_field_names = [k for k, v in fields.items() if v is not None and str(v).strip() not in ("", "null", "none", "n/a")]
        logger.info(f"[SyncExtract] === EXTRACTION SUMMARY ===")
        logger.info(f"[SyncExtract] Document ID: {document_id}")
        logger.info(f"[SyncExtract] Document type: {output.get('document_type')}")
        logger.info(f"[SyncExtract] Document types found: {output.get('document_types', [])}")
        logger.info(f"[SyncExtract] OCR pages: {pipeline_stages.get('ocr', {}).get('page_count', 'N/A')}")
        logger.info(f"[SyncExtract] {len(extracted_field_names)} fields with values: {extracted_field_names}")
        
        # Log each field value for debugging
        for field_name in extracted_field_names:
            value = fields.get(field_name)
            logger.info(f"[SyncExtract]   {field_name}: {str(value)[:100]}")
        
        logger.info(f"[SyncExtract] Line items: {len(fields.get('line_items', []))}")
        logger.info(f"[SyncExtract] ========================")
        
        # Auto-lookup HSN if not found
        current_hsn = fields.get("hsn_code") or fields.get("hs_code")
        
        if not current_hsn:
            # Try to get product description for HSN search
            line_items = fields.get("line_items", [])
            product_desc = None
            
            if line_items and isinstance(line_items, list) and len(line_items) > 0:
                first_item = line_items[0]
                product_desc = (first_item.get("description") or first_item.get("goods_description") 
                              or first_item.get("product_description"))
            
            if not product_desc:
                product_desc = fields.get("goods_description") or fields.get("product_description")
            
            if product_desc:
                try:
                    from Orbisporte.domain.services.hsn_search_service import search_hsn
                    hsn_result = search_hsn(str(product_desc), mode="fast")
                    if hsn_result and hsn_result.get("selected_hsn"):
                        normalised["hsn_code"] = hsn_result["selected_hsn"]
                        normalised["hsn_source"] = "auto_lookup"
                        fields["hsn_code"] = hsn_result["selected_hsn"]
                        logger.info(f"[SyncExtract] Auto-found HSN: {hsn_result['selected_hsn']}")
                except Exception as hsn_err:
                    logger.warning(f"[SyncExtract] HSN auto-lookup failed: {hsn_err}")
        
        # Get document type metadata
        doc_type = output.get("document_type", "unknown")
        doc_meta = get_type_meta(doc_type)
        
        # Save to database
        m02 = M02ExtractionResult(
            document_id=document_id,
            user_id=current_user.id,
            document_type=doc_type,
            document_type_confidence=output.get("document_type_confidence"),
            extracted_fields=extracted,
            normalised_fields=normalised,
            confidence_scores=output.get("confidence_scores"),
            overall_confidence=output.get("overall_confidence"),
            review_status="completed",
            review_queue=output.get("review_queue", "auto"),
        )
        db.add(m02)
        db.commit()
        
        duration = time.time() - t0
        logger.info(f"[SyncExtract] Completed in {duration:.2f}s - {len(normalised)} fields extracted")
        
        return {
            "result_id": m02.id,
            "document_id": document_id,
            "review_status": "completed",
            "review_queue": "auto",
            "overall_confidence": output.get("overall_confidence"),
            "document_type": doc_type,
            "document_type_display": doc_meta["display_name"],
            "document_type_icon": doc_meta["icon"],
            "document_type_color": doc_meta["color"],
            "document_type_confidence": output.get("document_type_confidence"),
            "document_type_signals": output.get("document_type_signals", []),
            "normalised_fields": normalised,
            "extracted_fields": extracted,
            "fields": fields,  # Combined fields for convenience
            "documents": output.get("documents", []),
            "document_types": output.get("document_types", []),
            "page_classifications": output.get("page_classifications", []),
            "pipeline_stages": output.get("pipeline_stages", {}),
            "processing_time_seconds": round(duration, 2),
        }
        
    except Exception as exc:
        logger.exception(f"[SyncExtract] Failed for document {document_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(exc)}")


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
        "document_type_signals":     row.document_type_signals or [],
        "document_type_description":  doc_meta["description"],
        "normalised_fields":          row.normalised_fields,
        "extracted_fields":           row.extracted_fields,
        "documents":                  ((row.raw_entities or {}).get("documents") if isinstance(row.raw_entities, dict) else []),
        "document_types":             ((row.raw_entities or {}).get("document_types") if isinstance(row.raw_entities, dict) else []),
        "page_classifications":       ((row.raw_entities or {}).get("page_classifications") if isinstance(row.raw_entities, dict) else []),
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


# ── KEY_FIELDS: all essential fields extracted from trade documents ───────────
_KEY_FIELDS = [
    "invoice_number", "invoice_date", "exporter_name", "exporter_address",
    "importer_name", "importer_address", "gst_number", "iec_number",
    "shipment_address", "port_of_loading", "port_of_discharge",
    "hsn_code", "goods_description", "quantity", "unit",
    "unit_price", "currency", "total_value", "freight", "insurance",
    "cif_value", "country_of_origin", "incoterms", "payment_terms",
    "bill_of_lading_number", "awb_number", "shipment_date",
]


@router.get("/export/{document_id}", summary="Download extracted fields as JSON")
def export_extracted_json(
    document_id: int,
    key_fields_only: bool = Query(False, description="Return only the 12 key fields instead of all fields"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns a clean, downloadable JSON file containing the normalised extraction
    result for the specified document.

    By default all extracted fields are included.  Set ?key_fields_only=true to
    limit the output to the 12 essential customs fields.
    """
    row = (
        db.query(M02ExtractionResult)
        .filter_by(document_id=document_id)
        .order_by(M02ExtractionResult.created_at.desc())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No M02 result found for this document.")
    if row.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    if row.review_status in ("processing", "error"):
        raise HTTPException(status_code=409, detail="Extraction is not complete yet.")

    # Use reviewed_fields if human has corrected them, otherwise normalised
    fields = dict(row.reviewed_fields or row.normalised_fields or row.extracted_fields or {})

    if key_fields_only:
        fields = {k: fields.get(k) for k in _KEY_FIELDS}

    doc = db.query(ProcessedDocument).filter_by(id=document_id).first()

    export_payload = {
        "document_id":        document_id,
        "filename":           doc.original_filename or doc.filename if doc else None,
        "document_type":      row.document_type,
        "review_status":      row.review_status,
        "extracted_at":       row.created_at.isoformat() if row.created_at else None,
        "extracted_fields":   fields,
    }

    filename = f"m02_extraction_{document_id}.json"
    return Response(
        content=json.dumps(export_payload, indent=2, ensure_ascii=False, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/documents", summary="List documents with M02 results for the current user")
def list_m02_documents(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = Query(50, le=200),
):
    """
    Return the user's processed documents joined with their latest M02 result.
    Used by the frontend document selector.
    """
    from sqlalchemy import func

    # Latest M02 result per document
    subq = (
        db.query(
            M02ExtractionResult.document_id,
            func.max(M02ExtractionResult.id).label("latest_id"),
        )
        .filter_by(user_id=current_user.id)
        .group_by(M02ExtractionResult.document_id)
        .subquery()
    )

    rows = (
        db.query(ProcessedDocument, M02ExtractionResult)
        .outerjoin(subq, ProcessedDocument.id == subq.c.document_id)
        .outerjoin(M02ExtractionResult, M02ExtractionResult.id == subq.c.latest_id)
        .filter(ProcessedDocument.user_id == current_user.id)
        .order_by(ProcessedDocument.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for doc, m02 in rows:
        result.append({
            "document_id":        doc.id,
            "filename":           doc.original_filename or doc.filename,
            "file_type":          doc.file_type,
            "processing_status":  doc.processing_status,
            "created_at":         doc.created_at.isoformat() if doc.created_at else None,
            "m02": {
                "result_id":        m02.id            if m02 else None,
                "review_status":    m02.review_status if m02 else None,
                "overall_confidence": m02.overall_confidence if m02 else None,
                "document_type":    m02.document_type if m02 else None,
                "review_queue":     m02.review_queue  if m02 else None,
                "has_result":       m02 is not None,
            } if m02 else {"has_result": False},
        })
    return {"documents": result, "total": len(result)}
