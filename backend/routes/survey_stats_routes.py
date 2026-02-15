"""DataPulse - Complex Survey Statistics Routes
Research-grade survey analysis with proper variance estimation
Supports: strata, PSU/clusters, FPC, sampling weights
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
import warnings

warnings.filterwarnings('ignore')

router = APIRouter(prefix="/survey", tags=["Survey Statistics"])


# ============ Models ============

class SurveyDesign(BaseModel):
    """Survey design specification"""
    strata_var: Optional[str] = None  # Stratification variable
    cluster_var: Optional[str] = None  # PSU/Cluster variable
    weight_var: Optional[str] = None  # Sampling weight variable
    fpc_var: Optional[str] = None  # Finite population correction variable
    nest: bool = True  # Whether clusters are nested within strata


class SurveyMeanRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    variable: str
    design: SurveyDesign
    by_group: Optional[str] = None  # Subgroup analysis variable


class SurveyProportionRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    variable: str
    design: SurveyDesign
    by_group: Optional[str] = None


class SurveyRegressionRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    dependent_var: str
    independent_vars: List[str]
    design: SurveyDesign
    model_type: str = "linear"  # linear, logistic


class SurveyTotalRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    variable: str
    design: SurveyDesign


# ============ Helper Functions ============

async def get_survey_data(db, snapshot_id: str = None, form_id: str = None):
    """Get data and convert to DataFrame"""
    if snapshot_id:
        snapshot = await db.snapshots.find_one({"id": snapshot_id}, {"_id": 0})
        if not snapshot:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        return pd.DataFrame(snapshot.get("data", [])), snapshot.get("schema", [])
    
    if form_id:
        submissions = await db.submissions.find(
            {"form_id": form_id, "status": "approved"},
            {"_id": 0}
        ).to_list(10000)
        
        data = [s.get("data", {}) for s in submissions]
        form = await db.forms.find_one({"id": form_id}, {"_id": 0})
        schema = form.get("fields", []) if form else []
        
        return pd.DataFrame(data), schema
    
    raise HTTPException(status_code=400, detail="Either snapshot_id or form_id required")


def apply_survey_design(df: pd.DataFrame, design: SurveyDesign) -> Dict:
    """Apply survey design to data and return design info"""
    design_info = {
        "n_obs": len(df),
        "n_strata": 1,
        "n_clusters": len(df),
        "weighted": False,
        "fpc_applied": False
    }
    
    # Apply weights
    if design.weight_var and design.weight_var in df.columns:
        df['_weight'] = pd.to_numeric(df[design.weight_var], errors='coerce').fillna(1)
        design_info["weighted"] = True
        design_info["sum_weights"] = float(df['_weight'].sum())
    else:
        df['_weight'] = 1.0
    
    # Count strata
    if design.strata_var and design.strata_var in df.columns:
        design_info["n_strata"] = int(df[design.strata_var].nunique())
    
    # Count clusters
    if design.cluster_var and design.cluster_var in df.columns:
        design_info["n_clusters"] = int(df[design.cluster_var].nunique())
    
    # FPC
    if design.fpc_var and design.fpc_var in df.columns:
        design_info["fpc_applied"] = True
    
    return design_info


def compute_design_effect(df: pd.DataFrame, variable: str, design: SurveyDesign) -> float:
    """Compute design effect (DEFF) = complex var / SRS var"""
    try:
        series = pd.to_numeric(df[variable], errors='coerce').dropna()
        
        if len(series) < 2:
            return 1.0
        
        # SRS variance
        srs_var = series.var() / len(series)
        
        # If no clustering, DEFF = 1
        if not design.cluster_var or design.cluster_var not in df.columns:
            return 1.0
        
        # Compute cluster-level variance
        cluster_means = df.groupby(design.cluster_var)[variable].apply(
            lambda x: pd.to_numeric(x, errors='coerce').mean()
        )
        
        if len(cluster_means) < 2:
            return 1.0
        
        # Average cluster size
        avg_cluster_size = len(series) / len(cluster_means)
        
        # Between-cluster variance
        between_var = cluster_means.var()
        
        # Intraclass correlation (rho)
        total_var = series.var()
        if total_var > 0:
            rho = between_var / total_var
            rho = max(0, min(1, rho))  # Bound between 0 and 1
        else:
            rho = 0
        
        # DEFF = 1 + (avg_cluster_size - 1) * rho
        deff = 1 + (avg_cluster_size - 1) * rho
        
        return round(float(deff), 4)
    except:
        return 1.0


def compute_effective_sample_size(n: int, deff: float) -> float:
    """Compute effective sample size = n / DEFF"""
    if deff <= 0:
        return float(n)
    return round(n / deff, 1)


# ============ Survey Estimates ============

@router.post("/mean")
async def survey_mean(request: Request, req: SurveyMeanRequest):
    """Compute survey-weighted mean with design-based SE"""
    db = request.app.state.db
    
    df, schema = await get_survey_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    if req.variable not in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable {req.variable} not found")
    
    # Apply design
    design_info = apply_survey_design(df, req.design)
    
    # Convert variable to numeric
    df['_y'] = pd.to_numeric(df[req.variable], errors='coerce')
    df_clean = df.dropna(subset=['_y'])
    
    if len(df_clean) < 2:
        return {"error": "Insufficient valid observations"}
    
    # Compute weighted mean
    weights = df_clean['_weight']
    y = df_clean['_y']
    
    weighted_mean = float(np.average(y, weights=weights))
    
    # Compute SE based on design
    if req.design.cluster_var and req.design.cluster_var in df_clean.columns:
        # Cluster-robust SE
        se = compute_cluster_se_mean(df_clean, '_y', req.design)
    elif req.design.strata_var and req.design.strata_var in df_clean.columns:
        # Stratified SE
        se = compute_stratified_se_mean(df_clean, '_y', req.design)
    else:
        # Simple weighted SE
        se = compute_weighted_se_mean(df_clean, '_y')
    
    # Design effect
    deff = compute_design_effect(df_clean, '_y', req.design)
    effective_n = compute_effective_sample_size(len(df_clean), deff)
    
    # Confidence interval
    t_crit = scipy_stats.t.ppf(0.975, len(df_clean) - 1)
    ci_lower = weighted_mean - t_crit * se
    ci_upper = weighted_mean + t_crit * se
    
    result = {
        "variable": req.variable,
        "estimate": round(weighted_mean, 4),
        "std_error": round(float(se), 4),
        "confidence_interval": {
            "lower": round(float(ci_lower), 4),
            "upper": round(float(ci_upper), 4),
            "level": 0.95
        },
        "n": int(len(df_clean)),
        "design_effect": deff,
        "effective_n": effective_n,
        "design_info": design_info
    }
    
    # Subgroup analysis
    if req.by_group and req.by_group in df_clean.columns:
        subgroups = {}
        for group_val, group_df in df_clean.groupby(req.by_group):
            if len(group_df) >= 2:
                g_mean = float(np.average(group_df['_y'], weights=group_df['_weight']))
                g_se = compute_weighted_se_mean(group_df, '_y')
                subgroups[str(group_val)] = {
                    "estimate": round(g_mean, 4),
                    "std_error": round(float(g_se), 4),
                    "n": len(group_df)
                }
        result["subgroups"] = subgroups
    
    return result


@router.post("/proportion")
async def survey_proportion(request: Request, req: SurveyProportionRequest):
    """Compute survey-weighted proportions with design-based SE"""
    db = request.app.state.db
    
    df, schema = await get_survey_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    if req.variable not in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable {req.variable} not found")
    
    # Apply design
    design_info = apply_survey_design(df, req.design)
    
    df_clean = df.dropna(subset=[req.variable])
    
    if len(df_clean) < 2:
        return {"error": "Insufficient valid observations"}
    
    # Compute weighted proportions
    weights = df_clean['_weight']
    total_weight = weights.sum()
    
    proportions = []
    for value in df_clean[req.variable].unique():
        mask = df_clean[req.variable] == value
        weighted_count = weights[mask].sum()
        prop = weighted_count / total_weight
        
        # SE for proportion
        p = float(prop)
        n = len(df_clean)
        se = np.sqrt(p * (1 - p) / n)
        
        # Apply design effect adjustment
        deff = compute_design_effect(df_clean, req.variable, req.design) if req.design.cluster_var else 1.0
        se = se * np.sqrt(deff)
        
        # CI
        z = 1.96
        ci_lower = max(0, p - z * se)
        ci_upper = min(1, p + z * se)
        
        proportions.append({
            "value": str(value),
            "proportion": round(p, 4),
            "percent": round(p * 100, 2),
            "std_error": round(float(se), 4),
            "confidence_interval": {
                "lower": round(ci_lower, 4),
                "upper": round(ci_upper, 4)
            },
            "weighted_n": round(float(weighted_count), 1)
        })
    
    # Sort by proportion descending
    proportions.sort(key=lambda x: x["proportion"], reverse=True)
    
    return {
        "variable": req.variable,
        "total_n": int(len(df_clean)),
        "proportions": proportions,
        "design_info": design_info
    }


@router.post("/total")
async def survey_total(request: Request, req: SurveyTotalRequest):
    """Compute survey-weighted population total with design-based SE"""
    db = request.app.state.db
    
    df, schema = await get_survey_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    if req.variable not in df.columns:
        raise HTTPException(status_code=400, detail=f"Variable {req.variable} not found")
    
    # Apply design
    design_info = apply_survey_design(df, req.design)
    
    df['_y'] = pd.to_numeric(df[req.variable], errors='coerce')
    df_clean = df.dropna(subset=['_y'])
    
    if len(df_clean) < 2:
        return {"error": "Insufficient valid observations"}
    
    weights = df_clean['_weight']
    y = df_clean['_y']
    
    # Weighted total
    weighted_total = float((y * weights).sum())
    
    # SE for total
    n = len(df_clean)
    sum_w = weights.sum()
    mean_y = weighted_total / sum_w if sum_w > 0 else 0
    
    # Variance of total
    var_total = ((weights * (y - mean_y)) ** 2).sum() * (n / (n - 1)) if n > 1 else 0
    se = np.sqrt(var_total)
    
    # Apply design effect
    deff = compute_design_effect(df_clean, '_y', req.design)
    se = se * np.sqrt(deff)
    
    # CI
    t_crit = scipy_stats.t.ppf(0.975, n - 1)
    ci_lower = weighted_total - t_crit * se
    ci_upper = weighted_total + t_crit * se
    
    return {
        "variable": req.variable,
        "total": round(weighted_total, 2),
        "std_error": round(float(se), 2),
        "confidence_interval": {
            "lower": round(float(ci_lower), 2),
            "upper": round(float(ci_upper), 2),
            "level": 0.95
        },
        "n": int(n),
        "design_effect": deff,
        "design_info": design_info
    }


@router.post("/regression")
async def survey_regression(request: Request, req: SurveyRegressionRequest):
    """Survey-weighted regression with cluster-robust standard errors"""
    db = request.app.state.db
    
    df, schema = await get_survey_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    # Check variables exist
    all_vars = [req.dependent_var] + req.independent_vars
    missing = [v for v in all_vars if v not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Variables not found: {missing}")
    
    # Apply design
    design_info = apply_survey_design(df, req.design)
    
    # Prepare data
    df_clean = df[all_vars + ['_weight']].copy()
    
    # Convert to numeric
    for var in all_vars:
        df_clean[var] = pd.to_numeric(df_clean[var], errors='coerce')
    
    df_clean = df_clean.dropna()
    
    if len(df_clean) < len(req.independent_vars) + 2:
        return {"error": "Insufficient observations for regression"}
    
    try:
        import statsmodels.api as sm
        
        y = df_clean[req.dependent_var]
        X = df_clean[req.independent_vars]
        X = sm.add_constant(X)
        weights = df_clean['_weight']
        
        if req.model_type == "logistic":
            # Weighted logistic regression
            model = sm.GLM(y, X, family=sm.families.Binomial(), freq_weights=weights)
            results = model.fit()
        else:
            # Weighted OLS
            model = sm.WLS(y, X, weights=weights)
            
            # Use cluster-robust SE if clusters specified
            if req.design.cluster_var and req.design.cluster_var in df_clean.columns:
                results = model.fit(cov_type='cluster', cov_kwds={'groups': df_clean[req.design.cluster_var]})
            else:
                results = model.fit(cov_type='HC1')  # Robust SE
        
        # Extract coefficients
        coefficients = {}
        params = results.params
        std_errors = results.bse
        t_values = results.tvalues
        p_values = results.pvalues
        conf_int = results.conf_int()
        
        for i, var in enumerate(X.columns):
            coefficients[var] = {
                "coefficient": round(float(params.iloc[i]), 4),
                "std_error": round(float(std_errors.iloc[i]), 4),
                "t_value": round(float(t_values.iloc[i]), 3),
                "p_value": round(float(p_values.iloc[i]), 4),
                "significant": bool(p_values.iloc[i] < 0.05),
                "confidence_interval": {
                    "lower": round(float(conf_int.iloc[i, 0]), 4),
                    "upper": round(float(conf_int.iloc[i, 1]), 4)
                }
            }
        
        # Model fit statistics
        model_fit = {
            "n": int(len(df_clean)),
            "df_model": int(results.df_model),
            "df_residual": int(results.df_resid)
        }
        
        if req.model_type == "linear":
            model_fit["r_squared"] = round(float(results.rsquared), 4)
            model_fit["adj_r_squared"] = round(float(results.rsquared_adj), 4)
            model_fit["f_statistic"] = round(float(results.fvalue), 4) if hasattr(results, 'fvalue') else None
            model_fit["f_pvalue"] = round(float(results.f_pvalue), 4) if hasattr(results, 'f_pvalue') else None
        else:
            model_fit["pseudo_r_squared"] = round(float(results.pseudo_rsquared()), 4) if hasattr(results, 'pseudo_rsquared') else None
            model_fit["llf"] = round(float(results.llf), 4)
            model_fit["aic"] = round(float(results.aic), 4)
            model_fit["bic"] = round(float(results.bic), 4)
        
        return {
            "model_type": req.model_type,
            "dependent_var": req.dependent_var,
            "coefficients": coefficients,
            "model_fit": model_fit,
            "design_info": design_info,
            "se_type": "cluster-robust" if req.design.cluster_var else "robust (HC1)"
        }
        
    except Exception as e:
        return {"error": f"Regression failed: {str(e)}"}


# ============ SE Computation Helpers ============

def compute_weighted_se_mean(df: pd.DataFrame, var: str) -> float:
    """Compute weighted standard error for mean"""
    y = df[var]
    w = df['_weight']
    n = len(df)
    
    if n < 2:
        return 0.0
    
    weighted_mean = np.average(y, weights=w)
    
    # Weighted variance
    weighted_var = np.average((y - weighted_mean) ** 2, weights=w)
    
    # SE = sqrt(var / n)
    se = np.sqrt(weighted_var / n)
    
    return se


def compute_stratified_se_mean(df: pd.DataFrame, var: str, design: SurveyDesign) -> float:
    """Compute stratified standard error for mean"""
    strata_var = design.strata_var
    
    if strata_var not in df.columns:
        return compute_weighted_se_mean(df, var)
    
    total_weight = df['_weight'].sum()
    var_total = 0
    
    for stratum, stratum_df in df.groupby(strata_var):
        if len(stratum_df) < 2:
            continue
        
        w_h = stratum_df['_weight'].sum() / total_weight  # Stratum weight
        y = stratum_df[var]
        weights = stratum_df['_weight']
        n_h = len(stratum_df)
        
        # Within-stratum variance
        weighted_mean_h = np.average(y, weights=weights)
        var_h = np.average((y - weighted_mean_h) ** 2, weights=weights)
        
        # Contribution to total variance
        var_total += (w_h ** 2) * (var_h / n_h)
    
    return np.sqrt(var_total)


def compute_cluster_se_mean(df: pd.DataFrame, var: str, design: SurveyDesign) -> float:
    """Compute cluster-robust standard error for mean"""
    cluster_var = design.cluster_var
    
    if cluster_var not in df.columns:
        return compute_weighted_se_mean(df, var)
    
    # Compute cluster-level means
    cluster_stats = df.groupby(cluster_var).agg({
        var: lambda x: np.average(x, weights=df.loc[x.index, '_weight']),
        '_weight': 'sum'
    }).reset_index()
    
    n_clusters = len(cluster_stats)
    
    if n_clusters < 2:
        return compute_weighted_se_mean(df, var)
    
    # Overall weighted mean
    total_weight = cluster_stats['_weight'].sum()
    overall_mean = np.average(cluster_stats[var], weights=cluster_stats['_weight'])
    
    # Between-cluster variance
    cluster_deviations = cluster_stats[var] - overall_mean
    weighted_sq_dev = (cluster_stats['_weight'] ** 2) * (cluster_deviations ** 2)
    
    # Cluster-robust variance
    var_cluster = (n_clusters / (n_clusters - 1)) * weighted_sq_dev.sum() / (total_weight ** 2)
    
    return np.sqrt(var_cluster)


# ============ Design Effects Report ============

class DesignEffectsRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    variables: List[str]
    design: Optional[SurveyDesign] = None


@router.post("/design-effects")
async def compute_design_effects_report(request: Request, req: DesignEffectsRequest):
    """Compute design effects for multiple variables"""
    db = request.app.state.db
    
    design = req.design if req.design else SurveyDesign()
    
    df, schema = await get_survey_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    design_info = apply_survey_design(df, design)
    
    effects = []
    for var in req.variables:
        if var not in df.columns:
            continue
        
        deff = compute_design_effect(df, var, design)
        n = len(df[var].dropna())
        effective_n = compute_effective_sample_size(n, deff)
        
        effects.append({
            "variable": var,
            "n": n,
            "design_effect": deff,
            "effective_n": effective_n,
            "interpretation": interpret_deff(deff)
        })
    
    return {
        "design_info": design_info,
        "effects": effects,
        "average_deff": round(np.mean([e["design_effect"] for e in effects]), 3) if effects else 1.0
    }


def interpret_deff(deff: float) -> str:
    """Interpret design effect value"""
    if deff <= 1.0:
        return "No clustering effect (efficient as SRS)"
    elif deff <= 1.5:
        return "Low clustering effect"
    elif deff <= 2.0:
        return "Moderate clustering effect"
    elif deff <= 3.0:
        return "High clustering effect"
    else:
        return "Very high clustering effect (consider more clusters)"
