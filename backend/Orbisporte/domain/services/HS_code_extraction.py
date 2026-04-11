from Orbisporte.domain.models import *
from Orbisporte.infrastructure.get_llm import openai_client
from Orbisporte.prompts.HS_code_prompt import HS_code_prompt   
from typing import Dict, Any, List

import pickle
import pandas as pd
import logging

# ChromaDB imports with error handling
CHROMADB_AVAILABLE = False
try:
    import chromadb
    from chromadb.utils import embedding_functions
    CHROMADB_AVAILABLE = True
except ImportError:
    chromadb = None
    embedding_functions = None
except Exception as e:
    # Handle DLL loading issues and other runtime errors
    if "onnxruntime" in str(e) or "DLL" in str(e):
        logger = logging.getLogger(__name__)
        logger.warning(f"ChromaDB failed to load due to onnxruntime/DLL issues: {e}")
    chromadb = None
    embedding_functions = None

from typing import Dict, Any, List, Optional
import json
import re
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime

# Simplified imports for basic functionality
LANGCHAIN_AVAILABLE = False
try:
    from langchain_community.vectorstores import Chroma
    from langchain_community.embeddings import OpenAIEmbeddings
    from langchain.schema import Document
    from langchain.retrievers import VectorStoreRetriever
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False


logger = logging.getLogger(__name__)

class WorkflowState(Enum):
    """Workflow state enumeration for the agentic workflow."""
    SETUP = "setup"
    INPUT_PROCESSING = "input_processing"
    CONCURRENT_SEARCH = "concurrent_search" 
    DESCRIPTION_GENERATION = "description_generation"
    FINALIZATION = "finalization"
    COMPLETED = "completed"
    ERROR = "error"

@dataclass
class WorkflowContext:
    """Context object to maintain state throughout the agentic workflow."""
    # Input
    query: str = ""
    
    # Setup components
    llm: Any = None
    chroma_client: Any = None
    embeddings: Any = None
    collection: Any = None
    
    # Processing results
    similarity_results: List[Dict[str, Any]] = field(default_factory=list)
    hs_code: Optional[str] = None
    chapter: Optional[str] = None
    description: Optional[str] = None
    confidence: float = 0.0
    
    # Workflow control
    current_state: WorkflowState = WorkflowState.SETUP
    error_message: Optional[str] = None
    processing_complete: bool = False
    timestamp: datetime = field(default_factory=datetime.now)

class AgenticHSCodeWorkflow:
    """
    LangChain-based agentic workflow for HS code classification.
    Implements event-driven processing with setup, input, and concurrent search events.
    """
    
    def __init__(self, hs_data_path: str = "IDP/static/HSCODE.pkl"):
        """Initialize the agentic workflow with HS data path."""
        self.hs_data_path = hs_data_path
        self.chroma_db_path = os.path.join(os.path.dirname(hs_data_path), "chroma_db")
        self.executor = ThreadPoolExecutor(max_workers=3)
        
    async def execute_workflow(self, query: str) -> Dict[str, Any]:
        """
        Execute the complete agentic workflow for HS code classification.
        
        Args:
            query: Product description to classify
            
        Returns:
            Dict containing classification results
        """
        context = WorkflowContext(query=query)
        
        try:
            # Setup Event
            context = await self._setup_event(context)
            if context.current_state == WorkflowState.ERROR:
                return self._format_error_result(context)
            
            # Input Processing Event
            context = await self._input_event(context)
            if context.current_state == WorkflowState.ERROR:
                return self._format_error_result(context)
            
            # Concurrent Search Event
            context = await self._concurrent_search_event(context)
            if context.current_state == WorkflowState.ERROR:
                return self._format_error_result(context)
            
            # Description Generation Event (if needed)
            if self._needs_description_generation(context):
                context = await self._description_generation_event(context)
            
            # Finalization Event
            context = await self._finalization_event(context)
            
            return self._format_final_result(context)
            
        except Exception as e:
            logger.error(f"❌ Workflow execution failed: {e}")
            context.error_message = str(e)
            context.current_state = WorkflowState.ERROR
            return self._format_error_result(context)
        finally:
            self.executor.shutdown(wait=False)
    
    async def _setup_event(self, context: WorkflowContext) -> WorkflowContext:
        """Setup Event: Initialize LLM, ChromaDB, and embeddings."""
        logger.info("🔧 Setup Event: Initializing LLM, ChromaDB, and embeddings")
        context.current_state = WorkflowState.SETUP
        
        try:
            # Initialize LLM
            context.llm = openai_client()
            logger.info("✅ LLM initialized")
            
            # Initialize ChromaDB client if available
            if not CHROMADB_AVAILABLE:
                logger.warning("ChromaDB not available. Skipping vector database initialization.")
                context.chroma_client = None
                context.collection = None
            else:
                os.makedirs(self.chroma_db_path, exist_ok=True)
                context.chroma_client = chromadb.PersistentClient(path=self.chroma_db_path)
                
                # Get or create collection
                try:
                    context.collection = context.chroma_client.get_collection("hscodes")
                    logger.info(f"✅ Found existing ChromaDB collection with {context.collection.count()} documents")
                except Exception:
                    logger.info("📦 Creating new ChromaDB collection")
                    context.collection = self._create_minimal_collection(context.chroma_client)
            
            # Initialize embeddings if LangChain is available
            if LANGCHAIN_AVAILABLE:
                context.embeddings = OpenAIEmbeddings()
                logger.info("✅ OpenAI embeddings initialized")
            
            context.current_state = WorkflowState.INPUT_PROCESSING
            return context
            
        except Exception as e:
            logger.error(f"❌ Setup failed: {e}")
            context.error_message = f"Setup failed: {str(e)}"
            context.current_state = WorkflowState.ERROR
            return context
    
    async def _input_event(self, context: WorkflowContext) -> WorkflowContext:
        """Input Event: Process and validate the input query."""
        logger.info(f"📝 Input Event: Processing query '{context.query}'")
        context.current_state = WorkflowState.INPUT_PROCESSING
        
        try:
            # Clean and validate input
            context.query = str(context.query).strip()
            if not context.query:
                raise ValueError("Empty query provided")
            
            logger.info(f"✅ Input validated: '{context.query}'")
            context.current_state = WorkflowState.CONCURRENT_SEARCH
            return context
            
        except Exception as e:
            logger.error(f"❌ Input processing failed: {e}")
            context.error_message = f"Input processing failed: {str(e)}"
            context.current_state = WorkflowState.ERROR
            return context
    
    async def _concurrent_search_event(self, context: WorkflowContext) -> WorkflowContext:
        """Concurrent Search Event: Perform similarity search and direct search concurrently."""
        logger.info("🔍 Concurrent Search Event: Performing parallel similarity searches")
        context.current_state = WorkflowState.CONCURRENT_SEARCH
        
        try:
            # Create tasks for concurrent execution
            tasks = [
                self._similarity_search_task(context),
                self._direct_search_task(context),
                self._fallback_search_task(context)
            ]
            
            # Execute tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and find the best match
            best_result = self._select_best_result(results)
            
            if best_result:
                context.hs_code = best_result.get('hs_code')
                context.chapter = best_result.get('chapter')
                context.confidence = best_result.get('confidence', 0.0)
                context.similarity_results = [r for r in results if isinstance(r, dict) and r.get('hs_code')]
                
                logger.info(f"✅ Concurrent search complete: Best result {context.hs_code} (confidence: {context.confidence:.1f}%)")
            else:
                logger.warning("⚠️ No results found in concurrent search")
                context.hs_code = "0000.00.00"
                context.chapter = "Unknown"
                context.confidence = 0.0
            
            context.current_state = WorkflowState.DESCRIPTION_GENERATION
            return context
            
        except Exception as e:
            logger.error(f"❌ Concurrent search failed: {e}")
            context.error_message = f"Concurrent search failed: {str(e)}"
            context.current_state = WorkflowState.ERROR
            return context
    
    async def _similarity_search_task(self, context: WorkflowContext) -> Dict[str, Any]:
        """Task: Perform ChromaDB similarity search."""
        if not CHROMADB_AVAILABLE or context.chroma_client is None:
            logger.warning("ChromaDB not available for similarity search")
            return {'hs_code': None, 'confidence': 0.0, 'method': 'similarity_search', 'error': 'ChromaDB not available'}
            
        try:
            # Initialize OpenAI embedding function for ChromaDB
            from Orbisporte.infrastructure.get_llm import Config
            
            if not embedding_functions:
                logger.warning("ChromaDB embedding functions not available")
                return {'hs_code': None, 'confidence': 0.0, 'method': 'similarity_search', 'error': 'Embedding functions not available'}
                
            openai_ef = embedding_functions.OpenAIEmbeddingFunction(
                api_key=Config.OPENAI_API_KEY,
                model_name="text-embedding-ada-002"
            )
            
            # Get collection with embedding function
            collection = context.chroma_client.get_collection(
                name="hscodes",
                embedding_function=openai_ef
            )
            
            # Perform similarity search
            results = collection.query(
                query_texts=[context.query],
                n_results=5,
                include=["documents", "distances"]
            )
            
            if results and results.get('documents', [[]])[0]:
                doc = results['documents'][0][0]
                distance = results.get('distances', [[1.0]])[0][0]
                
                hs_code = self._extract_hs_code_from_document(doc)
                if hs_code and hs_code != '0000.00.00':
                    confidence = max(0, (1.0 - distance) * 100)
                    return {
                        'hs_code': hs_code,
                        'chapter': self._extract_chapter_from_code(hs_code),
                        'confidence': confidence,
                        'method': 'similarity_search',
                        'document': doc[:200]
                    }
            
            return {'hs_code': None, 'confidence': 0.0, 'method': 'similarity_search'}
            
        except Exception as e:
            logger.warning(f"Similarity search failed: {e}")
            return {'hs_code': None, 'confidence': 0.0, 'method': 'similarity_search', 'error': str(e)}
    
    async def _direct_search_task(self, context: WorkflowContext) -> Dict[str, Any]:
        """Task: Perform direct text search."""
        try:
            collection = context.collection
            all_docs = collection.get()
            
            if not all_docs or not all_docs.get('documents'):
                return {'hs_code': None, 'confidence': 0.0, 'method': 'direct_search'}
            
            query_words = set(context.query.lower().split())
            best_score, best_code = 0, None
            
            for doc in all_docs['documents'][:100]:  # Limit search scope
                doc_words = set(doc.lower().split())
                score = len(query_words.intersection(doc_words))
                
                if score > best_score:
                    code = self._extract_hs_code_from_document(doc)
                    if code and code != '0000.00.00':
                        best_score, best_code = score, code
                        if score >= 3:  # Good enough match
                            break
            
            if best_code:
                confidence = min(90, best_score * 20)  # Convert score to confidence
                return {
                    'hs_code': best_code,
                    'chapter': self._extract_chapter_from_code(best_code),
                    'confidence': confidence,
                    'method': 'direct_search'
                }
            
            return {'hs_code': None, 'confidence': 0.0, 'method': 'direct_search'}
            
        except Exception as e:
            logger.warning(f"Direct search failed: {e}")
            return {'hs_code': None, 'confidence': 0.0, 'method': 'direct_search', 'error': str(e)}
    
    async def _fallback_search_task(self, context: WorkflowContext) -> Dict[str, Any]:
        """Task: Perform fallback search for common items."""
        try:
            query_lower = context.query.lower()
            fallback_map = {
                'computer': ('8471.30.00', 'Chapter 84', 60),
                'laptop': ('8471.30.00', 'Chapter 84', 60),
                'desktop': ('8471.41.00', 'Chapter 84', 60),
                'smartphone': ('8517.12.00', 'Chapter 85', 60),
                'phone': ('8517.12.00', 'Chapter 85', 60),
                'tablet': ('8471.30.00', 'Chapter 84', 60)
            }
            
            for term, (code, chapter, confidence) in fallback_map.items():
                if term in query_lower:
                    return {
                        'hs_code': code,
                        'chapter': chapter,
                        'confidence': confidence,
                        'method': 'fallback',
                        'matched_term': term
                    }
            
            return {'hs_code': None, 'confidence': 0.0, 'method': 'fallback'}
            
        except Exception as e:
            logger.warning(f"Fallback search failed: {e}")
            return {'hs_code': None, 'confidence': 0.0, 'method': 'fallback', 'error': str(e)}
    
    async def _description_generation_event(self, context: WorkflowContext) -> WorkflowContext:
        """Description Generation Event: Use LLM to generate description if needed."""
        logger.info("🤖 Description Generation Event: Creating LLM-generated description")
        context.current_state = WorkflowState.DESCRIPTION_GENERATION
        
        try:
            # First try to extract description from search results
            extracted_desc = self._extract_description_from_results(context)
            
            if extracted_desc and len(extracted_desc) > 20:
                context.description = extracted_desc
                logger.info("✅ Used extracted description from search results")
            else:
                # Generate description using LLM
                prompt = f"""You are an expert in Harmonized System (HS) code classification.
                
Product: {context.query}
HS Code: {context.hs_code}
Chapter: {context.chapter}

Provide a clear, professional description (1-2 sentences) explaining what products are classified under this HS code:"""

                response = context.llm.chat.completions.create(
                    model="gpt-5-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_completion_tokens=800,
                    timeout=60  # Add timeout for HS code description generation
                )
                
                context.description = response.choices[0].message.content.strip()
                logger.info("✅ Generated LLM description")
            
            context.current_state = WorkflowState.FINALIZATION
            return context
            
        except Exception as e:
            logger.error(f"❌ Description generation failed: {e}")
            context.description = f"Product classified under HS code {context.hs_code}"
            context.current_state = WorkflowState.FINALIZATION
            return context
    
    async def _finalization_event(self, context: WorkflowContext) -> WorkflowContext:
        """Finalization Event: Compile final results."""
        logger.info("✅ Finalization Event: Compiling final results")
        context.current_state = WorkflowState.FINALIZATION
        
        # Ensure we have all required fields
        if not context.hs_code:
            context.hs_code = "0000.00.00"
        if not context.chapter:
            context.chapter = "Unknown"
        if not context.description:
            context.description = "Product classification"
        
        context.processing_complete = True
        context.current_state = WorkflowState.COMPLETED
        context.timestamp = datetime.now()
        
        logger.info(f"🎯 Workflow completed: {context.hs_code} - {context.description[:50]}...")
        return context
    
    def _select_best_result(self, results: List[Any]) -> Optional[Dict[str, Any]]:
        """Select the best result from concurrent search tasks."""
        valid_results = [r for r in results if isinstance(r, dict) and r.get('hs_code')]
        
        if not valid_results:
            return None
        
        # Sort by confidence, prioritizing similarity search
        valid_results.sort(key=lambda x: (
            x.get('confidence', 0),
            1 if x.get('method') == 'similarity_search' else 0
        ), reverse=True)
        
        return valid_results[0]
    
    def _needs_description_generation(self, context: WorkflowContext) -> bool:
        """Determine if description generation is needed."""
        return (context.hs_code and 
                context.hs_code != "0000.00.00" and 
                (not context.description or len(context.description) < 20))
    
    def _extract_hs_code_from_document(self, document: str) -> Optional[str]:
        """Extract HS code from document text."""
        for line in document.split('\n')[:5]:
            parts = line.split(',')
            if len(parts) >= 3:
                code = parts[1].strip()
                if re.match(r'^\d{7}$', code):
                    return f"{code[:4]}.{code[4:6]}.{code[6:7]}0"
        return None
    
    def _extract_chapter_from_code(self, hs_code: str) -> str:
        """Extract chapter from HS code."""
        try:
            clean_code = re.sub(r'[^\d]', '', str(hs_code))
            if len(clean_code) >= 2:
                chapter_num = clean_code[:2]
                return f"Chapter {chapter_num}"
            return "Unknown Chapter"
        except:
            return "Unknown Chapter"
    
    def _extract_description_from_results(self, context: WorkflowContext) -> Optional[str]:
        """Extract description from search results."""
        for result in context.similarity_results:
            if 'document' in result:
                doc = result['document']
                for line in doc.split('\n')[:3]:
                    parts = line.split(',')
                    if len(parts) >= 3:
                        description = parts[2].strip()
                        if description and len(description) > 10:
                            if description.endswith(' ('):
                                description = description[:-2].strip()
                            return description
        return None
    
    def _create_minimal_collection(self, client: Any) -> Any:
        """Create a minimal collection for fallback operations."""
        if not CHROMADB_AVAILABLE or not chromadb:
            return None
            
        try:
            # Create a minimal collection with basic settings
            collection = client.create_collection(
                name="fallback_hs_codes",
                metadata={"description": "Fallback HS code collection"}
            )
            return collection
        except Exception as e:
            logger.error(f"Failed to create minimal collection: {e}")
            return None
    
    def _format_final_result(self, context: WorkflowContext) -> Dict[str, Any]:
        """Format the final result."""
        return {
            "hs_code": context.hs_code,
            "chapter": context.chapter,
            "description": context.description,
            "confidence": context.confidence,
            "query": context.query,
            "method_used": self._get_primary_method(context),
            "processing_complete": context.processing_complete,
            "timestamp": context.timestamp.isoformat(),
            "workflow_state": context.current_state.value
        }
    
    def _format_error_result(self, context: WorkflowContext) -> Dict[str, Any]:
        """Format an error result."""
        return {
            "hs_code": "0000.00.00",
            "chapter": "Unknown",
            "description": "Classification failed",
            "confidence": 0.0,
            "query": context.query,
            "error": context.error_message,
            "processing_complete": False,
            "timestamp": context.timestamp.isoformat(),
            "workflow_state": context.current_state.value
        }
    
    def _get_primary_method(self, context: WorkflowContext) -> str:
        """Get the primary method used for classification."""
        if context.similarity_results:
            methods = [r.get('method', 'unknown') for r in context.similarity_results]
            if 'similarity_search' in methods:
                return 'similarity_search'
            elif 'direct_search' in methods:
                return 'direct_search'
            elif 'fallback' in methods:
                return 'fallback'
        return 'unknown'

class HSCodeService:
    """
    Enhanced HS Code service with agentic workflow support.
    Integrates traditional lookup with LangChain-based agentic processing.
    """
    
    def __init__(self, hs_data_path: str = "IDP/static/HSCODE.pkl"):
        """Initialize the service with both traditional and agentic workflow capabilities."""
        self.hs_data_path = hs_data_path
        self.hs_data = None
        self.agentic_workflow = AgenticHSCodeWorkflow(hs_data_path)
        self.langchain_available = LANGCHAIN_AVAILABLE
        
        # Initialize components
        self._load_hs_data()
        self._initialize_chromadb()
        
        logger.info(f"✅ HSCodeService initialized - Agentic workflow: ✅, LangChain: {'✅' if self.langchain_available else '❌'}, ChromaDB: {'✅' if CHROMADB_AVAILABLE else '❌'}")
    
    def _load_hs_data(self):
        """Load HS code data from pickle file."""
        try:
            with open(self.hs_data_path, 'rb') as f:
                self.hs_data = pickle.load(f)
            
            if not isinstance(self.hs_data, pd.DataFrame):
                self.hs_data = pd.DataFrame(self.hs_data)
            
            # Clean column names and ensure required columns exist
            self.hs_data.columns = [col.strip().lower().replace(' ', '_') for col in self.hs_data.columns]
            
            # Map common column variations
            column_mappings = {
                'code': 'hs_code',
                'commodity_code': 'hs_code',
                'desc': 'description',
                'commodity_description': 'description'
            }
            
            for old_col, new_col in column_mappings.items():
                if old_col in self.hs_data.columns and new_col not in self.hs_data.columns:
                    self.hs_data[new_col] = self.hs_data[old_col]
            
            self.hs_data = self.hs_data.dropna(subset=['hs_code'])
            logger.info(f"Loaded {len(self.hs_data)} HS code records")
            
        except Exception as e:
            logger.error(f"Failed to load HS data: {e}")
            self.hs_data = pd.DataFrame({'hs_code': ['0000.00.00'], 'description': ['No data available']})
    
    def _initialize_chromadb(self):
        """Initialize ChromaDB connection."""
        if not CHROMADB_AVAILABLE:
            logger.warning("ChromaDB not available. Vector database operations will be disabled.")
            self.chroma_client = None
            self.collection = None
            return

        try:
            chroma_db_path = os.path.join(os.path.dirname(self.hs_data_path), "chroma_db")
            os.makedirs(chroma_db_path, exist_ok=True)
            
            if chromadb:
                self.chroma_client = chromadb.PersistentClient(path=chroma_db_path)
                
                # Try to get existing collection
                try:
                    self.collection = self.chroma_client.get_collection("hscodes")
                    logger.info(f"✅ Connected to existing ChromaDB collection with {self.collection.count()} documents")
                except Exception:
                    logger.info("📦 Creating new ChromaDB collection")
                    self.collection = self._create_minimal_collection(self.chroma_client)
            else:
                logger.warning("ChromaDB module not available")
                self.chroma_client = None
                self.collection = None
                
        except Exception as e:
            logger.error(f"❌ ChromaDB initialization failed: {e}")
            self.chroma_client = None
            self.collection = None
    
    async def classify_item_agentic(self, product_description: str, use_agentic: bool = True) -> Dict[str, Any]:
        """
        Classify an item using the agentic workflow.
        
        Args:
            product_description: Description of the product to classify
            use_agentic: Whether to use the agentic workflow (True) or fallback to simple lookup (False)
            
        Returns:
            Dictionary containing classification results
        """
        if use_agentic:
            try:
                logger.info(f"🤖 Starting agentic workflow for: '{product_description}'")
                result = await self.agentic_workflow.execute_workflow(product_description)
                
                # Add extra metadata
                result.update({
                    "method": "agentic_workflow",
                    "langchain_available": self.langchain_available,
                    "chromadb_available": self.collection is not None
                })
                
                return result
                
            except Exception as e:
                logger.error(f"❌ Agentic workflow failed: {e}")
                # Fall back to simple classification
                return self._simple_classification_fallback(product_description, error=str(e))
        else:
            return self._simple_classification_fallback(product_description)
    
    def classify_item(self, product_description: str) -> Dict[str, Any]:
        """
        Synchronous wrapper for item classification.

        Args:
            product_description: Description of the product to classify

        Returns:
            Dictionary containing classification results
        """
        # TEMPORARY FIX: Disable agentic workflow to avoid event loop conflicts
        # The agentic workflow will be re-enabled once event loop issue is resolved
        try:
            logger.info(f"⚠️ Using fallback classification for: '{product_description}' (agentic workflow disabled)")
            result = self._simple_classification_fallback(product_description)
            return result
        except Exception as e:
            logger.error(f"❌ Async workflow execution failed: {e}")
            return self._simple_classification_fallback(product_description, error=str(e))
    
    def _simple_classification_fallback(self, product_description: str, error: str = None) -> Dict[str, Any]:
        """Simple fallback classification when agentic workflow fails."""
        logger.info(f"🔄 Using simple classification fallback for: '{product_description}'")
        
        # Simple keyword matching
        product_lower = product_description.lower()
        
        # Enhanced fallback mappings
        fallback_codes = {
            # Electronics - Consumer
            'computer': ('8471.30.00', 'Chapter 84', 'Portable automatic data processing machines'),
            'laptop': ('8471.30.00', 'Chapter 84', 'Portable automatic data processing machines'),
            'smartphone': ('8517.12.00', 'Chapter 85', 'Telephones for cellular networks'),
            'phone': ('8517.12.00', 'Chapter 85', 'Telephones for cellular networks'),
            'tablet': ('8471.30.00', 'Chapter 84', 'Portable automatic data processing machines'),

            # Electronics - PCBs and Assemblies
            'printed circuit': ('8534.00.00', 'Chapter 85', 'Printed circuits'),
            'pcb': ('8534.00.00', 'Chapter 85', 'Printed circuits'),
            'printed circuits board': ('8534.00.00', 'Chapter 85', 'Printed circuits'),
            'circuit board': ('8534.00.00', 'Chapter 85', 'Printed circuits'),
            'pcba': ('8534.00.00', 'Chapter 85', 'Printed circuits'),
            'pwb': ('8534.00.00', 'Chapter 85', 'Printed circuits'),
            'printed wiring board': ('8534.00.00', 'Chapter 85', 'Printed circuits'),

            # Electronics - Cables and Wiring
            'cable': ('8544.49.00', 'Chapter 85', 'Insulated wire and cable'),
            'cable assy': ('8544.49.00', 'Chapter 85', 'Insulated wire and cable'),
            'cable assembly': ('8544.49.00', 'Chapter 85', 'Insulated wire and cable'),
            'wire': ('8544.49.00', 'Chapter 85', 'Insulated wire and cable'),
            'wiring harness': ('8544.30.00', 'Chapter 85', 'Wiring sets for vehicles'),
            'harness': ('8544.30.00', 'Chapter 85', 'Wiring sets'),

            # Electronics - Components (Integrated Circuits)
            'integrated circuit': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'microprocessor': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'microcontroller': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'processor': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'controller': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'pcie': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'pci express': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'pci-e': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'gen3': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'gen 3': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'gen2': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'gen 2': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'lane switch': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'port switch': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'switch ic': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'ic switch': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'electronic switch': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'multiplexer': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'mux': ('8542.31.00', 'Chapter 85', 'Electronic integrated circuits: Processors and controllers'),
            'ic': ('8542.39.00', 'Chapter 85', 'Electronic integrated circuits: Other'),
            'chip': ('8542.39.00', 'Chapter 85', 'Electronic integrated circuits: Other'),
            'optocoupler': ('8541.41.00', 'Chapter 85', 'Light emitting diodes (LED)'),
            'opto-coupler': ('8541.41.00', 'Chapter 85', 'Light emitting diodes (LED)'),
            'opto coupler': ('8541.41.00', 'Chapter 85', 'Light emitting diodes (LED)'),
            'semiconductor': ('8541.49.00', 'Chapter 85', 'Other semiconductor devices'),
            'diode': ('8541.10.00', 'Chapter 85', 'Diodes, other than photosensitive or light emitting diodes'),
            'transistor': ('8541.21.00', 'Chapter 85', 'Transistors with a dissipation rate of less than 1 W'),
            'led': ('8541.41.00', 'Chapter 85', 'Light emitting diodes (LED)'),
            'resistor': ('8533.21.00', 'Chapter 85', 'Resistors: Fixed, for a power handling capacity not exceeding 20 W'),
            'capacitor': ('8532.22.00', 'Chapter 85', 'Capacitors: Aluminum electrolytic'),
            'inductor': ('8504.50.00', 'Chapter 85', 'Other inductors'),
            'connector': ('8536.69.00', 'Chapter 85', 'Plugs and sockets: Other'),

            # Agricultural
            'rice': ('1006.30.00', 'Chapter 10', 'Semi-milled or wholly milled rice'),
            'wheat': ('1001.90.00', 'Chapter 10', 'Wheat and meslin, other'),
            'corn': ('1005.90.00', 'Chapter 10', 'Maize (corn), other'),
            'soybean': ('1201.90.00', 'Chapter 12', 'Soya beans, other'),

            # Textiles
            'cotton': ('5201.00.00', 'Chapter 52', 'Cotton, not carded or combed'),
            'wool': ('5101.11.00', 'Chapter 51', 'Greasy, including fleece-washed wool'),
            'silk': ('5002.00.00', 'Chapter 50', 'Raw silk (not thrown)'),

            # Machinery
            'engine': ('8408.90.00', 'Chapter 84', 'Other engines'),
            'motor': ('8501.10.00', 'Chapter 85', 'Motors of an output not exceeding 37.5 W'),
        }
        
        # Find best match
        best_match = None
        best_score = 0
        
        for keyword, (code, chapter, description) in fallback_codes.items():
            if keyword in product_lower:
                score = len(keyword)  # Longer matches get higher scores
                if score > best_score:
                    best_score = score
                    best_match = (code, chapter, description)
        
        if best_match:
            code, chapter, description = best_match
            confidence = min(80, best_score * 10)  # Convert to confidence score
        else:
            # Default classification
            code, chapter, description = '0000.00.00', 'Unknown', 'Unable to classify product'
            confidence = 0
        
        result = {
            "hs_code": code,
            "chapter": chapter,
            "description": description,
            "confidence": confidence,
            "query": product_description,
            "method_used": "simple_fallback",
            "processing_complete": True,
            "timestamp": datetime.now().isoformat(),
            "workflow_state": "completed"
        }
        
        if error:
            result["fallback_reason"] = error
            result["workflow_state"] = "error_fallback"
        
        return result
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get the status of various service components."""
        status = {
            "hs_data_loaded": self.hs_data is not None,
            "hs_data_records": len(self.hs_data) if self.hs_data is not None else 0,
            "chromadb_available": self.chroma_client is not None,
            "collection_available": self.collection is not None,
            "langchain_available": self.langchain_available,
            "agentic_workflow_available": True,
            "data_path": self.hs_data_path
        }
        
        if self.collection:
            try:
                status["collection_document_count"] = self.collection.count()
            except:
                status["collection_document_count"] = "unknown"
        
        return status

    def get_hs_code_details(self, hs_code: str) -> Dict[str, Any]:
        """
        Get detailed information for a specific HS code or product description.
        
        Args:
            hs_code: The HS code or product description to lookup
            
        Returns:
            Dict containing detailed HS code information
        """
        try:
            # First try to find exact HS code match in pickle data
            if self.hs_data is not None:
                exact_match = self.hs_data[self.hs_data['hs_code'] == hs_code]
                
                if not exact_match.empty:
                    row = exact_match.iloc[0]
                    return {
                        "hs_code": row['hs_code'],
                        "description": row.get('description', 'No description available'),
                        "chapter": self._extract_chapter_from_code(row['hs_code']),
                        "found": True
                    }
            
            # If not found in exact match, try similarity search
            if self.collection and CHROMADB_AVAILABLE and self.chroma_client:
                try:
                    from Orbisporte.infrastructure.get_llm import Config
                    
                    if not embedding_functions:
                        logger.warning("ChromaDB embedding functions not available")
                    else:
                        openai_ef = embedding_functions.OpenAIEmbeddingFunction(
                            api_key=Config.OPENAI_API_KEY,
                            model_name="text-embedding-ada-002"
                        )
                        
                        collection = self.chroma_client.get_collection(
                            name="hscodes",
                            embedding_function=openai_ef
                        )
                        
                        results = collection.query(
                            query_texts=[hs_code],
                            n_results=1,
                            include=["documents", "distances"]
                        )
                        
                        if results and results.get('documents', [[]])[0]:
                            doc = results['documents'][0][0]
                            found_hs_code = self._extract_hs_code_from_document(doc)
                            
                            if found_hs_code and found_hs_code != '0000.00.00':
                                description = self._extract_description_from_document(doc)
                                return {
                                    "hs_code": found_hs_code,
                                    "description": description,
                                    "chapter": self._extract_chapter_from_code(found_hs_code),
                                    "found": True,
                                    "note": "Found via ChromaDB search"
                                }
                
                except Exception as e:
                    logger.warning(f"ChromaDB search failed: {e}")
            
            # Fallback: return not found
            return {
                "hs_code": hs_code,
                "description": "No matching HS code found",
                "chapter": "Unknown",
                "found": False
            }
            
        except Exception as e:
            logger.error(f"HS code lookup failed: {e}")
            return {
                "hs_code": hs_code,
                "description": f"Lookup failed: {str(e)}",
                "chapter": "Unknown",
                "found": False
            }

    def get_hs_code(self, description: str) -> str:
        """
        Extract HS code for a product description using ChromaDB vector search.
        Returns the most similar HS code string.
        """
        try:
            if self.collection and CHROMADB_AVAILABLE and self.chroma_client:
                from Orbisporte.infrastructure.get_llm import Config
                
                if not embedding_functions:
                    logger.warning("ChromaDB embedding functions not available")
                else:
                    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
                        api_key=Config.OPENAI_API_KEY,
                        model_name="text-embedding-ada-002"
                    )
                    
                    collection = self.chroma_client.get_collection(
                        name="hscodes",
                        embedding_function=openai_ef
                    )
                    
                    results = collection.query(
                        query_texts=[description],
                        n_results=5,
                        include=["documents", "distances"]
                    )
                    
                    if results and results.get('documents', [[]])[0]:
                        for doc in results['documents'][0]:
                            hs_code = self._extract_hs_code_from_document(doc)
                            if hs_code and hs_code != '0000.00.00':
                                return hs_code
            
            # Fallback search
            return self._fallback_search(description)
                
        except Exception as e:
            logger.error(f"HS code lookup failed: {e}")
            return '0000.00.00'

    def search_similar_items(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Search for similar items using ChromaDB similarity search."""
        if not self.collection or not CHROMADB_AVAILABLE or not self.chroma_client:
            logger.warning("ChromaDB not available for similarity search")
            return []
        
        try:
            from Orbisporte.infrastructure.get_llm import Config
            
            if not embedding_functions:
                logger.warning("ChromaDB embedding functions not available")
                return []
                
            openai_ef = embedding_functions.OpenAIEmbeddingFunction(
                api_key=Config.OPENAI_API_KEY,
                model_name="text-embedding-ada-002"
            )
            
            collection = self.chroma_client.get_collection(
                name="hscodes",
                embedding_function=openai_ef
            )
            
            results = collection.query(
                query_texts=[query],
                n_results=limit,
                include=["documents", "distances", "metadatas"]
            )
            
            similar_items = []
            if results and results.get('documents', [[]])[0]:
                documents = results['documents'][0]
                distances = results.get('distances', [[]])[0]
                metadatas = results.get('metadatas', [[]])[0]
                
                for i, doc in enumerate(documents):
                    distance = distances[i] if i < len(distances) else 1.0
                    metadata = metadatas[i] if i < len(metadatas) else {}
                    
                    hs_code = self._extract_hs_code_from_document(doc)
                    description = self._extract_description_from_document(doc)
                    
                    similar_items.append({
                        "document": doc[:200],
                        "hs_code": hs_code,
                        "description": description,
                        "similarity_score": max(0, (1.0 - distance) * 100),
                        "metadata": metadata
                    })
            
            return similar_items
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []

    def _extract_hs_code_from_document(self, document: str) -> Optional[str]:
        """Extract HS code from document text."""
        for line in document.split('\n')[:5]:
            parts = line.split(',')
            if len(parts) >= 3:
                code = parts[1].strip()
                if re.match(r'^\d{7}$', code):
                    return f"{code[:4]}.{code[4:6]}.{code[6:7]}0"
        return None

    def _extract_description_from_document(self, document: str) -> str:
        """Extract description from document text."""
        for line in document.split('\n')[:3]:
            parts = line.split(',')
            if len(parts) >= 3:
                description = parts[2].strip()
                if description and len(description) > 10:
                    if description.endswith(' ('):
                        description = description[:-2].strip()
                    return description
        return "No description available"

    def _extract_chapter_from_code(self, hs_code: str) -> str:
        """Extract chapter from HS code."""
        try:
            clean_code = re.sub(r'[^\d]', '', str(hs_code))
            if len(clean_code) >= 2:
                chapter_num = clean_code[:2]
                return f"Chapter {chapter_num}"
            return "Unknown Chapter"
        except:
            return "Unknown Chapter"

    def _fallback_search(self, description: str) -> str:
        """Fallback search for common items."""
        desc_lower = description.lower()
        fallback_map = {
            'computer': '8471.30.00',
            'laptop': '8471.30.00', 
            'desktop': '8471.41.00',
            'smartphone': '8517.12.00',
            'phone': '8517.12.00',
            'tablet': '8471.30.00'
        }
        
        for term, code in fallback_map.items():
            if term in desc_lower:
                return code
        return '0000.00.00'
    
    def _create_minimal_collection(self, client: Any) -> Any:
        """Create a minimal collection for fallback operations."""
        if not CHROMADB_AVAILABLE or not chromadb:
            return None
            
        try:
            # Create a minimal collection with basic settings
            collection = client.create_collection(
                name="hscodes",
                metadata={"description": "HS code collection"}
            )
            return collection
        except Exception as e:
            logger.error(f"Failed to create minimal collection: {e}")
            return None


def get_hs_code_service() -> HSCodeService:
    """Factory function to get HSCodeService instance."""
    return HSCodeService()
