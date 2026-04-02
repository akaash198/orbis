from Orbisporte.infrastructure.get_llm import openai_client, Config
from Orbisporte.infrastructure.pdf_processor import get_pdf_processor, PDFProcessor
import logging
from typing import Dict, Any, List
import os
import base64
import fitz
import json

from Orbisporte.prompts import classification_prompt,multipage_document

logger = logging.getLogger(__name__)

class DocumentClassificationService:
    """Service for classifying trade/customs documents via OpenAI.

    Now optimized with:
    - PDF processing cache to avoid redundant conversions
    - Intelligent text/image extraction routing
    """

    def __init__(self, llm_client=None, pdf_processor: PDFProcessor = None):
        self.logger = logger
        self.llm_client = llm_client or openai_client()
        self.pdf_processor = pdf_processor or get_pdf_processor(use_cache=True)

    def classify_document(self, file_path: str) -> str:
        """Classify a document by converting to images and sending to LLM."""
        try:
            if not os.path.exists(file_path):
                return "unknown"

            # Convert first page to image for classification (1.5x resolution for 30% faster conversion)
            image_b64 = None
            if file_path.lower().endswith('.pdf'):
                with fitz.open(file_path) as pdf:
                    if len(pdf) > 0:
                        pix = pdf[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                        img_bytes = pix.tobytes("png")
                        image_b64 = base64.b64encode(img_bytes).decode("utf-8")
            else:
                # For image files
                with open(file_path, "rb") as f:
                    image_b64 = base64.b64encode(f.read()).decode("utf-8")

            if not image_b64:
                return "unknown"

            messages = [
                {"role": "system", "content": classification_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                    ],
                },
            ]

            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.0,
                max_tokens=100,
            )

            if not response.choices or len(response.choices) == 0:
                self.logger.error("No response choices received from LLM")
                return "unknown"

            content = response.choices[0].message.content
            if not content:
                self.logger.error("Empty response content from LLM")
                return "unknown"

            document_type_response = content.strip()
            return self._normalize_classification(document_type_response)

        except Exception as e:
            self.logger.error(f"Classification error: {e}")
            return "unknown"
            
    def classify_document_with_details(self, file_path: str) -> Dict[str, Any]:
        """Classify document and return minimal details."""
        try:
            doc_type = self.classify_document(file_path)
            result = {
                "document_type": doc_type,
                "is_multi_page_pdf": file_path.lower().endswith('.pdf'),
            }
            self.logger.info(f"Document classified as: {result['document_type']}")
            return result
        except Exception as e:
            self.logger.error(f"Classification with details error: {e}")
            return {"document_type": "unknown"}

    def classify_document_pages(self, file_path: str) -> Dict[str, Any]:
        """Classify a PDF document to identify document types per page.

        Now optimized with caching - images are cached and reused in extraction.
        """
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}

        try:
            # For non-PDFs, return simple classification
            if not file_path.lower().endswith(".pdf"):
                return {
                    "document_types": {"unknown": [1]},
                    "primary_document_type": "unknown"
                }

            # Analyze PDF structure first
            analysis = self.pdf_processor.analyze_pdf_structure(file_path)
            page_count = analysis.get("page_count", 0)

            if page_count == 0:
                return {"error": "PDF has no pages or cannot be opened"}

            self.logger.info(f"PDF has {page_count} pages, method: {analysis.get('recommended_method')}")

            # Convert first 3 pages to images (sufficient for classification)
            # This will be CACHED for reuse in extraction!
            max_pages = min(page_count, 3)
            page_numbers = list(range(1, max_pages + 1))

            # Use PDF processor with caching - this avoids redundant conversions
            # OPTIMIZATION: Use lower resolution and JPEG for faster processing
            page_images_dict, error = self.pdf_processor.convert_pages_to_images(
                file_path,
                page_numbers=page_numbers,
                resolution_scale=1.0,  # Reduced from 1.5x for speed
                use_jpeg=True  # JPEG is 50-70% smaller than PNG
            )

            if error:
                self.logger.error(f"PDF conversion failed for {file_path}: {error}")
                return {"error": f"No pages could be converted from PDF: {error}"}

            page_images = [page_images_dict[i] for i in sorted(page_images_dict.keys())]

            if not page_images:
                return {"error": "No pages could be converted from PDF: No images returned"}

            # Send images for classification with enhanced instructions
            self.logger.info(f"Sending {len(page_images)} pages for classification: {os.path.basename(file_path)}")

            # Add page count to the prompt if available
            prompt = multipage_document
            if page_count > 0:
                prompt += f"\n\nThis PDF has {page_count} pages. I'm showing you the first {len(page_images)} pages. Make sure to classify ALL visible pages from 1 to {len(page_images)}."

            # Build content with text and all images
            content = [{"type": "text", "text": prompt}]
            for img_b64 in page_images:
                content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}})

            messages = [{
                "role": "user",
                "content": content
            }]

            # Call the model
            self.logger.info(f"Calling LLM for classification with model: gpt-4o-mini")
            response = self.llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.2,
                max_tokens=2000,
            )

            if not response.choices or len(response.choices) == 0:
                return {"error": "No response choices received from LLM"}

            # Parse the classification result
            content = response.choices[0].message.content
            if not content:
                return {"error": "Empty response content from LLM"}
                
            self.logger.info(f"Received classification response: {content[:200]}...")
            classification = self._parse_json_response(content)

            # If parsing failed, try to extract basic information from the raw response
            if "error" in classification and "raw_response" in classification:
                self.logger.warning("JSON parsing failed, attempting fallback classification")
                raw_content = classification["raw_response"].lower()
                # Try to identify document type from raw text
                fallback_type = "unknown"
                if "bill of lading" in raw_content or "bol" in raw_content:
                    fallback_type = "bill_of_lading"
                elif "airway bill" in raw_content or "air waybill" in raw_content or "awb" in raw_content:
                    fallback_type = "air_waybill"
                elif "commercial invoice" in raw_content:
                    fallback_type = "commercial_invoice"
                elif "invoice" in raw_content:
                    fallback_type = "commercial_invoice"
                elif "packaging list" in raw_content or "packing" in raw_content:
                    fallback_type = "packing_list"

                classification = {
                    "document_types": {fallback_type: [1]},
                    "primary_document_type": fallback_type,
                    "fallback_used": True
                }
                
                # If we have page count, assume all pages are the same type
                if page_count > 1:
                    classification["document_types"][fallback_type] = list(range(1, page_count + 1))

            # Validate the document types - make sure all pages are classified; mark unclassified as unknown
            if page_count > 0 and "document_types" in classification:
                # Normalize and de-duplicate page lists
                for k, v in list(classification["document_types"].items()):
                    if isinstance(v, list):
                        dedup_sorted = sorted(sorted(set(int(p) for p in v if isinstance(p, int) and p > 0)))
                        classification["document_types"][self._normalize_classification(k)] = dedup_sorted
                        if k != self._normalize_classification(k):
                            del classification["document_types"][k]

                all_classified_pages: set[int] = set()
                for pages in classification["document_types"].values():
                    if isinstance(pages, list):
                        all_classified_pages.update(pages)
                all_pages = set(range(1, page_count + 1))
                missing_pages = sorted(all_pages - all_classified_pages)

                if missing_pages:
                    self.logger.warning(f"Pages not classified: {missing_pages}")
                    classification["document_types"].setdefault("unknown", [])
                    classification["document_types"]["unknown"] = sorted(
                        sorted(set(classification["document_types"]["unknown"] + missing_pages))
                    )
            
            # Add page count information
            if page_count > 0:
                classification["page_count"] = page_count
            
            # Ensure primary_document_type exists and is one of the keys, otherwise choose the one with most pages (excluding unknown)
            if "primary_document_type" not in classification:
                if "document_types" in classification and classification["document_types"]:
                    non_unknown = {k: v for k, v in classification["document_types"].items() if k != "unknown"}
                    if non_unknown:
                        primary_type = max(non_unknown.items(), key=lambda x: len(x[1]) if isinstance(x[1], list) else 0)[0]
                    else:
                        primary_type = next(iter(classification["document_types"].keys()))
                    classification["primary_document_type"] = primary_type
                
            # Log the final classification
            self.logger.info(f"Final classification: {classification}")
            return classification
            
        except Exception as e:
            self.logger.error(f"Document classification error: {e}")
            return {"error": f"Classification failed: {str(e)}"}

    def _normalize_classification(self, classification: str) -> str:
        """Normalize classification results to standard format."""
        if not classification:
            return "unknown"

        classification = classification.lower().strip()

        # Standard mappings — check more specific terms before generic ones
        if any(term in classification for term in ["bill of lading", "billoflading", "b/l no", "bol", "bill_of_lading"]):
            return "bill_of_lading"
        elif any(term in classification for term in ["airway bill", "air waybill", "airwaybill", "awb", "air_waybill"]):
            return "air_waybill"
        elif any(term in classification for term in ["proforma invoice", "pro-forma invoice", "pro forma invoice", "proforma_invoice", "pi no", "quotation"]):
            return "proforma_invoice"
        elif any(term in classification for term in ["commercial invoice", "commercialinvoice", "commercial_invoice"]):
            return "commercial_invoice"
        elif any(term in classification for term in ["packaging list", "packing list", "packing_list", "packinglist", "packaging_list"]):
            return "packing_list"
        elif any(term in classification for term in ["letter of credit", "documentary credit", "letter_of_credit", "lc no"]):
            return "letter_of_credit"
        elif any(term in classification for term in ["purchase order", "purchase_order", "p.o. no", "po number"]):
            return "purchase_order"
        elif any(term in classification for term in ["bill of entry", "bill_of_entry", "be no"]):
            return "bill_of_entry"
        elif any(term in classification for term in ["shipping bill", "shipping_bill", "sb no"]):
            return "shipping_bill"
        elif any(term in classification for term in ["customs declaration", "customs_declaration", "igm", "egm", "icegate"]):
            return "customs_declaration"
        elif any(term in classification for term in ["certificate of origin", "certificate_of_origin", "certificateoforigin", "form a", "gsp certificate"]):
            return "certificate_of_origin"
        elif any(term in classification for term in ["arrival notice", "arrival_notice"]):
            return "arrival_notice"
        elif "invoice" in classification:
            return "commercial_invoice"
        else:
            return "unknown"

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Parse JSON response from LLM."""
        if not content or not isinstance(content, str):
            return {"error": "Invalid or empty content received"}

        try:
            # Try to extract JSON from the content
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end != -1:
                json_str = content[start:end]
                parsed_json = json.loads(json_str)
            else:
                # If no JSON found, try to parse the entire content
                parsed_json = json.loads(content.strip())
            
            # Transform the response into the expected format if needed
            if "document_types" in parsed_json:
                # Format is already correct or similar
                if isinstance(parsed_json["document_types"], list):
                    # Convert from list of {"document_type": type, "pages": []} to map of {type: [pages]}
                    doc_types = {}
                    for item in parsed_json["document_types"]:
                        if "document_type" in item and "pages" in item:
                            doc_type = self._normalize_classification(item["document_type"])
                            doc_types[doc_type] = item["pages"]
                    
                    if doc_types:
                        parsed_json["document_types"] = doc_types
                
            # Make sure we have primary_document_type
            if "primary_document_type" not in parsed_json:
                # Set primary type to the document type with the most pages
                if "document_types" in parsed_json and parsed_json["document_types"]:
                    primary_type = max(parsed_json["document_types"].items(), 
                                      key=lambda x: len(x[1]) if isinstance(x[1], list) else 0)[0]
                    parsed_json["primary_document_type"] = primary_type
            
            self.logger.info(f"Parsed classification result: {parsed_json}")
            return parsed_json
            
        except json.JSONDecodeError as e:
            self.logger.warning(f"JSON parsing failed: {e}")
            self.logger.warning(f"Raw content: {content[:500]}...")
            # Return a fallback structure
            return {
                "error": f"JSON parsing failed: {str(e)}",
                "raw_response": content[:1000],  # Truncate for logging
                "document_types": {},
                "primary_document_type": "unknown"
            }
        except Exception as e:
            self.logger.error(f"Unexpected error in JSON parsing: {e}")
            return {"error": f"JSON parsing failed: {str(e)}"}