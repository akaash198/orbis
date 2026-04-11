"""
M03 Multilingual Preprocessor — XLM-RoBERTa.

Why XLM-RoBERTa?
  - Trained on 100 languages — handles Devanagari, CJK, Arabic, Latin
  - Used here to: (a) validate input tokenisability, (b) count tokens for
    truncation decisions, (c) provide language-aware normalisation hints
  - Lightweight base model (~279MB) runs on CPU alongside the main process

Flow:
  1. Detect language (langdetect)
  2. If non-English → log + add [LANG] prefix hint for LLM context
  3. Tokenise with XLM-RoBERTa to verify the model can process the text
  4. Return normalised string + detected language code
"""

import logging
import re
from typing import Tuple

logger = logging.getLogger(__name__)

# XLM-RoBERTa is loaded lazily and cached (model is ~279MB)
_tokenizer = None


def _load_tokenizer():
    global _tokenizer
    if _tokenizer is not None:
        return _tokenizer
    try:
        from transformers import AutoTokenizer
        _tokenizer = AutoTokenizer.from_pretrained("xlm-roberta-base")
        logger.info("XLM-RoBERTa tokenizer loaded: xlm-roberta-base")
    except Exception as exc:
        logger.warning("XLM-RoBERTa load failed (%s) — multilingual check skipped", exc)
        _tokenizer = None
    return _tokenizer


def detect_language(text: str) -> str:
    """
    Detect ISO 639-1 language code. Falls back to 'en' on error.

    langdetect is unreliable on short strings (< 20 chars or < 4 words) —
    it routinely misclassifies English product names like "laptop" as Catalan
    or "solar panel" as Italian. Only run detection on longer inputs.
    """
    words = text.strip().split()
    if len(words) < 4 or len(text.strip()) < 20:
        return "en"
    try:
        from langdetect import detect
        return detect(text)
    except Exception:
        return "en"


def normalize_text(text: str) -> Tuple[str, str]:
    """
    Clean and normalize a product description for downstream embedding.

    Steps:
      1. Strip, collapse whitespace, remove control characters
      2. Detect language
      3. If non-English: prefix with [LANG] hint for LLM context awareness
      4. Verify XLM-RoBERTa can tokenise (confirms multilingual support)

    Returns
    -------
    (normalized_text, detected_language_code)
    """
    # Basic cleaning
    normalized = re.sub(r"[\x00-\x1f\x7f]", " ", text)   # strip control chars
    normalized = re.sub(r"\s+", " ", normalized).strip()   # collapse whitespace

    lang = detect_language(normalized)
    logger.debug("Language detected: %s for input: %.60s...", lang, normalized)

    if lang != "en":
        # Add language hint so the LLM knows it's processing a non-English input
        normalized = f"[{lang.upper()}] {normalized}"

        # Verify tokenisability with XLM-RoBERTa
        tokenizer = _load_tokenizer()
        if tokenizer:
            try:
                tokens = tokenizer(
                    normalized,
                    return_tensors="pt",
                    truncation=True,
                    max_length=512,
                )
                token_count = tokens["input_ids"].shape[1]
                logger.info(
                    "XLM-RoBERTa: %d tokens for lang=%s input (%.60s...)",
                    token_count, lang, normalized
                )
            except Exception as exc:
                logger.warning("XLM-RoBERTa tokenisation check failed: %s", exc)

    return normalized, lang
