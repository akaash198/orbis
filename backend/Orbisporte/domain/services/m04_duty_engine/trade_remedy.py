"""
M04 — Trade Remedy Engine  (SOP Steps 6–7)
===========================================
Looks up active ADD / CVD / SGD notifications for an HSN + country pair.

Future enhancement: NLP parser to ingest DGTR PDF notifications automatically.

Author: OrbisPorté Development Team
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class TradeRemedyEngine:
    """
    Queries m04_trade_remedy_notifications for applicable ADD / CVD / SGD.

    Usage::

        engine = TradeRemedyEngine(db)
        remedies = engine.get_applicable_remedies("85044030", "CHN")
        # → [{"type": "ADD", "rate": Decimal("12.00"), "notification": "..."}]
    """

    def __init__(self, db: Session):
        self.db = db

    def get_applicable_remedies(
        self,
        hsn_code: str,
        country_of_origin: Optional[str],
        as_of_date: Optional[date] = None,
    ) -> list[dict]:
        """
        Return all active trade remedy notifications for this HSN + country.

        Matches on:
          - exact hsn_code  OR  4-digit chapter prefix
          - country_of_origin (or NULL meaning all countries)
          - effective_from <= as_of_date <= effective_to (or effective_to IS NULL)
        """
        if as_of_date is None:
            as_of_date = date.today()

        # Try 8-digit, then 6-digit, then 4-digit match
        hsn_variants = self._hsn_variants(hsn_code)
        country = (country_of_origin or "").upper().strip() or None

        rows = self.db.execute(
            text("""
                SELECT remedy_type, rate_type, rate_value, unit,
                       notification_number, dgtr_case_number,
                       effective_from, effective_to
                FROM m04_trade_remedy_notifications
                WHERE hsn_code = ANY(:hsns)
                  AND is_active = TRUE
                  AND effective_from <= CAST(:d AS DATE)
                  AND (effective_to IS NULL OR effective_to >= CAST(:d AS DATE))
                  AND (country_of_origin IS NULL OR country_of_origin = :country)
                ORDER BY effective_from DESC
            """),
            {
                "hsns": hsn_variants,
                "d": as_of_date.isoformat(),
                "country": country,
            },
        ).fetchall()

        remedies = []
        seen_types: set[str] = set()
        for row in rows:
            remedy_type = row[0]
            if remedy_type in seen_types:
                continue  # take highest-priority (most recent)
            seen_types.add(remedy_type)
            remedies.append(
                {
                    "type": remedy_type,
                    "rate_type": row[1],
                    "rate": Decimal(str(row[2])) if row[2] is not None else Decimal("0"),
                    "unit": row[3],
                    "notification": row[4],
                    "case_number": row[5],
                    "effective_from": row[6].isoformat() if row[6] else None,
                    "effective_to": row[7].isoformat() if row[7] else None,
                }
            )

        logger.info(
            "[M04][TradeRemedy] HSN=%s COO=%s → %d notification(s): %s",
            hsn_code,
            country_of_origin,
            len(remedies),
            [r["type"] for r in remedies],
        )
        return remedies

    def compute_add_amount(
        self,
        assessable_value_inr: Decimal,
        hsn_code: str,
        country_of_origin: Optional[str],
        quantity: Optional[Decimal] = None,
        unit: Optional[str] = None,
    ) -> tuple[Decimal, Decimal, str | None]:
        """
        Compute ADD amount.

        Returns (add_rate, add_amount_inr, notification_number).
        """
        remedies = self.get_applicable_remedies(hsn_code, country_of_origin)
        for r in remedies:
            if r["type"] == "ADD":
                if r["rate_type"] == "AD_VALOREM":
                    amount = (assessable_value_inr * r["rate"] / Decimal("100")).quantize(
                        Decimal("0.01")
                    )
                elif r["rate_type"] == "SPECIFIC" and quantity:
                    amount = (r["rate"] * quantity).quantize(Decimal("0.01"))
                else:
                    amount = Decimal("0")
                return r["rate"], amount, r["notification"]

        return Decimal("0"), Decimal("0"), None

    def compute_cvd_sgd_amount(
        self,
        assessable_value_inr: Decimal,
        hsn_code: str,
        country_of_origin: Optional[str],
    ) -> dict:
        """
        Compute CVD and SGD amounts.

        Returns {"cvd_rate", "cvd_amount", "sgd_rate", "sgd_amount"}.
        """
        result = {
            "cvd_rate": Decimal("0"),
            "cvd_amount": Decimal("0"),
            "sgd_rate": Decimal("0"),
            "sgd_amount": Decimal("0"),
        }
        remedies = self.get_applicable_remedies(hsn_code, country_of_origin)
        for r in remedies:
            if r["type"] == "CVD":
                result["cvd_rate"] = r["rate"]
                result["cvd_amount"] = (
                    assessable_value_inr * r["rate"] / Decimal("100")
                ).quantize(Decimal("0.01"))
            elif r["type"] == "SGD":
                result["sgd_rate"] = r["rate"]
                result["sgd_amount"] = (
                    assessable_value_inr * r["rate"] / Decimal("100")
                ).quantize(Decimal("0.01"))
        return result

    # ── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _hsn_variants(hsn_code: str) -> list[str]:
        """Return [8-digit, 6-digit, 4-digit, 2-digit] variants for broader match."""
        code = hsn_code.replace(" ", "").replace(".", "")
        variants: list[str] = []
        for length in (8, 6, 4, 2):
            if len(code) >= length:
                variants.append(code[:length])
        # deduplicate while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for v in variants:
            if v not in seen:
                seen.add(v)
                unique.append(v)
        return unique
