"""
M04 Duty Computation Engine API
================================
Endpoints
---------
  POST  /m04/compute              Full SOP duty computation (Step 1–8)
  GET   /m04/exchange-rate/{ccy}  Live exchange rate for a currency
  POST  /m04/fta-check            FTA / Rules of Origin eligibility check
  GET   /m04/trade-remedies       ADD / CVD / SGD active notifications for HSN+COO
  GET   /m04/history              User's computation history
  GET   /m04/result/{uuid}        Retrieve stored computation by UUID
  GET   /m04/currencies           Supported currencies with fallback rates

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from Orbisporte.infrastructure.db import get_db, UserRepository
from Orbisporte.interfaces.api.auth import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/m04", tags=["M04 Duty Computation Engine"])


# ── Auth helper (same pattern as M03) ─────────────────────────────────────

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = UserRepository.get_by_id(db, int(payload.get("sub")))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Service factory ──────────────────────────────────────────────────────────

def _get_engine(db: Session):
    from Orbisporte.domain.services.m04_duty_engine import M04DutyEngine
    return M04DutyEngine(db)


# ── Request / Response schemas ────────────────────────────────────────────────

class ComputeRequest(BaseModel):
    """SOP DUTY-001 to DUTY-008 full computation request."""

    # Step 1 — CIF inputs
    fob_cost: float = Field(..., gt=0, description="FOB cost in input_currency")
    freight: float = Field(0.0, ge=0, description="Freight cost in input_currency")
    insurance: float = Field(0.0, ge=0, description="Insurance cost in input_currency")
    input_currency: str = Field("USD", description="ISO 4217 currency code, e.g. USD")

    # Classification
    hsn_code: str = Field(..., min_length=4, max_length=10, description="HSN/HS code (4–10 digits)")
    country_of_origin: Optional[str] = Field(None, description="ISO 3-letter country code, e.g. CHN")

    # Optional overrides / context
    exchange_rate_override: Optional[float] = Field(None, gt=0, description="Manual exchange rate (INR per unit)")
    port_code: Optional[str] = Field(None, description="Port of import code, e.g. INMAA1")
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, description="Unit of measure, e.g. PCS, KG, MT")
    product_description: Optional[str] = Field(None, description="Used for FTA RoO check via LLM")
    document_id: Optional[int] = None

    @validator("hsn_code")
    def clean_hsn(cls, v: str) -> str:
        return v.replace(" ", "").replace(".", "").strip()

    @validator("input_currency")
    def upper_currency(cls, v: str) -> str:
        return v.upper().strip()

    @validator("country_of_origin")
    def upper_country(cls, v: Optional[str]) -> Optional[str]:
        return v.upper().strip() if v else None


class FTACheckRequest(BaseModel):
    hsn_code: str = Field(..., min_length=4, max_length=10)
    country_of_origin: str = Field(..., min_length=2, max_length=3)
    product_description: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/compute", summary="Full M04 duty computation (SOP DUTY-001 to DUTY-008)")
async def compute_duty(
    request: ComputeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Execute the complete M04 duty computation workflow:

    1. **CIF** = FOB Cost + Freight + Insurance
    2. **AV** = CIF × Exchange Rate (INR) — live rate from RBI API
    3. **BCD** = AV × BCD Rate% — from tariff DB (FTA rate if applicable)
    4. **SWS** = 10% × BCD — deterministic
    5. **IGST** = (AV + BCD + SWS) × GST Rate%
    6. **ADD** = per active DGTR notification
    7. **CVD/SGD** = per Ministry of Finance notification
    8. **FTA** = Rules of Origin check (GPT-4o-mini)

    Returns full step-by-step breakdown, audit trail, and computation UUID.
    """
    try:
        engine = _get_engine(db)
        result = engine.compute(
            fob_cost=request.fob_cost,
            freight=request.freight,
            insurance=request.insurance,
            input_currency=request.input_currency,
            hsn_code=request.hsn_code,
            country_of_origin=request.country_of_origin,
            exchange_rate_override=request.exchange_rate_override,
            port_code=request.port_code,
            quantity=request.quantity,
            unit=request.unit,
            product_description=request.product_description,
            user_id=current_user.id,
            document_id=request.document_id,
        )
        logger.info(
            "[M04] Computed duty for HSN %s | Total: ₹%s | UUID: %s",
            request.hsn_code,
            result.get("total_duty_inr"),
            result.get("computation_uuid"),
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("[M04] compute failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Duty computation failed: {exc}")


@router.get(
    "/exchange-rate/{currency}",
    summary="Get live INR exchange rate for a currency",
)
async def get_exchange_rate(
    currency: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Fetch the INR exchange rate for the given currency code.
    Priority: DB cache → RBI FBIL → Open Exchange Rates → fallback table.
    """
    from Orbisporte.domain.services.m04_duty_engine.exchange_rate import ExchangeRateService

    try:
        svc = ExchangeRateService(db)
        rate, source = svc.get_rate_inr(currency.upper())
        return {
            "currency": currency.upper(),
            "rate_inr": float(rate),
            "source": source,
            "description": f"1 {currency.upper()} = ₹{rate:.4f}",
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.exception("[M04] exchange rate fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch exchange rate: {exc}")


@router.post("/fta-check", summary="FTA / Rules of Origin eligibility check")
async def fta_check(
    request: FTACheckRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Check whether a product qualifies for preferential BCD under any FTA
    India is party to.  Uses GPT-4o-mini to verify Rules of Origin when
    criteria text is available.
    """
    from Orbisporte.domain.services.m04_duty_engine.fta_engine import FTAEngine

    try:
        engine = FTAEngine(db)
        result = engine.check_fta_eligibility(
            hsn_code=request.hsn_code.replace(" ", ""),
            country_of_origin=request.country_of_origin.upper(),
            product_description=request.product_description,
        )
        return result
    except Exception as exc:
        logger.exception("[M04] FTA check failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"FTA check failed: {exc}")


@router.get("/trade-remedies", summary="Active ADD/CVD/SGD notifications for an HSN+COO")
async def get_trade_remedies(
    hsn_code: str = Query(..., min_length=4),
    country_of_origin: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Return all active trade remedy notifications (ADD / CVD / SGD) for
    the given HSN code and country of origin.
    """
    from Orbisporte.domain.services.m04_duty_engine.trade_remedy import TradeRemedyEngine

    try:
        engine = TradeRemedyEngine(db)
        remedies = engine.get_applicable_remedies(
            hsn_code=hsn_code.replace(" ", ""),
            country_of_origin=country_of_origin,
        )
        return {
            "hsn_code": hsn_code,
            "country_of_origin": country_of_origin,
            "remedies": remedies,
            "count": len(remedies),
        }
    except Exception as exc:
        logger.exception("[M04] trade remedies lookup failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Trade remedies lookup failed: {exc}")


@router.get("/history", summary="User's M04 computation history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the authenticated user's recent M04 duty computations."""
    try:
        engine = _get_engine(db)
        history = engine.get_computation_history(current_user.id, limit)
        return {"computations": history, "count": len(history)}
    except Exception as exc:
        logger.exception("[M04] history fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {exc}")


@router.get("/result/{computation_uuid}", summary="Retrieve stored computation by UUID")
async def get_result(
    computation_uuid: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve a previously stored M04 computation by its UUID."""
    try:
        engine = _get_engine(db)
        result = engine.get_computation_by_uuid(computation_uuid)
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Computation {computation_uuid} not found",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("[M04] result fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch result: {exc}")


@router.get("/currencies", summary="Supported currencies with fallback exchange rates")
async def get_currencies(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the list of supported input currencies and their fallback INR rates."""
    from Orbisporte.domain.services.m04_duty_engine.exchange_rate import ExchangeRateService

    svc = ExchangeRateService(db)
    currencies = svc.get_all_supported_currencies()
    return {"currencies": currencies}
