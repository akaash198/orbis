"""
M03 Embedder — OpenAI text-embedding-3-small.

Generates 1536-dim semantic vectors for product descriptions.
Uses the same OPENAI_API_KEY already configured for GPT-4o-mini.
"""

import hashlib
import logging
import os
from typing import List

logger = logging.getLogger(__name__)

EMBED_MODEL   = "text-embedding-3-small"
EMBEDDING_DIM = 1536
BATCH_SIZE    = 128

# In-process LRU cache — avoids re-embedding identical queries within the same worker
_embed_cache: dict = {}
_CACHE_MAX   = 512


def _get_client():
    from openai import OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)


def get_embedding(text: str) -> List[float]:
    """
    Generate a single 1536-dim embedding for a product description.
    Results are cached in-process so repeated queries skip the API call.
    """
    key = hashlib.md5(text.strip().lower().encode()).hexdigest()
    if key in _embed_cache:
        logger.debug("Embedding cache hit for: %.60s", text)
        return _embed_cache[key]

    client = _get_client()
    response = client.embeddings.create(input=[text], model=EMBED_MODEL)
    embedding = response.data[0].embedding
    logger.debug("Embedded query (%d chars) → %d-dim", len(text), len(embedding))

    if len(_embed_cache) >= _CACHE_MAX:
        # evict oldest entry
        _embed_cache.pop(next(iter(_embed_cache)))
    _embed_cache[key] = embedding
    return embedding


def get_embeddings_batch(texts: List[str], input_type: str = "document") -> List[List[float]]:
    """Batch-embed texts. input_type is accepted for API compatibility."""
    client = _get_client()
    all_embeddings: List[List[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i: i + BATCH_SIZE]
        response = client.embeddings.create(input=batch, model=EMBED_MODEL)
        batch_embs = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        all_embeddings.extend(batch_embs)
        logger.info("Embedded batch %d-%d / %d", i + 1, min(i + BATCH_SIZE, len(texts)), len(texts))
    return all_embeddings


def embedding_model_info() -> dict:
    return {"provider": "openai", "model": EMBED_MODEL, "dim": EMBEDDING_DIM}
