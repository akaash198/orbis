from sqlalchemy import Column, Integer, Text, String, ForeignKey, DateTime, JSON, BigInteger, Boolean, Float, SmallInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from Orbisporte.core import Base
import bcrypt


class Company(Base):
    __tablename__ = "Company"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    gst_number = Column(String(15), unique=True, nullable=True)
    iec_number = Column(String(10), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    users = relationship("User", back_populates="organization")
    documents = relationship("ProcessedDocument", back_populates="company")

    def __repr__(self):
        return f"<Company {self.name}>"


class User(Base):
    __tablename__ = "User"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    user_name = Column(Text, unique=True, nullable=False, index=True)
    email_id = Column(Text, unique=True, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("Company.id"), nullable=True)
    password_hash = Column(Text, nullable=False)
    mobile_number = Column(String(20), nullable=True)  # Increased to support international format with country code
    role = Column(Text, nullable=False, default="importer")
    location = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    organization = relationship("Company", back_populates="users")
    documents = relationship("ProcessedDocument", back_populates="user")

    # Target work factor: rounds=10 ≈ 100 ms on modern hardware.
    # OWASP 2024 recommends rounds ≥ 10 for bcrypt.
    # rounds=12 (old default) ≈ 400 ms — the cause of slow login.
    _BCRYPT_ROUNDS = 10

    def set_password(self, password: str):
        """Hash and set password using bcrypt with rounds=10."""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt(rounds=self._BCRYPT_ROUNDS),
        ).decode('utf-8')

    def verify_password(self, password: str) -> bool:
        """Verify password against stored hash."""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8'),
        )

    def _stored_rounds(self) -> int:
        """Read the work factor encoded in the stored bcrypt hash."""
        try:
            # Hash format: $2b$<rounds>$<salt+digest>
            return int(self.password_hash.split('$')[2])
        except Exception:
            return self._BCRYPT_ROUNDS

    def upgrade_hash_if_needed(self, db_session, password: str) -> bool:
        """
        Transparently re-hash the password at the current target work factor
        if the stored hash was created with a higher (slower) work factor.

        Call this after a successful verify_password() so that existing users
        with rounds=12 hashes are silently upgraded to rounds=10 on next login,
        reducing all subsequent logins from ~400 ms to ~100 ms.

        Returns True if a re-hash was performed.
        """
        if self._stored_rounds() <= self._BCRYPT_ROUNDS:
            return False
        self.set_password(password)
        db_session.add(self)
        db_session.commit()
        return True

    def __repr__(self):
        return f"<User {self.user_name}>"


class ProcessedDocument(Base):
    __tablename__ = "ProcessedDocuments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("User.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("Company.id"), nullable=True)
    filename = Column(Text, nullable=False)
    original_filename = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    file_type = Column(String(10), nullable=True)  # pdf, jpg, png

    # Document classification
    doc_type = Column(Text, nullable=True)  # bill_of_entry, shipping_bill, invoice, etc.
    classification_confidence = Column(Text, nullable=True)

    # Extracted data
    extracted_data = Column(JSON, nullable=True)

    # HS Code information
    hs_code = Column(String(10), nullable=True)
    hs_code_description = Column(Text, nullable=True)

    # Indian Customs specific
    gst_number = Column(String(15), nullable=True)
    iec_number = Column(String(10), nullable=True)

    # Metadata
    content_hash = Column(String(64), nullable=True, index=True)
    processing_status = Column(Text, default="uploaded")  # uploaded, classified, extracted, completed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="documents")
    company = relationship("Company", back_populates="documents")

    def __repr__(self):
        return f"<ProcessedDocument {self.filename}>"


class M02ExtractionResult(Base):
    """Stores per-document M02 pipeline output including confidence scores and routing."""
    __tablename__ = "m02_extraction_results"

    id                   = Column(Integer, primary_key=True, index=True)
    document_id          = Column(Integer, ForeignKey("ProcessedDocuments.id", ondelete="CASCADE"), nullable=True)
    user_id              = Column(Integer, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)

    # Document type identification (Stage 0)
    document_type            = Column(String(50), nullable=True)   # e.g. "commercial_invoice"
    document_type_confidence = Column(Float, nullable=True)
    document_type_signals    = Column(JSON, nullable=True)         # list of detected keyword signals

    ocr_text             = Column(Text, nullable=True)
    layout_blocks        = Column(JSON, nullable=True)
    raw_entities         = Column(JSON, nullable=True)
    extracted_fields     = Column(JSON, nullable=True)
    normalised_fields    = Column(JSON, nullable=True)
    confidence_scores    = Column(JSON, nullable=True)
    overall_confidence   = Column(Float, nullable=True)

    review_queue         = Column(String(30), default="auto")
    fields_auto          = Column(JSON, nullable=True)
    fields_soft_review   = Column(JSON, nullable=True)
    fields_hard_review   = Column(JSON, nullable=True)
    fields_low           = Column(JSON, nullable=True)
    quality_alert        = Column(Boolean, default=False)

    reviewed_fields      = Column(JSON, nullable=True)
    review_status        = Column(String(30), default="pending")
    reviewed_by          = Column(Integer, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    reviewed_at          = Column(DateTime(timezone=True), nullable=True)

    pipeline_duration_ms = Column(Integer, nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<M02ExtractionResult doc={self.document_id} queue={self.review_queue}>"


class DocumentRegistry(Base):
    """
    Central registry for every document ingested through any channel.
    Tracks the full lifecycle from raw ingestion through all data lake tiers.
    """
    __tablename__ = "document_registry"

    id                       = Column(Integer, primary_key=True, index=True)
    document_id              = Column(String(36), unique=True, nullable=False, index=True)  # UUID v4
    source_channel           = Column(String(50), nullable=False)   # api|sftp|email|portal|barcode|voice
    original_filename        = Column(Text, nullable=True)
    file_type                = Column(String(20), nullable=True)     # pdf|jpeg|png|tiff|xml|json|edi|wav
    file_size_bytes          = Column(BigInteger, nullable=True)
    content_hash             = Column(String(64), nullable=True, index=True)  # SHA-256

    # Classification (DM-004)
    document_type            = Column(Text, nullable=True)
    language                 = Column(String(20), nullable=True)     # ISO 639-1
    classification_confidence = Column(Float, nullable=True)

    # Source metadata
    source_system            = Column(Text, nullable=True)
    sender_info              = Column(Text, nullable=True)

    # Three-tier data lake paths
    raw_lake_path            = Column(Text, nullable=True)
    processed_lake_path      = Column(Text, nullable=True)
    curated_lake_path        = Column(Text, nullable=True)
    current_tier             = Column(String(20), default="raw")     # raw|processed|curated

    # Processing pipeline
    ingestion_status         = Column(String(50), default="pending") # pending|validated|registered|preprocessed|classified|stored|failed
    validation_errors        = Column(JSON, nullable=True)
    metadata_tags            = Column(JSON, nullable=True)

    # Deduplication (FAISS semantic similarity)
    is_duplicate             = Column(Boolean, default=False)
    duplicate_of             = Column(String(36), nullable=True)     # document_id of original
    duplicate_confidence     = Column(Float, nullable=True)

    # Ownership
    user_id                  = Column(Integer, ForeignKey("User.id"), nullable=True)
    company_id               = Column(Integer, ForeignKey("Company.id"), nullable=True)

    created_at               = Column(DateTime(timezone=True), server_default=func.now())
    updated_at               = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at             = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user                     = relationship("User", foreign_keys=[user_id])
    company                  = relationship("Company", foreign_keys=[company_id])
    events                   = relationship("IntakeEventLog", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DocumentRegistry {self.document_id} [{self.source_channel}] {self.ingestion_status}>"


class IntakeEventLog(Base):
    """Immutable audit trail — one row per pipeline stage transition."""
    __tablename__ = "intake_event_log"

    id          = Column(Integer, primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("document_registry.document_id", ondelete="CASCADE"), nullable=False, index=True)
    event_type  = Column(String(100), nullable=False)  # INGESTED|VALIDATED|PREPROCESSED|CLASSIFIED|STORED_RAW|…
    event_data  = Column(JSON, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("DocumentRegistry", back_populates="events")

    def __repr__(self):
        return f"<IntakeEventLog {self.document_id} → {self.event_type}>"


class M03ClassificationResult(Base):
    """Stores per-item M03 HSN classification pipeline output."""
    __tablename__ = "m03_classification_results"

    id                      = Column(Integer, primary_key=True, index=True)
    document_id             = Column(Integer, ForeignKey("ProcessedDocuments.id", ondelete="SET NULL"), nullable=True)
    user_id                 = Column(Integer, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)

    # Input
    product_description     = Column(Text, nullable=False)
    normalized_description  = Column(Text, nullable=True)
    detected_language       = Column(String(10), default="en")

    # Pipeline output
    top3_predictions        = Column(JSONB, nullable=True)   # [{hsn_code, confidence, reasoning, gri_rule}]
    selected_hsn            = Column(String(8), nullable=True)
    selected_confidence     = Column(Float, nullable=True)
    overall_confidence      = Column(Float, nullable=True)
    classification_notes    = Column(Text, nullable=True)
    candidates_retrieved    = Column(SmallInteger, default=0)

    # Routing (SOP HSN-003)
    routing                 = Column(String(30), default="human_review")  # auto | human_review

    # Post-processing flags
    scomet_flag             = Column(Boolean, default=False)
    trade_remedy_alert      = Column(Boolean, default=False)
    restricted_countries    = Column(JSONB, nullable=True)

    # Pipeline telemetry
    pipeline_stages         = Column(JSONB, nullable=True)
    pipeline_duration_ms    = Column(Integer, nullable=True)

    # Human review
    review_status           = Column(String(30), default="pending")  # pending | approved | rejected
    reviewed_by             = Column(Integer, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    reviewed_at             = Column(DateTime(timezone=True), nullable=True)
    reviewer_notes          = Column(Text, nullable=True)
    reviewer_hsn_override   = Column(String(8), nullable=True)

    created_at              = Column(DateTime(timezone=True), server_default=func.now())
    updated_at              = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<M03ClassificationResult hsn={self.selected_hsn} conf={self.selected_confidence} routing={self.routing}>"


class RefreshToken(Base):
    __tablename__ = "RefreshTokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("User.id"), nullable=False)
    token = Column(Text, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked = Column(Integer, default=0)  # 0 = active, 1 = revoked

    def __repr__(self):
        return f"<RefreshToken for user_id={self.user_id}>"
