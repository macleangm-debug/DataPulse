"""
DataPulse - Database Optimization Utilities
Query optimization, indexing, and performance monitoring
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import logging
import time

logger = logging.getLogger(__name__)


# ============================================================================
# OPTIMIZED QUERY HELPERS
# ============================================================================

class OptimizedQuery:
    """
    Helper class for building optimized MongoDB queries.
    Applies best practices:
    - Projection to limit returned fields
    - Proper pagination with skip/limit
    - Index hints when appropriate
    - Query result caching
    """
    
    DEFAULT_LIMIT = 100
    MAX_LIMIT = 1000
    
    @staticmethod
    async def find_paginated(
        collection,
        query: dict,
        projection: dict = None,
        page: int = 1,
        limit: int = None,
        sort: List[tuple] = None,
        cache_ttl: int = None
    ) -> Dict[str, Any]:
        """
        Execute paginated query with optimization.
        
        Args:
            collection: MongoDB collection
            query: Query filter
            projection: Fields to return (default: all except _id)
            page: Page number (1-indexed)
            limit: Results per page
            sort: Sort order [(field, direction), ...]
            cache_ttl: Cache TTL in seconds (None = no cache)
        
        Returns:
            Dict with items, total, page, limit, pages
        """
        # Apply limits
        limit = min(limit or OptimizedQuery.DEFAULT_LIMIT, OptimizedQuery.MAX_LIMIT)
        skip = (page - 1) * limit
        
        # Default projection excludes _id
        if projection is None:
            projection = {"_id": 0}
        elif "_id" not in projection:
            projection["_id"] = 0
        
        # Check cache if enabled
        if cache_ttl:
            from utils.cache import QueryCache
            cached = await QueryCache.get_query(collection.name, query, projection)
            if cached:
                return cached
        
        # Execute count and query in parallel for better performance
        import asyncio
        
        count_task = collection.count_documents(query)
        
        cursor = collection.find(query, projection)
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.skip(skip).limit(limit)
        
        # Execute
        total, items = await asyncio.gather(
            count_task,
            cursor.to_list(length=limit)
        )
        
        result = {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if limit > 0 else 0
        }
        
        # Cache result if enabled
        if cache_ttl:
            await QueryCache.set_query(collection.name, query, result, projection, cache_ttl)
        
        return result
    
    @staticmethod
    async def find_one_optimized(
        collection,
        query: dict,
        projection: dict = None,
        cache_ttl: int = None
    ) -> Optional[Dict]:
        """
        Find single document with optimization.
        """
        if projection is None:
            projection = {"_id": 0}
        elif "_id" not in projection:
            projection["_id"] = 0
        
        # Check cache
        if cache_ttl:
            from utils.cache import QueryCache
            cached = await QueryCache.get_query(collection.name, query, projection)
            if cached:
                return cached
        
        result = await collection.find_one(query, projection)
        
        # Cache result
        if cache_ttl and result:
            await QueryCache.set_query(collection.name, query, result, projection, cache_ttl)
        
        return result
    
    @staticmethod
    async def aggregate_optimized(
        collection,
        pipeline: List[dict],
        cache_ttl: int = None
    ) -> List[Dict]:
        """
        Execute aggregation pipeline with optimization.
        """
        # Check cache
        if cache_ttl:
            from utils.cache import Cache
            import hashlib
            import json
            cache_key = f"agg:{collection.name}:{hashlib.md5(json.dumps(pipeline, default=str).encode()).hexdigest()}"
            cached = await Cache.get(cache_key)
            if cached:
                return cached
        
        cursor = collection.aggregate(pipeline)
        result = await cursor.to_list(length=None)
        
        # Cache result
        if cache_ttl:
            await Cache.set(cache_key, result, cache_ttl)
        
        return result


# ============================================================================
# INDEX MANAGEMENT
# ============================================================================

class IndexManager:
    """
    Manages database indexes for optimal query performance.
    """
    
    # Define all recommended indexes
    RECOMMENDED_INDEXES = {
        "submissions": [
            # Primary lookups
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("form_id", 1), ("submitted_at", -1)]},
            {"keys": [("org_id", 1), ("submitted_at", -1)]},
            {"keys": [("project_id", 1), ("status", 1)]},
            {"keys": [("submitted_by", 1), ("submitted_at", -1)]},
            # Quality queries
            {"keys": [("form_id", 1), ("quality_score", 1)]},
            {"keys": [("org_id", 1), ("status", 1), ("submitted_at", -1)]},
            # Batch operations
            {"keys": [("batch_id", 1)]},
            # Compound for common dashboard queries
            {"keys": [("org_id", 1), ("form_id", 1), ("status", 1), ("submitted_at", -1)]},
        ],
        "forms": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("org_id", 1), ("status", 1)]},
            {"keys": [("project_id", 1), ("status", 1)]},
        ],
        "users": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("email", 1)], "unique": True},
        ],
        "chat_sessions": [
            {"keys": [("session_id", 1)], "unique": True},
            {"keys": [("user_id", 1), ("created_at", -1)]},
            {"keys": [("updated_at", -1)]},
        ],
        "bulk_operation_logs": [
            {"keys": [("batch_id", 1)], "unique": True},
            {"keys": [("user_id", 1), ("created_at", -1)]},
        ],
        "organizations": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("slug", 1)], "unique": True},
        ],
        "org_members": [
            {"keys": [("org_id", 1), ("user_id", 1)], "unique": True},
            {"keys": [("user_id", 1)]},
        ],
        "projects": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("org_id", 1), ("status", 1)]},
        ],
        "cases": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("project_id", 1), ("respondent_id", 1)], "unique": True},
        ],
    }
    
    @staticmethod
    async def ensure_indexes(db, collections: List[str] = None):
        """
        Create all recommended indexes.
        
        Args:
            db: MongoDB database instance
            collections: List of collection names (None = all)
        """
        collections_to_index = collections or list(IndexManager.RECOMMENDED_INDEXES.keys())
        
        created = 0
        errors = 0
        
        for collection_name in collections_to_index:
            if collection_name not in IndexManager.RECOMMENDED_INDEXES:
                continue
            
            collection = db[collection_name]
            indexes = IndexManager.RECOMMENDED_INDEXES[collection_name]
            
            for index_config in indexes:
                try:
                    keys = index_config["keys"]
                    options = {k: v for k, v in index_config.items() if k != "keys"}
                    
                    await collection.create_index(keys, **options)
                    created += 1
                    
                except Exception as e:
                    # Index might already exist
                    if "already exists" not in str(e).lower():
                        logger.error(f"Failed to create index on {collection_name}: {e}")
                        errors += 1
        
        logger.info(f"Index creation complete: {created} created, {errors} errors")
        return {"created": created, "errors": errors}
    
    @staticmethod
    async def get_index_stats(db, collection_name: str) -> Dict:
        """Get index statistics for a collection"""
        collection = db[collection_name]
        
        # Get index info
        indexes = await collection.index_information()
        
        # Get index stats from server
        try:
            stats = await db.command("collStats", collection_name)
            index_sizes = stats.get("indexSizes", {})
        except Exception:
            index_sizes = {}
        
        return {
            "collection": collection_name,
            "indexes": list(indexes.keys()),
            "index_count": len(indexes),
            "index_sizes": index_sizes,
            "total_index_size": sum(index_sizes.values())
        }
    
    @staticmethod
    async def analyze_slow_queries(db, threshold_ms: int = 100) -> List[Dict]:
        """
        Analyze slow queries from MongoDB profiler.
        Requires profiling to be enabled.
        """
        try:
            cursor = db.system.profile.find(
                {"millis": {"$gt": threshold_ms}},
                {"_id": 0}
            ).sort("millis", -1).limit(20)
            
            return await cursor.to_list(length=20)
        except Exception as e:
            logger.error(f"Failed to analyze slow queries: {e}")
            return []


# ============================================================================
# PERFORMANCE MONITORING
# ============================================================================

class PerformanceMonitor:
    """
    Monitors and reports on database performance.
    """
    
    @staticmethod
    async def get_database_stats(db) -> Dict:
        """Get overall database statistics"""
        try:
            stats = await db.command("dbStats")
            
            return {
                "database": stats.get("db"),
                "collections": stats.get("collections"),
                "objects": stats.get("objects"),
                "data_size_mb": round(stats.get("dataSize", 0) / 1024 / 1024, 2),
                "storage_size_mb": round(stats.get("storageSize", 0) / 1024 / 1024, 2),
                "index_size_mb": round(stats.get("indexSize", 0) / 1024 / 1024, 2),
                "avg_obj_size_bytes": round(stats.get("avgObjSize", 0), 2)
            }
        except Exception as e:
            logger.error(f"Failed to get database stats: {e}")
            return {"error": str(e)}
    
    @staticmethod
    async def get_collection_stats(db, collection_name: str) -> Dict:
        """Get statistics for a specific collection"""
        try:
            stats = await db.command("collStats", collection_name)
            
            return {
                "collection": collection_name,
                "count": stats.get("count"),
                "size_mb": round(stats.get("size", 0) / 1024 / 1024, 2),
                "avg_obj_size_bytes": round(stats.get("avgObjSize", 0), 2),
                "storage_size_mb": round(stats.get("storageSize", 0) / 1024 / 1024, 2),
                "index_count": stats.get("nindexes"),
                "index_size_mb": round(stats.get("totalIndexSize", 0) / 1024 / 1024, 2)
            }
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {"error": str(e)}
    
    @staticmethod
    async def run_query_benchmark(db, collection_name: str, query: dict, iterations: int = 10) -> Dict:
        """
        Benchmark a query to measure performance.
        """
        collection = db[collection_name]
        times = []
        
        for _ in range(iterations):
            start = time.time()
            await collection.find_one(query, {"_id": 0})
            times.append((time.time() - start) * 1000)
        
        return {
            "collection": collection_name,
            "query": str(query),
            "iterations": iterations,
            "min_ms": round(min(times), 2),
            "max_ms": round(max(times), 2),
            "avg_ms": round(sum(times) / len(times), 2),
            "median_ms": round(sorted(times)[len(times) // 2], 2)
        }


# ============================================================================
# CONNECTION POOL MONITORING
# ============================================================================

class ConnectionPoolMonitor:
    """
    Monitor MongoDB connection pool health.
    """
    
    @staticmethod
    async def get_pool_stats(client) -> Dict:
        """Get connection pool statistics"""
        try:
            # Get server status
            admin_db = client.admin
            status = await admin_db.command("serverStatus")
            
            connections = status.get("connections", {})
            
            return {
                "current_connections": connections.get("current"),
                "available_connections": connections.get("available"),
                "total_created": connections.get("totalCreated"),
                "active_connections": connections.get("active", 0),
                "pool_size": client.options.pool_options.max_pool_size,
                "min_pool_size": client.options.pool_options.min_pool_size
            }
        except Exception as e:
            logger.error(f"Failed to get pool stats: {e}")
            return {"error": str(e)}
