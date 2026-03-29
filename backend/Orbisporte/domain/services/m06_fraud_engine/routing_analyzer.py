"""
Routing Anomaly Analyser  (SOP FRAUD-006 — part 2)
===================================================
Detects:
  1. Country-of-origin fraud   — goods from a sanctioned / high-duty country
     declared as originating in a third country to misuse FTA benefits
  2. Transshipment routing fraud — unusual routing via a third country that
     acts as a "laundry" for origin

Algorithm
---------
- Bilateral trade suspicion matrix: certain (COO, transit) pairs are
  known fraud vectors (e.g. China goods routed via Vietnam/Malaysia to
  claim ASEAN FTA origin)
- Geographic detour score: if port-of-shipment country is not adjacent to
  declared COO, and the route adds >2 hops of ocean distance, flag it
- Sanctions / high-duty country list: goods from restricted origins
  almost always see routing fraud

Shortest-path scoring
---------------------
We maintain a lightweight country adjacency / trade-route graph.
A suspiciously long route (> direct + 1 hop) raises the anomaly score.

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# ── Countries under active import restrictions / high-duty or sanctioned ─────
_RESTRICTED_ORIGINS: Set[str] = {
    "PRK",  # North Korea — UN sanctions
    "IRN",  # Iran — FATF + OFAC
    "SYR",  # Syria — OFAC
    "RUS",  # Russia — post-2022 restrictions
    "BLR",  # Belarus
    "CUB",  # Cuba — OFAC
    "MMR",  # Myanmar — FATF grey list
    "VEN",  # Venezuela — OFAC
}

# ── FTA benefit pairs: (actual_origin, declared_origin) → known fraud vector ─
# Declaring Chinese goods as Vietnamese to claim ASEAN FTA rate is the
# single most common origin fraud in Indian customs.
_KNOWN_FRAUD_VECTORS: Dict[Tuple[str, str], str] = {
    ("CHN", "VNM"): "China→Vietnam re-labelling for ASEAN FTA",
    ("CHN", "MYS"): "China→Malaysia re-labelling for ASEAN FTA",
    ("CHN", "THA"): "China→Thailand re-labelling for ASEAN FTA",
    ("CHN", "IDN"): "China→Indonesia re-labelling for ASEAN FTA",
    ("CHN", "KOR"): "China→South Korea re-labelling for CEPA",
    ("CHN", "SGP"): "China→Singapore re-labelling for CSFTA",
    ("IRN", "ARE"): "Iran→UAE re-labelling to bypass OFAC",
    ("PRK", "CHN"): "North Korea→China re-labelling to bypass UN sanctions",
    ("RUS", "TUR"): "Russia→Turkey re-labelling to bypass export controls",
    ("RUS", "ARE"): "Russia→UAE re-labelling to bypass export controls",
    ("CHN", "HKG"): "China→Hong Kong transshipment (duty evasion)",
    ("PAK", "ARE"): "Pakistan→UAE transshipment (misdeclaration of origin)",
}

# ── Country adjacency for routing graph ──────────────────────────────────────
# Simplified: maps ISO-3 → set of adjacent/common-route countries
_ADJACENT: Dict[str, Set[str]] = {
    "CHN": {"VNM", "MYS", "THA", "IDN", "KOR", "JPN", "HKG", "TWN", "SGP"},
    "VNM": {"CHN", "THA", "MYS", "SGP"},
    "IND": {"LKA", "BGD", "NPL", "PAK", "ARE", "SGP"},
    "ARE": {"IND", "PAK", "SAU", "OMN", "IRN"},
    "SGP": {"MYS", "IDN", "THA", "VNM", "CHN", "IND"},
    "DEU": {"NLD", "BEL", "FRA", "CHE", "POL", "AUT"},
    "USA": {"CAN", "MEX", "GBR", "DEU"},
    "GBR": {"USA", "DEU", "NLD", "BEL", "FRA"},
    "JPN": {"CHN", "KOR", "TWN", "SGP"},
    "KOR": {"CHN", "JPN", "SGP"},
    "TUR": {"RUS", "ARE", "DEU", "GBR", "BGR"},
    "MYS": {"SGP", "THA", "IDN", "CHN", "VNM"},
    "THA": {"MYS", "VNM", "CHN", "SGP", "IDN"},
    "IDN": {"MYS", "SGP", "AUS", "CHN"},
    "HKG": {"CHN"},
    "TWN": {"CHN", "JPN", "SGP"},
    "PAK": {"ARE", "CHN", "IND"},
    "BGD": {"IND", "SGP", "CHN"},
    "LKA": {"IND", "SGP", "ARE"},
    "AUS": {"IDN", "SGP", "USA"},
    "SAU": {"ARE", "EGY", "JOR"},
}

# Countries that are active FTA partners with India (COO fraud prime targets)
_INDIA_FTA_PARTNERS: Set[str] = {
    "LKA",  # ISFTA
    "NPL",  # SAFTA
    "BGD",  # SAFTA
    "PAK",  # SAFTA (suspended but declared)
    "MYS",  # ASEAN FTA
    "THA",  # ASEAN FTA
    "VNM",  # ASEAN FTA
    "IDN",  # ASEAN FTA
    "SGP",  # ASEAN FTA / CSFTA
    "KOR",  # CEPA
    "JPN",  # CEPA
    "ARE",  # under negotiation — sometimes misused
    "MUS",  # CECPA
}


def _hop_distance(origin: str, shipment_country: str) -> int:
    """
    Estimate routing hops between actual origin and port-of-shipment country.
    Returns 0 if same, 1 if adjacent, 2 if 1 intermediate, 3+ otherwise.
    """
    if origin == shipment_country:
        return 0
    if shipment_country in _ADJACENT.get(origin, set()):
        return 1
    # BFS one level deeper
    for neighbor in _ADJACENT.get(origin, set()):
        if shipment_country in _ADJACENT.get(neighbor, set()):
            return 2
    return 3


def analyse(
    country_of_origin: str,        # ISO-3 declared COO
    country_of_shipment: str,      # ISO-3 country of port-of-loading
    hsn_code: str,
    fta_claimed: bool = False,
) -> Dict[str, Any]:
    """
    Analyse routing for transshipment and COO fraud.

    Returns
    -------
    {
      "anomaly_score"        : float 0–100,
      "is_anomaly"           : bool,
      "fraud_types_detected" : [str],
      "evidence"             : [str],
      "hop_distance"         : int,
    }
    """
    coo = (country_of_origin or "").upper().strip()
    cos = (country_of_shipment or "").upper().strip()

    score = 0.0
    fraud_types: List[str] = []
    evidence: List[str] = []

    if not coo or not cos:
        return _null_result()

    # ── 1. Restricted origin ──────────────────────────────────────────────
    if coo in _RESTRICTED_ORIGINS:
        score += 50.0
        fraud_types.append("RESTRICTED_ORIGIN")
        evidence.append(
            f"Country of origin '{coo}' is on the restricted/sanctioned list — "
            "goods from this origin require enhanced scrutiny"
        )

    # ── 2. Known fraud vector ─────────────────────────────────────────────
    # Check if declared COO is the transit country (cos = actual origin, coo = declared)
    fraud_desc = _KNOWN_FRAUD_VECTORS.get((cos, coo))
    if fraud_desc:
        score += 55.0
        fraud_types.append("COUNTRY_OF_ORIGIN_FRAUD")
        evidence.append(
            f"Known fraud vector detected: {fraud_desc}. "
            f"Port-of-shipment country '{cos}' is a known transshipment hub "
            f"for goods actually originating from '{cos}' declared as '{coo}'"
        )

    # Also check reverse (actual journey)
    fraud_desc2 = _KNOWN_FRAUD_VECTORS.get((coo, cos))
    if fraud_desc2 and not fraud_desc:
        score += 30.0
        fraud_types.append("TRANSSHIPMENT_ROUTING_FRAUD")
        evidence.append(
            f"Routing anomaly: {fraud_desc2}. "
            f"Declared origin '{coo}' with shipment from '{cos}' is a common "
            "transshipment route used to obscure actual origin"
        )

    # ── 3. FTA misuse signal ──────────────────────────────────────────────
    if fta_claimed and coo in _INDIA_FTA_PARTNERS:
        # COO is an FTA partner but shipment is from elsewhere
        if cos != coo and cos not in _ADJACENT.get(coo, {coo}):
            score += 20.0
            fraud_types.append("FTA_MISUSE")
            evidence.append(
                f"FTA benefit claimed for origin '{coo}' but shipment is from "
                f"'{cos}' — goods may not satisfy Rules of Origin requirement"
            )

    # ── 4. Routing hop anomaly ────────────────────────────────────────────
    hops = _hop_distance(coo, cos)
    if hops >= 3:
        score += 25.0
        if "TRANSSHIPMENT_ROUTING_FRAUD" not in fraud_types:
            fraud_types.append("TRANSSHIPMENT_ROUTING_FRAUD")
        evidence.append(
            f"Unusual routing: {hops} hops between declared origin '{coo}' "
            f"and port-of-shipment country '{cos}' — not a typical trade route"
        )
    elif hops == 2 and coo in _RESTRICTED_ORIGINS:
        score += 15.0
        evidence.append(
            f"Two-hop routing from restricted origin '{coo}' via '{cos}' — "
            "possible attempt to obscure actual shipment origin"
        )

    return {
        "anomaly_score"        : round(min(score, 100.0), 1),
        "is_anomaly"           : score >= 30.0,
        "fraud_types_detected" : fraud_types,
        "evidence"             : evidence,
        "hop_distance"         : hops,
        "coo"                  : coo,
        "country_of_shipment"  : cos,
    }


def _null_result() -> Dict[str, Any]:
    return {
        "anomaly_score"        : 0.0,
        "is_anomaly"           : False,
        "fraud_types_detected" : [],
        "evidence"             : [],
        "hop_distance"         : 0,
    }
