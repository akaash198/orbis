"""
Port-Specific Field Mappings for Bill of Entry
Purpose: Map internal BoE fields to port-specific ICEGATE field names

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
Date: 2026-03-01
"""

from typing import Dict, List, Any

# ============================================================================
# MUMBAI PORT (INMAA1 - JNCH Nhava Sheva)
# ============================================================================
MUMBAI_FIELD_MAPPING = {
    # Importer Information
    "importer_name": "IMP_NAME",
    "importer_address": "IMP_ADDRESS",
    "importer_iec": "IEC_CODE",
    "importer_gst": "GST_NUMBER",
    "importer_pan": "PAN_NUMBER",

    # BoE Header
    "boe_number": "BOE_NO",
    "boe_date": "BOE_DATE",
    "port_code": "PORT_CODE",

    # Shipment Information
    "bill_of_lading_number": "BL_AWB_NO",
    "bill_of_lading_date": "BL_AWB_DATE",
    "vessel_name": "VESSEL_NAME",
    "country_of_origin": "COUNTRY_OF_ORIGIN",
    "country_of_consignment": "COUNTRY_OF_CONSIGNMENT",

    # Financial Information
    "total_invoice_value": "TOTAL_INVOICE_VALUE",
    "freight_charges": "FREIGHT",
    "insurance_charges": "INSURANCE",
    "total_cif_value": "CIF_VALUE",
    "total_assessable_value": "ASSESSABLE_VALUE",

    # Duty Information
    "total_bcd": "TOTAL_BCD",
    "total_igst": "TOTAL_IGST",
    "total_cess": "TOTAL_CESS",
    "total_sws": "TOTAL_SWS",
    "total_duty": "TOTAL_DUTY",
    "total_amount_payable": "TOTAL_PAYABLE",

    # Exchange Rate
    "currency_code": "CURRENCY",
    "exchange_rate": "EXCHANGE_RATE"
}

# ============================================================================
# CHENNAI PORT (INMAA4)
# ============================================================================
CHENNAI_FIELD_MAPPING = {
    # Similar to Mumbai but with minor variations
    "importer_name": "IMPORTER_NAME",
    "importer_address": "IMPORTER_ADDR",
    "importer_iec": "IEC_NO",
    "importer_gst": "GSTIN",
    "importer_pan": "PAN_NO",

    "boe_number": "BE_NUMBER",
    "boe_date": "BE_DATE",
    "port_code": "PORT",

    "bill_of_lading_number": "BL_NUMBER",
    "bill_of_lading_date": "BL_DATE",
    "vessel_name": "VESSEL",
    "country_of_origin": "COO",
    "country_of_consignment": "COC",

    "total_invoice_value": "INV_VALUE",
    "freight_charges": "FRT",
    "insurance_charges": "INS",
    "total_cif_value": "CIF",
    "total_assessable_value": "ASSESS_VALUE",

    "total_bcd": "BCD_AMT",
    "total_igst": "IGST_AMT",
    "total_cess": "CESS_AMT",
    "total_sws": "SWS_AMT",
    "total_duty": "DUTY_TOTAL",
    "total_amount_payable": "PAYABLE",

    "currency_code": "CURR",
    "exchange_rate": "EXCH_RATE"
}

# ============================================================================
# KOLKATA PORT (INCCU1)
# ============================================================================
KOLKATA_FIELD_MAPPING = MUMBAI_FIELD_MAPPING.copy()  # Uses Mumbai format

# ============================================================================
# BANGALORE AIR CARGO (INBLR4)
# ============================================================================
BANGALORE_FIELD_MAPPING = CHENNAI_FIELD_MAPPING.copy()  # Uses Chennai format


# ============================================================================
# PORT MAPPING REGISTRY
# ============================================================================
PORT_MAPPINGS: Dict[str, Dict[str, str]] = {
    "INMAA1": MUMBAI_FIELD_MAPPING,
    "INMAA4": CHENNAI_FIELD_MAPPING,
    "INCCU1": KOLKATA_FIELD_MAPPING,
    "INBLR4": BANGALORE_FIELD_MAPPING,
}


# ============================================================================
# REQUIRED FIELDS PER PORT
# ============================================================================
PORT_REQUIRED_FIELDS: Dict[str, List[str]] = {
    "INMAA1": [
        "importer_iec",
        "importer_gst",
        "importer_name",
        "bill_of_lading_number",
        "boe_date",
        "country_of_origin",
        "total_cif_value"
    ],
    "INMAA4": [
        "importer_iec",
        "importer_gst",
        "importer_name",
        "bill_of_lading_number",
        "boe_date",
        "country_of_origin",
        "total_cif_value"
    ],
    "INCCU1": [
        "importer_iec",
        "importer_gst",
        "importer_name",
        "bill_of_lading_number",
        "boe_date",
        "country_of_origin",
        "total_cif_value"
    ],
    "INBLR4": [
        "importer_iec",
        "importer_gst",
        "importer_name",
        "bill_of_lading_number",
        "boe_date",
        "country_of_origin",
        "total_cif_value"
    ],
}


# ============================================================================
# LINE ITEM FIELD MAPPINGS
# ============================================================================
LINE_ITEM_FIELD_MAPPING = {
    "line_number": "ITEM_NO",
    "product_description": "DESCRIPTION",
    "hsn_code": "HSN_CODE",
    "quantity": "QTY",
    "unit": "UNIT",
    "unit_price": "UNIT_PRICE",
    "total_value": "ITEM_VALUE",
    "cif_value": "CIF_VALUE",
    "assessable_value": "ASSESS_VALUE",

    "bcd_rate": "BCD_RATE",
    "bcd_amount": "BCD_AMT",
    "igst_rate": "IGST_RATE",
    "igst_amount": "IGST_AMT",
    "cess_rate": "CESS_RATE",
    "cess_amount": "CESS_AMT",
    "total_duty": "TOTAL_DUTY"
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_port_mapping(port_code: str) -> Dict[str, str]:
    """
    Get field mapping for a specific port

    Args:
        port_code: Port code (e.g., "INMAA1")

    Returns:
        Dictionary mapping internal field names to port-specific field names
    """
    return PORT_MAPPINGS.get(port_code, MUMBAI_FIELD_MAPPING)


def get_required_fields(port_code: str) -> List[str]:
    """
    Get required fields for a specific port

    Args:
        port_code: Port code (e.g., "INMAA1")

    Returns:
        List of required field names (internal names)
    """
    return PORT_REQUIRED_FIELDS.get(port_code, PORT_REQUIRED_FIELDS["INMAA1"])


def map_boe_to_port_format(boe_data: Dict[str, Any], port_code: str) -> Dict[str, Any]:
    """
    Convert internal BoE format to port-specific format

    Args:
        boe_data: BoE data in internal format
        port_code: Target port code

    Returns:
        BoE data in port-specific format
    """
    mapping = get_port_mapping(port_code)
    port_data = {}

    for internal_field, port_field in mapping.items():
        if internal_field in boe_data:
            port_data[port_field] = boe_data[internal_field]

    return port_data


def map_line_items_to_port_format(line_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Convert internal line item format to port-specific format

    Args:
        line_items: List of line items in internal format

    Returns:
        List of line items in port-specific format
    """
    port_line_items = []

    for item in line_items:
        port_item = {}
        for internal_field, port_field in LINE_ITEM_FIELD_MAPPING.items():
            if internal_field in item:
                port_item[port_field] = item[internal_field]
        port_line_items.append(port_item)

    return port_line_items
