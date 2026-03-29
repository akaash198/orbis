"""
Three-tier Data Lake storage adapter.

Tiers
-----
  raw       – Original uploaded files, unchanged (audit / archive)
  processed – Parsed structured data as JSON
  curated   – ML-ready feature datasets

Primary backend: RustFS (S3-compatible, Apache 2.0 licence).
Fallback:        Local filesystem (for development / CI without RustFS).
"""

import os
import json
import logging
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── RustFS / S3 client (optional import) ────────────────────────────────────
try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
    _BOTO3_AVAILABLE = True
except ImportError:
    _BOTO3_AVAILABLE = False
    logger.warning("boto3 not installed — Data Lake will use local filesystem fallback.")

# ─────────────────────────────────────────────────────────────────────────────
TIER_BUCKETS = {
    "raw":       os.getenv("DATALAKE_RAW_BUCKET",       "orbis-raw"),
    "processed": os.getenv("DATALAKE_PROCESSED_BUCKET", "orbis-processed"),
    "curated":   os.getenv("DATALAKE_CURATED_BUCKET",   "orbis-curated"),
}

RUSTFS_ENDPOINT  = os.getenv("RUSTFS_ENDPOINT",   "http://localhost:9000")
RUSTFS_ACCESS_KEY = os.getenv("RUSTFS_ACCESS_KEY", "minioadmin")
RUSTFS_SECRET_KEY = os.getenv("RUSTFS_SECRET_KEY", "minioadmin")
DATALAKE_LOCAL_ROOT = Path(os.getenv("DATALAKE_LOCAL_ROOT", "./data_lake"))


# ─────────────────────────────────────────────────────────────────────────────
class DataLake:
    """
    Unified interface for the three-tier data lake.

    Usage:
        lake = DataLake()
        path = lake.store_raw(document_id, file_bytes, "invoice.pdf", "application/pdf")
        json_path = lake.store_processed(document_id, extracted_dict)
        lake.promote_to_processed(document_id)
    """

    def __init__(self):
        self._s3 = self._init_s3_client()
        if self._s3:
            self._ensure_buckets()
        else:
            self._init_local_dirs()

    # ── Initialisation ────────────────────────────────────────────────────

    def _init_s3_client(self):
        if not _BOTO3_AVAILABLE:
            return None
        if os.getenv("DATALAKE_USE_LOCAL", "false").lower() == "true":
            return None
        try:
            client = boto3.client(
                "s3",
                endpoint_url=RUSTFS_ENDPOINT,
                aws_access_key_id=RUSTFS_ACCESS_KEY,
                aws_secret_access_key=RUSTFS_SECRET_KEY,
                config=Config(signature_version="s3v4"),
                region_name="us-east-1",
            )
            # Smoke-test the connection
            client.list_buckets()
            logger.info("DataLake: Connected to RustFS at %s", RUSTFS_ENDPOINT)
            return client
        except Exception as exc:
            logger.warning("DataLake: RustFS unreachable (%s) — falling back to local FS.", exc)
            return None

    def _ensure_buckets(self):
        for tier, bucket in TIER_BUCKETS.items():
            try:
                self._s3.head_bucket(Bucket=bucket)
            except Exception:
                try:
                    self._s3.create_bucket(Bucket=bucket)
                    logger.info("DataLake: Created bucket '%s' for tier '%s'.", bucket, tier)
                except Exception as exc:
                    logger.error("DataLake: Cannot create bucket '%s': %s", bucket, exc)

    def _init_local_dirs(self):
        for tier in TIER_BUCKETS:
            (DATALAKE_LOCAL_ROOT / tier).mkdir(parents=True, exist_ok=True)
        logger.info("DataLake: Using local filesystem at %s", DATALAKE_LOCAL_ROOT)

    # ── Internal helpers ──────────────────────────────────────────────────

    def _object_key(self, document_id: str, filename: str, tier: str) -> str:
        """Partition by date for efficient lifecycle management."""
        date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
        return f"{date_prefix}/{document_id}/{filename}"

    def _put_object(self, tier: str, key: str, data: bytes,
                    content_type: str = "application/octet-stream") -> str:
        """Store bytes in the appropriate tier. Returns the canonical path."""
        if self._s3:
            bucket = TIER_BUCKETS[tier]
            self._s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
            return f"s3://{bucket}/{key}"
        else:
            local_path = DATALAKE_LOCAL_ROOT / tier / key
            local_path.parent.mkdir(parents=True, exist_ok=True)
            local_path.write_bytes(data)
            return str(local_path)

    def _get_object(self, tier: str, key: str) -> Optional[bytes]:
        """Retrieve bytes from a tier."""
        if self._s3:
            bucket = TIER_BUCKETS[tier]
            try:
                resp = self._s3.get_object(Bucket=bucket, Key=key)
                return resp["Body"].read()
            except Exception as exc:
                logger.error("DataLake get_object failed: %s", exc)
                return None
        else:
            local_path = DATALAKE_LOCAL_ROOT / tier / key
            return local_path.read_bytes() if local_path.exists() else None

    # ── Public API ────────────────────────────────────────────────────────

    def store_raw(self, document_id: str, file_bytes: bytes,
                  original_filename: str, content_type: str = "application/octet-stream") -> str:
        """
        DM-007: Store original file in the Raw tier (unchanged).
        Returns the canonical storage path.
        """
        key = self._object_key(document_id, original_filename, "raw")
        path = self._put_object("raw", key, file_bytes, content_type)
        logger.info("DataLake RAW stored: %s → %s", document_id, path)
        return path

    def store_processed(self, document_id: str, extracted_data: dict) -> str:
        """
        Promote document to Processed tier as structured JSON.
        Returns the canonical storage path.
        """
        payload = json.dumps(extracted_data, ensure_ascii=False, indent=2).encode("utf-8")
        key = self._object_key(document_id, "extracted.json", "processed")
        path = self._put_object("processed", key, payload, "application/json")
        logger.info("DataLake PROCESSED stored: %s → %s", document_id, path)
        return path

    def store_curated(self, document_id: str, features: dict) -> str:
        """
        Promote document to Curated tier (ML-ready feature set).
        Returns the canonical storage path.
        """
        payload = json.dumps(features, ensure_ascii=False, indent=2).encode("utf-8")
        key = self._object_key(document_id, "features.json", "curated")
        path = self._put_object("curated", key, payload, "application/json")
        logger.info("DataLake CURATED stored: %s → %s", document_id, path)
        return path

    def retrieve_raw(self, document_id: str, filename: str) -> Optional[bytes]:
        """Retrieve original bytes from the Raw tier."""
        # Try with today's date prefix; fall back to a list-based lookup if needed
        key = self._object_key(document_id, filename, "raw")
        return self._get_object("raw", key)

    def retrieve_processed(self, document_id: str) -> Optional[dict]:
        """Retrieve structured JSON from the Processed tier."""
        key = self._object_key(document_id, "extracted.json", "processed")
        raw = self._get_object("processed", key)
        if raw:
            return json.loads(raw.decode("utf-8"))
        return None

    def health_check(self) -> dict:
        """Returns connectivity status and tier availability."""
        backend = "rustfs" if self._s3 else "local_filesystem"
        tiers_ok = {}
        for tier, bucket in TIER_BUCKETS.items():
            if self._s3:
                try:
                    self._s3.head_bucket(Bucket=bucket)
                    tiers_ok[tier] = True
                except Exception:
                    tiers_ok[tier] = False
            else:
                tiers_ok[tier] = (DATALAKE_LOCAL_ROOT / tier).is_dir()
        return {"backend": backend, "tiers": tiers_ok}


# Module-level singleton
_lake_instance: Optional[DataLake] = None


def get_data_lake() -> DataLake:
    global _lake_instance
    if _lake_instance is None:
        _lake_instance = DataLake()
    return _lake_instance
