"""
Sequential Pattern Miner  (SOP FRAUD-004)
=========================================
Detects:
  1. HSN manipulation  — an importer repeatedly switches the HSN code for
     the same product across shipments to find the lowest-duty code
  2. Split shipment fraud — a single large consignment is artificially
     divided into many smaller ones to stay below scrutiny thresholds
  3. Sudden trade pattern change — abrupt spike/drop in shipment volume
     or value inconsistent with historical behaviour

Why PrefixSpan?
---------------
PrefixSpan is an efficient sequential pattern mining algorithm that finds
frequent subsequences in ordered lists.  In trade fraud:
  - Input: importer's HSN code sequence across shipments (time-ordered)
  - Pattern: "8517→8504→8473→8517" (LED product classified under 4 different
    headings) → strong HSN manipulation signal
  - PrefixSpan finds these repeating patterns without requiring brute-force
    enumeration of all possible subsequences.

Fallback: Rule-based variance analysis when PrefixSpan unavailable.

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Optional PrefixSpan
try:
    from prefixspan import PrefixSpan as _PrefixSpan
    _PREFIXSPAN_AVAILABLE = True
except ImportError:
    _PREFIXSPAN_AVAILABLE = False
    logger.warning("[PatternMiner] prefixspan not found — using entropy-based fallback")

# Thresholds
_MIN_SEQUENCES_FOR_PATTERN   = 5   # min shipments before pattern analysis is meaningful
_HSN_MANIPULATION_MIN_UNIQUE = 3   # ≥3 different 4-digit prefixes for same product = suspicious
_SPLIT_SHIPMENT_WINDOW_DAYS  = 14  # days window for split shipment detection
_SPLIT_SHIPMENT_MIN_COUNT    = 3   # ≥3 shipments in window to same importer → flag
_TEMPORAL_CHANGE_Z_THRESHOLD = 2.5 # z-score threshold for sudden pattern change


# =============================================================================
# HSN Manipulation Detection
# =============================================================================

def detect_hsn_manipulation(
    shipment_history: List[Dict[str, Any]],
    importer_iec: str,
) -> Dict[str, Any]:
    """
    Detect systematic HSN code switching across an importer's shipment history.

    Parameters
    ----------
    shipment_history : time-ordered list of past shipments for this importer.
                       Each dict must have 'hsn_code', 'description_of_goods',
                       'cif_value_inr', 'arrival_date'.
    importer_iec     : IEC of the importer being analysed.

    Returns
    -------
    {
      "anomaly_score"   : float 0–100,
      "is_anomaly"      : bool,
      "frequent_patterns": [{"sequence": [...], "support": int}],
      "unique_hsn_4d"   : int,
      "evidence"        : [str],
    }
    """
    if len(shipment_history) < _MIN_SEQUENCES_FOR_PATTERN:
        return _null_hsn_result(len(shipment_history))

    # Build HSN-4 sequences (4-digit tariff chapter prefix)
    sequences = [
        [str(s.get("hsn_code") or "")[:4] for s in shipment_history
         if s.get("hsn_code")]
    ]
    # Also build per-description sequences (group by similar goods)
    desc_groups: Dict[str, List[str]] = defaultdict(list)
    for s in shipment_history:
        hsn4 = str(s.get("hsn_code") or "")[:4]
        desc = str(s.get("description_of_goods") or s.get("product_description") or "")
        # Use first 20 chars as a rough product grouping key
        key = desc.strip().upper()[:20]
        if key and hsn4:
            desc_groups[key].append(hsn4)

    # Find products with multiple HSN codes → manipulation signal
    multi_hsn_products: List[str] = []
    for desc_key, hsns in desc_groups.items():
        unique_hsns = set(hsns)
        if len(unique_hsns) >= _HSN_MANIPULATION_MIN_UNIQUE:
            multi_hsn_products.append(
                f"'{desc_key[:30]}' classified under {len(unique_hsns)} different HSN codes: "
                f"{', '.join(sorted(unique_hsns))}"
            )

    # PrefixSpan on full sequence
    frequent_patterns: List[Dict[str, Any]] = []
    if _PREFIXSPAN_AVAILABLE:
        frequent_patterns = _run_prefixspan(sequences, min_support=2)
    else:
        frequent_patterns = _entropy_patterns(sequences[0])

    # Count unique 4-digit HSN chapters used
    all_hsn4 = [h for seq in sequences for h in seq if h]
    unique_hsn4 = len(set(all_hsn4))

    # Score
    score = 0.0
    evidence: List[str] = []

    for product_evidence in multi_hsn_products:
        score += 25.0
        evidence.append(f"HSN manipulation: {product_evidence}")

    # Frequent pattern with alternating HSN codes
    for pat in frequent_patterns:
        seq = pat.get("sequence", [])
        if len(set(seq)) >= 2 and len(seq) >= 3:
            score += 15.0
            evidence.append(
                f"Repeating HSN switching pattern detected: "
                f"{' → '.join(seq[:5])} (support={pat['support']} shipments)"
            )
            break

    if unique_hsn4 >= 5 and len(shipment_history) <= 10:
        score += 20.0
        evidence.append(
            f"Importer used {unique_hsn4} different 4-digit HSN headings "
            f"across only {len(shipment_history)} shipments — unusually diverse classification"
        )

    return {
        "anomaly_score"     : round(min(score, 100.0), 1),
        "is_anomaly"        : score >= 25.0,
        "frequent_patterns" : frequent_patterns[:5],
        "unique_hsn_4d"     : unique_hsn4,
        "evidence"          : evidence,
    }


def _run_prefixspan(
    sequences: List[List[str]],
    min_support: int = 2,
) -> List[Dict[str, Any]]:
    """Wrap PrefixSpan and return top patterns."""
    try:
        ps = _PrefixSpan(sequences)
        results = ps.frequent(min_support)
        return [
            {"sequence": list(seq), "support": int(sup)}
            for sup, seq in sorted(results, key=lambda x: -x[0])[:10]
            if len(seq) >= 2
        ]
    except Exception as exc:
        logger.warning("[PatternMiner] PrefixSpan error: %s", exc)
        return []


def _entropy_patterns(sequence: List[str]) -> List[Dict[str, Any]]:
    """
    Fallback: find repeating 2-grams (bigrams) in the HSN sequence.
    High frequency of different consecutive-pair transitions = manipulation.
    """
    bigrams = list(zip(sequence, sequence[1:]))
    counts = Counter(bigrams)
    return [
        {"sequence": list(bigram), "support": int(count)}
        for bigram, count in counts.most_common(5)
        if count >= 2
    ]


def _null_hsn_result(n: int) -> Dict[str, Any]:
    return {
        "anomaly_score"     : 0.0,
        "is_anomaly"        : False,
        "frequent_patterns" : [],
        "unique_hsn_4d"     : 0,
        "evidence"          : [f"Insufficient history ({n} shipments) for pattern analysis"],
    }


# =============================================================================
# Split Shipment Detection
# =============================================================================

def detect_split_shipments(
    recent_shipments: List[Dict[str, Any]],
    current_tx: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Detect if a large consignment has been artificially split.

    Looks for: same importer + same exporter + same HSN × multiple shipments
    within a short window with total value > single-shipment would attract.

    Parameters
    ----------
    recent_shipments : recent transactions for same importer (last 60 days)
    current_tx       : the transaction being analysed

    Returns
    -------
    {
      "anomaly_score"   : float 0–100,
      "is_anomaly"      : bool,
      "split_group_count": int,
      "combined_value"  : float,
      "evidence"        : [str],
    }
    """
    iec = str(current_tx.get("importer_iec") or "")
    exp_name = str(current_tx.get("exporter_name") or "").upper()
    hsn4 = str(current_tx.get("hsn_code") or "")[:4]

    if not iec or not hsn4:
        return {"anomaly_score": 0.0, "is_anomaly": False, "split_group_count": 0,
                "combined_value": 0.0, "evidence": []}

    # Filter for same exporter + same HSN within window
    same_group = [
        t for t in recent_shipments
        if str(t.get("importer_iec") or "") == iec
        and str(t.get("hsn_code") or "")[:4] == hsn4
        and str(t.get("exporter_name") or "").upper() == exp_name
    ]
    same_group.append(current_tx)

    count = len(same_group)
    combined_cif = sum(float(t.get("cif_value_inr") or 0) for t in same_group)

    score = 0.0
    evidence: List[str] = []

    if count >= _SPLIT_SHIPMENT_MIN_COUNT:
        # Check if individual values are suspiciously uniform
        values = [float(t.get("cif_value_inr") or 0) for t in same_group]
        if len(values) >= 3:
            try:
                cv = statistics.stdev(values) / (statistics.mean(values) + 1e-9)
            except statistics.StatisticsError:
                cv = 0
            if cv < 0.15:  # coefficient of variation < 15% → near-identical values
                score += 40.0
                evidence.append(
                    f"Split shipment pattern: {count} near-identical shipments "
                    f"(CV={cv:.2%}) from same exporter/HSN within 60 days. "
                    f"Combined CIF: ₹{combined_cif:,.0f}"
                )
            else:
                score += 20.0
                evidence.append(
                    f"Possible split shipment: {count} shipments from same "
                    f"exporter + HSN {hsn4} within 60 days. "
                    f"Combined CIF: ₹{combined_cif:,.0f}"
                )

    return {
        "anomaly_score"     : round(min(score, 100.0), 1),
        "is_anomaly"        : score >= 20.0,
        "split_group_count" : count,
        "combined_value"    : round(combined_cif, 2),
        "evidence"          : evidence,
    }


# =============================================================================
# Temporal Pattern Change Detection
# =============================================================================

def detect_temporal_change(
    monthly_volumes: List[float],
    current_volume: float,
) -> Dict[str, Any]:
    """
    Detect sudden spikes or drops in shipment volume/value.

    Parameters
    ----------
    monthly_volumes : historical monthly CIF totals (most recent last)
    current_volume  : current month's CIF total

    Returns
    -------
    {
      "anomaly_score" : float 0–100,
      "is_anomaly"    : bool,
      "z_score"       : float,
      "direction"     : "spike" | "drop" | "normal",
      "evidence"      : str,
    }
    """
    if len(monthly_volumes) < 3:
        return {
            "anomaly_score": 0.0, "is_anomaly": False,
            "z_score": 0.0, "direction": "normal",
            "evidence": "Insufficient history for temporal analysis",
        }

    mean = statistics.mean(monthly_volumes)
    try:
        std = statistics.stdev(monthly_volumes)
    except statistics.StatisticsError:
        std = 0.0

    if std < 1.0:
        return {
            "anomaly_score": 0.0, "is_anomaly": False,
            "z_score": 0.0, "direction": "normal",
            "evidence": "Stable trade pattern",
        }

    z = (current_volume - mean) / std
    score = min(abs(z) / _TEMPORAL_CHANGE_Z_THRESHOLD * 50, 100.0)
    direction = "spike" if z > 0 else "drop"
    is_anomaly = abs(z) >= _TEMPORAL_CHANGE_Z_THRESHOLD

    evidence = (
        f"Sudden trade {direction} detected: current volume ₹{current_volume:,.0f} "
        f"vs. historical average ₹{mean:,.0f} (z-score={z:.2f})"
        if is_anomaly
        else "Trade volume within normal historical range"
    )

    return {
        "anomaly_score" : round(score, 1),
        "is_anomaly"    : is_anomaly,
        "z_score"       : round(float(z), 3),
        "direction"     : direction if is_anomaly else "normal",
        "evidence"      : evidence,
    }
