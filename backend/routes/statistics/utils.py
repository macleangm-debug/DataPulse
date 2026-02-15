"""Shared utilities for statistics routes"""
from typing import Optional, List, Tuple
from pydantic import BaseModel
import pandas as pd
import numpy as np

# Import scalable data loader
from utils.data_loader import (
    load_analysis_data,
    DataLoadResult,
    sample_dataframe,
    SAMPLING_THRESHOLD,
    DEFAULT_SAMPLE_SIZE
)


class BaseStatsRequest(BaseModel):
    """Base request model for statistics endpoints"""
    snapshot_id: Optional[str] = None
    form_id: Optional[str] = None
    org_id: str
    sample: Optional[bool] = True  # Auto-sample large datasets
    sample_size: Optional[int] = DEFAULT_SAMPLE_SIZE


async def get_analysis_data(
    db,
    snapshot_id: str = None,
    form_id: str = None,
    sample: bool = True,
    sample_size: int = DEFAULT_SAMPLE_SIZE
) -> Tuple[pd.DataFrame, list, dict]:
    """
    Load data from snapshot or form submissions with automatic sampling.
    
    Returns:
        Tuple of (DataFrame, schema, metadata)
        metadata includes: is_sampled, total_count, sample_size
    """
    result = await load_analysis_data(
        db,
        snapshot_id=snapshot_id,
        form_id=form_id,
        sample=sample,
        sample_size=sample_size
    )
    
    metadata = {
        "is_sampled": result.is_sampled,
        "total_count": result.total_count,
        "loaded_count": len(result.data),
        "sample_size": result.sample_size
    }
    
    return result.data, result.schema, metadata


def calculate_effect_size(stat_type: str, **kwargs) -> dict:
    """Calculate effect size based on test type"""
    if stat_type == "ttest":
        t = kwargs.get("t_stat")
        n1, n2 = kwargs.get("n1", 30), kwargs.get("n2", 30)
        d = t * np.sqrt(1/n1 + 1/n2)
        return {
            "cohens_d": round(float(d), 3),
            "interpretation": interpret_cohens_d(d)
        }
    elif stat_type == "anova":
        ss_between = kwargs.get("ss_between", 0)
        ss_total = kwargs.get("ss_total", 1)
        eta_sq = ss_between / ss_total if ss_total > 0 else 0
        return {
            "eta_squared": round(float(eta_sq), 4),
            "interpretation": interpret_eta_squared(eta_sq)
        }
    return {}


def interpret_cohens_d(d: float) -> str:
    """Interpret Cohen's d effect size"""
    d = abs(d)
    if d < 0.2:
        return "negligible effect"
    elif d < 0.5:
        return "small effect"
    elif d < 0.8:
        return "medium effect"
    else:
        return "large effect"


def interpret_eta_squared(eta: float) -> str:
    """Interpret eta-squared effect size"""
    if eta < 0.01:
        return "negligible effect"
    elif eta < 0.06:
        return "small effect"
    elif eta < 0.14:
        return "medium effect"
    else:
        return "large effect"


def safe_float(val) -> float:
    """Safely convert value to float, handling numpy types"""
    if isinstance(val, (np.floating, np.integer)):
        return float(val)
    if isinstance(val, (np.bool_, bool)):
        return float(val)
    return float(val) if val is not None else 0.0


def safe_int(val) -> int:
    """Safely convert value to int"""
    if isinstance(val, (np.floating, np.integer)):
        return int(val)
    return int(val) if val is not None else 0


def format_p_value(p: float) -> str:
    """Format p-value for display"""
    if p < 0.001:
        return "< .001"
    elif p < 0.01:
        return f"= {p:.3f}"
    else:
        return f"= {p:.2f}"
