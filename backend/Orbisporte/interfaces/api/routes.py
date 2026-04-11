import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Header, BackgroundTasks, Body, Form, Query

logger = logging.getLogger(__name__)
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Dict, Any
import re
import os
from pathlib import Path
from datetime import datetime
from werkzeug.utils import secure_filename

from Orbisporte.infrastructure.db import get_db, UserRepository, DocumentRepository
from Orbisporte.infrastructure.file_storage import FileStorage
from Orbisporte.interfaces.api.schemas import (
    LoginRequest, SignupRequest, TokenResponse, RefreshTokenRequest,
    DocumentUploadResponse, DocumentResponse, DocumentListItemResponse, UserResponse,
    HSCodeLookupRequest, HSCodeLookupResponse,
    GSTValidationRequest, GSTValidationResponse,
    IECValidationRequest, IECValidationResponse
)
from Orbisporte.interfaces.api.auth import (
    login_user, signup_user, refresh_access_token, logout_user, verify_token
)

# Import AI services from domain
from Orbisporte.domain.services.doc_classification import DocumentClassificationService
from Orbisporte.domain.services.doc_extraction import DocumentExtractionService
from Orbisporte.domain.services.Q_A import QAService
from Orbisporte.domain.services.simple_hscode_lookup import SimpleHSCodeLookup
from Orbisporte.domain.services.hsn_search_service import search_hsn
from Orbisporte.domain.services.validation import ValidationService

router = APIRouter()
file_storage = FileStorage()


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Dependency to get current authenticated user"""
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

    user_id = int(payload.get("sub"))
    user = UserRepository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# Health check
@router.get("/health")
def health_check():
    return {"status": "ok", "service": "orbisporte-api"}


@router.get("/react/health")
def react_health():
    return {"status": "ok", "service": "orbisporte-react-api"}


# Authentication endpoints
@router.post("/react/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """User login endpoint"""
    result = login_user(db, request.user_name, request.password)

    if not result:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return result


@router.post("/react/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """User signup endpoint"""
    user_data = request.dict()
    result = signup_user(db, **user_data)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/react/refresh-token")
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh access token"""
    result = refresh_access_token(db, request.refresh_token)

    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    return result


@router.post("/react/logout")
def logout(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Logout user"""
    logout_user(db, request.refresh_token)
    return {"message": "Logged out successfully"}


@router.get("/react/validate-token")
def validate_token(current_user=Depends(get_current_user)):
    """Validate current token and return user info"""
    return {
        "valid": True,
        "user": {
            "id": current_user.id,
            "user_name": current_user.user_name,
            "email_id": current_user.email_id,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "role": current_user.role
        }
    }


# Document endpoints
@router.post("/react/check-duplicate")
async def check_duplicate(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if a document with the same content hash already exists for this user."""
    from Orbisporte.domain.models import ProcessedDocument

    content_hash = payload.get("content_hash")
    if not content_hash:
        return {"exists": False, "existing_file": None}

    existing_doc = (
        db.query(ProcessedDocument)
        .filter(
            ProcessedDocument.user_id == current_user.id,
            ProcessedDocument.content_hash == content_hash,
        )
        .order_by(ProcessedDocument.created_at.desc())
        .first()
    )

    if not existing_doc:
        return {"exists": False, "existing_file": None}

    # Also fetch the latest M02 result for this document (if any).
    # Wrapped in try/except so a schema mismatch on m02_extraction_results
    # (e.g. a missing column before a migration is applied) doesn't crash
    # the duplicate-check endpoint.
    m02_result = None
    try:
        from Orbisporte.domain.models import M02ExtractionResult
        m02_result = (
            db.query(M02ExtractionResult)
            .filter(
                M02ExtractionResult.document_id == existing_doc.id,
                M02ExtractionResult.review_status != "processing",
                M02ExtractionResult.review_status != "error",
            )
            .order_by(M02ExtractionResult.created_at.desc())
            .first()
        )
    except Exception:
        db.rollback()  # clear the poisoned transaction so subsequent queries work

    # Use M02 normalised_fields as extracted_data if available
    extracted_data = (
        m02_result.normalised_fields
        if m02_result and m02_result.normalised_fields
        else existing_doc.extracted_data
    )

    return {
        "exists": True,
        "existing_file": {
            "id": existing_doc.id,
            "document_id": existing_doc.id,
            "filename": existing_doc.filename,
            "file_path": existing_doc.file_path,
            "extracted_data": extracted_data,
            "classification": existing_doc.doc_type,
            "document_type": existing_doc.doc_type,
            "uploaded_at": existing_doc.created_at.isoformat() if existing_doc.created_at else None,
        },
    }

@router.post("/react/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    content_hash: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document"""
    # Read file content
    content = await file.read()

    # Save file (computes binary SHA-256 for storage naming)
    file_info = file_storage.save_file(content, file.filename, current_user.id)

    # Prefer the frontend's content_hash (text-based for PDFs) over the binary hash.
    # The frontend sends the same hash it uses for check-duplicate, so they match.
    stored_hash = content_hash if content_hash else file_info["content_hash"]

    # Create document record
    document = DocumentRepository.create_document(
        db,
        user_id=current_user.id,
        company_id=current_user.company_id,
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        file_path=file_info["file_path"],
        file_type=file_info["file_type"],
        content_hash=stored_hash,
        processing_status="uploaded"
    )

    # Convert to dict and add document_id alias for frontend compatibility
    response = {
        "id": document.id,
        "document_id": document.id,  # Alias for frontend
        "filename": document.filename,
        "file_path": document.file_path,
        "doc_type": document.doc_type,
        "processing_status": document.processing_status,
        "created_at": document.created_at
    }

    return response


@router.get("/react/documents", response_model=List[DocumentResponse])
def get_documents(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents for current user"""
    documents = DocumentRepository.get_user_documents(db, current_user.id)
    return documents


@router.get("/react/documents/list", response_model=List[DocumentListItemResponse])
def get_documents_list(
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lightweight list endpoint for table/recent-document views.
    Excludes heavy extracted_data payload to keep UI responsive.
    """
    from Orbisporte.domain.models import ProcessedDocument

    rows = (
        db.query(
            ProcessedDocument.id,
            ProcessedDocument.filename,
            ProcessedDocument.original_filename,
            ProcessedDocument.file_path,
            ProcessedDocument.file_type,
            ProcessedDocument.doc_type,
            ProcessedDocument.classification_confidence,
            ProcessedDocument.hs_code,
            ProcessedDocument.processing_status,
            ProcessedDocument.created_at,
            ProcessedDocument.content_hash,
            ProcessedDocument.extracted_data.isnot(None).label("has_extracted_data"),
        )
        .filter(ProcessedDocument.user_id == current_user.id)
        .order_by(ProcessedDocument.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": row.id,
            "filename": row.filename,
            "original_filename": row.original_filename,
            "file_path": row.file_path,
            "file_type": row.file_type,
            "doc_type": row.doc_type,
            "classification_confidence": row.classification_confidence,
            "has_extracted_data": bool(row.has_extracted_data),
            "hs_code": row.hs_code,
            "processing_status": row.processing_status,
            "created_at": row.created_at,
            "content_hash": row.content_hash,
        }
        for row in rows
    ]


@router.get("/react/documents/processed-invoices")
def get_processed_invoices(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get only documents that have been processed with duty calculations (ready for BoE creation)"""
    from Orbisporte.domain.models import ProcessedDocument

    # Get documents that have extracted_data with duty_summary
    documents = db.query(ProcessedDocument).filter(
        ProcessedDocument.user_id == current_user.id,
        ProcessedDocument.extracted_data.isnot(None)
    ).order_by(ProcessedDocument.created_at.desc()).all()

    # Filter to only those with duty_summary (fully processed invoices)
    processed_invoices = []
    for doc in documents:
        if doc.extracted_data and isinstance(doc.extracted_data, dict):
            if "duty_summary" in doc.extracted_data or "summary" in doc.extracted_data:
                processed_invoices.append({
                    "id": doc.id,
                    "document_id": doc.id,
                    "original_filename": doc.original_filename,
                    "filename": doc.filename,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                    "doc_type": doc.doc_type,
                    "processing_status": doc.processing_status
                })

    print(f"[API] 📋 Found {len(processed_invoices)} processed invoices for user {current_user.id}")
    return processed_invoices


@router.get("/react/documents/summary")
def get_documents_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary statistics about the user's documents"""
    documents = DocumentRepository.get_user_documents(db, current_user.id)
    total = len(documents)
    processed = len([d for d in documents if d.processing_status in ["extracted", "completed"]])
    return {
        "total_documents": total,
        "processed_documents": processed,
        "pending_documents": total - processed,
        "has_documents": total > 0,
    }


@router.post("/react/documents/validate-context")
async def validate_document_context(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check whether the user has documents available for RAG context"""
    from Orbisporte.domain.models import ProcessedDocument

    count = (
        db.query(ProcessedDocument)
        .filter(ProcessedDocument.user_id == current_user.id)
        .count()
    )
    return {"has_context": count > 0, "document_count": count}


@router.get("/react/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific document"""
    document = DocumentRepository.get_by_id(db, document_id)

    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


@router.get("/react/documents/{document_id}/preview")
def get_document_preview(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a base64 data URL for a document so the UI can render inline preview."""
    from base64 import b64encode
    from mimetypes import guess_type

    document = DocumentRepository.get_by_id(db, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = str(document.file_path or "").strip()
    if not file_path:
        raise HTTPException(status_code=404, detail="Document file path is missing")

    abs_path = Path(file_path).resolve()
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Document file not found on disk")

    try:
        file_bytes = abs_path.read_bytes()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read document file: {exc}")

    mime_type = document.file_type or guess_type(str(abs_path))[0] or "application/octet-stream"
    data_url = f"data:{mime_type};base64,{b64encode(file_bytes).decode('ascii')}"

    return JSONResponse(
        {
            "document_id": document.id,
            "filename": document.original_filename or document.filename,
            "content_type": mime_type,
            "size_bytes": len(file_bytes),
            "data_url": data_url,
        }
    )


@router.post("/react/classify")
async def classify_document(payload: Dict[str, Any] = Body(...)):
    """Classify document type using AI"""
    try:
        file_path = payload.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail="file_path is missing or invalid")

        svc = DocumentClassificationService()
        details = svc.classify_document_with_details(file_path)
        return details
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@router.post("/react/extract")
async def extract_data(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    """Extract structured data from document using AI"""
    try:
        file_path = payload.get("file_path")
        classification = payload.get("classification") or {}
        filename = payload.get("filename", "unknown")
        extract_barcodes = payload.get("extract_barcodes", False)

        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is missing or invalid")

        doc_type = classification.get("document_type", "unknown") if isinstance(classification, dict) else "unknown"

        svc = DocumentExtractionService()
        extracted_data = svc.extract_data(file_path, doc_type, classification, extract_barcodes=extract_barcodes)

        return {"data": extracted_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/react/extract-fast")
async def extract_data_fast(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    """Extract structured data using a pre-known document type (skips classification step)"""
    try:
        file_path = payload.get("file_path")
        document_type = payload.get("document_type", "unknown")
        filename = payload.get("filename", "unknown")
        extract_barcodes = payload.get("extract_barcodes", False)

        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")

        classification = {"document_type": document_type, "confidence": 1.0}
        start_time = datetime.now()
        svc = DocumentExtractionService()
        extracted_data = svc.extract_data(file_path, document_type, classification, extract_barcodes=extract_barcodes)
        processing_time = (datetime.now() - start_time).total_seconds()

        return {
            "data": extracted_data,
            "processing_time": processing_time,
            "document_type": document_type,
            "filename": filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fast extraction failed: {str(e)}")


@router.post("/react/extract-essential")
async def extract_essential_fields(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Extract ONLY essential document fields without any confidence scores or metadata.
    Returns a clean JSON with just the document type, fields, and line items.

    Essential fields: invoice_number, invoice_date, exporter_name, importer_name,
    gst_number, shipment_address, hsn_code, quantity, unit_price, total_value,
    country_of_origin, freight, insurance, etc.
    
    Accepts either file_path (direct upload) or document_id (from registry).
    """
    from Orbisporte.domain.services.m02_extraction import M02ExtractionService
    from Orbisporte.domain.models import ProcessedDocument, M02ExtractionResult

    try:
        file_path = payload.get("file_path")
        document_id = payload.get("document_id")

        if not file_path and not document_id:
            raise HTTPException(status_code=400, detail="Either file_path or document_id is required")

        # If document_id is provided, get the file path from the registry
        if not file_path and document_id:
            doc = db.query(ProcessedDocument).filter(
                ProcessedDocument.id == document_id,
                ProcessedDocument.user_id == current_user.id
            ).first()
            
            if not doc:
                raise HTTPException(status_code=404, detail="Document not found")
            
            # Use the raw lake path as the file path
            if doc.raw_lake_path:
                file_path = doc.raw_lake_path
            elif hasattr(doc, 'file_path') and doc.file_path:
                file_path = doc.file_path
            else:
                raise HTTPException(status_code=400, detail="Document file path not available")

        if not file_path:
            raise HTTPException(status_code=400, detail="Could not locate document file")

        # Use configured provider with built-in fallback logic for best reliability.
        svc = M02ExtractionService()
        result = svc.extract_essential(file_path, document_id)

        return {"data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[Essential Extraction] Failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Essential extraction failed: {str(e)}")


@router.post("/react/rescan")
async def rescan_document(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Re-run extraction on a previously uploaded document and update the stored record"""
    from Orbisporte.domain.models import ProcessedDocument

    try:
        content_hash = payload.get("content_hash")
        file_path = payload.get("file_path")
        filename = payload.get("filename", "unknown")
        extract_barcodes = payload.get("extract_barcodes", False)

        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")

        # Look up the stored document
        doc = None
        if content_hash:
            doc = (
                db.query(ProcessedDocument)
                .filter(
                    ProcessedDocument.user_id == current_user.id,
                    ProcessedDocument.content_hash == content_hash,
                )
                .order_by(ProcessedDocument.created_at.desc())
                .first()
            )

        doc_type = doc.doc_type if doc else "unknown"
        classification = {"document_type": doc_type, "confidence": 1.0}

        svc = DocumentExtractionService()
        extracted_data = svc.extract_data(file_path, doc_type, classification, extract_barcodes=extract_barcodes)

        # Persist updated extraction
        if doc:
            doc.extracted_data = extracted_data
            doc.processing_status = "extracted"
            db.commit()

        return {
            "message": "Rescan completed successfully",
            "data": extracted_data,
            "document_id": doc.id if doc else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rescan failed: {str(e)}")


@router.post("/react/enhance-hscode")
async def enhance_with_hscode(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    """Enhance extracted document data by auto-classifying missing HS codes on line items"""
    try:
        extracted_data = payload.get("extracted_data", {})
        if not extracted_data:
            raise HTTPException(status_code=400, detail="extracted_data is required")

        hsn_service = _get_hsn_service()
        line_items = extracted_data.get("line_items", [])
        items_enhanced = 0

        for item in line_items:
            if not item.get("hsn_code") and item.get("description"):
                try:
                    result = hsn_service.classify(product_description=item["description"])
                    if result.get("selected_hsn"):
                        item["hsn_code"] = result["selected_hsn"]
                        item["hsn_confidence"] = result.get("selected_confidence")
                        items_enhanced += 1
                except Exception:
                    pass

        return {
            "enhanced_data": {**extracted_data, "line_items": line_items},
            "items_enhanced": items_enhanced,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HSN enhancement failed: {str(e)}")


@router.post("/react/chat")
async def chat_endpoint(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """RAG-style chat: answer questions using the user's most recent document as context"""
    from Orbisporte.domain.models import ProcessedDocument

    try:
        question = payload.get("question", "")
        if not question:
            raise HTTPException(status_code=400, detail="question is required")

        doc = (
            db.query(ProcessedDocument)
            .filter(
                ProcessedDocument.user_id == current_user.id,
                ProcessedDocument.file_path.isnot(None),
            )
            .order_by(ProcessedDocument.created_at.desc())
            .first()
        )

        if doc and doc.file_path and os.path.exists(doc.file_path):
            svc = QAService()
            answer = svc.answer_question(doc.file_path, question)
            source = doc.filename
        else:
            answer = "No documents found in your account. Please upload a document first."
            source = None

        return {"answer": answer, "sources": [], "document_used": source}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ── Customs Declaration stubs (full integration via BoE module) ───────────────

@router.post("/customs/generate-declaration")
async def generate_customs_declaration_stub(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    return {"message": "Use /react/boe/create-from-invoice for BoE generation", "status": "redirect"}


@router.post("/customs/generate-from-documents")
async def generate_declaration_from_docs(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a customs declaration from a list of document IDs"""
    document_ids = payload.get("document_ids", [])
    if not document_ids:
        raise HTTPException(status_code=400, detail="document_ids is required")
    return {
        "message": f"Declaration requested for {len(document_ids)} document(s). Use /react/boe/create-from-invoice for full BoE.",
        "document_ids": document_ids,
        "status": "accepted",
    }


@router.post("/customs/generate-from-session")
async def generate_declaration_from_session(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    documents = payload.get("documents", [])
    return {
        "message": f"Session declaration for {len(documents)} document(s) — use BoE module for production filing.",
        "status": "accepted",
    }


@router.post("/customs/validate")
async def validate_customs_declaration(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    return {"valid": True, "errors": [], "warnings": []}


@router.post("/customs/export")
async def export_customs_declaration(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
):
    return {"message": "Export feature — use /react/boe/{boe_id}/export for BoE export", "status": "redirect"}


@router.patch("/react/documents/{document_id}")
def update_document(
    document_id: int,
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Partial update for a document — currently supports hs_code and hs_code_description.
    Also propagates hsn_code into the latest M02ExtractionResult.normalised_fields so that
    the manually confirmed HSN is used consistently everywhere.
    """
    from Orbisporte.domain.models import ProcessedDocument, M02ExtractionResult

    doc = db.query(ProcessedDocument).filter_by(id=document_id, user_id=current_user.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    updated = False

    if "hs_code" in payload:
        hsn = str(payload["hs_code"]).strip() if payload["hs_code"] else None
        doc.hs_code = hsn
        if "hs_code_description" in payload:
            doc.hs_code_description = payload["hs_code_description"]
        # Propagate into the latest M02 normalised_fields so the preview reflects it
        if hsn:
            m02 = (
                db.query(M02ExtractionResult)
                .filter(
                    M02ExtractionResult.document_id == document_id,
                    M02ExtractionResult.review_status != "processing",
                    M02ExtractionResult.review_status != "error",
                )
                .order_by(M02ExtractionResult.created_at.desc())
                .first()
            )
            if m02:
                nf = dict(m02.normalised_fields or {})
                nf["hsn_code"] = hsn
                m02.normalised_fields = nf
        updated = True

    if "notes" in payload:
        # Store notes in extracted_data to avoid a schema migration
        extracted = dict(doc.extracted_data or {})
        extracted["_notes"] = payload["notes"]
        doc.extracted_data = extracted
        updated = True

    if not updated:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    db.commit()
    return {"status": "ok", "document_id": document_id, "hs_code": doc.hs_code}


@router.delete("/react/documents/{document_id}")
def delete_document(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document"""
    document = DocumentRepository.get_by_id(db, document_id)

    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from storage
    file_storage.delete_file(document.file_path)

    # Also delete linked M02 results
    from Orbisporte.domain.models import M02ExtractionResult
    db.query(M02ExtractionResult).filter_by(document_id=document_id).delete()

    # Remove the matching DocumentRegistry entry (if adopted from DataIntake)
    from Orbisporte.domain.models import DocumentRegistry, IntakeEventLog
    if document.content_hash:
        reg = db.query(DocumentRegistry).filter_by(
            content_hash=document.content_hash, user_id=current_user.id
        ).first()
        if reg:
            db.query(IntakeEventLog).filter_by(document_id=reg.document_id).delete()
            db.delete(reg)

    # Delete from database
    DocumentRepository.delete_document(db, document_id)

    return {"message": "Document deleted from document management and registry."}


# ── HSN Classification Engine (LangGraph singleton) ───────────────────────────
_hsn_service = None

def _get_hsn_service():
    global _hsn_service
    if _hsn_service is None:
        from Orbisporte.domain.services.m03_classification import M03ClassificationService
        _hsn_service = M03ClassificationService()
    return _hsn_service


# Indian Customs specific endpoints
@router.post("/react/hscode")
async def hscode_lookup(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user)
):
    """
    HSN Classification Engine — Fast PostgreSQL FTS by default.
    
    Fast Mode (<100ms): PostgreSQL FTS + ILIKE keyword matching
    Detailed Mode (2-5s): PostgreSQL FTS → OpenAI embed → GPT-4o-mini GRI reasoning
    
    Set use_agentic=true for detailed GPT-4o-mini reasoning.
    """
    try:
        product_description = payload.get("product_description", "")
        if not product_description:
            raise HTTPException(status_code=400, detail="product_description is required")

        use_agentic = payload.get("use_agentic", False)
        
        # Use optimized HSN search service
        from Orbisporte.domain.services.hsn_search_service import classify_hsn
        result = classify_hsn(
            product_description=product_description,
            country_of_origin=payload.get("country_of_origin"),
            use_agentic=use_agentic,
        )

        if result.get("error") and not result.get("selected_hsn"):
            raise HTTPException(status_code=500, detail=result["error"])

        # Backward-compat fields for DutyCalculatorPanel
        result["top_result"] = {"hsn_code": result.get("selected_hsn"), "similarity": result.get("selected_confidence", 0)} if result.get("selected_hsn") else None
        result["hs_code"]    = result.get("selected_hsn")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[hscode_lookup] HSN search failed: %s", e)
        raise HTTPException(status_code=500, detail=f"HSN classification failed: {str(e)}")


@router.post("/react/qa")
async def qa_endpoint(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Answer questions about documents using AI. file_path is optional; if omitted the most recent document is used."""
    try:
        from Orbisporte.domain.models import ProcessedDocument

        question = payload.get("question", "")
        file_path = payload.get("file_path")

        if not question:
            raise HTTPException(status_code=400, detail="question is required")

        # If no file_path supplied, fall back to the user's most recent document
        if not file_path or not os.path.exists(file_path):
            doc = (
                db.query(ProcessedDocument)
                .filter(
                    ProcessedDocument.user_id == current_user.id,
                    ProcessedDocument.file_path.isnot(None),
                )
                .order_by(ProcessedDocument.created_at.desc())
                .first()
            )
            if doc and doc.file_path and os.path.exists(doc.file_path):
                file_path = doc.file_path
            else:
                return {"answer": "No documents found. Please upload a document first.", "source": None}

        svc = QAService()
        answer = svc.answer_question(file_path, question)
        return {"answer": answer}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Q&A failed: {str(e)}")


@router.post("/react/validate-gst", response_model=GSTValidationResponse)
def validate_gst(request: GSTValidationRequest, current_user=Depends(get_current_user)):
    """Validate GST number"""
    gst = request.gst_number.upper().strip()

    # GST format: 22AAAAA0000A1Z5 (15 characters)
    gst_pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'

    if len(gst) != 15:
        return {
            "valid": False,
            "gst_number": gst,
            "message": "GST number must be 15 characters long"
        }

    if not re.match(gst_pattern, gst):
        return {
            "valid": False,
            "gst_number": gst,
            "message": "Invalid GST number format"
        }

    return {
        "valid": True,
        "gst_number": gst,
        "message": "Valid GST number format"
    }


@router.post("/react/validate-iec", response_model=IECValidationResponse)
def validate_iec(request: IECValidationRequest, current_user=Depends(get_current_user)):
    """Validate IEC number"""
    iec = request.iec_number.strip()

    # IEC format: 10 digit numeric code
    if len(iec) != 10:
        return {
            "valid": False,
            "iec_number": iec,
            "message": "IEC number must be 10 digits long"
        }

    if not iec.isdigit():
        return {
            "valid": False,
            "iec_number": iec,
            "message": "IEC number must contain only digits"
        }

    return {
        "valid": True,
        "iec_number": iec,
        "message": "Valid IEC number format"
    }


@router.post("/react/generate-customs-declaration")
def generate_customs_declaration(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate ICEGATE customs declaration (placeholder)"""
    document = DocumentRepository.get_by_id(db, document_id)

    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "declaration_type": "Bill of Entry",
        "icegate_format": "Generated",
        "message": "Customs declaration generated successfully (placeholder)"
    }


# Dashboard endpoint
@router.get("/react/dashboard/stats")
def get_dashboard_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics"""
    documents = DocumentRepository.get_user_documents(db, current_user.id)

    total_documents = len(documents)
    processed_documents = len([d for d in documents if d.processing_status in ["extracted", "completed"]])

    return {
        "total_documents": total_documents,
        "processed_documents": processed_documents,
        "hscode_lookups": 0,
        "customs_declarations": 0
    }


# ============================================================================
# MODULE 5: DUTY CALCULATOR ENDPOINTS (OrbisPorté)
# ============================================================================

@router.post("/react/duty/calculate")
async def calculate_duty(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate customs duties for an import

    Payload:
        hsn_code: HSN code (required)
        cif_value: CIF value in INR (required)
        port_code: Port code (optional)
        country_of_origin: ISO 3-letter code (optional)
        quantity: Quantity (optional)
        unit: Unit of measurement (optional)

    Returns:
        - All duty components (BCD, CESS, IGST, SWS, etc.)
        - Assessable value
        - Total duty
        - Formula breakdown
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        from Orbisporte.domain.services.duty_calculator import DutyCalculator

        hsn_code = payload.get("hsn_code")
        cif_value = payload.get("cif_value")

        if not hsn_code:
            raise HTTPException(status_code=400, detail="hsn_code is required")
        if not cif_value:
            raise HTTPException(status_code=400, detail="cif_value is required")

        # Optional parameters
        port_code = payload.get("port_code")
        country_of_origin = payload.get("country_of_origin")
        quantity = payload.get("quantity")
        unit = payload.get("unit")
        document_id = payload.get("document_id")

        logger.info(f"Calculating duty for HSN {hsn_code}, CIF ₹{cif_value} (user: {current_user.id})")

        calculator = DutyCalculator(db)
        result = calculator.calculate_duty(
            hsn_code=hsn_code,
            cif_value=cif_value,
            port_code=port_code,
            country_of_origin=country_of_origin,
            quantity=quantity,
            unit=unit,
            user_id=current_user.id,
            document_id=document_id
        )

        logger.info(f"Duty calculation successful: Total duty ₹{result.get('total_duty', 0)}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Duty calculation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Duty calculation failed: {str(e)}")


@router.get("/react/duty/rates/{hsn_code}")
async def get_duty_rates(
    hsn_code: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    port_code: Optional[str] = None,
    country_of_origin: Optional[str] = None
):
    """
    Get duty rates for a specific HSN code

    Returns:
        Dict of duty types and their rates
        Example: {'BCD': 10.0, 'IGST': 18.0}
    """
    try:
        from Orbisporte.domain.services.duty_calculator import DutyCalculator

        calculator = DutyCalculator(db)
        rates = calculator.get_duty_rates(
            hsn_code=hsn_code,
            port_code=port_code,
            country_of_origin=country_of_origin
        )

        if not rates:
            raise HTTPException(status_code=404, detail=f"No duty rates found for HSN {hsn_code}")

        # Convert Decimal to float for JSON serialization
        rates_float = {k: float(v) for k, v in rates.items()}

        return {
            "hsn_code": hsn_code,
            "rates": rates_float,
            "port_code": port_code,
            "country_of_origin": country_of_origin
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch duty rates: {str(e)}")


# ============================================================================
# MODULE: INVOICE-TO-DUTY INTEGRATION (Week 1 - OrbisPorté Roadmap)
# ============================================================================

@router.post("/react/invoice/process-complete")
async def process_invoice_complete(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete end-to-end invoice processing: Extract → Classify HSN → Calculate Duties

    Payload:
        file_path: Path to uploaded invoice file (required)
        document_id: Document ID if already uploaded (optional)
        auto_classify_hsn: Auto-classify missing HSN codes (default: true)
        port_code: Port of import (optional)
        country_of_origin: ISO 3-letter country code (optional)

    Returns:
        Complete results with extraction, HSN classification, and duty calculations for all line items
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        from Orbisporte.domain.services.invoice_duty_integration import InvoiceDutyIntegrationService

        print(f"[API] 📦 Received payload: {payload}")

        file_path = payload.get("file_path")
        if not file_path:
            raise HTTPException(status_code=400, detail="file_path is required")

        document_id = payload.get("document_id")
        print(f"[API] 🔍 Extracted document_id from payload: {document_id} (type: {type(document_id)})")

        auto_classify_hsn = payload.get("auto_classify_hsn", True)
        port_code = payload.get("port_code")
        country_of_origin = payload.get("country_of_origin")

        logger.info(f"[API] Processing invoice: {file_path} (user: {current_user.id})")

        service = InvoiceDutyIntegrationService(db)
        result = service.process_invoice_complete(
            file_path=file_path,
            user_id=current_user.id,
            document_id=document_id,
            auto_classify_hsn=auto_classify_hsn,
            port_code=port_code,
            country_of_origin=country_of_origin
        )

        if not result.get("success"):
            error_msg = result.get("error", "Unknown error")
            logger.error(f"[API] Invoice processing failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

        # Save results to database for later retrieval (e.g., for BoE creation)
        print(f"[API] 🔍 Checking if should save results - document_id: {document_id}")
        if document_id:
            from Orbisporte.infrastructure.db import DocumentRepository
            print(f"[API] 🔍 Retrieving document {document_id} from database...")
            document = DocumentRepository.get_by_id(db, document_id)
            if document:
                print(f"[API] ✅ Document found, saving results...")
                # Store the complete result including duty calculations
                document.extracted_data = {
                    "invoice_data": result.get("invoice_data", {}),
                    "line_items": result.get("items", []),
                    "summary": result.get("summary", {}),
                    "duty_summary": result  # Store complete result for BoE creation
                }
                db.commit()
                print(f"[API] 💾 Saved invoice processing results to database for document {document_id}")
            else:
                print(f"[API] ⚠️ Document {document_id} not found in database!")
        else:
            print(f"[API] ⚠️ No document_id provided, results not saved to database")

        logger.info(f"[API] ✅ Invoice processed successfully: {result['summary']['total_items']} items, ₹{result['summary']['total_duty']:,.2f} total duty")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Invoice processing exception: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Invoice processing failed: {str(e)}")


@router.get("/react/invoice/duty-summary/{document_id}")
async def get_invoice_duty_summary(
    document_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get duty calculation summary for a previously processed invoice

    Returns:
        Duty summary with totals and per-item breakdown
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        from Orbisporte.domain.services.invoice_duty_integration import InvoiceDutyIntegrationService

        service = InvoiceDutyIntegrationService(db)
        result = service.get_duty_summary_by_document(document_id)

        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])

        return result

    except HTTPException:
        raise


@router.get("/react/invoice/export/{document_id}")
async def export_invoice_duty_results(
    document_id: int,
    format: str = "csv",
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export invoice duty calculation results to CSV or Excel

    Query params:
        format: Export format ('csv' or 'excel', default: 'csv')

    Returns:
        File download with invoice duty results
    """
    import logging
    import io
    import csv
    from fastapi.responses import StreamingResponse

    logger = logging.getLogger(__name__)

    try:
        from Orbisporte.domain.services.invoice_duty_integration import InvoiceDutyIntegrationService

        # Get the processed invoice results
        service = InvoiceDutyIntegrationService(db)
        result = service.get_duty_summary_by_document(document_id)

        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])

        # Prepare CSV export
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(['Item #', 'Description', 'HSN Code', 'Quantity', 'Unit',
                        'Unit Price', 'CIF Value', 'BCD', 'CESS', 'IGST', 'SWS',
                        'Total Duty', 'Total Amount', 'Status'])

        # Write line items
        for idx, item in enumerate(result.get('items', []), 1):
            writer.writerow([
                idx,
                item.get('description', 'N/A'),
                item.get('hsn_code', 'N/A'),
                item.get('quantity', 0),
                item.get('unit', 'PCS'),
                f"₹{item.get('unit_price', 0):,.2f}",
                f"₹{item.get('cif_value', 0):,.2f}",
                f"₹{item.get('duty_breakdown', {}).get('bcd', 0):,.2f}",
                f"₹{item.get('duty_breakdown', {}).get('cess', 0):,.2f}",
                f"₹{item.get('duty_breakdown', {}).get('igst', 0):,.2f}",
                f"₹{item.get('duty_breakdown', {}).get('sws', 0):,.2f}",
                f"₹{item.get('total_duty', 0):,.2f}",
                f"₹{(item.get('cif_value', 0) + item.get('total_duty', 0)):,.2f}",
                item.get('status', 'unknown')
            ])

        # Write summary
        writer.writerow([])
        writer.writerow(['SUMMARY'])
        writer.writerow(['Total Items', result.get('summary', {}).get('total_items', 0)])
        writer.writerow(['Total CIF Value', f"₹{result.get('summary', {}).get('total_cif_value', 0):,.2f}"])
        writer.writerow(['Total Duty', f"₹{result.get('summary', {}).get('total_duty', 0):,.2f}"])
        writer.writerow(['Total Amount Payable', f"₹{result.get('summary', {}).get('total_amount_payable', 0):,.2f}"])

        # Prepare response
        output.seek(0)

        invoice_number = result.get('invoice_data', {}).get('invoice_number', f'doc_{document_id}')
        filename = f"invoice_duty_{invoice_number}.csv"

        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[API] Export failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
    except Exception as e:
        logger.error(f"[API] Failed to get duty summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get duty summary: {str(e)}")


@router.get("/react/duty/history")
async def get_duty_calculation_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 10
):
    """
    Get calculation history for the current user

    Returns:
        List of recent calculations with UUID, HSN code, values, and timestamps
    """
    try:
        from Orbisporte.domain.services.duty_calculator import DutyCalculator

        calculator = DutyCalculator(db)
        history = calculator.get_user_calculation_history(
            user_id=current_user.id,
            limit=limit
        )

        return {
            "user_id": current_user.id,
            "calculations": history,
            "count": len(history)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch calculation history: {str(e)}")


# ============================================================================
# MODULE 3: BILL OF ENTRY (BoE) AUTO-FILL ENDPOINTS
# ============================================================================

@router.post("/react/boe/create-from-invoice")
async def create_boe_from_invoice(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create Bill of Entry from processed invoice

    Payload:
        document_id: ID of processed invoice document (required)
        port_code: Port of import (optional, default: INMAA1)
        auto_validate: Run validation after creation (optional, default: true)

    Returns:
        BoE with validation report and risk score
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        from Orbisporte.domain.services.boe_autofill import BoEAutoFillService
        from Orbisporte.domain.services.invoice_duty_integration import InvoiceDutyIntegrationService

        document_id = payload.get("document_id")
        if not document_id:
            raise HTTPException(status_code=400, detail="document_id is required")

        port_code = payload.get("port_code", "INMAA1")
        auto_validate = payload.get("auto_validate", True)

        logger.info(f"[BoE API] Creating BoE from document {document_id} for port {port_code}")

        # Get the processed invoice with duties
        invoice_service = InvoiceDutyIntegrationService(db)
        invoice_result = invoice_service.get_duty_summary_by_document(document_id)

        if "error" in invoice_result:
            raise HTTPException(status_code=404, detail=invoice_result["error"])

        # Extract data for BoE
        extracted_data = invoice_result.get("invoice_data", {})
        line_items_with_duties = invoice_result.get("items", [])

        # Create BoE
        boe_service = BoEAutoFillService(db)
        result = boe_service.create_boe_from_invoice(
            document_id=document_id,
            extracted_data=extracted_data,
            line_items_with_duties=line_items_with_duties,
            user_id=current_user.id,
            port_code=port_code,
            auto_validate=auto_validate
        )

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create BoE"))

        logger.info(f"[BoE API] ✅ Created BoE {result['boe_number']}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BoE API] Failed to create BoE: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create BoE: {str(e)}")


@router.get("/react/boe/list")
async def list_boes(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    limit: int = 20
):
    """
    List all Bills of Entry for current user

    Query params:
        status: Filter by status (draft, validated, submitted)
        limit: Max number of results (default: 20)

    Returns:
        List of BoEs with summary information
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        logger.info(f"[BoE List] User {current_user.id} requesting BoE list (status={status}, limit={limit})")

        query = text("""
            SELECT id, boe_number, boe_date, port_code,
                   status, validation_status, risk_score,
                   total_duty, total_amount_payable,
                   created_at
            FROM bills_of_entry
            WHERE user_id = :user_id
            """ + (" AND status = :status" if status else "") + """
            ORDER BY created_at DESC
            LIMIT :limit
        """)

        params = {'user_id': current_user.id, 'limit': limit}
        if status:
            params['status'] = status

        results = db.execute(query, params).fetchall()
        logger.info(f"[BoE List] Found {len(results)} BoEs")

        boes = []
        for row in results:
            boe_dict = dict(row._mapping)
            # Convert date/datetime to string for JSON serialization
            if 'boe_date' in boe_dict and boe_dict['boe_date']:
                boe_dict['boe_date'] = boe_dict['boe_date'].isoformat()
            if 'created_at' in boe_dict and boe_dict['created_at']:
                boe_dict['created_at'] = boe_dict['created_at'].isoformat()
            # Convert Decimal to float
            if 'risk_score' in boe_dict and boe_dict['risk_score']:
                boe_dict['risk_score'] = float(boe_dict['risk_score'])
            if 'total_duty' in boe_dict and boe_dict['total_duty']:
                boe_dict['total_duty'] = float(boe_dict['total_duty'])
            if 'total_amount_payable' in boe_dict and boe_dict['total_amount_payable']:
                boe_dict['total_amount_payable'] = float(boe_dict['total_amount_payable'])
            boes.append(boe_dict)

        logger.info(f"[BoE List] Returning {len(boes)} BoEs")

        return {
            "boes": boes,
            "count": len(boes)
        }

    except Exception as e:
        logger.error(f"[BoE List] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list BoEs: {str(e)}")


@router.get("/react/boe/{boe_id}")
async def get_boe(
    boe_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get Bill of Entry by ID

    Returns:
        Complete BoE with header and line items
    """
    from Orbisporte.domain.services.boe_autofill import BoEAutoFillService

    try:
        service = BoEAutoFillService(db)
        boe_data = service._get_boe_by_id(boe_id)

        if not boe_data:
            raise HTTPException(status_code=404, detail="BoE not found")

        # Check access
        if boe_data.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        line_items = service._get_boe_line_items(boe_id)

        return {
            "boe": boe_data,
            "line_items": line_items
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch BoE: {str(e)}")


@router.post("/react/boe/{boe_id}/validate")
async def validate_boe(
    boe_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate Bill of Entry against business rules

    Returns:
        Validation report with errors and warnings
    """
    from Orbisporte.domain.services.boe_autofill import BoEAutoFillService

    try:
        service = BoEAutoFillService(db)
        validation_report = service.validate_boe(boe_id)

        return validation_report

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.get("/react/boe/{boe_id}/export")
async def export_boe(
    boe_id: int,
    format: str = "json",
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export BoE in port-specific format (for ICEGATE filing)

    Args:
        boe_id: BoE ID
        format: Export format (json or xml)

    Returns:
        BoE in port-specific ICEGATE format
    """
    from Orbisporte.domain.services.boe_autofill import BoEAutoFillService

    try:
        service = BoEAutoFillService(db)
        export_data = service.export_boe_for_port(boe_id, format=format)

        return export_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# ============================================================================
# MODULE 7: NOTIFICATION TRACKING ENDPOINTS
# ============================================================================

@router.post("/react/notifications/ingest")
async def ingest_notification(
    payload: Dict[str, Any] = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ingest a new customs notification

    Payload:
        notification_number: Official notification number (e.g., "50/2024-Customs")
        notification_type: Type ('Customs', 'IGST', 'ADD', 'FTA', 'Exemption')
        title: Notification title
        issue_date: Issue date (YYYY-MM-DD)
        effective_from: Effective from date (YYYY-MM-DD)
        effective_to: Effective to date (optional)
        raw_text: Full notification text
        source_url: Source URL (optional)

    Returns:
        Ingested notification with ID
    """
    import logging
    from datetime import datetime
    from Orbisporte.domain.services.notification_tracking import NotificationTrackingService

    logger = logging.getLogger(__name__)

    try:
        notification_number = payload.get("notification_number")
        notification_type = payload.get("notification_type")
        title = payload.get("title")
        issue_date_str = payload.get("issue_date")
        effective_from_str = payload.get("effective_from")
        raw_text = payload.get("raw_text", "")

        if not all([notification_number, notification_type, title, issue_date_str, effective_from_str]):
            raise HTTPException(
                status_code=400,
                detail="notification_number, notification_type, title, issue_date, and effective_from are required"
            )

        # Parse dates
        issue_date = datetime.strptime(issue_date_str, "%Y-%m-%d").date()
        effective_from = datetime.strptime(effective_from_str, "%Y-%m-%d").date()

        effective_to = None
        if payload.get("effective_to"):
            effective_to = datetime.strptime(payload.get("effective_to"), "%Y-%m-%d").date()

        service = NotificationTrackingService(db)
        notification = service.ingest_notification(
            notification_number=notification_number,
            notification_type=notification_type,
            title=title,
            issue_date=issue_date,
            effective_from=effective_from,
            effective_to=effective_to,
            raw_text=raw_text,
            source_url=payload.get("source_url"),
            created_by=current_user.id
        )

        logger.info(f"✅ Notification {notification_number} ingested successfully")

        return {
            "success": True,
            "notification_id": notification.id,
            "notification_number": notification.notification_number,
            "parsed_status": notification.parsed_status,
            "message": f"Notification {notification_number} ingested successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to ingest notification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to ingest notification: {str(e)}")


@router.post("/react/notifications/{notification_id}/parse")
async def parse_notification(
    notification_id: int,
    auto_apply: bool = False,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parse a notification to extract HSN codes and rate changes

    Args:
        notification_id: ID of notification to parse
        auto_apply: Automatically apply rate changes to duty_rates table (default: False)

    Returns:
        Parsed items with HSN codes and rate changes
    """
    import logging
    from Orbisporte.domain.services.notification_tracking import NotificationTrackingService

    logger = logging.getLogger(__name__)

    try:
        service = NotificationTrackingService(db)
        result = service.parse_notification(notification_id, auto_apply=auto_apply)

        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('error', 'Failed to parse notification'))

        logger.info(f"✅ Parsed {result.get('items_count', 0)} items from notification {notification_id}")

        # Convert items to JSON-serializable format
        items_data = []
        for item in result.get('items', []):
            confidence = item.get('overall_confidence', 0.0)
            items_data.append({
                "hsn_code_from": item.get('hsn_code_from'),
                "hsn_code_to": item.get('hsn_code_to'),
                "product_description": item.get('product_description', ''),
                "duty_type": item.get('duty_type'),
                "old_rate": float(item.get('old_rate')) if item.get('old_rate') is not None else None,
                "new_rate": float(item.get('new_rate')) if item.get('new_rate') is not None else None,
                "rate_unit": item.get('rate_unit', 'percent'),
                "overall_confidence": float(confidence),
                "requires_review": confidence < 0.85
            })

        return {
            "success": True,
            "notification_id": notification_id,
            "parsed_items": items_data,
            "count": len(items_data),
            "auto_applied": auto_apply
        }

    except Exception as e:
        logger.error(f"Failed to parse notification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse notification: {str(e)}")


@router.get("/react/notifications/list")
async def list_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    notification_type: Optional[str] = None,
    parsed_status: Optional[str] = None,
    limit: int = 20
):
    """
    List all notifications

    Query params:
        notification_type: Filter by type (Customs, IGST, ADD, FTA, Exemption)
        parsed_status: Filter by status (pending, parsed, failed, reviewed)
        limit: Max results (default: 20)

    Returns:
        List of notifications with summary
    """
    import logging
    from Orbisporte.domain.services.notification_tracking import NotificationTrackingService

    logger = logging.getLogger(__name__)

    try:
        service = NotificationTrackingService(db)
        notifications = service.get_active_notifications(limit=limit)

        # Apply filters if provided
        filtered_notifications = []
        for n in notifications:
            if notification_type and n.get('notification_type') != notification_type:
                continue
            if parsed_status and n.get('parsed_status') != parsed_status:
                continue
            filtered_notifications.append(n)

        return {
            "notifications": filtered_notifications,
            "count": len(filtered_notifications)
        }

    except Exception as e:
        logger.error(f"Failed to list notifications: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list notifications: {str(e)}")


@router.get("/react/notifications/rate-changes")
async def get_rate_changes(
    days: int = 90,
    hsn_code: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent duty rate changes from customs notifications

    Query parameters:
    - days: Number of days to look back (default: 90)
    - hsn_code: Optional HSN code to filter by

    Returns:
        List of rate changes with notification details
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Query the recent_rate_changes view
        query = text("""
            SELECT
                notification_number,
                issue_date,
                effective_from,
                hsn_code_from,
                hsn_code_to,
                product_description,
                duty_type,
                old_rate,
                new_rate,
                rate_change,
                change_direction,
                overall_confidence
            FROM recent_rate_changes
            WHERE issue_date >= CURRENT_DATE - :days * INTERVAL '1 day'
        """)

        params = {"days": days}

        # Add HSN code filter if provided
        if hsn_code:
            query = text("""
                SELECT
                    notification_number,
                    issue_date,
                    effective_from,
                    hsn_code_from,
                    hsn_code_to,
                    product_description,
                    duty_type,
                    old_rate,
                    new_rate,
                    rate_change,
                    change_direction,
                    overall_confidence
                FROM recent_rate_changes
                WHERE issue_date >= CURRENT_DATE - :days * INTERVAL '1 day'
                    AND hsn_code_from = :hsn_code
            """)
            params["hsn_code"] = hsn_code

        result = db.execute(query, params)
        rate_changes = []

        for row in result:
            rate_change_dict = dict(row._mapping)
            # Convert dates to ISO format
            if rate_change_dict.get('issue_date'):
                rate_change_dict['issue_date'] = rate_change_dict['issue_date'].isoformat()
            if rate_change_dict.get('effective_from'):
                rate_change_dict['effective_from'] = rate_change_dict['effective_from'].isoformat()
            # Convert Decimal to float for JSON serialization
            for key in ['rate_change', 'old_rate', 'new_rate', 'overall_confidence']:
                if rate_change_dict.get(key) is not None:
                    rate_change_dict[key] = float(rate_change_dict[key])
            rate_changes.append(rate_change_dict)

        logger.info(f"Found {len(rate_changes)} rate changes in the last {days} days")

        return {
            "rate_changes": rate_changes,
            "count": len(rate_changes),
            "days": days,
            "hsn_code": hsn_code
        }

    except Exception as e:
        logger.error(f"Failed to get rate changes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get rate changes: {str(e)}")


@router.get("/react/notifications/{notification_id}")
async def get_notification_details(
    notification_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get notification details with parsed items

    Returns:
        Complete notification with parsed items
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Get notification
        query = text("""
            SELECT id, notification_number, notification_type, title,
                   issue_date, effective_from, effective_to,
                   source_url, raw_text, parsed_status, parsed_at
            FROM customs_notifications
            WHERE id = :notification_id
        """)

        result = db.execute(query, {"notification_id": notification_id}).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Notification not found")

        notification_data = dict(result._mapping)

        # Convert dates to ISO format
        if notification_data.get('issue_date'):
            notification_data['issue_date'] = notification_data['issue_date'].isoformat()
        if notification_data.get('effective_from'):
            notification_data['effective_from'] = notification_data['effective_from'].isoformat()
        if notification_data.get('effective_to'):
            notification_data['effective_to'] = notification_data['effective_to'].isoformat()
        if notification_data.get('parsed_at'):
            notification_data['parsed_at'] = notification_data['parsed_at'].isoformat()

        # Get parsed items
        items_query = text("""
            SELECT id, item_sequence, hsn_code_from, hsn_code_to,
                   product_description, duty_type, old_rate, new_rate,
                   rate_unit, overall_confidence, requires_review
            FROM notification_items
            WHERE notification_id = :notification_id
            ORDER BY item_sequence
        """)

        items_results = db.execute(items_query, {"notification_id": notification_id}).fetchall()

        items_data = []
        for item in items_results:
            item_dict = dict(item._mapping)
            # Convert Decimals to float
            if item_dict.get('old_rate'):
                item_dict['old_rate'] = float(item_dict['old_rate'])
            if item_dict.get('new_rate'):
                item_dict['new_rate'] = float(item_dict['new_rate'])
            if item_dict.get('overall_confidence'):
                item_dict['overall_confidence'] = float(item_dict['overall_confidence'])
            items_data.append(item_dict)

        return {
            "notification": notification_data,
            "items": items_data,
            "items_count": len(items_data)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get notification: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get notification: {str(e)}")


@router.get("/react/notifications/conflicts")
async def get_conflicts(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    resolved: Optional[bool] = None
):
    """
    Get notification conflicts

    Query params:
        resolved: Filter by resolution status (true/false)

    Returns:
        List of conflicts requiring review
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        query_str = """
            SELECT c.id, c.conflict_type, c.hsn_code, c.duty_type,
                   c.description, c.severity, c.resolved,
                   n1.notification_number as notification_1,
                   n2.notification_number as notification_2,
                   c.detected_at
            FROM notification_conflicts c
            JOIN customs_notifications n1 ON c.notification_id_1 = n1.id
            JOIN customs_notifications n2 ON c.notification_id_2 = n2.id
        """

        if resolved is not None:
            query_str += " WHERE c.resolved = :resolved"

        query_str += " ORDER BY c.severity DESC, c.detected_at DESC"

        params = {}
        if resolved is not None:
            params['resolved'] = resolved

        query = text(query_str)
        results = db.execute(query, params).fetchall()

        conflicts_data = []
        for row in results:
            conflict_dict = dict(row._mapping)
            if conflict_dict.get('detected_at'):
                conflict_dict['detected_at'] = conflict_dict['detected_at'].isoformat()
            conflicts_data.append(conflict_dict)

        return {
            "conflicts": conflicts_data,
            "count": len(conflicts_data)
        }

    except Exception as e:
        logger.error(f"Failed to get conflicts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get conflicts: {str(e)}")


# ── Adopt intake document into ProcessedDocuments ─────────────────────────────
@router.post("/react/adopt-intake/{intake_document_id}")
def adopt_intake_document(
    intake_document_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Link a DocumentRegistry entry (from DataIntake) into ProcessedDocuments
    so the M02 pipeline can operate on it.
    Returns { document_id, filename, file_path }.
    """
    import logging as _logging
    _log = _logging.getLogger(__name__)
    from Orbisporte.domain.models import DocumentRegistry, ProcessedDocument

    # Lookup the intake record
    reg = db.query(DocumentRegistry).filter_by(document_id=intake_document_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Intake document not found")
    if reg.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Resolve the DataLake file path to an absolute path.
    # raw_lake_path may be:
    #   s3://bucket/key   → not locally accessible without boto3
    #   data_lake/raw/... → relative to CWD (backend dir)
    raw = reg.raw_lake_path or ""
    if raw.startswith("s3://"):
        # Can't resolve S3 paths locally; fall through to FileStorage copy below
        lake_abs = None
    else:
        lake_abs = str(Path(raw).resolve()) if raw else None

    # Verify the DataLake file actually exists on disk
    lake_path_ok = lake_abs and Path(lake_abs).exists()
    if not lake_path_ok:
        _log.warning("adopt-intake: DataLake file missing at %s", lake_abs)

    # Check if we already adopted this intake doc (matched by content hash)
    existing = (
        db.query(ProcessedDocument)
        .filter_by(content_hash=reg.content_hash, user_id=current_user.id)
        .first()
    )
    if existing:
        # Verify the existing ProcessedDocument's file still exists
        existing_ok = Path(existing.file_path).exists() if existing.file_path else False
        if existing_ok:
            return {
                "document_id": existing.id,
                "filename": existing.original_filename,
                "file_path": existing.file_path,
            }
        # Existing record's file is gone — update it to the DataLake path if available
        if lake_path_ok:
            existing.file_path = lake_abs
            db.commit()
            return {
                "document_id": existing.id,
                "filename": existing.original_filename,
                "file_path": lake_abs,
            }
        raise HTTPException(
            status_code=404,
            detail="Source file not found on disk. Please re-upload the document."
        )

    # No existing record — require DataLake file to be present
    if not lake_path_ok:
        raise HTTPException(
            status_code=404,
            detail=(
                "DataLake file not found. The pipeline may still be running — "
                "wait for ingestion_status=stored before opening in Document Management."
            )
        )

    # Create a new ProcessedDocuments row pointing to the DataLake file
    doc = ProcessedDocument(
        user_id=current_user.id,
        company_id=reg.company_id,
        filename=reg.original_filename or intake_document_id,
        original_filename=reg.original_filename or intake_document_id,
        file_path=lake_abs,
        file_type=reg.file_type,
        content_hash=reg.content_hash,
        doc_type=reg.document_type,
        processing_status="uploaded",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Auto-trigger M02 extraction for the adopted document
    _log.info(f"[adopt-intake] Auto-triggering M02 extraction for document {doc.id}")
    
    m02_result = None
    try:
        from Orbisporte.domain.services.m02_extraction import M02ExtractionService
        from Orbisporte.domain.models import M02ExtractionResult
        
        # Run extraction in fast mode for speed
        try:
            svc = M02ExtractionService()
            m02_output = svc.process(lake_abs, document_id=doc.id, fast_mode=True)
            
            # Save extraction result
            extracted = m02_output.get("extracted_fields", {})
            normalised = m02_output.get("normalised_fields", {})
            all_fields = {**extracted, **normalised}
            
            m02_result = M02ExtractionResult(
                document_id=doc.id,
                user_id=current_user.id,
                extracted_fields=all_fields,
                normalised_fields=normalised,
                document_type=m02_output.get("document_type", "unknown"),
                document_type_confidence=m02_output.get("document_type_confidence", 0.5),
                ocr_text=m02_output.get("ocr_text", ""),
                raw_entities=m02_output.get("gliner_entities", {}),
                confidence_scores=m02_output.get("confidence_scores", {}),
                overall_confidence=m02_output.get("overall_confidence", 0.5),
                review_status="completed" if m02_output.get("overall_confidence", 0) >= 0.95 else "pending",
                review_queue="auto" if m02_output.get("overall_confidence", 0) >= 0.95 else "soft_review",
                pipeline_duration_ms=m02_output.get("pipeline_duration_ms", 0),
            )
            db.add(m02_result)
            db.commit()
            db.refresh(m02_result)
            
            _log.info(f"[adopt-intake] M02 extraction completed for document {doc.id}, confidence: {m02_output.get('overall_confidence', 0):.2f}")
            
            # Update processing status
            doc.processing_status = "extracted"
            doc.doc_type = m02_output.get("document_type", "unknown")
            db.commit()
            
        except Exception as m02_error:
            _log.error(f"[adopt-intake] M02 extraction failed for document {doc.id}: {m02_error}")
            # Still return the document even if extraction failed
    
    except Exception as e:
        _log.error(f"[adopt-intake] Error during auto-extraction: {e}")

    return {
        "document_id": doc.id,
        "filename": doc.original_filename,
        "file_path": doc.file_path,
        "extraction_completed": m02_result is not None,
    }
