"""
Semantic deduplication using all-MiniLM-L6-v2 + FAISS.

Strategy
--------
  1. Extract a text fingerprint from the document.
  2. Encode it with the sentence-transformer model (all-MiniLM-L6-v2).
  3. Query the FAISS index for the nearest neighbours.
  4. If cosine similarity ≥ threshold, flag as duplicate.
  5. Add the new embedding to the index (for future comparisons).

The FAISS index is kept in-memory and optionally persisted to disk.
For large deployments the index should be shared via a vector database
(e.g. pgvector or Qdrant); the interface here is intentionally abstract.

Similarity threshold: 0.92  (configurable via DEDUP_THRESHOLD env var)
"""

import json
import logging
import os
import pickle
from pathlib import Path
from typing import Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

DEDUP_THRESHOLD    = float(os.getenv("DEDUP_THRESHOLD", "0.92"))
FAISS_INDEX_PATH   = Path(os.getenv("FAISS_INDEX_PATH", "./data/faiss_dedup.index"))
FAISS_META_PATH    = Path(os.getenv("FAISS_META_PATH",  "./data/faiss_dedup_meta.pkl"))
MODEL_NAME         = "all-MiniLM-L6-v2"
EMBEDDING_DIM      = 384  # MiniLM output dimension

# ── Optional heavy imports ────────────────────────────────────────────────────
try:
    from sentence_transformers import SentenceTransformer
    _ST_AVAILABLE = True
except ImportError:
    _ST_AVAILABLE = False
    logger.warning("sentence-transformers not installed — semantic deduplication disabled.")

try:
    import faiss
    _FAISS_AVAILABLE = True
except ImportError:
    _FAISS_AVAILABLE = False
    logger.warning("faiss-cpu not installed — semantic deduplication disabled.")

_DEDUP_AVAILABLE = _ST_AVAILABLE and _FAISS_AVAILABLE


# ─────────────────────────────────────────────────────────────────────────────
class SemanticDeduplicator:
    """
    Maintains a FAISS flat inner-product index of document embeddings.
    All vectors are L2-normalised so inner-product == cosine similarity.
    """

    def __init__(self):
        self._model = None
        self._index = None
        self._meta: list[dict] = []  # [{document_id, text_snippet}]
        self._loaded = False

    def _ensure_loaded(self):
        if self._loaded:
            return
        if not _DEDUP_AVAILABLE:
            return

        # Load or create model
        try:
            self._model = SentenceTransformer(MODEL_NAME)
            logger.info("SemanticDeduplicator: loaded model '%s'.", MODEL_NAME)
        except Exception as exc:
            logger.error("SemanticDeduplicator: cannot load model: %s", exc)
            return

        # Load or create FAISS index
        if FAISS_INDEX_PATH.exists() and FAISS_META_PATH.exists():
            try:
                self._index = faiss.read_index(str(FAISS_INDEX_PATH))
                with open(FAISS_META_PATH, "rb") as f:
                    self._meta = pickle.load(f)
                logger.info("SemanticDeduplicator: loaded FAISS index with %d vectors.", self._index.ntotal)
            except Exception as exc:
                logger.warning("SemanticDeduplicator: could not load index (%s) — starting fresh.", exc)
                self._index = None
                self._meta = []

        if self._index is None:
            # Inner-product index (cosine similarity after normalisation)
            self._index = faiss.IndexFlatIP(EMBEDDING_DIM)

        self._loaded = True

    def _encode(self, text: str) -> Optional[np.ndarray]:
        """Encode text to a normalised embedding vector."""
        if self._model is None:
            return None
        vec = self._model.encode([text], normalize_embeddings=True, show_progress_bar=False)
        return vec.astype("float32")

    def _persist(self):
        """Persist index and metadata to disk."""
        try:
            FAISS_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
            faiss.write_index(self._index, str(FAISS_INDEX_PATH))
            with open(FAISS_META_PATH, "wb") as f:
                pickle.dump(self._meta, f)
        except Exception as exc:
            logger.warning("SemanticDeduplicator: persist failed: %s", exc)

    def check_and_register(
        self,
        document_id: str,
        text_fingerprint: str,
    ) -> Tuple[bool, Optional[str], float]:
        """
        Check for semantic duplicates and register the new embedding.

        Parameters
        ----------
        document_id      : UUID of the incoming document.
        text_fingerprint : Short text representing the document content.

        Returns
        -------
        (is_duplicate, duplicate_of_id, similarity_score)
        """
        self._ensure_loaded()

        if not _DEDUP_AVAILABLE or self._model is None or self._index is None:
            # Dedup not available — treat as unique
            return False, None, 0.0

        if not text_fingerprint or len(text_fingerprint.strip()) < 20:
            return False, None, 0.0

        vec = self._encode(text_fingerprint)
        if vec is None:
            return False, None, 0.0

        is_duplicate = False
        duplicate_of = None
        similarity   = 0.0

        # Search only if index has entries
        if self._index.ntotal > 0:
            distances, indices = self._index.search(vec, k=1)
            sim = float(distances[0][0])
            idx = int(indices[0][0])

            if sim >= DEDUP_THRESHOLD and 0 <= idx < len(self._meta):
                is_duplicate = True
                duplicate_of = self._meta[idx]["document_id"]
                similarity   = round(sim, 4)
                logger.info(
                    "Duplicate detected: %s ≈ %s (cosine=%.3f)",
                    document_id, duplicate_of, similarity
                )

        # Always register the new embedding (even duplicates — for dedup of duplicates)
        self._index.add(vec)
        self._meta.append({"document_id": document_id, "snippet": text_fingerprint[:200]})
        self._persist()

        return is_duplicate, duplicate_of, similarity


# ── Module-level singleton ────────────────────────────────────────────────────
_deduplicator: Optional[SemanticDeduplicator] = None


def get_deduplicator() -> SemanticDeduplicator:
    global _deduplicator
    if _deduplicator is None:
        _deduplicator = SemanticDeduplicator()
    return _deduplicator


def check_duplicate(document_id: str, text_fingerprint: str) -> Tuple[bool, Optional[str], float]:
    """Module-level convenience wrapper."""
    return get_deduplicator().check_and_register(document_id, text_fingerprint)
