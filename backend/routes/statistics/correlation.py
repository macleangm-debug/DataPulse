"""Correlation Analysis Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats

from .utils import BaseStatsRequest, get_analysis_data, safe_float
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class CorrelationRequest(BaseStatsRequest):
    variables: List[str]
    method: str = "pearson"  # pearson, spearman, kendall


@router.post("/correlation")
@limiter.limit(RATE_LIMIT_STATS)
async def run_correlation(request: Request, req: CorrelationRequest):
    """Calculate correlation matrix"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Filter to requested variables
    valid_vars = [v for v in req.variables if v in df.columns]
    if len(valid_vars) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 valid variables")
    
    # Convert to numeric
    data = df[valid_vars].apply(pd.to_numeric, errors='coerce')
    data = data.dropna()
    
    if len(data) < 3:
        raise HTTPException(status_code=400, detail="Insufficient data for correlation")
    
    # Calculate correlations
    if req.method == "pearson":
        corr_matrix = data.corr(method='pearson')
    elif req.method == "spearman":
        corr_matrix = data.corr(method='spearman')
    elif req.method == "kendall":
        corr_matrix = data.corr(method='kendall')
    else:
        raise HTTPException(status_code=400, detail=f"Unknown method: {req.method}")
    
    # Calculate p-values
    p_values = {}
    for i, var1 in enumerate(valid_vars):
        p_values[var1] = {}
        for j, var2 in enumerate(valid_vars):
            if i < j:
                if req.method == "pearson":
                    r, p = scipy_stats.pearsonr(data[var1], data[var2])
                elif req.method == "spearman":
                    r, p = scipy_stats.spearmanr(data[var1], data[var2])
                else:
                    r, p = scipy_stats.kendalltau(data[var1], data[var2])
                p_values[var1][var2] = round(safe_float(p), 4)
                p_values.setdefault(var2, {})[var1] = round(safe_float(p), 4)
    
    # Format correlation matrix
    corr_dict = {}
    for var in valid_vars:
        corr_dict[var] = {v: round(safe_float(corr_matrix.loc[var, v]), 4) for v in valid_vars}
    
    # Find significant correlations
    significant_pairs = []
    for i, var1 in enumerate(valid_vars):
        for j, var2 in enumerate(valid_vars):
            if i < j:
                r = corr_matrix.loc[var1, var2]
                p = p_values.get(var1, {}).get(var2, 1)
                if p < 0.05:
                    strength = "strong" if abs(r) >= 0.7 else "moderate" if abs(r) >= 0.4 else "weak"
                    direction = "positive" if r > 0 else "negative"
                    significant_pairs.append({
                        "var1": var1,
                        "var2": var2,
                        "r": round(safe_float(r), 4),
                        "p_value": p,
                        "interpretation": f"{strength} {direction} correlation"
                    })
    
    return {
        "method": req.method,
        "n": len(data),
        "variables": valid_vars,
        "correlation_matrix": corr_dict,
        "p_values": p_values,
        "significant_correlations": sorted(significant_pairs, key=lambda x: abs(x["r"]), reverse=True),
        "interpretation": f"Correlation analysis ({req.method}) computed for {len(valid_vars)} variables. {len(significant_pairs)} significant correlations found (p < .05)."
    }
