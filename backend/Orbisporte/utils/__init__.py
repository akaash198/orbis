"""
Technical Utilities Module for IDP System.

This module contains technical utilities for the IDP system, including
image processing, document parsing, and other helper functions.
"""

import base64
import os
from typing import List, Optional, Dict, Any
from PIL import Image
from io import BytesIO
import io
import base64 as _b64

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

# Import document parser functions for easy access
from .document_parser import (
    parse_document,
    DocumentParseResult
)

def encode_image(image_path):
    """Encode an image file to base64."""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
    except Exception as e:
        print(f"Error encoding image: {e}")
        return ""

def encode_image_from_pil(image):
    """Encode a PIL image to base64."""
    from io import BytesIO
    try:
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        buffered.seek(0)
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"Error encoding PIL image: {e}")
        return ""

def convert_pdf_to_images(pdf_path, output_folder):
    """Convert PDF to a list of image paths."""
    try:
        from pdf2image import convert_from_path
        
        file_name = os.path.basename(pdf_path)
        file_name_no_extension = os.path.splitext(file_name)[0]
        
        images = convert_from_path(pdf_path, output_folder=output_folder, fmt="png")
        
        image_paths = []
        for i, image in enumerate(images):
            image_path = os.path.join(
                output_folder, f"{file_name_no_extension}_page_{i+1}.png"
            )
            image.save(image_path, "PNG")
            image_paths.append(image_path)
        
        return image_paths
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        return []

def clean_output_folder(output_folder):
    """Remove all files from the output folder."""
    try:
        import shutil
        if os.path.exists(output_folder):
            shutil.rmtree(output_folder)
        os.makedirs(output_folder, exist_ok=True)
    except Exception as e:
        print(f"Error cleaning output folder: {e}")

__all__ = [
    'encode_image',
    'encode_image_from_pil', 
    'convert_pdf_to_images',
    'clean_output_folder',
    'parse_document',
    'DocumentParseResult'
]

def pdf_to_images_base64(pdf_path: str, dpi: int = 300) -> List[str]:
    """Convert each PDF page to PNG and return base64 strings. Requires PyMuPDF.

    Args:
        pdf_path: Path to PDF file
        dpi: Rendering resolution
    Returns:
        List of base64 strings (PNG per page). Empty list on failure.
    """
    pages: List[str] = []
    try:
        if fitz is None:
            return pages
        doc = fitz.open(pdf_path)
        for page_index in range(len(doc)):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(dpi=dpi)
            buffer = io.BytesIO(pix.tobytes("png"))
            pages.append(_b64.b64encode(buffer.getvalue()).decode("utf-8"))
        return pages
    except Exception as e:
        print(f"Error converting PDF to base64 pages: {e}")
        return []

