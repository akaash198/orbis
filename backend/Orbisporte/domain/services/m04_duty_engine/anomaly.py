"""
M04 — CIF Anomaly Validator  (SOP Step 1 Enhancement)
======================================================
SOP Step 1 specifies: "ML validates freight vs. lane benchmarks; flags anomalies"

Implements rule-based heuristics using published freight-ratio benchmarks
for key India trade lanes (World Bank LPI + FIATA / ICS data).

Anomaly codes
-------------
ZERO_FREIGHT      : Freight declared as zero under CIF/CIP incoterms
FREIGHT_HIGH      : Freight > benchmark max for the trade lane
FREIGHT_LOW       : Freight < benchmark min for the trade lane
ZERO_INSURANCE    : Insurance declared as zero
INSURANCE_LOW     : Insurance < 0.05% of CIF (unusually low)
INSURANCE_HIGH    : Insurance > 2.0% of CIF (unusually high)

Severity levels: "warning" (review recommended) | "error" (likely data issue)

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

# ── Lane freight benchmarks ──────────────────────────────────────────────────
# Freight as % of FOB value, by exporting country to India.
# Sources: World Bank LPI, FIATA Cost Estimates, ICS Schedule of Rates 2024.
_LANE_BENCHMARKS: dict[str, dict] = {
    "CHN": {"min_pct": 2.0, "max_pct": 18.0, "typical_pct": 8.0,  "lane": "China → India"},
    "USA": {"min_pct": 5.0, "max_pct": 25.0, "typical_pct": 12.0, "lane": "USA → India"},
    "DEU": {"min_pct": 4.0, "max_pct": 20.0, "typical_pct": 10.0, "lane": "Germany → India"},
    "GBR": {"min_pct": 4.0, "max_pct": 20.0, "typical_pct": 10.0, "lane": "UK → India"},
    "JPN": {"min_pct": 3.0, "max_pct": 20.0, "typical_pct": 9.0,  "lane": "Japan → India"},
    "KOR": {"min_pct": 3.0, "max_pct": 18.0, "typical_pct": 8.0,  "lane": "Korea → India"},
    "SGP": {"min_pct": 1.5, "max_pct": 10.0, "typical_pct": 4.0,  "lane": "Singapore → India"},
    "ARE": {"min_pct": 1.0, "max_pct":  8.0, "typical_pct": 3.0,  "lane": "UAE → India"},
    "AUS": {"min_pct": 4.0, "max_pct": 22.0, "typical_pct": 10.0, "lane": "Australia → India"},
    "BRA": {"min_pct": 6.0, "max_pct": 28.0, "typical_pct": 14.0, "lane": "Brazil → India"},
    "ZAF": {"min_pct": 5.0, "max_pct": 25.0, "typical_pct": 12.0, "lane": "South Africa → India"},
    "MYS": {"min_pct": 2.0, "max_pct": 12.0, "typical_pct": 5.0,  "lane": "Malaysia → India"},
    "THA": {"min_pct": 2.0, "max_pct": 12.0, "typical_pct": 5.0,  "lane": "Thailand → India"},
    "VNM": {"min_pct": 2.0, "max_pct": 15.0, "typical_pct": 6.0,  "lane": "Vietnam → India"},
    "IDN": {"min_pct": 2.0, "max_pct": 15.0, "typical_pct": 6.0,  "lane": "Indonesia → India"},
    "TWN": {"min_pct": 3.0, "max_pct": 18.0, "typical_pct": 8.0,  "lane": "Taiwan → India"},
    "ITA": {"min_pct": 4.0, "max_pct": 20.0, "typical_pct": 10.0, "lane": "Italy → India"},
    "FRA": {"min_pct": 4.0, "max_pct": 20.0, "typical_pct": 10.0, "lane": "France → India"},
}
_DEFAULT_BENCHMARK = {"min_pct": 1.0, "max_pct": 30.0, "typical_pct": 10.0, "lane": "Generic"}

# Insurance benchmarks (% of CIF)
_INS_MIN_PCT  = Decimal("0.05")   # below this → INSURANCE_LOW
_INS_HIGH_PCT = Decimal("2.00")   # above this → INSURANCE_HIGH


def validate_cif_components(
    fob: Decimal,
    freight: Decimal,
    insurance: Decimal,
    country_of_origin: Optional[str] = None,
) -> dict:
    """
    Validate CIF components against lane benchmarks.

    Parameters
    ----------
    fob              : FOB cost in original currency
    freight          : Freight cost in same currency
    insurance        : Insurance cost in same currency
    country_of_origin: ISO 3-letter exporting country code

    Returns
    -------
    {
      "has_anomalies"        : bool,
      "anomalies"            : [{"code", "severity", "message"}, ...],
      "freight_pct_of_fob"   : float,
      "insurance_pct_of_cif" : float,
      "lane_benchmark"       : {min_pct, max_pct, typical_pct, lane},
    }
    """
    cif = fob + freight + insurance
    anomalies: list[dict] = []

    bench = _LANE_BENCHMARKS.get(
        (country_of_origin or "").upper().strip(), _DEFAULT_BENCHMARK
    )

    # ── Freight anomaly checks ───────────────────────────────────────────────
    if fob > 0:
        freight_pct = float(freight / fob * 100)

        if freight == 0:
            anomalies.append({
                "code": "ZERO_FREIGHT",
                "severity": "warning",
                "message": (
                    f"Freight is zero. Under CIF/CIP incoterms freight must be declared. "
                    f"Expected ≈{bench['typical_pct']:.1f}% of FOB for {bench['lane']} lane."
                ),
            })
        elif freight_pct > bench["max_pct"]:
            anomalies.append({
                "code": "FREIGHT_HIGH",
                "severity": "warning",
                "message": (
                    f"Freight ({freight_pct:.1f}% of FOB) exceeds benchmark maximum "
                    f"({bench['max_pct']:.0f}%) for {bench['lane']} lane "
                    f"(typical {bench['typical_pct']:.1f}%). Verify freight charges."
                ),
            })
        elif freight_pct < bench["min_pct"]:
            anomalies.append({
                "code": "FREIGHT_LOW",
                "severity": "warning",
                "message": (
                    f"Freight ({freight_pct:.1f}% of FOB) is below benchmark minimum "
                    f"({bench['min_pct']:.1f}%) for {bench['lane']} lane "
                    f"(typical {bench['typical_pct']:.1f}%). Verify freight charges."
                ),
            })
    else:
        freight_pct = 0.0

    # ── Insurance anomaly checks ─────────────────────────────────────────────
    if cif > 0:
        ins_pct = insurance / cif * 100

        if insurance == 0:
            anomalies.append({
                "code": "ZERO_INSURANCE",
                "severity": "warning",
                "message": (
                    "Insurance is zero. Standard practice requires ≥0.1% of CIF. "
                    "Verify if insurance is bundled into freight."
                ),
            })
        elif ins_pct < _INS_MIN_PCT:
            anomalies.append({
                "code": "INSURANCE_LOW",
                "severity": "warning",
                "message": (
                    f"Insurance ({float(ins_pct):.3f}% of CIF) is below typical minimum "
                    f"({float(_INS_MIN_PCT):.2f}%). Verify insurance amount."
                ),
            })
        elif ins_pct > _INS_HIGH_PCT:
            anomalies.append({
                "code": "INSURANCE_HIGH",
                "severity": "warning",
                "message": (
                    f"Insurance ({float(ins_pct):.2f}% of CIF) exceeds typical maximum "
                    f"({float(_INS_HIGH_PCT):.1f}%). Verify insurance amount."
                ),
            })
        ins_pct_out = round(float(ins_pct), 3)
    else:
        ins_pct_out = 0.0

    return {
        "has_anomalies": len(anomalies) > 0,
        "anomalies": anomalies,
        "freight_pct_of_fob": round(freight_pct, 2),
        "insurance_pct_of_cif": ins_pct_out,
        "lane_benchmark": bench,
    }
