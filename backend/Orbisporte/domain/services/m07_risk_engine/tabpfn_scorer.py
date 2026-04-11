"""
Backward-compatibility shim.

M07 risk scoring has migrated from TabPFN to supervised CatBoost.
This module re-exports the current scorer to avoid import breakage.
"""

from Orbisporte.domain.services.m07_risk_engine.catboost_scorer import (
    CatBoostRiskScorer as TabPFNScorer,
    FEATURE_LABELS,
)

__all__ = ["TabPFNScorer", "FEATURE_LABELS"]

