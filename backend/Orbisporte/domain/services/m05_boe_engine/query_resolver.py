"""
M05 — LLM Query Resolution Drafter  (SOP BOE-005)
==================================================
When ICEGATE raises a customs query on a filed BoE, this module uses
GPT-4o-mini to draft a professional reply letter that the importer /
clearing agent can review, edit, and send back to the customs officer.

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

_SYSTEM_PROMPT = """You are an expert Indian customs clearing agent with 20+ years of experience
handling ICEGATE queries and customs disputes. Your task is to draft a professional, factually
accurate response to a customs officer's query regarding a Bill of Entry.

Guidelines:
- Be concise, professional, and legally precise
- Reference specific Indian customs regulations (Customs Act 1962, IGCR, FTP) where applicable
- Structure: (1) Acknowledgement, (2) Clarification / Explanation, (3) Supporting documents offered, (4) Request for clearance
- Always maintain a respectful tone toward the customs officer
- Never admit wrongdoing unless the error is factual and correctable
- Output plain text only — no markdown, no bullets"""


def draft_query_response(
    query_text: str,
    boe_fields: Dict[str, Any],
    line_items: list[Dict[str, Any]],
    additional_context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Draft an ICEGATE query response using GPT-4o-mini.

    Parameters
    ----------
    query_text         : The raw query text received from ICEGATE / customs officer
    boe_fields         : Header-level BoE fields (importer name, IEC, BoE number, etc.)
    line_items         : Line items (description, HSN, value, etc.)
    additional_context : Any extra context the user provides about the shipment

    Returns
    -------
    {
      "draft"        : str  — drafted reply letter,
      "model"        : str  — model name used,
      "prompt_tokens": int,
      "success"      : bool,
      "error"        : str | None,
    }
    """
    if not _OPENAI_API_KEY:
        return _rule_based_draft(query_text, boe_fields)

    # ── Build user message ────────────────────────────────────────────────────
    item_summary = "\n".join(
        f"  Line {i+1}: {item.get('description_of_goods') or item.get('product_description', 'N/A')} | "
        f"HSN {item.get('hsn_code', 'N/A')} | Qty {item.get('quantity', 'N/A')} "
        f"{item.get('unit', '')} | CIF ₹{item.get('custom_value_inr') or item.get('assessable_value', 'N/A')}"
        for i, item in enumerate(line_items)
    )

    user_message = f"""
CUSTOMS QUERY RECEIVED:
{query_text}

BILL OF ENTRY DETAILS:
  BoE Number    : {boe_fields.get('boe_number', 'N/A')}
  Date of Filing: {boe_fields.get('date_of_filing', 'N/A')}
  Port          : {boe_fields.get('port_of_import', 'N/A')}
  Importer      : {boe_fields.get('importer_name', 'N/A')}
  IEC           : {boe_fields.get('importer_iec', 'N/A')}
  Bill of Lading: {boe_fields.get('bill_of_lading_number', 'N/A')}
  Country of Origin: {boe_fields.get('country_of_origin', 'N/A')}
  Total CIF Value (INR): {boe_fields.get('custom_value_inr', 'N/A')}
  Total Duty (INR): {boe_fields.get('custom_duty', 'N/A')}

LINE ITEMS:
{item_summary}

{f'ADDITIONAL CONTEXT FROM IMPORTER: {additional_context}' if additional_context else ''}

Draft a professional reply to the above customs query. Address each concern raised specifically.
""".strip()

    try:
        from openai import OpenAI
        client = OpenAI(api_key=_OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        draft = response.choices[0].message.content.strip()
        usage = response.usage
        logger.info("[M05 QueryResolver] Draft generated | tokens: %s", usage.total_tokens)
        return {
            "draft": draft,
            "model": "gpt-4o-mini",
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "success": True,
            "error": None,
        }
    except Exception as exc:
        logger.error("[M05 QueryResolver] GPT call failed: %s — using rule-based fallback", exc)
        result = _rule_based_draft(query_text, boe_fields)
        result["error"] = f"LLM unavailable ({exc}); rule-based draft provided"
        return result


def _rule_based_draft(query_text: str, boe_fields: Dict[str, Any]) -> Dict[str, Any]:
    """Minimal rule-based fallback draft when OpenAI is unavailable."""
    boe_num = boe_fields.get("boe_number", "N/A")
    importer = boe_fields.get("importer_name", "the importer")
    iec = boe_fields.get("importer_iec", "N/A")

    draft = (
        f"To,\nThe Appraising Officer,\nCustoms Department\n\n"
        f"Subject: Response to Query on Bill of Entry No. {boe_num}\n\n"
        f"Dear Sir/Madam,\n\n"
        f"We, {importer} (IEC: {iec}), acknowledge receipt of your query dated today "
        f"regarding Bill of Entry No. {boe_num}.\n\n"
        f"In response to the query:\n\n"
        f"\"{query_text}\"\n\n"
        f"We wish to clarify that all declared values, descriptions, and classifications "
        f"are accurate and compliant with the Customs Act, 1962 and the Customs Tariff Act, 1975. "
        f"We are prepared to furnish all supporting documents including commercial invoice, "
        f"packing list, bill of lading, and certificate of origin for your perusal.\n\n"
        f"We request you to kindly proceed with the assessment and clearance of the subject consignment "
        f"at the earliest.\n\n"
        f"Thanking you,\n\nYours faithfully,\n{importer}\nIEC: {iec}"
    )

    return {
        "draft": draft,
        "model": "rule_based",
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "success": True,
        "error": None,
    }
