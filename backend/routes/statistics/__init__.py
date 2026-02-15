"""Statistics Routes Package

This package contains modular statistics endpoints organized by analysis type:
- descriptive: Descriptive statistics
- comparison: T-tests, ANOVA, ANCOVA
- correlation: Pearson, Spearman, partial correlations
- regression: OLS, Logistic, Poisson, GLM
- nonparametric: Mann-Whitney, Kruskal-Wallis, Wilcoxon
- clustering: K-Means, Hierarchical
- factor: EFA, Reliability analysis
- proportions: Chi-square, Proportions tests
"""

from fastapi import APIRouter

from .descriptive import router as descriptive_router
from .comparison import router as comparison_router
from .correlation import router as correlation_router
from .regression import router as regression_router
from .nonparametric import router as nonparametric_router
from .clustering import router as clustering_router
from .factor import router as factor_router
from .proportions import router as proportions_router

# Create main router that includes all sub-routers
router = APIRouter()

# Include all sub-routers
router.include_router(descriptive_router)
router.include_router(comparison_router)
router.include_router(correlation_router)
router.include_router(regression_router)
router.include_router(nonparametric_router)
router.include_router(clustering_router)
router.include_router(factor_router)
router.include_router(proportions_router)

__all__ = [
    "router",
    "descriptive_router",
    "comparison_router", 
    "correlation_router",
    "regression_router",
    "nonparametric_router",
    "clustering_router",
    "factor_router",
    "proportions_router"
]
