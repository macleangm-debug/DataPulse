"""DataPulse - Advanced Models Routes
Mixed Models, GLM, and Margins/Predicted Probabilities
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
import warnings

warnings.filterwarnings('ignore')

router = APIRouter(prefix="/models", tags=["Advanced Models"])


# ============ Models ============

class GLMRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    dependent_var: str
    independent_vars: List[str]
    family: str = "gaussian"  # gaussian, binomial, poisson, gamma, inverse_gaussian, negative_binomial
    link: Optional[str] = None  # identity, log, logit, probit, cloglog, inverse, sqrt
    offset_var: Optional[str] = None
    exposure_var: Optional[str] = None


class MixedModelRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    dependent_var: str
    fixed_effects: List[str]
    random_effects: List[str]  # Variables for random intercepts
    random_slopes: Optional[List[str]] = None  # Variables for random slopes
    group_var: str  # Grouping variable for random effects


class MarginsRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    dependent_var: str
    independent_vars: List[str]
    model_type: str = "ols"  # ols, logistic
    margins_var: str  # Variable to compute margins for
    at_values: Optional[Dict[str, Any]] = None  # Hold other vars at specific values


class PredictRequest(BaseModel):
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    org_id: str
    dependent_var: str
    independent_vars: List[str]
    model_type: str = "ols"
    new_data: Optional[List[Dict[str, Any]]] = None  # Data for prediction


# ============ Helper ============

async def get_model_data(db, snapshot_id: str = None, form_id: str = None):
    """Get data for modeling"""
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


# ============ GLM ============

@router.post("/glm")
async def run_glm(request: Request, req: GLMRequest):
    """Run Generalized Linear Model"""
    db = request.app.state.db
    
    df, schema = await get_model_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    # Check variables
    all_vars = [req.dependent_var] + req.independent_vars
    missing = [v for v in all_vars if v not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Variables not found: {missing}")
    
    # Prepare data
    df_clean = df[all_vars].copy()
    for var in all_vars:
        df_clean[var] = pd.to_numeric(df_clean[var], errors='coerce')
    df_clean = df_clean.dropna()
    
    if len(df_clean) < len(req.independent_vars) + 2:
        return {"error": "Insufficient observations"}
    
    try:
        import statsmodels.api as sm
        
        y = df_clean[req.dependent_var]
        X = df_clean[req.independent_vars]
        X = sm.add_constant(X)
        
        # Determine family
        family_map = {
            "gaussian": sm.families.Gaussian(),
            "binomial": sm.families.Binomial(),
            "poisson": sm.families.Poisson(),
            "gamma": sm.families.Gamma(),
            "inverse_gaussian": sm.families.InverseGaussian(),
            "negative_binomial": sm.families.NegativeBinomial()
        }
        
        family = family_map.get(req.family, sm.families.Gaussian())
        
        # Custom link if specified
        if req.link:
            link_map = {
                "identity": sm.families.links.Identity(),
                "log": sm.families.links.Log(),
                "logit": sm.families.links.Logit(),
                "probit": sm.families.links.Probit(),
                "cloglog": sm.families.links.CLogLog(),
                "inverse": sm.families.links.InversePower(),
                "sqrt": sm.families.links.Sqrt()
            }
            if req.link in link_map:
                family.link = link_map[req.link]
        
        # Handle offset/exposure
        offset = None
        if req.offset_var and req.offset_var in df_clean.columns:
            offset = df_clean[req.offset_var]
        elif req.exposure_var and req.exposure_var in df_clean.columns:
            offset = np.log(df_clean[req.exposure_var])
        
        # Fit model
        model = sm.GLM(y, X, family=family, offset=offset)
        results = model.fit()
        
        # Extract coefficients
        coefficients = {}
        for i, var in enumerate(X.columns):
            coefficients[var] = {
                "coefficient": round(float(results.params.iloc[i]), 4),
                "std_error": round(float(results.bse.iloc[i]), 4),
                "z_value": round(float(results.tvalues.iloc[i]), 3),
                "p_value": round(float(results.pvalues.iloc[i]), 4),
                "significant": bool(results.pvalues.iloc[i] < 0.05),
                "conf_int": {
                    "lower": round(float(results.conf_int().iloc[i, 0]), 4),
                    "upper": round(float(results.conf_int().iloc[i, 1]), 4)
                }
            }
        
        # Model fit
        model_fit = {
            "n": int(len(df_clean)),
            "df_model": int(results.df_model),
            "df_residual": int(results.df_resid),
            "deviance": round(float(results.deviance), 4),
            "pearson_chi2": round(float(results.pearson_chi2), 4),
            "llf": round(float(results.llf), 4),
            "aic": round(float(results.aic), 4),
            "bic": round(float(results.bic), 4)
        }
        
        # Add pseudo R² for non-Gaussian
        if req.family != "gaussian":
            null_model = sm.GLM(y, np.ones(len(y)), family=family).fit()
            pseudo_r2 = 1 - (results.llf / null_model.llf)
            model_fit["pseudo_r_squared"] = round(float(pseudo_r2), 4)
        
        return {
            "model_type": "GLM",
            "family": req.family,
            "link": str(family.link),
            "dependent_var": req.dependent_var,
            "coefficients": coefficients,
            "model_fit": model_fit
        }
        
    except Exception as e:
        return {"error": f"GLM failed: {str(e)}"}


# ============ Mixed Models ============

@router.post("/mixed")
async def run_mixed_model(request: Request, req: MixedModelRequest):
    """Run Linear Mixed Model (Random Effects Model)"""
    db = request.app.state.db
    
    df, schema = await get_model_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    # Check variables
    all_vars = [req.dependent_var, req.group_var] + req.fixed_effects + req.random_effects
    if req.random_slopes:
        all_vars.extend(req.random_slopes)
    
    missing = [v for v in all_vars if v not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Variables not found: {missing}")
    
    # Prepare data
    df_clean = df[list(set(all_vars))].dropna()
    
    # Convert numeric variables
    for var in [req.dependent_var] + req.fixed_effects:
        df_clean[var] = pd.to_numeric(df_clean[var], errors='coerce')
    
    df_clean = df_clean.dropna()
    
    if len(df_clean) < len(req.fixed_effects) + 5:
        return {"error": "Insufficient observations"}
    
    try:
        import statsmodels.api as sm
        import statsmodels.formula.api as smf
        
        # Build formula
        fixed_part = " + ".join(req.fixed_effects)
        formula = f"{req.dependent_var} ~ {fixed_part}"
        
        # Random effects specification
        # Simple random intercept model
        re_formula = f"1"
        if req.random_slopes:
            re_formula = " + ".join(["1"] + req.random_slopes)
        
        # Fit mixed model
        model = smf.mixedlm(
            formula,
            df_clean,
            groups=df_clean[req.group_var],
            re_formula=f"~{re_formula}"
        )
        results = model.fit(reml=True)
        
        # Fixed effects
        fixed_effects = {}
        for var in results.fe_params.index:
            idx = list(results.fe_params.index).index(var)
            fixed_effects[var] = {
                "coefficient": round(float(results.fe_params[var]), 4),
                "std_error": round(float(results.bse_fe[var]), 4),
                "z_value": round(float(results.tvalues[var]), 3),
                "p_value": round(float(results.pvalues[var]), 4),
                "significant": bool(results.pvalues[var] < 0.05)
            }
        
        # Random effects variance
        random_effects = {
            "group_var": req.group_var,
            "n_groups": int(df_clean[req.group_var].nunique()),
            "variance_components": {}
        }
        
        # Extract variance components
        for name, value in results.cov_re.items():
            if isinstance(value, (int, float)):
                random_effects["variance_components"][str(name)] = round(float(value), 4)
        
        # ICC (Intraclass Correlation Coefficient)
        try:
            group_var_component = float(results.cov_re.iloc[0, 0]) if hasattr(results.cov_re, 'iloc') else list(results.cov_re.values())[0]
            residual_var = float(results.scale)
            icc = group_var_component / (group_var_component + residual_var)
            random_effects["icc"] = round(icc, 4)
        except:
            random_effects["icc"] = None
        
        # Model fit
        model_fit = {
            "n": int(len(df_clean)),
            "n_groups": int(df_clean[req.group_var].nunique()),
            "llf": round(float(results.llf), 4),
            "aic": round(float(results.aic), 4),
            "bic": round(float(results.bic), 4),
            "converged": bool(results.converged)
        }
        
        return {
            "model_type": "Mixed Linear Model",
            "dependent_var": req.dependent_var,
            "fixed_effects": fixed_effects,
            "random_effects": random_effects,
            "model_fit": model_fit
        }
        
    except Exception as e:
        return {"error": f"Mixed model failed: {str(e)}"}


# ============ Margins ============

@router.post("/margins")
async def compute_margins(request: Request, req: MarginsRequest):
    """Compute marginal effects / predicted probabilities"""
    db = request.app.state.db
    
    df, schema = await get_model_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    all_vars = [req.dependent_var] + req.independent_vars
    missing = [v for v in all_vars if v not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Variables not found: {missing}")
    
    # Prepare data
    df_clean = df[all_vars].copy()
    for var in all_vars:
        df_clean[var] = pd.to_numeric(df_clean[var], errors='coerce')
    df_clean = df_clean.dropna()
    
    if len(df_clean) < 10:
        return {"error": "Insufficient observations"}
    
    try:
        import statsmodels.api as sm
        
        y = df_clean[req.dependent_var]
        X = df_clean[req.independent_vars]
        X = sm.add_constant(X)
        
        # Fit model
        if req.model_type == "logistic":
            model = sm.Logit(y, X)
            results = model.fit(disp=0)
        else:
            model = sm.OLS(y, X)
            results = model.fit()
        
        # Compute margins for specified variable
        margins_var = req.margins_var
        if margins_var not in req.independent_vars:
            return {"error": f"Margins variable {margins_var} not in model"}
        
        # Get unique values for margins variable
        unique_vals = sorted(df_clean[margins_var].unique())
        
        # Compute predicted values at each level
        margins_results = []
        
        for val in unique_vals[:20]:  # Limit to 20 values
            # Create prediction data
            pred_data = X.mean().to_frame().T
            pred_data[margins_var] = val
            
            # Get prediction
            if req.model_type == "logistic":
                pred = results.predict(pred_data)[0]
                # Get confidence interval via delta method approximation
                se = np.sqrt(np.diag(pred_data @ results.cov_params() @ pred_data.T))[0]
                se_prob = pred * (1 - pred) * se  # Delta method for probability
            else:
                pred = results.predict(pred_data)[0]
                se_prob = np.sqrt((pred_data @ results.cov_params() @ pred_data.T).values[0, 0])
            
            margins_results.append({
                "value": float(val) if isinstance(val, (int, float, np.number)) else str(val),
                "prediction": round(float(pred), 4),
                "std_error": round(float(se_prob), 4),
                "conf_int": {
                    "lower": round(float(pred - 1.96 * se_prob), 4),
                    "upper": round(float(pred + 1.96 * se_prob), 4)
                }
            })
        
        # Average marginal effect
        if req.model_type == "logistic":
            # For logistic, compute average marginal effect
            coef = results.params[margins_var]
            pred_probs = results.predict(X)
            avg_me = float((coef * pred_probs * (1 - pred_probs)).mean())
        else:
            avg_me = float(results.params[margins_var])
        
        return {
            "model_type": req.model_type,
            "margins_variable": margins_var,
            "margins": margins_results,
            "average_marginal_effect": round(avg_me, 4),
            "n": int(len(df_clean))
        }
        
    except Exception as e:
        return {"error": f"Margins computation failed: {str(e)}"}


# ============ Predictions ============

@router.post("/predict")
async def get_predictions(request: Request, req: PredictRequest):
    """Get predicted values from fitted model"""
    db = request.app.state.db
    
    df, schema = await get_model_data(db, req.snapshot_id, req.form_id)
    
    if df.empty:
        return {"error": "No data available"}
    
    all_vars = [req.dependent_var] + req.independent_vars
    missing = [v for v in all_vars if v not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Variables not found: {missing}")
    
    # Prepare training data
    df_clean = df[all_vars].copy()
    for var in all_vars:
        df_clean[var] = pd.to_numeric(df_clean[var], errors='coerce')
    df_clean = df_clean.dropna()
    
    try:
        import statsmodels.api as sm
        
        y = df_clean[req.dependent_var]
        X = df_clean[req.independent_vars]
        X = sm.add_constant(X)
        
        # Fit model
        if req.model_type == "logistic":
            model = sm.Logit(y, X)
            results = model.fit(disp=0)
        else:
            model = sm.OLS(y, X)
            results = model.fit()
        
        predictions = []
        
        if req.new_data:
            # Predict for new data
            for row in req.new_data[:100]:  # Limit predictions
                pred_data = pd.DataFrame([row])
                for var in req.independent_vars:
                    if var in pred_data.columns:
                        pred_data[var] = pd.to_numeric(pred_data[var], errors='coerce')
                pred_data = sm.add_constant(pred_data, has_constant='add')
                
                # Ensure columns match
                for col in X.columns:
                    if col not in pred_data.columns:
                        pred_data[col] = 0
                pred_data = pred_data[X.columns]
                
                pred = results.predict(pred_data)[0]
                predictions.append({
                    "input": row,
                    "prediction": round(float(pred), 4)
                })
        else:
            # Return fitted values
            fitted = results.fittedvalues
            residuals = results.resid
            
            for i in range(min(50, len(fitted))):
                predictions.append({
                    "index": i,
                    "actual": round(float(y.iloc[i]), 4),
                    "predicted": round(float(fitted.iloc[i]), 4),
                    "residual": round(float(residuals.iloc[i]), 4)
                })
        
        return {
            "model_type": req.model_type,
            "predictions": predictions,
            "model_r_squared": round(float(results.rsquared), 4) if req.model_type == "ols" else None
        }
        
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}
