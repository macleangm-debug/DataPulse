"""DataPulse - Security Utilities
RBAC decorators and permission checking utilities.
"""

from functools import wraps
from fastapi import HTTPException, Request
from typing import List, Optional, Callable
import jwt
import os

# Default role permissions
DEFAULT_ROLES = {
    "viewer": ["view_responses", "run_basic_stats", "view_dashboards", "view_reports"],
    "analyst": [
        "view_responses", "run_basic_stats", "run_advanced_stats", "run_ai_copilot",
        "create_snapshots", "apply_transformations", "export_csv", "export_excel",
        "view_dashboards", "create_dashboards", "view_reports", "create_reports", "export_reports"
    ],
    "senior_analyst": [
        "view_responses", "run_basic_stats", "run_advanced_stats", "run_ai_copilot",
        "create_snapshots", "apply_transformations", "export_csv", "export_excel",
        "export_spss", "export_stata", "export_microdata", "view_dashboards",
        "create_dashboards", "edit_dashboards", "share_dashboards", "view_reports",
        "create_reports", "export_reports"
    ],
    "admin": [
        "view_responses", "view_pii_fields", "view_gps_data", "view_audio_video",
        "run_basic_stats", "run_advanced_stats", "run_ai_copilot", "create_snapshots",
        "apply_transformations", "export_csv", "export_excel", "export_spss",
        "export_stata", "export_microdata", "export_with_pii", "view_dashboards",
        "create_dashboards", "edit_dashboards", "delete_dashboards", "share_dashboards",
        "publish_dashboards", "view_reports", "create_reports", "export_reports",
        "view_audit_logs", "manage_users", "manage_roles"
    ]
}

JWT_SECRET = os.environ.get("JWT_SECRET", "datapulse-super-secret-jwt-key-2024")


async def get_user_from_token(request: Request) -> Optional[dict]:
    """Extract user info from JWT token in Authorization header"""
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        return None


async def get_user_permissions(db, user_id: str, org_id: str) -> List[str]:
    """Get permissions for a user in an organization"""
    # Get user's role assignment
    assignment = await db.user_roles.find_one(
        {"org_id": org_id, "user_id": user_id}
    )
    
    role_id = assignment.get("role_id", "viewer") if assignment else "viewer"
    
    # Get permissions from role
    if role_id in DEFAULT_ROLES:
        return DEFAULT_ROLES[role_id]
    
    # Check for custom role
    custom_role = await db.roles.find_one({"id": role_id, "org_id": org_id})
    if custom_role:
        return custom_role.get("permissions", [])
    
    return DEFAULT_ROLES["viewer"]


def requires_permission(permission: str):
    """
    Decorator to check if user has a specific permission.
    Use on FastAPI route handlers.
    
    Usage:
        @router.post("/some-endpoint")
        @requires_permission("export_spss")
        async def some_endpoint(request: Request, org_id: str, ...):
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
            
            if request is None:
                raise HTTPException(status_code=500, detail="Request object not found")
            
            # Get user from token
            user = await get_user_from_token(request)
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            # Get org_id from kwargs or request body
            org_id = kwargs.get("org_id")
            if not org_id:
                # Try to get from request body if POST
                if request.method == "POST":
                    try:
                        body = await request.json()
                        org_id = body.get("org_id")
                    except:
                        pass
            
            if not org_id:
                raise HTTPException(status_code=400, detail="Organization ID required")
            
            # Check permissions
            db = request.app.state.db
            user_permissions = await get_user_permissions(db, user.get("sub", user.get("user_id", "")), org_id)
            
            if permission not in user_permissions:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Permission denied: {permission} required"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def requires_role(roles: List[str]):
    """
    Decorator to check if user has one of the specified roles.
    
    Usage:
        @router.post("/admin-endpoint")
        @requires_role(["admin", "senior_analyst"])
        async def admin_endpoint(request: Request, org_id: str, ...):
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
            
            if request is None:
                raise HTTPException(status_code=500, detail="Request object not found")
            
            # Get user from token
            user = await get_user_from_token(request)
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            # Get org_id
            org_id = kwargs.get("org_id")
            if not org_id:
                if request.method == "POST":
                    try:
                        body = await request.json()
                        org_id = body.get("org_id")
                    except:
                        pass
            
            if not org_id:
                raise HTTPException(status_code=400, detail="Organization ID required")
            
            # Get user's role
            db = request.app.state.db
            assignment = await db.user_roles.find_one(
                {"org_id": org_id, "user_id": user.get("sub", user.get("user_id", ""))}
            )
            
            user_role = assignment.get("role_id", "viewer") if assignment else "viewer"
            
            if user_role not in roles:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Access denied: Role {', '.join(roles)} required"
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


async def check_permission(db, user_id: str, org_id: str, permission: str) -> bool:
    """
    Check if a user has a specific permission.
    Can be used inline in route handlers.
    
    Usage:
        if not await check_permission(db, user_id, org_id, "view_pii_fields"):
            raise HTTPException(status_code=403, detail="Cannot view PII")
    """
    permissions = await get_user_permissions(db, user_id, org_id)
    return permission in permissions
