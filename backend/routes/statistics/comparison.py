"""Comparison Tests Routes (T-tests, ANOVA, ANCOVA)"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
import statsmodels.api as sm
from statsmodels.stats.multicomp import pairwise_tukeyhsd

from .utils import (
    BaseStatsRequest, get_analysis_data, calculate_effect_size,
    safe_float, safe_int, interpret_eta_squared
)
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class TTestRequest(BaseStatsRequest):
    variable: str
    group_var: Optional[str] = None
    paired_var: Optional[str] = None
    test_type: str = "independent"  # independent, paired, one_sample
    mu: float = 0  # for one-sample test


class ANOVARequest(BaseStatsRequest):
    dependent_var: str
    group_var: str
    post_hoc: bool = True


class ANCOVARequest(BaseStatsRequest):
    dependent_var: str
    group_var: str
    covariates: List[str]
    post_hoc: bool = True


@router.post("/ttest")
@limiter.limit(RATE_LIMIT_STATS)
async def run_ttest(request: Request, req: TTestRequest):
    """Run t-test (independent, paired, or one-sample)"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=getattr(req, 'sample', True),
        sample_size=getattr(req, 'sample_size', 10000)
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    if req.variable not in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable {req.variable} not found")
    
    result = {"test_type": req.test_type, "variable": req.variable}
    
    if req.test_type == "independent":
        if not req.group_var or req.group_var not in df.columns:
            raise HTTPException(status_code=400, detail="Group variable required")
        
        groups = df[req.group_var].dropna().unique()
        if len(groups) != 2:
            raise HTTPException(status_code=400, detail="Exactly 2 groups required")
        
        group1 = pd.to_numeric(df[df[req.group_var] == groups[0]][req.variable], errors='coerce').dropna()
        group2 = pd.to_numeric(df[df[req.group_var] == groups[1]][req.variable], errors='coerce').dropna()
        
        # Levene's test for equality of variances
        levene_stat, levene_p = scipy_stats.levene(group1, group2)
        equal_var = levene_p > 0.05
        
        t_stat, p_value = scipy_stats.ttest_ind(group1, group2, equal_var=equal_var)
        
        effect = calculate_effect_size("ttest", t_stat=t_stat, n1=len(group1), n2=len(group2))
        
        result.update({
            "groups": {
                str(groups[0]): {"n": safe_int(len(group1)), "mean": round(safe_float(group1.mean()), 3), "std": round(safe_float(group1.std()), 3)},
                str(groups[1]): {"n": safe_int(len(group2)), "mean": round(safe_float(group2.mean()), 3), "std": round(safe_float(group2.std()), 3)}
            },
            "t_statistic": round(safe_float(t_stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "df": safe_int(len(group1) + len(group2) - 2),
            "mean_difference": round(safe_float(group1.mean() - group2.mean()), 3),
            "levene_test": {"statistic": round(safe_float(levene_stat), 4), "p_value": round(safe_float(levene_p), 4), "equal_variances": equal_var},
            "effect_size": effect,
            "significant": bool(p_value < 0.05),
            "interpretation": f"The difference between groups is {'statistically significant' if p_value < 0.05 else 'not statistically significant'} (t = {t_stat:.3f}, p = {p_value:.4f}). {effect['interpretation'].capitalize()}."
        })
        
    elif req.test_type == "paired":
        if not req.paired_var or req.paired_var not in df.columns:
            raise HTTPException(status_code=400, detail="Paired variable required")
        
        data = df[[req.variable, req.paired_var]].dropna()
        var1 = pd.to_numeric(data[req.variable], errors='coerce')
        var2 = pd.to_numeric(data[req.paired_var], errors='coerce')
        
        t_stat, p_value = scipy_stats.ttest_rel(var1, var2)
        
        diff = var1 - var2
        effect_d = safe_float(diff.mean() / diff.std()) if diff.std() > 0 else 0
        
        result.update({
            "n_pairs": safe_int(len(data)),
            "variable_1": {"mean": round(safe_float(var1.mean()), 3), "std": round(safe_float(var1.std()), 3)},
            "variable_2": {"mean": round(safe_float(var2.mean()), 3), "std": round(safe_float(var2.std()), 3)},
            "mean_difference": round(safe_float(diff.mean()), 3),
            "t_statistic": round(safe_float(t_stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "df": safe_int(len(data) - 1),
            "effect_size": {"cohens_d": round(effect_d, 3)},
            "significant": bool(p_value < 0.05)
        })
        
    elif req.test_type == "one_sample":
        col = pd.to_numeric(df[req.variable], errors='coerce').dropna()
        t_stat, p_value = scipy_stats.ttest_1samp(col, req.mu)
        
        result.update({
            "n": safe_int(len(col)),
            "sample_mean": round(safe_float(col.mean()), 3),
            "test_value": req.mu,
            "t_statistic": round(safe_float(t_stat), 4),
            "p_value": round(safe_float(p_value), 4),
            "df": safe_int(len(col) - 1),
            "significant": bool(p_value < 0.05)
        })
    
    return result


@router.post("/anova")
@limiter.limit(RATE_LIMIT_STATS)
async def run_anova(request: Request, req: ANOVARequest):
    """Run one-way ANOVA with optional post-hoc tests"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=getattr(req, 'sample', True),
        sample_size=getattr(req, 'sample_size', 10000)
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Prepare data
    data = df[[req.dependent_var, req.group_var]].dropna()
    data[req.dependent_var] = pd.to_numeric(data[req.dependent_var], errors='coerce')
    data = data.dropna()
    
    groups = [group[req.dependent_var].values for name, group in data.groupby(req.group_var)]
    
    if len(groups) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 groups")
    
    # Run ANOVA
    f_stat, p_value = scipy_stats.f_oneway(*groups)
    
    # Calculate effect size
    grand_mean = data[req.dependent_var].mean()
    ss_between = sum(len(g) * (np.mean(g) - grand_mean)**2 for g in groups)
    ss_total = sum((data[req.dependent_var] - grand_mean)**2)
    eta_sq = ss_between / ss_total if ss_total > 0 else 0
    
    result = {
        "dependent_variable": req.dependent_var,
        "group_variable": req.group_var,
        "f_statistic": round(safe_float(f_stat), 4),
        "p_value": round(safe_float(p_value), 4),
        "df_between": len(groups) - 1,
        "df_within": len(data) - len(groups),
        "eta_squared": round(safe_float(eta_sq), 4),
        "effect_interpretation": interpret_eta_squared(eta_sq),
        "significant": bool(p_value < 0.05),
        "group_statistics": {}
    }
    
    # Group statistics
    for name, group in data.groupby(req.group_var):
        result["group_statistics"][str(name)] = {
            "n": safe_int(len(group)),
            "mean": round(safe_float(group[req.dependent_var].mean()), 3),
            "std": round(safe_float(group[req.dependent_var].std()), 3)
        }
    
    # Post-hoc tests
    if req.post_hoc and p_value < 0.05:
        try:
            tukey = pairwise_tukeyhsd(data[req.dependent_var], data[req.group_var], alpha=0.05)
            result["post_hoc"] = {
                "method": "Tukey HSD",
                "comparisons": []
            }
            for row in tukey.summary().data[1:]:
                result["post_hoc"]["comparisons"].append({
                    "group1": str(row[0]),
                    "group2": str(row[1]),
                    "mean_diff": round(safe_float(row[2]), 3),
                    "p_adj": round(safe_float(row[3]), 4),
                    "lower": round(safe_float(row[4]), 3),
                    "upper": round(safe_float(row[5]), 3),
                    "significant": bool(row[6])
                })
        except Exception:
            pass
    
    result["interpretation"] = f"The ANOVA {'found' if p_value < 0.05 else 'did not find'} a statistically significant difference (F({result['df_between']}, {result['df_within']}) = {f_stat:.3f}, p = {p_value:.4f}, η² = {eta_sq:.3f})."
    
    return result


@router.post("/ancova")
@limiter.limit(RATE_LIMIT_STATS)
async def run_ancova(request: Request, req: ANCOVARequest):
    """Run ANCOVA (Analysis of Covariance)"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=getattr(req, 'sample', True),
        sample_size=getattr(req, 'sample_size', 10000)
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Prepare data
    cols_needed = [req.dependent_var, req.group_var] + req.covariates
    data = df[cols_needed].dropna()
    
    for col in [req.dependent_var] + req.covariates:
        data[col] = pd.to_numeric(data[col], errors='coerce')
    data = data.dropna()
    
    if len(data) < 10:
        raise HTTPException(status_code=400, detail="Insufficient data")
    
    # Create dummy variables for group
    dummies = pd.get_dummies(data[req.group_var], drop_first=True, prefix='group')
    
    # Build design matrix
    X = pd.concat([dummies, data[req.covariates]], axis=1)
    X = sm.add_constant(X)
    y = data[req.dependent_var]
    
    # Fit model
    model = sm.OLS(y, X).fit()
    
    # Calculate effect size (partial eta squared for group effect)
    ss_group = 0
    for col in dummies.columns:
        if col in model.params.index:
            ss_group += (model.params[col] ** 2) * (X[col].var() * len(X))
    
    ss_residual = model.ssr
    partial_eta_sq = ss_group / (ss_group + ss_residual) if (ss_group + ss_residual) > 0 else 0
    
    # Group adjusted means
    covariate_means = {cov: data[cov].mean() for cov in req.covariates}
    adjusted_means = {}
    
    for group in data[req.group_var].unique():
        group_data = data[data[req.group_var] == group]
        raw_mean = group_data[req.dependent_var].mean()
        
        # Calculate adjustment
        adjustment = sum(
            model.params.get(cov, 0) * (group_data[cov].mean() - covariate_means[cov])
            for cov in req.covariates
        )
        
        adjusted_means[str(group)] = {
            "raw_mean": round(safe_float(raw_mean), 3),
            "adjusted_mean": round(safe_float(raw_mean - adjustment), 3),
            "n": safe_int(len(group_data))
        }
    
    result = {
        "dependent_variable": req.dependent_var,
        "group_variable": req.group_var,
        "covariates": req.covariates,
        "model_fit": {
            "r_squared": round(safe_float(model.rsquared), 4),
            "adj_r_squared": round(safe_float(model.rsquared_adj), 4),
            "f_statistic": round(safe_float(model.fvalue), 4),
            "f_p_value": round(safe_float(model.f_pvalue), 4)
        },
        "partial_eta_squared": round(safe_float(partial_eta_sq), 4),
        "effect_interpretation": interpret_eta_squared(partial_eta_sq),
        "adjusted_means": adjusted_means,
        "covariate_effects": {},
        "significant": bool(model.f_pvalue < 0.05)
    }
    
    # Covariate effects
    for cov in req.covariates:
        if cov in model.params.index:
            result["covariate_effects"][cov] = {
                "coefficient": round(safe_float(model.params[cov]), 4),
                "std_error": round(safe_float(model.bse[cov]), 4),
                "t_value": round(safe_float(model.tvalues[cov]), 4),
                "p_value": round(safe_float(model.pvalues[cov]), 4),
                "significant": bool(model.pvalues[cov] < 0.05)
            }
    
    return result
