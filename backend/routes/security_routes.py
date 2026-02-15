"""API Rate Limiting and Security Middleware"""
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import hashlib
import secrets
import logging

router = APIRouter(prefix="/security", tags=["Security"])
logger = logging.getLogger(__name__)

# Rate limiter configuration
limiter = Limiter(key_func=get_remote_address)

# Rate limit tiers (requests per minute)
RATE_LIMITS = {
    "free": "100/minute",
    "pro": "1000/minute", 
    "enterprise": "10000/minute",
    "unlimited": None
}

# In-memory storage for demo (use Redis in production)
api_keys_cache = {}
ip_whitelist_cache = {}
audit_logs = []


def get_rate_limit_key(request: Request) -> str:
    """Get rate limit key based on API key or IP"""
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"api_key:{api_key}"
    return f"ip:{get_remote_address(request)}"


async def check_rate_limit(request: Request, org_id: str = None):
    """Check if request is within rate limits"""
    db = request.app.state.db
    
    api_key = request.headers.get("X-API-Key")
    client_ip = get_remote_address(request)
    
    if api_key:
        # Check API key rate limit
        key_doc = await db.api_keys.find_one({"key_hash": hashlib.sha256(api_key.encode()).hexdigest()})
        if key_doc:
            tier = key_doc.get("tier", "free")
            # Check if key is active
            if not key_doc.get("is_active", True):
                raise HTTPException(status_code=403, detail="API key is disabled")
            # Check IP whitelist if configured
            if key_doc.get("ip_whitelist"):
                if client_ip not in key_doc["ip_whitelist"]:
                    raise HTTPException(status_code=403, detail="IP not whitelisted for this API key")
            return tier
    
    return "free"


async def log_api_request(request: Request, response_status: int, org_id: str = None):
    """Log API request for audit trail"""
    db = request.app.state.db
    
    log_entry = {
        "timestamp": datetime.now(timezone.utc),
        "method": request.method,
        "path": str(request.url.path),
        "query_params": dict(request.query_params),
        "client_ip": get_remote_address(request),
        "user_agent": request.headers.get("user-agent", ""),
        "api_key": request.headers.get("X-API-Key", "")[:8] + "..." if request.headers.get("X-API-Key") else None,
        "org_id": org_id,
        "response_status": response_status,
    }
    
    await db.api_audit_logs.insert_one(log_entry)


# API Key Management Endpoints
@router.post("/api-keys/{org_id}")
async def create_api_key(
    org_id: str,
    request: Request,
    name: str = "Default Key",
    tier: str = "free",
    scopes: List[str] = None,
    ip_whitelist: List[str] = None,
    expires_days: int = None
):
    """Create a new API key for an organization"""
    db = request.app.state.db
    
    # Generate secure API key
    raw_key = secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:8]
    
    expires_at = None
    if expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
    
    key_doc = {
        "id": secrets.token_urlsafe(16),
        "org_id": org_id,
        "name": name,
        "key_prefix": key_prefix,
        "key_hash": key_hash,
        "tier": tier,
        "scopes": scopes or ["read", "write"],
        "ip_whitelist": ip_whitelist or [],
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "last_used_at": None,
        "usage_count": 0,
    }
    
    await db.api_keys.insert_one(key_doc)
    
    # Return the raw key only once (it cannot be retrieved later)
    return {
        "id": key_doc["id"],
        "name": name,
        "key": raw_key,  # Only returned on creation
        "key_prefix": key_prefix,
        "tier": tier,
        "scopes": key_doc["scopes"],
        "expires_at": expires_at.isoformat() if expires_at else None,
        "message": "Save this key securely - it cannot be retrieved again"
    }


@router.get("/api-keys/{org_id}")
async def list_api_keys(org_id: str, request: Request):
    """List all API keys for an organization"""
    db = request.app.state.db
    
    keys = await db.api_keys.find(
        {"org_id": org_id},
        {"key_hash": 0}  # Never return the hash
    ).to_list(100)
    
    for key in keys:
        key["_id"] = str(key.get("_id", ""))
        if key.get("created_at"):
            key["created_at"] = key["created_at"].isoformat()
        if key.get("expires_at"):
            key["expires_at"] = key["expires_at"].isoformat()
        if key.get("last_used_at"):
            key["last_used_at"] = key["last_used_at"].isoformat()
    
    return {"keys": keys}


@router.put("/api-keys/{org_id}/{key_id}")
async def update_api_key(
    org_id: str,
    key_id: str,
    request: Request,
    name: str = None,
    scopes: List[str] = None,
    ip_whitelist: List[str] = None,
    is_active: bool = None
):
    """Update an API key's settings"""
    db = request.app.state.db
    
    update_fields = {}
    if name is not None:
        update_fields["name"] = name
    if scopes is not None:
        update_fields["scopes"] = scopes
    if ip_whitelist is not None:
        update_fields["ip_whitelist"] = ip_whitelist
    if is_active is not None:
        update_fields["is_active"] = is_active
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        await db.api_keys.update_one(
            {"id": key_id, "org_id": org_id},
            {"$set": update_fields}
        )
    
    return {"message": "API key updated", "updated_fields": list(update_fields.keys())}


@router.delete("/api-keys/{org_id}/{key_id}")
async def delete_api_key(org_id: str, key_id: str, request: Request):
    """Revoke/delete an API key"""
    db = request.app.state.db
    
    result = await db.api_keys.delete_one({"id": key_id, "org_id": org_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"message": "API key revoked"}


# IP Whitelist Management
@router.get("/ip-whitelist/{org_id}")
async def get_ip_whitelist(org_id: str, request: Request):
    """Get IP whitelist for an organization"""
    db = request.app.state.db
    
    whitelist = await db.ip_whitelists.find_one({"org_id": org_id})
    
    if not whitelist:
        return {"org_id": org_id, "ips": [], "enabled": False}
    
    whitelist["_id"] = str(whitelist.get("_id", ""))
    return whitelist


@router.put("/ip-whitelist/{org_id}")
async def update_ip_whitelist(
    org_id: str,
    request: Request,
    ips: List[str] = None,
    enabled: bool = True
):
    """Update IP whitelist for an organization"""
    db = request.app.state.db
    
    await db.ip_whitelists.update_one(
        {"org_id": org_id},
        {
            "$set": {
                "org_id": org_id,
                "ips": ips or [],
                "enabled": enabled,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    return {"message": "IP whitelist updated", "ips": ips, "enabled": enabled}


# Audit Log Endpoints
@router.get("/audit-logs/{org_id}")
async def get_audit_logs(
    org_id: str,
    request: Request,
    limit: int = 100,
    offset: int = 0,
    start_date: str = None,
    end_date: str = None,
    method: str = None,
    path_contains: str = None
):
    """Get API audit logs for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    
    if start_date:
        query["timestamp"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "timestamp" not in query:
            query["timestamp"] = {}
        query["timestamp"]["$lte"] = datetime.fromisoformat(end_date)
    if method:
        query["method"] = method.upper()
    if path_contains:
        query["path"] = {"$regex": path_contains, "$options": "i"}
    
    logs = await db.api_audit_logs.find(query).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.api_audit_logs.count_documents(query)
    
    for log in logs:
        log["_id"] = str(log.get("_id", ""))
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/audit-logs/{org_id}/stats")
async def get_audit_stats(org_id: str, request: Request, days: int = 7):
    """Get audit log statistics"""
    db = request.app.state.db
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {"$match": {"org_id": org_id, "timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "method": "$method"
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id.date": 1}}
    ]
    
    results = await db.api_audit_logs.aggregate(pipeline).to_list(1000)
    
    # Also get error rate
    error_pipeline = [
        {"$match": {"org_id": org_id, "timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "errors": {"$sum": {"$cond": [{"$gte": ["$response_status", 400]}, 1, 0]}}
        }}
    ]
    
    error_stats = await db.api_audit_logs.aggregate(error_pipeline).to_list(1)
    
    return {
        "daily_stats": results,
        "error_stats": error_stats[0] if error_stats else {"total": 0, "errors": 0},
        "period_days": days
    }


# Rate Limit Info Endpoint
@router.get("/rate-limits")
async def get_rate_limits():
    """Get available rate limit tiers"""
    return {
        "tiers": [
            {"id": "free", "name": "Free", "requests_per_minute": 100, "price": 0},
            {"id": "pro", "name": "Pro", "requests_per_minute": 1000, "price": 49},
            {"id": "enterprise", "name": "Enterprise", "requests_per_minute": 10000, "price": 199},
            {"id": "unlimited", "name": "Unlimited", "requests_per_minute": None, "price": "Custom"},
        ]
    }


@router.get("/rate-limits/{org_id}/status")
async def get_rate_limit_status(org_id: str, request: Request):
    """Get current rate limit status for an organization"""
    db = request.app.state.db
    
    # Get org's current tier
    org = await db.organizations.find_one({"id": org_id})
    tier = org.get("billing_tier", "free") if org else "free"
    
    # Get usage in last minute
    one_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
    usage = await db.api_audit_logs.count_documents({
        "org_id": org_id,
        "timestamp": {"$gte": one_minute_ago}
    })
    
    limit = {"free": 100, "pro": 1000, "enterprise": 10000}.get(tier, 100)
    
    return {
        "tier": tier,
        "limit_per_minute": limit if tier != "unlimited" else None,
        "current_usage": usage,
        "remaining": max(0, limit - usage) if tier != "unlimited" else None,
        "reset_at": (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
    }


# Security Settings Endpoint
@router.get("/settings/{org_id}")
async def get_security_settings(org_id: str, request: Request):
    """Get all security settings for an organization"""
    db = request.app.state.db
    
    settings = await db.security_settings.find_one({"org_id": org_id})
    
    if not settings:
        settings = {
            "org_id": org_id,
            "two_factor_required": False,
            "session_timeout_minutes": 60,
            "password_min_length": 8,
            "password_require_special": True,
            "password_require_numbers": True,
            "max_failed_logins": 5,
            "lockout_duration_minutes": 30,
            "audit_log_retention_days": 90,
        }
    else:
        settings["_id"] = str(settings.get("_id", ""))
    
    return settings


@router.put("/settings/{org_id}")
async def update_security_settings(org_id: str, request: Request):
    """Update security settings for an organization"""
    db = request.app.state.db
    data = await request.json()
    
    allowed_fields = [
        "two_factor_required", "session_timeout_minutes", "password_min_length",
        "password_require_special", "password_require_numbers", "max_failed_logins",
        "lockout_duration_minutes", "audit_log_retention_days"
    ]
    
    update_fields = {k: v for k, v in data.items() if k in allowed_fields}
    update_fields["org_id"] = org_id
    update_fields["updated_at"] = datetime.now(timezone.utc)
    
    await db.security_settings.update_one(
        {"org_id": org_id},
        {"$set": update_fields},
        upsert=True
    )
    
    return {"message": "Security settings updated", "settings": update_fields}
