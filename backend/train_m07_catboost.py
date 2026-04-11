"""
Manual training utility for the M07 CatBoost supervised risk model.

Usage:
    cd backend
    python train_m07_catboost.py
"""

from __future__ import annotations

import json

from Orbisporte.core import SessionLocal
from Orbisporte.domain.services.m07_risk_engine.catboost_scorer import CatBoostRiskScorer


def main() -> None:
    db = SessionLocal()
    try:
        scorer = CatBoostRiskScorer(db)
        scorer.maybe_retrain(db, force=True)
        print(
            json.dumps(
                {
                    "success": True,
                    "model_label": scorer.model_label,
                },
                indent=2,
            )
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()

