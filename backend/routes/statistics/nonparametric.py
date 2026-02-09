"""Nonparametric Tests Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats

from .utils import BaseStatsRequest, get_analysis_data, safe_float, safe_int
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class NonparametricRequest(BaseStatsRequest):
    variable: str
    group_var: Optional[str] = None
    paired_var: Optional[str] = None
    test_type: str = "mann_whitney"  # mann_whitney, wilcoxon, kruskal_wallis


@router.post("/nonparametric")
@limiter.limit(RATE_LIMIT_STATS)
async def run_nonparametric_test(request: Request, req: NonparametricRequest):
    """Run nonparametric tests"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    result = {"test_type": req.test_type, "variable": req.variable}
    
    if req.test_type == "mann_whitney":
        if not req.group_var:
            raise HTTPException(status_code=400, detail="Group variable required")
        
        data = df[[req.variable, req.group_var]].dropna()
        data[req.variable] = pd.to_numeric(data[req.variable], errors='coerce')
        data = data.dropna()
        
        groups = data[req.group_var].unique()
        if len(groups) != 2:
            raise HTTPException(status_code=400, detail="Exactly 2 groups required")
        
        group1 = data[data[req.group_var] == groups[0]][req.variable]
        group2 = data[data[req.group_var] == groups[1]][req.variable]
        
        u_stat, p_value = scipy_stats.mannwhitneyu(group1, group2, alternative='two-sided')
        
        # Effect size (rank-biserial correlation)
        n1, n2 = len(group1), len(group2)
        r = 1 - (2 * u_stat) / (n1 * n2)
        
        result.update({
            "groups": {
                str(groups[0]): {"n": safe_int(n1), "median": round(safe_float(group1.median()), 3), "mean_rank": round(safe_float(scipy_stats.rankdata(pd.concat([group1, group2]))[:n1].mean()), 2)},
                str(groups[1]): {"n": safe_int(n2), "median": round(safe_float(group2.median()), 3), "mean_rank": round(safe_float(scipy_stats.rankdata(pd.concat([group1, group2]))[n1:].mean()), 2)}
            },
            "u_statistic": round(safe_float(u_stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "effect_size": {"rank_biserial_r": round(r, 3)},
            "significant": bool(p_value < 0.05),
            "interpretation": f"Mann-Whitney U test {'found' if p_value < 0.05 else 'did not find'} a significant difference (U = {u_stat:.1f}, p = {p_value:.4f})."
        })
        
    elif req.test_type == "wilcoxon":
        if not req.paired_var:
            raise HTTPException(status_code=400, detail="Paired variable required")
        
        data = df[[req.variable, req.paired_var]].dropna()
        data[req.variable] = pd.to_numeric(data[req.variable], errors='coerce')
        data[req.paired_var] = pd.to_numeric(data[req.paired_var], errors='coerce')
        data = data.dropna()
        
        var1 = data[req.variable]
        var2 = data[req.paired_var]
        
        stat, p_value = scipy_stats.wilcoxon(var1, var2)
        
        # Effect size (r = Z / sqrt(N))
        n = len(data)
        z = scipy_stats.norm.ppf(1 - p_value/2)
        r = z / np.sqrt(n)
        
        result.update({
            "n_pairs": safe_int(n),
            "variable_1": {"median": round(safe_float(var1.median()), 3)},
            "variable_2": {"median": round(safe_float(var2.median()), 3)},
            "w_statistic": round(safe_float(stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "effect_size": {"r": round(r, 3)},
            "significant": bool(p_value < 0.05)
        })
        
    elif req.test_type == "kruskal_wallis":
        if not req.group_var:
            raise HTTPException(status_code=400, detail="Group variable required")
        
        data = df[[req.variable, req.group_var]].dropna()
        data[req.variable] = pd.to_numeric(data[req.variable], errors='coerce')
        data = data.dropna()
        
        groups = [group[req.variable].values for name, group in data.groupby(req.group_var)]
        
        if len(groups) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 groups")
        
        h_stat, p_value = scipy_stats.kruskal(*groups)
        
        # Effect size (epsilon-squared)
        n = len(data)
        k = len(groups)
        epsilon_sq = (h_stat - k + 1) / (n - k)
        
        group_stats = {}
        for name, group in data.groupby(req.group_var):
            group_stats[str(name)] = {
                "n": safe_int(len(group)),
                "median": round(safe_float(group[req.variable].median()), 3)
            }
        
        result.update({
            "group_statistics": group_stats,
            "h_statistic": round(safe_float(h_stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "df": k - 1,
            "effect_size": {"epsilon_squared": round(max(0, epsilon_sq), 4)},
            "significant": bool(p_value < 0.05),
            "interpretation": f"Kruskal-Wallis test {'found' if p_value < 0.05 else 'did not find'} a significant difference (H({k-1}) = {h_stat:.3f}, p = {p_value:.4f})."
        })
    
    return result


@router.post("/nonparametric/mannwhitney")
async def run_mann_whitney(request: Request, req: NonparametricRequest):
    """Alias for Mann-Whitney U test"""
    req.test_type = "mann_whitney"
    return await run_nonparametric_test(request, req)


@router.post("/nonparametric/kruskal")
async def run_kruskal_wallis(request: Request, req: NonparametricRequest):
    """Alias for Kruskal-Wallis test"""
    req.test_type = "kruskal_wallis"
    return await run_nonparametric_test(request, req)
