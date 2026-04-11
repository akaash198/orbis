"""
Module 5: Duty Calculator Service
Purpose: Calculate customs duties (BCD, IGST, CESS, SWS) for imported goods
Based on: OrbisPorté Design Document - Duty Calculation Engine

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
Date: 2026-02-22
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple
from datetime import date, datetime
import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


class DutyCalculator:
    """
    Duty Calculator for Indian Customs

    Implements precise duty calculation formulas:
    - BCD (Basic Customs Duty) = CIF × BCD_rate
    - CESS = CIF × CESS_rate (or (CIF + BCD) × CESS_rate for some goods)
    - Assessable Value = CIF + BCD + CESS
    - IGST = Assessable Value × IGST_rate
    - SWS (Social Welfare Surcharge) = (BCD + CESS) × 10% (if applicable)

    All amounts rounded to ₹1 precision (2 decimal places)
    """

    # Social Welfare Surcharge rate (10% on BCD + applicable cess)
    SWS_RATE = Decimal('10.00')

    def __init__(self, db: Session):
        self.db = db

    def get_duty_rates(
        self,
        hsn_code: str,
        as_of_date: Optional[date] = None,
        port_code: Optional[str] = None,
        country_of_origin: Optional[str] = None
    ) -> Dict[str, Decimal]:
        """
        Fetch duty rates for a given HSN code

        Args:
            hsn_code: 4-10 digit HSN code
            as_of_date: Date for which to fetch rates (default: today)
            port_code: Specific port (optional)
            country_of_origin: ISO 3-letter country code (optional)

        Returns:
            Dict with duty types as keys and rates as values
            Example: {'BCD': Decimal('10.00'), 'IGST': Decimal('18.00')}
        """
        if as_of_date is None:
            as_of_date = date.today()

        # Convert date to string for proper parameter binding in raw SQL
        as_of_date_str = as_of_date.strftime('%Y-%m-%d') if isinstance(as_of_date, date) else str(as_of_date)

        logger.info(f"[DUTY] Querying duty rates: HSN={hsn_code}, date={as_of_date_str}, port={port_code}, country={country_of_origin}")

        # First, try a simple query to check if data exists at all
        test_query = text("SELECT COUNT(*) FROM duty_rates WHERE hsn_code = :hsn_code")
        test_result = self.db.execute(test_query, {'hsn_code': hsn_code})
        count = test_result.scalar()
        logger.info(f"[DUTY] Total records for HSN {hsn_code}: {count}")

        query = text("""
            SELECT duty_type, rate_percent
            FROM duty_rates
            WHERE hsn_code = :hsn_code
              AND effective_from <= CAST(:as_of_date AS DATE)
              AND (effective_to IS NULL OR effective_to >= CAST(:as_of_date AS DATE))
              AND (port_code IS NULL OR port_code = :port_code)
              AND (country_of_origin IS NULL OR country_of_origin = :country_of_origin)
            ORDER BY legal_priority DESC, effective_from DESC
        """)

        result = self.db.execute(query, {
            'hsn_code': hsn_code,
            'as_of_date': as_of_date_str,
            'port_code': port_code,
            'country_of_origin': country_of_origin
        })

        rates = {}
        for row in result:
            duty_type = row[0]
            rate = Decimal(str(row[1]))
            logger.info(f"[DUTY] Found rate: {duty_type} = {rate}%")
            # Only take the first (highest priority) rate for each duty type
            if duty_type not in rates:
                rates[duty_type] = rate

        logger.info(f"[DUTY] Found {len(rates)} duty rate(s) for HSN {hsn_code}: {list(rates.keys())}")

        if not rates:
            logger.warning(f"[DUTY] No rates found! Check: hsn_code='{hsn_code}', date={as_of_date_str}, port={port_code}, country={country_of_origin}")

        return rates

    def _round_currency(self, amount: Decimal) -> Decimal:
        """Round to ₹1 precision (2 decimal places)"""
        return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def calculate_duty(
        self,
        hsn_code: str,
        cif_value: Decimal,
        port_code: Optional[str] = None,
        country_of_origin: Optional[str] = None,
        quantity: Optional[Decimal] = None,
        unit: Optional[str] = None,
        user_id: Optional[int] = None,
        document_id: Optional[int] = None
    ) -> Dict:
        """
        Calculate all applicable duties for an import

        Args:
            hsn_code: HSN code of the product
            cif_value: CIF value in INR (Cost + Insurance + Freight)
            port_code: Port of import (e.g., 'INMAA1' for Mumbai)
            country_of_origin: ISO 3-letter code (e.g., 'CHN' for China)
            quantity: Quantity of goods
            unit: Unit of measurement (e.g., 'KG', 'PCS', 'MTR')
            user_id: User performing calculation (for audit)
            document_id: Associated document ID (optional)

        Returns:
            Dict containing:
            - All duty components (BCD, CESS, IGST, SWS, etc.)
            - Assessable value
            - Total duty
            - Formula breakdown (audit trail)
            - Calculation UUID
        """
        start_time = datetime.now()

        # Convert cif_value to Decimal if string
        if isinstance(cif_value, (int, float, str)):
            cif_value = Decimal(str(cif_value))

        # Fetch duty rates
        rates = self.get_duty_rates(
            hsn_code=hsn_code,
            port_code=port_code,
            country_of_origin=country_of_origin
        )

        if not rates:
            logger.warning(f"No duty rates found for HSN {hsn_code}")
            # Return zero duties if no rates found
            return {
                'error': f'No duty rates found for HSN code {hsn_code}',
                'hsn_code': hsn_code,
                'cif_value': float(cif_value),
                'rates_available': False
            }

        # Initialize calculation components
        bcd_rate = rates.get('BCD', Decimal('0'))
        cess_rate = rates.get('CESS', Decimal('0'))
        igst_rate = rates.get('IGST', Decimal('0'))
        add_rate = rates.get('ADD', Decimal('0'))  # Anti-Dumping Duty
        cvd_rate = rates.get('CVD', Decimal('0'))  # Countervailing Duty

        # Calculate BCD (Basic Customs Duty)
        bcd_amount = self._round_currency(cif_value * (bcd_rate / Decimal('100')))

        # Calculate CESS
        # Note: CESS can be on CIF or on (CIF + BCD) depending on the product
        # For now, using CIF as base (can be enhanced later)
        cess_amount = self._round_currency(cif_value * (cess_rate / Decimal('100')))

        # Calculate Assessable Value
        # Assessable Value = CIF + BCD + CESS + CVD
        cvd_amount = self._round_currency(cif_value * (cvd_rate / Decimal('100')))
        assessable_value = self._round_currency(cif_value + bcd_amount + cess_amount + cvd_amount)

        # Calculate IGST (on Assessable Value)
        igst_amount = self._round_currency(assessable_value * (igst_rate / Decimal('100')))

        # Calculate Social Welfare Surcharge (10% on BCD + applicable cess)
        # SWS applies only if BCD > 0
        sws_amount = Decimal('0')
        if bcd_amount > 0:
            sws_base = bcd_amount + cess_amount
            sws_amount = self._round_currency(sws_base * (self.SWS_RATE / Decimal('100')))

        # Calculate Anti-Dumping Duty (if applicable)
        add_amount = self._round_currency(cif_value * (add_rate / Decimal('100')))

        # Total Duty = BCD + CESS + IGST + SWS + ADD + CVD
        total_duty = self._round_currency(
            bcd_amount + cess_amount + igst_amount + sws_amount + add_amount + cvd_amount
        )

        # Build formula breakdown for audit trail
        formula_steps = []
        formula_steps.append(f"CIF Value: ₹{cif_value:,.2f}")
        formula_steps.append(f"")

        if bcd_amount > 0:
            formula_steps.append(f"BCD = ₹{cif_value:,.2f} × {bcd_rate}% = ₹{bcd_amount:,.2f}")

        if cess_amount > 0:
            formula_steps.append(f"CESS = ₹{cif_value:,.2f} × {cess_rate}% = ₹{cess_amount:,.2f}")

        if cvd_amount > 0:
            formula_steps.append(f"CVD = ₹{cif_value:,.2f} × {cvd_rate}% = ₹{cvd_amount:,.2f}")

        formula_steps.append(f"")
        formula_steps.append(
            f"Assessable Value = ₹{cif_value:,.2f} + ₹{bcd_amount:,.2f} + "
            f"₹{cess_amount:,.2f} + ₹{cvd_amount:,.2f} = ₹{assessable_value:,.2f}"
        )
        formula_steps.append(f"")

        if igst_amount > 0:
            formula_steps.append(
                f"IGST = ₹{assessable_value:,.2f} × {igst_rate}% = ₹{igst_amount:,.2f}"
            )

        if sws_amount > 0:
            formula_steps.append(
                f"SWS = (₹{bcd_amount:,.2f} + ₹{cess_amount:,.2f}) × 10% = ₹{sws_amount:,.2f}"
            )

        if add_amount > 0:
            formula_steps.append(f"ADD = ₹{cif_value:,.2f} × {add_rate}% = ₹{add_amount:,.2f}")

        formula_steps.append(f"")
        formula_steps.append(f"{'─' * 60}")
        formula_steps.append(
            f"Total Duty = ₹{bcd_amount:,.2f} + ₹{cess_amount:,.2f} + "
            f"₹{igst_amount:,.2f} + ₹{sws_amount:,.2f} + ₹{add_amount:,.2f} + "
            f"₹{cvd_amount:,.2f} = ₹{total_duty:,.2f}"
        )

        calculation_formula = "\n".join(formula_steps)

        # Calculate processing time
        end_time = datetime.now()
        calculation_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Prepare result
        result = {
            'calculation_uuid': str(uuid.uuid4()),
            'hsn_code': hsn_code,
            'cif_value': float(cif_value),
            'port_code': port_code,
            'country_of_origin': country_of_origin,
            'quantity': float(quantity) if quantity else None,
            'unit': unit,

            # Duty rates (percentages)
            'rates': {
                'bcd': float(bcd_rate),
                'cess': float(cess_rate),
                'igst': float(igst_rate),
                'sws': float(self.SWS_RATE) if sws_amount > 0 else 0.0,
                'add': float(add_rate),
                'cvd': float(cvd_rate)
            },

            # Duty amounts (INR)
            'duties': {
                'bcd': float(bcd_amount),
                'cess': float(cess_amount),
                'igst': float(igst_amount),
                'sws': float(sws_amount),
                'add': float(add_amount),
                'cvd': float(cvd_amount)
            },

            # Derived values
            'assessable_value': float(assessable_value),
            'total_duty': float(total_duty),
            'total_amount_payable': float(cif_value + total_duty),

            # Audit trail
            'formula': calculation_formula,
            'calculation_time_ms': calculation_time_ms,
            'calculated_at': datetime.now().isoformat(),

            # Metadata
            'rates_available': True,
            'rates_count': len(rates)
        }

        # Save calculation to database
        if user_id or document_id:
            try:
                self._save_calculation(result, user_id, document_id)
            except Exception as e:
                logger.error(f"Failed to save calculation: {e}")
                # Don't fail the calculation if saving fails

        return result

    def _save_calculation(
        self,
        calculation: Dict,
        user_id: Optional[int] = None,
        document_id: Optional[int] = None
    ):
        """Save calculation to duty_calculations table for audit trail"""
        insert_query = text("""
            INSERT INTO duty_calculations (
                calculation_uuid, user_id, document_id,
                hsn_code, cif_value, quantity, unit, port_code, country_of_origin,
                bcd_rate, bcd_amount, cess_rate, cess_amount,
                igst_rate, igst_amount, sws_rate, sws_amount,
                add_rate, add_amount, cvd_rate, cvd_amount,
                assessable_value, total_duty,
                calculation_formula, calculation_time_ms
            ) VALUES (
                :calculation_uuid, :user_id, :document_id,
                :hsn_code, :cif_value, :quantity, :unit, :port_code, :country_of_origin,
                :bcd_rate, :bcd_amount, :cess_rate, :cess_amount,
                :igst_rate, :igst_amount, :sws_rate, :sws_amount,
                :add_rate, :add_amount, :cvd_rate, :cvd_amount,
                :assessable_value, :total_duty,
                :calculation_formula, :calculation_time_ms
            )
        """)

        self.db.execute(insert_query, {
            'calculation_uuid': calculation['calculation_uuid'],
            'user_id': user_id,
            'document_id': document_id,
            'hsn_code': calculation['hsn_code'],
            'cif_value': calculation['cif_value'],
            'quantity': calculation.get('quantity'),
            'unit': calculation.get('unit'),
            'port_code': calculation.get('port_code'),
            'country_of_origin': calculation.get('country_of_origin'),
            'bcd_rate': calculation['rates']['bcd'],
            'bcd_amount': calculation['duties']['bcd'],
            'cess_rate': calculation['rates']['cess'],
            'cess_amount': calculation['duties']['cess'],
            'igst_rate': calculation['rates']['igst'],
            'igst_amount': calculation['duties']['igst'],
            'sws_rate': calculation['rates']['sws'],
            'sws_amount': calculation['duties']['sws'],
            'add_rate': calculation['rates']['add'],
            'add_amount': calculation['duties']['add'],
            'cvd_rate': calculation['rates']['cvd'],
            'cvd_amount': calculation['duties']['cvd'],
            'assessable_value': calculation['assessable_value'],
            'total_duty': calculation['total_duty'],
            'calculation_formula': calculation['formula'],
            'calculation_time_ms': calculation['calculation_time_ms']
        })

        self.db.commit()

    def get_user_calculation_history(
        self,
        user_id: int,
        limit: int = 10
    ) -> List[Dict]:
        """Fetch recent calculation history for a user"""
        query = text("""
            SELECT
                calculation_uuid, hsn_code, cif_value, total_duty,
                calculated_at
            FROM duty_calculations
            WHERE user_id = :user_id
            ORDER BY calculated_at DESC
            LIMIT :limit
        """)

        result = self.db.execute(query, {'user_id': user_id, 'limit': limit})

        history = []
        for row in result:
            history.append({
                'calculation_uuid': str(row[0]),
                'hsn_code': row[1],
                'cif_value': float(row[2]),
                'total_duty': float(row[3]),
                'calculated_at': row[4].isoformat()
            })

        return history


# Convenience function for quick calculations
def calculate_duty_quick(
    db: Session,
    hsn_code: str,
    cif_value: float,
    **kwargs
) -> Dict:
    """
    Quick duty calculation (convenience wrapper)

    Example:
        result = calculate_duty_quick(db, '8471', 100000.00)
        print(f"Total Duty: ₹{result['total_duty']}")
    """
    calculator = DutyCalculator(db)
    return calculator.calculate_duty(
        hsn_code=hsn_code,
        cif_value=Decimal(str(cif_value)),
        **kwargs
    )
