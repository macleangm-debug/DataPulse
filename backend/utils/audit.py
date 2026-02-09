"""DataPulse - Audit Logging Utilities
Decorators and functions for logging user actions to audit trail.
"""

from functools import wraps
from fastapi import Request
from typing import Callable, Optional, Dict, Any
from datetime import datetime, timezone
import jwt
import os
import json
import logging

logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "datapulse-super-secret-jwt-key-2024")


async def get_user_from_request(request: Request) -> Optional[dict]:
    """Extract user info from JWT token"""
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except:
        return None


def log_action(action: str, target_type: str = None, include_request_body: bool = False):
    """
    Decorator to log user actions to the audit trail.
    
    Args:
        action: Description of the action (e.g., "export_data", "run_regression", "create_dashboard")
        target_type: Type of resource being acted upon (e.g., "form", "snapshot", "dashboard")
        include_request_body: Whether to include request body in audit log (careful with sensitive data)
    
    Usage:
        @router.post("/export/{form_id}")
        @log_action("export_data", target_type="form")
        async def export_data(request: Request, form_id: str, ...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find request object
            request = kwargs.get("request")
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            # Get user info
            user = None
            user_id = "anonymous"
            if request:
                user = await get_user_from_request(request)
                if user:
                    user_id = user.get("sub", user.get("user_id", "unknown"))
            
            # Extract target_id from kwargs
            target_id = None
            for key in ["form_id", "snapshot_id", "dashboard_id", "report_id", "org_id"]:
                if key in kwargs:
                    target_id = kwargs[key]
                    break
            
            # Build audit log details
            details = {
                "endpoint": str(request.url.path) if request else "unknown",
                "method": request.method if request else "unknown",
                "query_params": dict(request.query_params) if request else {},
            }
            
            # Add request body if configured and safe
            if include_request_body and request and request.method in ["POST", "PUT", "PATCH"]:
                try:
                    body = await request.json()
                    # Exclude sensitive fields
                    safe_body = {k: v for k, v in body.items() 
                                if k not in ["password", "token", "secret", "api_key"]}
                    details["request_body"] = safe_body
                except:
                    pass
            
            # Execute the function
            result = None
            error = None
            try:
                result = await func(*args, **kwargs)
                details["status"] = "success"
            except Exception as e:
                error = e
                details["status"] = "error"
                details["error"] = str(e)
            
            # Log to database
            if request and hasattr(request.app, "state") and hasattr(request.app.state, "db"):
                try:
                    db = request.app.state.db
                    audit_entry = {
                        "user_id": user_id,
                        "action": action,
                        "target_type": target_type,
                        "target_id": target_id,
                        "timestamp": datetime.now(timezone.utc),
                        "details": details,
                        "ip_address": request.client.host if request.client else None,
                        "user_agent": request.headers.get("user-agent", "")[:200],
                    }
                    
                    # Also get org_id if available
                    org_id = kwargs.get("org_id")
                    if not org_id and request.method == "POST":
                        try:
                            body = await request.json()
                            org_id = body.get("org_id")
                        except:
                            pass
                    
                    if org_id:
                        audit_entry["org_id"] = org_id
                    
                    await db.audit_logs.insert_one(audit_entry)
                except Exception as log_error:
                    logger.error(f"Failed to write audit log: {log_error}")
            
            # Re-raise error if there was one
            if error:
                raise error
            
            return result
        
        return wrapper
    return decorator


async def log_audit_event(
    db,
    user_id: str,
    action: str,
    org_id: str = None,
    target_type: str = None,
    target_id: str = None,
    details: Dict[str, Any] = None,
    ip_address: str = None
):
    """
    Directly log an audit event to the database.
    Use for inline logging without decorator.
    
    Usage:
        await log_audit_event(
            db, user_id, "delete_response",
            org_id=org_id, target_type="response",
            target_id=response_id, details={"reason": "user_request"}
        )
    """
    audit_entry = {
        "user_id": user_id,
        "action": action,
        "org_id": org_id,
        "target_type": target_type,
        "target_id": target_id,
        "timestamp": datetime.now(timezone.utc),
        "details": details or {},
        "ip_address": ip_address,
    }
    
    try:
        await db.audit_logs.insert_one(audit_entry)
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}")


async def get_audit_logs(
    db,
    org_id: str,
    limit: int = 100,
    offset: int = 0,
    user_id: str = None,
    action: str = None,
    target_type: str = None,
    start_date: datetime = None,
    end_date: datetime = None
) -> Dict[str, Any]:
    """
    Query audit logs with filters.
    
    Usage:
        logs = await get_audit_logs(
            db, org_id,
            user_id="user123",
            action="export_data",
            start_date=datetime(2024, 1, 1)
        )
    """
    query = {"org_id": org_id}
    
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    if target_type:
        query["target_type"] = target_type
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" not in query:
            query["timestamp"] = {}
        query["timestamp"]["$lte"] = end_date
    
    cursor = db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1)
    
    total = await db.audit_logs.count_documents(query)
    logs = await cursor.skip(offset).limit(limit).to_list(limit)
    
    # Convert datetime to ISO format for JSON serialization
    for log in logs:
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }
