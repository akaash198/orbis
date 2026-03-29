"""
M03 Post-Processor — Trade control rule engine.

Validates every HSN prediction against:
  1. SCOMET (Special Chemicals, Organisms, Materials, Equipment & Technologies)
     — India's dual-use / strategic goods export control list (DGFT)
  2. Anti-dumping / countervailing / safeguard duty alerts
  3. Country-of-origin restrictions (BIS certification, FTA considerations)
  4. Chapter notes cross-checks (basic sanity guards)

This is a deterministic rule layer — no AI involved here.
All flags are informational; the routing decision is made by the LangGraph agent.
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── SCOMET Schedule B (illustrative subset — full list has 450+ entries) ──────
# Source: DGFT Appendix 3 to Schedule 2 of ITC(HS)
SCOMET_CHAPTERS = {
    1, 2, 3, 5,              # Live animals, meat, fish (biological)
    6, 7, 8, 9, 10, 12, 13, # Plants, seeds (biological agents)
    28, 29, 30, 31,          # Inorganic/organic chemicals, explosives precursors
    36, 37, 38, 39,          # Explosives, photographic, misc chemicals, plastics
    71, 72, 73, 74, 75, 76,  # Precious metals, steel, copper, nickel, aluminium
    82, 84, 85, 86, 87, 88,  # Machinery, electrical, railway, vehicles, aircraft
    89, 90, 91, 93,          # Ships, optical/medical, clocks, arms & ammunition
}

# Specific HSN prefixes that are SCOMET Schedule 1 (highest control)
SCOMET_S1_PREFIXES = {
    "2844", "2845",  # Radioactive elements
    "9301", "9302", "9303", "9304", "9305", "9306",  # Arms & ammunition
    "8802",  # Aircraft (military spec)
}

# ── Trade remedy alerts (BCD + ADD/CVD/SG duties) ────────────────────────────
# Source: CBIC notifications (illustrative)
TRADE_REMEDY_MAP: Dict[str, str] = {
    "72": "Anti-dumping duty (ADD) applicable on certain steel products; verify country of origin against CBIC notification.",
    "73": "ADD applicable on certain steel articles from China, Korea, EU.",
    "85": "Safeguard duty on solar cells/modules (HSN 8541); BIS registration mandatory for electrical goods.",
    "39": "ADD on PET resin (3907) from certain countries. CVD on polyester yarn.",
    "54": "ADD on nylon filament yarn from China and Taiwan.",
    "55": "ADD on viscose staple fibre from China and Indonesia.",
    "87": "EV import duty: 100% BCD on CBU electric vehicles. FAME subsidy not applicable on imports.",
    "29": "ADD on several organic chemicals; verify HS sub-heading against DGTR findings.",
}

# ── Country-of-origin restrictions ───────────────────────────────────────────
# Format: {hsn_2digit_prefix: [(country_iso2, alert_message), ...]}
COUNTRY_RESTRICTIONS: Dict[str, List[tuple]] = {
    "85": [
        ("CN", "BIS compulsory certification required for electrical/electronic goods from China under Electronics & IT Goods Order 2012."),
        ("HK", "BIS certification required; HSN subject to CAROTAR origin verification."),
    ],
    "87": [
        ("CN", "Additional import duty 15% on EVs/vehicles; CAROTAR rules of origin apply."),
    ],
    "84": [
        ("CN", "CAROTAR origin verification required; potential ADD on compressors (8414)."),
    ],
    "90": [
        ("CN", "Quality Control Order (QCO) applies to optical instruments; BIS/BEE may apply."),
    ],
}


def post_process(
    predictions: List[Dict[str, Any]],
    country_of_origin: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Apply rule-based trade-control checks to LLM predictions.

    Parameters
    ----------
    predictions         : top3 list from LLM classifier
    country_of_origin   : ISO-2 or full country name (optional)

    Returns
    -------
    {
      predictions: enriched list,
      scomet_flag: bool,
      trade_remedy_alert: bool,
      restricted_countries: list of alert dicts
    }
    """
    scomet_flag          = False
    trade_remedy_alert   = False
    country_alerts: List[Dict[str, Any]] = []
    coo = (country_of_origin or "").upper().strip()

    for pred in predictions:
        hsn = str(pred.get("hsn_code", "")).strip().replace(".", "")
        if not hsn or len(hsn) < 2:
            continue
        pred["hsn_code"] = hsn   # write normalised (dot-free) code back into the prediction dict

        chapter   = int(hsn[:2]) if hsn[:2].isdigit() else 0
        prefix2   = hsn[:2]
        prefix4   = hsn[:4]

        # ── SCOMET check ──────────────────────────────────────────────────────
        is_scomet = chapter in SCOMET_CHAPTERS
        is_scomet_s1 = any(hsn.startswith(p) for p in SCOMET_S1_PREFIXES)

        if is_scomet_s1:
            scomet_flag = True
            pred["scomet_controlled"] = True
            pred["scomet_schedule"]   = "Schedule 1 (highest control)"
            pred["scomet_note"] = (
                f"HSN {hsn} is under SCOMET Schedule 1. "
                "Mandatory DGFT licence required for export. "
                "Contact SCOMET Division, Ministry of Commerce before shipment."
            )
        elif is_scomet:
            scomet_flag = True
            pred["scomet_controlled"] = True
            pred["scomet_schedule"]   = "Schedule 2 / Trigger list"
            pred["scomet_note"] = (
                f"Chapter {chapter:02d} falls under SCOMET control. "
                "Verify specific HSN against DGFT Appendix-3 Schedule-2. "
                "End-user certificate may be required."
            )
        else:
            pred["scomet_controlled"] = False

        # ── Trade remedy check ────────────────────────────────────────────────
        if prefix2 in TRADE_REMEDY_MAP:
            trade_remedy_alert = True
            pred["trade_remedy_note"] = TRADE_REMEDY_MAP[prefix2]

        # ── Country-of-origin restriction check ───────────────────────────────
        if coo and prefix2 in COUNTRY_RESTRICTIONS:
            for (restricted_iso, alert_msg) in COUNTRY_RESTRICTIONS[prefix2]:
                if restricted_iso in coo or coo in restricted_iso:
                    country_alerts.append({
                        "hsn":     hsn,
                        "country": country_of_origin,
                        "note":    alert_msg,
                    })

    logger.info(
        "Post-processor: scomet=%s, trade_remedy=%s, country_alerts=%d",
        scomet_flag, trade_remedy_alert, len(country_alerts),
    )

    return {
        "predictions":          predictions,
        "scomet_flag":          scomet_flag,
        "trade_remedy_alert":   trade_remedy_alert,
        "restricted_countries": country_alerts,
    }
