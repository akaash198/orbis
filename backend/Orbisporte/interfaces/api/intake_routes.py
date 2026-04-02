"""
Data Intake API endpoints — SOP DM-001 to DM-007.

Endpoints
---------
  POST /intake/upload          REST API / Web Portal file upload (PDF, JPEG, PNG, TIFF, XML, JSON)
  POST /intake/barcode/image   Scan a barcode / QR code from an image
  POST /intake/barcode/raw     Submit a raw decoded barcode string
  POST /intake/voice           Upload audio for ASR transcription
  POST /intake/sftp/trigger    Manually trigger SFTP batch poll (admin)
  POST /intake/email/trigger   Manually trigger email inbox poll (admin)
  GET  /intake/status/{id}     Get ingestion status for a document
  GET  /intake/registry        List all documents in the registry (paginated)
  GET  /intake/health          Data Lake + Kafka health check
"""

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from Orbisporte.domain.models import DocumentRegistry
from Orbisporte.domain.services.data_intake.intake_service import IntakeService
from Orbisporte.domain.services.data_intake.deduplication import remove_from_dedup_index
from Orbisporte.domain.services.data_intake.channels.barcode_channel import (
    scan_image as barcode_scan_image,
    decode_raw_payload as barcode_decode_raw,
)
from Orbisporte.domain.services.data_intake.channels.voice_channel import transcribe_audio
from Orbisporte.domain.services.data_intake.channels.sftp_channel import SFTPChannel
from Orbisporte.domain.services.data_intake.channels.email_channel import EmailChannel
from Orbisporte.infrastructure.data_lake import get_data_lake
from Orbisporte.infrastructure.kafka_client import get_producer
from Orbisporte.infrastructure.db import get_db
from Orbisporte.interfaces.api.auth import verify_token
from Orbisporte.infrastructure.db import UserRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/intake", tags=["Data Intake"])


# ── Auth dependency (reuse existing pattern) ─────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# DM-001: REST API / Web Portal upload
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/upload", summary="Upload a trade document (REST API / Web Portal)")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF, JPEG, PNG, TIFF, XML, JSON — max 50 MB"),
    source_channel: str = Form("api", description="api | portal"),
    source_system: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Accept a document via REST API or Web Portal drag-and-drop.
    Returns the assigned Document ID immediately; full processing runs async.
    """
    file_bytes = await file.read()
    channel = source_channel if source_channel in ("api", "portal") else "api"

    svc = IntakeService(db)
    result = svc.accept(
        file_bytes=file_bytes,
        original_filename=file.filename or "upload",
        source_channel=channel,
        user_id=current_user.id,
        company_id=getattr(current_user, "company_id", None),
        sender_info=current_user.email_id,
        source_system=source_system or f"{channel.upper()} v1",
    )

    if result.get("ingestion_status") == "validation_failed":
        raise HTTPException(status_code=422, detail={
            "message": "File validation failed",
            "errors": result["validation_errors"],
        })

    doc_id     = result["document_id"]
    file_bytes_ = result.pop("_file_bytes", file_bytes)

    # DM-004 → DM-007 in background
    background_tasks.add_task(svc.run_pipeline, doc_id, file_bytes_)

    return JSONResponse(status_code=202, content={
        "document_id":      doc_id,
        "ingestion_status": "registered",
        "file_type":        result.get("file_type"),
        "content_hash":     result.get("content_hash"),
        "message":          "Document accepted. Processing started in background.",
    })


# ─────────────────────────────────────────────────────────────────────────────
# Barcode / QR Code — image input
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/barcode/image", summary="Scan barcode / QR code from an image")
async def barcode_from_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="JPEG or PNG image containing barcode(s)"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Decode all GS1 barcodes and QR codes in an uploaded image,
    then ingest each decoded payload into the intake pipeline.
    """
    image_bytes = await file.read()
    scan_results = barcode_scan_image(image_bytes)

    if not scan_results or all(r.errors for r in scan_results):
        raise HTTPException(status_code=422, detail="No barcodes found in image or scan error.")

    ingested = []
    svc = IntakeService(db)
    for sr in scan_results:
        if sr.errors:
            continue
        payload_bytes = sr.raw_value.encode("utf-8")
        result = svc.accept(
            file_bytes=payload_bytes,
            original_filename=f"barcode_{sr.barcode_type}.txt",
            source_channel="barcode",
            user_id=current_user.id,
            company_id=getattr(current_user, "company_id", None),
            sender_info="barcode_scanner",
            source_system="Barcode Scanner",
        )
        if result.get("document_id"):
            doc_id = result["document_id"]
            background_tasks.add_task(svc.run_pipeline, doc_id, payload_bytes)
            ingested.append({
                "document_id":  doc_id,
                "barcode_type": sr.barcode_type,
                "raw_value":    sr.raw_value[:100],
                "parsed":       sr.parsed,
            })

    return {"scanned": len(scan_results), "ingested": ingested}


# ─────────────────────────────────────────────────────────────────────────────
# Barcode / QR Code — raw string (from hardware scanner)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/barcode/raw", summary="Submit decoded barcode payload from hardware scanner")
async def barcode_raw_payload(
    background_tasks: BackgroundTasks,
    payload: str = Form(..., description="Raw string emitted by the barcode scanner"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    br = barcode_decode_raw(payload)
    if br.errors:
        raise HTTPException(status_code=422, detail=br.errors)

    payload_bytes = br.raw_value.encode("utf-8")
    svc = IntakeService(db)
    result = svc.accept(
        file_bytes=payload_bytes,
        original_filename="barcode_raw.txt",
        source_channel="barcode",
        user_id=current_user.id,
        company_id=getattr(current_user, "company_id", None),
        sender_info="hardware_scanner",
        source_system="Barcode Scanner (Raw)",
    )
    if result.get("ingestion_status") == "validation_failed":
        raise HTTPException(status_code=422, detail=result["validation_errors"])

    doc_id = result["document_id"]
    background_tasks.add_task(svc.run_pipeline, doc_id, payload_bytes)

    return {
        "document_id":  doc_id,
        "barcode_type": br.barcode_type,
        "parsed":       br.parsed,
        "ingestion_status": "registered",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Voice / Audio
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/voice", summary="Upload audio for ASR transcription and data extraction")
async def voice_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="WAV, MP3, M4A, OGG, FLAC — max 25 MB"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Transcribe spoken trade details using OpenAI Whisper, extract structured
    fields, and ingest the transcript into the data lake.
    """
    audio_bytes = await file.read()
    transcription = transcribe_audio(audio_bytes, file.filename or "audio.wav")

    if transcription.errors:
        raise HTTPException(status_code=422, detail={
            "message": "Audio transcription failed",
            "errors": transcription.errors,
        })

    # Store the transcript text as the document
    transcript_bytes = transcription.transcript.encode("utf-8")
    svc = IntakeService(db)
    result = svc.accept(
        file_bytes=transcript_bytes,
        original_filename=f"{file.filename or 'audio'}.transcript.txt",
        source_channel="voice",
        user_id=current_user.id,
        company_id=getattr(current_user, "company_id", None),
        sender_info=current_user.email_id,
        source_system="Voice / ASR (Whisper)",
    )

    doc_id = result.get("document_id")
    if doc_id:
        background_tasks.add_task(svc.run_pipeline, doc_id, transcript_bytes)

    return {
        "document_id":      doc_id,
        "ingestion_status": "registered",
        "transcript":       transcription.transcript,
        "language":         transcription.language,
        "duration_seconds": transcription.duration_seconds,
        "extracted_fields": transcription.extracted_fields,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SFTP batch trigger (admin)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/sftp/trigger", summary="Trigger SFTP batch poll (admin)")
async def trigger_sftp(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Poll the configured SFTP drop folder and ingest all new files."""
    if getattr(current_user, "role", "") not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="Admin or operator role required.")

    def _sftp_job():
        channel = SFTPChannel()
        svc = IntakeService(db)
        count = 0
        for doc in channel.fetch_pending():
            result = svc.accept(
                file_bytes=doc.content,
                original_filename=doc.filename,
                source_channel="sftp",
                user_id=current_user.id,
                company_id=getattr(current_user, "company_id", None),
                sender_info=doc.source_system,
                source_system=doc.source_system,
            )
            doc_id = result.get("document_id")
            if doc_id:
                svc.run_pipeline(doc_id, doc.content)
                count += 1
        logger.info("SFTP batch: ingested %d file(s).", count)

    background_tasks.add_task(_sftp_job)
    return {"message": "SFTP batch poll triggered.", "status": "background_task_started"}


# ─────────────────────────────────────────────────────────────────────────────
# Email trigger (admin)
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/email/trigger", summary="Trigger email inbox poll (admin)")
async def trigger_email(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Poll the configured IMAP inbox and ingest all new attachments."""
    if getattr(current_user, "role", "") not in ("admin", "operator"):
        raise HTTPException(status_code=403, detail="Admin or operator role required.")

    def _email_job():
        channel = EmailChannel()
        svc = IntakeService(db)
        count = 0
        for attachment in channel.fetch_pending():
            result = svc.accept(
                file_bytes=attachment.content,
                original_filename=attachment.filename,
                source_channel="email",
                user_id=current_user.id,
                company_id=getattr(current_user, "company_id", None),
                sender_info=attachment.sender_address,
                source_system=attachment.source_system,
            )
            doc_id = result.get("document_id")
            if doc_id:
                svc.run_pipeline(doc_id, attachment.content)
                count += 1
        logger.info("Email batch: ingested %d attachment(s).", count)

    background_tasks.add_task(_email_job)
    return {"message": "Email inbox poll triggered.", "status": "background_task_started"}


# ─────────────────────────────────────────────────────────────────────────────
# Status + Registry
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/status/{document_id}", summary="Get ingestion status for a document")
def get_intake_status(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = db.query(DocumentRegistry).filter_by(document_id=document_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Users can only see their own documents unless admin
    if entry.user_id != current_user.id and getattr(current_user, "role", "") != "admin":
        raise HTTPException(status_code=403, detail="Access denied.")

    return {
        "document_id":       entry.document_id,
        "ingestion_status":  entry.ingestion_status,
        "source_channel":    entry.source_channel,
        "file_type":         entry.file_type,
        "document_type":     entry.document_type,
        "language":          entry.language,
        "current_tier":      entry.current_tier,
        "raw_lake_path":     entry.raw_lake_path,
        "processed_lake_path": entry.processed_lake_path,
        "is_duplicate":      entry.is_duplicate,
        "duplicate_of":      entry.duplicate_of,
        "metadata_tags":     entry.metadata_tags,
        "validation_errors": entry.validation_errors,
        "created_at":        entry.created_at.isoformat() if entry.created_at else None,
        "processed_at":      entry.processed_at.isoformat() if entry.processed_at else None,
    }


@router.get("/registry", summary="List documents in the registry (paginated)")
def list_registry(
    page: int = 1,
    page_size: int = 20,
    source_channel: Optional[str] = None,
    ingestion_status: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    page_size = min(page_size, 100)
    offset    = (page - 1) * page_size

    query = db.query(DocumentRegistry)
    if getattr(current_user, "role", "") != "admin":
        query = query.filter(DocumentRegistry.user_id == current_user.id)
    if source_channel:
        query = query.filter(DocumentRegistry.source_channel == source_channel)
    if ingestion_status:
        query = query.filter(DocumentRegistry.ingestion_status == ingestion_status)
    if is_duplicate is not None:
        query = query.filter(DocumentRegistry.is_duplicate == is_duplicate)

    total = query.count()
    rows  = query.order_by(DocumentRegistry.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "items": [
            {
                "document_id":      r.document_id,
                "source_channel":   r.source_channel,
                "original_filename": r.original_filename,
                "file_type":        r.file_type,
                "document_type":    r.document_type,
                "language":         r.language,
                "ingestion_status": r.ingestion_status,
                "current_tier":     r.current_tier,
                "is_duplicate":     r.is_duplicate,
                "duplicate_of":     r.duplicate_of,
                "duplicate_confidence": r.duplicate_confidence,
                "created_at":       r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.delete("/document/{document_id}", summary="Delete a document from the registry and data lake")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Permanently delete a document from the registry and data lake.

    Rules
    -----
    - A user can only delete their own documents.
    - Admins can delete any document.
    - The original of a duplicate cannot be deleted while copies reference it
      (delete the duplicates first, or use force=true as admin).
    - Deletes: registry row, all event logs, raw + processed lake objects.
    """
    entry = db.query(DocumentRegistry).filter_by(document_id=document_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Document not found.")

    is_admin = getattr(current_user, "role", "") == "admin"

    # Ownership check
    if entry.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own documents.")

    # Prevent deleting an original that other duplicates still reference
    dependents = db.query(DocumentRegistry).filter(
        DocumentRegistry.duplicate_of == document_id
    ).count()
    if dependents > 0 and not is_admin:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {dependents} duplicate(s) still reference this document. "
                   "Delete the duplicates first."
        )

    # ── Remove from data lake ──────────────────────────────────────────────
    lake = get_data_lake()
    deleted_paths = []

    for path_attr in ("raw_lake_path", "processed_lake_path", "curated_lake_path"):
        lake_path = getattr(entry, path_attr, None)
        if not lake_path:
            continue
        try:
            if lake_path.startswith("s3://"):
                # Parse  s3://bucket/key
                without_prefix = lake_path[5:]
                bucket, _, key = without_prefix.partition("/")
                if lake._s3:
                    lake._s3.delete_object(Bucket=bucket, Key=key)
            else:
                # Local filesystem
                from pathlib import Path
                p = Path(lake_path)
                if p.exists():
                    p.unlink()
            deleted_paths.append(lake_path)
        except Exception as exc:
            logger.warning("Could not delete lake object %s: %s", lake_path, exc)

    # ── Remove from ProcessedDocuments (Document Management) ──────────────
    from Orbisporte.domain.models import IntakeEventLog, ProcessedDocument, M02ExtractionResult
    from pathlib import Path as _Path

    proc_docs = (
        db.query(ProcessedDocument)
        .filter_by(content_hash=entry.content_hash, user_id=current_user.id)
        .all()
    )
    proc_doc_ids = []
    for pd in proc_docs:
        # Delete physical file from FileStorage uploads dir if it exists there
        if pd.file_path:
            p = _Path(pd.file_path)
            if p.exists() and "uploads" in str(p):
                try:
                    p.unlink()
                    deleted_paths.append(pd.file_path)
                except Exception as exc:
                    logger.warning("Could not delete uploads file %s: %s", pd.file_path, exc)
        # Delete linked M02 results
        db.query(M02ExtractionResult).filter_by(document_id=pd.id).delete()
        proc_doc_ids.append(pd.id)
        db.delete(pd)

    # ── Remove from FAISS dedup index ─────────────────────────────────────
    # Remove the document itself AND any duplicates that pointed to it,
    # so that re-uploading the same file after deletion is not flagged as duplicate.
    ids_to_purge = [document_id]
    duplicate_doc_ids = [
        r.document_id for r in
        db.query(DocumentRegistry.document_id)
        .filter(DocumentRegistry.duplicate_of == document_id)
        .all()
    ]
    ids_to_purge.extend(duplicate_doc_ids)

    for did in ids_to_purge:
        try:
            remove_from_dedup_index(did)
        except Exception as exc:
            logger.warning("Could not remove %s from dedup index: %s", did, exc)

    # ── Remove event logs ─────────────────────────────────────────────────
    db.query(IntakeEventLog).filter_by(document_id=document_id).delete()

    # ── Remove registry row ────────────────────────────────────────────────
    db.delete(entry)
    db.commit()

    logger.info(
        "Document %s deleted by user %s. ProcessedDocuments removed: %s",
        document_id, current_user.id, proc_doc_ids,
    )

    return {
        "deleted":           True,
        "document_id":       document_id,
        "deleted_paths":     deleted_paths,
        "processed_doc_ids": proc_doc_ids,
        "message":           "Document removed from registry, data lake, and document management.",
    }


@router.get("/health", summary="Data Lake and Kafka health check")
def intake_health(db: Session = Depends(get_db)):
    lake_health = get_data_lake().health_check()
    return {
        "status":    "ok",
        "data_lake": lake_health,
        "kafka":     {"bootstrap": __import__("os").getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")},
    }
