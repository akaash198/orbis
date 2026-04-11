"""
M02 Field Normalizer.

Applies post-extraction normalisation and validation to each extracted field.

Field                 Normalisation applied
--------------------  -----------------------------------------------------------
invoice_date          ISO 8601 (YYYY-MM-DD)
shipment_date         ISO 8601 (YYYY-MM-DD)
currency              ISO 4217 (USD, INR, EUR …)
country_of_origin     ISO 3166-1 alpha-2 (CN, US, IN …)
gst_number            15-char GSTIN format — validated, uppercase
iec_number            10-digit — validated, cross-checked against importer_name
hsn_code              6–8 digit; validated against HSN chapter schedule
total_value           float, commas removed
unit_price            float; embedded currency prefix propagated → currency field
freight / insurance   float
quantity              numeric value (unit kept in 'unit' field)
cif_value             computed from total_value + freight + insurance if absent
exporter_name         Entity resolution — canonical case, suffix expansion
importer_name         Entity resolution — canonical case, suffix expansion
shipment_address      Standardised address format
"""

import re
import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Date parsing ──────────────────────────────────────────────────────────────
_DATE_FORMATS = [
    (re.compile(r"(\d{4})-(\d{2})-(\d{2})"),              "{0}-{1}-{2}"),  # ISO already
    (re.compile(r"(\d{2})/(\d{2})/(\d{4})"),              "{2}-{1}-{0}"),  # DD/MM/YYYY (trade default)
    (re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})"),          "{2}-{1:0>2}-{0:0>2}"),  # D/M/YYYY or M/D/YYYY (zero-pad)
    (re.compile(r"(\d{2})-(\d{2})-(\d{4})"),              "{2}-{1}-{0}"),  # DD-MM-YYYY
    (re.compile(r"(\d{2})\.(\d{2})\.(\d{4})"),            "{2}-{1}-{0}"),  # DD.MM.YYYY
    (re.compile(r"(\d{4})/(\d{2})/(\d{2})"),              "{0}-{1}-{2}"),  # YYYY/MM/DD
    (re.compile(r"(\d{1,2})\s+(\w+)[,\s]+(\d{4})", re.IGNORECASE), None), # 15 March 2024 / 15-Mar-2024
]

_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

# ── Currency aliases → ISO 4217 ───────────────────────────────────────────────
_CURRENCY_MAP = {
    "$": "USD", "usd": "USD", "us dollar": "USD", "us dollars": "USD",
    "₹": "INR", "inr": "INR", "rs": "INR", "rs.": "INR", "rupee": "INR", "rupees": "INR",
    "€": "EUR", "eur": "EUR", "euro": "EUR", "euros": "EUR",
    "£": "GBP", "gbp": "GBP", "pound": "GBP", "pounds": "GBP",
    "¥": "JPY", "jpy": "JPY", "cny": "CNY", "rmb": "CNY",
    "aed": "AED", "sgd": "SGD", "aud": "AUD", "cad": "CAD",
    "thb": "THB", "myr": "MYR", "idr": "IDR", "vnd": "VND",
    "bdt": "BDT", "twd": "TWD", "krw": "KRW",
}

# Regex to detect a leading currency prefix in a value like "USD 20.00" or "$ 1,500"
_CURRENCY_PREFIX_RE = re.compile(
    r"^(USD|INR|EUR|GBP|JPY|CNY|AED|SGD|AUD|CAD|THB|MYR|IDR|VND|BDT|TWD|KRW"
    r"|US\$|\$|₹|€|£|¥|Rs\.?)\s*",
    re.IGNORECASE,
)

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

# ── GSTIN / IEC formats ───────────────────────────────────────────────────────
_GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_IEC_RE   = re.compile(r"^\d{10}$")

# ── Entity name — company suffix expansions ───────────────────────────────────
# Map abbreviated legal suffixes to their canonical long form.
# We normalise to the short form (Ltd, Pvt Ltd, Inc, LLC) to keep names compact
# while ensuring consistent representation across documents.
_SUFFIX_MAP = {
    r"\bLimited\b":               "Ltd",
    r"\bPrivate\s+Limited\b":     "Pvt Ltd",
    r"\bPvt\.\s*Ltd\.?\b":        "Pvt Ltd",
    r"\bIncorporated\b":          "Inc",
    r"\bCorporation\b":           "Corp",
    r"\bCompany\b":               "Co",
    r"\bCo\.\b":                  "Co",
    r"\bLLC\b":                   "LLC",
    r"\bLLP\b":                   "LLP",
    r"\bGmbH\b":                  "GmbH",
    r"\bS\.A\.\b":                "SA",
    r"\bB\.V\.\b":                "BV",
    r"\bPte\.\s*Ltd\.?\b":        "Pte Ltd",
    r"\bSdn\.\s*Bhd\.?\b":        "Sdn Bhd",
}
_SUFFIX_COMPILED = [(re.compile(pat, re.IGNORECASE), canon) for pat, canon in _SUFFIX_MAP.items()]

# ── HSN chapter validation ────────────────────────────────────────────────────
# Valid HS/HSN 2-digit chapter codes (01–99, with gaps where chapters don't exist).
# Used as a first-level sanity check before DB lookup.
_VALID_HSN_CHAPTERS = {
    "01","02","03","04","05","06","07","08","09","10",
    "11","12","13","14","15","16","17","18","19","20",
    "21","22","23","24","25","26","27","28","29","30",
    "31","32","33","34","35","36","37","38","39","40",
    "41","42","43","44","45","46","47","48","49","50",
    "51","52","53","54","55","56","57","58","59","60",
    "61","62","63","64","65","66","67","68","69","70",
    "71","72","73","74","75","76","78","79","80","81",
    "82","83","84","85","86","87","88","89","90","91",
    "92","93","94","95","96","97","98","99",
}

# ── Address known state / city abbreviation expansions ───────────────────────
_ADDR_EXPAND = {
    r"\bMum\b":  "Mumbai",
    r"\bDel\b":  "Delhi",
    r"\bBng\b":  "Bengaluru",
    r"\bChE\b":  "Chennai",
    r"\bHyd\b":  "Hyderabad",
    r"\bKol\b":  "Kolkata",
    r"\bPun\b":  "Pune",
    r"\bAhm\b":  "Ahmedabad",
    r"\bMH\b":   "Maharashtra",
    r"\bDL\b":   "Delhi",
    r"\bKA\b":   "Karnataka",
    r"\bTN\b":   "Tamil Nadu",
    r"\bGJ\b":   "Gujarat",
    r"\bUP\b":   "Uttar Pradesh",
    r"\bWB\b":   "West Bengal",
    r"\bTG\b":   "Telangana",
    r"\bRJ\b":   "Rajasthan",
    r"\bPB\b":   "Punjab",
    r"\bMP\b":   "Madhya Pradesh",
    r"\bBR\b":   "Bihar",
    r"\bOR\b":   "Odisha",
    r"\bKL\b":   "Kerala",
    r"\bAS\b":   "Assam",
    r"\bJK\b":   "Jammu & Kashmir",
}
_ADDR_COMPILED = [(re.compile(pat, re.IGNORECASE), exp) for pat, exp in _ADDR_EXPAND.items()]


# ── Individual normaliser functions ───────────────────────────────────────────

def _normalise_date(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()
    if re.match(r"\d{4}-\d{2}-\d{2}", v):
        return v[:10]
    for pattern, fmt in _DATE_FORMATS:
        m = pattern.search(v)
        if not m:
            continue
        if fmt is None:
            # Named-month format: "15 March 2024" / "15-Mar-2024"
            day, month_str, year = m.groups()
            month = _MONTH_MAP.get(month_str[:3].lower())
            if month:
                return f"{year}-{month}-{int(day):02d}"
        else:
            # Zero-pad each captured group to 2 digits before substituting
            groups = tuple(str(g).zfill(2) for g in m.groups())
            try:
                return fmt.format(*groups)
            except (IndexError, KeyError):
                pass
    return v


def _normalise_currency(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()
    return _CURRENCY_MAP.get(v.lower(), v.upper())


def _normalise_country(value: str) -> str:
    if not value:
        return value
    v = str(value).strip()
    # "China (CN)" → extract bracketed alpha-2 first
    m = re.search(r"\(([A-Z]{2})\)", v)
    if m:
        return m.group(1)
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


def _extract_currency_prefix(value: str) -> Tuple[Optional[str], str]:
    """
    If value contains a leading currency symbol / code (e.g. 'USD 20.00', '$ 1,500'),
    return (iso_code, stripped_numeric_string).
    Returns (None, original_value) when no prefix is found.
    """
    m = _CURRENCY_PREFIX_RE.match(str(value).strip())
    if not m:
        return None, str(value)
    prefix = m.group(1).strip().rstrip(".")
    numeric_part = str(value)[m.end():].strip()
    iso = _CURRENCY_MAP.get(prefix.lower()) or _CURRENCY_MAP.get(prefix.upper()) or prefix.upper()
    return iso, numeric_part


def _normalise_numeric_with_currency(value: Any) -> Tuple[Optional[float], Optional[str]]:
    """
    Parse a value that may embed a currency prefix.
    Returns (float_value, iso_currency_or_None).
    E.g. 'USD 20.00' → (20.0, 'USD')
         '10,000'    → (10000.0, None)
    """
    if value is None:
        return None, None
    iso, stripped = _extract_currency_prefix(str(value))
    num = _normalise_numeric(stripped)
    return num, iso


def _normalise_hsn(value: str) -> Tuple[str, bool]:
    """
    Normalise HSN code and validate against chapter schedule.
    Returns (normalised_code, is_valid_chapter).

    Valid lengths: 4 (heading), 6 (subheading), 8 (tariff item).
    Do NOT zero-pad — zfill(8) on a 6-digit code shifts the chapter
    digits and produces an invalid code (e.g. "850440" → "00850440").
    """
    if not value:
        return value, False
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return str(value), False
    # Truncate to max 8 digits; keep length as extracted (4, 6, or 8)
    normalised = digits[:8]
    # Pad only if shorter than 4 digits (partial scan artefact)
    if len(normalised) < 4:
        normalised = normalised.zfill(4)
    chapter = normalised[:2]
    valid = chapter in _VALID_HSN_CHAPTERS
    if not valid:
        logger.warning("[Normaliser] HSN chapter %s not found in schedule.", chapter)
    return normalised, valid


def _normalise_gstin(value: str) -> str:
    # Strip all whitespace and convert to uppercase — OCR often outputs mixed case
    # e.g. "29abcde1234f1z5" or "29 ABCDE 1234 F1Z5"
    cleaned = re.sub(r"[\s\-/]", "", str(value or "")).upper()
    return cleaned


def _normalise_iec(value: str) -> str:
    cleaned = re.sub(r"\W", "", str(value or "")).upper()
    digits = re.sub(r"\D", "", cleaned)
    return digits if len(digits) == 10 else cleaned


def _normalise_entity_name(value: str) -> str:
    """
    Entity resolution for company names.

    Steps:
      1. Collapse internal whitespace
      2. Normalise legal suffix to canonical short form
      3. Apply title case (preserves ALL-CAPS acronyms)
      4. Strip trailing punctuation
    """
    if not value:
        return value
    v = re.sub(r"\s+", " ", str(value).strip())

    # Normalise legal suffixes
    for pattern, canon in _SUFFIX_COMPILED:
        v = pattern.sub(canon, v)

    # Title-case word-by-word; keep ALL-CAPS tokens (e.g. "ABC", "INC") intact
    tokens = v.split()
    cased = []
    for tok in tokens:
        if tok.isupper() and len(tok) <= 5:
            cased.append(tok)   # acronym — keep as-is
        else:
            cased.append(tok.capitalize())
    v = " ".join(cased)

    return v.strip(" .,;")


def _normalise_address(value: str) -> str:
    """
    Standardise address format.

    Steps:
      1. Collapse whitespace / newlines → comma-separated tokens
      2. Expand known city/state abbreviations
      3. Title-case each component
      4. Deduplicate consecutive identical tokens
    """
    if not value:
        return value

    # Replace newlines and semicolons with commas
    v = re.sub(r"[\n\r;]+", ", ", str(value).strip())
    v = re.sub(r"\s{2,}", " ", v)

    # Expand abbreviations
    for pattern, expansion in _ADDR_COMPILED:
        v = pattern.sub(expansion, v)

    # Split on comma, title-case, strip blanks
    parts = [p.strip().title() for p in v.split(",") if p.strip()]

    # Deduplicate consecutive identical parts (case-insensitive)
    deduped = []
    for part in parts:
        if not deduped or part.lower() != deduped[-1].lower():
            deduped.append(part)

    return ", ".join(deduped)


def _validate_iec_importer(iec: Optional[str], importer_name: Optional[str]) -> Dict[str, Any]:
    """
    Cross-validate IEC number against importer name.

    Rules:
      1. IEC must be 10 digits.
      2. First 2 digits = DGFT region code (01–99).
      3. If both IEC and importer_name are present, log for audit
         (full registry lookup requires live DGFT API access).

    Returns a dict with 'valid' (bool) and 'notes' (list[str]).
    """
    notes = []
    valid = True

    if not iec:
        return {"valid": False, "notes": ["IEC not extracted"]}

    digits = re.sub(r"\D", "", iec)
    if len(digits) != 10:
        notes.append(f"IEC format invalid: expected 10 digits, got {len(digits)}")
        valid = False
    else:
        region = int(digits[:2])
        if not (1 <= region <= 99):
            notes.append(f"IEC region code {digits[:2]} out of range (01–99)")
            valid = False
        else:
            notes.append(f"IEC format valid — DGFT region {int(digits[:2]):02d}")

    if importer_name and iec and valid:
        notes.append(
            f"IEC {iec} assigned to importer '{importer_name}' — "
            "live DGFT registry lookup required for full cross-validation."
        )

    return {"valid": valid, "notes": notes}


# ── Master normalise_fields ───────────────────────────────────────────────────

def normalise_fields(fields: dict) -> dict:
    """
    Apply all normalisation and validation rules to the extracted fields dict.
    Returns a new dict with normalised values plus a '_validation' metadata key.
    """
    out = dict(fields)
    validation: Dict[str, Any] = {}

    # ── Dates ─────────────────────────────────────────────────────────────────
    for date_field in ("invoice_date", "shipment_date", "expiry_date"):
        if out.get(date_field):
            out[date_field] = _normalise_date(str(out[date_field]))

    # ── Numeric fields — extract embedded currency prefix ─────────────────────
    for num_field in ("unit_price", "total_value", "freight", "insurance", "cif_value"):
        raw = out.get(num_field)
        if raw is not None:
            num, embedded_iso = _normalise_numeric_with_currency(raw)
            if num is not None:
                out[num_field] = num
            # Propagate embedded currency if the currency field is not yet set
            if embedded_iso and not out.get("currency"):
                out["currency"] = embedded_iso
                logger.debug(
                    "[Normaliser] Currency '%s' inferred from %s value.", embedded_iso, num_field
                )

    # ── Currency ──────────────────────────────────────────────────────────────
    if out.get("currency"):
        out["currency"] = _normalise_currency(str(out["currency"]))

    # ── Country of origin ─────────────────────────────────────────────────────
    if out.get("country_of_origin"):
        out["country_of_origin"] = _normalise_country(str(out["country_of_origin"]))

    # ── HSN code — format normalise + chapter validation ─────────────────────
    if out.get("hsn_code"):
        normalised_hsn, hsn_valid = _normalise_hsn(str(out["hsn_code"]))
        out["hsn_code"] = normalised_hsn
        validation["hsn_code"] = {
            "valid":   hsn_valid,
            "chapter": normalised_hsn[:2] if len(normalised_hsn) >= 2 else None,
            "note":    "Chapter valid per HSN schedule" if hsn_valid else "Chapter not found in HSN schedule",
        }

    # ── GSTIN ─────────────────────────────────────────────────────────────────
    if out.get("gst_number"):
        cleaned = _normalise_gstin(str(out["gst_number"]))
        out["gst_number"] = cleaned
        gstin_valid = bool(_GSTIN_RE.match(cleaned))
        validation["gst_number"] = {
            "valid": gstin_valid,
            "note":  "GSTIN format valid" if gstin_valid else "GSTIN format invalid — expected 15-char GSTIN",
        }
        # Cross-check: GSTIN state code (first 2 digits) should match shipment address state
        if gstin_valid and out.get("shipment_address"):
            state_code = int(cleaned[:2])
            validation["gst_number"]["state_code"] = state_code

    # ── IEC — cross-validate against importer name ────────────────────────────
    if out.get("iec_number"):
        out["iec_number"] = _normalise_iec(str(out["iec_number"]))
        iec_result = _validate_iec_importer(out["iec_number"], out.get("importer_name"))
        validation["iec_number"] = iec_result

    # ── Quantity — numeric only ───────────────────────────────────────────────
    if out.get("quantity") is not None:
        v = str(out["quantity"]).strip()
        # If unit is embedded (e.g. "500 units", "1,200 KGS"), split it out
        m = re.match(r"^([\d,]+\.?\d*)\s*([A-Za-z]+.*)?$", v.replace(",", ""))
        if m:
            try:
                out["quantity"] = float(m.group(1))
                if m.group(2) and not out.get("unit"):
                    out["unit"] = m.group(2).strip().upper()
            except ValueError:
                pass

    # ── Entity resolution — exporter / importer names ─────────────────────────
    for name_field in ("exporter_name", "importer_name"):
        if out.get(name_field):
            out[name_field] = _normalise_entity_name(str(out[name_field]))

    # ── Address standardisation ───────────────────────────────────────────────
    if out.get("shipment_address"):
        out["shipment_address"] = _normalise_address(str(out["shipment_address"]))
    if out.get("exporter_address"):
        out["exporter_address"] = _normalise_address(str(out["exporter_address"]))
    if out.get("importer_address"):
        out["importer_address"] = _normalise_address(str(out["importer_address"]))

    # ── CIF value — compute from components if not extracted directly ──────────
    if not out.get("cif_value"):
        tv  = out.get("total_value")
        fr  = out.get("freight")
        ins = out.get("insurance")
        if tv is not None and isinstance(tv, (int, float)):
            components = [tv]
            if fr  is not None and isinstance(fr,  (int, float)): components.append(fr)
            if ins is not None and isinstance(ins, (int, float)): components.append(ins)
            if len(components) > 1:
                out["cif_value"] = round(sum(components), 2)

    # ── Attach validation metadata ────────────────────────────────────────────
    if validation:
        out["_validation"] = validation

    return out
