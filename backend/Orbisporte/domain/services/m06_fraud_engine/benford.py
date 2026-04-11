"""
Benford's Law Analyser  (SOP FRAUD-006 — part 1)
=================================================
Detects manipulated invoice values by testing whether the first-digit
distribution of a set of invoice amounts follows Benford's Law.

Why Benford's Law?
------------------
Naturally occurring financial quantities (trade values, invoice amounts,
freight charges) overwhelmingly start with digit 1, then 2, then 3, etc.,
following the logarithmic distribution:
    P(d) = log10(1 + 1/d)  for d ∈ {1, ..., 9}

When fraudsters fabricate or manipulate invoice values they tend to pick
"round" numbers (e.g. ₹9,000 / ₹8,000 / ₹7,000) or cluster values just
below scrutiny thresholds.  These patterns deviate significantly from the
expected Benford distribution.

Detection: chi-square goodness-of-fit test
  H0: first-digit distribution matches Benford's Law
  If p-value < 0.05 → reject H0 → flag as potential manipulation

Minimum sample: 30 values (chi-square unreliable below this)

Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List

import numpy as np

logger = logging.getLogger(__name__)

# ── Optional scipy ─────────────────────────────────────────────────────────
try:
    from scipy.stats import chisquare as _chisquare
    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False
    logger.warning("[Benford] scipy not found — using manual chi-square")

# Benford's expected first-digit probabilities for d = 1..9
_BENFORD_PROBS = np.array([math.log10(1 + 1 / d) for d in range(1, 10)])

_MIN_SAMPLES = 30


def _first_digit(value: float) -> int | None:
    """Extract the leading non-zero digit of a positive number."""
    if value <= 0:
        return None
    s = f"{abs(value):.10g}".replace(".", "").lstrip("0")
    return int(s[0]) if s else None


def analyse(values: List[float]) -> Dict[str, Any]:
    """
    Run Benford's Law chi-square test on a list of financial values.

    Parameters
    ----------
    values : list of numeric invoice / CIF values (positive floats)

    Returns
    -------
    {
      "sample_size"       : int,
      "chi2_statistic"    : float | None,
      "p_value"           : float | None,
      "violated"          : bool,
      "anomaly_score"     : float (0–100),
      "observed_freq"     : {1: float, ..., 9: float},
      "expected_freq"     : {1: float, ..., 9: float},
      "suspicious_digits" : [int],   # digits deviating most from Benford
      "evidence"          : str,
    }
    """
    clean = [v for v in values if v and v > 0]
    n = len(clean)

    if n < _MIN_SAMPLES:
        return {
            "sample_size"     : n,
            "chi2_statistic"  : None,
            "p_value"         : None,
            "violated"        : False,
            "anomaly_score"   : 0.0,
            "observed_freq"   : {},
            "expected_freq"   : {d: round(_BENFORD_PROBS[d - 1], 4) for d in range(1, 10)},
            "suspicious_digits": [],
            "evidence"        : f"Insufficient samples ({n} < {_MIN_SAMPLES}) for Benford analysis",
        }

    # Count first digits
    counts = np.zeros(9, dtype=float)
    for v in clean:
        d = _first_digit(v)
        if d is not None:
            counts[d - 1] += 1

    observed_freq = counts / counts.sum()
    expected_freq = _BENFORD_PROBS.copy()

    # Chi-square test
    chi2, p_value = _run_chisquare(counts, expected_freq * n)

    violated = (p_value is not None) and (p_value < 0.05)

    # Anomaly score: map p-value to 0–100
    # p=0.001 → ~90, p=0.05 → ~30, p>0.5 → 0
    if p_value is None:
        score = 0.0
    elif p_value < 0.001:
        score = 90.0
    elif p_value < 0.01:
        score = 70.0
    elif p_value < 0.05:
        score = 50.0
    elif p_value < 0.1:
        score = 25.0
    else:
        score = 0.0

    # Identify digits that deviate most
    deviations = np.abs(observed_freq - expected_freq)
    suspicious_digits = [
        int(d + 1) for d in np.argsort(deviations)[-3:][::-1]
        if deviations[d] > 0.03
    ]

    # Build human-readable evidence
    if violated:
        digit_strs = ", ".join(str(d) for d in suspicious_digits)
        evidence = (
            f"Benford's Law violated (χ²={chi2:.2f}, p={p_value:.4f}). "
            f"Digits {digit_strs} appear abnormally "
            f"{'over' if observed_freq[suspicious_digits[0]-1] > expected_freq[suspicious_digits[0]-1] else 'under'}"
            f"-represented — consistent with fabricated invoice values."
        )
    else:
        evidence = (
            f"First-digit distribution follows Benford's Law (p={p_value:.3f}). "
            "No manipulation pattern detected."
        )

    return {
        "sample_size"       : n,
        "chi2_statistic"    : round(float(chi2), 4) if chi2 is not None else None,
        "p_value"           : round(float(p_value), 6) if p_value is not None else None,
        "violated"          : violated,
        "anomaly_score"     : round(score, 1),
        "observed_freq"     : {d: round(float(observed_freq[d - 1]), 4) for d in range(1, 10)},
        "expected_freq"     : {d: round(float(expected_freq[d - 1]), 4) for d in range(1, 10)},
        "suspicious_digits" : suspicious_digits,
        "evidence"          : evidence,
    }


def _run_chisquare(observed: np.ndarray, expected: np.ndarray):
    """Chi-square goodness-of-fit; returns (chi2, p_value)."""
    # Merge cells with expected count < 5 (Cochran's rule)
    obs = observed.copy()
    exp = expected.copy()
    # Simple left-merge
    merged_obs, merged_exp = [], []
    buf_o, buf_e = 0.0, 0.0
    for o, e in zip(obs, exp):
        buf_o += o
        buf_e += e
        if buf_e >= 5:
            merged_obs.append(buf_o)
            merged_exp.append(buf_e)
            buf_o, buf_e = 0.0, 0.0
    if buf_e > 0:
        if merged_obs:
            merged_obs[-1] += buf_o
            merged_exp[-1] += buf_e
        else:
            merged_obs.append(buf_o)
            merged_exp.append(buf_e)

    if len(merged_obs) < 2:
        return None, None

    m_obs = np.array(merged_obs, dtype=float)
    m_exp = np.array(merged_exp, dtype=float)

    if _SCIPY_AVAILABLE:
        try:
            stat, p = _chisquare(m_obs, f_exp=m_exp)
            return float(stat), float(p)
        except Exception:
            pass

    # Manual chi-square
    chi2 = float(np.sum((m_obs - m_exp) ** 2 / m_exp.clip(min=1e-9)))
    df = len(m_obs) - 1
    # Approximate p-value using regularised incomplete gamma
    p = _chi2_pvalue(chi2, df)
    return chi2, p


def _chi2_pvalue(chi2: float, df: int) -> float:
    """Rough chi-square p-value via series expansion (no scipy needed)."""
    try:
        import scipy.special as sp
        return float(1 - sp.gammainc(df / 2, chi2 / 2))
    except Exception:
        pass
    # Very rough normal approximation for df > 1
    if df <= 0:
        return 1.0
    z = ((chi2 / df) ** (1 / 3) - (1 - 2 / (9 * df))) / math.sqrt(2 / (9 * df))
    # Standard normal survival
    return max(0.0, 1 - _norm_cdf(z))


def _norm_cdf(x: float) -> float:
    return (1 + math.erf(x / math.sqrt(2))) / 2
