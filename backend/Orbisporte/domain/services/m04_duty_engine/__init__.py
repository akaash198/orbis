"""
M04 Duty Computation Engine
===========================
Accurately computes all customs duty components for each shipment:
  CIF → Assessable Value → BCD → SWS → IGST → ADD → CVD/SGD → FTA Exemption

SOP References: DUTY-001 to DUTY-008
Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from .m04_service import M04DutyEngine

__all__ = ["M04DutyEngine"]
