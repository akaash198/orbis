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

DETECT_PROMPT = """You are an Indian customs document classification specialist.

Classify the trade document below into exactly ONE of these types:
- commercial_invoice
- packing_list
- air_waybill
- bill_of_lading
- certificate_of_origin
- letter_of_credit
- purchase_order
- proforma_invoice
- customs_declaration
- unknown

Return a JSON object with exactly these keys:
{
  "document_type": "<one of the types above>",
  "confidence": <float 0.0-1.0>,
  "signals": ["<text phrase that led you here>", ...],
  "reasoning": "<one sentence>"
}

Document text (first 3000 chars):
{text}

Return ONLY the JSON object."""


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
    Returns a result dict if confident enough (>= 0.75), else None.
    """
    text_lower = text.lower()

    # Ordered by specificity — most specific patterns first
    checks = [
        ("air_waybill",          ["air waybill", "airway bill", "awb no", "mawb", "hawb", "iata"]),
        ("bill_of_lading",       ["bill of lading", "b/l no", "bl no", "hbl", "mbl", "obl", "vessel name", "port of discharge"]),
        ("certificate_of_origin",["certificate of origin", "form a", "gsp certificate", "country of origin"]),
        ("letter_of_credit",     ["letter of credit", "documentary credit", "lc number", "issuing bank", "swift code"]),
        ("customs_declaration",  ["shipping bill", "bill of entry", "igm number", "egm number", "icegate"]),
        ("packing_list",         ["packing list", "net weight", "gross weight", "no. of cartons", "packages"]),
        ("purchase_order",       ["purchase order", "p.o. number", "po number", "order number"]),
        ("proforma_invoice",     ["proforma invoice", "pro forma invoice", "pi number", "quotation no"]),
        ("commercial_invoice",   ["commercial invoice", "invoice no", "invoice number", "invoice date"]),
    ]

    for doc_type, keywords in checks:
        hits = [kw for kw in keywords if kw in text_lower]
        if len(hits) >= 2:
            confidence = min(0.75 + 0.05 * (len(hits) - 2), 0.95)
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
