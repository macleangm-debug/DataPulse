"""
DataPulse - Redis Cache Utility
High-performance caching layer for improved response times
"""
import os
import json
import hashlib
from typing import Any, Optional, Union
from datetime import timedelta
from functools import wraps
import logging

logger = logging.getLogger(__name__)

# Redis connection
_redis_client = None
_redis_available = False


def get_redis_client():
    """Get or create Redis client with connection pooling"""
    global _redis_client, _redis_available
    
    if _redis_client is not None:
        return _redis_client if _redis_available else None
    
    try:
        import redis
        redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
        
        _redis_client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
            max_connections=50
        )
        
        # Test connection
        _redis_client.ping()
        _redis_available = True
        logger.info("Redis cache connected successfully")
        return _redis_client
        
    except Exception as e:
        logger.warning(f"Redis not available, caching disabled: {e}")
        _redis_available = False
        return None


class Cache:
    """Cache utility class with fallback to in-memory when Redis unavailable"""
    
    # In-memory fallback cache (limited size)
    _memory_cache = {}
    _memory_cache_max_size = 1000
    
    @staticmethod
    def _generate_key(prefix: str, *args, **kwargs) -> str:
        """Generate a unique cache key"""
        key_data = f"{prefix}:{args}:{sorted(kwargs.items())}"
        return f"dp:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    @staticmethod
    async def get(key: str) -> Optional[Any]:
        """Get value from cache"""
        redis = get_redis_client()
        
        if redis:
            try:
                value = redis.get(key)
                if value:
                    return json.loads(value)
            except Exception as e:
                logger.error(f"Cache get error: {e}")
        
        # Fallback to memory cache
        return Cache._memory_cache.get(key)
    
    @staticmethod
    async def set(key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL (seconds)"""
        redis = get_redis_client()
        
        try:
            serialized = json.dumps(value, default=str)
            
            if redis:
                redis.setex(key, ttl, serialized)
                return True
            
            # Fallback to memory cache with size limit
            if len(Cache._memory_cache) >= Cache._memory_cache_max_size:
                # Remove oldest entries (simple FIFO)
                keys_to_remove = list(Cache._memory_cache.keys())[:100]
                for k in keys_to_remove:
                    del Cache._memory_cache[k]
            
            Cache._memory_cache[key] = json.loads(serialized)
            return True
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    @staticmethod
    async def delete(key: str) -> bool:
        """Delete value from cache"""
        redis = get_redis_client()
        
        try:
            if redis:
                redis.delete(key)
            
            if key in Cache._memory_cache:
                del Cache._memory_cache[key]
            
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    @staticmethod
    async def delete_pattern(pattern: str) -> int:
        """Delete all keys matching pattern"""
        redis = get_redis_client()
        count = 0
        
        try:
            if redis:
                cursor = 0
                while True:
                    cursor, keys = redis.scan(cursor, match=pattern, count=100)
                    if keys:
                        redis.delete(*keys)
                        count += len(keys)
                    if cursor == 0:
                        break
            
            # Clear matching keys from memory cache
            keys_to_remove = [k for k in Cache._memory_cache.keys() if k.startswith(pattern.replace('*', ''))]
            for k in keys_to_remove:
                del Cache._memory_cache[k]
                count += 1
            
            return count
        except Exception as e:
            logger.error(f"Cache delete pattern error: {e}")
            return count
    
    @staticmethod
    async def clear_all() -> bool:
        """Clear all cache"""
        redis = get_redis_client()
        
        try:
            if redis:
                redis.flushdb()
            Cache._memory_cache.clear()
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
            return False
    
    @staticmethod
    async def get_stats() -> dict:
        """Get cache statistics"""
        redis = get_redis_client()
        
        stats = {
            "redis_available": _redis_available,
            "memory_cache_size": len(Cache._memory_cache),
            "memory_cache_max_size": Cache._memory_cache_max_size
        }
        
        if redis:
            try:
                info = redis.info("stats")
                stats.update({
                    "redis_hits": info.get("keyspace_hits", 0),
                    "redis_misses": info.get("keyspace_misses", 0),
                    "redis_keys": redis.dbsize()
                })
            except Exception:
                pass
        
        return stats


def cached(ttl: int = 300, prefix: str = "cache"):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = Cache._generate_key(prefix, func.__name__, *args[1:], **kwargs)
            
            # Try to get from cache
            cached_value = await Cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            await Cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# Session cache helpers
class SessionCache:
    """Specialized cache for user sessions"""
    
    PREFIX = "session"
    DEFAULT_TTL = 3600  # 1 hour
    
    @staticmethod
    async def get_session(session_id: str) -> Optional[dict]:
        """Get user session data"""
        return await Cache.get(f"{SessionCache.PREFIX}:{session_id}")
    
    @staticmethod
    async def set_session(session_id: str, data: dict, ttl: int = None) -> bool:
        """Store user session data"""
        return await Cache.set(
            f"{SessionCache.PREFIX}:{session_id}",
            data,
            ttl or SessionCache.DEFAULT_TTL
        )
    
    @staticmethod
    async def delete_session(session_id: str) -> bool:
        """Delete user session"""
        return await Cache.delete(f"{SessionCache.PREFIX}:{session_id}")
    
    @staticmethod
    async def extend_session(session_id: str, ttl: int = None) -> bool:
        """Extend session TTL"""
        data = await SessionCache.get_session(session_id)
        if data:
            return await SessionCache.set_session(session_id, data, ttl)
        return False


# Query result cache helpers
class QueryCache:
    """Specialized cache for database query results"""
    
    PREFIX = "query"
    DEFAULT_TTL = 60  # 1 minute for query results
    
    @staticmethod
    def generate_key(collection: str, query: dict, projection: dict = None) -> str:
        """Generate cache key for a query"""
        query_str = json.dumps(query, sort_keys=True, default=str)
        proj_str = json.dumps(projection, sort_keys=True, default=str) if projection else ""
        return f"{QueryCache.PREFIX}:{collection}:{hashlib.md5((query_str + proj_str).encode()).hexdigest()}"
    
    @staticmethod
    async def get_query(collection: str, query: dict, projection: dict = None) -> Optional[Any]:
        """Get cached query result"""
        key = QueryCache.generate_key(collection, query, projection)
        return await Cache.get(key)
    
    @staticmethod
    async def set_query(collection: str, query: dict, result: Any, projection: dict = None, ttl: int = None) -> bool:
        """Cache query result"""
        key = QueryCache.generate_key(collection, query, projection)
        return await Cache.set(key, result, ttl or QueryCache.DEFAULT_TTL)
    
    @staticmethod
    async def invalidate_collection(collection: str) -> int:
        """Invalidate all cached queries for a collection"""
        return await Cache.delete_pattern(f"dp:*{QueryCache.PREFIX}:{collection}:*")
