"""
Optimized PDF Processing with Caching and Intelligent Text/Image Extraction.

This module provides:
1. In-memory caching of PDF images to avoid redundant conversions
2. Intelligent routing between text and image extraction
3. Text extraction for text-heavy documents (50x faster)
4. Image conversion only when necessary
"""

import hashlib
import base64
import logging
from typing import Dict, List, Tuple, Optional, Any
from functools import lru_cache
from datetime import datetime, timedelta
import threading
from dataclasses import dataclass, field

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

logger = logging.getLogger(__name__)


@dataclass
class PDFContent:
    """Container for PDF content with both text and images."""
    file_path: str
    page_count: int
    pages: Dict[int, 'PageContent'] = field(default_factory=dict)
    is_text_extractable: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PageContent:
    """Container for individual page content."""
    page_number: int
    text: Optional[str] = None
    image_base64: Optional[str] = None
    has_images: bool = False
    is_complex_layout: bool = False


class PDFProcessorCache:
    """Thread-safe cache for PDF processing results."""

    def __init__(self, max_size: int = 50, ttl_minutes: int = 30):
        """
        Initialize PDF processor cache.

        Args:
            max_size: Maximum number of PDFs to cache
            ttl_minutes: Time-to-live for cached items in minutes
        """
        self._cache: Dict[str, PDFContent] = {}
        self._lock = threading.Lock()
        self.max_size = max_size
        self.ttl = timedelta(minutes=ttl_minutes)
        logger.info(f"Initialized PDFProcessorCache: max_size={max_size}, ttl={ttl_minutes}min")

    def _get_cache_key(self, file_path: str, pages: Optional[List[int]] = None) -> str:
        """Generate cache key for file and page combination."""
        page_str = ",".join(map(str, sorted(pages))) if pages else "all"
        key_str = f"{file_path}:{page_str}"
        return hashlib.md5(key_str.encode()).hexdigest()

    def get(self, file_path: str, pages: Optional[List[int]] = None) -> Optional[PDFContent]:
        """Retrieve cached PDF content if available and not expired."""
        cache_key = self._get_cache_key(file_path, pages)

        with self._lock:
            if cache_key in self._cache:
                content = self._cache[cache_key]

                # Check if expired
                if datetime.utcnow() - content.created_at > self.ttl:
                    logger.debug(f"Cache expired for {file_path}")
                    del self._cache[cache_key]
                    return None

                logger.debug(f"Cache HIT for {file_path}, pages={pages}")
                return content

        logger.debug(f"Cache MISS for {file_path}, pages={pages}")
        return None

    def set(self, file_path: str, content: PDFContent, pages: Optional[List[int]] = None):
        """Store PDF content in cache."""
        cache_key = self._get_cache_key(file_path, pages)

        with self._lock:
            # Implement LRU eviction if cache is full
            if len(self._cache) >= self.max_size:
                # Remove oldest entry
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
                logger.debug(f"Cache FULL, evicting oldest entry")
                del self._cache[oldest_key]

            self._cache[cache_key] = content
            logger.debug(f"Cache SET for {file_path}, pages={pages}, size={len(self._cache)}")

    def clear(self, file_path: Optional[str] = None):
        """Clear cache for specific file or entire cache."""
        with self._lock:
            if file_path:
                # Remove all entries for this file
                keys_to_remove = [k for k in self._cache.keys() if self._cache[k].file_path == file_path]
                for key in keys_to_remove:
                    del self._cache[key]
                logger.debug(f"Cleared cache for {file_path}")
            else:
                self._cache.clear()
                logger.debug("Cleared entire cache")

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            return {
                "size": len(self._cache),
                "max_size": self.max_size,
                "files_cached": len(set(c.file_path for c in self._cache.values()))
            }


class PDFProcessor:
    """Optimized PDF processor with caching and intelligent extraction."""

    # Global cache instance shared across all instances
    _cache = PDFProcessorCache(max_size=50, ttl_minutes=30)

    def __init__(self, use_cache: bool = True):
        """
        Initialize PDF processor.

        Args:
            use_cache: Whether to use caching (default: True)
        """
        self.use_cache = use_cache
        self.logger = logger

    @classmethod
    def clear_cache(cls, file_path: Optional[str] = None):
        """Clear the global cache."""
        cls._cache.clear(file_path)

    @classmethod
    def get_cache_stats(cls) -> Dict[str, Any]:
        """Get cache statistics."""
        return cls._cache.get_stats()

    def analyze_pdf_structure(self, file_path: str) -> Dict[str, Any]:
        """
        Analyze PDF to determine optimal extraction strategy.

        Returns:
            Dict with analysis results including:
            - is_text_extractable: Whether text can be extracted directly
            - has_complex_layout: Whether document has complex visual layout
            - page_count: Number of pages
            - recommended_method: 'text' or 'image'
        """
        if not fitz:
            return {
                "is_text_extractable": False,
                "has_complex_layout": True,
                "page_count": 0,
                "recommended_method": "image",
                "error": "PyMuPDF not available"
            }

        try:
            with fitz.open(file_path) as pdf:
                page_count = len(pdf)

                # Analyze first 3 pages to determine structure
                sample_pages = min(3, page_count)
                total_text_length = 0
                has_images = False
                is_scanned = False

                for i in range(sample_pages):
                    page = pdf[i]

                    # Extract text
                    text = page.get_text().strip()
                    total_text_length += len(text)

                    # Check for images
                    image_list = page.get_images()
                    if image_list:
                        has_images = True
                        # Check if it's a scanned document (large images covering page)
                        if len(image_list) > 0:
                            for img in image_list[:1]:  # Check first image
                                try:
                                    xref = img[0]
                                    img_info = pdf.extract_image(xref)
                                    # If image is large relative to page, likely scanned
                                    if img_info["width"] > 1000 and img_info["height"] > 1000:
                                        is_scanned = True
                                except:
                                    pass

                avg_text_per_page = total_text_length / sample_pages if sample_pages > 0 else 0

                # Decision logic:
                # - Scanned documents → use images
                # - Documents with good text extraction (>100 chars/page) → use text
                # - Documents with complex layouts but extractable text → hybrid approach

                is_text_extractable = avg_text_per_page > 100 and not is_scanned
                has_complex_layout = has_images or is_scanned

                if is_scanned:
                    recommended_method = "image"
                elif avg_text_per_page > 500:
                    recommended_method = "text"
                elif has_complex_layout:
                    recommended_method = "hybrid"
                else:
                    recommended_method = "text"

                self.logger.info(f"PDF Analysis: {file_path}")
                self.logger.info(f"  Pages: {page_count}, Text/page: {avg_text_per_page:.0f}, "
                               f"Has images: {has_images}, Scanned: {is_scanned}")
                self.logger.info(f"  Recommended: {recommended_method}")

                return {
                    "is_text_extractable": is_text_extractable,
                    "has_complex_layout": has_complex_layout,
                    "page_count": page_count,
                    "avg_text_per_page": avg_text_per_page,
                    "has_images": has_images,
                    "is_scanned": is_scanned,
                    "recommended_method": recommended_method
                }

        except Exception as e:
            self.logger.error(f"PDF analysis failed: {e}")
            return {
                "is_text_extractable": False,
                "has_complex_layout": True,
                "page_count": 0,
                "recommended_method": "image",
                "error": str(e)
            }

    def extract_text_from_pages(self, file_path: str, page_numbers: Optional[List[int]] = None) -> Dict[int, str]:
        """
        Extract text from specific PDF pages.

        Args:
            file_path: Path to PDF file
            page_numbers: List of page numbers (1-indexed), None for all pages

        Returns:
            Dict mapping page number to extracted text
        """
        if not fitz:
            self.logger.error("PyMuPDF not available for text extraction")
            return {}

        try:
            with fitz.open(file_path) as pdf:
                page_texts = {}

                if page_numbers is None:
                    page_numbers = list(range(1, len(pdf) + 1))

                for page_num in page_numbers:
                    if 1 <= page_num <= len(pdf):
                        page = pdf[page_num - 1]
                        text = page.get_text().strip()
                        page_texts[page_num] = text

                self.logger.debug(f"Extracted text from {len(page_texts)} pages")
                return page_texts

        except Exception as e:
            self.logger.error(f"Text extraction failed: {e}")
            return {}

    def convert_pages_to_images(self, file_path: str, page_numbers: Optional[List[int]] = None,
                               resolution_scale: float = 1.0, use_jpeg: bool = True) -> Tuple[Dict[int, str], Optional[str]]:
        """
        Convert PDF pages to base64 encoded images with caching.

        Args:
            file_path: Path to PDF file
            page_numbers: List of page numbers (1-indexed), None for all pages
            resolution_scale: Scale factor for image resolution (default: 1.0 - reduced for speed)
            use_jpeg: Use JPEG format for smaller files (default: True)

        Returns:
            Tuple of (Dict mapping page number to base64 encoded image, error message if any)
        """
        # Check cache first
        if self.use_cache:
            cached_content = self._cache.get(file_path, page_numbers)
            if cached_content:
                return {
                    page_num: page.image_base64
                    for page_num, page in cached_content.pages.items()
                    if page.image_base64
                }, None

        if not fitz:
            error_msg = "PyMuPDF not available for image conversion"
            self.logger.error(error_msg)
            return {}, error_msg

        try:
            page_images = {}
            pdf_content = PDFContent(file_path=file_path, page_count=0)

            with fitz.open(file_path) as pdf:
                pdf_content.page_count = len(pdf)

                if page_numbers is None:
                    page_numbers = list(range(1, len(pdf) + 1))

                matrix = fitz.Matrix(resolution_scale, resolution_scale)

                for page_num in page_numbers:
                    if 1 <= page_num <= len(pdf):
                        page = pdf[page_num - 1]
                        pix = page.get_pixmap(matrix=matrix)

                        # Use JPEG for smaller files (50-70% smaller than PNG)
                        if use_jpeg:
                            try:
                                # Try newer PyMuPDF API with quality parameter
                                img_bytes = pix.tobytes("jpeg", quality=85)
                            except TypeError:
                                # Fall back to older API without quality parameter
                                img_bytes = pix.tobytes("jpeg")
                            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                        else:
                            img_bytes = pix.tobytes("png")
                            img_b64 = base64.b64encode(img_bytes).decode("utf-8")

                        page_images[page_num] = img_b64

                        # Store in PDFContent for caching
                        pdf_content.pages[page_num] = PageContent(
                            page_number=page_num,
                            image_base64=img_b64
                        )

                        # Log size for monitoring
                        size_mb = len(img_b64) / 1024 / 1024
                        self.logger.debug(f"Page {page_num}: {size_mb:.2f} MB base64")

                self.logger.info(f"Converted {len(page_images)} pages to images at {resolution_scale}x resolution")

            # Cache the result
            if self.use_cache:
                self._cache.set(file_path, pdf_content, page_numbers)

            return page_images, None

        except Exception as e:
            error_msg = f"Image conversion failed: {str(e)}"
            self.logger.error(error_msg)
            return {}, error_msg

    def get_pdf_content(self, file_path: str, page_numbers: Optional[List[int]] = None,
                       force_images: bool = False) -> PDFContent:
        """
        Get PDF content with intelligent text/image extraction.

        This is the main method that automatically decides whether to use
        text extraction or image conversion based on PDF structure.

        Args:
            file_path: Path to PDF file
            page_numbers: List of page numbers (1-indexed), None for all pages
            force_images: Force image conversion even if text is extractable

        Returns:
            PDFContent object with both text and images as needed
        """
        # Check cache first
        if self.use_cache:
            cached_content = self._cache.get(file_path, page_numbers)
            if cached_content:
                self.logger.debug(f"Returning cached content for {file_path}")
                return cached_content

        # Analyze PDF structure
        analysis = self.analyze_pdf_structure(file_path)

        pdf_content = PDFContent(
            file_path=file_path,
            page_count=analysis.get("page_count", 0),
            is_text_extractable=analysis.get("is_text_extractable", False)
        )

        if page_numbers is None:
            page_numbers = list(range(1, pdf_content.page_count + 1))

        recommended_method = analysis.get("recommended_method", "image")

        # Extract content based on recommendation
        if force_images or recommended_method == "image":
            # Use image conversion
            self.logger.info(f"Using IMAGE extraction for {file_path}")
            page_images, error = self.convert_pages_to_images(file_path, page_numbers)
            if error:
                self.logger.error(f"Failed to convert PDF to images: {error}")
                # Store error in pdf_content for caller to handle
                pdf_content.pages[0] = PageContent(page_number=0, text=f"Error: {error}")
            else:
                for page_num, img_b64 in page_images.items():
                    pdf_content.pages[page_num] = PageContent(
                        page_number=page_num,
                        image_base64=img_b64
                    )

        elif recommended_method == "text":
            # Use text extraction only
            self.logger.info(f"Using TEXT extraction for {file_path}")
            page_texts = self.extract_text_from_pages(file_path, page_numbers)
            for page_num, text in page_texts.items():
                pdf_content.pages[page_num] = PageContent(
                    page_number=page_num,
                    text=text
                )

        else:  # hybrid
            # Extract both text and images
            self.logger.info(f"Using HYBRID extraction for {file_path}")
            page_texts = self.extract_text_from_pages(file_path, page_numbers)
            page_images, error = self.convert_pages_to_images(file_path, page_numbers)

            if error:
                self.logger.error(f"Failed to convert PDF to images in hybrid mode: {error}")
                # Fall back to text-only
                for page_num, text in page_texts.items():
                    pdf_content.pages[page_num] = PageContent(
                        page_number=page_num,
                        text=text,
                        is_complex_layout=True
                    )
            else:
                for page_num in page_numbers:
                    pdf_content.pages[page_num] = PageContent(
                        page_number=page_num,
                        text=page_texts.get(page_num),
                        image_base64=page_images.get(page_num),
                        is_complex_layout=True
                    )

        # Cache the result
        if self.use_cache:
            self._cache.set(file_path, pdf_content, page_numbers)

        return pdf_content


# Global instance for easy access
_global_processor = PDFProcessor(use_cache=True)


def get_pdf_processor(use_cache: bool = True) -> PDFProcessor:
    """Get a PDF processor instance."""
    if use_cache:
        return _global_processor
    return PDFProcessor(use_cache=False)


def clear_pdf_cache(file_path: Optional[str] = None):
    """Clear PDF processing cache."""
    PDFProcessor.clear_cache(file_path)


def get_cache_stats() -> Dict[str, Any]:
    """Get PDF cache statistics."""
    return PDFProcessor.get_cache_stats()
