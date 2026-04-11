"""
Invoice-to-Duty Integration Service
Purpose: Seamlessly integrate document extraction, HSN classification, and duty calculation
Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
Date: 2026-02-24
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
import logging
from sqlalchemy.orm import Session

from Orbisporte.domain.services.doc_extraction import DocumentExtractionService
from Orbisporte.domain.services.HS_code_extraction import HSCodeService
from Orbisporte.domain.services.duty_calculator import DutyCalculator

logger = logging.getLogger(__name__)


def sanitize_numeric_value(value: Any) -> Optional[str]:
    """
    Sanitize a numeric value by removing currency symbols, commas, and spaces.
    Returns a clean string that can be converted to Decimal, or None if invalid.
    """
    if value is None or value == '':
        return None

    # Convert to string
    str_value = str(value).strip()

    if not str_value:
        return None

    # Remove common currency symbols and separators
    str_value = str_value.replace('₹', '').replace('$', '').replace('€', '').replace('£', '')
    str_value = str_value.replace(',', '').replace(' ', '')

    # Remove any other non-numeric characters except decimal point and minus sign
    clean_value = ''
    for char in str_value:
        if char.isdigit() or char in ['.', '-']:
            clean_value += char

    # Return None if empty after cleaning
    if not clean_value or clean_value in ['.', '-', '-.']:
        return None

    return clean_value


class InvoiceDutyIntegrationService:
    """
    Integrates document extraction, HSN classification, and duty calculation.

    Workflow:
    1. Extract invoice data (items, quantities, values)
    2. Classify HSN codes for each item
    3. Calculate duties for each item
    4. Aggregate totals
    """

    def __init__(self, db: Session):
        self.db = db
        self.extraction_service = DocumentExtractionService()
        self.hsn_service = HSCodeService()
        self.duty_calculator = DutyCalculator(db)
        self.logger = logger

    def process_invoice_complete(
        self,
        file_path: str,
        user_id: int,
        document_id: Optional[int] = None,
        auto_classify_hsn: bool = True,
        port_code: Optional[str] = None,
        country_of_origin: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Complete end-to-end processing: Extract → Classify → Calculate

        Args:
            file_path: Path to invoice document
            user_id: User ID for audit trail
            document_id: Document ID if already uploaded
            auto_classify_hsn: Auto-classify missing HSN codes
            port_code: Port of import
            country_of_origin: Country of origin for goods

        Returns:
            Complete results with extraction, classification, and duty calculations
        """
        try:
            self.logger.info(f"[INVOICE-DUTY] Starting complete processing for: {file_path}")

            # Step 1: Extract invoice data
            self.logger.info("[INVOICE-DUTY] Step 1: Extracting invoice data...")
            extraction_result = self.extraction_service.extract_data(
                file_path=file_path,
                document_type="invoice",
                skip_classification=True  # Faster - we know it's an invoice
            )

            if "error" in extraction_result:
                return {
                    "success": False,
                    "error": f"Extraction failed: {extraction_result['error']}",
                    "stage": "extraction"
                }

            # Step 2: Extract vendor information for vendor-based classification
            vendor_name = None

            # Try multiple paths to find vendor name
            if "combined" in extraction_result and isinstance(extraction_result["combined"], dict):
                combined = extraction_result["combined"]
                # Check direct keys in combined
                vendor_name = combined.get("vendor_name") or combined.get("supplier")

                # Check nested header in combined
                if not vendor_name and "header" in combined and isinstance(combined["header"], dict):
                    vendor_name = combined["header"].get("vendor_name") or combined["header"].get("supplier")

            # Try root-level header
            if not vendor_name and "header" in extraction_result and isinstance(extraction_result["header"], dict):
                vendor_name = extraction_result["header"].get("vendor_name") or extraction_result["header"].get("supplier")

            if vendor_name:
                self.logger.info(f"[INVOICE-DUTY] ✅ Vendor found: {vendor_name}")
            else:
                self.logger.warning(f"[INVOICE-DUTY] ⚠️ No vendor name found. Extraction keys: {list(extraction_result.keys())}")
                if "combined" in extraction_result:
                    self.logger.warning(f"[INVOICE-DUTY] Combined keys: {list(extraction_result['combined'].keys()) if isinstance(extraction_result['combined'], dict) else 'not a dict'}")

            # Step 3: Process each line item
            self.logger.info("[INVOICE-DUTY] Step 3: Processing line items...")
            items = self._extract_line_items(extraction_result)

            if not items:
                # Provide helpful error message with extraction result keys
                result_keys = list(extraction_result.keys()) if isinstance(extraction_result, dict) else []
                data_keys = list(extraction_result.get("data", {}).keys()) if isinstance(extraction_result.get("data"), dict) else []

                error_msg = f"No line items found in invoice. "
                error_msg += f"Extraction result has keys: {result_keys}. "
                if data_keys:
                    error_msg += f"Data object has keys: {data_keys}."

                self.logger.error(f"[INVOICE-DUTY] {error_msg}")

                return {
                    "success": False,
                    "error": error_msg,
                    "stage": "item_extraction",
                    "extraction_result": extraction_result,
                    "debug_info": {
                        "result_keys": result_keys,
                        "data_keys": data_keys
                    }
                }

            self.logger.info(f"[INVOICE-DUTY] Found {len(items)} line items")

            # Step 4: Classify HSN codes and calculate duties
            processed_items = []
            total_cif_value = Decimal('0')
            total_duty = Decimal('0')

            for idx, item in enumerate(items, 1):
                self.logger.info(f"[INVOICE-DUTY] Processing item {idx}/{len(items)}: {item.get('description', 'Unknown')}")

                processed_item = self._process_item(
                    item=item,
                    auto_classify_hsn=auto_classify_hsn,
                    port_code=port_code,
                    country_of_origin=country_of_origin,
                    user_id=user_id,
                    document_id=document_id,
                    vendor_name=vendor_name
                )

                processed_items.append(processed_item)

                # Aggregate totals
                if processed_item.get("duty_calculation"):
                    duty_calc = processed_item["duty_calculation"]
                    total_cif_value += Decimal(str(duty_calc.get("cif_value", 0)))
                    total_duty += Decimal(str(duty_calc.get("total_duty", 0)))
                elif processed_item.get("total_value"):
                    # If no duty calculation but has CIF value, still count it in totals
                    try:
                        sanitized = sanitize_numeric_value(processed_item.get("total_value"))
                        if sanitized:
                            total_cif_value += Decimal(sanitized)
                    except Exception as e:
                        self.logger.warning(f"[INVOICE-DUTY] Could not convert total_value to Decimal: {processed_item.get('total_value')} - {str(e)}")

            # Step 5: Prepare final result
            self.logger.info("[INVOICE-DUTY] Step 5: Preparing final results...")

            # Check for part-number-only descriptions
            part_number_only_count = sum(
                1 for item in processed_items
                if item.get("classification_error") and "part number only" in str(item.get("classification_error"))
            )

            result = {
                "success": True,
                "invoice_data": self._extract_invoice_metadata(extraction_result),
                "items": processed_items,
                "summary": {
                    "total_items": len(processed_items),
                    "items_with_hsn": sum(1 for item in processed_items if item.get("hsn_code")),
                    "items_with_duty": sum(1 for item in processed_items if item.get("duty_calculation")),
                    "total_cif_value": float(total_cif_value),
                    "total_duty": float(total_duty),
                    "total_payable": float(total_cif_value + total_duty),
                    "effective_duty_rate": float((total_duty / total_cif_value * 100)) if total_cif_value > 0 else 0
                },
                "processing_metadata": {
                    "file_path": file_path,
                    "user_id": user_id,
                    "document_id": document_id,
                    "auto_classified_items": sum(1 for item in processed_items if item.get("hsn_auto_classified")),
                    "failed_classifications": sum(1 for item in processed_items if item.get("classification_error")),
                    "part_number_only_items": part_number_only_count
                }
            }

            # Add warning if many items have part numbers only
            if part_number_only_count > 0:
                result["warnings"] = [
                    f"{part_number_only_count} items have part numbers only. Check if invoice has product descriptions in a different column."
                ]

            self.logger.info(f"[INVOICE-DUTY] ✅ Complete! Total: ₹{total_cif_value:,.2f} CIF, ₹{total_duty:,.2f} duty ({result['summary']['effective_duty_rate']:.1f}%)")

            return result

        except Exception as e:
            self.logger.error(f"[INVOICE-DUTY] Processing failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"Processing failed: {str(e)}",
                "stage": "processing"
            }

    def _extract_line_items(self, extraction_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract line items from extraction result."""
        items = []

        # Log the structure for debugging
        self.logger.info(f"[INVOICE-DUTY] Extraction result keys: {list(extraction_result.keys())}")

        # Check different possible structures
        if "items" in extraction_result:
            items = extraction_result["items"]
            self.logger.info(f"[INVOICE-DUTY] Found items at root level: {len(items) if isinstance(items, list) else 'not a list'}")
        elif "line_items" in extraction_result:
            items = extraction_result["line_items"]
            self.logger.info(f"[INVOICE-DUTY] Found line_items at root level: {len(items) if isinstance(items, list) else 'not a list'}")
        elif "combined" in extraction_result:
            # Handle 'combined' key structure (used by DocumentExtractionService)
            combined = extraction_result["combined"]
            self.logger.info(f"[INVOICE-DUTY] Found combined object, type: {type(combined)}")

            if isinstance(combined, dict):
                self.logger.info(f"[INVOICE-DUTY] Combined object keys: {list(combined.keys())}")
                if "items" in combined:
                    items = combined["items"]
                    self.logger.info(f"[INVOICE-DUTY] Found items in combined: {len(items) if isinstance(items, list) else 'not a list'}")
                elif "line_items" in combined:
                    items = combined["line_items"]
                    self.logger.info(f"[INVOICE-DUTY] Found line_items in combined: {len(items) if isinstance(items, list) else 'not a list'}")
                elif "products" in combined:
                    items = combined["products"]
                    self.logger.info(f"[INVOICE-DUTY] Found products in combined: {len(items) if isinstance(items, list) else 'not a list'}")
            elif isinstance(combined, list):
                # combined might directly be the list of items
                items = combined
                self.logger.info(f"[INVOICE-DUTY] Combined is directly a list: {len(items)} items")
        elif "data" in extraction_result:
            data = extraction_result["data"]
            self.logger.info(f"[INVOICE-DUTY] Found data object, keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")

            if isinstance(data, dict):
                if "items" in data:
                    items = data["items"]
                    self.logger.info(f"[INVOICE-DUTY] Found items in data: {len(items) if isinstance(items, list) else 'not a list'}")
                elif "line_items" in data:
                    items = data["line_items"]
                    self.logger.info(f"[INVOICE-DUTY] Found line_items in data: {len(items) if isinstance(items, list) else 'not a list'}")
                elif "products" in data:
                    items = data["products"]
                    self.logger.info(f"[INVOICE-DUTY] Found products in data: {len(items) if isinstance(items, list) else 'not a list'}")

        # Additional checks for nested structures
        if not items and isinstance(extraction_result, dict):
            # Try to find items in any nested structure
            for key in ["invoice", "document", "result", "combined"]:
                if key in extraction_result and isinstance(extraction_result[key], dict):
                    nested = extraction_result[key]
                    if "items" in nested:
                        items = nested["items"]
                        self.logger.info(f"[INVOICE-DUTY] Found items in {key}: {len(items) if isinstance(items, list) else 'not a list'}")
                        break
                    elif "line_items" in nested:
                        items = nested["line_items"]
                        self.logger.info(f"[INVOICE-DUTY] Found line_items in {key}: {len(items) if isinstance(items, list) else 'not a list'}")
                        break

        # Ensure items is a list
        if not isinstance(items, list):
            self.logger.warning(f"[INVOICE-DUTY] Items is not a list: {type(items)}")
            self.logger.warning(f"[INVOICE-DUTY] Full extraction result structure: {extraction_result}")
            return []

        self.logger.info(f"[INVOICE-DUTY] Successfully extracted {len(items)} items")
        return items

    def _extract_invoice_metadata(self, extraction_result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract invoice-level metadata."""
        # Try 'combined' first (used by DocumentExtractionService), then 'data', then root
        data = extraction_result.get("combined", extraction_result.get("data", extraction_result))

        # Check if there's a header object inside data
        header = None
        if isinstance(data, dict) and "header" in data:
            header = data["header"]
            self.logger.info(f"[INVOICE-DUTY] Found header object with keys: {list(header.keys()) if isinstance(header, dict) else 'not a dict'}")

        # Use header if available, otherwise use data
        source = header if isinstance(header, dict) else data if isinstance(data, dict) else {}

        return {
            # Basic invoice info
            "invoice_number": source.get("invoice_number") or source.get("invoice_no"),
            "invoice_date": source.get("invoice_date") or source.get("date"),

            # Supplier info
            "supplier": source.get("supplier") or source.get("seller") or source.get("from") or source.get("vendor_name"),
            "supplier_name": source.get("supplier_name") or source.get("vendor_name"),
            "supplier_address": source.get("supplier_address") or source.get("vendor_address"),
            "supplier_country": source.get("supplier_country") or source.get("vendor_country"),

            # Buyer info
            "buyer": source.get("buyer") or source.get("customer") or source.get("to") or source.get("customer_name"),
            "buyer_name": source.get("buyer_name") or source.get("customer_name"),
            "buyer_address": source.get("buyer_address") or source.get("customer_address"),
            "buyer_iec": source.get("buyer_iec") or source.get("iec") or source.get("customer_iec"),
            "buyer_gst": source.get("buyer_gst") or source.get("gst") or source.get("customer_gst"),

            # Shipping info (CRITICAL for BoE)
            "bill_of_lading": source.get("bill_of_lading") or source.get("bl_number") or source.get("bol_number"),
            "bl_date": source.get("bl_date") or source.get("bill_of_lading_date"),
            "vessel_name": source.get("vessel_name") or source.get("ship_name"),
            "country_of_origin": source.get("country_of_origin") or source.get("origin_country") or source.get("supplier_country"),
            "port_of_loading": source.get("port_of_loading"),
            "port_of_discharge": source.get("port_of_discharge"),

            # Financial info
            "currency": source.get("currency", "INR"),
            "total_amount": source.get("total") or source.get("total_amount") or source.get("grand_total") or source.get("invoice_total"),
            "freight": source.get("freight") or source.get("freight_charges"),
            "insurance": source.get("insurance") or source.get("insurance_charges"),
            "exchange_rate": source.get("exchange_rate"),

            # Terms
            "payment_terms": source.get("payment_terms"),
            "delivery_terms": source.get("incoterms") or source.get("delivery_terms")
        }

    def _process_item(
        self,
        item: Dict[str, Any],
        auto_classify_hsn: bool,
        port_code: Optional[str],
        country_of_origin: Optional[str],
        user_id: int,
        document_id: Optional[int],
        vendor_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a single line item: classify HSN and calculate duty."""

        doc_hsn = item.get("hsn_code") or item.get("hs_code")
        processed = {
            "description": item.get("description") or item.get("item_name") or item.get("product"),
            "quantity": item.get("quantity") or item.get("qty"),
            "unit": item.get("unit") or item.get("uom") or "PCS",
            "unit_price": item.get("unit_price") or item.get("price"),
            "total_value": item.get("total") or item.get("amount") or item.get("total_value"),
            "hsn_code": doc_hsn,
            "hsn_from_document": bool(doc_hsn),   # True when HS code was present in the source document
            "hsn_auto_classified": False,
            "classification_error": None,
            "duty_calculation": None,
            "duty_error": None
        }

        # Debug: Log what keys are in the item and what values we extracted
        self.logger.info(f"[INVOICE-DUTY] Item keys available: {list(item.keys())}")
        self.logger.info(f"[INVOICE-DUTY] Extracted - qty: {processed['quantity']}, unit_price: {processed['unit_price']}, total: {processed['total_value']}")

        # Sanitize numeric values
        try:
            if processed["quantity"]:
                sanitized_qty = sanitize_numeric_value(processed["quantity"])
                processed["quantity"] = float(sanitized_qty) if sanitized_qty else None
        except Exception as e:
            self.logger.warning(f"[INVOICE-DUTY] Could not sanitize quantity: {processed['quantity']} - {str(e)}")
            processed["quantity"] = None

        try:
            if processed["unit_price"]:
                sanitized_price = sanitize_numeric_value(processed["unit_price"])
                processed["unit_price"] = float(sanitized_price) if sanitized_price else None
        except Exception as e:
            self.logger.warning(f"[INVOICE-DUTY] Could not sanitize unit_price: {processed['unit_price']} - {str(e)}")
            processed["unit_price"] = None

        try:
            if processed["total_value"]:
                sanitized_total = sanitize_numeric_value(processed["total_value"])
                processed["total_value"] = float(sanitized_total) if sanitized_total else None
        except Exception as e:
            self.logger.warning(f"[INVOICE-DUTY] Could not sanitize total_value: {processed['total_value']} - {str(e)}")
            processed["total_value"] = None

        # If no CIF value but has quantity and unit price, calculate
        if not processed["total_value"] and processed["quantity"] and processed["unit_price"]:
            try:
                processed["total_value"] = processed["quantity"] * processed["unit_price"]
            except (TypeError, ValueError):
                pass

        # Step 1: Vendor-Based Classification (if description is part number only)
        self.logger.debug(f"[INVOICE-DUTY] Item check - vendor_name: {vendor_name}, description: {processed.get('description')}")

        if not processed["hsn_code"] and vendor_name and processed["description"]:
            description_str = str(processed["description"]).strip()
            is_just_number = description_str.replace('.', '').replace('-', '').isdigit()

            self.logger.info(f"[INVOICE-DUTY] Checking vendor-based classification - description: '{description_str}', is_part_number: {is_just_number}, vendor: {vendor_name}")

            if is_just_number:
                # Check vendor-based classification mappings
                vendor_lower = vendor_name.lower()
                vendor_hsn_map = {
                    'circuits': ('8534.00.00', 'Printed circuits (PCB) - based on vendor'),
                    'pcb': ('8534.00.00', 'Printed circuits (PCB) - based on vendor'),
                    'electronics': ('8542.39.00', 'Electronic integrated circuits - based on vendor'),
                    'semiconductor': ('8541.49.00', 'Semiconductor devices - based on vendor'),
                }

                for keyword, (hsn, description) in vendor_hsn_map.items():
                    if keyword in vendor_lower:
                        processed["hsn_code"] = hsn
                        processed["hsn_auto_classified"] = True
                        processed["hsn_confidence"] = 85  # High confidence for vendor-based
                        processed["hsn_description"] = description
                        processed["classification_method"] = "vendor_based"
                        self.logger.info(f"[INVOICE-DUTY] ✅ Vendor-based classification: {hsn} (vendor: {vendor_name})")
                        break

                if not processed["hsn_code"]:
                    processed["classification_error"] = "Description is part number only - need product description"
                    self.logger.warning(f"[INVOICE-DUTY] ⚠️ Description '{description_str}' is just a part number, cannot classify")

        # Step 2: Description-Based HSN Classification
        if not processed["hsn_code"] and auto_classify_hsn and processed["description"]:
            # Check if description is just a number (part number)
            description_str = str(processed["description"]).strip()
            is_just_number = description_str.replace('.', '').replace('-', '').isdigit()

            if not is_just_number:
                try:
                    self.logger.info(f"[INVOICE-DUTY] Auto-classifying HSN for: {processed['description']}")
                    classification_result = self.hsn_service.classify_item(processed["description"])

                    if classification_result and "hsn_code" in classification_result:
                        processed["hsn_code"] = classification_result["hsn_code"]
                        processed["hsn_auto_classified"] = True
                        processed["hsn_confidence"] = classification_result.get("confidence", 0)
                        processed["hsn_description"] = classification_result.get("description")
                        self.logger.info(f"[INVOICE-DUTY] ✅ Classified as HSN {processed['hsn_code']} (confidence: {processed.get('hsn_confidence', 0):.1%})")
                    else:
                        processed["classification_error"] = "No HSN code found"
                        self.logger.warning(f"[INVOICE-DUTY] ⚠️ Could not classify HSN")

                except Exception as e:
                    processed["classification_error"] = str(e)
                    self.logger.error(f"[INVOICE-DUTY] HSN classification failed: {str(e)}")
        elif not processed["description"]:
            processed["classification_error"] = "No product description available"

        # Step 3: Duty Calculation
        if processed["hsn_code"] and processed["total_value"]:
            try:
                # Sanitize and convert to Decimal
                sanitized_value = sanitize_numeric_value(processed["total_value"])
                if not sanitized_value:
                    raise ValueError(f"Invalid total_value: {processed['total_value']}")

                cif_value = Decimal(sanitized_value)

                self.logger.info(f"[INVOICE-DUTY] Calculating duty for HSN {processed['hsn_code']}, CIF ₹{cif_value:,.2f}")

                # Sanitize quantity if present
                quantity_decimal = None
                if processed["quantity"]:
                    sanitized_qty = sanitize_numeric_value(processed["quantity"])
                    if sanitized_qty:
                        quantity_decimal = Decimal(sanitized_qty)

                duty_result = self.duty_calculator.calculate_duty(
                    hsn_code=processed["hsn_code"],
                    cif_value=cif_value,
                    port_code=port_code,
                    country_of_origin=country_of_origin,
                    quantity=quantity_decimal,
                    unit=processed["unit"],
                    user_id=user_id,
                    document_id=document_id
                )

                if "error" not in duty_result:
                    processed["duty_calculation"] = duty_result
                    self.logger.info(f"[INVOICE-DUTY] ✅ Duty calculated: ₹{duty_result['total_duty']:,.2f} ({duty_result['total_duty']/float(cif_value)*100:.1f}%)")
                else:
                    processed["duty_error"] = duty_result["error"]
                    self.logger.warning(f"[INVOICE-DUTY] ⚠️ Duty calculation failed: {duty_result['error']}")

            except Exception as e:
                processed["duty_error"] = str(e)
                self.logger.error(f"[INVOICE-DUTY] Duty calculation exception: {str(e)}")
        else:
            if not processed["hsn_code"]:
                processed["duty_error"] = "No HSN code available"
            elif not processed["total_value"]:
                processed["duty_error"] = "No CIF value available"

        return processed

    def get_duty_summary_by_document(self, document_id: int) -> Dict[str, Any]:
        """Get duty summary for a previously processed document."""
        try:
            from Orbisporte.infrastructure.db import DocumentRepository

            document = DocumentRepository.get_by_id(self.db, document_id)

            if not document:
                return {"error": "Document not found"}

            # Get stored extraction result
            if not document.extracted_data:
                return {"error": "No extraction result available"}

            # Check if we have duty calculations stored
            # If not, reprocess
            extraction_data = document.extracted_data

            if "duty_summary" in extraction_data:
                return extraction_data["duty_summary"]
            else:
                # Reprocess if needed
                return {"error": "No duty calculations available. Please reprocess."}

        except Exception as e:
            self.logger.error(f"Failed to get duty summary: {str(e)}")
            return {"error": str(e)}


# Convenience function for quick processing
def process_invoice_complete(
    db: Session,
    file_path: str,
    user_id: int,
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience wrapper for invoice processing.

    Example:
        result = process_invoice_complete(
            db=db,
            file_path="/path/to/invoice.pdf",
            user_id=1,
            auto_classify_hsn=True
        )
    """
    service = InvoiceDutyIntegrationService(db)
    return service.process_invoice_complete(
        file_path=file_path,
        user_id=user_id,
        **kwargs
    )
