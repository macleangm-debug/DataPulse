"""DataPulse - Redis Caching Service
High-performance caching for dashboard/analytics queries
"""
import redis
import json
import hashlib
from typing import Any, Optional, Callable
from functools import wraps
import os
import asyncio
from datetime import timedelta

# Redis Configuration
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CACHE_DEFAULT_TTL = int(os.environ.get("CACHE_DEFAULT_TTL", 300))  # 5 minutes

# Initialize Redis clients
_sync_redis = None
_async_redis = None


def get_redis_client():
    """Get synchronous Redis client (singleton)"""
    global _sync_redis
    if _sync_redis is None:
        try:
            _sync_redis = redis.from_url(REDIS_URL, decode_responses=True)
            _sync_redis.ping()
        except Exception as e:
            print(f"Redis connection failed: {e}")
            _sync_redis = None
    return _sync_redis


async def get_async_redis():
    """Get async Redis client (singleton)"""
    global _async_redis
    if _async_redis is None:
        try:
            import aioredis
            _async_redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
            await _async_redis.ping()
        except Exception as e:
            print(f"Async Redis connection failed: {e}")
            _async_redis = None
    return _async_redis


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a unique cache key from function arguments"""
    key_data = f"{prefix}:{json.dumps(args, sort_keys=True)}:{json.dumps(kwargs, sort_keys=True)}"
    return f"datapulse:{hashlib.md5(key_data.encode()).hexdigest()}"


class CacheService:
    """Redis caching service for DataPulse"""
    
    # Cache key prefixes
    PREFIX_DASHBOARD = "dashboard"
    PREFIX_ANALYTICS = "analytics"
    PREFIX_FORM = "form"
    PREFIX_SUBMISSION = "submission"
    PREFIX_QUALITY = "quality"
    PREFIX_STATS = "stats"
    
    # TTL configurations (in seconds)
    TTL_SHORT = 60  # 1 minute - for real-time data
    TTL_MEDIUM = 300  # 5 minutes - for dashboard data
    TTL_LONG = 3600  # 1 hour - for analytics/reports
    TTL_EXTRA_LONG = 86400  # 24 hours - for static data
    
    def __init__(self):
        self.client = get_redis_client()
        self._enabled = self.client is not None
    
    @property
    def enabled(self) -> bool:
        return self._enabled
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self._enabled:
            return None
        try:
            data = self.client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            print(f"Cache get error: {e}")
        return None
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache with TTL"""
        if not self._enabled:
            return False
        try:
            data = json.dumps(value, default=str)
            self.client.setex(key, ttl or CACHE_DEFAULT_TTL, data)
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
        return False
    
    def delete(self, key: str) -> bool:
        """Delete a key from cache"""
        if not self._enabled:
            return False
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
        return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not self._enabled:
            return 0
        try:
            keys = self.client.keys(f"datapulse:{pattern}*")
            if keys:
                return self.client.delete(*keys)
        except Exception as e:
            print(f"Cache delete pattern error: {e}")
        return 0
    
    def invalidate_dashboard(self, dashboard_id: str = None, org_id: str = None):
        """Invalidate dashboard cache"""
        if dashboard_id:
            self.delete_pattern(f"{self.PREFIX_DASHBOARD}:{dashboard_id}")
        if org_id:
            self.delete_pattern(f"{self.PREFIX_DASHBOARD}:org:{org_id}")
    
    def invalidate_form(self, form_id: str):
        """Invalidate form-related cache"""
        self.delete_pattern(f"{self.PREFIX_FORM}:{form_id}")
        self.delete_pattern(f"{self.PREFIX_SUBMISSION}:form:{form_id}")
        self.delete_pattern(f"{self.PREFIX_STATS}:form:{form_id}")
    
    def invalidate_submission(self, submission_id: str, form_id: str = None):
        """Invalidate submission cache"""
        self.delete_pattern(f"{self.PREFIX_SUBMISSION}:{submission_id}")
        if form_id:
            self.delete_pattern(f"{self.PREFIX_STATS}:form:{form_id}")
    
    # Convenience methods for specific data types
    
    def get_dashboard_data(self, dashboard_id: str) -> Optional[dict]:
        key = generate_cache_key(self.PREFIX_DASHBOARD, dashboard_id)
        return self.get(key)
    
    def set_dashboard_data(self, dashboard_id: str, data: dict, ttl: int = None):
        key = generate_cache_key(self.PREFIX_DASHBOARD, dashboard_id)
        return self.set(key, data, ttl or self.TTL_MEDIUM)
    
    def get_analytics(self, form_id: str, metric: str, filters: dict = None) -> Optional[dict]:
        key = generate_cache_key(self.PREFIX_ANALYTICS, form_id, metric, **(filters or {}))
        return self.get(key)
    
    def set_analytics(self, form_id: str, metric: str, data: dict, filters: dict = None, ttl: int = None):
        key = generate_cache_key(self.PREFIX_ANALYTICS, form_id, metric, **(filters or {}))
        return self.set(key, data, ttl or self.TTL_LONG)
    
    def get_form_stats(self, form_id: str) -> Optional[dict]:
        key = generate_cache_key(self.PREFIX_STATS, "form", form_id)
        return self.get(key)
    
    def set_form_stats(self, form_id: str, data: dict, ttl: int = None):
        key = generate_cache_key(self.PREFIX_STATS, "form", form_id)
        return self.set(key, data, ttl or self.TTL_MEDIUM)
    
    def get_quality_summary(self, form_id: str) -> Optional[dict]:
        key = generate_cache_key(self.PREFIX_QUALITY, form_id)
        return self.get(key)
    
    def set_quality_summary(self, form_id: str, data: dict, ttl: int = None):
        key = generate_cache_key(self.PREFIX_QUALITY, form_id)
        return self.set(key, data, ttl or self.TTL_MEDIUM)


# Async cache service
class AsyncCacheService:
    """Async Redis caching service"""
    
    def __init__(self):
        self._client = None
        self._enabled = False
    
    async def _get_client(self):
        if self._client is None:
            self._client = await get_async_redis()
            self._enabled = self._client is not None
        return self._client
    
    async def get(self, key: str) -> Optional[Any]:
        client = await self._get_client()
        if not client:
            return None
        try:
            data = await client.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            print(f"Async cache get error: {e}")
        return None
    
    async def set(self, key: str, value: Any, ttl: int = CACHE_DEFAULT_TTL) -> bool:
        client = await self._get_client()
        if not client:
            return False
        try:
            data = json.dumps(value, default=str)
            await client.setex(key, ttl, data)
            return True
        except Exception as e:
            print(f"Async cache set error: {e}")
        return False
    
    async def delete(self, key: str) -> bool:
        client = await self._get_client()
        if not client:
            return False
        try:
            await client.delete(key)
            return True
        except Exception as e:
            print(f"Async cache delete error: {e}")
        return False


# Decorator for caching function results
def cached(prefix: str, ttl: int = CACHE_DEFAULT_TTL):
    """Decorator to cache function results"""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = CacheService()
            if not cache.enabled:
                return func(*args, **kwargs)
            
            key = generate_cache_key(prefix, *args, **kwargs)
            cached_result = cache.get(key)
            
            if cached_result is not None:
                return cached_result
            
            result = func(*args, **kwargs)
            cache.set(key, result, ttl)
            return result
        return wrapper
    return decorator


def async_cached(prefix: str, ttl: int = CACHE_DEFAULT_TTL):
    """Decorator to cache async function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = AsyncCacheService()
            
            key = generate_cache_key(prefix, *args, **kwargs)
            cached_result = await cache.get(key)
            
            if cached_result is not None:
                return cached_result
            
            result = await func(*args, **kwargs)
            await cache.set(key, result, ttl)
            return result
        return wrapper
    return decorator


# Global cache instance
cache_service = CacheService()
