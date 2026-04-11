import jwt
import os
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from Orbisporte.infrastructure.db import UserRepository, RefreshTokenRepository


SECRET_KEY = os.getenv("JWT_SECRET_KEY", "orbisporte-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def login_user(db: Session, username: str, password: str):
    """
    Authenticate user and return tokens.

    Returns dict with user info and tokens, or None if authentication fails.
    After successful verification, transparently re-hashes the password if
    it was stored with a higher work factor (e.g. rounds=12 → rounds=10)
    so subsequent logins are faster without any user-facing change.
    """
    user = UserRepository.get_by_username(db, username)

    if not user or not user.verify_password(password):
        return None

    # Silently upgrade stored hash to current target rounds if it's slower.
    # Runs in-process; the commit adds ~1 ms — negligible vs the hash cost.
    try:
        user.upgrade_hash_if_needed(db, password)
    except Exception:
        pass  # never block login on a rehash failure

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    # Create refresh token
    refresh_token_obj = RefreshTokenRepository.create_token(db, user.id)

    return {
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_name": user.user_name,
            "email_id": user.email_id,
            "role": user.role,
            "mobile_number": user.mobile_number,
            "location": user.location,
        },
        "access_token": access_token,
        "refresh_token": refresh_token_obj.token,
        "token_type": "bearer"
    }


def signup_user(db: Session, **user_data):
    """
    Create new user and return tokens

    Returns:
        dict with user info and tokens, or error dict
    """
    # Check if username or email already exists
    existing_user = UserRepository.get_by_username(db, user_data.get('user_name'))
    if existing_user:
        return {"error": "Username already exists"}

    existing_email = UserRepository.get_by_email(db, user_data.get('email_id'))
    if existing_email:
        return {"error": "Email already exists"}

    # Create user
    password = user_data.pop('password')
    user = UserRepository.create_user(db, password=password, **user_data)

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token_obj = RefreshTokenRepository.create_token(db, user.id)

    return {
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_name": user.user_name,
            "email_id": user.email_id,
            "role": user.role,
            "mobile_number": user.mobile_number,
            "location": user.location,
        },
        "access_token": access_token,
        "refresh_token": refresh_token_obj.token,
        "token_type": "bearer"
    }


def refresh_access_token(db: Session, refresh_token: str):
    """
    Generate new access token from refresh token

    Returns:
        dict with new access token or None
    """
    token_obj = RefreshTokenRepository.get_by_token(db, refresh_token)

    if not token_obj:
        return None

    user = UserRepository.get_by_id(db, token_obj.user_id)
    if not user:
        return None

    # Create new access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


def logout_user(db: Session, refresh_token: str):
    """Revoke refresh token"""
    return RefreshTokenRepository.revoke_token(db, refresh_token)
