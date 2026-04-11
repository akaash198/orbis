"""
M05 — Bill of Entry Filing System
==================================
Modules:
  m05_service.py   — Orchestrator (aggregate, validate, submit, handle)
  predictor.py     — Pre-filing risk predictor (rule-based + XGBoost stub)
  icegate_client.py — ICEGATE REST API client
  pdf_generator.py — BoE PDF generator
  query_resolver.py — LLM query resolution drafter

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""
from Orbisporte.domain.services.m05_boe_engine.m05_service import M05BoEEngine

__all__ = ["M05BoEEngine"]
