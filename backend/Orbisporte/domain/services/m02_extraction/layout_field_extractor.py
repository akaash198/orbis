"""
M02 Layout-based Field Extractor - Uses LayoutLMv3 to extract fields from document regions.

This module enhances field extraction by:
1. Using detected document regions (header, sender, receiver, line items, totals)
2. Extracting fields specific to each region type
3. Combining with GLiNER and Gemini for comprehensive extraction
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Fields to extract per region type
_REGION_FIELDS = {
    "header": [
        "invoice_number", "invoice_date", "document_type", "reference_number",
        "purchase_order_number", "contract_number"
    ],
    "sender_info": [
        "exporter_name", "exporter_address", "exporter_country", 
        "exporter_gst", "exporter_iec"
    ],
    "receiver_info": [
        "importer_name", "importer_address", "importer_country",
        "importer_gst", "importer_iec", "consignee_name", "consignee_address"
    ],
    "line_items_table": [
        "line_items", "hsn_code", "goods_description", "quantity", 
        "unit", "unit_price", "total_price", "country_of_origin"
    ],
    "totals": [
        "subtotal", "freight", "insurance", "cif_value", "total_value",
        "currency", "tax_amount", "igst", "cgst", "sgst"
    ],
    "payment_terms": [
        "payment_terms", "incoterms", "bank_name", "bank_address",
        "swift_code", "account_number", "iban"
    ],
    "footer": [
        "shipment_date", "port_of_loading", "port_of_discharge",
        "vessel_name", "flight_number", "container_number",
        "bill_of_lading_number", "awb_number"
    ]
}

# Keywords to identify field values from text
_FIELD_PATTERNS = {
    "invoice_number": [
        r"(?:invoice\s*(?:no|number|#|ref)?\.?\s*:?\s*)([A-Z0-9\-\/]+)",
        r"(?:inv\s*(?:no|#)?\.?\s*:?\s*)([A-Z0-9\-\/]+)",
        r"(?:invoice\s+no\.?\s*)([A-Z0-9\-\/]+)",
    ],
    "invoice_date": [
        r"(?:invoice\s*date\s*:?\s*)(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})",
        r"(?:date\s*:?\s*)(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})",
        r"(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})",
    ],
    "hsn_code": [
        r"(?:hsn\s*(?:code)?\.?\s*:?\s*)(\d{4,8})",
        r"(?:hs\s*code\.?\s*:?\s*)(\d{4,8})",
        r"(\d{4,8})",
    ],
    "gst_number": [
        r"(?:gst\s*(?:in)?\.?\s*:?\s*)([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1})",
        r"(?:gstin\.?\s*:?\s*)([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1})",
    ],
    "iec_number": [
        r"(?:iec\s*(?:no)?\.?\s*:?\s*)([0-9]{10})",
    ],
    "currency": [
        r"(?:currency\s*:?\s*)(USD|INR|EUR|GBP|AUD|CNY|JPY)",
        r"(?:inr\s*|usd\s*|eur\s*|gbp\s*)",
    ],
    "total_value": [
        r"(?:total\s*(?:value|amount|invoice)?\.?\s*:?\s*)([\d,]+\.?\d*)",
        r"(?:grand\s*total\.?\s*:?\s*)([\d,]+\.?\d*)",
        r"(?:amount\s*due\.?\s*:?\s*)([\d,]+\.?\d*)",
    ],
    "freight": [
        r"(?:freight\s*:?\s*)([\d,]+\.?\d*)",
        r"(?:shipping\s*charges?\s*:?\s*)([\d,]+\.?\d*)",
    ],
    "insurance": [
        r"(?:insurance\s*:?\s*)([\d,]+\.?\d*)",
    ],
    "cif_value": [
        r"(?:cif\s*(?:value|total)?\.?\s*:?\s*)([\d,]+\.?\d*)",
    ],
}


def extract_fields_from_regions(layout_result: dict, ocr_text: str) -> Dict[str, Any]:
    """
    Extract fields from document layout regions.
    
    Args:
        layout_result: Result from layout_detector.detect_layout()
        ocr_text: Full OCR text from document
    
    Returns:
        Dictionary of extracted fields
    """
    fields = {}
    pdf_blocks = layout_result.get("pdf_blocks", [])
    regions = layout_result.get("regions", [])
    
    logger.info(f"[LayoutFields] Processing {len(pdf_blocks)} blocks from {len(regions)} regions")
    
    # Process each block and extract fields based on region
    for block in pdf_blocks:
        region = block.get("region", "other")
        text = block.get("text", "")
        
        if not text:
            continue
        
        # Extract fields based on region type
        region_fields = _extract_region_fields(region, text)
        fields.update(region_fields)
    
    # Also use OCR text for additional field extraction
    text_fields = _extract_fields_from_text(ocr_text)
    
    # Merge: prefer longer values (more complete)
    for key, value in text_fields.items():
        if key not in fields or not fields[key]:
            fields[key] = value
        elif value and len(str(value)) > len(str(fields[key])):
            fields[key] = value
    
    # Clean up null values
    null_values = {"null", "none", "n/a", "na", "-", "", "not applicable", "unknown"}
    cleaned = {}
    for k, v in fields.items():
        if v is None:
            continue
        val_str = str(v).strip()
        if val_str.lower() not in null_values:
            cleaned[k] = v
    
    logger.info(f"[LayoutFields] Extracted {len(cleaned)} fields from layout")
    return cleaned


def _extract_region_fields(region: str, text: str) -> Dict[str, Any]:
    """Extract fields specific to a region type."""
    fields = {}
    
    # Look for patterns in region-specific text
    for field_name, patterns in _FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1) if match.lastindex else match.group(0)
                if value and len(value.strip()) > 1:
                    fields[field_name] = value.strip()
                    break
    
    # Region-specific extraction
    if region == "header":
        fields.update(_extract_header_fields(text))
    elif region == "sender_info":
        fields.update(_extract_sender_fields(text))
    elif region == "receiver_info":
        fields.update(_extract_receiver_fields(text))
    elif region == "line_items_table":
        fields.update(_extract_line_items(text))
    elif region == "totals":
        fields.update(_extract_totals(text))
    elif region == "payment_terms":
        fields.update(_extract_payment_fields(text))
    elif region == "footer":
        fields.update(_extract_shipping_fields(text))
    
    return fields


def _extract_header_fields(text: str) -> Dict[str, Any]:
    """Extract fields from header region."""
    fields = {}
    
    # Invoice number
    patterns = [
        r"(?:invoice\s*(?:no|number|#|ref)?\.?\s*:?\s*)([A-Z0-9\-\/]+)",
        r"(?:inv\s*(?:no|#)?\.?\s*:?\s*)([A-Z0-9\-\/]+)",
    ]
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            fields["invoice_number"] = match.group(1).strip()
            break
    
    # Invoice date
    patterns = [
        r"(?:invoice\s*date\s*:?\s*)(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})",
        r"(?:date\s*:?\s*)(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})",
    ]
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            fields["invoice_date"] = match.group(1).strip()
            break
    
    return fields


def _extract_sender_fields(text: str) -> Dict[str, Any]:
    """Extract exporter/sender fields."""
    fields = {}
    
    # Split into lines and look for address-like patterns
    lines = text.split("\n")
    address_parts = []
    name = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        # First non-empty line is usually the name
        if name is None and len(line) > 2 and len(line) < 100:
            # Check if it looks like a company name (no numbers at start)
            if not re.match(r"^\d", line):
                name = line
                fields["exporter_name"] = name
                continue
        
        # Address lines contain common address keywords
        address_keywords = ["address", "street", "road", "city", "state", "pin", "zip", "country", "phone", "tel", "fax", "email"]
        if any(kw in line.lower() for kw in address_keywords) or re.search(r"\d{5,}", line):
            address_parts.append(line)
    
    if address_parts:
        fields["exporter_address"] = ", ".join(address_parts[:3])
    
    # GST number
    match = re.search(r"([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1})", text)
    if match:
        fields["gst_number"] = match.group(1)
    
    # IEC number
    match = re.search(r"(?:iec\s*(?:no)?\.?\s*:?\s*)([0-9]{10})", text, re.IGNORECASE)
    if match:
        fields["iec_number"] = match.group(1)
    
    return fields


def _extract_receiver_fields(text: str) -> Dict[str, Any]:
    """Extract importer/receiver fields."""
    fields = {}
    
    lines = text.split("\n")
    address_parts = []
    name = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if name is None and len(line) > 2 and len(line) < 100:
            if not re.match(r"^\d", line):
                name = line
                fields["importer_name"] = name
                continue
        
        address_keywords = ["address", "street", "road", "city", "state", "pin", "zip", "country", "phone", "tel", "fax", "email"]
        if any(kw in line.lower() for kw in address_keywords) or re.search(r"\d{5,}", line):
            address_parts.append(line)
    
    if address_parts:
        fields["importer_address"] = ", ".join(address_parts[:3])
    
    # GST
    match = re.search(r"([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1})", text)
    if match:
        fields["importer_gst"] = match.group(1)
    
    return fields


def _extract_line_items(text: str) -> Dict[str, Any]:
    """Extract line items from table region."""
    items = []
    lines = text.split("\n")
    
    current_item = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Skip table headers
        header_indicators = ["description", "quantity", "unit", "price", "hsn", "amount", "total"]
        if any(h in line.lower() for h in header_indicators) and len(line) < 50:
            continue
        
        # Check for table-like structure (pipe separated or multiple numbers)
        if "|" in line or (line.count(",") >= 3 and re.search(r"\d", line)):
            parts = re.split(r"[\|,\t]+", line)
            if len(parts) >= 2:
                item = {}
                # Try to parse as description + numbers
                for i, part in enumerate(parts[:6]):
                    part = part.strip()
                    if not part:
                        continue
                    # Check if part is a number
                    if re.match(r"^[\d,]+\.?\d*$", part):
                        if "quantity" not in item and "unit_price" not in item:
                            if "quantity" not in item:
                                item["quantity"] = part
                            else:
                                item["unit_price"] = part
                    elif len(part) > 2:
                        if "description" not in item:
                            item["description"] = part[:100]
                
                # HSN code
                hsn_match = re.search(r"(\d{4,8})", line)
                if hsn_match:
                    item["hsn_code"] = hsn_match.group(1)
                
                if item:
                    items.append(item)
    
    if items:
        return {"line_items": items[:20]}  # Limit to 20 items
    
    return {}


def _extract_totals(text: str) -> Dict[str, Any]:
    """Extract totals/amounts."""
    fields = {}
    
    # Total value
    patterns = [
        r"(?:total\s*(?:value|amount|invoice)?\.?\s*:?\s*)([\d,]+\.?\d*)",
        r"(?:grand\s*total\.?\s*:?\s*)([\d,]+\.?\d*)",
        r"(?:amount\s*due\.?\s*:?\s*)([\d,]+\.?\d*)",
    ]
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            fields["total_value"] = match.group(1).replace(",", "")
            break
    
    # Freight
    match = re.search(r"(?:freight\s*:?\s*)([\d,]+\.?\d*)", text, re.IGNORECASE)
    if match:
        fields["freight"] = match.group(1).replace(",", "")
    
    # Insurance
    match = re.search(r"(?:insurance\s*:?\s*)([\d,]+\.?\d*)", text, re.IGNORECASE)
    if match:
        fields["insurance"] = match.group(1).replace(",", "")
    
    # CIF
    match = re.search(r"(?:cif\s*(?:value|total)?\.?\s*:?\s*)([\d,]+\.?\d*)", text, re.IGNORECASE)
    if match:
        fields["cif_value"] = match.group(1).replace(",", "")
    
    # Currency
    currency_match = re.search(r"(USD|INR|EUR|GBP|AUD|CNY|JPY)", text, re.IGNORECASE)
    if currency_match:
        fields["currency"] = currency_match.group(1).upper()
    
    return fields


def _extract_payment_fields(text: str) -> Dict[str, Any]:
    """Extract payment and banking fields."""
    fields = {}
    
    # Incoterms
    incoterms = ["CIF", "FOB", "EXW", "DAP", "DDP", "CFR", "CIP", "FAS", "FCA"]
    for inc in incoterms:
        if inc in text.upper():
            fields["incoterms"] = inc
            break
    
    # Payment terms
    payment_terms = ["NET 30", "NET 45", "NET 60", "NET 90", "COD", "Advance", "LC"]
    for pt in payment_terms:
        if pt.lower() in text.lower():
            fields["payment_terms"] = pt
            break
    
    # SWIFT code
    match = re.search(r"(?:swift\s*(?:code)?\.?\s*:?\s*)([A-Z]{6}[A-Z0-9]{2,5})", text, re.IGNORECASE)
    if match:
        fields["swift_code"] = match.group(1).upper()
    
    return fields


def _extract_shipping_fields(text: str) -> Dict[str, Any]:
    """Extract shipping/transport fields."""
    fields = {}
    
    # Port of loading
    patterns = [
        r"(?:port\s*of\s*loading\s*:?\s*)([A-Za-z\s]+)",
        r"(?:loading\s*port\s*:?\s*)([A-Za-z\s]+)",
    ]
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            fields["port_of_loading"] = match.group(1).strip()
            break
    
    # Port of discharge
    patterns = [
        r"(?:port\s*of\s*discharge\s*:?\s*)([A-Za-z\s]+)",
        r"(?:discharge\s*port\s*:?\s*)([A-Za-z\s]+)",
        r"(?:destination\s*:?\s*)([A-Za-z\s]+)",
    ]
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            fields["port_of_discharge"] = match.group(1).strip()
            break
    
    # Bill of Lading
    match = re.search(r"(?:b/l|bl|bill\s*of\s*lading)\s*(?:no)?\.?\s*:?\s*([A-Z0-9\-]+)", text, re.IGNORECASE)
    if match:
        fields["bill_of_lading_number"] = match.group(1)
    
    # AWB
    match = re.search(r"(?:awb|airway\s*bill)\s*(?:no)?\.?\s*:?\s*([0-9\-]{10,})", text, re.IGNORECASE)
    if match:
        fields["awb_number"] = match.group(1)
    
    # Container
    match = re.search(r"(?:container\s*(?:no)?\.?\s*:?\s*)([A-Z]{4}[0-9]{7})", text, re.IGNORECASE)
    if match:
        fields["container_number"] = match.group(1).upper()
    
    # Vessel
    match = re.search(r"(?:vessel\s*(?:name)?\.?\s*:?\s*)([A-Za-z\s]+)", text, re.IGNORECASE)
    if match:
        fields["vessel_name"] = match.group(1).strip()
    
    return fields


def _extract_fields_from_text(text: str) -> Dict[str, Any]:
    """Extract fields from raw OCR text using regex patterns."""
    fields = {}
    
    for field_name, patterns in _FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1) if match.lastindex else match.group(0)
                if value and len(value.strip()) > 1:
                    fields[field_name] = value.strip()
                    break
    
    return fields


def extract_with_layout_awareness(
    layout_result: dict,
    ocr_text: str,
    gemini_fields: dict,
    gliner_fields: dict,
    langextract_fields: dict
) -> Dict[str, Any]:
    """
    Combine fields from all extraction methods with layout awareness.
    
    Priority:
    1. Gemini fields (primary)
    2. Layout-based fields
    3. GLiNER entities
    4. LangExtract fields
    
    Args:
        layout_result: Layout detection result
        ocr_text: Full OCR text
        gemini_fields: Fields from Gemini extraction
        gliner_fields: Entities from GLiNER
        langextract_fields: Fields from LangExtract
    
    Returns:
        Merged and cleaned fields
    """
    # Start with Gemini as primary
    merged = dict(gemini_fields)
    
    # Add layout fields (prefer if missing in Gemini)
    layout_fields = extract_fields_from_regions(layout_result, ocr_text)
    for key, value in layout_fields.items():
        if key not in merged or not merged[key]:
            merged[key] = value
        elif value and len(str(value)) > len(str(merged[key])):
            merged[key] = value  # Use longer value
    
    # Add GLiNER entities (validate/augment)
    for key, entity_data in gliner_fields.items():
        if isinstance(entity_data, dict):
            text = entity_data.get("text", "")
        else:
            text = str(entity_data)
        
        if text and (key not in merged or not merged[key]):
            merged[key] = text
        elif text and len(text) > len(str(merged.get(key, ""))):
            merged[key] = text
    
    # Add LangExtract fields (fill gaps)
    for key, value in langextract_fields.items():
        if value and (key not in merged or not merged[key]):
            merged[key] = value
        elif value and len(str(value)) > len(str(merged.get(key, ""))):
            merged[key] = value
    
    # Clean up
    null_values = {"null", "none", "n/a", "na", "-", "", "not applicable", "unknown"}
    cleaned = {}
    for k, v in merged.items():
        if v is None:
            continue
        val_str = str(v).strip()
        if val_str.lower() not in null_values:
            cleaned[k] = v
    
    logger.info(f"[LayoutAware] Merged {len(cleaned)} fields from all sources")
    return cleaned