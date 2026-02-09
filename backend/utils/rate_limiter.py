"""
DataPulse - Rate Limiting

API rate limiting to prevent abuse and ensure fair resource usage.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse

from config.scalability import (
    RATE_LIMIT_STATS,
    RATE_LIMIT_EXPORT,
    RATE_LIMIT_GENERAL
)


def get_user_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting.
    Uses user ID if authenticated, otherwise IP address.
    """
    # Try to get user from request state (set by auth middleware)
    if hasattr(request.state, 'user_id') and request.state.user_id:
        return f"user:{request.state.user_id}"
    
    # Try to get from authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use a hash of the token as identifier
        token_hash = hash(auth_header[7:])
        return f"token:{token_hash}"
    
    # Fall back to IP address
    return f"ip:{get_remote_address(request)}"


# Create limiter instance
limiter = Limiter(key_func=get_user_identifier)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded errors"""
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": str(exc.detail),
            "retry_after": getattr(exc, 'retry_after', 60)
        }
    )


# Decorator shortcuts for common rate limits
def limit_stats(func):
    """Apply statistics rate limit"""
    return limiter.limit(RATE_LIMIT_STATS)(func)


def limit_export(func):
    """Apply export rate limit"""
    return limiter.limit(RATE_LIMIT_EXPORT)(func)


def limit_general(func):
    """Apply general rate limit"""
    return limiter.limit(RATE_LIMIT_GENERAL)(func)
