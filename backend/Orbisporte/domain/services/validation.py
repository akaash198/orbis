from typing import Dict, Any, List
import re
from datetime import datetime

class ValidationService:
    """
    Service for cross-document validation and regulatory compliance.
    """
    def cross_document_validation(self, documents: List[Dict]) -> Dict[str, Any]:
        """Validate consistency across multiple documents."""
        try:
            validation_results = {
                "is_valid": True,
                "errors": [],
                "warnings": [],
                "consistency_checks": []
            }
            
            if len(documents) < 2:
                validation_results["warnings"].append("Need at least 2 documents for cross-validation")
                return validation_results
            
            # Extract common fields from documents
            invoice_data = None
            bill_of_lading_data = None
            packing_list_data = None
            
            for doc in documents:
                doc_type = doc.get('document_type', '').lower()
                if 'invoice' in doc_type:
                    invoice_data = doc.get('extracted_data', {})
                elif 'bill of lading' in doc_type or 'lading' in doc_type:
                    bill_of_lading_data = doc.get('extracted_data', {})
                elif 'packing' in doc_type:
                    packing_list_data = doc.get('extracted_data', {})
            
            # Validate shipper/consignee consistency
            if invoice_data and bill_of_lading_data:
                self._validate_parties_consistency(
                    invoice_data, bill_of_lading_data, validation_results
                )
            
            # Validate item quantities and values
            if invoice_data and packing_list_data:
                self._validate_items_consistency(
                    invoice_data, packing_list_data, validation_results
                )
            
            return validation_results
            
        except Exception as e:
            return {
                "is_valid": False,
                "errors": [f"Cross-document validation failed: {str(e)}"],
                "warnings": [],
                "consistency_checks": []
            }

    def _validate_parties_consistency(self, invoice_data: Dict, bol_data: Dict, results: Dict):
        """Validate shipper and consignee consistency between documents."""
        invoice_shipper = invoice_data.get('shipper', {})
        bol_shipper = bol_data.get('shipper', {})
        
        if invoice_shipper.get('name') != bol_shipper.get('name'):
            results["warnings"].append("Shipper names don't match between Invoice and Bill of Lading")
        
        invoice_consignee = invoice_data.get('consignee', {})
        bol_consignee = bol_data.get('consignee', {})
        
        if invoice_consignee.get('name') != bol_consignee.get('name'):
            results["warnings"].append("Consignee names don't match between Invoice and Bill of Lading")

    def _validate_items_consistency(self, invoice_data: Dict, packing_data: Dict, results: Dict):
        """Validate item quantities between invoice and packing list."""
        invoice_items = invoice_data.get('items', [])
        packing_items = packing_data.get('items', [])
        
        if len(invoice_items) != len(packing_items):
            results["warnings"].append(f"Item count mismatch: Invoice has {len(invoice_items)} items, Packing list has {len(packing_items)} items")

    def enforce_business_rules(self, data: Dict) -> Dict[str, Any]:
        """Enforce business rules on extracted data."""
        try:
            violations = []
            
            # Rule 1: All items must have HS codes
            items = data.get('items', [])
            for i, item in enumerate(items):
                if not item.get('hs_code'):
                    violations.append(f"Item {i+1} missing HS code")
            
            # Rule 2: Total value must match sum of item values
            total_value = float(data.get('total_value', 0))
            calculated_total = sum(
                float(item.get('unit_value', 0)) * float(item.get('quantity', 0))
                for item in items
            )
            
            if abs(total_value - calculated_total) > 0.01:
                violations.append(f"Total value mismatch: Declared {total_value}, Calculated {calculated_total}")
            
            # Rule 3: Required fields validation
            required_fields = ['shipper', 'consignee', 'total_value', 'currency']
            for field in required_fields:
                if not data.get(field):
                    violations.append(f"Required field missing: {field}")
            
            return {
                "compliant": len(violations) == 0,
                "violations": violations
            }
            
        except Exception as e:
            return {
                "compliant": False,
                "violations": [f"Business rule validation failed: {str(e)}"]
            }

    def check_data_consistency(self, data: Dict) -> bool:
        """Check for data consistency."""
        try:
            # Check for basic data integrity
            if not isinstance(data, dict):
                return False
            
            # Check date formats
            date_fields = ['invoice_date', 'ship_date', 'delivery_date']
            for field in date_fields:
                if field in data and data[field]:
                    try:
                        datetime.fromisoformat(str(data[field]).replace('Z', '+00:00'))
                    except (ValueError, TypeError):
                        return False
            
            # Check numeric fields
            numeric_fields = ['total_value', 'weight', 'quantity']
            for field in numeric_fields:
                if field in data and data[field] is not None:
                    try:
                        float(data[field])
                    except (ValueError, TypeError):
                        return False
            
            return True
            
        except Exception:
            return False

    def validate_regulatory_compliance(self, data: Dict) -> Dict[str, Any]:
        """Validate data against regulatory requirements."""
        try:
            compliance_issues = []
            
            # Check for restricted/prohibited items (simplified)
            restricted_keywords = ['weapon', 'explosive', 'drug', 'narcotic', 'firearm']
            items = data.get('items', [])
            
            for item in items:
                description = item.get('description', '').lower()
                for keyword in restricted_keywords:
                    if keyword in description:
                        compliance_issues.append(f"Potentially restricted item detected: {item.get('description')}")
            
            # Check value thresholds for additional documentation
            total_value = float(data.get('total_value', 0))
            if total_value > 2500:  # Example threshold
                compliance_issues.append("High value shipment may require additional documentation")
            
            # Check country of origin requirements
            items_without_origin = [
                item for item in items 
                if not item.get('country_of_origin')
            ]
            
            if items_without_origin:
                compliance_issues.append(f"{len(items_without_origin)} items missing country of origin")
            
            return {
                "compliant": len(compliance_issues) == 0,
                "issues": compliance_issues,
                "recommendations": [
                    "Verify all HS codes are correct",
                    "Ensure all required certificates are attached",
                    "Review trade agreement eligibility"
                ]
            }
            
        except Exception as e:
            return {
                "compliant": False,
                "issues": [f"Regulatory validation failed: {str(e)}"],
                "recommendations": []
            } 