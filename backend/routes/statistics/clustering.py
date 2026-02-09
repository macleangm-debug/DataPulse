"""Clustering Analysis Routes"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
from scipy import stats as scipy_stats
from scipy.cluster.hierarchy import linkage, fcluster, dendrogram
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

from .utils import BaseStatsRequest, get_analysis_data, safe_float, safe_int
from utils.rate_limiter import limiter
from config.scalability import RATE_LIMIT_STATS

router = APIRouter(prefix="/statistics", tags=["statistics"])


class ClusteringRequest(BaseStatsRequest):
    variables: List[str]
    n_clusters: int = 3
    method: str = "kmeans"  # kmeans, hierarchical
    linkage_method: str = "ward"  # for hierarchical


@router.post("/clustering")
@limiter.limit(RATE_LIMIT_STATS)
async def run_clustering(request: Request, req: ClusteringRequest):
    """Run clustering analysis (K-Means or Hierarchical)"""
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
    
    if len(data) < req.n_clusters * 3:
        raise HTTPException(status_code=400, detail="Insufficient data for clustering")
    
    # Standardize data
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(data)
    
    result = {
        "method": req.method,
        "variables": valid_vars,
        "n_observations": len(data),
        "n_clusters": req.n_clusters
    }
    
    if req.method == "kmeans":
        # K-Means clustering
        kmeans = KMeans(n_clusters=req.n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)
        
        # Calculate metrics
        silhouette = silhouette_score(X_scaled, labels) if req.n_clusters > 1 else 0
        inertia = kmeans.inertia_
        
        # Cluster centers (in original scale)
        centers = scaler.inverse_transform(kmeans.cluster_centers_)
        
        cluster_info = {}
        for i in range(req.n_clusters):
            mask = labels == i
            cluster_data = data[mask]
            cluster_info[f"Cluster {i+1}"] = {
                "n": safe_int(mask.sum()),
                "percentage": round(safe_float(mask.sum() / len(data) * 100), 1),
                "centroid": {var: round(safe_float(centers[i, j]), 3) for j, var in enumerate(valid_vars)},
                "means": {var: round(safe_float(cluster_data[var].mean()), 3) for var in valid_vars},
                "stds": {var: round(safe_float(cluster_data[var].std()), 3) for var in valid_vars}
            }
        
        result.update({
            "silhouette_score": round(safe_float(silhouette), 4),
            "inertia": round(safe_float(inertia), 2),
            "clusters": cluster_info,
            "interpretation": f"K-Means clustering identified {req.n_clusters} clusters. Silhouette score: {silhouette:.3f} ({'good' if silhouette > 0.5 else 'moderate' if silhouette > 0.25 else 'poor'} separation)."
        })
        
    elif req.method == "hierarchical":
        # Hierarchical clustering
        Z = linkage(X_scaled, method=req.linkage_method)
        labels = fcluster(Z, t=req.n_clusters, criterion='maxclust') - 1
        
        silhouette = silhouette_score(X_scaled, labels) if req.n_clusters > 1 else 0
        
        cluster_info = {}
        for i in range(req.n_clusters):
            mask = labels == i
            cluster_data = data[mask]
            cluster_info[f"Cluster {i+1}"] = {
                "n": safe_int(mask.sum()),
                "percentage": round(safe_float(mask.sum() / len(data) * 100), 1),
                "means": {var: round(safe_float(cluster_data[var].mean()), 3) for var in valid_vars},
                "stds": {var: round(safe_float(cluster_data[var].std()), 3) for var in valid_vars}
            }
        
        # Dendrogram data (simplified)
        result.update({
            "linkage_method": req.linkage_method,
            "silhouette_score": round(safe_float(silhouette), 4),
            "clusters": cluster_info,
            "dendrogram": {
                "linkage_matrix": Z[:10].tolist() if len(Z) > 10 else Z.tolist()
            },
            "interpretation": f"Hierarchical clustering ({req.linkage_method}) identified {req.n_clusters} clusters. Silhouette score: {silhouette:.3f}."
        })
    
    return result
