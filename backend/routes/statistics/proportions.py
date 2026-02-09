"""Proportions and Chi-Square Tests Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
import statsmodels.api as sm
from statsmodels.stats.proportion import proportions_ztest

from .utils import BaseStatsRequest, get_analysis_data, safe_float, safe_int
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class ProportionsRequest(BaseStatsRequest):
    variable: str
    group_var: Optional[str] = None
    success_value: Optional[str] = None
    test_type: str = "two_proportion"  # two_proportion, one_proportion, chi_square


class ChiSquareRequest(BaseStatsRequest):
    variable1: str
    variable2: str


@router.post("/proportions")
@limiter.limit(RATE_LIMIT_STATS)
async def run_proportions_test(request: Request, req: ProportionsRequest):
    """Run proportions tests (one-sample, two-sample, or chi-square)"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    if req.variable not in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable {req.variable} not found")
    
    result = {"variable": req.variable, "test_type": req.test_type}
    
    if req.test_type == "two_proportion" and req.group_var:
        # Two-proportion z-test
        data = df[[req.variable, req.group_var]].dropna()
        groups = data[req.group_var].unique()
        
        if len(groups) != 2:
            raise HTTPException(status_code=400, detail="Exactly 2 groups required")
        
        # Determine success value
        success_val = req.success_value or data[req.variable].mode().iloc[0]
        
        counts = []
        totals = []
        proportions = {}
        
        for group in groups:
            group_data = data[data[req.group_var] == group][req.variable]
            n = len(group_data)
            successes = (group_data == success_val).sum()
            counts.append(successes)
            totals.append(n)
            proportions[str(group)] = {
                "n": safe_int(n),
                "successes": safe_int(successes),
                "proportion": round(safe_float(successes / n), 4) if n > 0 else 0
            }
        
        # Run z-test
        z_stat, p_value = proportions_ztest(counts, totals)
        
        # Effect size (Cohen's h)
        p1, p2 = counts[0]/totals[0], counts[1]/totals[1]
        h = 2 * (np.arcsin(np.sqrt(p1)) - np.arcsin(np.sqrt(p2)))
        
        result.update({
            "success_value": str(success_val),
            "group_proportions": proportions,
            "z_statistic": round(safe_float(z_stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "effect_size": {"cohens_h": round(safe_float(h), 3)},
            "significant": bool(p_value < 0.05),
            "interpretation": f"The difference in proportions is {'statistically significant' if p_value < 0.05 else 'not statistically significant'} (z = {z_stat:.3f}, p = {p_value:.4f})."
        })
        
    elif req.test_type == "chi_square":
        # Chi-square goodness of fit
        freq = df[req.variable].value_counts()
        expected = np.full(len(freq), len(df) / len(freq))
        
        chi2, p_value = scipy_stats.chisquare(freq.values, expected)
        
        result.update({
            "observed": {str(k): safe_int(v) for k, v in freq.items()},
            "chi_square": round(safe_float(chi2), 4),
            "df": len(freq) - 1,
            "p_value": round(safe_float(p_value), 4),
            "significant": bool(p_value < 0.05)
        })
    
    return result


@router.post("/chi-square")
@limiter.limit(RATE_LIMIT_STATS)
async def run_chi_square(request: Request, req: ChiSquareRequest):
    """Run chi-square test of independence"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=getattr(req, 'sample', True),
        sample_size=getattr(req, 'sample_size', 10000)
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Create contingency table
    data = df[[req.variable1, req.variable2]].dropna()
    contingency = pd.crosstab(data[req.variable1], data[req.variable2])
    
    # Run chi-square test
    chi2, p_value, dof, expected = scipy_stats.chi2_contingency(contingency)
    
    # Cramér's V effect size
    n = contingency.sum().sum()
    min_dim = min(contingency.shape[0] - 1, contingency.shape[1] - 1)
    cramers_v = np.sqrt(chi2 / (n * min_dim)) if min_dim > 0 else 0
    
    return {
        "variable1": req.variable1,
        "variable2": req.variable2,
        "contingency_table": contingency.to_dict(),
        "chi_square": round(safe_float(chi2), 4),
        "df": safe_int(dof),
        "p_value": round(safe_float(p_value), 4),
        "effect_size": {
            "cramers_v": round(safe_float(cramers_v), 3),
            "interpretation": "strong" if cramers_v >= 0.5 else "moderate" if cramers_v >= 0.3 else "weak"
        },
        "significant": bool(p_value < 0.05),
        "interpretation": f"Chi-square test {'found' if p_value < 0.05 else 'did not find'} a significant association (χ²({dof}) = {chi2:.3f}, p = {p_value:.4f}, Cramér's V = {cramers_v:.3f})."
    }
