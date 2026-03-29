from typing import List, Dict, Any
import Orbisporte.utils as utils_module
import json
from datetime import datetime

class CustomsDeclarationService:
    """
    Service for generating and managing customs declarations.
    """
    def generate_declaration(self, documents: List[Any]) -> Any:
        """Combine data from documents to generate a customs declaration."""
        try:
            # Use the internal customs declaration generator
            return self._generate_customs_declaration(documents)
        except Exception as e:
            return {"error": f"Declaration generation failed: {str(e)}"}
    
    def _generate_customs_declaration(self, documents: List[Any]) -> Dict[str, Any]:
        """Internal method to generate customs declaration from processed documents."""
        try:
            # Initialize the declaration structure
            declaration = {
                "generated_at": datetime.now().isoformat(),
                "shipper_info": {},
                "consignee_info": {},
                "items": [],
                "total_value": 0.0,
                "currency": "USD",
                "country_of_origin": "",
                "destination_country": "US",
                "port_of_entry": "",
                "document_references": []
            }
            
            if not documents or len(documents) == 0:
                return declaration
            
            # Process each document to extract relevant information
            for doc in documents:
                if not isinstance(doc, dict):
                    continue
                    
                doc_type = doc.get('document_type', '').lower()
                extracted_data = doc.get('extracted_data', {})
                
                # Add document reference
                declaration["document_references"].append({
                    "type": doc_type,
                    "filename": doc.get('filename', 'unknown'),
                    "processed_at": doc.get('processed_at', datetime.now().isoformat())
                })
                
                # Extract information based on document type
                if doc_type == 'invoice':
                    # Extract invoice information
                    if 'shipper' in extracted_data:
                        declaration["shipper_info"].update(extracted_data['shipper'])
                    if 'buyer' in extracted_data:
                        declaration["consignee_info"].update(extracted_data['buyer'])
                    if 'items' in extracted_data:
                        for item in extracted_data['items']:
                            declaration["items"].append({
                                "description": item.get('description', ''),
                                "quantity": item.get('quantity', 0),
                                "unit_value": item.get('unit_price', 0),
                                "total_value": item.get('total_price', 0),
                                "hs_code": item.get('hs_code', ''),
                                "country_of_origin": item.get('country_of_origin', '')
                            })
                    if 'total_amount' in extracted_data:
                        declaration["total_value"] += float(extracted_data['total_amount'])
                    if 'currency' in extracted_data:
                        declaration["currency"] = extracted_data['currency']
                        
                elif doc_type == 'bill of lading':
                    # Extract shipping information
                    if 'shipper' in extracted_data:
                        declaration["shipper_info"].update(extracted_data['shipper'])
                    if 'consignee' in extracted_data:
                        declaration["consignee_info"].update(extracted_data['consignee'])
                    if 'port_of_loading' in extracted_data:
                        declaration["country_of_origin"] = extracted_data.get('port_of_loading', '')
                    if 'port_of_discharge' in extracted_data:
                        declaration["port_of_entry"] = extracted_data.get('port_of_discharge', '')
                        
                elif doc_type == 'packing list':
                    # Extract packing information
                    if 'items' in extracted_data:
                        for item in extracted_data['items']:
                            # Find matching item in declaration or add new one
                            found = False
                            for decl_item in declaration["items"]:
                                if decl_item['description'] == item.get('description', ''):
                                    # Update existing item with packing info
                                    decl_item['gross_weight'] = item.get('gross_weight', 0)
                                    decl_item['net_weight'] = item.get('net_weight', 0)
                                    decl_item['dimensions'] = item.get('dimensions', '')
                                    found = True
                                    break
                            
                            if not found:
                                # Add new item from packing list
                                declaration["items"].append({
                                    "description": item.get('description', ''),
                                    "quantity": item.get('quantity', 0),
                                    "unit_value": 0,  # Will need to be filled from invoice
                                    "total_value": 0,
                                    "hs_code": '',
                                    "country_of_origin": '',
                                    "gross_weight": item.get('gross_weight', 0),
                                    "net_weight": item.get('net_weight', 0),
                                    "dimensions": item.get('dimensions', '')
                                })
                                
                elif doc_type == 'airwaybill':
                    # Extract air shipping information
                    if 'shipper' in extracted_data:
                        declaration["shipper_info"].update(extracted_data['shipper'])
                    if 'consignee' in extracted_data:
                        declaration["consignee_info"].update(extracted_data['consignee'])
                    if 'origin' in extracted_data:
                        declaration["country_of_origin"] = extracted_data.get('origin', '')
                    if 'destination' in extracted_data:
                        declaration["port_of_entry"] = extracted_data.get('destination', '')
            
            # Calculate total value if not already set
            if declaration["total_value"] == 0.0:
                declaration["total_value"] = sum(item.get('total_value', 0) for item in declaration["items"])
            
            # Set default values if still empty
            if not declaration["country_of_origin"]:
                declaration["country_of_origin"] = "Unknown"
            if not declaration["port_of_entry"]:
                declaration["port_of_entry"] = "Unknown"
                
            return declaration
            
        except Exception as e:
            return {
                "error": f"Failed to generate customs declaration: {str(e)}",
                "generated_at": datetime.now().isoformat()
            }
    
    def generate_customs_declaration(self, invoice, bl_or_awb, shipment_type, shipment_channel) -> Any:
        """Generate a customs declaration from processed documents.
        
        This method matches the signature expected by the Streamlit app.
        
        Args:
            invoice: List of invoice data dictionaries
            bl_or_awb: Bill of lading or air waybill data
            shipment_type: "Import" or "Export"
            shipment_channel: "Sea", "Air", or "Land"
        """
        try:
            # Combine invoice and shipping document data
            documents = []
            
            # Add invoice data
            if invoice:
                if isinstance(invoice, list):
                    for inv in invoice:
                        documents.append({
                            'document_type': 'invoice',
                            'extracted_data': inv,
                            'filename': 'invoice.pdf',
                            'processed_at': datetime.now().isoformat()
                        })
                else:
                    documents.append({
                        'document_type': 'invoice',
                        'extracted_data': invoice,
                        'filename': 'invoice.pdf',
                        'processed_at': datetime.now().isoformat()
                    })
            
            # Add shipping document data
            if bl_or_awb:
                doc_type = 'bill of lading' if shipment_channel.lower() in ['sea', 'by sea'] else 'airwaybill'
                documents.append({
                    'document_type': doc_type,
                    'extracted_data': bl_or_awb,
                    'filename': f'{doc_type}.pdf',
                    'processed_at': datetime.now().isoformat()
                })
            
            # Generate declaration using internal method
            return self._generate_customs_declaration(documents)
            
        except Exception as e:
            return {"error": f"Declaration generation failed: {str(e)}"}

    def validate_completeness(self, declaration: Any) -> Any:
        """Validate that the declaration is complete."""
        try:
            # Basic validation for required fields
            required_fields = [
                'shipper_info', 'consignee_info', 'items',
                'total_value', 'currency', 'country_of_origin'
            ]
            
            if not isinstance(declaration, dict):
                return {"valid": False, "errors": ["Declaration must be a dictionary"]}
            
            errors = []
            for field in required_fields:
                if field not in declaration:
                    errors.append(f"Missing required field: {field}")
            
            # Validate items
            if 'items' in declaration:
                if not isinstance(declaration['items'], list) or len(declaration['items']) == 0:
                    errors.append("Items must be a non-empty list")
                else:
                    for i, item in enumerate(declaration['items']):
                        if not isinstance(item, dict):
                            errors.append(f"Item {i+1} must be a dictionary")
                        else:
                            item_required = ['description', 'quantity', 'unit_value', 'hs_code']
                            for req_field in item_required:
                                if req_field not in item:
                                    errors.append(f"Item {i+1} missing {req_field}")
            
            return {"valid": len(errors) == 0, "errors": errors}
            
        except Exception as e:
            return {"valid": False, "errors": [f"Validation error: {str(e)}"]}

    def calculate_duties(self, declaration: Any) -> Any:
        """Calculate estimated duties and taxes."""
        try:
            # Basic duty calculation (this would normally use tariff schedules)
            if not isinstance(declaration, dict) or 'items' not in declaration:
                return {"error": "Invalid declaration format"}
            
            total_duties = 0
            total_taxes = 0
            
            for item in declaration.get('items', []):
                value = float(item.get('unit_value', 0)) * float(item.get('quantity', 0))
                # Basic 5% duty rate (would be HS code specific in real implementation)
                duty = value * 0.05
                tax = value * 0.1  # 10% tax
                
                total_duties += duty
                total_taxes += tax
            
            return {
                "total_duties": round(total_duties, 2),
                "total_taxes": round(total_taxes, 2),
                "total_charges": round(total_duties + total_taxes, 2),
                "currency": declaration.get('currency', 'USD')
            }
            
        except Exception as e:
            return {"error": f"Duty calculation failed: {str(e)}"}

    def apply_trade_agreements(self, declaration: Any) -> Any:
        """Apply trade agreements to the declaration."""
        try:
            # Simplified trade agreement application
            country_of_origin = declaration.get('country_of_origin', '').upper()
            destination_country = declaration.get('destination_country', 'US').upper()
            
            # Example preferential rates for certain countries
            preferential_countries = {
                'CA': 0.02,  # Canada - 2% duty
                'MX': 0.02,  # Mexico - 2% duty
                'UK': 0.03,  # UK - 3% duty
            }
            
            duty_rate = preferential_countries.get(country_of_origin, 0.05)  # Default 5%
            
            return {
                "applicable_agreement": f"Standard rate for {country_of_origin}",
                "duty_rate": duty_rate,
                "preferential": country_of_origin in preferential_countries
            }
            
        except Exception as e:
            return {"error": f"Trade agreement application failed: {str(e)}"}

    def generate_customs_form(self, declaration: Any, form_type: str) -> Dict:
        """Generate a customs form from the declaration."""
        try:
            form_data = {
                "form_type": form_type,
                "generated_date": datetime.now().isoformat(),
                "declaration_data": declaration,
                "form_fields": {}
            }
            
            if form_type.upper() == "CB4":
                # Commercial Invoice format
                form_data["form_fields"] = {
                    "shipper": declaration.get('shipper_info', {}),
                    "consignee": declaration.get('consignee_info', {}),
                    "items": declaration.get('items', []),
                    "total_value": declaration.get('total_value', 0),
                    "currency": declaration.get('currency', 'USD')
                }
            elif form_type.upper() == "CF7501":
                # Entry/Immediate Delivery format
                form_data["form_fields"] = {
                    "entry_number": f"ENT{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "port_of_entry": declaration.get('port_of_entry', 'Unknown'),
                    "items": declaration.get('items', []),
                    "duties_calculated": self.calculate_duties(declaration)
                }
            
            return form_data
            
        except Exception as e:
            return {"error": f"Form generation failed: {str(e)}"}

    def submit_to_customs_api(self, declaration: Any) -> Any:
        """Submit the declaration to a customs API."""
        try:
            # Simulate API submission
            submission_id = f"SUB{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            return {
                "submission_id": submission_id,
                "status": "submitted",
                "submitted_at": datetime.now().isoformat(),
                "tracking_number": f"TRK{submission_id}",
                "estimated_processing_time": "2-5 business days"
            }
            
        except Exception as e:
            return {"error": f"Submission failed: {str(e)}"}

    def track_declaration_status(self, declaration_id: str) -> Any:
        """Track the status of a submitted declaration."""
        try:
            # Simulate status tracking
            statuses = ["submitted", "under_review", "approved", "cleared"]
            
            return {
                "declaration_id": declaration_id,
                "current_status": "under_review",
                "status_history": [
                    {"status": "submitted", "timestamp": datetime.now().isoformat()},
                    {"status": "under_review", "timestamp": datetime.now().isoformat()}
                ],
                "next_expected_status": "approved",
                "estimated_completion": "2025-01-25"
            }
            
        except Exception as e:
            return {"error": f"Status tracking failed: {str(e)}"}
