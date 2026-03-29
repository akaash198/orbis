"""
M03 LLM Classifier — GPT-4o-mini chain-of-thought HSN reasoning.

Why GPT-4o-mini (not GPT-5.4 / DeepSeek)?
  - Cost-effective: classification runs per shipment, needs to be cheap
  - JSON mode guarantees structured output
  - Fast enough for interactive use (< 3s typical)
  - Sufficient accuracy when given top-10 semantically pre-filtered candidates

The LLM only sees the TOP-10 candidates retrieved by pgvector — this
dramatically reduces the search space from 20,000+ codes to 10, allowing
the model to focus entirely on reasoning rather than recall.
"""

import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# Prompt uses GRI (General Rules of Interpretation) framework —
# the official WCO method for HSN tariff classification.
CLASSIFIER_PROMPT = """\
You are a Senior Indian Customs HSN Tariff Classification Specialist with 20+ years of experience \
classifying goods under the Indian Customs Tariff (based on WCO Harmonized System 2022).

## Product Description
{product_description}

## Top Candidate HSN Codes (retrieved by semantic similarity)
{candidates_text}

## Classification Task
Analyse the product description carefully and select the BEST 3 HSN codes from the candidates above.

Apply the WCO General Rules of Interpretation (GRI) in strict order:
- GRI 1: Classify by the terms of the heading and any relative section/chapter notes
- GRI 2: Incomplete/unfinished articles; mixtures and combinations
- GRI 3: Most specific description wins over general; essential character rule
- GRI 6: Sub-heading level classification

For each of your top-3 selections provide:
1. The exact 8-digit HSN code
2. A confidence score (0.00–1.00)
3. One clear sentence explaining WHY this HSN applies to this product
4. Which GRI rule was decisive

Confidence scale:
- 0.95–1.00: Unambiguous single correct code, no alternatives
- 0.85–0.94: Highly likely, minor uncertainty
- 0.70–0.84: Probable, plausible alternatives exist
- 0.50–0.69: Uncertain, expert review strongly recommended
- Below 0.50: Cannot classify reliably from description alone

Return ONLY a JSON object with this exact structure:
{{
  "top3": [
    {{
      "hsn_code": "XXXXXXXX",
      "confidence": 0.XX,
      "reasoning": "...",
      "gri_rule": "GRI 1"
    }}
  ],
  "classification_notes": "Any chapter exclusions, ambiguities, or additional guidance"
}}"""


def classify(
    product_description: str,
    candidates: List[Dict[str, Any]],
    openai_client,
) -> Dict[str, Any]:
    """
    Run GPT-4o-mini over the retrieved HSN candidates.

    Parameters
    ----------
    product_description : The normalised product description string
    candidates          : Top-10 dicts from pgvector retrieval
    openai_client       : Initialised OpenAI client

    Returns
    -------
    dict with keys: top3 (list), classification_notes (str)
    """
    if not candidates:
        raise ValueError("No candidates provided to LLM classifier — retrieval may have failed.")

    candidates_text = "\n".join(
        f"{i + 1:2d}. HSN {c['hsn_code']:8s} | Ch.{c['chapter']:02d} {c.get('chapter_name', ''):30s} | "
        f"sim={float(c.get('similarity', 0)):.3f} | {c['description']}"
        for i, c in enumerate(candidates[:5])   # top-5 is sufficient; reduces tokens = faster
    )

    prompt = CLASSIFIER_PROMPT.format(
        product_description=product_description,
        candidates_text=candidates_text,
    )

    logger.info(
        "LLM classify: %d candidates, description=%.80s...",
        len(candidates), product_description
    )

    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=600,
    )

    raw = resp.choices[0].message.content
    result = json.loads(raw)

    top3 = result.get("top3", [])
    logger.info(
        "LLM returned %d predictions; top-1 HSN=%s conf=%.2f",
        len(top3),
        top3[0].get("hsn_code") if top3 else "N/A",
        top3[0].get("confidence", 0) if top3 else 0,
    )

    return result
