"""
Document Parser Utility

This module provides functions for parsing different types of documents using agentic_doc
or fallback methods. It handles PDF files and images, extracting text content with page information.
"""

import os
import logging
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
import importlib.util
from pathlib import Path

# Set up logger
logger = logging.getLogger(__name__)

# Check if agentic_doc is available
has_agentic_doc = importlib.util.find_spec("agentic_doc") is not None


class DocumentParseResult:
    """Class to store document parsing results with page-wise information."""
    
    def __init__(self, file_path: str):
        """Initialize the parse result.
        
        Args:
            file_path: Path to the parsed document
        """
        self.file_path = file_path
        self.page_wise_text: Dict[str, str] = {}
        self.raw_chunks: List[Dict[str, Any]] = []  # list of {page:int, type:str, text:str}
        self.filtered_chunks: List[Dict[str, Any]] = []  # normalized subset of raw_chunks
        self.parse_method: str = "unknown"
        self.error: Optional[str] = None
        self.success: bool = False
        self.page_count: int = 0
    
    def set_error(self, error_message: str) -> None:
        """Set error information.
        
        Args:
            error_message: Error message describing what went wrong
        """
        self.error = error_message
        self.success = False
    
    def set_page_wise_text(self, page_wise_text: Dict[str, str], 
                           raw_chunks: Optional[List[Dict[str, Any]]] = None,
                           filtered_chunks: Optional[List[Dict[str, Any]]] = None,
                           parse_method: str = "unknown") -> None:
        """Set the page-wise text and related information.
        
        Args:
            page_wise_text: Dictionary mapping page numbers to text content
            raw_chunks: Original chunks from parsing (optional)
            filtered_chunks: Filtered chunks used for text extraction (optional)
            parse_method: Method used for parsing
        """
        self.page_wise_text = page_wise_text
        if raw_chunks:
            self.raw_chunks = raw_chunks
        if filtered_chunks:
            self.filtered_chunks = filtered_chunks
        self.parse_method = parse_method
        self.page_count = len(page_wise_text)
        self.success = True
        self.error = None
    
    def get_text(self) -> str:
        """Get all text content concatenated.
        
        Returns:
            All extracted text as a single string
        """
        return "\n\n".join(self.page_wise_text.values())
    
    def get_page_count(self) -> int:
        """Get the number of pages with content.
        
        Returns:
            Number of pages with extracted text
        """
        return self.page_count
    
    def has_content(self) -> bool:
        """Check if any content was extracted.
        
        Returns:
            True if there is content, False otherwise
        """
        return self.success and bool(self.page_wise_text)
    
    def is_multi_page_pdf(self) -> bool:
        """Check if this is a multi-page PDF (>2 pages).
        
        Returns:
            True if multi-page PDF, False otherwise
        """
        return self.file_path.lower().endswith('.pdf') and self.page_count > 2


def filter_chunks(chunks: List[Dict]) -> List[Dict]:
    """Filter document chunks and combine text by page.
    
    Args:
        chunks: List of document chunks from agentic_doc
        
    Returns:
        List of combined chunks with text merged by page
    """
    # Group chunks by page and combine text
    pages = defaultdict(list)
    
    for c in chunks:
        text_value = (c.get("text") or "").strip()
        if len(text_value) <= 5:
            continue
            
        page_value = c.get("page", None)
        try:
            page_value = int(page_value) if page_value is not None else None
        except Exception:
            page_value = None
            
        if page_value is not None:
            pages[page_value].append(text_value)
    
    # Combine text for each page
    filtered = []
    for page_num in sorted(pages.keys()):
        # Join all text chunks for this page with double newlines
        combined_text = "\n\n".join(pages[page_num])
        filtered.append({
            "page": page_num,
            "text": combined_text,
        })
    
    return filtered


def build_condensed_text(chunks: List[Dict]) -> Dict[str, str]:
    """Convert combined page chunks to page-wise text dictionary.
    
    Args:
        chunks: List of chunks with text already combined by page
        
    Returns:
        Dictionary with page numbers as keys and text as values
    """
    # Chunks are already combined by page, just convert to expected format
    page_wise_text = {}
    for chunk in chunks:
        page_num = chunk.get("page")
        if page_num is not None:
            page_wise_text[f"page_{page_num}"] = chunk.get("text", "").strip()
    
    return page_wise_text


def get_pdf_page_count(file_path: str) -> int:
    """Get the number of pages in a PDF file.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        Number of pages in the PDF
    """
    try:
        import PyPDF2
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            return len(pdf_reader.pages)
    except Exception as e:
        logger.error(f"Failed to get PDF page count: {e}")
        return 0


def parse_document(file_path: str) -> DocumentParseResult:
    """Parse a document to extract text with page information.
    
    This function will try to use agentic_doc for multi-page PDFs (>2 pages),
    or fallback to other methods based on the document type.
    
    Args:
        file_path: Path to the document file
        
    Returns:
        DocumentParseResult with parsed content
    """
    result = DocumentParseResult(file_path)
    
    try:
        # Check if file exists and is accessible
        if not os.path.exists(file_path):
            result.set_error(f"File not found: {file_path}")
            return result
        
        # Choose parsing method based on file type
        if file_path.lower().endswith('.pdf'):
            return parse_pdf_document(file_path)
        else:
            return parse_image_document(file_path)
            
    except Exception as e:
        logger.error(f"Document parsing error: {str(e)}")
        result.set_error(f"Parsing error: {str(e)}")
        return result


def parse_pdf_document(file_path: str) -> DocumentParseResult:
    """Parse a PDF document using agentic_doc for multi-page PDFs or fallback methods.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        DocumentParseResult with parsed content
    """
    result = DocumentParseResult(file_path)
    
    # Check page count first
    page_count = get_pdf_page_count(file_path)
    result.page_count = page_count
    
    # Use vision agent (agentic_doc) for PDFs with more than 2 pages
    if page_count > 2 and has_agentic_doc:
        try:
            logger.info(f"Parsing multi-page PDF ({page_count} pages) with agentic_doc: {file_path}")
            
            # Set up environment variables for agentic_doc
            from dotenv import load_dotenv
            load_dotenv()
            
            if 'VISION_AGENT_API_KEY' not in os.environ:
                os.environ['VISION_AGENT_API_KEY'] = os.getenv('VISION_AGENT_API_KEY')
                
            if not os.environ.get('VISION_AGENT_API_KEY'):
                raise ValueError("VISION_AGENT_API_KEY not set in environment")
            
            # Import and use agentic_doc
            from agentic_doc.parse import parse
            # agentic_doc expects a list of paths
            doc_list = parse([file_path])

            if not doc_list or len(doc_list) == 0:
                logger.warning("No document parsed by agentic_doc, falling back to PyPDF2")
                return parse_pdf_with_fallback(file_path)
                
            # Get chunks from the first document
            chunks = getattr(doc_list[0], "chunks", [])

            # Normalize chunks to dictionaries with {page, text}
            normalized_chunks: List[Dict[str, Any]] = []
            for ch in chunks:
                try:
                    # text
                    text_str = str(getattr(ch, "text", "")).strip()

                    # page grounding
                    grounding = getattr(ch, "grounding", None)
                    page_num = None
                    if grounding and isinstance(grounding, (list, tuple)) and len(grounding) > 0:
                        first = grounding[0]
                        page_attr = getattr(first, "page", None)
                        if page_attr is None:
                            # try dict-like
                            try:
                                page_attr = first.get("page")  # type: ignore[attr-defined]
                            except Exception:
                                page_attr = None
                        if page_attr is not None:
                            try:
                                page_num = int(page_attr)
                            except Exception:
                                page_num = None

                    normalized_chunks.append({
                        "page": page_num,
                        "text": text_str,
                    })
                except Exception:
                    # Skip problematic chunk
                    continue

            # Filter chunks to keep only relevant ones
            filtered_chunks = filter_chunks(normalized_chunks)
            
            if not filtered_chunks:
                logger.warning("No valid chunks found in document by agentic_doc, falling back to PyPDF2")
                return parse_pdf_with_fallback(file_path)
                
            # Build page-wise text from chunks
            page_wise_text = build_condensed_text(filtered_chunks)
            
            # Set result
            result.set_page_wise_text(
                page_wise_text=page_wise_text,
                raw_chunks=normalized_chunks,
                filtered_chunks=filtered_chunks,
                parse_method="agentic_doc"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"agentic_doc parsing error: {str(e)}, falling back to PyPDF2")
            # Fallback to traditional method
            return parse_pdf_with_fallback(file_path)
    else:
        # Use fallback for PDFs with 2 or fewer pages, or when agentic_doc is not available
        logger.info(f"Using fallback parsing for PDF with {page_count} pages: {file_path}")
        return parse_pdf_with_fallback(file_path)


def parse_pdf_with_fallback(file_path: str) -> DocumentParseResult:
    """Parse a PDF document using fallback methods (PyPDF2 only, no OCR).
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        DocumentParseResult with parsed content
    """
    result = DocumentParseResult(file_path)
    try:
        # Try to extract text with PyPDF2
        import PyPDF2
        page_wise_text = {}
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            result.page_count = len(pdf_reader.pages)
            
            for page_num in range(len(pdf_reader.pages)):
                page_text = pdf_reader.pages[page_num].extract_text()
                if page_text and page_text.strip():
                    page_wise_text[f"page_{page_num + 1}"] = page_text.strip()
        
        # If we got substantial text, use it
        if page_wise_text and any(len(text.strip()) > 100 for text in page_wise_text.values()):
            result.set_page_wise_text(
                page_wise_text=page_wise_text,
                parse_method="pypdf2"
            )
            return result
        
        # If PyPDF2 didn't yield good results, fail
        result.set_error("Failed to extract text from PDF with fallback methods (no OCR)")
        return result
        
    except Exception as e:
        logger.error(f"PDF fallback parsing error: {str(e)}")
        result.set_error(f"PDF fallback parsing error: {str(e)}")
        return result


def parse_image_document(file_path: str) -> DocumentParseResult:
    """Parse an image document (no OCR, always fails)."""
    result = DocumentParseResult(file_path)
    result.set_error("Image parsing not supported (OCR removed)")
    return result