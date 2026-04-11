from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    user_name: str
    password: str


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    user_name: str
    email_id: EmailStr
    password: str
    mobile_number: Optional[str] = None
    role: str = "importer"
    location: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    user_name: str
    email_id: str
    role: str
    mobile_number: Optional[str]
    location: Optional[str]

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class DocumentUploadResponse(BaseModel):
    id: int
    filename: str
    file_path: str
    doc_type: Optional[str]
    processing_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_path: str
    file_type: Optional[str]
    doc_type: Optional[str]
    classification_confidence: Optional[str]
    extracted_data: Optional[dict]
    hs_code: Optional[str]
    hs_code_description: Optional[str]
    gst_number: Optional[str]
    iec_number: Optional[str]
    processing_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentListItemResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_path: str
    file_type: Optional[str]
    doc_type: Optional[str]
    classification_confidence: Optional[str]
    has_extracted_data: bool
    hs_code: Optional[str]
    processing_status: str
    created_at: datetime
    content_hash: Optional[str]

    class Config:
        from_attributes = True


class HSCodeLookupRequest(BaseModel):
    description: str


class HSCodeLookupResponse(BaseModel):
    hscode: str
    description: str
    confidence: float


class GSTValidationRequest(BaseModel):
    gst_number: str


class GSTValidationResponse(BaseModel):
    valid: bool
    gst_number: str
    message: str


class IECValidationRequest(BaseModel):
    iec_number: str


class IECValidationResponse(BaseModel):
    valid: bool
    iec_number: str
    message: str
