"""
Unified LLM Service — Uses Gemini 3.1 Flash by default

Provides a consistent interface for LLM calls across all services.
Automatically falls back to OpenAI if Gemini is unavailable.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class LLMService:
    """
    Unified LLM service that uses Gemini 3.1 Flash by default.
    
    Supports:
    - Gemini 3.1 Flash (primary, fastest)
    - OpenAI GPT-4o-mini (fallback)
    """
    
    def __init__(self, provider: str = None):
        self.provider = provider or os.getenv("LLM_PROVIDER", "gemini")
        self._gemini_client = None
        self._openai_client = None
    
    @property
    def gemini_client(self):
        """Lazy initialization of Gemini client"""
        if self._gemini_client is None:
            try:
                import google.genai as genai
                api_key = os.getenv("GEMINI_API_KEY")
                if api_key:
                    self._gemini_client = genai.Client(api_key=api_key)
                else:
                    logger.warning("GEMINI_API_KEY not set")
            except ImportError:
                logger.warning("google-genai not installed, falling back to OpenAI")
        return self._gemini_client
    
    @property
    def openai_client(self):
        """Lazy initialization of OpenAI client"""
        if self._openai_client is None:
            try:
                from openai import OpenAI
                api_key = os.getenv("OPENAI_API_KEY")
                if api_key:
                    self._openai_client = OpenAI(api_key=api_key)
                else:
                    logger.warning("OPENAI_API_KEY not set")
            except ImportError:
                logger.error("OpenAI not installed")
        return self._openai_client
    
    def generate_content(
        self,
        prompt: str,
        model: str = None,
        temperature: float = 0,
        max_tokens: int = 1024,
        response_format: str = None,
    ) -> str:
        """
        Generate content using the configured LLM provider.
        
        Args:
            prompt: The prompt to send to the LLM
            model: Specific model to use (overrides default)
            temperature: Sampling temperature (0 = deterministic)
            max_tokens: Maximum tokens to generate
            response_format: If "json", returns JSON response
        
        Returns:
            Generated text content
        """
        # Determine which model to use
        if model:
            if "gemini" in model.lower():
                return self._generate_gemini(prompt, model, temperature, max_tokens, response_format)
            else:
                return self._generate_openai(prompt, model, temperature, max_tokens, response_format)
        
        # Use configured provider
        if self.provider == "gemini" and self.gemini_client:
            try:
                return self._generate_gemini(prompt, "gemini-3.1-flash-lite", temperature, max_tokens, response_format)
            except Exception as e:
                logger.warning(f"Gemini failed: {e}, falling back to OpenAI")
                if self.openai_client:
                    return self._generate_openai(prompt, "gpt-4o-mini", temperature, max_tokens, response_format)
                raise
        elif self.openai_client:
            return self._generate_openai(prompt, "gpt-4o-mini", temperature, max_tokens, response_format)
        else:
            raise EnvironmentError("No LLM provider available. Set GEMINI_API_KEY or OPENAI_API_KEY")
    
    def _generate_gemini(
        self,
        prompt: str,
        model: str = "gemini-3.1-flash-lite",
        temperature: float = 0,
        max_tokens: int = 1024,
        response_format: str = None,
    ) -> str:
        """Generate content using Gemini"""
        config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if response_format == "json":
            config["response_mime_type"] = "application/json"
        
        response = self.gemini_client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )
        return response.text
    
    def _generate_openai(
        self,
        prompt: str,
        model: str = "gpt-4o-mini",
        temperature: float = 0,
        max_tokens: int = 1024,
        response_format: str = None,
    ) -> str:
        """Generate content using OpenAI"""
        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}
        
        response = self.openai_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0,
        max_tokens: int = 1024,
        response_format: str = None,
    ) -> str:
        """
        Chat completion using the configured LLM provider.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Specific model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            response_format: If "json", returns JSON response
        """
        # Convert messages to prompt for non-OpenAI providers
        if self.provider == "gemini" and self.gemini_client:
            prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
            return self._generate_gemini(prompt, model or "gemini-3.1-flash", temperature, max_tokens, response_format)
        elif self.openai_client:
            kwargs = {
                "model": model or "gpt-4o-mini",
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format == "json":
                kwargs["response_format"] = {"type": "json_object"}
            response = self.openai_client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        else:
            raise EnvironmentError("No LLM provider available")
    
    def parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse JSON from LLM response"""
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            import re
            match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
            if match:
                return json.loads(match.group(1))
            raise ValueError(f"Could not parse JSON from response: {response[:200]}")


# Global instance
_llm_service = None

def get_llm_service() -> LLMService:
    """Get the global LLM service instance"""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
