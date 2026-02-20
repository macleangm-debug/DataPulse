"""
DataViz Studio - Public Dashboard Sharing Routes
Handles public link generation and access for dashboards
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import secrets
import hashlib

router = APIRouter(prefix="/dashboards", tags=["Dashboard Sharing"])


class ShareSettings(BaseModel):
    is_public: bool = False
    password_protected: bool = False
    password: Optional[str] = None
    expires_at: Optional[str] = None  # ISO datetime string


class PublicShareResponse(BaseModel):
    public_id: str
    public_url: str
    password_protected: bool
    expires_at: Optional[str]


class PublicDashboardAccess(BaseModel):
    password: Optional[str] = None


def hash_password(password: str) -> str:
    """Hash password for storage"""
    return hashlib.sha256(password.encode()).hexdigest()


@router.post("/{dashboard_id}/share")
async def create_public_share(
    request: Request,
    dashboard_id: str,
    settings: ShareSettings
):
    """Generate or update public share link for a dashboard"""
    db = request.app.state.db
    
    # Get dashboard
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Generate public ID if not exists
    public_id = dashboard.get("public_id") or secrets.token_urlsafe(16)
    
    # Calculate expiry
    expires_at = None
    if settings.expires_at:
        expires_at = settings.expires_at
    
    # Hash password if provided
    password_hash = None
    if settings.password_protected and settings.password:
        password_hash = hash_password(settings.password)
    
    # Update dashboard with share settings
    share_settings = {
        "public_id": public_id,
        "is_public": settings.is_public,
        "password_protected": settings.password_protected,
        "password_hash": password_hash,
        "share_expires_at": expires_at,
        "share_created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dashboards.update_one(
        {"id": dashboard_id},
        {"$set": share_settings}
    )
    
    # Build public URL
    base_url = str(request.base_url).rstrip('/')
    public_url = f"{base_url}/public/dashboard/{public_id}"
    
    return {
        "public_id": public_id,
        "public_url": public_url,
        "password_protected": settings.password_protected,
        "expires_at": expires_at,
        "is_public": settings.is_public
    }


@router.delete("/{dashboard_id}/share")
async def revoke_public_share(request: Request, dashboard_id: str):
    """Revoke public share link"""
    db = request.app.state.db
    
    result = await db.dashboards.update_one(
        {"id": dashboard_id},
        {"$set": {
            "is_public": False,
            "public_id": None,
            "password_hash": None,
            "share_expires_at": None
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"status": "success", "message": "Public share revoked"}


@router.get("/{dashboard_id}/share")
async def get_share_settings(request: Request, dashboard_id: str):
    """Get current share settings for a dashboard"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one(
        {"id": dashboard_id},
        {"_id": 0, "public_id": 1, "is_public": 1, "password_protected": 1, 
         "share_expires_at": 1, "share_created_at": 1}
    )
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    base_url = str(request.base_url).rstrip('/')
    public_url = None
    if dashboard.get("public_id"):
        public_url = f"{base_url}/public/dashboard/{dashboard['public_id']}"
    
    return {
        "is_public": dashboard.get("is_public", False),
        "public_id": dashboard.get("public_id"),
        "public_url": public_url,
        "password_protected": dashboard.get("password_protected", False),
        "expires_at": dashboard.get("share_expires_at"),
        "created_at": dashboard.get("share_created_at")
    }


# Public access endpoint (no auth required)
@router.post("/public/{public_id}/access")
async def access_public_dashboard(
    request: Request,
    public_id: str,
    access: PublicDashboardAccess
):
    """Access a public dashboard (validates password if required)"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one(
        {"public_id": public_id, "is_public": True},
        {"_id": 0}
    )
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found or not public")
    
    # Check expiry
    if dashboard.get("share_expires_at"):
        expires_at = datetime.fromisoformat(dashboard["share_expires_at"].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="This share link has expired")
    
    # Check password
    if dashboard.get("password_protected"):
        if not access.password:
            raise HTTPException(
                status_code=401, 
                detail="Password required",
                headers={"X-Password-Required": "true"}
            )
        
        if hash_password(access.password) != dashboard.get("password_hash"):
            raise HTTPException(status_code=401, detail="Invalid password")
    
    # Return dashboard data (excluding sensitive fields)
    return {
        "id": dashboard["id"],
        "name": dashboard.get("name", "Untitled Dashboard"),
        "description": dashboard.get("description"),
        "layout": dashboard.get("layout", []),
        "widgets": dashboard.get("widgets", []),
        "theme": dashboard.get("theme", {}),
        "created_at": dashboard.get("created_at")
    }


@router.get("/public/{public_id}")
async def get_public_dashboard_info(request: Request, public_id: str):
    """Get basic info about a public dashboard (no auth, no password)"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one(
        {"public_id": public_id, "is_public": True},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "password_protected": 1, 
         "share_expires_at": 1, "created_at": 1}
    )
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found or not public")
    
    # Check expiry
    expired = False
    if dashboard.get("share_expires_at"):
        expires_at = datetime.fromisoformat(dashboard["share_expires_at"].replace('Z', '+00:00'))
        expired = datetime.now(timezone.utc) > expires_at
    
    return {
        "name": dashboard.get("name", "Untitled Dashboard"),
        "description": dashboard.get("description"),
        "password_protected": dashboard.get("password_protected", False),
        "expired": expired,
        "expires_at": dashboard.get("share_expires_at")
    }
