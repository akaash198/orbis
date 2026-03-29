"""
Module 3: Bill of Entry (BoE) Auto-fill Service
Purpose: Automatically generate and populate Bill of Entry from extracted invoice data

Based on: OrbisPorté Design Document - BoE Auto-fill & Editor
Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
Date: 2026-03-01
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple, Any
from datetime import date, datetime
import uuid
import json
import logging
from sqlalchemy import text
from sqlalchemy.orm import Session

from Orbisporte.domain.services.duty_calculator import DutyCalculator
from Orbisporte.config.port_field_mappings import (
    get_port_mapping,
    get_required_fields,
    map_boe_to_port_format,
    map_line_items_to_port_format
)

logger = logging.getLogger(__name__)


class BoEAutoFillService:
    """
    Bill of Entry Auto-fill Service

    Implements PDF Specification Module 3:
    - Field Mapping (parsed invoice → BoE schema)
    - Derived Calculations (assessable value, currency conversions)
    - Schema & Business Validation
    - Draft BoE creation with versioning
    - Risk-based routing (auto-sign vs manual review)
    """

    # Risk scoring thresholds
    RISK_THRESHOLD_LOW = Decimal('30.0')       # Auto-approve if risk < 30
    RISK_THRESHOLD_MEDIUM = Decimal('70.0')    # Manual review if 30 <= risk < 70
    RISK_THRESHOLD_HIGH = Decimal('70.0')      # Legal review if risk >= 70

    def __init__(self, db: Session):
        self.db = db
        self.duty_calculator = DutyCalculator(db)

    def create_boe_from_invoice(
        self,
        document_id: int,
        extracted_data: Dict[str, Any],
        line_items_with_duties: List[Dict[str, Any]],
        user_id: int,
        port_code: str = "INMAA1",
        auto_validate: bool = True
    ) -> Dict[str, Any]:
        """
        Create a Bill of Entry from extracted invoice data and calculated duties

        Args:
            document_id: ID of the source invoice document
            extracted_data: Extracted invoice data (from doc_extraction service)
            line_items_with_duties: Line items with HSN codes and duty calculations
            user_id: User creating the BoE
            port_code: Port of import (default: Mumbai)
            auto_validate: Run validation after creation

        Returns:
            Dict containing:
            - boe_id: Created BoE ID
            - boe_number: BoE reference number
            - status: draft/validated
            - validation_report: Validation results
            - risk_score: Calculated risk score
        """
        logger.info(f"[BoE] Creating BoE from document {document_id} for port {port_code}")

        try:
            # Step 1: Extract and map header fields
            boe_header = self._map_invoice_to_boe_header(
                extracted_data,
                document_id,
                user_id,
                port_code
            )

            # Step 2: Calculate totals from line items
            totals = self._calculate_boe_totals(line_items_with_duties)
            boe_header.update(totals)

            # Step 3: Calculate risk score
            risk_score = self._calculate_risk_score(boe_header, line_items_with_duties)
            boe_header['risk_score'] = float(risk_score)

            # Step 4: Determine status based on risk
            if risk_score < self.RISK_THRESHOLD_LOW:
                boe_header['status'] = 'validated'
            else:
                boe_header['status'] = 'draft'

            # Step 5: Insert BoE header
            boe_id = self._insert_boe_header(boe_header)

            # Step 6: Insert line items
            self._insert_boe_line_items(boe_id, line_items_with_duties)

            # Step 7: Create initial version snapshot
            self._create_version_snapshot(boe_id, user_id, "Initial creation")

            # Step 8: Run validation if requested
            validation_report = None
            if auto_validate:
                validation_report = self.validate_boe(boe_id)

            # Step 9: Generate BoE number
            boe_number = self._generate_boe_number(port_code, boe_id)
            self._update_boe_number(boe_id, boe_number)

            logger.info(f"[BoE] ✅ Created BoE {boe_number} (ID: {boe_id}, Risk: {risk_score:.2f})")

            return {
                'success': True,
                'boe_id': boe_id,
                'boe_number': boe_number,
                'status': boe_header['status'],
                'risk_score': float(risk_score),
                'validation_report': validation_report,
                'total_duty': float(totals['total_duty']),
                'total_amount_payable': float(totals['total_amount_payable']),
                'line_items_count': len(line_items_with_duties)
            }

        except Exception as e:
            logger.error(f"[BoE] Failed to create BoE: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    def _map_invoice_to_boe_header(
        self,
        extracted_data: Dict[str, Any],
        document_id: int,
        user_id: int,
        port_code: str
    ) -> Dict[str, Any]:
        """
        Map extracted invoice data to BoE header fields

        Implements: Field Mapping Engine from PDF spec
        """
        # Get company information for the user
        company_info = self._get_company_info(user_id)

        header = {
            'document_id': document_id,
            'user_id': user_id,
            'company_id': company_info.get('company_id'),
            'port_code': port_code,
            'port_name': self._get_port_name(port_code),

            # BoE metadata
            'boe_date': date.today(),
            'status': 'draft',
            'validation_status': 'pending',

            # Importer information (from company profile)
            'importer_name': company_info.get('company_name', extracted_data.get('buyer_name')),
            'importer_iec': company_info.get('iec_number', extracted_data.get('buyer_iec')),
            'importer_gst': company_info.get('gst_number', extracted_data.get('buyer_gst')),
            'importer_address': company_info.get('address', extracted_data.get('buyer_address')),

            # Shipment information (from invoice)
            'bill_of_lading_number': extracted_data.get('bill_of_lading', extracted_data.get('bl_number')),
            'bill_of_lading_date': self._parse_date(extracted_data.get('bl_date')),
            'vessel_name': extracted_data.get('vessel_name'),
            'country_of_origin': self._normalize_country_code(extracted_data.get('country_of_origin', extracted_data.get('supplier_country'))),
            'country_of_consignment': self._normalize_country_code(extracted_data.get('country_of_consignment', extracted_data.get('supplier_country'))),

            # Financial information (from invoice)
            'total_invoice_value': self._to_decimal(extracted_data.get('total_amount', 0)),
            'freight_charges': self._to_decimal(extracted_data.get('freight', 0)),
            'insurance_charges': self._to_decimal(extracted_data.get('insurance', 0)),

            # Currency
            'currency_code': extracted_data.get('currency', 'INR'),
            'exchange_rate': self._to_decimal(extracted_data.get('exchange_rate', 1.0)),

            # Will be calculated from line items
            'total_cif_value': Decimal('0'),
            'total_assessable_value': Decimal('0'),
            'total_duty': Decimal('0'),

            # Audit
            'created_by': user_id,
        }

        # Calculate CIF value if not provided
        if not header['total_cif_value'] or header['total_cif_value'] == 0:
            header['total_cif_value'] = (
                header['total_invoice_value'] +
                header['freight_charges'] +
                header['insurance_charges']
            )

        return header

    def _calculate_boe_totals(self, line_items: List[Dict[str, Any]]) -> Dict[str, Decimal]:
        """
        Calculate aggregate totals from line items

        Implements: Derived Calculations from PDF spec
        """
        total_cif = Decimal('0')
        total_assessable = Decimal('0')
        total_bcd = Decimal('0')
        total_cess = Decimal('0')
        total_igst = Decimal('0')
        total_sws = Decimal('0')
        total_add = Decimal('0')
        total_cvd = Decimal('0')
        total_duty = Decimal('0')

        for item in line_items:
            # Extract from duty_calculation if present
            duty_calc = item.get('duty_calculation') or {}
            duties = duty_calc.get('duties', item.get('duties', {}))

            total_cif += self._to_decimal(duty_calc.get('cif_value', item.get('cif_value', 0)))
            total_assessable += self._to_decimal(duty_calc.get('assessable_value', item.get('assessable_value', 0)))
            total_bcd += self._to_decimal(duties.get('bcd', 0))
            total_cess += self._to_decimal(duties.get('cess', 0))
            total_igst += self._to_decimal(duties.get('igst', 0))
            total_sws += self._to_decimal(duties.get('sws', 0))
            total_add += self._to_decimal(duties.get('add', 0))
            total_cvd += self._to_decimal(duties.get('cvd', 0))
            total_duty += self._to_decimal(duty_calc.get('total_duty', item.get('total_duty', 0)))

        return {
            'total_cif_value': total_cif,
            'total_assessable_value': total_assessable,
            'total_bcd': total_bcd,
            'total_cess': total_cess,
            'total_igst': total_igst,
            'total_sws': total_sws,
            'total_add': total_add,
            'total_cvd': total_cvd,
            'total_duty': total_duty,
            'total_amount_payable': total_cif + total_duty
        }

    def _calculate_risk_score(
        self,
        boe_header: Dict[str, Any],
        line_items: List[Dict[str, Any]]
    ) -> Decimal:
        """
        Calculate risk score for BoE (0-100)

        Implements: Risk Scoring from PDF spec

        Risk factors:
        - Missing mandatory fields (+20)
        - High duty amount (>₹1L) (+10)
        - Multiple HSN codes (+5 per unique HSN)
        - Low HSN classification confidence (+15 per low-confidence item)
        - High-risk country of origin (+10)
        - Unusual unit prices (+10)
        """
        risk = Decimal('0')

        # Factor 1: Missing mandatory fields
        required_fields = get_required_fields(boe_header.get('port_code', 'INMAA1'))
        missing_count = sum(1 for field in required_fields if not boe_header.get(field))
        risk += Decimal(str(missing_count * 20))

        # Factor 2: High duty amount
        total_duty = self._to_decimal(boe_header.get('total_duty', 0))
        if total_duty > Decimal('100000'):  # ₹1 lakh
            risk += Decimal('10')

        # Factor 3: Multiple HSN codes (complexity)
        unique_hsns = len(set(item.get('hsn_code') for item in line_items if item.get('hsn_code')))
        if unique_hsns > 5:
            risk += Decimal(str((unique_hsns - 5) * 5))

        # Factor 4: Low HSN confidence
        low_confidence_count = sum(
            1 for item in line_items
            if item.get('hsn_confidence', 1.0) < 0.8
        )
        risk += Decimal(str(low_confidence_count * 15))

        # Factor 5: High-risk countries (example)
        high_risk_countries = ['IRN', 'PRK', 'SYR']  # Example list
        if boe_header.get('country_of_origin') in high_risk_countries:
            risk += Decimal('10')

        # Cap risk at 100
        return min(risk, Decimal('100'))

    def _insert_boe_header(self, boe_header: Dict[str, Any]) -> int:
        """Insert BoE header into bills_of_entry table"""
        query = text("""
            INSERT INTO bills_of_entry (
                user_id, company_id, document_id,
                port_code, port_name,
                boe_date, status, validation_status,
                importer_name, importer_address, importer_iec, importer_gst,
                bill_of_lading_number, bill_of_lading_date,
                vessel_name, country_of_origin, country_of_consignment,
                total_invoice_value, freight_charges, insurance_charges,
                total_cif_value, total_assessable_value,
                total_bcd, total_cess, total_igst, total_sws, total_add, total_cvd,
                total_duty, total_amount_payable,
                currency_code, exchange_rate,
                risk_score, created_by
            ) VALUES (
                :user_id, :company_id, :document_id,
                :port_code, :port_name,
                :boe_date, :status, :validation_status,
                :importer_name, :importer_address, :importer_iec, :importer_gst,
                :bill_of_lading_number, :bill_of_lading_date,
                :vessel_name, :country_of_origin, :country_of_consignment,
                :total_invoice_value, :freight_charges, :insurance_charges,
                :total_cif_value, :total_assessable_value,
                :total_bcd, :total_cess, :total_igst, :total_sws, :total_add, :total_cvd,
                :total_duty, :total_amount_payable,
                :currency_code, :exchange_rate,
                :risk_score, :created_by
            ) RETURNING id
        """)

        result = self.db.execute(query, boe_header)
        boe_id = result.scalar()
        self.db.commit()

        return boe_id

    def _insert_boe_line_items(self, boe_id: int, line_items: List[Dict[str, Any]]):
        """Insert BoE line items into boe_line_items table"""
        for idx, item in enumerate(line_items, start=1):
            # Extract duty_calculation if it exists
            duty_calc = item.get('duty_calculation') or {}
            duties = duty_calc.get('duties', item.get('duties', {}))
            rates = duty_calc.get('rates', item.get('rates', {}))

            query = text("""
                INSERT INTO boe_line_items (
                    boe_id, line_number,
                    product_description, hsn_code, hsn_description,
                    quantity, unit, gross_weight_kg, net_weight_kg,
                    unit_price, total_value,
                    cif_value, duty_calculation_uuid, assessable_value,
                    bcd_rate, bcd_amount, cess_rate, cess_amount,
                    igst_rate, igst_amount, sws_rate, sws_amount,
                    add_rate, add_amount, cvd_rate, cvd_amount,
                    total_duty, country_of_origin
                ) VALUES (
                    :boe_id, :line_number,
                    :product_description, :hsn_code, :hsn_description,
                    :quantity, :unit, :gross_weight_kg, :net_weight_kg,
                    :unit_price, :total_value,
                    :cif_value, :duty_calculation_uuid, :assessable_value,
                    :bcd_rate, :bcd_amount, :cess_rate, :cess_amount,
                    :igst_rate, :igst_amount, :sws_rate, :sws_amount,
                    :add_rate, :add_amount, :cvd_rate, :cvd_amount,
                    :total_duty, :country_of_origin
                )
            """)

            self.db.execute(query, {
                'boe_id': boe_id,
                'line_number': idx,
                'product_description': item.get('description', item.get('product_description')),
                'hsn_code': item.get('hsn_code'),
                'hsn_description': item.get('hsn_description'),
                'quantity': self._to_decimal(item.get('quantity', 0)),
                'unit': item.get('unit', 'PCS'),
                'gross_weight_kg': self._to_decimal(item.get('gross_weight', 0)),
                'net_weight_kg': self._to_decimal(item.get('net_weight', 0)),
                'unit_price': self._to_decimal(item.get('unit_price', 0)),
                'total_value': self._to_decimal(item.get('total_value', item.get('amount', 0))),
                'cif_value': self._to_decimal(duty_calc.get('cif_value', item.get('cif_value', 0))),
                'duty_calculation_uuid': duty_calc.get('calculation_uuid', item.get('calculation_uuid')),
                'assessable_value': self._to_decimal(duty_calc.get('assessable_value', item.get('assessable_value', 0))),
                'bcd_rate': self._to_decimal(rates.get('bcd', 0)),
                'bcd_amount': self._to_decimal(duties.get('bcd', 0)),
                'cess_rate': self._to_decimal(rates.get('cess', 0)),
                'cess_amount': self._to_decimal(duties.get('cess', 0)),
                'igst_rate': self._to_decimal(rates.get('igst', 0)),
                'igst_amount': self._to_decimal(duties.get('igst', 0)),
                'sws_rate': self._to_decimal(rates.get('sws', 0)),
                'sws_amount': self._to_decimal(duties.get('sws', 0)),
                'add_rate': self._to_decimal(rates.get('add', 0)),
                'add_amount': self._to_decimal(duties.get('add', 0)),
                'cvd_rate': self._to_decimal(rates.get('cvd', 0)),
                'cvd_amount': self._to_decimal(duties.get('cvd', 0)),
                'total_duty': self._to_decimal(duty_calc.get('total_duty', item.get('total_duty', 0))),
                'country_of_origin': duty_calc.get('country_of_origin', item.get('country_of_origin'))
            })

        self.db.commit()

    def _create_version_snapshot(self, boe_id: int, user_id: int, change_summary: str):
        """Create version snapshot in boe_versions table"""
        # Fetch current BoE data
        boe_data = self._get_boe_by_id(boe_id)
        line_items = self._get_boe_line_items(boe_id)

        query = text("""
            INSERT INTO boe_versions (
                boe_id, version_number, created_by,
                boe_snapshot, line_items_snapshot, change_summary
            )
            SELECT :boe_id, COALESCE(MAX(version_number), 0) + 1, :created_by,
                   :boe_snapshot, :line_items_snapshot, :change_summary
            FROM boe_versions
            WHERE boe_id = :boe_id
        """)

        self.db.execute(query, {
            'boe_id': boe_id,
            'created_by': user_id,
            'boe_snapshot': json.dumps(boe_data, default=str),
            'line_items_snapshot': json.dumps(line_items, default=str),
            'change_summary': change_summary
        })

        self.db.commit()

    def validate_boe(self, boe_id: int) -> Dict[str, Any]:
        """
        Validate BoE against business rules

        Implements: Schema Validation & Business Rules from PDF spec

        Returns:
            {
                'valid': bool,
                'errors': [...],
                'warnings': [...],
                'validation_status': 'passed'|'failed'
            }
        """
        logger.info(f"[BoE] Validating BoE {boe_id}")

        errors = []
        warnings = []

        # Fetch BoE data
        boe_data = self._get_boe_by_id(boe_id)
        line_items = self._get_boe_line_items(boe_id)

        # Fetch validation rules for this port
        port_code = boe_data.get('port_code', 'INMAA1')
        required_fields = get_required_fields(port_code)

        # Rule 1: Check required fields
        for field in required_fields:
            if not boe_data.get(field):
                errors.append(f"Required field missing: {field}")

        # Rule 2: Validate field formats
        if boe_data.get('importer_iec'):
            iec = boe_data['importer_iec']
            if len(iec) != 10 or not iec.isdigit():
                errors.append(f"Invalid IEC format: {iec}")

        if boe_data.get('importer_gst'):
            gst = boe_data['importer_gst']
            if len(gst) != 15:
                errors.append(f"Invalid GST format: {gst}")

        # Rule 3: Validate amounts
        if self._to_decimal(boe_data.get('total_duty', 0)) < 0:
            errors.append("Total duty cannot be negative")

        # Rule 4: Validate line items
        if not line_items:
            errors.append("BoE must have at least one line item")

        for idx, item in enumerate(line_items, start=1):
            if not item.get('hsn_code'):
                errors.append(f"Line {idx}: HSN code is required")

            if self._to_decimal(item.get('quantity', 0)) <= 0:
                warnings.append(f"Line {idx}: Quantity should be positive")

        # Rule 5: Cross-field validation
        calculated_total = sum(self._to_decimal(item.get('total_duty', 0)) for item in line_items)
        boe_total = self._to_decimal(boe_data.get('total_duty', 0))

        if abs(calculated_total - boe_total) > Decimal('0.50'):  # Allow ₹0.50 rounding difference
            warnings.append(f"Total duty mismatch: BoE={boe_total}, Sum={calculated_total}")

        # Determine validation status
        validation_status = 'passed' if not errors else 'failed'

        # Update BoE validation status
        self._update_validation_status(boe_id, validation_status, {'errors': errors, 'warnings': warnings})

        logger.info(f"[BoE] Validation {validation_status}: {len(errors)} errors, {len(warnings)} warnings")

        return {
            'valid': validation_status == 'passed',
            'validation_status': validation_status,
            'errors': errors,
            'warnings': warnings,
            'errors_count': len(errors),
            'warnings_count': len(warnings)
        }

    def export_boe_for_port(self, boe_id: int, format: str = 'json') -> Dict[str, Any]:
        """
        Export BoE in port-specific format

        Implements: Port-specific schema mapping from PDF spec

        Args:
            boe_id: BoE ID
            format: 'json' or 'xml'

        Returns:
            BoE in port-specific format
        """
        boe_data = self._get_boe_by_id(boe_id)
        line_items = self._get_boe_line_items(boe_id)
        port_code = boe_data.get('port_code', 'INMAA1')

        # Map to port-specific format
        port_boe = map_boe_to_port_format(boe_data, port_code)
        port_line_items = map_line_items_to_port_format(line_items)

        export_data = {
            'header': port_boe,
            'line_items': port_line_items,
            'port_code': port_code,
            'boe_number': boe_data.get('boe_number'),
            'export_timestamp': datetime.now().isoformat()
        }

        if format == 'xml':
            # TODO: Implement XML conversion
            pass

        return export_data

    # ============================================================================
    # Helper Methods
    # ============================================================================

    def _get_company_info(self, user_id: int) -> Dict[str, Any]:
        """Fetch company information for the user"""
        query = text("""
            SELECT c.id as company_id, c.name as company_name,
                   c.gst_number, c.iec_number
            FROM "Company" c
            JOIN "User" u ON u.company_id = c.id
            WHERE u.id = :user_id
        """)

        result = self.db.execute(query, {'user_id': user_id}).fetchone()

        if result:
            return dict(result._mapping)
        return {}

    def _get_port_name(self, port_code: str) -> str:
        """Get port name from port code"""
        port_names = {
            'INMAA1': 'Mumbai (Nhava Sheva)',
            'INMAA4': 'Chennai',
            'INCCU1': 'Kolkata',
            'INBLR4': 'Bangalore Air Cargo'
        }
        return port_names.get(port_code, port_code)

    def _generate_boe_number(self, port_code: str, boe_id: int) -> str:
        """Generate BoE reference number"""
        # Format: PORT/IMP/YEAR/SEQUENCE
        # Example: MUM/IMP/2026/000123
        port_prefix = {
            'INMAA1': 'MUM',
            'INMAA4': 'CHN',
            'INCCU1': 'KOL',
            'INBLR4': 'BLR'
        }.get(port_code, 'XXX')

        year = datetime.now().year
        sequence = str(boe_id).zfill(6)

        return f"{port_prefix}/IMP/{year}/{sequence}"

    def _update_boe_number(self, boe_id: int, boe_number: str):
        """Update BoE number in database"""
        query = text("UPDATE bills_of_entry SET boe_number = :boe_number WHERE id = :boe_id")
        self.db.execute(query, {'boe_id': boe_id, 'boe_number': boe_number})
        self.db.commit()

    def _update_validation_status(self, boe_id: int, validation_status: str, validation_errors: Dict):
        """Update validation status in database"""
        query = text("""
            UPDATE bills_of_entry
            SET validation_status = :validation_status,
                validation_errors = :validation_errors
            WHERE id = :boe_id
        """)

        self.db.execute(query, {
            'boe_id': boe_id,
            'validation_status': validation_status,
            'validation_errors': json.dumps(validation_errors)
        })
        self.db.commit()

    def _get_boe_by_id(self, boe_id: int) -> Dict[str, Any]:
        """Fetch BoE header by ID"""
        query = text("SELECT * FROM bills_of_entry WHERE id = :boe_id")
        result = self.db.execute(query, {'boe_id': boe_id}).fetchone()

        if result:
            return dict(result._mapping)
        return {}

    def _get_boe_line_items(self, boe_id: int) -> List[Dict[str, Any]]:
        """Fetch BoE line items"""
        query = text("SELECT * FROM boe_line_items WHERE boe_id = :boe_id ORDER BY line_number")
        results = self.db.execute(query, {'boe_id': boe_id}).fetchall()

        return [dict(row._mapping) for row in results]

    @staticmethod
    def _to_decimal(value: Any) -> Decimal:
        """Convert value to Decimal"""
        if value is None:
            return Decimal('0')
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))

    @staticmethod
    def _parse_date(date_str: Any) -> Optional[date]:
        """Parse date string to date object"""
        if isinstance(date_str, date):
            return date_str
        if isinstance(date_str, str):
            try:
                return datetime.strptime(date_str, '%Y-%m-%d').date()
            except:
                pass
        return None

    @staticmethod
    def _normalize_country_code(country: Any) -> Optional[str]:
        """Normalize country name/code to 3-letter ISO code"""
        if not country:
            return None

        country_str = str(country).strip().upper()

        # If already 3-letter code, return as-is
        if len(country_str) == 3 and country_str.isalpha():
            return country_str

        # Common country name to ISO 3166-1 alpha-3 code mapping
        country_map = {
            'CHINA': 'CHN',
            'UNITED STATES': 'USA',
            'USA': 'USA',
            'INDIA': 'IND',
            'GERMANY': 'DEU',
            'JAPAN': 'JPN',
            'UNITED KINGDOM': 'GBR',
            'UK': 'GBR',
            'FRANCE': 'FRA',
            'ITALY': 'ITA',
            'SOUTH KOREA': 'KOR',
            'KOREA': 'KOR',
            'CANADA': 'CAN',
            'MEXICO': 'MEX',
            'SPAIN': 'ESP',
            'BRAZIL': 'BRA',
            'AUSTRALIA': 'AUS',
            'NETHERLANDS': 'NLD',
            'SWITZERLAND': 'CHE',
            'BELGIUM': 'BEL',
            'SWEDEN': 'SWE',
            'POLAND': 'POL',
            'AUSTRIA': 'AUT',
            'NORWAY': 'NOR',
            'DENMARK': 'DNK',
            'IRELAND': 'IRL',
            'SINGAPORE': 'SGP',
            'MALAYSIA': 'MYS',
            'THAILAND': 'THA',
            'VIETNAM': 'VNM',
            'INDONESIA': 'IDN',
            'PHILIPPINES': 'PHL',
            'HONG KONG': 'HKG',
            'TAIWAN': 'TWN',
            'SAUDI ARABIA': 'SAU',
            'UAE': 'ARE',
            'UNITED ARAB EMIRATES': 'ARE',
            'TURKEY': 'TUR',
            'RUSSIA': 'RUS',
            'SOUTH AFRICA': 'ZAF'
        }

        return country_map.get(country_str, country_str[:3] if len(country_str) >= 3 else country_str)
