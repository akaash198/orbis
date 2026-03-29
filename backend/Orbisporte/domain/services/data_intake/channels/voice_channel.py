"""
Voice / Audio input channel.

Converts spoken trade details (invoice data, shipment info) to text using
OpenAI Whisper (via the OpenAI API), then extracts structured fields from
the transcript with a lightweight LLM prompt.

Supported audio formats: WAV, MP3, M4A, OGG, FLAC (up to 25 MB per API limit).

Configuration
-------------
  OPENAI_API_KEY         Your OpenAI API key (shared with existing LLM usage)
  WHISPER_MODEL          Whisper model to use (default: whisper-1)
  WHISPER_LANGUAGE       ISO 639-1 language hint, optional (e.g. "en", "hi")
"""

import io
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Dict, Optional

logger = logging.getLogger(__name__)

WHISPER_MODEL    = os.getenv("WHISPER_MODEL",    "whisper-1")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "")  # empty = auto-detect

try:
    import openai
    _OPENAI_AVAILABLE = True
except ImportError:
    _OPENAI_AVAILABLE = False
    logger.warning("openai package not installed — voice channel ASR disabled.")


@dataclass
class TranscriptionResult:
    transcript: str
    language: str = "unknown"
    duration_seconds: float = 0.0
    extracted_fields: Dict = field(default_factory=dict)
    errors: list = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
_EXTRACTION_PROMPT = """You are a trade document assistant. Extract structured data from the
following speech transcript. Return ONLY a JSON object with these fields
(use null if not mentioned):

{{
  "document_type": "invoice | shipment | bill_of_lading | customs_declaration | other",
  "invoice_number": null,
  "invoice_date": null,
  "seller_name": null,
  "buyer_name": null,
  "hs_code": null,
  "goods_description": null,
  "quantity": null,
  "unit_price": null,
  "currency": null,
  "total_amount": null,
  "port_of_loading": null,
  "port_of_discharge": null,
  "shipment_date": null,
  "tracking_id": null,
  "notes": null
}}

Transcript:
{transcript}"""


def _extract_fields_from_transcript(transcript: str) -> dict:
    """
    Use the OpenAI chat API to extract structured trade fields from text.
    Returns a dict of extracted fields or empty dict on failure.
    """
    if not _OPENAI_AVAILABLE or not transcript.strip():
        return {}

    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return {}

        client = openai.OpenAI(api_key=api_key)
        prompt = _EXTRACTION_PROMPT.format(transcript=transcript[:4000])

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=512,
        )
        raw_json = response.choices[0].message.content
        return json.loads(raw_json)

    except Exception as exc:
        logger.error("Field extraction from transcript failed: %s", exc)
        return {}


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.wav") -> TranscriptionResult:
    """
    Convert audio bytes to a text transcript via OpenAI Whisper.

    Parameters
    ----------
    audio_bytes : Raw audio file bytes (WAV, MP3, M4A, OGG, FLAC).
    filename    : Filename including extension so Whisper infers the format.

    Returns
    -------
    TranscriptionResult with .transcript and .extracted_fields.
    """
    result = TranscriptionResult(transcript="")

    if not _OPENAI_AVAILABLE:
        result.errors.append("openai package not installed.")
        return result

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        result.errors.append("OPENAI_API_KEY not set — cannot use Whisper.")
        return result

    if len(audio_bytes) > 25 * 1024 * 1024:
        result.errors.append("Audio file exceeds 25 MB Whisper limit.")
        return result

    try:
        client = openai.OpenAI(api_key=api_key)
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename  # Whisper uses this to detect format

        transcribe_kwargs = {
            "model": WHISPER_MODEL,
            "file": audio_file,
            "response_format": "verbose_json",
        }
        if WHISPER_LANGUAGE:
            transcribe_kwargs["language"] = WHISPER_LANGUAGE

        response = client.audio.transcriptions.create(**transcribe_kwargs)

        result.transcript       = response.text
        result.language         = getattr(response, "language", "unknown")
        result.duration_seconds = getattr(response, "duration", 0.0)

        logger.info(
            "Whisper transcribed %.1fs of audio (lang=%s, %d chars).",
            result.duration_seconds, result.language, len(result.transcript)
        )

        # Extract structured trade fields from transcript
        result.extracted_fields = _extract_fields_from_transcript(result.transcript)

    except Exception as exc:
        logger.error("Whisper transcription failed: %s", exc)
        result.errors.append(str(exc))

    return result
