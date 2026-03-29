"""
Simple HS Code lookup service that works without ChromaDB or OpenAI embeddings.
Uses direct DataFrame search with fuzzy matching for better results.
"""

import pickle
import pandas as pd
import os
import logging
from typing import Dict, Any
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

class SimpleHSCodeLookup:
    """Simple HS Code lookup using pandas and fuzzy matching."""

    def __init__(self, hs_data_path: str = "IDP/static/HSCODE.pkl"):
        self.hs_data_path = hs_data_path
        self.hs_data = None
        self._load_hs_data()

    def _load_hs_data(self):
        """Load HS code data from pickle file."""
        try:
            with open(self.hs_data_path, 'rb') as f:
                self.hs_data = pickle.load(f)

            logger.info(f"[DEBUG] Loaded data type: {type(self.hs_data)}")

            if not isinstance(self.hs_data, pd.DataFrame):
                self.hs_data = pd.DataFrame(self.hs_data)
                logger.info(f"[DEBUG] Converted to DataFrame, columns: {list(self.hs_data.columns)}")

            # Clean column names
            self.hs_data.columns = [col.strip().lower().replace(' ', '_') for col in self.hs_data.columns]
            logger.info(f"[DEBUG] After cleaning, columns: {list(self.hs_data.columns)}")

            # Map common column variations
            column_mappings = {
                'code': 'hs_code',
                'commodity_code': 'hs_code',
                'desc': 'description',
                'commodity_description': 'description'
            }

            for old_col, new_col in column_mappings.items():
                if old_col in self.hs_data.columns and new_col not in self.hs_data.columns:
                    self.hs_data[new_col] = self.hs_data[old_col]

            # Check if hs_code column exists before dropna
            if 'hs_code' not in self.hs_data.columns:
                logger.error(f"[ERROR] 'hs_code' column not found! Columns are: {list(self.hs_data.columns)}")
                raise KeyError("hs_code column missing")

            # Remove rows without HS code
            self.hs_data = self.hs_data.dropna(subset=['hs_code'])

            # Create lowercase description column for searching
            if 'description' in self.hs_data.columns:
                self.hs_data['description_lower'] = self.hs_data['description'].str.lower()

            logger.info(f"✅ Loaded {len(self.hs_data)} HS code records")

        except Exception as e:
            logger.error(f"Failed to load HS data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            self.hs_data = pd.DataFrame({'hs_code': ['0000.00.00'], 'description': ['No data available']})

    def get_hs_code_details(self, query: str) -> Dict[str, Any]:
        """
        Get HS code details for a product description.
        Uses fuzzy matching to find best match.
        """
        try:
            if self.hs_data is None or len(self.hs_data) == 0:
                return self._not_found_result(query)

            query_lower = query.lower().strip()

            # Extract keywords from query
            keywords = [word for word in query_lower.split() if len(word) > 3]

            if not keywords:
                return self._fallback_by_common_terms(query_lower)

            # Search for exact matches first
            if 'description_lower' in self.hs_data.columns:
                exact_matches = self.hs_data[
                    self.hs_data['description_lower'].str.contains(query_lower, na=False, case=False)
                ]

                if not exact_matches.empty:
                    row = exact_matches.iloc[0]
                    return self._format_result(row, found=True, method="exact_match")

                # Try keyword matching
                mask = pd.Series([False] * len(self.hs_data))
                for keyword in keywords:
                    mask |= self.hs_data['description_lower'].str.contains(keyword, na=False, case=False)

                keyword_matches = self.hs_data[mask]

                if not keyword_matches.empty:
                    # Find best match using fuzzy matching
                    best_match = None
                    best_score = 0

                    for idx, row in keyword_matches.head(10).iterrows():
                        desc = str(row.get('description', '')).lower()
                        score = SequenceMatcher(None, query_lower, desc).ratio()

                        if score > best_score:
                            best_score = score
                            best_match = row

                    if best_match is not None and best_score > 0.3:
                        return self._format_result(best_match, found=True,
                                                   method="keyword_match",
                                                   confidence=best_score)

            # Fallback to common terms
            return self._fallback_by_common_terms(query_lower)

        except Exception as e:
            logger.error(f"HS code lookup failed: {e}")
            return self._not_found_result(query)

    def _fallback_by_common_terms(self, query_lower: str) -> Dict[str, Any]:
        """Fallback search for common product categories."""

        # Comprehensive fallback mappings
        fallback_codes = {
            # Electronics
            'computer': ('8471.30.00', 'Portable automatic data processing machines'),
            'laptop': ('8471.30.00', 'Portable automatic data processing machines'),
            'desktop': ('8471.41.00', 'Data processing machines'),
            'smartphone': ('8517.12.00', 'Telephones for cellular networks'),
            'phone': ('8517.12.00', 'Telephones for cellular networks'),
            'mobile': ('8517.12.00', 'Telephones for cellular networks'),
            'tablet': ('8471.30.00', 'Portable automatic data processing machines'),
            'monitor': ('8528.52.00', 'Monitors'),
            'keyboard': ('8471.60.00', 'Input or output units'),
            'mouse': ('8471.60.00', 'Input or output units'),
            'printer': ('8443.32.00', 'Printers'),
            'camera': ('8525.80.00', 'Digital cameras'),
            'headphone': ('8518.30.00', 'Headphones and earphones'),
            'speaker': ('8518.21.00', 'Loudspeakers'),
            'television': ('8528.72.00', 'Television receivers'),
            'display': ('8528.52.00', 'Display panels and monitors'),
            'panel': ('8528.52.00', 'Display panels'),
            'led': ('8528.52.00', 'LED display devices'),
            'lcd': ('8528.52.00', 'LCD display devices'),
            'screen': ('8528.52.00', 'Display screens'),

            # Textiles
            'shirt': ('6205.20.00', 'Shirts, mens or boys'),
            'trouser': ('6203.42.00', 'Trousers, breeches'),
            'dress': ('6204.42.00', 'Dresses'),
            'jacket': ('6201.93.00', 'Jackets'),
            'cotton': ('5208.12.00', 'Cotton fabrics'),
            'fabric': ('5208.12.00', 'Woven fabrics'),
            'clothing': ('6203.42.00', 'Clothing'),

            # Food items
            'rice': ('1006.30.00', 'Semi-milled or wholly milled rice'),
            'wheat': ('1001.99.00', 'Wheat'),
            'sugar': ('1701.99.00', 'Cane or beet sugar'),
            'coffee': ('0901.21.00', 'Coffee, roasted'),
            'tea': ('0902.30.00', 'Black tea'),
            'fruit': ('0810.90.00', 'Fresh fruits'),
            'vegetable': ('0709.99.00', 'Vegetables'),
            'meat': ('0201.30.00', 'Meat'),
            'fish': ('0302.89.00', 'Fish, fresh or chilled'),

            # Chemicals
            'chemical': ('2942.00.00', 'Chemical products'),
            'plastic': ('3920.10.00', 'Plates, sheets, film of plastics'),
            'rubber': ('4001.10.00', 'Natural rubber'),
            'fertilizer': ('3105.20.00', 'Fertilizers'),
            'pesticide': ('3808.92.00', 'Pesticides'),

            # Machinery & Testing Equipment
            'machine': ('8479.89.00', 'Machines and mechanical appliances'),
            'engine': ('8407.34.00', 'Engines'),
            'motor': ('8501.10.00', 'Electric motors'),
            'pump': ('8413.70.00', 'Pumps'),
            'valve': ('8481.80.00', 'Valves'),
            'test': ('9031.80.00', 'Testing and measuring instruments'),
            'testing': ('9031.80.00', 'Testing and measuring instruments'),
            'station': ('9031.80.00', 'Testing stations and instruments'),
            'equipment': ('8479.89.00', 'Industrial equipment'),
            'instrument': ('9031.80.00', 'Measuring or checking instruments'),
            'measuring': ('9031.80.00', 'Measuring instruments'),
            'analyzer': ('9031.80.00', 'Testing and analyzing machines'),
            'detector': ('9031.80.00', 'Detection and measurement instruments'),

            # Vehicles
            'car': ('8703.23.00', 'Motor cars'),
            'truck': ('8704.21.00', 'Trucks'),
            'motorcycle': ('8711.20.00', 'Motorcycles'),
            'bicycle': ('8712.00.00', 'Bicycles'),
            'vehicle': ('8703.23.00', 'Motor vehicles'),

            # Shipping & Logistics Terms
            'consolidation': ('9999.99.99', 'Consolidated shipment - multiple items (see attached list)'),
            'consolidated': ('9999.99.99', 'Consolidated shipment - multiple items'),
            'mixed': ('9999.99.99', 'Mixed cargo - multiple items'),
            'various': ('9999.99.99', 'Various items - see documentation'),
            'assorted': ('9999.99.99', 'Assorted goods - multiple items'),

            # Construction
            'cement': ('2523.29.00', 'Portland cement'),
            'steel': ('7208.51.00', 'Steel products'),
            'iron': ('7208.51.00', 'Iron products'),
            'wood': ('4407.11.00', 'Wood'),
            'glass': ('7005.29.00', 'Glass'),

            # Default
            'product': ('9999.00.00', 'Product not classified'),
        }

        for term, (code, description) in fallback_codes.items():
            if term in query_lower:
                # Confidence levels based on term type
                if term in ['test', 'testing', 'station', 'instrument', 'measuring']:
                    confidence = 0.90  # High confidence for technical terms
                elif term in ['consolidation', 'consolidated', 'mixed', 'various', 'assorted']:
                    confidence = 0.50  # Lower confidence for multi-item references
                else:
                    confidence = 0.85  # Standard confidence

                return {
                    "hs_code": code,
                    "description": description,
                    "chapter": self._extract_chapter(code),
                    "found": True,
                    "method": "fallback_match",
                    "confidence": confidence,
                    "note": f"Matched by keyword: {term}" if confidence >= 0.85 else "⚠️ Multiple items - requires individual classification"
                }

        return self._not_found_result(query_lower)

    def _format_result(self, row, found=True, method="direct_search", confidence=1.0) -> Dict[str, Any]:
        """Format a DataFrame row as a result dict."""
        hs_code = str(row.get('hs_code', '0000.00.00'))
        description = str(row.get('description', 'No description available'))

        return {
            "hs_code": hs_code,
            "description": description,
            "chapter": self._extract_chapter(hs_code),
            "found": found,
            "method": method,
            "confidence": round(confidence, 2) if confidence < 1.0 else 1.0
        }

    def _not_found_result(self, query: str) -> Dict[str, Any]:
        """Return a not found result."""
        return {
            "hs_code": "0000.00.00",
            "description": f"No matching HS code found for: {query}",
            "chapter": "Unknown",
            "found": False,
            "method": "none",
            "confidence": 0.0,
            "note": "Try a more specific product description"
        }

    def lookup_hscode(self, product_description: str) -> Dict[str, Any]:
        """Alias for get_hs_code_details - used by API endpoint."""
        return self.get_hs_code_details(product_description)

    def _extract_chapter(self, hs_code: str) -> str:
        """Extract chapter number from HS code."""
        try:
            clean_code = ''.join(c for c in str(hs_code) if c.isdigit())
            if len(clean_code) >= 2:
                return f"Chapter {clean_code[:2]}"
            return "Unknown Chapter"
        except:
            return "Unknown Chapter"


# Singleton instance
_simple_lookup = None

def get_simple_hscode_lookup() -> SimpleHSCodeLookup:
    """Get singleton instance of SimpleHSCodeLookup."""
    global _simple_lookup
    if _simple_lookup is None:
        _simple_lookup = SimpleHSCodeLookup()
    return _simple_lookup
