"""
IntakeService — SOP DM-001 to DM-007 orchestrator.

Pipeline stages
---------------
  DM-001  Accept input via API / SFTP / Email / Portal / Barcode / Voice
  DM-002  Validate file format, size, and structure
  DM-003  Assign unique Document ID and register in document registry
  DM-004  Preprocess: image deskew, noise removal, encoding normalisation
  DM-005  Detect language and document type automatically
  DM-006  Tag metadata: document_id, document_type, language, source_system, timestamp
  DM-007  Store in Data Lake — Raw layer; promote to Processed after extraction

All stages emit Kafka events for async tracking. The HTTP response
returns as soon as stage DM-003 completes (document registered) so
upstream callers get their Document ID immediately. DM-004 onward
run in a background FastAPI task.
"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from Orbisporte.domain.models import DocumentRegistry, IntakeEventLog
from Orbisporte.domain.services.data_intake import validators
from Orbisporte.domain.services.data_intake import preprocessor
from Orbisporte.domain.services.data_intake import language_detector
from Orbisporte.domain.services.data_intake.deduplication import check_duplicate
from Orbisporte.infrastructure.data_lake import get_data_lake
from Orbisporte.infrastructure.kafka_client import get_producer

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
class IntakeService:
    """
    Entry point for all document ingestion regardless of source channel.

    Usage
    -----
        svc = IntakeService(db)

        # Synchronous fast-path (returns document_id immediately)
        doc_id = svc.accept(
            file_bytes=b"...",
            original_filename="invoice.pdf",
            source_channel="api",
            user_id=1,
            company_id=2,
            sender_info="user@example.com",
            source_system="REST API v1",
        )

        # Full async pipeline (call from BackgroundTasks)
        svc.run_pipeline(doc_id)
    """

    def __init__(self, db: Session):
        self._db      = db
        self._lake    = get_data_lake()
        self._kafka   = get_producer()

    # ── Public API ────────────────────────────────────────────────────────

    def accept(
        self,
        file_bytes: bytes,
        original_filename: str,
        source_channel: str,
        user_id: Optional[int] = None,
        company_id: Optional[int] = None,
        sender_info: Optional[str] = None,
        source_system: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        DM-001 + DM-002 + DM-003: Accept, validate, register.

        Returns a dict with at minimum:
          document_id, ingestion_status, validation_errors (if any)

        Raises ValueError on unrecoverable validation failure.
        """
        # ── DM-001 Accept ─────────────────────────────────────────────
        logger.info("DM-001 Accept: channel=%s file=%s", source_channel, original_filename)

        # ── DM-002 Validate ───────────────────────────────────────────
        if source_channel == "barcode":
            # Barcode payload is a UTF-8 string, not binary
            val = validators.validate_barcode_payload(
                file_bytes.decode("utf-8", errors="replace")
            )
        else:
            val = validators.validate(file_bytes, original_filename, source_channel)

        if not val.valid:
            logger.warning("DM-002 Validation failed: %s", val.errors)
            return {
                "document_id": None,
                "ingestion_status": "validation_failed",
                "validation_errors": val.errors,
            }

        # ── DM-003 Register ───────────────────────────────────────────
        document_id = str(uuid.uuid4())

        registry_entry = DocumentRegistry(
            document_id      = document_id,
            source_channel   = source_channel,
            original_filename= original_filename,
            file_type        = val.file_type,
            file_size_bytes  = val.file_size,
            content_hash     = val.content_hash,
            ingestion_status = "registered",
            sender_info      = sender_info,
            source_system    = source_system or source_channel,
            user_id          = user_id,
            company_id       = company_id,
        )
        self._db.add(registry_entry)

        self._log_event(document_id, "REGISTERED", {
            "channel": source_channel,
            "filename": original_filename,
            "file_type": val.file_type,
            "file_size": val.file_size,
        })
        self._db.commit()

        self._kafka.emit_ingested(document_id, source_channel, original_filename)
        logger.info("DM-003 Registered: document_id=%s", document_id)

        return {
            "document_id":     document_id,
            "ingestion_status": "registered",
            "file_type":       val.file_type,
            "content_hash":    val.content_hash,
            "validation_errors": [],
            # Pass raw bytes forward for the pipeline (not persisted in return value)
            "_file_bytes":     file_bytes,
        }

    def run_pipeline(
        self,
        document_id: str,
        file_bytes: bytes,
    ) -> Dict[str, Any]:
        """
        DM-004 → DM-007: Full processing pipeline (run in background).

        Parameters
        ----------
        document_id : UUID assigned in accept().
        file_bytes  : Raw file bytes accepted in DM-001.
        """
        entry = self._db.query(DocumentRegistry).filter_by(document_id=document_id).first()
        if not entry:
            logger.error("run_pipeline: document_id %s not found.", document_id)
            return {"error": "document_id not found"}

        file_type      = entry.file_type or ""
        source_channel = entry.source_channel

        try:
            # ── DM-004 Preprocess ─────────────────────────────────────
            logger.info("DM-004 Preprocessing: %s", document_id)
            processed_bytes = preprocessor.preprocess(file_bytes, file_type)
            self._update_status(entry, "preprocessed")
            self._log_event(document_id, "PREPROCESSED", {"file_type": file_type})
            self._kafka.emit_preprocessed(document_id)

            # ── Deduplication ─────────────────────────────────────────
            text_sample = language_detector._extract_text_sample(processed_bytes, file_type)
            is_dup, dup_of, dup_conf = check_duplicate(document_id, text_sample)
            entry.is_duplicate       = is_dup
            entry.duplicate_of       = dup_of
            entry.duplicate_confidence = dup_conf
            if is_dup:
                logger.warning("Duplicate detected: %s ≈ %s (%.2f)", document_id, dup_of, dup_conf)
                self._log_event(document_id, "DUPLICATE_DETECTED",
                                {"duplicate_of": dup_of, "confidence": dup_conf})

            # ── DM-005 Language + Document type ──────────────────────
            logger.info("DM-005 Classifying: %s", document_id)
            detected = language_detector.detect_language_and_type(
                processed_bytes, file_type, source_channel
            )
            entry.language                 = detected["language"]
            entry.document_type            = detected["document_type"]
            entry.classification_confidence = detected["classification_confidence"]
            self._update_status(entry, "classified")
            self._log_event(document_id, "CLASSIFIED", {
                "language": detected["language"],
                "document_type": detected["document_type"],
                "confidence": detected["classification_confidence"],
            })
            self._kafka.emit_classified(document_id, detected["document_type"], detected["language"])

            # ── DM-006 Tag metadata ───────────────────────────────────
            metadata_tags = self._build_metadata_tags(entry, detected)
            entry.metadata_tags = metadata_tags
            self._log_event(document_id, "METADATA_TAGGED", metadata_tags)

            # ── DM-007 Store in Raw data lake tier ────────────────────
            logger.info("DM-007 Storing raw: %s", document_id)
            content_type = self._content_type_for(file_type)
            raw_path = self._lake.store_raw(
                document_id, file_bytes, entry.original_filename or document_id, content_type
            )
            entry.raw_lake_path = raw_path
            entry.current_tier  = "raw"
            self._update_status(entry, "stored")
            self._log_event(document_id, "STORED_RAW", {"path": raw_path})
            self._kafka.emit_stored(document_id, "raw", raw_path)

            # ── Promote to Processed tier (structured JSON) ───────────
            processed_payload = {
                "document_id":   document_id,
                "document_type": detected["document_type"],
                "language":      detected["language"],
                "source_channel": source_channel,
                "original_filename": entry.original_filename,
                "file_type":     file_type,
                "content_hash":  entry.content_hash,
                "text_sample":   detected.get("text_sample", ""),
                "metadata_tags": metadata_tags,
                "is_duplicate":  is_dup,
                "duplicate_of":  dup_of,
                "ingested_at":   datetime.utcnow().isoformat(),
            }
            processed_path = self._lake.store_processed(document_id, processed_payload)
            entry.processed_lake_path = processed_path
            entry.current_tier        = "processed"
            entry.processed_at        = datetime.utcnow()
            self._log_event(document_id, "STORED_PROCESSED", {"path": processed_path})
            self._kafka.emit_stored(document_id, "processed", processed_path)

            self._db.commit()
            logger.info("Pipeline complete: document_id=%s tier=processed", document_id)

            return {
                "document_id":    document_id,
                "document_type":  detected["document_type"],
                "language":       detected["language"],
                "raw_lake_path":  raw_path,
                "processed_path": processed_path,
                "is_duplicate":   is_dup,
                "duplicate_of":   dup_of,
                "ingestion_status": "stored",
            }

        except Exception as exc:
            logger.exception("Pipeline failed for %s: %s", document_id, exc)
            entry.ingestion_status = "failed"
            entry.validation_errors = {"pipeline_error": str(exc)}
            self._db.commit()
            self._kafka.emit_failed(document_id, str(exc), "pipeline")
            return {"document_id": document_id, "error": str(exc)}

    # ── Helpers ───────────────────────────────────────────────────────────

    def _update_status(self, entry: DocumentRegistry, status: str):
        entry.ingestion_status = status
        self._db.flush()

    def _log_event(self, document_id: str, event_type: str, data: Optional[dict] = None):
        log = IntakeEventLog(
            document_id=document_id,
            event_type=event_type,
            event_data=data or {},
        )
        self._db.add(log)
        self._db.flush()

    @staticmethod
    def _build_metadata_tags(entry: DocumentRegistry, detected: dict) -> dict:
        return {
            "document_id":   entry.document_id,
            "document_type": detected.get("document_type"),
            "language":      detected.get("language"),
            "source_system": entry.source_system,
            "source_channel": entry.source_channel,
            "original_filename": entry.original_filename,
            "file_type":     entry.file_type,
            "file_size_bytes": entry.file_size_bytes,
            "content_hash":  entry.content_hash,
            "timestamp":     datetime.utcnow().isoformat(),
            "sender_info":   entry.sender_info,
        }

    @staticmethod
    def _content_type_for(file_type: str) -> str:
        _map = {
            "pdf":  "application/pdf",
            "jpeg": "image/jpeg",
            "png":  "image/png",
            "tiff": "image/tiff",
            "xml":  "application/xml",
            "json": "application/json",
            "edi":  "application/edi-x12",
            "wav":  "audio/wav",
            "mp3":  "audio/mpeg",
            "m4a":  "audio/mp4",
            "ogg":  "audio/ogg",
            "flac": "audio/flac",
        }
        return _map.get((file_type or "").lower(), "application/octet-stream")
