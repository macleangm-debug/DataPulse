"""DataPulse - Role-Based Access Control Routes

Manage feature access based on user roles and permissions.
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
from enum import Enum
import uuid

router = APIRouter(prefix="/rbac", tags=["Role-Based Access Control"])


class FeatureCategory(str, Enum):
    DATA_EXPORT = "data_export"
    PII_ACCESS = "pii_access"
    ADVANCED_ANALYSIS = "advanced_analysis"
    DASHBOARD_ADMIN = "dashboard_admin"
    REPORT_GENERATION = "report_generation"
    AUDIT_VIEW = "audit_view"
    SETTINGS_ADMIN = "settings_admin"


class Permission(str, Enum):
    # Data exports
    EXPORT_CSV = "export_csv"
    EXPORT_EXCEL = "export_excel"
    EXPORT_SPSS = "export_spss"
    EXPORT_STATA = "export_stata"
    EXPORT_MICRODATA = "export_microdata"
    EXPORT_WITH_PII = "export_with_pii"
    
    # Data access
    VIEW_RESPONSES = "view_responses"
    VIEW_PII_FIELDS = "view_pii_fields"
    VIEW_GPS_DATA = "view_gps_data"
    VIEW_AUDIO_VIDEO = "view_audio_video"
    
    # Analysis
    RUN_BASIC_STATS = "run_basic_stats"
    RUN_ADVANCED_STATS = "run_advanced_stats"
    RUN_AI_COPILOT = "run_ai_copilot"
    CREATE_SNAPSHOTS = "create_snapshots"
    APPLY_TRANSFORMATIONS = "apply_transformations"
    
    # Dashboards
    VIEW_DASHBOARDS = "view_dashboards"
    CREATE_DASHBOARDS = "create_dashboards"
    EDIT_DASHBOARDS = "edit_dashboards"
    DELETE_DASHBOARDS = "delete_dashboards"
    SHARE_DASHBOARDS = "share_dashboards"
    PUBLISH_DASHBOARDS = "publish_dashboards"
    
    # Reports
    VIEW_REPORTS = "view_reports"
    CREATE_REPORTS = "create_reports"
    EXPORT_REPORTS = "export_reports"
    
    # Admin
    VIEW_AUDIT_LOGS = "view_audit_logs"
    MANAGE_USERS = "manage_users"
    MANAGE_ROLES = "manage_roles"


# Default role definitions
DEFAULT_ROLES = {
    "viewer": {
        "name": "Viewer",
        "description": "Can view data and dashboards, no export or edit",
        "permissions": [
            Permission.VIEW_RESPONSES.value,
            Permission.RUN_BASIC_STATS.value,
            Permission.VIEW_DASHBOARDS.value,
            Permission.VIEW_REPORTS.value
        ]
    },
    "analyst": {
        "name": "Analyst",
        "description": "Can run analyses and export non-sensitive data",
        "permissions": [
            Permission.VIEW_RESPONSES.value,
            Permission.RUN_BASIC_STATS.value,
            Permission.RUN_ADVANCED_STATS.value,
            Permission.RUN_AI_COPILOT.value,
            Permission.CREATE_SNAPSHOTS.value,
            Permission.APPLY_TRANSFORMATIONS.value,
            Permission.EXPORT_CSV.value,
            Permission.EXPORT_EXCEL.value,
            Permission.VIEW_DASHBOARDS.value,
            Permission.CREATE_DASHBOARDS.value,
            Permission.VIEW_REPORTS.value,
            Permission.CREATE_REPORTS.value,
            Permission.EXPORT_REPORTS.value
        ]
    },
    "senior_analyst": {
        "name": "Senior Analyst",
        "description": "Full analysis access including statistical exports",
        "permissions": [
            Permission.VIEW_RESPONSES.value,
            Permission.RUN_BASIC_STATS.value,
            Permission.RUN_ADVANCED_STATS.value,
            Permission.RUN_AI_COPILOT.value,
            Permission.CREATE_SNAPSHOTS.value,
            Permission.APPLY_TRANSFORMATIONS.value,
            Permission.EXPORT_CSV.value,
            Permission.EXPORT_EXCEL.value,
            Permission.EXPORT_SPSS.value,
            Permission.EXPORT_STATA.value,
            Permission.EXPORT_MICRODATA.value,
            Permission.VIEW_DASHBOARDS.value,
            Permission.CREATE_DASHBOARDS.value,
            Permission.EDIT_DASHBOARDS.value,
            Permission.SHARE_DASHBOARDS.value,
            Permission.VIEW_REPORTS.value,
            Permission.CREATE_REPORTS.value,
            Permission.EXPORT_REPORTS.value
        ]
    },
    "admin": {
        "name": "Administrator",
        "description": "Full access including PII and audit logs",
        "permissions": [p.value for p in Permission]
    }
}


class RoleDefinition(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str]


class UserRoleAssignment(BaseModel):
    user_id: str
    role_id: str


class PermissionCheck(BaseModel):
    user_id: str
    org_id: str
    permission: str


@router.get("/roles/{org_id}")
async def get_roles(
    request: Request,
    org_id: str
):
    """Get all roles for an organization"""
    db = request.app.state.db
    
    # Get custom roles
    custom_roles = await db.roles.find(
        {"org_id": org_id},
        {"_id": 0}
    ).to_list(None)
    
    # Combine with defaults
    all_roles = []
    for role_id, role_def in DEFAULT_ROLES.items():
        all_roles.append({
            "id": role_id,
            "name": role_def["name"],
            "description": role_def["description"],
            "permissions": role_def["permissions"],
            "is_default": True
        })
    
    for role in custom_roles:
        all_roles.append({**role, "is_default": False})
    
    return {"roles": all_roles}


@router.post("/roles/{org_id}")
async def create_role(
    request: Request,
    org_id: str,
    role: RoleDefinition
):
    """Create a custom role for an organization"""
    db = request.app.state.db
    
    role_id = str(uuid.uuid4())
    role_record = {
        "id": role_id,
        "org_id": org_id,
        "name": role.name,
        "description": role.description,
        "permissions": role.permissions,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.roles.insert_one(role_record)
    
    return {"id": role_id, "name": role.name}


@router.put("/roles/{org_id}/{role_id}")
async def update_role(
    request: Request,
    org_id: str,
    role_id: str,
    role: RoleDefinition
):
    """Update a custom role"""
    db = request.app.state.db
    
    # Check if it's a default role
    if role_id in DEFAULT_ROLES:
        raise HTTPException(status_code=400, detail="Cannot modify default roles")
    
    result = await db.roles.update_one(
        {"id": role_id, "org_id": org_id},
        {"$set": {
            "name": role.name,
            "description": role.description,
            "permissions": role.permissions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return {"id": role_id, "updated": True}


@router.delete("/roles/{org_id}/{role_id}")
async def delete_role(
    request: Request,
    org_id: str,
    role_id: str
):
    """Delete a custom role"""
    db = request.app.state.db
    
    if role_id in DEFAULT_ROLES:
        raise HTTPException(status_code=400, detail="Cannot delete default roles")
    
    result = await db.roles.delete_one({"id": role_id, "org_id": org_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Also remove user assignments
    await db.user_roles.delete_many({"role_id": role_id, "org_id": org_id})
    
    return {"deleted": True}


@router.get("/user-role/{org_id}/{user_id}")
async def get_user_role(
    request: Request,
    org_id: str,
    user_id: str
):
    """Get a user's role in an organization"""
    db = request.app.state.db
    
    assignment = await db.user_roles.find_one(
        {"org_id": org_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not assignment:
        # Default role for new users
        return {"role_id": "viewer", "role_name": "Viewer", "is_default": True}
    
    role_id = assignment.get("role_id", "viewer")
    
    # Get role details
    if role_id in DEFAULT_ROLES:
        return {
            "role_id": role_id,
            "role_name": DEFAULT_ROLES[role_id]["name"],
            "permissions": DEFAULT_ROLES[role_id]["permissions"],
            "is_default": True
        }
    
    custom_role = await db.roles.find_one({"id": role_id, "org_id": org_id}, {"_id": 0})
    if custom_role:
        return {
            "role_id": role_id,
            "role_name": custom_role["name"],
            "permissions": custom_role["permissions"],
            "is_default": False
        }
    
    return {"role_id": "viewer", "role_name": "Viewer", "is_default": True}


@router.post("/user-role/{org_id}")
async def assign_user_role(
    request: Request,
    org_id: str,
    assignment: UserRoleAssignment
):
    """Assign a role to a user"""
    db = request.app.state.db
    
    # Validate role exists
    if assignment.role_id not in DEFAULT_ROLES:
        custom_role = await db.roles.find_one({"id": assignment.role_id, "org_id": org_id})
        if not custom_role:
            raise HTTPException(status_code=404, detail="Role not found")
    
    await db.user_roles.update_one(
        {"org_id": org_id, "user_id": assignment.user_id},
        {"$set": {
            "org_id": org_id,
            "user_id": assignment.user_id,
            "role_id": assignment.role_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"assigned": True, "role_id": assignment.role_id}


@router.post("/check-permission")
async def check_permission(
    request: Request,
    check: PermissionCheck
):
    """Check if a user has a specific permission"""
    db = request.app.state.db
    
    # Get user's role
    assignment = await db.user_roles.find_one(
        {"org_id": check.org_id, "user_id": check.user_id}
    )
    
    role_id = assignment.get("role_id", "viewer") if assignment else "viewer"
    
    # Get permissions
    if role_id in DEFAULT_ROLES:
        permissions = DEFAULT_ROLES[role_id]["permissions"]
    else:
        custom_role = await db.roles.find_one({"id": role_id, "org_id": check.org_id})
        permissions = custom_role.get("permissions", []) if custom_role else []
    
    has_permission = check.permission in permissions
    
    return {
        "user_id": check.user_id,
        "permission": check.permission,
        "allowed": has_permission,
        "role_id": role_id
    }


@router.get("/permissions")
async def get_all_permissions():
    """Get list of all available permissions"""
    return {
        "permissions": [
            {
                "id": p.value,
                "name": p.name.replace("_", " ").title(),
                "category": p.value.split("_")[0]
            }
            for p in Permission
        ],
        "categories": [c.value for c in FeatureCategory]
    }


@router.get("/user-permissions/{org_id}/{user_id}")
async def get_user_permissions(
    request: Request,
    org_id: str,
    user_id: str
):
    """Get all permissions for a user"""
    db = request.app.state.db
    
    # Get user's role
    assignment = await db.user_roles.find_one(
        {"org_id": org_id, "user_id": user_id}
    )
    
    role_id = assignment.get("role_id", "viewer") if assignment else "viewer"
    
    # Get permissions
    if role_id in DEFAULT_ROLES:
        permissions = DEFAULT_ROLES[role_id]["permissions"]
        role_name = DEFAULT_ROLES[role_id]["name"]
    else:
        custom_role = await db.roles.find_one({"id": role_id, "org_id": org_id})
        permissions = custom_role.get("permissions", []) if custom_role else []
        role_name = custom_role.get("name", "Unknown") if custom_role else "Unknown"
    
    # Group by category
    grouped = {}
    for p in Permission:
        category = p.value.split("_")[0]
        if category not in grouped:
            grouped[category] = []
        grouped[category].append({
            "id": p.value,
            "name": p.name.replace("_", " ").title(),
            "allowed": p.value in permissions
        })
    
    return {
        "user_id": user_id,
        "role_id": role_id,
        "role_name": role_name,
        "permissions": permissions,
        "grouped": grouped
    }
