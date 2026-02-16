"""
DataPulse - Performance Monitoring Routes
Endpoints for monitoring and optimizing system performance
"""
from fastapi import APIRouter, Request, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone

from auth import get_current_user
from utils.cache import Cache, SessionCache, QueryCache, get_redis_client
from utils.db_optimization import (
    IndexManager, 
    PerformanceMonitor, 
    ConnectionPoolMonitor,
    OptimizedQuery
)

router = APIRouter(prefix="/performance", tags=["Performance"])


@router.get("/health")
async def get_performance_health(request: Request):
    """
    Get overall system health including all performance metrics.
    No authentication required for basic health check.
    """
    db = request.app.state.db
    
    # Check MongoDB
    try:
        await db.command("ping")
        mongo_status = "healthy"
    except Exception as e:
        mongo_status = f"unhealthy: {e}"
    
    # Check Redis
    redis = get_redis_client()
    redis_status = "healthy" if redis else "unavailable"
    
    # Get cache stats
    cache_stats = await Cache.get_stats()
    
    return {
        "status": "healthy" if mongo_status == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "mongodb": mongo_status,
            "redis": redis_status
        },
        "cache": cache_stats
    }


@router.get("/database/stats")
async def get_database_stats(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get database statistics (admin only)"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    return await PerformanceMonitor.get_database_stats(db)


@router.get("/database/collections/{collection_name}")
async def get_collection_stats(
    collection_name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get statistics for a specific collection"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    return await PerformanceMonitor.get_collection_stats(db, collection_name)


@router.get("/database/indexes/{collection_name}")
async def get_index_stats(
    collection_name: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get index statistics for a collection"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    return await IndexManager.get_index_stats(db, collection_name)


@router.post("/database/indexes/ensure")
async def ensure_indexes(
    request: Request,
    collections: Optional[list] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create/update all recommended indexes"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    result = await IndexManager.ensure_indexes(db, collections)
    return {
        "message": "Index creation complete",
        **result
    }


@router.get("/database/slow-queries")
async def get_slow_queries(
    request: Request,
    threshold_ms: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get slow queries from profiler"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    return {
        "threshold_ms": threshold_ms,
        "slow_queries": await IndexManager.analyze_slow_queries(db, threshold_ms)
    }


@router.get("/connections")
async def get_connection_stats(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get connection pool statistics"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the client from the app
    from server import client
    return await ConnectionPoolMonitor.get_pool_stats(client)


@router.get("/cache/stats")
async def get_cache_stats(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get cache statistics"""
    return await Cache.get_stats()


@router.post("/cache/clear")
async def clear_cache(
    request: Request,
    pattern: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Clear cache (optionally by pattern)"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if pattern:
        count = await Cache.delete_pattern(pattern)
        return {"message": f"Cleared {count} cache entries matching pattern"}
    else:
        await Cache.clear_all()
        return {"message": "All cache cleared"}


@router.post("/benchmark/query")
async def benchmark_query(
    request: Request,
    collection: str,
    query: dict,
    iterations: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Benchmark a specific query"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    return await PerformanceMonitor.run_query_benchmark(
        db, collection, query, min(iterations, 100)
    )


@router.get("/metrics")
async def get_all_metrics(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get all performance metrics in one call"""
    if not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = request.app.state.db
    from server import client
    
    # Gather all metrics
    import asyncio
    
    db_stats, cache_stats, pool_stats = await asyncio.gather(
        PerformanceMonitor.get_database_stats(db),
        Cache.get_stats(),
        ConnectionPoolMonitor.get_pool_stats(client),
        return_exceptions=True
    )
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_stats if not isinstance(db_stats, Exception) else {"error": str(db_stats)},
        "cache": cache_stats if not isinstance(cache_stats, Exception) else {"error": str(cache_stats)},
        "connections": pool_stats if not isinstance(pool_stats, Exception) else {"error": str(pool_stats)}
    }
