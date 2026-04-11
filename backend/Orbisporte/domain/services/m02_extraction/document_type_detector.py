"""
M02 Document Type Detector.

Uses GPT-4o-mini to classify trade documents into standard Indian customs types
from OCR text and layout signals, before field extraction begins.

Supported document types
-------------------------
  commercial_invoice   – Seller's tax invoice / commercial invoice
  packing_list         – Packing list / packaging label / weight list
  air_waybill          – IATA air waybill (AWB / MAWB / HAWB)
  bill_of_lading       – Ocean bill of lading (B/L, HBL, MBL, OBL)
  certificate_of_origin– Certificate of Origin / Form A / GSP certificate
  letter_of_credit     – Letter of Credit / LC / documentary credit
  purchase_order       – Buyer's purchase order (PO)
  proforma_invoice     – Proforma invoice / quotation / PI
  customs_declaration  – Shipping Bill / Bill of Entry / IGM / EGM
  unknown              – Cannot be determined from available text
"""

import json
import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ── Document type metadata ────────────────────────────────────────────────────
DOCUMENT_TYPES: Dict[str, Dict[str, Any]] = {
    "commercial_invoice": {
        "display_name": "Commercial Invoice",
        "icon": "🧾",
        "color": "#3b82f6",
        "key_signals": ["invoice no", "invoice number", "seller", "buyer", "unit price", "total amount", "terms of payment", "invoice date"],
        "description": "Seller's official invoice for customs valuation and duty calculation",
    },
    "packing_list": {
        "display_name": "Packaging List",
        "icon": "📦",
        "color": "#8b5cf6",
        "key_signals": ["packing list", "packaging list", "net weight", "gross weight", "carton", "package", "marks & numbers", "no. of packages", "dimensions"],
        "description": "Itemized list of packages, weights and contents",
    },
    "air_waybill": {
        "display_name": "Airway Bill (AWB)",
        "icon": "✈️",
        "color": "#06b6d4",
        "key_signals": ["air waybill", "awb", "mawb", "hawb", "airway bill", "iata", "shipper", "consignee", "flight no", "airport of departure", "airport of destination"],
        "description": "IATA air freight transport contract",
    },
    "bill_of_lading": {
        "display_name": "Bill of Lading",
        "icon": "🚢",
        "color": "#0ea5e9",
        "key_signals": ["bill of lading", "b/l", "hbl", "mbl", "obl", "vessel", "voyage", "port of loading", "port of discharge", "container", "shipper", "notify party"],
        "description": "Ocean freight transport contract and title document",
    },
    "certificate_of_origin": {
        "display_name": "Certificate of Origin",
        "icon": "📜",
        "color": "#10b981",
        "key_signals": ["certificate of origin", "form a", "gsp", "country of origin", "preferential", "authorised body", "chamber of commerce"],
        "description": "Certifies the country where goods were manufactured",
    },
    "letter_of_credit": {
        "display_name": "Letter of Credit",
        "icon": "🏦",
        "color": "#f59e0b",
        "key_signals": ["letter of credit", "documentary credit", "lc no", "issuing bank", "beneficiary", "applicant", "irrevocable", "swift", "documents required"],
        "description": "Bank guarantee for international payment",
    },
    "purchase_order": {
        "display_name": "Purchase Order",
        "icon": "🛒",
        "color": "#a78bfa",
        "key_signals": ["purchase order", "p.o. no", "po number", "order date", "delivery date", "buyer", "vendor", "payment terms"],
        "description": "Buyer's official order to supplier",
    },
    "proforma_invoice": {
        "display_name": "Proforma Invoice",
        "icon": "📋",
        "color": "#64748b",
        "key_signals": ["proforma", "pro-forma", "quotation", "pi no", "subject to change", "validity", "advance payment"],
        "description": "Pre-shipment quote or preliminary invoice",
    },
    "customs_declaration": {
        "display_name": "Customs Declaration",
        "icon": "🛃",
        "color": "#ef4444",
        "key_signals": ["shipping bill", "bill of entry", "igm", "egm", "sb no", "be no", "customs", "icegate", "port code", "cha", "iec"],
        "description": "Indian customs import/export declaration",
    },
    "unknown": {
        "display_name": "Unknown Document",
        "icon": "❓",
        "color": "#64748b",
        "key_signals": [],
        "description": "Document type could not be determined",
    },
}

DETECT_PROMPT = """Classify this document as exactly ONE of:
- commercial_invoice (has Invoice No/Number, seller to buyer, amount due, GST)
- packing_list (has net weight, gross weight, cartons, dimensions)
- air_waybill (has AWB, flight number, airport departure/destination)
- bill_of_lading (has B/L, vessel, port of loading/discharge, container)
- purchase_order (has P.O. number, buyer to vendor)
- proforma_invoice (has PI number, quotation, subject to change)
- certificate_of_origin (has country of origin, Form A, GSP)
- customs_declaration (has Shipping Bill, Bill of Entry, ICEGATE)
- letter_of_credit (has LC number, issuing bank, beneficiary)
- unknown

STRICT RULES:
- "Invoice No" or "Tax Invoice" = commercial_invoice (NOT purchase_order)
- "Purchase Order" or "P.O." = purchase_order (NOT commercial_invoice)
- "Packing List" = packing_list (NOT commercial_invoice)
- "Bill of Lading" or "B/L" = bill_of_lading
- "Air Waybill" or "AWB" = air_waybill

Return JSON:
{"document_type": "commercial_invoice", "confidence": 0.9, "signals": ["invoice no"], "reasoning": "found invoice number with seller and amount"}

Document text (first 3000 chars):
{text}

Return ONLY JSON."""


def detect_document_type(ocr_text: str, openai_client) -> Dict[str, Any]:
    """
    Classify a trade document from its OCR text.

    Parameters
    ----------
    ocr_text      : Full OCR text from the document.
    openai_client : OpenAI client instance.

    Returns
    -------
    dict with keys: document_type, display_name, icon, color, confidence,
                    signals, reasoning, description
    """
    default = _unknown_result()

    if not ocr_text or len(ocr_text.strip()) < 30:
        logger.warning("[DocType] OCR text too short to classify.")
        return default

    # ── Fast heuristic pass (keyword matching) ────────────────────────────────
    heuristic = _heuristic_detect(ocr_text)
    if heuristic and heuristic["confidence"] >= 0.85:
        logger.info(
            "[DocType] Heuristic detected: %s (%.2f)",
            heuristic["document_type"], heuristic["confidence"]
        )
        return heuristic

    # ── GPT-4o-mini classification ────────────────────────────────────────────
    try:
        prompt = DETECT_PROMPT.replace("{text}", ocr_text[:3000])
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=256,
        )
        raw = json.loads(resp.choices[0].message.content)
        doc_type = raw.get("document_type", "unknown").lower().strip()

        # Validate the returned type
        if doc_type not in DOCUMENT_TYPES:
            doc_type = "unknown"

        meta = DOCUMENT_TYPES[doc_type]
        result = {
            "document_type":   doc_type,
            "display_name":    meta["display_name"],
            "icon":            meta["icon"],
            "color":           meta["color"],
            "confidence":      round(float(raw.get("confidence", 0.5)), 3),
            "signals":         raw.get("signals", [])[:8],
            "reasoning":       raw.get("reasoning", ""),
            "description":     meta["description"],
        }
        logger.info(
            "[DocType] GPT detected: %s (%.2f) — %s",
            doc_type, result["confidence"], result["reasoning"]
        )
        return result

    except Exception as exc:
        logger.error("[DocType] GPT classification failed: %s", exc)
        # Fall back to heuristic result even if low confidence, or unknown
        return heuristic or default


def _heuristic_detect(text: str) -> Optional[Dict[str, Any]]:
    """
    Fast keyword-based pre-classification.
    Returns a result dict if confident enough (>= 0.70), else None.
    Enhanced with more keywords and flexible matching.
    """
    text_lower = text.lower()

    def regex_hits(patterns):
        hits = []
        for p in patterns:
            if re.search(p, text_lower, flags=re.IGNORECASE | re.MULTILINE):
                hits.append(p)
        return hits
    
    # Check for partial word boundaries - ensures "invoice" doesn't match "invoiced"
    def has_keyword(keyword):
        if keyword in text_lower:
            return True
        # Also check with word boundaries for short keywords
        return f" {keyword} " in text_lower or f" {keyword}" in text_lower or f"{keyword} " in text_lower

    awb_anchor_keywords = [
        "air waybill", "airway bill", "awb no", "awb number", "mawb", "hawb",
        "iata", "flight no", "flight number", "airport of departure", "airport of destination",
    ]
    bl_anchor_keywords = [
        "bill of lading", "b/l no", "bl no", "hbl no", "mbl no", "obl no",
        "vessel name", "vessel voyage", "container number", "sea freight", "ocean freight",
    ]

    # High-precision header/anchor regexes. These beat plain keyword matching.
    awb_regex = [
        r"\bair\s*way\s*bill\b",
        r"\bairway\s*bill\b",
        r"\bmawb\b|\bhawb\b",
        r"\bawb\s*(no|number|#)\b",
        r"\biata\b",
    ]
    bl_regex = [
        r"\bbill\s*of\s*lading\b",
        r"\bb/?l\s*(no|number|#)\b",
        r"\bhbl\b|\bmbl\b|\bobl\b",
        r"\bvessel\b.*\bvoyage\b|\bvoyage\b.*\bvessel\b",
    ]
    packing_regex = [
        r"\bpacking\s*list\b|\bpackaging\s*list\b|\bpack\s*list\b",
        r"\b(no\.?\s*of\s*packages?|number\s*of\s*packages?)\b",
        r"\bgross\s*weight\b|\bnet\s*weight\b",
        r"\bmarks?\s*(and|&)\s*numbers?\b",
    ]
    commercial_invoice_regex = [
        r"\bcommercial\s*invoice\b|\btax\s*invoice\b",
        r"\binvoice\s*(no|number|#)\b",
        r"\btotal\s*(invoice\s*)?(amount|value)\b|\bgrand\s*total\b",
    ]
    purchase_order_regex = [
        r"\bpurchase\s*order\b",
        r"\bp\.?\s*o\.?\s*(no|number|#)\b|\bpo\s*(no|number|#)\b",
    ]

    # Strong deterministic anchors first.
    awb_anchor_hits = regex_hits(awb_regex)
    bl_anchor_hits = regex_hits(bl_regex)
    packing_anchor_hits = regex_hits(packing_regex)
    invoice_anchor_hits = regex_hits(commercial_invoice_regex)
    po_anchor_hits = regex_hits(purchase_order_regex)

    # IMPORTANT: Invoice anchor should take precedence over packing list
    # when both appear in the document (combined invoice+packing list)
    if invoice_anchor_hits and len(invoice_anchor_hits) >= 1:
        # Even if packing list anchors exist, invoice should win
        meta = DOCUMENT_TYPES["commercial_invoice"]
        return {
            "document_type": "commercial_invoice",
            "display_name": meta["display_name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "confidence": 0.90,
            "signals": ["invoice_anchor_regex"],
            "reasoning": "Heuristic: strong invoice anchor patterns detected.",
            "description": meta["description"],
        }

    if awb_anchor_hits and len(awb_anchor_hits) >= max(2, len(bl_anchor_hits) + 1):
        meta = DOCUMENT_TYPES["air_waybill"]
        return {
            "document_type": "air_waybill",
            "display_name": meta["display_name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "confidence": 0.93,
            "signals": ["awb_anchor_regex"],
            "reasoning": "Heuristic: strong AWB anchor patterns detected.",
            "description": meta["description"],
        }

    if bl_anchor_hits and len(bl_anchor_hits) >= max(2, len(awb_anchor_hits) + 1):
        meta = DOCUMENT_TYPES["bill_of_lading"]
        return {
            "document_type": "bill_of_lading",
            "display_name": meta["display_name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "confidence": 0.93,
            "signals": ["bl_anchor_regex"],
            "reasoning": "Heuristic: strong Bill of Lading anchor patterns detected.",
            "description": meta["description"],
        }

    # Only detect packing_list if there's NO invoice evidence at all
    if packing_anchor_hits and len(packing_anchor_hits) >= 2 and not invoice_anchor_hits:
        meta = DOCUMENT_TYPES["packing_list"]
        return {
            "document_type": "packing_list",
            "display_name": meta["display_name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "confidence": 0.90,
            "signals": ["packing_anchor_regex"],
            "reasoning": "Heuristic: strong packing-list anchor patterns detected.",
            "description": meta["description"],
        }

    if po_anchor_hits and len(po_anchor_hits) >= 1 and not invoice_anchor_hits:
        meta = DOCUMENT_TYPES["purchase_order"]
        return {
            "document_type": "purchase_order",
            "display_name": meta["display_name"],
            "icon": meta["icon"],
            "color": meta["color"],
            "confidence": 0.88,
            "signals": ["po_anchor_regex"],
            "reasoning": "Heuristic: purchase-order anchors detected.",
            "description": meta["description"],
        }

    # Priority order: check more specific document types first
    # IMPORTANT: commercial_invoice MUST come BEFORE packing_list to handle
    # combined invoice+packing-list documents where both keywords appear
    checks = [
        # Invoice first (higher priority for documents with both invoice and packing list sections)
        ("commercial_invoice", [
            "invoice no", "invoice number", "invoice no.", "invoice #", "inv no", "inv no.",
            "commercial invoice", "tax invoice", "tax invoice no", "sales invoice",
            "total amount", "total value", "amount due", "subtotal", "grand total",
            "unit price", "unit rate", "hs code", "hsn code", "taxable value",
            "igst", "cgst", "sgst", "gst amount", "bank name", "bank details",
            "seller", "seller address", "exporter", "exporter address", "buyer", "buyer address"
        ], 0.85),
        # Transport docs first (unique keywords)
        ("air_waybill", [
            "air waybill", "airway bill", "air way bill", "awb no", "awb number", 
            "mawb", "hawb", "iata", "master air waybill", "house air waybill",
            "air freight", "air cargo", "airlines", "awb", "airbill"
        ], 0.90),
        # Bill of Lading - require more specific B/L keywords (not just any "port" or "shipper")
        ("bill_of_lading", [
            "bill of lading", "b/l no", "bl no", "hbl no", "mbl no", "obl no",
            "hbl no", "mbl no", "obl no", "vessel name", "vessel voyage",
            "port of loading", "port of discharge", "port of destination",
            "notify party", "container number", "sea freight", "b/l",
            "house bill", "master bill"
        ], 0.90),
        # Packing list AFTER invoice to avoid false positives on combined docs
        ("packing_list", [
            "packing list", "packinglist", "packaging list", "pack list",
            "net weight", "gross weight", "net wt", "gross wt", 
            "no. of cartons", "no of cartons", "cartons", "packages",
            "dimensions", "measurement", "weight list", "case no"
        ], 0.80),
        # Purchase order AFTER invoice check
        ("purchase_order", [
            "purchase order", "p.o. no", "p.o no", "po number", "po no",
            "buyer's order", "order number", "order no"
        ], 0.80),
        # Proforma invoice - check before other types
        ("proforma_invoice", [
            "proforma invoice", "pro forma invoice", "proforma", "pi no", "pi number",
            "quotation no", "quote no"
        ], 0.75),
    ]

    for doc_type, keywords, base_confidence in checks:
        hits = [kw for kw in keywords if has_keyword(kw)]
        if len(hits) >= 1:
            # Guardrail: AWB signals should suppress a BL heuristic match unless BL evidence is clearly stronger.
            if doc_type == "bill_of_lading":
                awb_anchors = sum(1 for kw in awb_anchor_keywords if has_keyword(kw))
                bl_anchors = sum(1 for kw in bl_anchor_keywords if has_keyword(kw))
                if awb_anchors >= 1 and bl_anchors < 2:
                    continue
            # Guardrail: packing list signals should NOT suppress invoice detection
            # when there's clear "Commercial Invoice" header - this is a combined invoice+packing
            # The commercial_invoice keywords should take precedence
            if doc_type == "commercial_invoice":
                # Commercial invoice should always win if "invoice" is in the header
                if has_keyword("commercial invoice") or has_keyword("tax invoice") or has_keyword("invoice number"):
                    pass  # Always allow - do not skip
                else:
                    # For other cases, still check packing list presence
                    packing_hits = sum(
                        1 for kw in ("packing list", "packaging list", "gross weight", "net weight", "no. of cartons")
                        if has_keyword(kw)
                    )
                    invoice_hits = sum(
                        1 for kw in ("invoice number", "invoice no", "total amount", "total value")
                        if has_keyword(kw)
                    )
                    if packing_hits >= 3 and invoice_hits < 2:
                        continue

            # Higher confidence for more specific document types with single strong keyword
            if doc_type in ("air_waybill", "bill_of_lading") and any(k in text_lower for k in keywords[:5]):
                confidence = 0.90
            elif len(hits) >= 2:
                confidence = min(base_confidence + 0.05 * (len(hits) - 1), 0.95)
            else:
                confidence = base_confidence  # Single keyword match - use base confidence
            meta = DOCUMENT_TYPES[doc_type]
            return {
                "document_type": doc_type,
                "display_name":  meta["display_name"],
                "icon":          meta["icon"],
                "color":         meta["color"],
                "confidence":    round(confidence, 3),
                "signals":       hits,
                "reasoning":     f"Heuristic: found {len(hits)} keyword(s): {', '.join(hits[:4])}",
                "description":   meta["description"],
            }

    return None


def _unknown_result() -> Dict[str, Any]:
    meta = DOCUMENT_TYPES["unknown"]
    return {
        "document_type": "unknown",
        "display_name":  meta["display_name"],
        "icon":          meta["icon"],
        "color":         meta["color"],
        "confidence":    0.0,
        "signals":       [],
        "reasoning":     "Insufficient text to classify.",
        "description":   meta["description"],
    }


def get_type_meta(document_type: str) -> Dict[str, Any]:
    """Return display metadata for a document type string."""
    return DOCUMENT_TYPES.get(document_type, DOCUMENT_TYPES["unknown"])
