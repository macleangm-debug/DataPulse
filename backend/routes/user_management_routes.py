"""DataPulse - User Management Routes

Comprehensive user management module with:
- User listing and search
- User activity/login history
- User suspension/deactivation
- Password policies
- Session management
"""

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import hashlib
import secrets
from bson import ObjectId

router = APIRouter(prefix="/users", tags=["User Management"])


# ============= ENUMS =============
class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEACTIVATED = "deactivated"
    PENDING = "pending"
    LOCKED = "locked"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class ActivityType(str, Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PROFILE_UPDATE = "profile_update"
    ROLE_CHANGE = "role_change"
    SUSPENSION = "suspension"
    REACTIVATION = "reactivation"
    FAILED_LOGIN = "failed_login"
    SESSION_CREATED = "session_created"
    SESSION_REVOKED = "session_revoked"


# ============= MODELS =============
class PasswordPolicyModel(BaseModel):
    min_length: int = 8
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_numbers: bool = True
    require_special: bool = True
    max_age_days: int = 90
    history_count: int = 5
    max_failed_attempts: int = 5
    lockout_duration_minutes: int = 30


class UserCreateRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "viewer"
    org_id: str
    send_invite: bool = True


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[UserStatus] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    job_title: Optional[str] = None


class BulkUserAction(BaseModel):
    user_ids: List[str]
    action: str  # suspend, activate, deactivate, delete
    reason: Optional[str] = None


class PasswordResetRequest(BaseModel):
    user_id: str
    force_change: bool = True


class SessionRevokeRequest(BaseModel):
    session_ids: List[str]
    reason: Optional[str] = None


# ============= HELPER FUNCTIONS =============
def get_db(request: Request):
    return request.app.state.db


def generate_session_id():
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def log_user_activity(db, user_id: str, org_id: str, activity_type: ActivityType, 
                           details: Dict = None, ip_address: str = None, user_agent: str = None):
    """Log user activity for audit trail"""
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "org_id": org_id,
        "activity_type": activity_type.value,
        "details": details or {},
        "ip_address": ip_address,
        "user_agent": user_agent,
        "timestamp": datetime.now(timezone.utc)
    }
    await db.user_activity_logs.insert_one(activity)
    return activity


# ============= USER MANAGEMENT ENDPOINTS =============

@router.get("")
async def list_users(
    request: Request,
    org_id: str,
    status: Optional[UserStatus] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """List all users in an organization with filtering and pagination"""
    db = get_db(request)
    
    # Build query
    query = {"org_id": org_id}
    
    if status:
        query["status"] = status.value
    
    if role:
        query["role"] = role
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db.org_members.count_documents(query)
    
    # Build sort
    sort_direction = -1 if sort_order == "desc" else 1
    
    # Get members with user details
    skip = (page - 1) * page_size
    members = await db.org_members.find(query).sort(sort_by, sort_direction).skip(skip).limit(page_size).to_list(page_size)
    
    # Enrich with user details and last activity
    enriched_users = []
    for member in members:
        user = await db.users.find_one({"id": member.get("user_id")}, {"_id": 0, "password_hash": 0})
        if user:
            # Get last activity
            last_activity = await db.user_activity_logs.find_one(
                {"user_id": member.get("user_id")},
                sort=[("timestamp", -1)]
            )
            
            # Get active sessions count
            active_sessions = await db.user_sessions.count_documents({
                "user_id": member.get("user_id"),
                "status": "active",
                "expires_at": {"$gt": datetime.now(timezone.utc)}
            })
            
            enriched_users.append({
                "id": member.get("id"),
                "user_id": member.get("user_id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "role": member.get("role", "viewer"),
                "status": member.get("status", "active"),
                "phone": member.get("phone"),
                "department": member.get("department"),
                "job_title": member.get("job_title"),
                "joined_at": member.get("joined_at"),
                "last_active": last_activity.get("timestamp") if last_activity else None,
                "active_sessions": active_sessions,
                "created_at": user.get("created_at")
            })
    
    return {
        "users": enriched_users,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/stats")
async def get_user_stats(request: Request, org_id: str):
    """Get user statistics for the organization"""
    db = get_db(request)
    
    # Total users
    total_users = await db.org_members.count_documents({"org_id": org_id})
    
    # Active users
    active_users = await db.org_members.count_documents({"org_id": org_id, "status": {"$in": ["active", None]}})
    
    # Suspended users
    suspended_users = await db.org_members.count_documents({"org_id": org_id, "status": "suspended"})
    
    # Deactivated users
    deactivated_users = await db.org_members.count_documents({"org_id": org_id, "status": "deactivated"})
    
    # Pending invites
    pending_users = await db.org_members.count_documents({"org_id": org_id, "status": "pending"})
    
    # Users by role
    role_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]
    roles = await db.org_members.aggregate(role_pipeline).to_list(100)
    users_by_role = {r["_id"]: r["count"] for r in roles if r["_id"]}
    
    # Active sessions
    active_sessions = await db.user_sessions.count_documents({
        "org_id": org_id,
        "status": "active",
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    # Recent logins (last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_logins = await db.user_activity_logs.count_documents({
        "org_id": org_id,
        "activity_type": "login",
        "timestamp": {"$gte": yesterday}
    })
    
    # Failed login attempts (last 24 hours)
    failed_logins = await db.user_activity_logs.count_documents({
        "org_id": org_id,
        "activity_type": "failed_login",
        "timestamp": {"$gte": yesterday}
    })
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "suspended_users": suspended_users,
        "deactivated_users": deactivated_users,
        "pending_users": pending_users,
        "users_by_role": users_by_role,
        "active_sessions": active_sessions,
        "recent_logins_24h": recent_logins,
        "failed_logins_24h": failed_logins
    }


@router.get("/{user_id}")
async def get_user_details(request: Request, user_id: str, org_id: str):
    """Get detailed user information"""
    db = get_db(request)
    
    member = await db.org_members.find_one({"user_id": user_id, "org_id": org_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="User not found in organization")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get recent activity
    recent_activity = await db.user_activity_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    
    # Get active sessions
    sessions = await db.user_sessions.find(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get login history
    login_history = await db.user_activity_logs.find(
        {"user_id": user_id, "activity_type": {"$in": ["login", "failed_login"]}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(50).to_list(50)
    
    return {
        "user": {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "created_at": user.get("created_at")
        },
        "membership": {
            "id": member.get("id"),
            "role": member.get("role"),
            "status": member.get("status", "active"),
            "phone": member.get("phone"),
            "department": member.get("department"),
            "job_title": member.get("job_title"),
            "joined_at": member.get("joined_at"),
            "last_password_change": member.get("last_password_change"),
            "failed_login_attempts": member.get("failed_login_attempts", 0),
            "locked_until": member.get("locked_until")
        },
        "recent_activity": recent_activity,
        "active_sessions": sessions,
        "login_history": login_history
    }


@router.put("/{user_id}")
async def update_user(
    request: Request, 
    user_id: str, 
    org_id: str,
    update: UserUpdateRequest
):
    """Update user information"""
    db = get_db(request)
    
    member = await db.org_members.find_one({"user_id": user_id, "org_id": org_id})
    if not member:
        raise HTTPException(status_code=404, detail="User not found in organization")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Handle status changes
    old_status = member.get("status", "active")
    new_status = update.status.value if update.status else None
    
    await db.org_members.update_one(
        {"user_id": user_id, "org_id": org_id},
        {"$set": update_data}
    )
    
    # Log activity
    activity_type = ActivityType.PROFILE_UPDATE
    if new_status and new_status != old_status:
        if new_status == "suspended":
            activity_type = ActivityType.SUSPENSION
        elif new_status == "active" and old_status in ["suspended", "deactivated"]:
            activity_type = ActivityType.REACTIVATION
    
    await log_user_activity(
        db, user_id, org_id, activity_type,
        {"changes": update_data, "old_status": old_status, "new_status": new_status}
    )
    
    return {"message": "User updated successfully"}


@router.post("/bulk-action")
async def bulk_user_action(request: Request, action: BulkUserAction, org_id: str):
    """Perform bulk actions on users"""
    db = get_db(request)
    
    results = {"success": [], "failed": []}
    
    for user_id in action.user_ids:
        try:
            member = await db.org_members.find_one({"user_id": user_id, "org_id": org_id})
            if not member:
                results["failed"].append({"user_id": user_id, "error": "User not found"})
                continue
            
            update_data = {"updated_at": datetime.now(timezone.utc)}
            
            if action.action == "suspend":
                update_data["status"] = "suspended"
                update_data["suspended_at"] = datetime.now(timezone.utc)
                update_data["suspension_reason"] = action.reason
                activity_type = ActivityType.SUSPENSION
            elif action.action == "activate":
                update_data["status"] = "active"
                update_data["reactivated_at"] = datetime.now(timezone.utc)
                activity_type = ActivityType.REACTIVATION
            elif action.action == "deactivate":
                update_data["status"] = "deactivated"
                update_data["deactivated_at"] = datetime.now(timezone.utc)
                activity_type = ActivityType.SUSPENSION
            else:
                results["failed"].append({"user_id": user_id, "error": "Invalid action"})
                continue
            
            await db.org_members.update_one(
                {"user_id": user_id, "org_id": org_id},
                {"$set": update_data}
            )
            
            # Revoke all sessions for suspended/deactivated users
            if action.action in ["suspend", "deactivate"]:
                await db.user_sessions.update_many(
                    {"user_id": user_id, "status": "active"},
                    {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc)}}
                )
            
            await log_user_activity(db, user_id, org_id, activity_type, {"reason": action.reason})
            results["success"].append(user_id)
            
        except Exception as e:
            results["failed"].append({"user_id": user_id, "error": str(e)})
    
    return results


# ============= ACTIVITY & AUDIT ENDPOINTS =============

@router.get("/{user_id}/activity")
async def get_user_activity(
    request: Request,
    user_id: str,
    org_id: str,
    activity_type: Optional[ActivityType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    """Get user activity history"""
    db = get_db(request)
    
    query = {"user_id": user_id, "org_id": org_id}
    
    if activity_type:
        query["activity_type"] = activity_type.value
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    total = await db.user_activity_logs.count_documents(query)
    skip = (page - 1) * page_size
    
    activities = await db.user_activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)
    
    return {
        "activities": activities,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/activity/all")
async def get_all_user_activity(
    request: Request,
    org_id: str,
    activity_type: Optional[ActivityType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    """Get all user activity for the organization"""
    db = get_db(request)
    
    query = {"org_id": org_id}
    
    if activity_type:
        query["activity_type"] = activity_type.value
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    total = await db.user_activity_logs.count_documents(query)
    skip = (page - 1) * page_size
    
    activities = await db.user_activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)
    
    # Enrich with user names
    for activity in activities:
        user = await db.users.find_one({"id": activity.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        if user:
            activity["user_name"] = user.get("name")
            activity["user_email"] = user.get("email")
    
    return {
        "activities": activities,
        "total": total,
        "page": page,
        "page_size": page_size
    }


# ============= SESSION MANAGEMENT ENDPOINTS =============

@router.get("/{user_id}/sessions")
async def get_user_sessions(request: Request, user_id: str, org_id: str):
    """Get all sessions for a user"""
    db = get_db(request)
    
    sessions = await db.user_sessions.find(
        {"user_id": user_id, "org_id": org_id},
        {"_id": 0, "token_hash": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Mark expired sessions
    now = datetime.now(timezone.utc)
    for session in sessions:
        if session.get("status") == "active" and session.get("expires_at") and session.get("expires_at") < now:
            session["status"] = "expired"
    
    return {"sessions": sessions}


@router.post("/{user_id}/sessions/revoke")
async def revoke_user_sessions(
    request: Request, 
    user_id: str, 
    org_id: str, 
    revoke_request: SessionRevokeRequest
):
    """Revoke specific sessions for a user"""
    db = get_db(request)
    
    result = await db.user_sessions.update_many(
        {"user_id": user_id, "id": {"$in": revoke_request.session_ids}},
        {
            "$set": {
                "status": "revoked",
                "revoked_at": datetime.now(timezone.utc),
                "revoke_reason": revoke_request.reason
            }
        }
    )
    
    await log_user_activity(
        db, user_id, org_id, ActivityType.SESSION_REVOKED,
        {"session_count": result.modified_count, "reason": revoke_request.reason}
    )
    
    return {"message": f"Revoked {result.modified_count} sessions"}


@router.post("/{user_id}/sessions/revoke-all")
async def revoke_all_user_sessions(request: Request, user_id: str, org_id: str, reason: Optional[str] = None):
    """Revoke all active sessions for a user"""
    db = get_db(request)
    
    result = await db.user_sessions.update_many(
        {"user_id": user_id, "status": "active"},
        {
            "$set": {
                "status": "revoked",
                "revoked_at": datetime.now(timezone.utc),
                "revoke_reason": reason or "All sessions revoked"
            }
        }
    )
    
    await log_user_activity(
        db, user_id, org_id, ActivityType.SESSION_REVOKED,
        {"session_count": result.modified_count, "reason": "All sessions revoked"}
    )
    
    return {"message": f"Revoked {result.modified_count} sessions"}


@router.get("/sessions/active")
async def get_all_active_sessions(request: Request, org_id: str):
    """Get all active sessions for the organization"""
    db = get_db(request)
    
    now = datetime.now(timezone.utc)
    sessions = await db.user_sessions.find(
        {
            "org_id": org_id,
            "status": "active",
            "expires_at": {"$gt": now}
        },
        {"_id": 0, "token_hash": 0}
    ).sort("last_activity", -1).to_list(500)
    
    # Enrich with user info
    for session in sessions:
        user = await db.users.find_one({"id": session.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        if user:
            session["user_name"] = user.get("name")
            session["user_email"] = user.get("email")
    
    return {"sessions": sessions, "total": len(sessions)}


# ============= PASSWORD POLICY ENDPOINTS =============

@router.get("/password-policy")
async def get_password_policy(request: Request, org_id: str):
    """Get password policy for the organization"""
    db = get_db(request)
    
    policy = await db.password_policies.find_one({"org_id": org_id}, {"_id": 0})
    
    if not policy:
        # Return default policy
        policy = PasswordPolicyModel().model_dump()
        policy["org_id"] = org_id
        policy["is_default"] = True
    
    return policy


@router.put("/password-policy")
async def update_password_policy(request: Request, org_id: str, policy: PasswordPolicyModel):
    """Update password policy for the organization"""
    db = get_db(request)
    
    policy_data = policy.model_dump()
    policy_data["org_id"] = org_id
    policy_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.password_policies.update_one(
        {"org_id": org_id},
        {"$set": policy_data},
        upsert=True
    )
    
    return {"message": "Password policy updated successfully"}


@router.post("/{user_id}/force-password-reset")
async def force_password_reset(request: Request, user_id: str, org_id: str):
    """Force a user to reset their password on next login"""
    db = get_db(request)
    
    await db.org_members.update_one(
        {"user_id": user_id, "org_id": org_id},
        {"$set": {"force_password_reset": True, "updated_at": datetime.now(timezone.utc)}}
    )
    
    await log_user_activity(
        db, user_id, org_id, ActivityType.PASSWORD_CHANGE,
        {"action": "force_reset_requested"}
    )
    
    return {"message": "Password reset required on next login"}


# ============= LOGIN HISTORY ENDPOINTS =============

@router.get("/{user_id}/login-history")
async def get_login_history(
    request: Request,
    user_id: str,
    org_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    """Get login history for a user"""
    db = get_db(request)
    
    query = {
        "user_id": user_id,
        "org_id": org_id,
        "activity_type": {"$in": ["login", "failed_login", "logout"]}
    }
    
    total = await db.user_activity_logs.count_documents(query)
    skip = (page - 1) * page_size
    
    history = await db.user_activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(page_size).to_list(page_size)
    
    return {
        "history": history,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/login-history/suspicious")
async def get_suspicious_logins(request: Request, org_id: str, hours: int = 24):
    """Get suspicious login activity (multiple failed attempts, unusual locations)"""
    db = get_db(request)
    
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    # Get users with multiple failed login attempts
    pipeline = [
        {
            "$match": {
                "org_id": org_id,
                "activity_type": "failed_login",
                "timestamp": {"$gte": since}
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "failed_count": {"$sum": 1},
                "attempts": {"$push": {
                    "timestamp": "$timestamp",
                    "ip_address": "$ip_address",
                    "user_agent": "$user_agent"
                }}
            }
        },
        {"$match": {"failed_count": {"$gte": 3}}},
        {"$sort": {"failed_count": -1}}
    ]
    
    suspicious = await db.user_activity_logs.aggregate(pipeline).to_list(100)
    
    # Enrich with user info
    for item in suspicious:
        user = await db.users.find_one({"id": item["_id"]}, {"_id": 0, "name": 1, "email": 1})
        if user:
            item["user_name"] = user.get("name")
            item["user_email"] = user.get("email")
    
    return {"suspicious_activity": suspicious, "time_window_hours": hours}
