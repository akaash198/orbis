invoice_prompt = """
Analyze the invoices and extract the following information in JSON. Return ONLY valid JSON, no prose.

CRITICAL INSTRUCTIONS:
1. Extract EVERY line item visible on ALL pages - do NOT skip, abbreviate, or truncate any rows
2. Number each line item sequentially (item_number: 1, 2, 3...)
3. For each line item, extract ALL fields including quantity, unit price, and amount
4. COUNT the total number of line items and include as "total_line_items"
5. SUM all quantities to get "total_units"
6. CALCULATE the sum of all line item amounts to get "calculated_total"
7. Extract the invoice total as shown on the document as "invoice_total"
8. If processing multiple pages in batches, ensure you extract from ALL pages shown

VALIDATION REQUIREMENTS:
- Verify calculated_total closely matches invoice_total
- Include actual count of all items in the array
- Sum all quantities for total units across all items
- Report any discrepancies between calculated and document totals

1. Header information:
   - Invoice Number
   - Invoice Date
   - Vendor Name (also extract as supplier_name)
   - Vendor Address (also extract as supplier_address)
   - Vendor Country (also extract as supplier_country and country_of_origin)
   - Vendor Phone Number
   - Customer Name (also extract as buyer_name)
   - Customer Address (also extract as buyer_address)
   - Customer Phone Number
   - Customer IEC (Import Export Code - 10 digits if shown)
   - Customer GST (GST Number - 15 characters if shown)
   - Payment Terms
   - Invoice Total (as shown on document)
   - Currency (if shown)

   SHIPPING INFORMATION (if shown on invoice):
   - Bill of Lading Number (B/L No, BL Number, or similar)
   - Vessel Name (Ship name)
   - Country of Origin (COO, Origin Country)
   - Port of Loading
   - Port of Discharge
   - Freight Charges
   - Insurance Charges

2. Line items (EXTRACT EVERY ITEM - do not skip any):
   - item_number (sequential: 1, 2, 3...)
   - description (full description, not abbreviated)
   - quantity (numeric value)
   - unit (e.g., pieces, kg, boxes, etc.)
   - unit_price (price per unit)
   - amount (total for this line item)
   - hs_code (Extract ONLY if EXPLICITLY LABELED as HS Code/HSN/Tariff Code - DO NOT extract random numbers)
   - part_number (if available)
   - Any other information provided

CRITICAL HS CODE EXTRACTION RULES:
1. ONLY extract HS Code if it is EXPLICITLY LABELED with one of these terms:
   - "HS Code:", "HS:", "HSN:", "HSN Code:", "Tariff Code:", "Harmonized Code:", "Commodity Code:"

2. Valid HS Code formats (6-10 digits with optional dots/spaces):
   - 6 digits: "854430" or "85.44.30"
   - 8 digits: "85443010" or "8544.30.10"
   - 10 digits: "8544301000" or "8544.30.10.00"

3. DO NOT extract as HS Code:
   - Invoice numbers (e.g., "INV-123456")
   - Part numbers (e.g., "PART-854430")
   - Order numbers (e.g., "ORD-123456")
   - Phone numbers
   - Any other random numbers
   - Quantities or prices

4. If you see "HS Code: 8544.30" or "HSN: 854430" → Extract it
   If you just see "854430" without label → DO NOT extract it as HS Code, set to null

5. If NO HS Code is labeled on the line item, set hs_code to null (the system will auto-lookup later)

3. Summary section (REQUIRED):
   - total_line_items (count of items in array)
   - total_units (sum of all quantities)
   - subtotal (sum of all line item amounts before tax)
   - tax_amount (if shown separately)
   - grand_total (final invoice total from document)
   - currency (e.g., USD, EUR, etc.)

EXAMPLE OUTPUT STRUCTURE:
{
  "header": {
    "invoice_number": "INV-001",
    "invoice_date": "2024-01-15",
    "vendor_name": "Acme Corp",
    "supplier_name": "Acme Corp",
    "supplier_country": "CHN",
    "country_of_origin": "CHN",
    "buyer_name": "Customer Inc",
    "buyer_iec": "1234567890",
    "buyer_gst": "27AABCU9603R1Z5",
    "bill_of_lading": "MAEU123456789",
    "vessel_name": "MSC ATLANTA",
    "invoice_total": "5000.00",
    "currency": "USD",
    "freight": "500.00",
    "insurance": "100.00"
  },
  "items": [
    {
      "item_number": 1,
      "description": "Widget A - Premium Grade",
      "quantity": 10,
      "unit": "pieces",
      "unit_price": "50.00",
      "amount": "500.00"
    }
    ... (ALL items, not just the first few - include EVERY item visible)
  ],
  "summary": {
    "total_line_items": 43,
    "total_units": 250,
    "subtotal": "4800.00",
    "tax_amount": "200.00",
    "grand_total": "5000.00",
    "currency": "USD"
  }
}

Return the data with 'header', 'items', and 'summary' sections. If a field is missing, set it to null. Output JSON only.
"""

airwaybill_prompt = """
Extract the following fields from this Air Waybill document in JSON. Return ONLY valid JSON.

1. Master Airwaybill / AWB Number
2. House Airwaybill / AWB Number
3. Carrier Name / Airline Name (e.g., Thai Airways International, Emirates, Singapore Airlines, etc.)
4. Shipper Name
5. Consignee Name
6. Consignee Address
7. Issuer Details
8. Shipper Account Number
9. Consignee Account Number
10. Agent IATA Code
11. Departure Airport
12. Destination Airport
13. Flight Number
14. Flight Travel Date
15. Declared Value for Carriage
16. Invoice Number (if available)
17. Invoice Date (if available)
18. Sb Number (if available)
19. Sb Date (if available)
20. HS Code/HSN Code (ONLY if EXPLICITLY LABELED - do not extract random numbers)
21. Weight
22. Dimensions/Measurements
23. Payment Terms
24. Number of pieces
25. Total amount
26. Items/Goods Description

HS CODE EXTRACTION RULE:
- ONLY extract HS Code if it is explicitly labeled as "HS Code:", "HSN:", "Tariff Code:", etc.
- DO NOT extract random numbers as HS Code
- If not labeled, set to null (system will auto-lookup)

If a field is missing, set it to null. Output JSON only. If there are multiple files, extract from each file separately and combine the results into a single JSON object.
"""

bill_of_lading_prompt = """
Extract the following fields from this Bill of Lading document in JSON. Return ONLY valid JSON.

1. Bill of Lading Number
2. Shipper Name
3. Shipper Address
4. Consignee Name
5. Consignee Address
6. Agent Details (Logistics Partner)
7. Port of Loading
8. Port of Discharge
9. Ocean Vessel Name
10. Voyage Number
11. Number of Packages
12. Items/Goods Description
13. Weight
14. Measurement/Dimensions
15. HS Code/HSN Code (ONLY if EXPLICITLY LABELED - do not extract random numbers)
16. Invoice Number (if available)
17. Payment Terms (if available)
18. Date of Shipping
19. Place of Issue
20. Date of Issue

HS CODE EXTRACTION RULE:
- ONLY extract HS Code if it is explicitly labeled as "HS Code:", "HSN:", "Tariff Code:", etc.
- DO NOT extract random numbers as HS Code
- If not labeled, set to null (system will auto-lookup)

If a field is missing, set it to null. Output JSON only. If there are multiple files, extract from each file separately and combine the results into a single JSON object.
"""

packing_list_prompt = """
Analyze the given packing list images and extract the following information in JSON. Return ONLY valid JSON.

CRITICAL INSTRUCTIONS:
1. Extract EVERY item from ALL pages - do NOT skip, abbreviate, or truncate any rows
2. Number each item sequentially (item_number: 1, 2, 3...)
3. COUNT total number of items and include as part of shipment_details
4. SUM all quantities across all items
5. If processing multiple pages, ensure ALL pages are included

You are an expert in interpreting and extracting information from packing lists and shipping documents. Extract all relevant details, organizing them into a standardized JSON structure with these main sections:

1. metadata:
   - document_number
   - document_date
   - po_number
   - any other reference numbers

2. parties:
   - supplier details (name, address, contact)
   - customer details (name, address, contact)
   - consignee details (if different from customer)

3. shipment_details:
   - package_type
   - total_packages (count from document OR count of individual_items array)
   - total_quantity (SUM of all item quantities)
   - total_items (count of items in individual_items array)
   - weights (gross, net)
   - dimensions (if available)

4. individual_items: (array - EXTRACT EVERY ITEM, do not skip any)
   - item_number (sequential: 1, 2, 3...)
   - description (complete description)
   - quantity (numeric value)
   - unit (pieces, kg, cartons, etc.)
   - part_number (if available)
   - weight_per_item (if available)
   - any other item details

VALIDATION:
- Ensure total_items matches the count of items in individual_items array
- Ensure total_quantity is the sum of all item quantities
- Extract ALL visible items, not just a sample

Include any additional relevant information you find. If information is not available, use null values. Output JSON only.
""" 

unknown_prompt = """You are an expert document data extractor. Analyze this document and extract all structured information you can find. Return ONLY valid JSON.

Extract the following types of information in a JSON format:

1. Document Information:
   - Document number, ID, or reference
   - Document date, issue date, or creation date
   - Document type or category
   - Any reference numbers (PO, order, contract, etc.)

2. Parties Information:
   - Sender/Shipper/Supplier name and address
   - Receiver/Consignee/Customer name and address
   - Contact information (phone, email, etc.)
   - Company details or registration numbers

3. Financial Information:
   - Amounts, totals, or values
   - Currency information
   - Payment terms or conditions
   - Tax information

4. Items or Goods:
   - Product descriptions
   - Quantities and units
   - Part numbers or SKUs
   - Specifications or details

5. Shipping/Transport Information:
   - Origin and destination
   - Dates (shipping, delivery, etc.)
   - Transport method or carrier
   - Package or container information

6. Additional Details:
   - Any other structured information present
   - Notes, comments, or special instructions
   - Regulatory or compliance information

Return the data in a well-structured JSON format with clear field names. If information is not available, use null values. Output JSON only.

Example structure:
{{
  "document_info": {{
    "document_number": "...",
    "document_date": "...",
    "reference_numbers": ["..."]
  }},
  "parties": {{
    "sender": {{"name": "...", "address": "..."}},
    "receiver": {{"name": "...", "address": "..."}}
  }},
  "financial": {{
    "total_amount": "...",
    "currency": "..."
  }},
  "items": [
    {{
      "description": "...",
      "quantity": "...",
      "unit": "..."
    }}
  ],
  "additional_info": {{}}
}}"""

direct_extraction_prompt = """You are an expert in shipping and logistics document analysis.
Your task is to classify a given document and then extract structured information in JSON format.
Always return ONLY valid JSON with no extra text.

Step 1: Classify the document into one of these types:
- Invoice
- Packing List
- Air Waybill
- Bill of Lading
- Arrival Notice
- Permit
- Unknown

Step 2: You are given multiple pages of a PDF at a time. 
Extract only the entities that are present on each page only. 
Do not infer, guess, or carry forward information from earlier or later pages. 
If an item is not visible, do not include it. Based on the document type, extract information using the following schemas:

1. Invoice:
{
  "document_type": "Invoice",
  "header": {
    "invoice_number": "...",
    "invoice_date": "...",
    "vendor_name": "...",
    "vendor_address": "...",
    "vendor_phone": "...",
    "supplier_name": "...",
    "supplier_address": "...",
    "supplier_country": "...",
    "customer_name": "...",
    "customer_address": "...",
    "customer_phone": "...",
    "buyer_name": "...",
    "buyer_address": "...",
    "buyer_iec": "...",
    "buyer_gst": "...",
    "bill_of_lading": "...",
    "bl_date": "...",
    "vessel_name": "...",
    "country_of_origin": "...",
    "port_of_loading": "...",
    "port_of_discharge": "...",
    "freight": "...",
    "insurance": "...",
    "payment_terms": "...",
    "invoice_total": "...",
    "currency": "..."
  },
  "items": [
    {
      "item_number": 1,
      "description": "...",
      "quantity": "...",
      "unit": "...",
      "unit_price": "...",
      "amount": "...",
      "hs_code": "...",
      "hsn_code": "...",
      "part_number": "..."
    }
  ]
}

2. Packing List:
{
  "document_type": "Packing List",
  "metadata": {
    "document_number": "...",
    "document_date": "...",
    "po_number": "...",
    "references": ["..."]
  },
  "parties": {
    "supplier": {"name": "...", "address": "...", "contact": "..."},
    "customer": {"name": "...", "address": "...", "contact": "..."},
    "consignee": {"name": "...", "address": "...", "contact": "..."}
  },
  "shipment_details": {
    "package_type": "...",
    "total_packages": "...",
    "total_quantity": "...",
    "weights": {"gross": "...", "net": "..."}
  },
  "individual_items": [
    {"item_number": "...", "description": "...", "quantity": "...", "unit": "...", "part_number": "..."}
  ]
}

3. Air Waybill:
{
  "document_type": "Air Waybill",
  "details": {
    "master_awb_number": "...",
    "house_awb_number": "...",
    "carrier_name": "...",
    "shipper_name": "...",
    "consignee_name": "...",
    "consignee_address": "...",
    "issuer_details": "...",
    "shipper_account": "...",
    "consignee_account": "...",
    "agent_iata_code": "...",
    "departure_airport": "...",
    "destination_airport": "...",
    "flight_number": "...",
    "flight_date": "...",
    "declared_value": "...",
    "invoice_number": "...",
    "invoice_date": "...",
    "sb_number": "...",
    "sb_date": "...",
    "hs_code": "...",
    "weight": "...",
    "dimensions": "...",
    "payment_terms": "...",
    "pieces": "...",
    "total_amount": "...",
    "goods_description": "..."
  }
}

4. Bill of Lading:
{
  "document_type": "Bill of Lading",
  "details": {
    "bol_number": "...",
    "shipper_name": "...",
    "shipper_address": "...",
    "consignee_name": "...",
    "consignee_address": "...",
    "agent_details": "...",
    "port_of_loading": "...",
    "port_of_discharge": "...",
    "vessel_name": "...",
    "voyage_number": "...",
    "packages": "...",
    "goods_description": "...",
    "weight": "...",
    "dimensions": "...",
    "hs_code": "...",
    "invoice_number": "...",
    "payment_terms": "...",
    "shipping_date": "...",
    "place_of_issue": "...",
    "date_of_issue": "..."
  }
}

5. Unknown or Other Document:
{
  "document_type": "Unknown",
  "document_info": {
    "document_number": "...",
    "document_date": "...",
    "reference_numbers": ["..."],
    "document_category": "..."
  },
  "parties": {
    "sender": {"name": "...", "address": "..."},
    "receiver": {"name": "...", "address": "..."},
    "contacts": {"phone": "...", "email": "..."}
  },
  "financial": {
    "total_amount": "...",
    "currency": "...",
    "payment_terms": "...",
    "tax_info": "..."
  },
  "items": [
    {"description": "...", "quantity": "...", "unit": "...", "part_number": "..."}
  ],
  "shipping": {
    "origin": "...",
    "destination": "...",
    "dates": {"shipping": "...", "delivery": "..."},
    "carrier": "...",
    "package_info": "..."
  },
  "additional_info": {
    "notes": "...",
    "compliance": "...",
    "other": "..."
  }
}

Step 3: Output only valid JSON. If a field is missing, set it to null.
"""