# infrastructure/get_llm.py
"""
LLM client integration for OpenAI and Grok.
"""

from openai import OpenAI, AzureOpenAI
import os
from dotenv import load_dotenv
import requests
from typing import Any, Dict, List, Optional


class _ORMessage:
    def __init__(self, content: str, annotations: Optional[Any] = None):
        self.content = content
        # OpenRouter may include message.annotations for files
        if annotations is not None:
            self.annotations = annotations


class _ORChoice:
    def __init__(self, message: _ORMessage):
        self.message = message


class _ORResponse:
    def __init__(self, choices: List[_ORChoice], usage: Optional[Dict[str, Any]] = None):
        self.choices = choices
        if usage is not None:
            self.usage = usage


class _ChatCompletionsAPI:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        temperature: float = 0.0,
        max_tokens: Optional[int] = None,
        timeout: Optional[int] = None,
        **kwargs: Any,
    ) -> _ORResponse:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        # pass-through extra OpenRouter params if provided
        payload.update({k: v for k, v in kwargs.items() if v is not None})

        resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        # Map into OpenAI-like response objects
        choices: List[_ORChoice] = []
        for ch in data.get("choices", []) or []:
            msg = ch.get("message", {})
            content = msg.get("content", "")
            annotations = msg.get("annotations") if isinstance(msg, dict) else None
            choices.append(_ORChoice(_ORMessage(content=content, annotations=annotations)))
        return _ORResponse(choices=choices, usage=data.get("usage"))
# NOTE: Will be changed to google Genai client for faster and better file processing.

class OpenRouterHTTPClient:
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = (base_url or "https://openrouter.ai/api/v1").rstrip("/")
        self.chat = type("ChatAPI", (), {"completions": _ChatCompletionsAPI(api_key, self.base_url)})

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration for LLM clients."""
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = "gpt-4o-mini"
    GROK_API_KEY = os.getenv("GROK_API_KEY")
    GROK_BASE_URL = os.getenv("GROK_BASE_URL")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-small-3.2-24b-instruct:free")
    AZURE_WHISPER_API_KEY = os.getenv("AZURE_WHISPER_API_KEY")
    AZURE_WHISPER_ENDPOINT = os.getenv("AZURE_WHISPER_ENDPOINT")
    AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
    AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_WHISPER_MODEL = "whisper-1"

def azure_openai_client():
    """
    Initialize and return OpenAI client.
    """
    return AzureOpenAI(api_key=Config.AZURE_OPENAI_API_KEY, api_version=Config.AZURE_OPENAI_API_VERSION, azure_endpoint=Config.AZURE_OPENAI_ENDPOINT)

def openai_client():
    """Initialize OpenAI client without proxies parameter."""
    try:
        return OpenAI(
            api_key=Config.OPENAI_API_KEY,
            timeout=60.0,
            max_retries=2
        )
    except TypeError as e:
        # Fallback if parameters aren't supported
        return OpenAI(api_key=Config.OPENAI_API_KEY)

def grok_client():
    """
    Initialize and return Grok client.
    """
    return OpenAI(
        api_key=Config.GROK_API_KEY,
        base_url=Config.GROK_BASE_URL
    )

def openrouter_client():
    """
    Initialize and return OpenRouter HTTP client with file upload support.
    """
    return OpenRouterHTTPClient(
        api_key=Config.OPENROUTER_API_KEY,
        base_url=Config.OPENROUTER_BASE_URL,
    )

def azure_whisper_transcribe(audio_file_path: str) -> str:
    """
    Transcribe audio using Azure Whisper deployment.
    
    Args:
        audio_file_path: Path to the audio file to transcribe
        
    Returns:
        Transcribed text
    """
    if not Config.AZURE_WHISPER_API_KEY:
        raise ValueError("AZURE_WHISPER_API_KEY environment variable not set")
    
    if not Config.AZURE_WHISPER_ENDPOINT:
        raise ValueError("AZURE_WHISPER_ENDPOINT environment variable not set")
    
    # Initialize Azure OpenAI client
    client = AzureOpenAI(
        api_key=Config.AZURE_WHISPER_API_KEY,
        api_version=Config.AZURE_OPENAI_API_VERSION,
        azure_endpoint=Config.AZURE_WHISPER_ENDPOINT
    )
    
    # Whisper (Speech-to-text)
    with open(audio_file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model=Config.AZURE_WHISPER_MODEL,
            file=audio_file
        )
    
    return transcript.text.strip()
