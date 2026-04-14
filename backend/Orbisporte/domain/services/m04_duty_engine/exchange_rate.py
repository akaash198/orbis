"""
M04 — Exchange Rate Service  (SOP Step 2)
=========================================
Priority chain:
  1. m04_exchange_rates table (if fetched today)
  2. RBI FBIL API  (https://www.fbil.org.in)
  3. Open Exchange Rates public endpoint (fallback)
  4. Hard-coded safe fallback

Author: OrbisPorté Development Team
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Known fallback rates (last-resort, updated at deploy time)
# ---------------------------------------------------------------------------
_FALLBACK_RATES: dict[str, float] = {
    "USD": 83.50,
    "EUR": 90.20,
    "GBP": 105.10,
    "JPY":  0.56,
    "CNY": 11.50,
    "AED": 22.73,
    "SGD": 62.10,
    "AUD": 54.80,
    "CAD": 61.40,
    "CHF": 93.20,
    "HKD": 10.70,
    "KRW":  0.061,
    "MYR": 19.60,
    "THB":  2.43,
}

# RBI FBIL daily reference rate endpoint
_RBI_FBIL_URL = "https://fbil.org.in/apifbil/api/getlatestrates"

# Open Exchange Rates free endpoint (no key required for base USD → INR)
_OER_URL = "https://open.er-api.com/v6/latest/USD"


class ExchangeRateService:
    """
    Fetches, caches, and returns exchange rates for duty computation.

    Usage::

        svc = ExchangeRateService(db)
        rate, source = svc.get_rate_inr("USD")
        # → (Decimal("83.50"), "DB_CACHE")
    """

    def __init__(self, db: Session):
        self.db = db

    # ── Public API ──────────────────────────────────────────────────────────

    def get_rate_inr(
        self,
        currency: str = "USD",
        as_of_date: Optional[date] = None,
    ) -> tuple[Decimal, str]:
        """
        Return (rate_inr, source_label).

        source_label is one of: DB_CACHE | RBI_FBIL | OPEN_ER | FALLBACK
        """
        currency = currency.upper().strip()
        if currency == "INR":
            return Decimal("1.0000"), "IDENTITY"

        if as_of_date is None:
            as_of_date = date.today()

        # 1. Check DB cache for today
        cached = self._get_cached(currency, as_of_date)
        if cached is not None:
            return cached, "DB_CACHE"

        # 2. Try RBI FBIL
        try:
            rate = self._fetch_rbi_fbil(currency)
            if rate:
                self._store_rate(currency, rate, "RBI_FBIL", as_of_date)
                return Decimal(str(rate)), "RBI_FBIL"
        except Exception as exc:
            logger.warning("[M04][ExRate] RBI FBIL failed: %s", exc)

        # 3. Try Open Exchange Rates
        try:
            rate = self._fetch_open_er(currency)
            if rate:
                self._store_rate(currency, rate, "OPEN_ER", as_of_date)
                return Decimal(str(rate)), "OPEN_ER"
        except Exception as exc:
            logger.warning("[M04][ExRate] Open ER failed: %s", exc)

        # 4. Hard-coded fallback
        rate = _FALLBACK_RATES.get(currency)
        if rate:
            logger.warning("[M04][ExRate] Using hard-coded fallback for %s = %.4f", currency, rate)
            return Decimal(str(rate)), "FALLBACK"

        raise ValueError(f"No exchange rate available for currency: {currency}")

    def get_all_supported_currencies(self) -> list[dict]:
        """Return list of currencies with fallback rates."""
        return [
            {"code": code, "fallback_rate": rate}
            for code, rate in _FALLBACK_RATES.items()
        ]

    # ── DB Cache ────────────────────────────────────────────────────────────

    def _get_cached(self, currency: str, for_date: date) -> Optional[Decimal]:
        try:
            row = self.db.execute(
                text("""
                    SELECT rate_inr FROM m04_exchange_rates
                    WHERE currency_code = :c AND valid_for_date = :d AND is_active = TRUE
                    ORDER BY fetched_at DESC
                    LIMIT 1
                """),
                {"c": currency, "d": for_date.isoformat()},
            ).fetchone()
            if row:
                return Decimal(str(row[0]))
        except Exception as exc:
            logger.warning("[M04][ExRate] DB cache read error: %s", exc)
        return None

    def _store_rate(
        self,
        currency: str,
        rate: float,
        source: str,
        for_date: date,
    ) -> None:
        try:
            # Upsert: deactivate old record then insert new
            self.db.execute(
                text("""
                    UPDATE m04_exchange_rates
                    SET is_active = FALSE
                    WHERE currency_code = :c AND valid_for_date = :d
                """),
                {"c": currency, "d": for_date.isoformat()},
            )
            self.db.execute(
                text("""
                    INSERT INTO m04_exchange_rates
                        (currency_code, rate_inr, source, valid_for_date, fetched_at)
                    VALUES (:c, :r, :s, :d, NOW())
                """),
                {"c": currency, "r": rate, "s": source, "d": for_date.isoformat()},
            )
            self.db.commit()
        except Exception as exc:
            logger.warning("[M04][ExRate] Failed to cache rate: %s", exc)
            self.db.rollback()

    # ── External API Fetchers ───────────────────────────────────────────────

    def _fetch_rbi_fbil(self, currency: str) -> Optional[float]:
        """
        FBIL (Financial Benchmarks India Pvt Ltd) daily FX reference rates.
        Returns INR value for 1 unit of currency, or None if unavailable.
        """
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(_RBI_FBIL_URL, headers={"Accept": "application/json"})
            resp.raise_for_status()
            data = resp.json()

        # FBIL response structure: {"rates": [{"currencyCode": "USD", "rate": "83.50"}, ...]}
        rates_list = data.get("rates") or data.get("data", {}).get("rates", [])
        for item in rates_list:
            code = item.get("currencyCode") or item.get("currency", "")
            if code.upper() == currency:
                return float(item.get("rate") or item.get("value", 0))
        return None

    def _fetch_open_er(self, currency: str) -> Optional[float]:
        """
        Open Exchange Rates free tier — base USD, convert to INR rate for any currency.
        If currency == USD, returns direct INR rate.
        Otherwise uses cross-rate: INR/currency = (INR/USD) / (currency/USD).
        """
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(_OER_URL)
            resp.raise_for_status()
            data = resp.json()

        rates = data.get("rates", {})
        usd_to_inr = rates.get("INR")
        if not usd_to_inr:
            return None

        if currency == "USD":
            return float(usd_to_inr)

        currency_to_usd = rates.get(currency)
        if not currency_to_usd or currency_to_usd == 0:
            return None

        # 1 unit of currency = (1/currency_to_usd) USD = (1/currency_to_usd)*usd_to_inr INR
        return float(usd_to_inr / currency_to_usd)
