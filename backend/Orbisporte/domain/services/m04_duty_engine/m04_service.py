"""
M04 Duty Computation Engine — Main Orchestrator
================================================
Implements SOP DUTY-001 to DUTY-008 exactly as specified.

Worked Example (from SOP Page 4)
---------------------------------
  FOB Cost   : USD 10,000
  Freight    : USD  1,200
  Insurance  : USD    200
  HSN        : 85044030
  Country    : China (CN)
  Exchange   : 1 USD = INR 83.00

  CIF           = 10,000 + 1,200 + 200      = USD 11,400
  AV (INR)      = 11,400 × 83               = INR 9,46,200
  BCD (10%)     = 9,46,200 × 10%            = INR    94,620
  SWS (10%BCD)  = 94,620 × 10%              = INR     9,462
  IGST (18%)    = (9,46,200+94,620+9,462) × 18%
                = 10,50,282 × 18%           = INR 1,89,051
  ADD           = per DGTR notification
  ─────────────────────────────────────────────────────────
  Total Duty    = BCD + SWS + IGST + ADD

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .anomaly import validate_cif_components
from .exchange_rate import ExchangeRateService
from .fta_engine import FTAEngine
from .trade_remedy import TradeRemedyEngine

logger = logging.getLogger(__name__)

_ROUND2 = Decimal("0.01")
_SWS_RATE = Decimal("10.00")   # Social Welfare Surcharge: 10% of BCD (deterministic)


def _r(amount: Decimal) -> Decimal:
    """Round to ₹1 precision (2 decimal places, ROUND_HALF_UP)."""
    return amount.quantize(_ROUND2, rounding=ROUND_HALF_UP)


class M04DutyEngine:
    """
    Full SOP-compliant duty computation.

    Each call to ``compute()`` returns a rich result dict containing:
      - all 8 SOP steps
      - step-by-step formula text
      - exchange rate used and source
      - FTA eligibility result
      - ADD / CVD / SGD trade remedy amounts
      - total duty and total payable
      - computation UUID for audit trail
    """

    def __init__(self, db: Session):
        self.db = db
        self._fx = ExchangeRateService(db)
        self._fta = FTAEngine(db)
        self._remedy = TradeRemedyEngine(db)

    # ────────────────────────────────────────────────────────────────────────
    # Public API
    # ────────────────────────────────────────────────────────────────────────

    def compute(
        self,
        *,
        # SOP Step 1 inputs
        fob_cost: float,
        freight: float,
        insurance: float,
        hsn_code: str,
        country_of_origin: Optional[str] = None,
        input_currency: str = "USD",
        # Optional overrides
        exchange_rate_override: Optional[float] = None,
        port_code: Optional[str] = None,
        quantity: Optional[float] = None,
        unit: Optional[str] = None,
        product_description: Optional[str] = None,
        as_of_date: Optional[date] = None,
        # Audit
        user_id: Optional[int] = None,
        document_id: Optional[int] = None,
    ) -> dict:
        """
        Execute full M04 duty computation and return a comprehensive result.
        """
        start = datetime.now()
        comp_uuid = str(uuid.uuid4())
        if as_of_date is None:
            as_of_date = date.today()

        fob = Decimal(str(fob_cost))
        frg = Decimal(str(freight))
        ins = Decimal(str(insurance))
        qty = Decimal(str(quantity)) if quantity else None

        steps: list[str] = []
        steps.append("=" * 60)
        steps.append("M04 DUTY COMPUTATION ENGINE  (SOP DUTY-001 to DUTY-008)")
        steps.append("=" * 60)

        # ── STEP 1: CIF ─────────────────────────────────────────────────────
        cif_foreign = fob + frg + ins
        steps.append("")
        steps.append(f"STEP 1 — CIF Value (SOP DUTY-001)")
        steps.append(f"  CIF = FOB Cost + Freight + Insurance")
        steps.append(f"  CIF = {input_currency} {fob:,.4f} + {frg:,.4f} + {ins:,.4f}")
        steps.append(f"  CIF = {input_currency} {cif_foreign:,.4f}")

        # SOP Step 1 enhancement: validate freight / insurance vs. lane benchmarks
        anomaly_result = validate_cif_components(fob, frg, ins, country_of_origin)
        if anomaly_result["has_anomalies"]:
            steps.append(f"  ⚠  {len(anomaly_result['anomalies'])} anomaly flag(s) detected:")
            for a in anomaly_result["anomalies"]:
                steps.append(f"     [{a['severity'].upper()}] {a['code']}: {a['message']}")

        # ── STEP 2: Assessable Value (FX) ───────────────────────────────────
        if exchange_rate_override:
            ex_rate = Decimal(str(exchange_rate_override))
            ex_source = "MANUAL"
        else:
            ex_rate, ex_source = self._fx.get_rate_inr(input_currency, as_of_date)

        av_inr = _r(cif_foreign * ex_rate)
        steps.append("")
        steps.append(f"STEP 2 — Assessable Value / AV  (SOP DUTY-002)")
        steps.append(f"  Exchange Rate: 1 {input_currency} = ₹{ex_rate:.4f}  [Source: {ex_source}]")
        steps.append(f"  AV (INR) = CIF × Exchange Rate")
        steps.append(f"  AV = {input_currency} {cif_foreign:,.4f} × {ex_rate:.4f} = ₹{av_inr:,.2f}")

        # ── STEP 3: BCD ─────────────────────────────────────────────────────
        bcd_rate, fta_agreement = self._get_bcd_rate(
            hsn_code, country_of_origin, as_of_date, product_description
        )
        bcd_amount = _r(av_inr * bcd_rate / Decimal("100"))
        steps.append("")
        steps.append(f"STEP 3 — Basic Customs Duty / BCD  (SOP DUTY-003)")
        if fta_agreement:
            steps.append(f"  FTA Preferential Rate applies ({fta_agreement})")
        steps.append(f"  BCD Rate: {bcd_rate}%  [HSN: {hsn_code}, COO: {country_of_origin or 'ANY'}]")
        steps.append(f"  BCD = AV × BCD Rate")
        steps.append(f"  BCD = ₹{av_inr:,.2f} × {bcd_rate}% = ₹{bcd_amount:,.2f}")

        # ── STEP 4: SWS ─────────────────────────────────────────────────────
        sws_amount = _r(bcd_amount * _SWS_RATE / Decimal("100")) if bcd_amount > 0 else Decimal("0")
        steps.append("")
        steps.append(f"STEP 4 — Social Welfare Surcharge / SWS  (SOP DUTY-004)")
        steps.append(f"  SWS = 10% × BCD  [deterministic]")
        steps.append(f"  SWS = 10% × ₹{bcd_amount:,.2f} = ₹{sws_amount:,.2f}")

        # ── STEP 5: IGST ────────────────────────────────────────────────────
        igst_rate = self._get_igst_rate(hsn_code, as_of_date)
        igst_base = av_inr + bcd_amount + sws_amount
        igst_amount = _r(igst_base * igst_rate / Decimal("100"))
        steps.append("")
        steps.append(f"STEP 5 — Integrated GST / IGST  (SOP DUTY-005)")
        steps.append(f"  IGST Base = AV + BCD + SWS")
        steps.append(
            f"  IGST Base = ₹{av_inr:,.2f} + ₹{bcd_amount:,.2f} + ₹{sws_amount:,.2f}"
            f" = ₹{igst_base:,.2f}"
        )
        steps.append(f"  IGST Rate: {igst_rate}%  [GSTN]")
        steps.append(f"  IGST = ₹{igst_base:,.2f} × {igst_rate}% = ₹{igst_amount:,.2f}")

        # ── STEP 6: ADD ─────────────────────────────────────────────────────
        add_rate, add_amount, add_notif = self._remedy.compute_add_amount(
            av_inr, hsn_code, country_of_origin, qty, unit
        )
        steps.append("")
        steps.append(f"STEP 6 — Anti-Dumping Duty / ADD  (SOP DUTY-006)")
        if add_amount > 0:
            steps.append(f"  ADD Rate: {add_rate}%  [Notification: {add_notif}]")
            steps.append(f"  ADD = ₹{av_inr:,.2f} × {add_rate}% = ₹{add_amount:,.2f}")
        else:
            steps.append(f"  ADD: NIL  (no active DGTR notification for HSN {hsn_code} / {country_of_origin or 'ANY'})")

        # ── STEP 7: CVD / SGD ───────────────────────────────────────────────
        cvd_sgd = self._remedy.compute_cvd_sgd_amount(av_inr, hsn_code, country_of_origin)
        cvd_amount = cvd_sgd["cvd_amount"]
        sgd_amount = cvd_sgd["sgd_amount"]
        steps.append("")
        steps.append(f"STEP 7 — Countervailing / Safeguard Duty  (SOP DUTY-007)")
        if cvd_amount > 0:
            steps.append(f"  CVD: {cvd_sgd['cvd_rate']}% → ₹{cvd_amount:,.2f}")
        if sgd_amount > 0:
            steps.append(f"  SGD: {cvd_sgd['sgd_rate']}% → ₹{sgd_amount:,.2f}")
        if cvd_amount == 0 and sgd_amount == 0:
            steps.append(f"  CVD / SGD: NIL")

        # ── STEP 8: FTA Exemption ────────────────────────────────────────────
        fta_result = self._fta.check_fta_eligibility(
            hsn_code, country_of_origin, as_of_date, product_description
        )
        fta_saving = Decimal("0")
        if fta_result.get("eligible") and fta_agreement:
            mfn_bcd = self._get_mfn_bcd_rate(hsn_code, as_of_date)
            mfn_bcd_amount = _r(av_inr * mfn_bcd / Decimal("100"))
            fta_saving = _r(mfn_bcd_amount - bcd_amount)
            fta_result["savings_vs_mfn"] = float(fta_saving)

        steps.append("")
        steps.append(f"STEP 8 — FTA / Rules of Origin  (SOP DUTY-008)")
        if fta_result.get("eligible"):
            steps.append(
                f"  FTA Applicable: {fta_result['agreement_code']} — "
                f"{fta_result['agreement_name']}"
            )
            steps.append(f"  Preferential BCD: {fta_result['preferential_bcd']}%")
            steps.append(f"  RoO Eligible: {fta_result.get('roo_eligible')}")
            if fta_saving > 0:
                steps.append(f"  Duty Saving vs MFN: ₹{fta_saving:,.2f}")
        else:
            steps.append(f"  FTA: Not applicable  ({fta_result.get('llm_reasoning', '')})")

        # ── Total ────────────────────────────────────────────────────────────
        total_duty = _r(bcd_amount + sws_amount + igst_amount + add_amount + cvd_amount + sgd_amount)
        total_payable = _r(av_inr + total_duty)

        steps.append("")
        steps.append("─" * 60)
        steps.append("TOTAL DUTY SUMMARY")
        steps.append("─" * 60)
        steps.append(f"  Assessable Value (AV) : ₹{av_inr:>14,.2f}")
        steps.append(f"  BCD ({bcd_rate}%)          : ₹{bcd_amount:>14,.2f}")
        steps.append(f"  SWS (10% of BCD)      : ₹{sws_amount:>14,.2f}")
        steps.append(f"  IGST ({igst_rate}%)         : ₹{igst_amount:>14,.2f}")
        if add_amount > 0:
            steps.append(f"  ADD                   : ₹{add_amount:>14,.2f}")
        if cvd_amount > 0:
            steps.append(f"  CVD                   : ₹{cvd_amount:>14,.2f}")
        if sgd_amount > 0:
            steps.append(f"  SGD                   : ₹{sgd_amount:>14,.2f}")
        steps.append(f"  {'─'*32}")
        steps.append(f"  TOTAL DUTY            : ₹{total_duty:>14,.2f}")
        steps.append(f"  TOTAL PAYABLE (AV+Duty): ₹{total_payable:>13,.2f}")
        steps.append("=" * 60)

        formula_text = "\n".join(steps)
        elapsed_ms = int((datetime.now() - start).total_seconds() * 1000)

        sop_steps = {
            "step1_cif": {
                "label": "CIF Value",
                "fob_cost": float(fob),
                "freight": float(frg),
                "insurance": float(ins),
                "cif_foreign": float(cif_foreign),
                "currency": input_currency,
            },
            "step2_av": {
                "label": "Assessable Value",
                "exchange_rate": float(ex_rate),
                "exchange_rate_source": ex_source,
                "exchange_rate_date": as_of_date.isoformat(),
                "assessable_value_inr": float(av_inr),
            },
            "step3_bcd": {
                "label": "Basic Customs Duty",
                "bcd_rate": float(bcd_rate),
                "bcd_amount": float(bcd_amount),
                "fta_agreement": fta_agreement,
            },
            "step4_sws": {
                "label": "Social Welfare Surcharge",
                "sws_rate": float(_SWS_RATE),
                "sws_amount": float(sws_amount),
            },
            "step5_igst": {
                "label": "Integrated GST",
                "igst_base": float(igst_base),
                "igst_rate": float(igst_rate),
                "igst_amount": float(igst_amount),
            },
            "step6_add": {
                "label": "Anti-Dumping Duty",
                "add_rate": float(add_rate),
                "add_amount": float(add_amount),
                "notification": add_notif,
            },
            "step7_cvd_sgd": {
                "label": "CVD / Safeguard Duty",
                "cvd_rate": float(cvd_sgd["cvd_rate"]),
                "cvd_amount": float(cvd_amount),
                "sgd_rate": float(cvd_sgd["sgd_rate"]),
                "sgd_amount": float(sgd_amount),
            },
            "step8_fta": {
                "label": "FTA / Rules of Origin",
                "eligible": fta_result.get("eligible"),
                "agreement_code": fta_result.get("agreement_code"),
                "agreement_name": fta_result.get("agreement_name"),
                "preferential_bcd": (
                    float(fta_result["preferential_bcd"])
                    if fta_result.get("preferential_bcd") is not None
                    else None
                ),
                "roo_eligible": fta_result.get("roo_eligible"),
                "savings_vs_mfn": fta_result.get("savings_vs_mfn"),
            },
        }

        result: dict = {
            "computation_uuid": comp_uuid,
            # Inputs
            "fob_cost": float(fob),
            "freight": float(frg),
            "insurance": float(ins),
            "cif_foreign": float(cif_foreign),
            "input_currency": input_currency,
            "hsn_code": hsn_code,
            "country_of_origin": country_of_origin,
            "port_code": port_code,
            "quantity": float(qty) if qty else None,
            "unit": unit,
            # Exchange rate
            "exchange_rate": float(ex_rate),
            "exchange_rate_source": ex_source,
            # Assessable Value
            "assessable_value_inr": float(av_inr),
            # Step 1 anomaly flags
            "anomaly_flags": anomaly_result,
            # Duty components
            "duties": {
                "bcd_rate": float(bcd_rate),
                "bcd_amount": float(bcd_amount),
                "sws_rate": float(_SWS_RATE),
                "sws_amount": float(sws_amount),
                "igst_base": float(igst_base),
                "igst_rate": float(igst_rate),
                "igst_amount": float(igst_amount),
                "add_rate": float(add_rate),
                "add_amount": float(add_amount),
                "add_notification": add_notif,
                "cvd_rate": float(cvd_sgd["cvd_rate"]),
                "cvd_amount": float(cvd_amount),
                "sgd_rate": float(cvd_sgd["sgd_rate"]),
                "sgd_amount": float(sgd_amount),
            },
            # FTA
            "fta": fta_result,
            # Totals
            "total_duty_inr": float(total_duty),
            "total_payable_inr": float(total_payable),
            # Audit
            "sop_steps": sop_steps,
            "formula_text": formula_text,
            "calculation_time_ms": elapsed_ms,
            "computed_at": datetime.now().isoformat(),
        }

        # Persist to DB
        if user_id or document_id:
            try:
                self._save(result, sop_steps, user_id, document_id)
            except Exception as exc:
                logger.error("[M04] Failed to save computation: %s", exc)

        return result

    # ────────────────────────────────────────────────────────────────────────
    # Rate lookups (delegates to duty_rates table, same as M05 calculator)
    # ────────────────────────────────────────────────────────────────────────

    def _get_bcd_rate(
        self,
        hsn_code: str,
        country: Optional[str],
        as_of_date: date,
        product_description: Optional[str],
    ) -> tuple[Decimal, Optional[str]]:
        """Return (effective_bcd_rate, fta_agreement_or_None)."""
        mfn_rate = self._get_mfn_bcd_rate(hsn_code, as_of_date)
        effective_rate, fta_code = self._fta.get_fta_bcd_rate(hsn_code, country, mfn_rate)
        return effective_rate, fta_code

    def _get_mfn_bcd_rate(self, hsn_code: str, as_of_date: date) -> Decimal:
        """
        Fetch MFN BCD rate from duty_rates table.
        Cascades 8-digit → 6-digit → 4-digit → 2-digit when no exact match.
        Returns Decimal("0") if nothing found (e.g., freely importable goods).
        """
        return self._lookup_duty_rate(hsn_code, "BCD", as_of_date, default=Decimal("0"))

    def _get_igst_rate(self, hsn_code: str, as_of_date: date) -> Decimal:
        """
        Fetch IGST rate from duty_rates table.
        Cascades 8-digit → 6-digit → 4-digit → 2-digit when no exact match.
        Falls back to 18% (standard IGST rate) if HSN not found in table.
        """
        return self._lookup_duty_rate(hsn_code, "IGST", as_of_date, default=Decimal("18.00"))

    def _lookup_duty_rate(
        self, hsn_code: str, duty_type: str, as_of_date: date, default: Decimal
    ) -> Decimal:
        """
        Generic HSN-hierarchy rate lookup.
        Tries 8-digit exact match first, then 6, 4, 2 digit prefixes.
        Returns the first match found, or `default` if none.
        """
        code = hsn_code.replace(" ", "").replace(".", "")
        for length in (8, 6, 4, 2):
            if len(code) < length:
                continue
            variant = code[:length]
            try:
                row = self.db.execute(
                    text("""
                        SELECT rate_percent FROM duty_rates
                        WHERE hsn_code = :hsn
                          AND duty_type = :dtype
                          AND effective_from <= CAST(:d AS DATE)
                          AND (effective_to IS NULL OR effective_to >= CAST(:d AS DATE))
                        ORDER BY legal_priority DESC, effective_from DESC
                        LIMIT 1
                    """),
                    {"hsn": variant, "dtype": duty_type, "d": as_of_date.isoformat()},
                ).fetchone()
            except Exception as exc:
                # Missing/misconfigured DB tables should not crash the full duty workflow.
                # Roll back to clear aborted transactions, then return the safe default.
                logger.warning("[M04] Duty rate lookup failed for %s/%s: %s", variant, duty_type, exc)
                try:
                    self.db.rollback()
                except Exception:
                    pass
                return default
            if row:
                if length < len(code):
                    logger.info(
                        "[M04] %s rate: no %d-digit match for %s, resolved via %d-digit prefix %s",
                        duty_type, len(code), code, length, variant,
                    )
                return Decimal(str(row[0]))
        return default

    # ────────────────────────────────────────────────────────────────────────
    # Persistence
    # ────────────────────────────────────────────────────────────────────────

    def _save(self, result: dict, sop_steps: dict, user_id, document_id) -> None:
        import json as _json

        d = result["duties"]
        fta = result["fta"]

        self.db.execute(
            text("""
                INSERT INTO m04_duty_computations (
                    computation_uuid, user_id, document_id,
                    fob_cost, freight, insurance, cif_foreign, input_currency,
                    hsn_code, country_of_origin, port_code, quantity, unit,
                    exchange_rate, exchange_rate_source, exchange_rate_date,
                    assessable_value_inr,
                    bcd_rate, bcd_amount,
                    sws_rate, sws_amount,
                    igst_base, igst_rate, igst_amount,
                    add_rate, add_amount, add_notification_ref,
                    cvd_rate, cvd_amount,
                    sgd_rate, sgd_amount,
                    fta_applicable, fta_agreement_code, fta_preferential_bcd,
                    fta_roo_eligible, fta_exemption_amount,
                    total_duty_inr, total_payable_inr,
                    sop_steps_json, formula_text, anomaly_flags, calculation_time_ms
                ) VALUES (
                    :uuid, :uid, :did,
                    :fob, :frg, :ins, :cif_f, :cur,
                    :hsn, :coo, :port, :qty, :unit,
                    :exr, :exs, CAST(:exd AS DATE),
                    :av,
                    :bcd_r, :bcd_a,
                    :sws_r, :sws_a,
                    :igst_b, :igst_r, :igst_a,
                    :add_r, :add_a, :add_n,
                    :cvd_r, :cvd_a,
                    :sgd_r, :sgd_a,
                    :fta_app, :fta_code, :fta_pbcd,
                    :fta_roo, :fta_save,
                    :total_d, :total_p,
                    CAST(:sop_j AS JSONB), :formula, CAST(:anomaly_j AS JSONB), :ms
                )
            """),
            {
                "uuid": result["computation_uuid"],
                "uid": user_id,
                "did": document_id,
                "fob": result["fob_cost"],
                "frg": result["freight"],
                "ins": result["insurance"],
                "cif_f": result["cif_foreign"],
                "cur": result["input_currency"],
                "hsn": result["hsn_code"],
                "coo": result["country_of_origin"],
                "port": result["port_code"],
                "qty": result["quantity"],
                "unit": result["unit"],
                "exr": result["exchange_rate"],
                "exs": result["exchange_rate_source"],
                "exd": datetime.now().date().isoformat(),
                "av": result["assessable_value_inr"],
                "bcd_r": d["bcd_rate"],
                "bcd_a": d["bcd_amount"],
                "sws_r": d["sws_rate"],
                "sws_a": d["sws_amount"],
                "igst_b": d["igst_base"],
                "igst_r": d["igst_rate"],
                "igst_a": d["igst_amount"],
                "add_r": d["add_rate"],
                "add_a": d["add_amount"],
                "add_n": d["add_notification"],
                "cvd_r": d["cvd_rate"],
                "cvd_a": d["cvd_amount"],
                "sgd_r": d["sgd_rate"],
                "sgd_a": d["sgd_amount"],
                "fta_app": bool(fta.get("eligible")),
                "fta_code": fta.get("agreement_code"),
                "fta_pbcd": (
                    float(fta["preferential_bcd"])
                    if fta.get("preferential_bcd") is not None
                    else None
                ),
                "fta_roo": fta.get("roo_eligible"),
                "fta_save": fta.get("savings_vs_mfn"),
                "total_d": result["total_duty_inr"],
                "total_p": result["total_payable_inr"],
                "sop_j": _json.dumps(sop_steps),
                "formula": result["formula_text"],
                "anomaly_j": _json.dumps(result.get("anomaly_flags") or {}),
                "ms": result["calculation_time_ms"],
            },
        )
        self.db.commit()

    # ────────────────────────────────────────────────────────────────────────
    # Helpers for routes
    # ────────────────────────────────────────────────────────────────────────

    def get_computation_history(
        self, user_id: int, limit: int = 20
    ) -> list[dict]:
        rows = self.db.execute(
            text("""
                SELECT computation_uuid, hsn_code, input_currency, cif_foreign,
                       exchange_rate, assessable_value_inr,
                       bcd_amount, sws_amount, igst_amount, add_amount,
                       total_duty_inr, total_payable_inr,
                       fta_applicable, fta_agreement_code,
                       computed_at
                FROM m04_duty_computations
                WHERE user_id = :uid
                ORDER BY computed_at DESC
                LIMIT :lim
            """),
            {"uid": user_id, "lim": limit},
        ).fetchall()

        return [
            {
                "computation_uuid": str(r[0]),
                "hsn_code": r[1],
                "input_currency": r[2],
                "cif_foreign": float(r[3]) if r[3] else None,
                "exchange_rate": float(r[4]) if r[4] else None,
                "assessable_value_inr": float(r[5]) if r[5] else None,
                "bcd_amount": float(r[6]) if r[6] else None,
                "sws_amount": float(r[7]) if r[7] else None,
                "igst_amount": float(r[8]) if r[8] else None,
                "add_amount": float(r[9]) if r[9] else None,
                "total_duty_inr": float(r[10]) if r[10] else None,
                "total_payable_inr": float(r[11]) if r[11] else None,
                "fta_applicable": r[12],
                "fta_agreement_code": r[13],
                "computed_at": r[14].isoformat() if r[14] else None,
            }
            for r in rows
        ]

    def get_computation_by_uuid(self, comp_uuid: str) -> Optional[dict]:
        row = self.db.execute(
            text("""
                SELECT sop_steps_json, formula_text, computation_uuid,
                       hsn_code, total_duty_inr, total_payable_inr, computed_at
                FROM m04_duty_computations
                WHERE computation_uuid = CAST(:uuid AS UUID)
            """),
            {"uuid": comp_uuid},
        ).fetchone()

        if not row:
            return None

        return {
            "computation_uuid": str(row[2]),
            "hsn_code": row[3],
            "total_duty_inr": float(row[4]) if row[4] else None,
            "total_payable_inr": float(row[5]) if row[5] else None,
            "computed_at": row[6].isoformat() if row[6] else None,
            "sop_steps": row[0],
            "formula_text": row[1],
        }
