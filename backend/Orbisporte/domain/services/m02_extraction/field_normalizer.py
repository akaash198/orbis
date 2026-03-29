"""
M02 Field Normalizer.

Applies post-extraction normalisation rules to each extracted field:

  invoice_date       → ISO 8601 (YYYY-MM-DD)
  currency           → ISO 4217 (USD, INR, EUR …)
  country_of_origin  → ISO 3166-1 alpha-2 (CN, US, IN …)
  gstin              → uppercase, whitespace stripped, format validated
  iec_number         → 10-digit, stripped, uppercase
  hsn_code           → 6–8 digit zero-padded
  total_value        → float, commas removed
  quantity           → numeric value (unit stored in 'unit' field)
  cif_value          → computed from total_value + freight + insurance if absent
"""

import re
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Date parsing ──────────────────────────────────────────────────────────────
# Pre-compiled at module load — avoids re-compilation on every date field call
_DATE_FORMATS = [
    (re.compile(r"(\d{4})-(\d{2})-(\d{2})"),              "{0}-{1}-{2}"),  # ISO already
    (re.compile(r"(\d{2})/(\d{2})/(\d{4})"),              "{2}-{1}-{0}"),  # DD/MM/YYYY
    (re.compile(r"(\d{2})-(\d{2})-(\d{4})"),              "{2}-{1}-{0}"),  # DD-MM-YYYY
    (re.compile(r"(\d{2})\.(\d{2})\.(\d{4})"),            "{2}-{1}-{0}"),  # DD.MM.YYYY
    (re.compile(r"(\d{1,2})\s+(\w+)\s+(\d{4})", re.IGNORECASE), None),    # 15 March 2024
]

_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

# ── Currency aliases → ISO 4217 ───────────────────────────────────────────────
_CURRENCY_MAP = {
    "$": "USD", "usd": "USD", "us dollar": "USD",
    "₹": "INR", "inr": "INR", "rs": "INR", "rs.": "INR", "rupee": "INR",
    "€": "EUR", "eur": "EUR", "euro": "EUR",
    "£": "GBP", "gbp": "GBP",
    "¥": "JPY", "jpy": "JPY", "cny": "CNY", "rmb": "CNY",
    "aed": "AED", "sgd": "SGD", "aud": "AUD", "cad": "CAD",
    "thb": "THB", "myr": "MYR", "idr": "IDR", "vnd": "VND",
    "bdt": "BDT", "twd": "TWD", "krw": "KRW",
}

# ── Country → ISO 3166-1 alpha-2 ─────────────────────────────────────────────
_COUNTRY_MAP = {
    "china": "CN", "prc": "CN", "peoples republic of china": "CN",
    "india": "IN", "united states": "US", "usa": "US", "united states of america": "US",
    "united kingdom": "GB", "uk": "GB", "germany": "DE", "france": "FR",
    "japan": "JP", "south korea": "KR", "korea": "KR", "singapore": "SG",
    "australia": "AU", "canada": "CA", "uae": "AE", "dubai": "AE",
    "united arab emirates": "AE", "bangladesh": "BD", "vietnam": "VN",
    "thailand": "TH", "indonesia": "ID", "malaysia": "MY", "taiwan": "TW",
    "sri lanka": "LK", "nepal": "NP", "pakistan": "PK", "myanmar": "MM",
    "hong kong": "HK", "italy": "IT", "spain": "ES", "netherlands": "NL",
    "belgium": "BE", "switzerland": "CH", "sweden": "SE", "denmark": "DK",
    "brazil": "BR", "mexico": "MX", "turkey": "TR", "saudi arabia": "SA",
    "south africa": "ZA", "russia": "RU", "israel": "IL",
}

# ── GSTIN format ──────────────────────────────────────────────────────────────
_GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")

# ── IEC format ────────────────────────────────────────────────────────────────
_IEC_RE = re.compile(r"^\d{10}$")


def _normalise_date(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()

    # Already ISO
    if re.match(r"\d{4}-\d{2}-\d{2}", v):
        return v[:10]

    for pattern, fmt in _DATE_FORMATS:
        m = pattern.search(v)
        if not m:
            continue
        if fmt:
            return fmt.format(*m.groups())
        else:
            # "15 March 2024" style
            day, month_str, year = m.groups()
            month = _MONTH_MAP.get(month_str[:3].lower())
            if month:
                return f"{year}-{month}-{int(day):02d}"

    return v  # return as-is if no format matched


def _normalise_currency(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()
    return _CURRENCY_MAP.get(v.lower(), v.upper())


def _normalise_country(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()
    # Already alpha-2
    if re.match(r"^[A-Z]{2}$", v):
        return v
    iso = _COUNTRY_MAP.get(v.lower())
    return iso if iso else v.title()


def _normalise_numeric(value: Any) -> Optional[float]:
    if value is None:
        return None
    v = re.sub(r"[^\d.]", "", str(value).replace(",", ""))
    try:
        return float(v) if v else None
    except ValueError:
        return None


def _normalise_hsn(value: str) -> str:
    if not value:
        return value
    digits = re.sub(r"\D", "", str(value))
    return digits.zfill(8) if len(digits) <= 8 else digits


def _normalise_gstin(value: str) -> str:
    cleaned = re.sub(r"\s+", "", str(value or "")).upper()
    if _GSTIN_RE.match(cleaned):
        return cleaned
    # Return cleaned even if format is non-standard (partial matches allowed)
    return cleaned


def _normalise_iec(value: str) -> str:
    cleaned = re.sub(r"\W", "", str(value or "")).upper()
    # IEC is always 10 digits
    digits = re.sub(r"\D", "", cleaned)
    return digits if len(digits) == 10 else cleaned


def _normalise_quantity(value: Any) -> Any:
    """
    Extract numeric part from a quantity string.
    '500 units' → 500.0
    '500'       → 500.0
    '1,200 KGS' → 1200.0
    Returns the float if parseable, original string otherwise.
    """
    if value is None:
        return value
    v = str(value).strip()
    # Try numeric extraction
    num_match = re.match(r"^([\d,]+\.?\d*)", v.replace(",", ""))
    if num_match:
        try:
            return float(num_match.group(1).replace(",", ""))
        except ValueError:
            pass
    return v


def normalise_fields(fields: dict) -> dict:
    """
    Apply all normalisation rules to the extracted fields dict.
    Returns a new dict with normalised values.
    """
    out = dict(fields)

    for date_field in ("invoice_date", "shipment_date", "expiry_date"):
        if out.get(date_field):
            out[date_field] = _normalise_date(str(out[date_field]))

    if out.get("currency"):
        out["currency"] = _normalise_currency(str(out["currency"]))

    if out.get("country_of_origin"):
        out["country_of_origin"] = _normalise_country(str(out["country_of_origin"]))

    if out.get("hsn_code"):
        out["hsn_code"] = _normalise_hsn(str(out["hsn_code"]))

    if out.get("gst_number"):
        out["gst_number"] = _normalise_gstin(str(out["gst_number"]))

    if out.get("iec_number"):
        out["iec_number"] = _normalise_iec(str(out["iec_number"]))

    for num_field in ("total_value", "unit_price", "freight", "insurance", "cif_value"):
        if out.get(num_field) is not None:
            n = _normalise_numeric(out[num_field])
            if n is not None:
                out[num_field] = n

    if out.get("quantity") is not None:
        out["quantity"] = _normalise_quantity(out["quantity"])

    # Compute cif_value from components if not extracted directly
    if not out.get("cif_value"):
        tv = out.get("total_value")
        fr = out.get("freight")
        ins = out.get("insurance")
        if tv is not None and isinstance(tv, (int, float)):
            components = [tv]
            if fr is not None and isinstance(fr, (int, float)):
                components.append(fr)
            if ins is not None and isinstance(ins, (int, float)):
                components.append(ins)
            if len(components) > 1:
                out["cif_value"] = round(sum(components), 2)

    return out
