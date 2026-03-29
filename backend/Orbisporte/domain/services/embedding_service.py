"""
Embedding service for generating vector representations of document content.
"""

import json
from typing import Dict, Any, List
from Orbisporte.infrastructure.get_llm import openai_client
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    """Service for generating embeddings from document content."""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client or openai_client()
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI's text-embedding-ada-002."""
        try:
            if not text or len(text.strip()) == 0:
                return []
            
            # Truncate text if too long for embedding model
            max_tokens = 8000  # text-embedding-ada-002 limit
            if len(text) > max_tokens:
                text = text[:max_tokens]
            
            response = self.llm_client.embeddings.create(
                model="text-embedding-ada-002",
                input=text
            )
            
            embedding = response.data[0].embedding
            logger.info(f"Generated embedding of dimension {len(embedding)}")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return []
    
    def flatten_extracted_data(self, data: Dict[str, Any]) -> str:
        """Convert extracted JSON data to flat text for embedding."""
        try:
            if not isinstance(data, dict):
                return str(data)
            
            text_parts = []
            
            def extract_text(obj, prefix=""):
                if isinstance(obj, dict):
                    for key, value in obj.items():
                        if key in ['error', 'raw_response', 'processing_info']:
                            continue  # Skip technical fields
                        if isinstance(value, (dict, list)):
                            extract_text(value, f"{prefix}{key} ")
                        elif value and str(value).strip():
                            text_parts.append(f"{prefix}{key}: {value}")
                elif isinstance(obj, list):
                    for i, item in enumerate(obj):
                        if isinstance(item, dict):
                            extract_text(item, f"{prefix}item_{i+1} ")
                        elif item:
                            text_parts.append(f"{prefix}item_{i+1}: {item}")
            
            extract_text(data)
            return " ".join(text_parts)
            
        except Exception as e:
            logger.error(f"Failed to flatten extracted data: {e}")
            return str(data)
    
    def create_document_embedding(self, user_id: int, filename: str, document_type: str, extracted_data: Dict[str, Any]) -> tuple:
        """Create embedding for a document and return (text_content, embedding)."""
        try:
            # Flatten the extracted data to text
            text_content = self.flatten_extracted_data(extracted_data)
            
            # Add metadata for context
            enhanced_text = f"Document: {filename}\nType: {document_type}\nContent: {text_content}"
            
            # Generate embedding
            embedding = self.generate_embedding(enhanced_text)
            
            return text_content, embedding
            
        except Exception as e:
            logger.error(f"Failed to create document embedding: {e}")
            return str(extracted_data), []
