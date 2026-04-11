"""
Document Chatbot Service
Specialized chatbot for RAG pipeline using vector embeddings from extracted documents.
"""

import json
from typing import List, Dict, Any, Optional
from Orbisporte.infrastructure.get_llm import openai_client
from Orbisporte.infrastructure.db import search_similar_documents, get_all_documents
from Orbisporte.domain.services.embedding_service import EmbeddingService
import logging

logger = logging.getLogger(__name__)

class DocumentChatbot:
    """Specialized chatbot for document-based RAG pipeline."""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client or openai_client()
        self.embedding_service = EmbeddingService()
        
        # RAG-specific prompt template
        self.rag_prompt_template = """You are a document assistant for customs and trade documents. Answer based on the provided document context.

DOCUMENT CONTEXT:
{document_context}

QUESTION: {question}

Answer based on the document context above. If the context doesn't contain enough information, clearly state what information is missing."""

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for text (rough approximation: 1 token ≈ 4 characters)."""
        return len(text) // 4

    def _truncate_text_to_tokens(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within token limit."""
        estimated_tokens = self._estimate_tokens(text)
        if estimated_tokens <= max_tokens:
            return text
        
        # Calculate how many characters to keep (rough approximation)
        max_chars = max_tokens * 4
        return text[:max_chars] + "..."

    def _build_document_context(self, relevant_docs: List[Any]) -> str:
        """Build context string from relevant documents with intelligent truncation."""
        if not relevant_docs:
            return "No relevant documents found."
        
        context_parts = []
        total_estimated_tokens = 0
        max_context_tokens = 3000  # Leave room for prompt and response
        
        for i, doc in enumerate(relevant_docs, 1):
            doc_info = f"Document {i}: {doc.filename} (Type: {doc.document_type})"
            
            # Add extracted data if available
            if doc.extracted_data:
                try:
                    if isinstance(doc.extracted_data, str):
                        data = json.loads(doc.extracted_data)
                    else:
                        data = doc.extracted_data
                    
                    # Format the data nicely
                    data_summary = self._format_extracted_data(data)
                    doc_info += f"\nExtracted Data:\n{data_summary}"
                except Exception as e:
                    logger.warning(f"Failed to parse extracted data for {doc.filename}: {e}")
                    doc_info += f"\nExtracted Data: {str(doc.extracted_data)}"
            
            # Add text content if available
            if doc.text_content:
                doc_info += f"\nText Content: {doc.text_content}"
            
            # Check if adding this document would exceed token limit
            doc_tokens = self._estimate_tokens(doc_info)
            if total_estimated_tokens + doc_tokens > max_context_tokens:
                if context_parts:  # If we already have some documents, stop here
                    context_parts.append("... (more documents available)")
                    break
                else:  # If this is the first document, truncate it
                    remaining_tokens = max_context_tokens - total_estimated_tokens
                    doc_info = self._truncate_text_to_tokens(doc_info, remaining_tokens)
                    context_parts.append(doc_info)
                    break
            
            context_parts.append(doc_info)
            total_estimated_tokens += doc_tokens
        
        return "\n\n".join(context_parts)

    def _format_extracted_data(self, data: Dict[str, Any]) -> str:
        """Format extracted data for better readability."""
        if not isinstance(data, dict):
            return str(data)
        
        formatted_parts = []
        
        def format_value(key: str, value: Any, indent: int = 0):
            prefix = "  " * indent
            if isinstance(value, dict):
                formatted_parts.append(f"{prefix}{key}:")
                for k, v in value.items():
                    format_value(k, v, indent + 1)
            elif isinstance(value, list):
                formatted_parts.append(f"{prefix}{key}:")
                for i, item in enumerate(value, 1):
                    if isinstance(item, dict):
                        format_value(f"Item {i}", item, indent + 1)
                    else:
                        formatted_parts.append(f"{prefix}  {i}. {item}")
            else:
                formatted_parts.append(f"{prefix}{key}: {value}")
        
        for key, value in data.items():
            if key not in ['error', 'raw_response', 'processing_info']:
                format_value(key, value)
        
        return "\n".join(formatted_parts)

    def _generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for the query text."""
        try:
            return self.embedding_service.generate_embedding(text)
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return None

    def _search_relevant_documents(self, query: str, limit: int = 2) -> List[Any]:
        """Search for relevant documents using vector similarity."""
        try:
            # Generate embedding for the query
            query_embedding = self._generate_embedding(query)
            if not query_embedding:
                logger.warning("Could not generate embedding for query, returning empty results")
                return []
            
            # Search for similar documents (limit to 2 to prevent context overflow)
            relevant_docs = search_similar_documents(query_embedding, limit=limit)
            return relevant_docs
            
        except Exception as e:
            logger.error(f"Failed to search relevant documents: {e}")
            return []

    def _get_all_documents(self) -> List[Any]:
        """Get all documents from the database."""
        try:
            return get_all_documents()
        except Exception as e:
            logger.error(f"Failed to get all documents: {e}")
            return []

    def chat(self, question: str, use_all_documents: bool = False, similarity_threshold: float = 0.7) -> Dict[str, Any]:
        """
        Chat with the document assistant using RAG pipeline.
        
        Args:
            question: User's question
            use_all_documents: If True, use all documents instead of similarity search
            similarity_threshold: Minimum similarity score for relevant documents
        
        Returns:
            Dictionary containing response and metadata
        """
        try:
            # Validate input
            if not question or not question.strip():
                return {
                    "answer": "Please provide a question to ask about your documents.",
                    "documents_used": [],
                    "context_available": False,
                    "error": None
                }
            
            # Get relevant documents
            if use_all_documents:
                relevant_docs = self._get_all_documents()
                search_method = "all_documents"
            else:
                relevant_docs = self._search_relevant_documents(question)
                search_method = "vector_similarity"
            
            # Check if we have any documents
            if not relevant_docs:
                return {
                    "answer": "I don't have any documents to work with. Please upload some documents first, then I can help answer questions about them.",
                    "documents_used": [],
                    "context_available": False,
                    "error": None
                }
            
            # Build document context
            document_context = self._build_document_context(relevant_docs)
            
            # Create the RAG prompt
            rag_prompt = self.rag_prompt_template.format(
                document_context=document_context,
                question=question
            )
            
            # Generate response using LLM
            response = self.llm_client.chat.completions.create(
                model="gpt-5-mini", 
                messages=[
                    {"role": "system", "content": "You are a helpful document assistant for customs and trade documents."},
                    {"role": "user", "content": rag_prompt}
                ],
                max_completion_tokens=1000  # Reduced to fit within context limits
            )
            
            answer = response.choices[0].message.content.strip()
            
            # Prepare response metadata
            documents_used = [doc.filename for doc in relevant_docs]
            
            return {
                "answer": answer,
                "documents_used": documents_used,
                "context_available": True,
                "search_method": search_method,
                "documents_count": len(relevant_docs),
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Error in document chatbot: {e}")
            return {
                "answer": "I encountered an error while processing your question. Please try again.",
                "documents_used": [],
                "context_available": False,
                "error": str(e)
            }

    def get_document_summary(self) -> Dict[str, Any]:
        """Get a summary of available documents."""
        try:
            all_docs = self._get_all_documents()
            
            if not all_docs:
                return {
                    "total_documents": 0,
                    "document_types": {},
                    "message": "No documents available"
                }
            
            # Count document types
            doc_types = {}
            for doc in all_docs:
                doc_type = doc.document_type or "unknown"
                doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
            
            return {
                "total_documents": len(all_docs),
                "document_types": doc_types,
                "documents": [
                    {
                        "filename": doc.filename,
                        "type": doc.document_type,
                        "created_at": doc.created_at.isoformat() if doc.created_at else None
                    }
                    for doc in all_docs
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting document summary: {e}")
            return {
                "total_documents": 0,
                "document_types": {},
                "message": f"Error retrieving document summary: {str(e)}"
            }

    def validate_document_context(self, question: str) -> Dict[str, Any]:
        """Validate if the question can be answered with available documents."""
        try:
            relevant_docs = self._search_relevant_documents(question)
            
            return {
                "can_answer": len(relevant_docs) > 0,
                "relevant_documents_count": len(relevant_docs),
                "suggested_upload": len(relevant_docs) == 0,
                "relevant_document_types": list(set([doc.document_type for doc in relevant_docs if doc.document_type]))
            }
            
        except Exception as e:
            logger.error(f"Error validating document context: {e}")
            return {
                "can_answer": False,
                "relevant_documents_count": 0,
                "suggested_upload": True,
                "error": str(e)
            }

    def chat_with_documents(self, question: str, user_documents: List[Any], use_all_documents: bool = False) -> Dict[str, Any]:
        """Chat with user-specific documents using RAG pipeline."""
        try:
            if not user_documents:
                return {
                    "answer": "No documents available for your account. Please upload some documents first.",
                    "documents_used": [],
                    "context_available": False,
                    "search_method": "no_documents",
                    "error": None
                }
            
            # Generate embedding for the question
            question_embedding = self.embedding_service.generate_embedding(question)
            if not question_embedding:
                return {
                    "answer": "Sorry, I couldn't process your question. Please try again.",
                    "documents_used": [],
                    "context_available": False,
                    "search_method": "embedding_failed",
                    "error": "Failed to generate question embedding"
                }
            
            # Find relevant documents using vector similarity
            relevant_docs = []
            if use_all_documents:
                # Use all user documents
                relevant_docs = user_documents
            else:
                # Use vector similarity search
                # Calculate cosine similarity manually since we have user-specific documents
                similarities = []
                for doc in user_documents:
                    if hasattr(doc, 'embedding') and doc.embedding:
                        # Calculate cosine similarity
                        import numpy as np
                        doc_embedding = np.array(doc.embedding)
                        query_embedding = np.array(question_embedding)
                        
                        # Cosine similarity
                        dot_product = np.dot(doc_embedding, query_embedding)
                        norm_doc = np.linalg.norm(doc_embedding)
                        norm_query = np.linalg.norm(query_embedding)
                        
                        if norm_doc > 0 and norm_query > 0:
                            similarity = dot_product / (norm_doc * norm_query)
                            similarities.append((doc, similarity))
                
                # Sort by similarity and take top 5
                similarities.sort(key=lambda x: x[1], reverse=True)
                relevant_docs = [doc for doc, _ in similarities[:5]]
            
            # Build context from relevant documents
            document_context = self._build_document_context(relevant_docs)
            
            # Generate answer using LLM
            prompt = self.rag_prompt_template.format(
                document_context=document_context,
                question=question
            )
            
            response = self.llm_client.chat.completions.create(
                model="gpt-5-mini",
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=1000,
                temperature=0.1
            )
            
            answer = response.choices[0].message.content.strip()
            
            # Prepare documents used info
            documents_used = []
            for doc in relevant_docs:
                documents_used.append({
                    "id": doc.id,
                    "filename": doc.filename,
                    "document_type": doc.document_type
                })
            
            return {
                "answer": answer,
                "documents_used": documents_used,
                "context_available": len(relevant_docs) > 0,
                "search_method": "vector_search" if not use_all_documents else "all_documents",
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Chat with documents failed: {e}")
            return {
                "answer": "Sorry, I encountered an error while processing your question. Please try again.",
                "documents_used": [],
                "context_available": False,
                "search_method": "error",
                "error": str(e)
            } 