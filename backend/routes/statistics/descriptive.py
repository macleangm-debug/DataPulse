"""Descriptive Statistics Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats

from .utils import BaseStatsRequest, get_analysis_data, safe_float, safe_int
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class DescriptiveRequest(BaseStatsRequest):
    variables: List[str]
    group_var: Optional[str] = None


@router.post("/descriptives")
@limiter.limit(RATE_LIMIT_STATS)
async def get_descriptive_stats(request: Request, req: DescriptiveRequest):
    """Calculate descriptive statistics for specified variables"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    results = {
        "variables": {},
        "total_n": len(df),
        "data_info": metadata  # Include sampling info
    }
    
    for var in req.variables:
        if var not in df.columns:
            continue
            
        col = pd.to_numeric(df[var], errors='coerce').dropna()
        
        if len(col) == 0:
            results["variables"][var] = {"error": "No numeric data"}
            continue
        
        var_stats = {
            "n": safe_int(len(col)),
            "mean": round(safe_float(col.mean()), 3),
            "std": round(safe_float(col.std()), 3),
            "min": round(safe_float(col.min()), 3),
            "max": round(safe_float(col.max()), 3),
            "median": round(safe_float(col.median()), 3),
            "q1": round(safe_float(col.quantile(0.25)), 3),
            "q3": round(safe_float(col.quantile(0.75)), 3),
            "skewness": round(safe_float(scipy_stats.skew(col)), 3),
            "kurtosis": round(safe_float(scipy_stats.kurtosis(col)), 3),
            "se_mean": round(safe_float(col.std() / np.sqrt(len(col))), 4),
            "cv": round(safe_float((col.std() / col.mean()) * 100), 2) if col.mean() != 0 else None
        }
        
        # Confidence interval for mean
        ci = scipy_stats.t.interval(0.95, len(col)-1, loc=col.mean(), scale=col.std()/np.sqrt(len(col)))
        var_stats["ci_95"] = [round(safe_float(ci[0]), 3), round(safe_float(ci[1]), 3)]
        
        # Normality test
        if len(col) >= 8:
            stat, p_val = scipy_stats.shapiro(col[:5000]) if len(col) > 5000 else scipy_stats.shapiro(col)
            var_stats["normality"] = {
                "shapiro_w": round(safe_float(stat), 4),
                "p_value": round(safe_float(p_val), 4),
                "is_normal": bool(p_val > 0.05)
            }
        
        results["variables"][var] = var_stats
    
    # Group statistics if specified
    if req.group_var and req.group_var in df.columns:
        results["by_group"] = {}
        for group in df[req.group_var].unique():
            group_df = df[df[req.group_var] == group]
            group_stats = {}
            for var in req.variables:
                if var in group_df.columns:
                    col = pd.to_numeric(group_df[var], errors='coerce').dropna()
                    if len(col) > 0:
                        group_stats[var] = {
                            "n": safe_int(len(col)),
                            "mean": round(safe_float(col.mean()), 3),
                            "std": round(safe_float(col.std()), 3)
                        }
            results["by_group"][str(group)] = group_stats
    
    return results
