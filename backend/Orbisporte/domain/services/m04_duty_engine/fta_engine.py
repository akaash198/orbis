"""
M04 — FTA / Rules of Origin Engine  (SOP Step 8)
==================================================
Determines whether a shipment qualifies for preferential BCD under any
Free Trade Agreement India is party to.

Logic:
  1. Check if country_of_origin is a partner in any active FTA.
  2. Look up preferential BCD rate for the HSN code under that agreement.
  3. Optionally call GPT-4o-mini to verify Rules of Origin eligibility.

Author: OrbisPorté Development Team
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class FTAEngine:
    """
    FTA eligibility checker.

    Usage::

        engine = FTAEngine(db)
        result = engine.check_fta_eligibility("85044030", "KOR")
        # → {"eligible": True, "agreement": "CEPA-KR", "preferential_bcd": Decimal("5.0"), ...}
    """

    def __init__(self, db: Session):
        self.db = db

    # ── Public API ──────────────────────────────────────────────────────────

    def check_fta_eligibility(
        self,
        hsn_code: str,
        country_of_origin: Optional[str],
        as_of_date: Optional[date] = None,
        product_description: Optional[str] = None,
    ) -> dict:
        """
        Check FTA eligibility for a given HSN + COO.

        Returns::

            {
              "eligible": bool,
              "agreement_code": str | None,
              "agreement_name": str | None,
              "preferential_bcd": Decimal | None,
              "roo_criteria": str | None,
              "roo_eligible": bool | None,      # None = not verified
              "llm_reasoning": str | None,
              "savings_vs_mfn": Decimal | None,
            }
        """
        if not country_of_origin:
            return self._no_fta("No country of origin provided")

        country = country_of_origin.upper().strip()
        if as_of_date is None:
            as_of_date = date.today()

        # 1. Find applicable FTA agreements for this country
        agreements = self._get_agreements_for_country(country, as_of_date)
        if not agreements:
            return self._no_fta(f"Country {country} not in any active FTA")

        # 2. For each agreement, look for HSN-level preferential rate
        hsn_variants = self._hsn_variants(hsn_code)
        for agr in agreements:
            rate_row = self._get_preferential_rate(agr["id"], hsn_variants, as_of_date)
            if rate_row:
                roo_check = self._check_roo_llm(
                    hsn_code,
                    country,
                    agr["agreement_code"],
                    rate_row["roo_criteria"],
                    product_description,
                )
                return {
                    "eligible": True,
                    "agreement_code": agr["agreement_code"],
                    "agreement_name": agr["agreement_name"],
                    "preferential_bcd": rate_row["preferential_bcd"],
                    "roo_criteria": rate_row["roo_criteria"],
                    "roo_eligible": roo_check.get("eligible"),
                    "llm_reasoning": roo_check.get("reasoning"),
                    "savings_vs_mfn": None,  # caller fills this in
                }

        return self._no_fta(f"No preferential HSN rate found under any FTA for {country}")

    def get_fta_bcd_rate(
        self,
        hsn_code: str,
        country_of_origin: Optional[str],
        mfn_bcd_rate: Decimal,
    ) -> tuple[Decimal, Optional[str]]:
        """
        Return the effective BCD rate after FTA consideration.

        Returns (effective_bcd_rate, agreement_code_or_None).
        """
        result = self.check_fta_eligibility(hsn_code, country_of_origin)
        if result.get("eligible") and result.get("roo_eligible") is not False:
            pref = result["preferential_bcd"]
            if pref < mfn_bcd_rate:
                return pref, result["agreement_code"]
        return mfn_bcd_rate, None

    # ── DB Queries ──────────────────────────────────────────────────────────

    def _get_agreements_for_country(self, country: str, as_of_date: date) -> list[dict]:
        rows = self.db.execute(
            text("""
                SELECT id, agreement_code, agreement_name
                FROM m04_fta_agreements
                WHERE :country = ANY(partner_countries)
                  AND is_active = TRUE
                  AND effective_from <= CAST(:d AS DATE)
                  AND (effective_to IS NULL OR effective_to >= CAST(:d AS DATE))
                ORDER BY effective_from DESC
            """),
            {"country": country, "d": as_of_date.isoformat()},
        ).fetchall()
        return [{"id": r[0], "agreement_code": r[1], "agreement_name": r[2]} for r in rows]

    def _get_preferential_rate(
        self, agreement_id: int, hsn_variants: list[str], as_of_date: date
    ) -> Optional[dict]:
        row = self.db.execute(
            text("""
                SELECT preferential_bcd, roo_criteria, roo_threshold_pct
                FROM m04_fta_tariff_rates
                WHERE agreement_id = :aid
                  AND hsn_code = ANY(:hsns)
                  AND effective_from <= CAST(:d AS DATE)
                  AND (effective_to IS NULL OR effective_to >= CAST(:d AS DATE))
                ORDER BY
                    array_position(:hsns, hsn_code),  -- prefer longer match
                    effective_from DESC
                LIMIT 1
            """),
            {
                "aid": agreement_id,
                "hsns": hsn_variants,
                "d": as_of_date.isoformat(),
            },
        ).fetchone()

        if row:
            return {
                "preferential_bcd": Decimal(str(row[0])),
                "roo_criteria": row[1],
                "roo_threshold_pct": row[2],
            }
        return None

    # ── LLM RoO Check ───────────────────────────────────────────────────────

    def _check_roo_llm(
        self,
        hsn_code: str,
        country: str,
        agreement_code: str,
        roo_criteria: Optional[str],
        product_description: Optional[str],
    ) -> dict:
        """
        Use GPT-4o-mini to verify Rules of Origin eligibility.
        Returns {"eligible": bool | None, "reasoning": str}.
        Gracefully degrades if OpenAI key is absent.
        """
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if not openai_key or not roo_criteria:
            return {"eligible": None, "reasoning": "RoO check skipped (no key or criteria)"}

        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)

            prompt = f"""You are an expert in Indian customs and free trade agreement Rules of Origin (RoO).

Agreement: {agreement_code}
HSN Code: {hsn_code}
Country of Origin: {country}
Product: {product_description or "Not specified"}
RoO Criteria: {roo_criteria}

Based on the RoO criteria above, is this product likely eligible for preferential duty under this FTA?
Reply with a JSON object: {{"eligible": true/false/null, "reasoning": "brief explanation"}}
If you cannot determine eligibility from the information provided, set eligible to null."""

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(raw)
            return {
                "eligible": data.get("eligible"),
                "reasoning": data.get("reasoning", ""),
            }
        except Exception as exc:
            logger.warning("[M04][FTA] LLM RoO check failed: %s", exc)
            return {"eligible": None, "reasoning": f"LLM error: {exc}"}

    # ── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _no_fta(reason: str) -> dict:
        return {
            "eligible": False,
            "agreement_code": None,
            "agreement_name": None,
            "preferential_bcd": None,
            "roo_criteria": None,
            "roo_eligible": None,
            "llm_reasoning": reason,
            "savings_vs_mfn": None,
        }

    @staticmethod
    def _hsn_variants(hsn_code: str) -> list[str]:
        code = hsn_code.replace(" ", "").replace(".", "")
        variants: list[str] = []
        for length in (8, 6, 4, 2):
            if len(code) >= length:
                variants.append(code[:length])
        seen: set[str] = set()
        unique: list[str] = []
        for v in variants:
            if v not in seen:
                seen.add(v)
                unique.append(v)
        return unique
