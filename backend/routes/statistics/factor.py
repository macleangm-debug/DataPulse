"""Factor Analysis and Reliability Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_kmo, calculate_bartlett_sphericity

from .utils import BaseStatsRequest, get_analysis_data, safe_float, safe_int
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class ReliabilityRequest(BaseStatsRequest):
    variables: List[str]


class FactorAnalysisRequest(BaseStatsRequest):
    variables: List[str]
    n_factors: Optional[int] = None
    rotation: str = "varimax"


@router.post("/reliability")
@limiter.limit(RATE_LIMIT_STATS)
async def run_reliability(request: Request, req: ReliabilityRequest):
    """Calculate Cronbach's alpha and item-total statistics"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Prepare data
    valid_vars = [v for v in req.variables if v in df.columns]
    if len(valid_vars) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 variables")
    
    data = df[valid_vars].apply(pd.to_numeric, errors='coerce').dropna()
    
    if len(data) < 10:
        raise HTTPException(status_code=400, detail="Insufficient data")
    
    # Calculate Cronbach's alpha
    n_items = len(valid_vars)
    item_vars = data.var(axis=0).sum()
    total_var = data.sum(axis=1).var()
    
    alpha = (n_items / (n_items - 1)) * (1 - item_vars / total_var)
    
    # Item-total statistics
    item_stats = []
    for var in valid_vars:
        other_vars = [v for v in valid_vars if v != var]
        scale_without = data[other_vars].sum(axis=1)
        
        # Correlation with total (without item)
        item_total_corr = data[var].corr(scale_without)
        
        # Alpha if item deleted
        if len(other_vars) >= 2:
            other_data = data[other_vars]
            other_item_vars = other_data.var(axis=0).sum()
            other_total_var = other_data.sum(axis=1).var()
            alpha_deleted = ((n_items - 1) / (n_items - 2)) * (1 - other_item_vars / other_total_var)
        else:
            alpha_deleted = None
        
        item_stats.append({
            "variable": var,
            "mean": round(safe_float(data[var].mean()), 3),
            "std": round(safe_float(data[var].std()), 3),
            "item_total_correlation": round(safe_float(item_total_corr), 3),
            "alpha_if_deleted": round(safe_float(alpha_deleted), 4) if alpha_deleted else None
        })
    
    # Interpretation
    if alpha >= 0.9:
        interpretation = "Excellent internal consistency"
    elif alpha >= 0.8:
        interpretation = "Good internal consistency"
    elif alpha >= 0.7:
        interpretation = "Acceptable internal consistency"
    elif alpha >= 0.6:
        interpretation = "Questionable internal consistency"
    else:
        interpretation = "Poor internal consistency"
    
    return {
        "n": len(data),
        "n_items": n_items,
        "cronbachs_alpha": round(safe_float(alpha), 4),
        "interpretation": interpretation,
        "item_statistics": item_stats,
        "scale_statistics": {
            "mean": round(safe_float(data.sum(axis=1).mean()), 3),
            "std": round(safe_float(data.sum(axis=1).std()), 3),
            "variance": round(safe_float(total_var), 3)
        }
    }


@router.post("/factor-analysis")
@limiter.limit(RATE_LIMIT_STATS)
async def run_factor_analysis(request: Request, req: FactorAnalysisRequest):
    """Run Exploratory Factor Analysis"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Prepare data
    valid_vars = [v for v in req.variables if v in df.columns]
    if len(valid_vars) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 variables")
    
    data = df[valid_vars].apply(pd.to_numeric, errors='coerce').dropna()
    
    if len(data) < len(valid_vars) * 5:
        raise HTTPException(status_code=400, detail="Insufficient data for factor analysis")
    
    # Check suitability
    try:
        kmo_all, kmo_model = calculate_kmo(data)
        bartlett_chi, bartlett_p = calculate_bartlett_sphericity(data)
    except Exception:
        kmo_model = 0.5
        bartlett_p = 0.05
    
    # Determine number of factors if not specified
    if req.n_factors is None:
        # Use Kaiser criterion (eigenvalues > 1)
        fa_test = FactorAnalyzer(rotation=None, n_factors=len(valid_vars))
        fa_test.fit(data)
        eigenvalues = fa_test.get_eigenvalues()[0]
        req.n_factors = max(1, sum(eigenvalues > 1))
    
    # Run factor analysis
    fa = FactorAnalyzer(
        n_factors=req.n_factors,
        rotation=req.rotation if req.rotation != "none" else None
    )
    fa.fit(data)
    
    # Get results
    loadings = fa.loadings_
    eigenvalues, _ = fa.get_eigenvalues()
    communalities = fa.get_communalities()
    variance = fa.get_factor_variance()
    
    # Format loadings
    loading_matrix = {}
    for i, var in enumerate(valid_vars):
        loading_matrix[var] = {
            f"Factor {j+1}": round(safe_float(loadings[i, j]), 3)
            for j in range(req.n_factors)
        }
        loading_matrix[var]["communality"] = round(safe_float(communalities[i]), 3)
    
    # Factor variance
    factor_variance = []
    for j in range(req.n_factors):
        factor_variance.append({
            "factor": f"Factor {j+1}",
            "eigenvalue": round(safe_float(eigenvalues[j]), 3),
            "variance_explained": round(safe_float(variance[1][j] * 100), 2),
            "cumulative": round(safe_float(variance[2][j] * 100), 2)
        })
    
    return {
        "n": len(data),
        "n_factors": req.n_factors,
        "rotation": req.rotation,
        "suitability": {
            "kmo": round(safe_float(kmo_model), 3),
            "kmo_interpretation": "excellent" if kmo_model >= 0.9 else "good" if kmo_model >= 0.8 else "acceptable" if kmo_model >= 0.7 else "poor",
            "bartlett_chi": round(safe_float(bartlett_chi), 2) if bartlett_chi else None,
            "bartlett_p": round(safe_float(bartlett_p), 4) if bartlett_p else None
        },
        "loadings": loading_matrix,
        "factor_variance": factor_variance,
        "total_variance_explained": round(safe_float(variance[2][-1] * 100), 2),
        "interpretation": f"Factor analysis extracted {req.n_factors} factors explaining {variance[2][-1]*100:.1f}% of total variance. KMO = {kmo_model:.3f}."
    }
