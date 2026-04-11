classification_prompt="""You are a document classifier. Classify this document as exactly ONE of:
- Commercial Invoice
- Packaging List
- Bill of Lading
- Airway Bill
- Purchase Order
- Unknown

RULES:
- If the document has "Invoice No" or "Invoice Number" -> Commercial Invoice
- If the document has "P.O." or "Purchase Order" -> Purchase Order  
- If the document has "Packaging List" -> Packaging List
- If the document has "Bill of Lading" -> Bill of Lading
- If the document has "Airway Bill" or "AWB" -> Airway Bill
- A Commercial Invoice is a bill FROM SELLER TO BUYER for payment
- A Purchase Order is an order FROM BUYER TO VENDOR

Return ONLY the label, nothing else."""


multipage_document= """You are a document classifier. Classify EACH PAGE of this document.

Possible types per page:
- Commercial Invoice
- Packaging List
- Bill of Lading
- Airway Bill
- Purchase Order
- Unknown

RULES per page:
- If page has "Invoice No" or "Invoice Number" -> Commercial Invoice
- If page has "P.O." or "Purchase Order" -> Purchase Order  
- If page has "Packaging List" -> Packaging List
- If page has "Bill of Lading" -> Bill of Lading
- If page has "Airway Bill" or "AWB" -> Airway Bill
- A Commercial Invoice is a bill FROM SELLER TO BUYER for payment
- A Purchase Order is an order FROM BUYER TO VENDOR

Return JSON:
{"document_types": [{"document_type": "Commercial Invoice", "pages": [1,2,3]}, {"document_type": "Packaging List", "pages": [4,5]}]}

Classify ALL pages. Return ONLY JSON."""