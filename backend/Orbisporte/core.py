from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
from pathlib import Path
from dotenv import load_dotenv

# Get the backend directory (2 levels up from this file)
BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

# IMPORTANT: override=True forces .env to override system environment variables
load_dotenv(dotenv_path=ENV_FILE, override=True)

# Database configuration - read directly from .env
DATABASE_URL = os.getenv("DATABASE_URL")

# If still not found, construct it from individual parts
if not DATABASE_URL or "yourpassword" in DATABASE_URL or "/local" in DATABASE_URL:
    DB_USER = os.getenv("DB_USER", "nexora")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "orbisporte_db")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print(f"[WARNING] Constructed DATABASE_URL from individual variables")

print(f"[INFO] Loading .env from: {ENV_FILE}")
print(f"[INFO] DATABASE_URL: {DATABASE_URL}")

# Create engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)
    print("[SUCCESS] Database initialized successfully!")
