"""Regression Analysis Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
import statsmodels.api as sm

from .utils import BaseStatsRequest, get_analysis_data, safe_float, safe_int
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class RegressionRequest(BaseStatsRequest):
    dependent_var: str
    independent_vars: List[str]
    model_type: str = "ols"  # ols, logistic, poisson, negbin
    robust_se: bool = False
    interactions: Optional[List[str]] = None
    include_diagnostics: bool = True


@router.post("/regression")
@limiter.limit(RATE_LIMIT_STATS)
async def run_regression(request: Request, req: RegressionRequest):
    """Run regression analysis (OLS, Logistic, Poisson, Negative Binomial)"""
    db = request.app.state.db
    df, schema, metadata = await get_analysis_data(
        db, req.snapshot_id, req.form_id,
        sample=req.sample, sample_size=req.sample_size
    )
    
    if df.empty:
        raise HTTPException(status_code=404, detail="No data found")
    
    # Prepare data
    all_vars = [req.dependent_var] + req.independent_vars
    df_model = df[all_vars].apply(pd.to_numeric, errors='coerce').dropna()
    
    if len(df_model) < len(req.independent_vars) + 10:
        raise HTTPException(status_code=400, detail="Insufficient data for regression")
    
    y = df_model[req.dependent_var]
    X = df_model[req.independent_vars].copy()
    
    # Add interaction terms if specified
    interaction_info = []
    if req.interactions:
        for interaction in req.interactions:
            if '*' in interaction:
                var1, var2 = interaction.split('*')
                if var1 in X.columns and var2 in X.columns:
                    interaction_name = f"{var1}_x_{var2}"
                    X[interaction_name] = X[var1] * X[var2]
                    interaction_info.append({
                        "term": interaction_name,
                        "components": [var1, var2]
                    })
    
    X = sm.add_constant(X)
    
    try:
        if req.model_type == "ols":
            model = sm.OLS(y, X)
            results = model.fit(cov_type='HC3') if req.robust_se else model.fit()
        elif req.model_type == "logistic":
            model = sm.Logit(y, X)
            results = model.fit(disp=0)
        elif req.model_type == "poisson":
            model = sm.Poisson(y, X)
            results = model.fit(disp=0)
        elif req.model_type == "negbin":
            model = sm.NegativeBinomial(y, X)
            results = model.fit(disp=0)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown model type: {req.model_type}")
        
        # Extract coefficients
        coefficients = {}
        for var in results.params.index:
            coef_name = var if var != 'const' else 'Intercept'
            coefficients[coef_name] = {
                "coefficient": round(safe_float(results.params[var]), 4),
                "std_error": round(safe_float(results.bse[var]), 4),
                "t_value": round(safe_float(results.tvalues[var]), 4),
                "p_value": round(safe_float(results.pvalues[var]), 4),
                "ci_lower": round(safe_float(results.conf_int().loc[var, 0]), 4),
                "ci_upper": round(safe_float(results.conf_int().loc[var, 1]), 4),
                "significant": bool(results.pvalues[var] < 0.05)
            }
        
        # Model fit statistics
        model_fit = {
            "n_observations": safe_int(results.nobs),
            "df_model": safe_int(results.df_model),
            "df_residuals": safe_int(results.df_resid)
        }
        
        if req.model_type == "ols":
            model_fit.update({
                "r_squared": round(safe_float(results.rsquared), 4),
                "r_squared_adj": round(safe_float(results.rsquared_adj), 4),
                "f_statistic": round(safe_float(results.fvalue), 4),
                "f_p_value": round(safe_float(results.f_pvalue), 4),
                "aic": round(safe_float(results.aic), 2),
                "bic": round(safe_float(results.bic), 2)
            })
        else:
            model_fit.update({
                "pseudo_r_squared": round(safe_float(results.prsquared), 4),
                "log_likelihood": round(safe_float(results.llf), 2),
                "aic": round(safe_float(results.aic), 2),
                "bic": round(safe_float(results.bic), 2)
            })
        
        # Model diagnostics for OLS
        diagnostics = None
        if req.include_diagnostics and req.model_type == "ols":
            try:
                residuals = results.resid
                jb_stat, jb_pvalue = scipy_stats.jarque_bera(residuals)[:2]
                diagnostics = {
                    "residual_mean": round(safe_float(np.mean(residuals)), 6),
                    "residual_std": round(safe_float(np.std(residuals)), 4),
                    "durbin_watson": round(safe_float(sm.stats.stattools.durbin_watson(residuals)), 4),
                    "jarque_bera": {
                        "statistic": round(safe_float(jb_stat), 4),
                        "p_value": round(safe_float(jb_pvalue), 4),
                        "normal": bool(jb_pvalue > 0.05)
                    },
                    "condition_number": round(safe_float(np.linalg.cond(X)), 2)
                }
            except Exception:
                diagnostics = None
        
        response = {
            "model_type": req.model_type,
            "dependent_variable": req.dependent_var,
            "independent_variables": req.independent_vars,
            "robust_standard_errors": req.robust_se,
            "model_fit": model_fit,
            "coefficients": coefficients
        }
        
        if interaction_info:
            response["interactions"] = interaction_info
        
        if diagnostics:
            response["diagnostics"] = diagnostics
        
        # Interpretation
        if req.model_type == "ols":
            sig_predictors = [k for k, v in coefficients.items() if v["significant"] and k != "Intercept"]
            response["interpretation"] = f"The model explains {model_fit['r_squared']*100:.1f}% of variance (R² = {model_fit['r_squared']:.3f}). {len(sig_predictors)} predictor(s) are significant: {', '.join(sig_predictors) if sig_predictors else 'none'}."
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model estimation failed: {str(e)}")
