from sqlalchemy.orm import Session
from Orbisporte.domain.models import User, Company, ProcessedDocument, RefreshToken
from Orbisporte.core import SessionLocal
from datetime import datetime, timedelta
import secrets


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class UserRepository:
    @staticmethod
    def create_user(db: Session, **kwargs):
        """Create a new user"""
        #Extract password before creating user instance
        password = kwargs.pop('password', None)
        # Create user with remaining fields
        user = User(**kwargs)
        
        # Set password if provided
        if password:
             user.set_password(password)
        
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_by_username(db: Session, username: str):
        """Get user by username"""
        return db.query(User).filter(User.user_name == username).first()

    @staticmethod
    def get_by_email(db: Session, email: str):
        """Get user by email"""
        return db.query(User).filter(User.email_id == email).first()

    @staticmethod
    def get_by_id(db: Session, user_id: int):
        """Get user by ID"""
        return db.query(User).filter(User.id == user_id).first()


class CompanyRepository:
    @staticmethod
    def create_company(db: Session, name: str, gst_number: str = None, iec_number: str = None):
        """Create a new company"""
        company = Company(name=name, gst_number=gst_number, iec_number=iec_number)
        db.add(company)
        db.commit()
        db.refresh(company)
        return company

    @staticmethod
    def get_by_id(db: Session, company_id: int):
        """Get company by ID"""
        return db.query(Company).filter(Company.id == company_id).first()


class DocumentRepository:
    @staticmethod
    def create_document(db: Session, **kwargs):
        """Create a new document record"""
        document = ProcessedDocument(**kwargs)
        db.add(document)
        db.commit()
        db.refresh(document)
        return document

    @staticmethod
    def get_by_id(db: Session, doc_id: int):
        """Get document by ID"""
        return db.query(ProcessedDocument).filter(ProcessedDocument.id == doc_id).first()

    @staticmethod
    def get_user_documents(db: Session, user_id: int, limit: int = 100):
        """Get all documents for a user"""
        return (
            db.query(ProcessedDocument)
            .filter(ProcessedDocument.user_id == user_id)
            .order_by(ProcessedDocument.created_at.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def update_document(db: Session, doc_id: int, **kwargs):
        """Update document fields"""
        document = db.query(ProcessedDocument).filter(ProcessedDocument.id == doc_id).first()
        if document:
            for key, value in kwargs.items():
                setattr(document, key, value)
            db.commit()
            db.refresh(document)
        return document

    @staticmethod
    def delete_document(db: Session, doc_id: int):
        """Delete a document"""
        document = db.query(ProcessedDocument).filter(ProcessedDocument.id == doc_id).first()
        if document:
            db.delete(document)
            db.commit()
            return True
        return False


class RefreshTokenRepository:
    @staticmethod
    def create_token(db: Session, user_id: int, expires_in_days: int = 30):
        """Create a new refresh token"""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

        refresh_token = RefreshToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        db.add(refresh_token)
        db.commit()
        db.refresh(refresh_token)
        return refresh_token

    @staticmethod
    def get_by_token(db: Session, token: str):
        """Get refresh token by token string"""
        return db.query(RefreshToken).filter(
            RefreshToken.token == token,
            RefreshToken.revoked == 0,
            RefreshToken.expires_at > datetime.utcnow()
        ).first()

    @staticmethod
    def revoke_token(db: Session, token: str):
        """Revoke a refresh token"""
        refresh_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
        if refresh_token:
            refresh_token.revoked = 1
            db.commit()
            return True
        return False

    @staticmethod
    def revoke_all_user_tokens(db: Session, user_id: int):
        """Revoke all tokens for a user"""
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).update({"revoked": 1})
        db.commit()
