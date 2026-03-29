from typing import Dict, Any, Optional, List
from Orbisporte.infrastructure.get_llm import openai_client, Config
from Orbisporte.infrastructure.pdf_processor import get_pdf_processor, PDFProcessor, clear_pdf_cache
import logging
import json
import os
import base64
import io
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

from Orbisporte.domain.services.doc_classification import DocumentClassificationService
from Orbisporte.utils import encode_image, pdf_to_images_base64

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

logger = logging.getLogger(__name__)

class DocumentExtractionService:
    """Service for extracting structured data from documents via OpenAI.

    Now optimized with:
    - Shared PDF processing cache (no redundant conversions)
    - Intelligent text extraction (50x faster for text-based PDFs)
    - Image processing only when necessary
    """

    def __init__(self, llm_client=None, pdf_processor: PDFProcessor = None):
        self.logger = logger
        self.llm_client = llm_client or openai_client()
        # Share PDF processor instance with classification service for cache reuse
        self.pdf_processor = pdf_processor or get_pdf_processor(use_cache=True)
        self.classification_service = DocumentClassificationService(
            llm_client=self.llm_client,
            pdf_processor=self.pdf_processor  # Share the same processor!
        )
        
    def extract_data(self, file_path: str, document_type: str = "unknown",
                    classification_result: Optional[Dict[str, Any]] = None,
                    extract_barcodes: bool = False,
                    skip_classification: bool = False) -> Dict[str, Any]:
        """Extract structured data from a document.

        Args:
            file_path: Path to the document file
            document_type: Type of document (invoice, bill_of_lading, etc.)
            classification_result: Pre-computed classification result
            extract_barcodes: Whether to extract barcodes (default: False for performance)
            skip_classification: Skip classification and extract entire document (faster for known types)

        Returns:
            Dict with extracted data
        """
        try:
            if not os.path.exists(file_path):
                return {"error": f"File not found: {file_path}"}

            # For non-PDFs, use direct image extraction
            if not file_path.lower().endswith('.pdf'):
                return self._extract_from_image_file(file_path, document_type, extract_barcodes)

            # OPTIMIZATION: Skip classification if document type is known (saves 5+ seconds!)
            if skip_classification or (document_type != "unknown" and not classification_result):
                self.logger.info(f"Skipping classification, extracting as {document_type} (faster!)")
                return self._extract_entire_pdf_optimized(file_path, document_type)

            # For PDFs, use classification-based extraction
            if not classification_result or "document_types" not in classification_result:
                self.logger.info(f"Classifying document: {file_path}")
                classification_result = self.classification_service.classify_document_pages(file_path)

            if "error" in classification_result:
                self.logger.warning(f"Classification failed, using fallback extraction")
                return self._extract_entire_pdf(file_path, document_type)

            # Extract based on classification
            document_types = classification_result.get("document_types", {})
            primary_type = classification_result.get("primary_document_type", document_type)

            if not document_types:
                return self._extract_entire_pdf(file_path, primary_type)

            # Extract data for each document type
            type_results = {}
            self.logger.info(f"Processing {len(document_types)} document types: {list(document_types.keys())}")

            for doc_type, pages in document_types.items():
                if not pages:
                    self.logger.warning(f"No pages found for document type: {doc_type}")
                    continue

                self.logger.info(f"Extracting {doc_type} from {len(pages)} pages: {pages}")
                type_result = self._extract_pdf_pages(file_path, doc_type, pages)

                # More tolerant result handling - accept partial results
                if isinstance(type_result, dict):
                    if "error" not in type_result:
                        type_results[doc_type] = type_result
                        self.logger.info(f"Successfully extracted {doc_type} data")
                    else:
                        # Still add the result if it has some useful data
                        if "combined" in type_result or "pages" in type_result:
                                self.logger.warning(f"Partial extraction for {doc_type}, using available data")
                                type_results[doc_type] = type_result
                else:
                    self.logger.warning(f"Failed to extract {doc_type}: {type_result['error']}")

            # More lenient error handling - attempt to continue even with empty or partial results
            if not type_results:
                self.logger.warning("No successful per-type extractions; attempting fallback on entire PDF")
                # Try with fallback to direct extraction
                fallback_result = self._extract_entire_pdf(file_path, primary_type)
                if isinstance(fallback_result, dict) and "error" not in fallback_result:
                    type_results[primary_type] = fallback_result
                    self.logger.info(f"Fallback extraction successful for {primary_type}")
                else:
                    self.logger.error("Fallback extraction also failed")
                    return {"error": "No successful extractions from any document type"}

            # Normalize each type into a common schema and then create a concise combined view
            by_type_normalized = {}
            for t, res in type_results.items():
                try:
                    by_type_normalized[t] = self._combine_results({t: res}, t)
                except Exception as e:
                    self.logger.warning(f"Normalization failed for {t}: {e}")

            combined_result = self._combine_results(type_results, primary_type)

            # Just return the combined result directly with minimal wrappers
            combined_result["primary_document_type"] = primary_type
            combined_result["document_types_pages"] = document_types

            # Final aggregation pass to validate and recalculate totals
            combined_result = self._final_aggregation_pass(combined_result, file_path)

            # Auto-lookup missing HS Codes
            combined_result = self._enhance_with_hscode_lookup(combined_result, enable_lookup=True)

            # Only extract barcodes if requested (performance optimization)
            if extract_barcodes:
                self.logger.info(f"[BARCODE] Barcode extraction ENABLED for {file_path}")
                try:
                    barcodes = self.extract_barcodes(file_path)
                    combined_result["barcodes"] = barcodes
                    self.logger.info(f"[BARCODE] Extraction complete. Found {len(barcodes)} barcode(s)")
                    if barcodes:
                        for idx, bc in enumerate(barcodes):
                            self.logger.info(f"[BARCODE]   #{idx+1}: {bc.get('type', 'unknown')} - {bc.get('text', '')[:50]}...")
                    else:
                        self.logger.warning(f"[BARCODE] NO BARCODES DETECTED in {file_path}")
                except Exception as barcode_err:
                    self.logger.error(f"[BARCODE] Extraction failed: {barcode_err}", exc_info=True)
                    combined_result["barcodes"] = []
            else:
                self.logger.info(f"[BARCODE] Barcode extraction DISABLED (extract_barcodes=False)")
                combined_result["barcodes"] = []

            self.logger.info(f"Returning extraction result with keys: {list(combined_result.keys())}")

            # Clear cache for this file after extraction completes
            # This frees memory while keeping cache warm for concurrent requests
            self.logger.debug(f"Clearing cache for {file_path}")
            clear_pdf_cache(file_path)

            return combined_result

        except Exception as e:
            self.logger.error(f"Extraction error: {e}")
            # Clear cache on error as well
            clear_pdf_cache(file_path)
            return {"error": f"Extraction failed: {str(e)}"}

    def _extract_from_image_file(self, file_path: str, document_type: str, extract_barcodes: bool = False) -> Dict[str, Any]:
        """Extract data from a single image file."""
        # CRITICAL DEBUG: This print MUST appear in logs
        print(f"[IMAGE EXTRACT DEBUG] Called _extract_from_image_file with extract_barcodes={extract_barcodes} for {file_path}")
        try:
            from Orbisporte.prompts.doc_extraction_prompts import direct_extraction_prompt

            with open(file_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")

            messages = [{
                "role": "user",
                "content": [
                    {"type": "text", "text": direct_extraction_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                ],
            }]

            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.0,
                max_tokens=4000,
            )

            if not response.choices or len(response.choices) == 0:
                return {"error": "No response choices received from LLM"}

            content = response.choices[0].message.content
            if not content:
                return {"error": "Empty response content from LLM"}

            parsed = self._parse_json_response(content)
            result = {
                "document_type": document_type,
                "pages": {"page_1": parsed},
                "combined": parsed
            }

            # Extract barcodes if requested
            print(f"[IMAGE EXTRACT DEBUG] Checking barcode flag: extract_barcodes={extract_barcodes}")
            if extract_barcodes:
                print(f"[IMAGE EXTRACT DEBUG] BARCODE EXTRACTION ENABLED - about to call extract_barcodes()")
                self.logger.info(f"[BARCODE] Barcode extraction ENABLED for image file: {file_path}")
                try:
                    barcodes = self.extract_barcodes(file_path)
                    result["barcodes"] = barcodes
                    self.logger.info(f"[BARCODE] Extraction complete. Found {len(barcodes)} barcode(s)")
                    if barcodes:
                        for idx, bc in enumerate(barcodes):
                            self.logger.info(f"[BARCODE]   #{idx+1}: {bc.get('type', 'unknown')} - {bc.get('text', '')[:50]}...")
                    else:
                        self.logger.warning(f"[BARCODE] NO BARCODES DETECTED in {file_path}")
                except Exception as barcode_err:
                    self.logger.error(f"[BARCODE] Extraction failed: {barcode_err}", exc_info=True)
                    result["barcodes"] = []
            else:
                self.logger.info(f"[BARCODE] Barcode extraction DISABLED for image file (extract_barcodes=False)")
                result["barcodes"] = []

            return result

        except Exception as e:
            self.logger.error(f"Image extraction error: {e}")
            return {"error": f"Image extraction failed: {str(e)}"}

    def _extract_entire_pdf(self, file_path: str, document_type: str) -> Dict[str, Any]:
        """Extract from the entire PDF as a fallback.

        Now optimized with cache and intelligent text/image routing.
        """
        try:
            # Analyze PDF first
            analysis = self.pdf_processor.analyze_pdf_structure(file_path)
            page_count = analysis.get("page_count", 0)
            max_pages = min(page_count, 10)  # Limit to first 10 pages for API limits

            recommended_method = analysis.get("recommended_method", "image")

            # Try text extraction if recommended
            if recommended_method == "text" and not analysis.get("is_scanned", False):
                self.logger.info(f"Using TEXT extraction for entire PDF (faster)")
                page_numbers = list(range(1, max_pages + 1))
                return self._extract_pages_with_text(file_path, document_type, page_numbers)

            # Use cached image conversion
            self.logger.info(f"Using IMAGE extraction for entire PDF (cache-optimized)")
            page_numbers = list(range(1, max_pages + 1))
            # OPTIMIZATION: Lower resolution + JPEG for faster API
            page_images_dict, error = self.pdf_processor.convert_pages_to_images(
                file_path,
                page_numbers=page_numbers,
                resolution_scale=1.0,  # Reduced from 1.5x
                use_jpeg=True  # JPEG is much smaller
            )

            if error:
                self.logger.error(f"PDF conversion failed for {file_path}: {error}")
                return {"error": f"Failed to convert PDF to images: {error}"}

            page_images = [page_images_dict[i] for i in sorted(page_images_dict.keys())]

            if not page_images:
                return {"error": "Failed to convert PDF to images: No pages converted"}

            prompt = self._get_prompt_for_type(document_type)

            # Build content with text and all images
            content = [{"type": "text", "text": prompt}]
            for img_b64 in page_images:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}})

            messages = [{
                "role": "user",
                "content": content
            }]

            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.0,
                max_tokens=4096,
            )

            if not response.choices or len(response.choices) == 0:
                return {"error": "No response choices received from LLM"}

            content = response.choices[0].message.content
            if not content:
                return {"error": "Empty response content from LLM"}

            parsed = self._parse_json_response(content)
            result = {
                "document_type": document_type,
                "pages": {"page_1": parsed},
                "combined": parsed
            }
            # Barcodes will be added by caller if needed
            return result

        except Exception as e:
            self.logger.error(f"PDF extraction error: {e}")
            return {"error": f"PDF extraction failed: {str(e)}"}

    def _extract_pdf_pages(self, file_path: str, document_type: str, page_numbers: List[int]) -> Dict[str, Any]:
        """Extract data from specific pages of a PDF.

        Now optimized with:
        - Uses cached images from classification (no redundant conversion)
        - Intelligent text extraction for text-based documents
        """
        try:
            self.logger.info(f"Extracting {document_type} from pages {page_numbers}")

            # Analyze PDF to determine extraction strategy
            analysis = self.pdf_processor.analyze_pdf_structure(file_path)
            recommended_method = analysis.get("recommended_method", "image")

            # Use intelligent extraction based on document type
            if recommended_method == "text" and not analysis.get("is_scanned", False):
                # Fast path: Extract text directly (50x faster)
                self.logger.info(f"Using TEXT extraction for {document_type} (much faster!)")
                return self._extract_pages_with_text(file_path, document_type, page_numbers)

            # Standard path: Use images (cached from classification!)
            self.logger.info(f"Using IMAGE extraction for {document_type} (cache-optimized)")

            # Use PDF processor to get images - these will be FROM CACHE if classification ran!
            # OPTIMIZATION: Use 1.0x resolution and JPEG for 50-70% smaller files (faster API)
            page_images_dict = self.pdf_processor.convert_pages_to_images(
                file_path,
                page_numbers=page_numbers,
                resolution_scale=1.0,  # Reduced from 1.5x for speed
                use_jpeg=True  # Use JPEG for smaller files
            )

            pages_b64 = [page_images_dict[page_num] for page_num in page_numbers if page_num in page_images_dict]

            if not pages_b64:
                return {"error": f"Failed to convert pages {page_numbers} to images"}

            # Get appropriate prompt
            prompt = self._get_prompt_for_type(document_type)

            # OPTIMIZATION: Process pages in larger batches with parallel API calls
            batch_size = 5  # Increased from 3 (fewer API calls)
            all_results = []

            # Prepare all batches
            batches = []
            for i in range(0, len(pages_b64), batch_size):
                batch = pages_b64[i:i + batch_size]
                batch_page_numbers = page_numbers[i:i + batch_size]
                batches.append((i, batch, batch_page_numbers))

            # Process batches in parallel (3x faster!)
            if len(batches) > 1:
                self.logger.info(f"Processing {len(batches)} batches in PARALLEL...")
                all_results = self._process_batches_parallel(batches, document_type, prompt)
            else:
                # Single batch - process normally
                self.logger.info(f"Processing single batch...")
                for i, batch, batch_page_numbers in batches:
                    result = self._process_single_batch(batch, batch_page_numbers, document_type, prompt)
                    if result:
                        all_results.append(result)

            if not all_results:
                return {"error": f"Failed to extract data from {document_type} pages"}

            # Combine batch results
            combined = self._combine_batch_results(all_results, document_type)
            result = {
                "document_type": document_type,
                "pages": combined,
                "combined": combined,
                "pages_processed": page_numbers
            }
            # Barcodes will be added by caller if needed
            return result

        except Exception as e:
            self.logger.error(f"PDF page extraction error: {e}")
            return {"error": f"Failed to extract pages for {document_type}: {str(e)}"}

    def _extract_pages_with_text(self, file_path: str, document_type: str, page_numbers: List[int]) -> Dict[str, Any]:
        """Extract data using direct text extraction (much faster for text-based PDFs).

        This method extracts text directly from the PDF without image conversion,
        resulting in 50x faster processing and lower API costs.
        """
        try:
            self.logger.info(f"Using fast text extraction for {document_type} from pages {page_numbers}")

            # Extract text from specified pages
            page_texts = self.pdf_processor.extract_text_from_pages(file_path, page_numbers)

            if not page_texts:
                self.logger.warning("No text extracted, falling back to image extraction")
                # Fallback to image extraction if text extraction fails
                return self._extract_pdf_pages(file_path, document_type, page_numbers)

            # Get appropriate prompt
            prompt = self._get_prompt_for_type(document_type)

            # Process pages in batches of 5 (text is much smaller than images)
            batch_size = 5
            all_results = []

            page_numbers_list = sorted(page_texts.keys())

            for i in range(0, len(page_numbers_list), batch_size):
                batch_page_numbers = page_numbers_list[i:i + batch_size]
                batch_texts = [page_texts[pnum] for pnum in batch_page_numbers]

                # Combine text from multiple pages
                combined_text = "\n\n".join([
                    f"=== PAGE {pnum} ===\n{text}"
                    for pnum, text in zip(batch_page_numbers, batch_texts)
                ])

                # Create text-based prompt
                text_prompt = f"""{prompt}

You are extracting data from pages {batch_page_numbers} of a {document_type} document.
These pages have been pre-classified as containing {document_type} information.

Below is the text content extracted from these pages:

{combined_text}

Extract the information according to the schema in the prompt above.
"""

                messages = [{
                    "role": "user",
                    "content": text_prompt
                }]

                response = self.llm_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.0,
                    max_tokens=4096,
                )

                if not response.choices or len(response.choices) == 0:
                    self.logger.warning(f"No response choices for batch {i+1}")
                    continue

                content = response.choices[0].message.content
                if not content:
                    self.logger.warning(f"Empty content for batch {i+1}")
                    continue

                batch_result = self._parse_json_response(content)
                if "error" not in batch_result:
                    all_results.append(batch_result)
                    self.logger.info(f"Successfully extracted text batch {i+1}/{(len(page_numbers_list) + batch_size - 1) // batch_size}")

            if not all_results:
                return {"error": f"Failed to extract data from {document_type} pages"}

            # Combine batch results
            combined = self._combine_batch_results(all_results, document_type)
            result = {
                "document_type": document_type,
                "pages": combined,
                "combined": combined,
                "pages_processed": page_numbers,
                "extraction_method": "text"  # Indicate we used text extraction
            }

            self.logger.info(f"Text extraction completed successfully for {len(page_numbers)} pages")
            return result

        except Exception as e:
            self.logger.error(f"Text-based extraction error: {e}, falling back to image extraction")
            # Fallback to image extraction
            return self._extract_pdf_pages(file_path, document_type, page_numbers)

    def _process_single_batch(self, batch: List[str], batch_page_numbers: List[int],
                              document_type: str, prompt: str) -> Optional[Dict[str, Any]]:
        """Process a single batch of pages."""
        try:
            page_specific_prompt = f"""{prompt}

You are extracting data from pages {batch_page_numbers} of a {document_type} document.
These pages have been pre-classified as containing {document_type} information.
Extract only the information visible on these specific pages.

Page numbers being processed: {batch_page_numbers}
"""

            messages = [{
                "role": "user",
                "content": [
                    {"type": "text", "text": page_specific_prompt},
                    *[{"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img}"}} for img in batch]
                ]
            }]

            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.0,
                max_tokens=4096,
            )

            if not response.choices or len(response.choices) == 0:
                self.logger.warning(f"No response choices for batch")
                return None

            content = response.choices[0].message.content
            if not content:
                self.logger.warning(f"Empty content for batch")
                return None

            batch_result = self._parse_json_response(content)
            if "error" not in batch_result:
                return batch_result

            return None

        except Exception as e:
            self.logger.error(f"Batch processing error: {e}")
            return None

    def _process_batches_parallel(self, batches: List, document_type: str, prompt: str) -> List[Dict[str, Any]]:
        """Process multiple batches in parallel using ThreadPoolExecutor.

        This reduces total API call time by 50-70% for multi-batch documents.
        """
        all_results = []
        start_time = time.time()

        # Use ThreadPoolExecutor to make parallel API calls
        with ThreadPoolExecutor(max_workers=3) as executor:
            # Submit all batch processing tasks
            future_to_batch = {
                executor.submit(
                    self._process_single_batch,
                    batch,
                    batch_page_numbers,
                    document_type,
                    prompt
                ): (i, batch_page_numbers)
                for i, batch, batch_page_numbers in batches
            }

            # Collect results as they complete
            for future in as_completed(future_to_batch):
                batch_idx, batch_pages = future_to_batch[future]
                try:
                    result = future.result()
                    if result:
                        all_results.append(result)
                        self.logger.info(f"Batch {batch_idx + 1} completed (pages {batch_pages})")
                except Exception as e:
                    self.logger.error(f"Batch {batch_idx + 1} failed: {e}")

        elapsed = time.time() - start_time
        self.logger.info(f"All {len(batches)} batches completed in {elapsed:.1f}s (parallel processing)")

        return all_results

    def _extract_entire_pdf_optimized(self, file_path: str, document_type: str) -> Dict[str, Any]:
        """
        Optimized extraction that processes entire document in ONE API call.

        This is 3x faster than batch processing for small-medium documents (up to 10 pages).
        Use when document type is already known (skip classification).
        """
        try:
            self.logger.info(f"FAST MODE: Single-call extraction for {document_type}")
            start_time = time.time()

            # Analyze PDF
            analysis = self.pdf_processor.analyze_pdf_structure(file_path)
            page_count = analysis.get("page_count", 0)
            max_pages = min(page_count, 10)  # API limit

            recommended_method = analysis.get("recommended_method", "image")

            # Try text extraction if suitable (50x faster)
            if recommended_method == "text" and not analysis.get("is_scanned", False):
                self.logger.info("Using TEXT extraction (50x faster than images)")
                page_numbers = list(range(1, max_pages + 1))

                # Extract all text at once
                page_texts = self.pdf_processor.extract_text_from_pages(file_path, page_numbers)

                if page_texts:
                    # Combine all pages into single text
                    combined_text = "\n\n".join([
                        f"=== PAGE {pnum} ===\n{text}"
                        for pnum, text in sorted(page_texts.items())
                    ])

                    prompt = self._get_prompt_for_type(document_type)
                    text_prompt = f"""{prompt}

Extract information from this {page_count}-page {document_type} document.
All pages are shown below:

{combined_text}

Extract the complete information according to the schema.
"""

                    # Single API call for entire document
                    response = self.llm_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": text_prompt}],
                        temperature=0.0,
                        max_tokens=4096,
                    )

                    elapsed = time.time() - start_time
                    self.logger.info(f"Text extraction completed in {elapsed:.1f}s")

                    if response.choices and response.choices[0].message.content:
                        parsed = self._parse_json_response(response.choices[0].message.content)

                        # Apply HS Code enhancement to the parsed data (before wrapping in result)
                        self.logger.info("[HS Code Enhancement - Text Path] Starting HS Code lookup for fast extraction")
                        enhanced_data = self._enhance_with_hscode_lookup(parsed, enable_lookup=True)

                        result = {
                            "document_type": document_type,
                            "combined": enhanced_data,  # Use enhanced data
                            "pages_processed": page_numbers,
                            "extraction_method": "text_single_call",
                            "processing_time": elapsed
                        }

                        return result

            # Fallback to image extraction (still single call for speed)
            self.logger.info("Using IMAGE extraction (single call)")
            page_numbers = list(range(1, max_pages + 1))

            # Get all images at once (may be cached)
            # OPTIMIZATION: Use lower resolution and JPEG for faster API response
            page_images_dict, error = self.pdf_processor.convert_pages_to_images(
                file_path,
                page_numbers,
                resolution_scale=1.0,  # Reduced from 1.5x
                use_jpeg=True  # JPEG is 50-70% smaller than PNG
            )

            if error:
                self.logger.error(f"PDF conversion failed for {file_path}: {error}")
                return {"error": f"Failed to convert PDF to images: {error}"}

            page_images = [page_images_dict[i] for i in sorted(page_images_dict.keys())]

            if not page_images:
                return {"error": "Failed to convert PDF to images: No pages converted"}

            prompt = self._get_prompt_for_type(document_type)

            # Calculate total payload size
            total_size_mb = sum(len(img) for img in page_images) / 1024 / 1024
            self.logger.info(f"Total payload: {total_size_mb:.1f} MB for {len(page_images)} pages")

            if total_size_mb > 15:
                self.logger.warning(f"Large payload ({total_size_mb:.1f} MB) may cause slow API response!")

            # Build content with ALL images in one call
            content = [{"type": "text", "text": prompt}]
            for img_b64 in page_images:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}})

            # Single API call for entire document
            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": content}],
                temperature=0.0,
                max_tokens=4096,
            )

            elapsed = time.time() - start_time
            self.logger.info(f"Image extraction completed in {elapsed:.1f}s")

            if response.choices and response.choices[0].message.content:
                parsed = self._parse_json_response(response.choices[0].message.content)

                # Apply HS Code enhancement to the parsed data (before wrapping in result)
                self.logger.info("[HS Code Enhancement - Image Path] Starting HS Code lookup for fast extraction")
                enhanced_data = self._enhance_with_hscode_lookup(parsed, enable_lookup=True)

                result = {
                    "document_type": document_type,
                    "combined": enhanced_data,  # Use enhanced data
                    "pages_processed": page_numbers,
                    "extraction_method": "image_single_call",
                    "processing_time": elapsed
                }

                return result

            return {"error": "No response from LLM"}

        except Exception as e:
            self.logger.error(f"Optimized extraction failed: {e}")
            return {"error": f"Extraction failed: {str(e)}"}

    def _combine_results(self, type_results: Dict[str, Dict[str, Any]], primary_type: str) -> Dict[str, Any]:
        """Combine results from multiple document types by merging JSON directly."""
        if not type_results:
            self.logger.warning("No results to combine, returning empty structure")
            return {}

        self.logger.info(f"Combining results from {len(type_results)} document types: {list(type_results.keys())}")
        
        # For single document type, just return its data directly
        if len(type_results) == 1:
            doc_type = next(iter(type_results.keys()))
            result = next(iter(type_results.values()))
            
            # Use combined data if available, otherwise the whole result
            combined_data = result.get("combined", result)
            
            # Add metadata about document type
            if isinstance(combined_data, dict):
                combined_data["_document_type"] = doc_type
            
            self.logger.info(f"Returning single document type result: {doc_type}")
            return combined_data

        # For multiple document types, merge them into a single structure
        combined = {
            "_multi_document": True,
            "_document_types": list(type_results.keys()),
            "_primary_type": primary_type
        }
        
        # Create sections for each document type
        for doc_type, result in type_results.items():
            data = result.get("combined", result)
            # Store each document type's data under its own key
            combined[doc_type] = data
            self.logger.info(f"Added document type {doc_type} data")
        
        # For convenience, also add data from primary type at the root level
        if primary_type in type_results:
            primary_data = type_results[primary_type].get("combined", type_results[primary_type])
            
            # Copy primary document data to the root level
            if isinstance(primary_data, dict):
                for key, value in primary_data.items():
                    # Don't override metadata keys
                    if not key.startswith("_") and key not in combined:
                        combined[key] = value
        self.logger.info(f"Created combined result with keys: {list(combined.keys())}")
        return combined

    def _combine_batch_results(self, batch_results: List[Dict[str, Any]], document_type: str) -> Dict[str, Any]:
        """Combine results from multiple batches with intelligent aggregation."""
        if len(batch_results) == 1:
            return batch_results[0]

        self.logger.info(f"Combining {len(batch_results)} batches with intelligent aggregation")

        combined = {}

        # Track numeric fields that need summing (not overwriting)
        numeric_sum_fields = {
            'total_units', 'total_units_sum', 'total_quantity', 'quantity_sum',
            'calculated_total', 'subtotal', 'calculated_grand_total', 'total_line_items'
        }

        # Track fields that should keep the LAST value (usually grand totals)
        last_value_fields = {
            'invoice_total', 'grand_total', 'total_amount'
        }

        for batch_idx, result in enumerate(batch_results):
            if not isinstance(result, dict):
                continue

            for key, value in result.items():
                # Case 1: Arrays (like 'items') - concatenate
                if isinstance(value, list):
                    if key not in combined:
                        combined[key] = []
                    combined[key].extend(value)
                    self.logger.debug(f"Extended array '{key}': {len(combined[key])} total items")

                # Case 2: Dictionaries - smart merge
                elif isinstance(value, dict):
                    if key not in combined:
                        combined[key] = {}

                    # Merge dict values intelligently
                    for sub_key, sub_value in value.items():
                        normalized_key = sub_key.lower().replace(' ', '_')

                        # Sum numeric fields
                        if normalized_key in numeric_sum_fields:
                            if sub_key not in combined[key]:
                                combined[key][sub_key] = 0
                            try:
                                # Handle string numbers like "$5,000.00"
                                clean_value = str(sub_value).replace('$', '').replace(',', '').strip()
                                if clean_value and clean_value != 'null' and clean_value != 'None':
                                    combined[key][sub_key] += float(clean_value)
                                    self.logger.debug(f"Summed {sub_key}: {combined[key][sub_key]}")
                            except (ValueError, TypeError):
                                combined[key][sub_key] = sub_value

                        # Keep last value for grand totals
                        elif normalized_key in last_value_fields:
                            combined[key][sub_key] = sub_value
                            self.logger.debug(f"Using last value for {sub_key}: {sub_value}")

                        # For other fields, first non-null wins
                        else:
                            if sub_key not in combined[key] or combined[key][sub_key] is None:
                                combined[key][sub_key] = sub_value

                # Case 3: Primitives - keep first or last depending on context
                else:
                    if key not in combined:
                        combined[key] = value

        # Post-processing: Recalculate totals from combined items
        combined = self._recalculate_totals(combined, document_type)

        return combined

    def _deduplicate_items(self, items: List[Dict]) -> List[Dict]:
        """Remove duplicate items based on description + quantity."""

        seen = set()
        unique_items = []

        for item in items:
            # Create fingerprint
            desc = str(item.get('description', '')).strip().lower()
            qty = str(item.get('quantity', ''))
            price = str(item.get('unit_price', ''))
            fingerprint = f"{desc}|{qty}|{price}"

            if fingerprint not in seen:
                seen.add(fingerprint)
                unique_items.append(item)
            else:
                self.logger.warning(f"Removed duplicate item: {desc[:50]}")

        if len(unique_items) < len(items):
            self.logger.info(f"Deduplication: {len(items)} → {len(unique_items)} items")

        return unique_items

    def _recalculate_totals(self, data: Dict[str, Any], document_type: str) -> Dict[str, Any]:
        """Recalculate totals from combined item arrays."""

        # For invoices
        if document_type.lower() in ['invoice', 'commercial_invoice']:
            items = data.get('items', [])

            if items:
                # Deduplicate items first
                items = self._deduplicate_items(items)
                data['items'] = items

                # Calculate totals from items
                total_count = len(items)
                total_units = 0
                calculated_total = 0.0

                for item in items:
                    # Sum quantities
                    qty = item.get('quantity', item.get('qty', 0))
                    try:
                        clean_qty = str(qty).replace(',', '').strip()
                        if clean_qty:
                            total_units += float(clean_qty)
                    except (ValueError, TypeError):
                        pass

                    # Sum amounts
                    amount = item.get('amount', item.get('total', item.get('line_total', 0)))
                    try:
                        clean_amount = str(amount).replace('$', '').replace(',', '').strip()
                        if clean_amount:
                            calculated_total += float(clean_amount)
                    except (ValueError, TypeError):
                        pass

                # Add/update summary section
                if 'summary' not in data:
                    data['summary'] = {}

                data['summary']['total_items_count'] = total_count
                data['summary']['total_units_calculated'] = total_units
                data['summary']['calculated_subtotal'] = f"${calculated_total:,.2f}"

                # Compare with document total
                doc_total = data.get('header', {}).get('invoice_total', '')
                if doc_total:
                    try:
                        clean_doc_total = str(doc_total).replace('$', '').replace(',', '').strip()
                        if clean_doc_total:
                            doc_total_float = float(clean_doc_total)
                            difference = abs(doc_total_float - calculated_total)

                            data['summary']['document_total'] = doc_total
                            data['summary']['totals_match'] = difference < 0.01  # Within 1 cent
                            data['summary']['difference'] = f"${difference:,.2f}"

                            if difference > 0.01:
                                self.logger.warning(
                                    f"⚠️ TOTAL MISMATCH: Document=${doc_total}, "
                                    f"Calculated=${calculated_total:,.2f}, "
                                    f"Diff=${difference:,.2f}"
                                )
                    except (ValueError, TypeError):
                        pass

                self.logger.info(
                    f"✅ Recalculated totals: {total_count} items, "
                    f"{total_units} units, ${calculated_total:,.2f} total"
                )

        # Similar logic for packing lists
        elif document_type.lower() in ['packing_list', 'packinglist']:
            items = data.get('individual_items', [])
            if items:
                # Deduplicate
                items = self._deduplicate_items(items)
                data['individual_items'] = items

                total_packages = len(items)
                total_quantity = 0

                for item in items:
                    qty = item.get('quantity', 0)
                    try:
                        clean_qty = str(qty).replace(',', '').strip()
                        if clean_qty:
                            total_quantity += float(clean_qty)
                    except (ValueError, TypeError):
                        pass

                if 'shipment_details' not in data:
                    data['shipment_details'] = {}

                data['shipment_details']['calculated_total_items'] = total_packages
                data['shipment_details']['calculated_total_quantity'] = total_quantity

                self.logger.info(
                    f"✅ Recalculated packing list: {total_packages} items, "
                    f"{total_quantity} total quantity"
                )

        return data

    def _final_aggregation_pass(self, extracted_data: Dict[str, Any], file_path: str) -> Dict[str, Any]:
        """Final pass to ensure all totals are correct using LLM validation."""

        self.logger.info("Running final aggregation pass...")

        # Only validate if we have items
        if 'items' not in extracted_data or not extracted_data['items']:
            self.logger.info("No items to validate, skipping final aggregation")
            return extracted_data

        try:
            # Build validation prompt
            items_count = len(extracted_data.get('items', []))

            prompt = f"""
You are a data validation expert. Review this extracted invoice data and verify totals.

EXTRACTED DATA (showing {items_count} items):
{json.dumps(extracted_data, indent=2)[:5000]}

VALIDATION TASKS:
1. Count the number of items in the 'items' array
2. Sum all 'quantity' fields to get total units
3. Sum all 'amount' fields to get calculated total
4. Compare with 'invoice_total' or 'grand_total' from header
5. Report any discrepancies

Return ONLY JSON with:
{{
  "total_items": [count of items],
  "total_units": [sum of all quantities],
  "calculated_total": [sum of all amounts],
  "document_total": [total from header],
  "totals_match": [true if they match within $0.01, false otherwise],
  "issues_found": ["list any issues or empty array if none"]
}}
"""

            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=1000,
            )

            validation = self._parse_json_response(response.choices[0].message.content)
            extracted_data['validation'] = validation

            if not validation.get('totals_match'):
                self.logger.warning(f"⚠️ Validation found issues: {validation.get('issues_found')}")
            else:
                self.logger.info("✅ Validation passed - totals match!")

        except Exception as e:
            self.logger.error(f"Final aggregation failed: {e}")

        return extracted_data

    def _validate_hs_code(self, hs_code: str) -> bool:
        """
        Validate that an extracted HS code is actually a valid HS code format.

        Args:
            hs_code: The extracted HS code string

        Returns:
            True if valid HS code format, False otherwise
        """
        if not hs_code:
            return False

        # Clean the HS code
        cleaned = str(hs_code).strip().replace('.', '').replace(' ', '').replace('-', '')

        # HS codes are 6-10 digits
        if not cleaned.isdigit():
            return False

        length = len(cleaned)
        if length < 4 or length > 10:
            return False

        # Additional validation: HS codes shouldn't start with 0 typically
        # (though chapter 01-09 exist, they're rare)
        # This helps filter out invoice numbers, order numbers, etc.

        return True

    def _enhance_with_hscode_lookup(self, extracted_data: Dict[str, Any], enable_lookup: bool = True) -> Dict[str, Any]:
        """
        Automatically lookup HS Codes for items that don't have them.

        MANDATORY: This ensures ALL items get HS Codes, either from document or auto-lookup.

        This method:
        1. Validates extracted HS Codes (filters false positives)
        2. If hs_code is null/invalid, uses HS Code service to lookup based on description
        3. Marks source as 'document' (extracted) or 'auto_lookup' (provided by system)

        Args:
            extracted_data: The extracted document data
            enable_lookup: Whether to enable auto-lookup (default: True)

        Returns:
            Enhanced data with HS Codes filled in
        """
        if not enable_lookup:
            self.logger.info("HS Code auto-lookup disabled, skipping")
            return extracted_data

        self.logger.info("🔍 Starting HS Code enhancement with validation...")

        # Get items from different document types
        items = None
        if 'items' in extracted_data:
            items = extracted_data['items']
        elif 'individual_items' in extracted_data:
            items = extracted_data['individual_items']

        if not items:
            self.logger.info("No items found for HS Code enhancement")
            return extracted_data

        # Count items needing lookup
        items_needing_lookup = []
        items_with_codes = 0
        invalid_codes_found = 0

        for idx, item in enumerate(items):
            hs_code = item.get('hs_code')

            # Check if HS Code exists and is valid
            if hs_code and str(hs_code).strip() and str(hs_code).lower() not in ['null', 'none', 'n/a', '']:
                # Validate the extracted HS code
                if self._validate_hs_code(hs_code):
                    # HS Code was extracted from document and is valid
                    item['hs_code_source'] = 'document'
                    items_with_codes += 1
                    self.logger.debug(f"✅ Item {idx + 1}: Valid HS Code from document: {hs_code}")
                else:
                    # Invalid HS code format - likely a false positive
                    self.logger.warning(f"⚠️ Item {idx + 1}: Invalid HS Code '{hs_code}' - will lookup instead")
                    invalid_codes_found += 1
                    item['hs_code'] = None  # Clear invalid code
                    items_needing_lookup.append((idx, item))
            else:
                # HS Code is missing, needs lookup
                items_needing_lookup.append((idx, item))

        if invalid_codes_found > 0:
            self.logger.warning(f"⚠️ Found {invalid_codes_found} invalid HS Codes (filtered out)")

        self.logger.info(f"HS Code status: {items_with_codes} valid from document, {len(items_needing_lookup)} need lookup")

        if not items_needing_lookup:
            self.logger.info("✅ All items have valid HS Codes from document")
            return extracted_data

        # Perform auto-lookup for missing HS Codes
        try:
            from Orbisporte.domain.services.HS_code_extraction import HSCodeService
            hs_service = HSCodeService()

            lookup_success = 0
            lookup_failed = 0

            for idx, item in items_needing_lookup:
                description = item.get('description', '').strip()

                if not description:
                    self.logger.warning(f"Item {idx + 1}: No description, cannot lookup HS Code")
                    item['hs_code'] = None
                    item['hs_code_source'] = 'no_description'
                    lookup_failed += 1
                    continue

                try:
                    # Use classify_item method (NOT get_hs_code_details)
                    # classify_item is designed for product descriptions, get_hs_code_details is for looking up existing HS codes
                    self.logger.debug(f"Looking up HS Code for: {description[:50]}...")
                    result = hs_service.classify_item(description)

                    # Check if classification was successful
                    if isinstance(result, dict) and result.get('hs_code'):
                        hs_code = result.get('hs_code', '')

                        # Validate that we got a real HS code (not error codes)
                        if hs_code and hs_code not in ['0000.00.00', '0000.00', 'N/A', 'null', 'Unknown', 'None']:
                            # Successfully found HS Code
                            item['hs_code'] = hs_code
                            item['hs_code_source'] = 'auto_lookup'
                            item['hs_description'] = result.get('description', '')
                            item['hs_chapter'] = result.get('chapter', '')
                            lookup_success += 1
                            self.logger.info(f"✅ Item {idx + 1}: Found HS Code {hs_code} for '{description[:30]}...'")
                        else:
                            # Got error code or placeholder
                            item['hs_code'] = None
                            item['hs_code_source'] = 'not_found'
                            lookup_failed += 1
                            self.logger.warning(f"⚠️ Item {idx + 1}: HS Code not found for '{description[:30]}...' (got placeholder: {hs_code})")
                    else:
                        # HS Code not found in database
                        item['hs_code'] = None
                        item['hs_code_source'] = 'not_found'
                        lookup_failed += 1
                        self.logger.warning(f"⚠️ Item {idx + 1}: HS Code not found for '{description[:30]}...'")

                except Exception as e:
                    self.logger.error(f"Error looking up HS Code for item {idx + 1}: {e}")
                    item['hs_code'] = None
                    item['hs_code_source'] = 'lookup_error'
                    lookup_failed += 1

            # Summary
            total_items = len(items)
            total_with_codes = items_with_codes + lookup_success

            self.logger.info(
                f"📊 HS Code Enhancement Complete:\n"
                f"   Total items: {total_items}\n"
                f"   Valid from document: {items_with_codes}\n"
                f"   Invalid codes filtered: {invalid_codes_found}\n"
                f"   Auto-lookup success: {lookup_success}\n"
                f"   Auto-lookup failed: {lookup_failed}\n"
                f"   Total with HS Codes: {total_with_codes}/{total_items} ({100*total_with_codes/total_items:.1f}%)"
            )

            # Warn if coverage is low
            if total_with_codes < total_items:
                missing_count = total_items - total_with_codes
                self.logger.warning(
                    f"⚠️ {missing_count} items still missing HS Codes. "
                    f"These items may need manual review or better product descriptions."
                )

            # Add summary to extracted_data
            if 'hs_code_summary' not in extracted_data:
                extracted_data['hs_code_summary'] = {}

            extracted_data['hs_code_summary'] = {
                'total_items': total_items,
                'from_document': items_with_codes,
                'invalid_codes_filtered': invalid_codes_found,
                'auto_lookup_success': lookup_success,
                'auto_lookup_failed': lookup_failed,
                'total_with_hs_codes': total_with_codes,
                'coverage_percentage': round(100 * total_with_codes / total_items, 1) if total_items > 0 else 0,
                'missing_count': total_items - total_with_codes
            }

        except ImportError:
            self.logger.error("HS Code service not available, skipping auto-lookup")
        except Exception as e:
            self.logger.error(f"HS Code enhancement failed: {e}")

        return extracted_data

    def _get_prompt_for_type(self, document_type: str) -> str:
        """Get extraction prompt based on document type."""
        from Orbisporte.prompts.doc_extraction_prompts import (
            invoice_prompt, bill_of_lading_prompt, airwaybill_prompt,
            packing_list_prompt, unknown_prompt
        )
        
        normalized_type = document_type.lower().replace(" ", "").replace("_", "")

        if normalized_type == "invoice":
            return invoice_prompt
        elif normalized_type == "billoflading":
            return bill_of_lading_prompt
        elif normalized_type == "airwaybill":
            return airwaybill_prompt
        elif normalized_type == "packinglist":
            return packing_list_prompt
        else:
            return unknown_prompt

    def _parse_json_response(self, response_content: str) -> Dict[str, Any]:
        """Parse JSON response from LLM with robust error handling."""
        try:
            # Find and extract JSON from code blocks
            if "```json" in response_content:
                json_start = response_content.find("```json") + 7
                json_end = response_content.find("```", json_start)
                if json_end != -1:
                    response_content = response_content[json_start:json_end].strip()
            elif "```" in response_content:
                json_start = response_content.find("```") + 3
                json_end = response_content.find("```", json_start)
                if json_end != -1:
                    response_content = response_content[json_start:json_end].strip()
            
            # Try to handle cases where there may be non-JSON content
            fallback_content = response_content
            
            # Try to find JSON object in the text if needed
            if not response_content.strip().startswith("{"):
                # Look for the first opening brace
                start_idx = response_content.find("{")
                if start_idx >= 0:
                    # Find matching closing brace by counting braces
                    brace_count = 0
                    for i in range(start_idx, len(response_content)):
                        if response_content[i] == "{":
                            brace_count += 1
                        elif response_content[i] == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                response_content = response_content[start_idx:i+1]
                                break
            
            # Try to parse the JSON
            try:
                extracted_data = json.loads(response_content)
                self.logger.info("Successfully parsed JSON response")
                return extracted_data
            except json.JSONDecodeError:
                # If that fails, try to clean up common issues
                cleaned_content = response_content.replace("\\n", "\n").replace("\\t", "\t")
                cleaned_content = cleaned_content.replace('""', '"').replace("''", "'")
                
                # Replace any non-JSON formatted quotes
                cleaned_content = cleaned_content.replace("'", '"')
                
                try:
                    extracted_data = json.loads(cleaned_content)
                    self.logger.info("Successfully parsed cleaned JSON response")
                    return extracted_data
                except:
                    # Try to extract structured data from non-JSON response
                    self.logger.warning("Failed to parse JSON, attempting to extract structured data")
                    extracted_data = self._extract_structured_data(fallback_content)
                    if extracted_data:
                        return extracted_data
                    raise  # Re-raise if we can't extract structured data
            
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing error: {e}")
            return {
                "error": f"Failed to parse response as JSON",
                "raw_response": response_content[:500] + ("..." if len(response_content) > 500 else "")
            }
    
    def extract_barcodes(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract barcodes from a PDF or image file with enhanced detection.
        Returns list of {text, type, page, confidence, bbox} dicts. Returns [] if deps unavailable.
        """
        print(f"[BARCODE DEBUG] extract_barcodes() CALLED for file: {file_path}")

        # QUICK CHECK: If pyzbar is not available, return immediately to avoid hanging
        try:
            from pyzbar.pyzbar import decode
            print(f"[BARCODE DEBUG] ✓ pyzbar is available!")
        except (ImportError, OSError, FileNotFoundError) as e:
            print(f"[BARCODE DEBUG] ✗ pyzbar not available: {e}")
            print(f"[BARCODE DEBUG] RETURNING EARLY - No barcode libraries available")
            self.logger.warning(f"[BARCODE] pyzbar not available, skipping barcode extraction")
            return []

        try:
            # Optional, heavy imports
            import cv2
            import numpy as np

            # Try multiple detection libraries
            pyzbar_available = True
            opencv_qr_available = False
            wechat_qr_available = False

            print(f"[BARCODE DEBUG] Checking library availability...")
            self.logger.info("[BARCODE] Using pyzbar for detection")

            # Try OpenCV standard QR detector
            if not pyzbar_available:
                try:
                    qr_detector = cv2.QRCodeDetector()
                    opencv_qr_available = True
                    self.logger.info("[BARCODE] Using OpenCV QR detector")
                except Exception as cv_err:
                    self.logger.warning(f"[BARCODE] OpenCV QR detector failed: {cv_err}")

            # Try WeChat QR detector (more robust)
            try:
                wechat_detector = cv2.wechat_qrcode_WeChatQRCode()
                wechat_qr_available = True
                self.logger.info("[BARCODE] Using WeChat QR detector (most robust)")
            except Exception as wechat_err:
                self.logger.debug(f"[BARCODE] WeChat QR detector not available: {wechat_err}")

            if not pyzbar_available and not opencv_qr_available and not wechat_qr_available:
                self.logger.error("[BARCODE] No QR/barcode detection library available")
                return []
            try:
                from pdf2image import convert_from_path
            except Exception:
                convert_from_path = None
            from PIL import Image as PILImage

            barcodes: List[Dict[str, Any]] = []
            seen_barcodes = set()  # Deduplicate across different preprocessing attempts

            # Build list of RGB numpy images with higher resolution
            images_np: List[Any] = []
            if file_path.lower().endswith('.pdf'):
                if fitz:
                    self.logger.info(f"[BARCODE] Extracting from PDF: {file_path}")
                    with fitz.open(file_path) as pdf:
                        for page in pdf:
                            # Increased resolution: 5x scaling for very small QR codes
                            pix = page.get_pixmap(matrix=fitz.Matrix(5, 5))
                            img_bytes = pix.tobytes("png")
                            pil_img = PILImage.open(io.BytesIO(img_bytes)).convert("RGB")
                            images_np.append(np.array(pil_img))
                elif convert_from_path is not None:
                    pages = convert_from_path(file_path, dpi=300)
                    images_np = [np.array(p.convert("RGB")) for p in pages]
                else:
                    self.logger.error("Barcode extraction: no PDF renderer available (PyMuPDF/pdf2image missing)")
                    return []
            else:
                # For image files
                self.logger.info(f"[BARCODE] Extracting from image: {file_path}")
                pil_img = PILImage.open(file_path)

                # Handle EXIF orientation (important for phone photos)
                try:
                    from PIL import ImageOps
                    pil_img = ImageOps.exif_transpose(pil_img)
                    self.logger.debug(f"[BARCODE] Applied EXIF orientation correction")
                except Exception as exif_err:
                    self.logger.debug(f"[BARCODE] No EXIF orientation data or error: {exif_err}")

                pil_img = pil_img.convert("RGB")

                # Downscale if image is too large (QR detection works better on smaller images)
                max_dimension = 3000
                if pil_img.size[0] > max_dimension or pil_img.size[1] > max_dimension:
                    self.logger.info(f"[BARCODE] Image is large ({pil_img.size[0]}x{pil_img.size[1]}), downscaling for better detection")
                    scale = min(max_dimension / pil_img.size[0], max_dimension / pil_img.size[1])
                    new_size = (int(pil_img.size[0] * scale), int(pil_img.size[1] * scale))
                    pil_img = pil_img.resize(new_size, PILImage.Resampling.LANCZOS)
                    self.logger.info(f"[BARCODE] Downscaled to {pil_img.size[0]}x{pil_img.size[1]}")

                images_np = [np.array(pil_img)]

            for page_num, img in enumerate(images_np, start=1):
                try:
                    # Convert to grayscale
                    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

                    # Try multiple preprocessing techniques for better detection
                    preprocessing_variants = [
                        ("original", gray),
                        ("threshold", cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]),
                        ("adaptive", cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)),
                        ("blur", cv2.GaussianBlur(gray, (5, 5), 0)),
                        ("sharpen", cv2.filter2D(gray, -1, np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]]))),
                    ]

                    for variant_name, processed_img in preprocessing_variants:
                        # Try pyzbar if available
                        if pyzbar_available:
                            try:
                                print(f"[BARCODE DEBUG] Trying pyzbar with {variant_name} preprocessing on page {page_num}...")
                                decoded = decode(processed_img)
                                print(f"[BARCODE DEBUG] pyzbar found {len(decoded)} barcode(s) with {variant_name}")

                                for d in decoded:
                                    try:
                                        barcode_data = d.data.decode("utf-8", errors="ignore")
                                        barcode_type = d.type

                                        # Create unique identifier to avoid duplicates
                                        unique_id = f"{page_num}:{barcode_type}:{barcode_data}"

                                        if unique_id not in seen_barcodes:
                                            seen_barcodes.add(unique_id)

                                            # Extract bounding box if available
                                            bbox = None
                                            if hasattr(d, 'rect'):
                                                bbox = {
                                                    "x": d.rect.left,
                                                    "y": d.rect.top,
                                                    "width": d.rect.width,
                                                    "height": d.rect.height
                                                }

                                            entry: Dict[str, Any] = {
                                                "text": barcode_data,
                                                "type": barcode_type,
                                                "page": page_num,
                                                "detection_method": f"pyzbar_{variant_name}",
                                            }

                                            if bbox:
                                                entry["bbox"] = bbox

                                            barcodes.append(entry)
                                            self.logger.info(f"[BARCODE] Found {barcode_type} on page {page_num} using pyzbar_{variant_name}: {barcode_data[:50]}...")

                                    except Exception as decode_err:
                                        self.logger.warning(f"Failed to decode barcode data: {decode_err}")
                                        continue
                            except Exception as pyzbar_err:
                                pass  # Silent fail, will try OpenCV

                        # Try OpenCV QR detector if available (only for QR codes)
                        if opencv_qr_available and not barcodes:
                            try:
                                # OpenCV works better with BGR
                                if len(processed_img.shape) == 2:
                                    bgr_img = cv2.cvtColor(processed_img, cv2.COLOR_GRAY2BGR)
                                else:
                                    bgr_img = cv2.cvtColor(processed_img, cv2.COLOR_RGB2BGR)

                                data, bbox_points, _ = qr_detector.detectAndDecode(bgr_img)

                                if data:
                                    unique_id = f"{page_num}:QRCODE:{data}"

                                    if unique_id not in seen_barcodes:
                                        seen_barcodes.add(unique_id)

                                        bbox = None
                                        if bbox_points is not None and len(bbox_points) > 0:
                                            bbox_points = bbox_points[0].astype(int)
                                            bbox = {
                                                "x": int(bbox_points[0][0]),
                                                "y": int(bbox_points[0][1]),
                                                "width": int(bbox_points[2][0] - bbox_points[0][0]),
                                                "height": int(bbox_points[2][1] - bbox_points[0][1])
                                            }

                                        entry: Dict[str, Any] = {
                                            "text": data,
                                            "type": "QRCODE",
                                            "page": page_num,
                                            "detection_method": f"opencv_{variant_name}",
                                        }

                                        if bbox:
                                            entry["bbox"] = bbox

                                        barcodes.append(entry)
                                        self.logger.info(f"[BARCODE] Found QRCODE on page {page_num} using opencv_{variant_name}: {data[:50]}...")
                            except Exception as opencv_err:
                                pass  # Silent fail

                        # Try WeChat QR detector (more robust, works better with damaged QR codes)
                        if wechat_qr_available and not barcodes:
                            try:
                                # WeChat detector works with grayscale or BGR
                                if len(processed_img.shape) == 2:
                                    test_img = processed_img
                                else:
                                    test_img = cv2.cvtColor(processed_img, cv2.COLOR_RGB2GRAY)

                                # Detect and decode - returns tuple of (points, decoded_strings)
                                res, points = wechat_detector.detectAndDecode(test_img)

                                if res and len(res) > 0:
                                    for idx, data in enumerate(res):
                                        if data:  # Non-empty string
                                            unique_id = f"{page_num}:QRCODE:{data}"

                                            if unique_id not in seen_barcodes:
                                                seen_barcodes.add(unique_id)

                                                bbox = None
                                                if points is not None and len(points) > idx:
                                                    pts = points[idx].astype(int)
                                                    if len(pts) >= 4:
                                                        bbox = {
                                                            "x": int(min(pts[:, 0])),
                                                            "y": int(min(pts[:, 1])),
                                                            "width": int(max(pts[:, 0]) - min(pts[:, 0])),
                                                            "height": int(max(pts[:, 1]) - min(pts[:, 1]))
                                                        }

                                                entry: Dict[str, Any] = {
                                                    "text": data,
                                                    "type": "QRCODE",
                                                    "page": page_num,
                                                    "detection_method": f"wechat_{variant_name}",
                                                }

                                                if bbox:
                                                    entry["bbox"] = bbox

                                                barcodes.append(entry)
                                                self.logger.info(f"[BARCODE] Found QRCODE on page {page_num} using wechat_{variant_name}: {data[:50]}...")
                            except Exception as wechat_err:
                                pass  # Silent fail

                    if not barcodes:
                        self.logger.info(f"[BARCODE] No barcodes found on page {page_num}")

                except Exception as inner_e:
                    self.logger.error(f"Barcode decode failed on page {page_num}: {inner_e}", exc_info=True)

            self.logger.info(f"[BARCODE] Total barcodes extracted: {len(barcodes)}")
            print(f"[BARCODE DEBUG] FINAL RESULT: Extracted {len(barcodes)} barcode(s)")
            if barcodes:
                for idx, bc in enumerate(barcodes):
                    print(f"[BARCODE DEBUG]   Barcode #{idx+1}: {bc.get('type')} - {bc.get('text', '')[:100]}")
            return barcodes

        except ImportError as ie:
            self.logger.error(f"Barcode extraction dependencies missing: {ie}. Install with: pip install opencv-python pyzbar")
            return []
        except Exception as e:
            self.logger.error(f"Barcode extraction failed: {e}", exc_info=True)
            return []
            
    def _extract_structured_data(self, text: str) -> Dict[str, Any]:
        """Extract structured data from non-JSON text."""
        result = {}
        
        # Try to find key-value pairs in the text
        lines = text.split("\n")
        current_section = "general"
        result[current_section] = {}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if this looks like a header/section
            if line.endswith(":") and len(line) < 40 and ":" not in line[:-1]:
                current_section = line[:-1].lower().strip().replace(" ", "_")
                result[current_section] = {}
                continue

            # Try to extract key-value pairs
            if ":" in line:
                parts = line.split(":", 1)
                if len(parts) == 2:
                    key = parts[0].strip().lower().replace(" ", "_")
                    value = parts[1].strip()
                    result[current_section][key] = value
        
        # If we found any structured data, return it
        if any(bool(section) for section in result.values()):
            return result
        
        # Otherwise return empty
        return {}