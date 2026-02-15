"""DataPulse - Device Management & Remote Wipe Module
Enterprise-grade device control for field data collection.

Features:
- Device registration and tracking
- Remote device lock/unlock
- Remote data wipe
- Device revocation
- Activity monitoring
- Session management
"""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import secrets
import hashlib

router = APIRouter(prefix="/devices", tags=["Device Management"])


class DeviceStatus(str, Enum):
    ACTIVE = "active"
    LOCKED = "locked"
    WIPED = "wiped"
    REVOKED = "revoked"
    PENDING_WIPE = "pending_wipe"
    PENDING_LOCK = "pending_lock"


class DeviceType(str, Enum):
    MOBILE = "mobile"
    TABLET = "tablet"
    DESKTOP = "desktop"
    PWA = "pwa"
    WEB = "web"


class DeviceRegister(BaseModel):
    device_name: Optional[str] = None
    device_type: DeviceType = DeviceType.PWA
    os_name: Optional[str] = None
    os_version: Optional[str] = None
    app_version: Optional[str] = None
    push_token: Optional[str] = None


class DeviceUpdate(BaseModel):
    device_name: Optional[str] = None
    push_token: Optional[str] = None
    app_version: Optional[str] = None


class WipeRequest(BaseModel):
    reason: str
    wipe_type: str = "full"  # "full" or "submissions_only"
    notify_user: bool = True


class LockRequest(BaseModel):
    reason: str
    unlock_code: Optional[str] = None  # If provided, user can unlock with this code


# ============ Device Registration ============

@router.post("/register")
async def register_device(
    request: Request,
    device: DeviceRegister,
    x_user_id: str = Header(...),
    x_org_id: str = Header(...)
):
    """Register a new device for the user"""
    db = request.app.state.db
    
    # Generate unique device ID
    device_id = f"dev_{secrets.token_hex(16)}"
    
    # Create device record
    device_doc = {
        "id": device_id,
        "user_id": x_user_id,
        "org_id": x_org_id,
        "device_name": device.device_name or f"Device {device_id[:8]}",
        "device_type": device.device_type,
        "os_name": device.os_name,
        "os_version": device.os_version,
        "app_version": device.app_version,
        "push_token": device.push_token,
        "status": DeviceStatus.ACTIVE,
        "pending_actions": [],
        "last_sync": None,
        "last_seen": datetime.now(timezone.utc),
        "registered_at": datetime.now(timezone.utc),
        "metadata": {}
    }
    
    await db.devices.insert_one(device_doc)
    
    # Log registration
    await log_device_activity(db, device_id, x_org_id, "registered", {
        "user_id": x_user_id,
        "device_type": device.device_type
    })
    
    return {
        "device_id": device_id,
        "status": "active",
        "message": "Device registered successfully"
    }


@router.get("/my-devices")
async def get_my_devices(
    request: Request,
    x_user_id: str = Header(...),
    x_org_id: str = Header(...)
):
    """Get all devices for the current user"""
    db = request.app.state.db
    
    devices = await db.devices.find({
        "user_id": x_user_id,
        "org_id": x_org_id,
        "status": {"$ne": DeviceStatus.REVOKED}
    }).to_list(50)
    
    for d in devices:
        d["_id"] = str(d.get("_id", ""))
        if d.get("registered_at"):
            d["registered_at"] = d["registered_at"].isoformat()
        if d.get("last_seen"):
            d["last_seen"] = d["last_seen"].isoformat()
    
    return devices


@router.get("/{org_id}")
async def list_org_devices(
    request: Request,
    org_id: str,
    status: Optional[str] = None,
    user_id: Optional[str] = None
):
    """List all devices for an organization (admin only)"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    
    devices = await db.devices.find(query).to_list(200)
    
    for d in devices:
        d["_id"] = str(d.get("_id", ""))
        if d.get("registered_at"):
            d["registered_at"] = d["registered_at"].isoformat()
        if d.get("last_seen"):
            d["last_seen"] = d["last_seen"].isoformat()
    
    return devices


# ============ Device Status Check (called by client) ============

@router.get("/check/{device_id}")
async def check_device_status(
    request: Request,
    device_id: str
):
    """
    Check device status and pending actions.
    Called by client app on startup and periodically.
    """
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Update last seen
    await db.devices.update_one(
        {"id": device_id},
        {"$set": {"last_seen": datetime.now(timezone.utc)}}
    )
    
    # Build response with pending actions
    response = {
        "device_id": device_id,
        "status": device["status"],
        "pending_actions": device.get("pending_actions", [])
    }
    
    # Add wipe instruction if pending
    if device["status"] == DeviceStatus.PENDING_WIPE:
        response["action_required"] = "wipe"
        response["wipe_config"] = device.get("wipe_config", {"type": "full"})
    
    # Add lock instruction if pending
    elif device["status"] == DeviceStatus.PENDING_LOCK:
        response["action_required"] = "lock"
        response["lock_message"] = device.get("lock_message", "This device has been locked by your administrator.")
    
    # Check if revoked
    elif device["status"] == DeviceStatus.REVOKED:
        response["action_required"] = "logout"
        response["revoke_message"] = "This device has been revoked. Please contact your administrator."
    
    return response


@router.post("/heartbeat/{device_id}")
async def device_heartbeat(
    request: Request,
    device_id: str,
    x_user_id: str = Header(...)
):
    """
    Device heartbeat - update last seen and report status.
    Returns any pending commands.
    """
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id, "user_id": x_user_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Update last seen and clear processed actions
    await db.devices.update_one(
        {"id": device_id},
        {
            "$set": {"last_seen": datetime.now(timezone.utc)},
        }
    )
    
    # Return pending actions
    return {
        "status": device["status"],
        "pending_actions": device.get("pending_actions", []),
        "should_wipe": device["status"] == DeviceStatus.PENDING_WIPE,
        "should_lock": device["status"] == DeviceStatus.PENDING_LOCK,
        "is_revoked": device["status"] == DeviceStatus.REVOKED
    }


# ============ Remote Wipe ============

@router.post("/{device_id}/wipe")
async def initiate_remote_wipe(
    request: Request,
    device_id: str,
    wipe_request: WipeRequest,
    x_admin_id: str = Header(...)
):
    """Initiate remote wipe for a device (admin only)"""
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Update device status
    wipe_config = {
        "type": wipe_request.wipe_type,
        "initiated_by": x_admin_id,
        "initiated_at": datetime.now(timezone.utc).isoformat(),
        "reason": wipe_request.reason
    }
    
    await db.devices.update_one(
        {"id": device_id},
        {
            "$set": {
                "status": DeviceStatus.PENDING_WIPE,
                "wipe_config": wipe_config
            },
            "$push": {
                "pending_actions": {
                    "action": "wipe",
                    "config": wipe_config,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    # Log activity
    await log_device_activity(db, device_id, device["org_id"], "wipe_initiated", {
        "admin_id": x_admin_id,
        "reason": wipe_request.reason,
        "wipe_type": wipe_request.wipe_type
    })
    
    # TODO: Send push notification if notify_user is True
    
    return {
        "message": "Remote wipe initiated",
        "device_id": device_id,
        "status": "pending_wipe",
        "note": "Device will be wiped on next connection"
    }


@router.post("/{device_id}/confirm-wipe")
async def confirm_wipe_completed(
    request: Request,
    device_id: str
):
    """Confirm that device wipe has been completed (called by client)"""
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await db.devices.update_one(
        {"id": device_id},
        {
            "$set": {
                "status": DeviceStatus.WIPED,
                "wiped_at": datetime.now(timezone.utc),
                "pending_actions": []
            }
        }
    )
    
    await log_device_activity(db, device_id, device["org_id"], "wipe_completed", {})
    
    return {"message": "Wipe confirmed", "status": "wiped"}


# ============ Remote Lock ============

@router.post("/{device_id}/lock")
async def lock_device(
    request: Request,
    device_id: str,
    lock_request: LockRequest,
    x_admin_id: str = Header(...)
):
    """Lock a device remotely (admin only)"""
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Generate unlock code if not provided
    unlock_code = lock_request.unlock_code or secrets.token_hex(4).upper()
    unlock_code_hash = hashlib.sha256(unlock_code.encode()).hexdigest()
    
    await db.devices.update_one(
        {"id": device_id},
        {
            "$set": {
                "status": DeviceStatus.PENDING_LOCK,
                "lock_message": lock_request.reason,
                "unlock_code_hash": unlock_code_hash
            },
            "$push": {
                "pending_actions": {
                    "action": "lock",
                    "reason": lock_request.reason,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    await log_device_activity(db, device_id, device["org_id"], "lock_initiated", {
        "admin_id": x_admin_id,
        "reason": lock_request.reason
    })
    
    return {
        "message": "Device lock initiated",
        "device_id": device_id,
        "unlock_code": unlock_code,  # Return to admin for sharing with user
        "note": "Share the unlock code with the user if they need to unlock"
    }


@router.post("/{device_id}/unlock")
async def unlock_device(
    request: Request,
    device_id: str,
    unlock_code: str = None,
    x_admin_id: str = Header(None)
):
    """Unlock a device (admin or user with code)"""
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device["status"] not in [DeviceStatus.LOCKED, DeviceStatus.PENDING_LOCK]:
        return {"message": "Device is not locked", "status": device["status"]}
    
    # Admin can unlock without code
    if x_admin_id:
        authorized = True
    elif unlock_code:
        # Verify unlock code
        code_hash = hashlib.sha256(unlock_code.encode()).hexdigest()
        authorized = code_hash == device.get("unlock_code_hash")
    else:
        authorized = False
    
    if not authorized:
        raise HTTPException(status_code=403, detail="Invalid unlock code")
    
    await db.devices.update_one(
        {"id": device_id},
        {
            "$set": {
                "status": DeviceStatus.ACTIVE,
                "pending_actions": []
            },
            "$unset": {
                "lock_message": "",
                "unlock_code_hash": ""
            }
        }
    )
    
    await log_device_activity(db, device_id, device["org_id"], "unlocked", {
        "by_admin": bool(x_admin_id),
        "admin_id": x_admin_id
    })
    
    return {"message": "Device unlocked", "status": "active"}


# ============ Device Revocation ============

@router.post("/{device_id}/revoke")
async def revoke_device(
    request: Request,
    device_id: str,
    reason: str,
    x_admin_id: str = Header(...)
):
    """Permanently revoke device access (admin only)"""
    db = request.app.state.db
    
    device = await db.devices.find_one({"id": device_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    await db.devices.update_one(
        {"id": device_id},
        {
            "$set": {
                "status": DeviceStatus.REVOKED,
                "revoked_at": datetime.now(timezone.utc),
                "revoke_reason": reason,
                "revoked_by": x_admin_id
            }
        }
    )
    
    # Invalidate any sessions for this device
    await db.sessions.update_many(
        {"device_id": device_id},
        {"$set": {"is_valid": False, "revoked_at": datetime.now(timezone.utc)}}
    )
    
    await log_device_activity(db, device_id, device["org_id"], "revoked", {
        "admin_id": x_admin_id,
        "reason": reason
    })
    
    return {"message": "Device revoked", "status": "revoked"}


# ============ Activity Logging ============

async def log_device_activity(db, device_id: str, org_id: str, action: str, details: Dict):
    """Log device activity for audit trail"""
    log_entry = {
        "device_id": device_id,
        "org_id": org_id,
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc)
    }
    await db.device_activity_logs.insert_one(log_entry)


@router.get("/{device_id}/activity")
async def get_device_activity(
    request: Request,
    device_id: str,
    limit: int = 50
):
    """Get activity log for a device"""
    db = request.app.state.db
    
    logs = await db.device_activity_logs.find(
        {"device_id": device_id}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log["_id"] = str(log.get("_id", ""))
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return logs


# ============ Bulk Operations ============

@router.post("/{org_id}/bulk-wipe")
async def bulk_wipe_devices(
    request: Request,
    org_id: str,
    device_ids: List[str],
    reason: str,
    x_admin_id: str = Header(...)
):
    """Initiate remote wipe for multiple devices"""
    db = request.app.state.db
    
    wipe_config = {
        "type": "full",
        "initiated_by": x_admin_id,
        "initiated_at": datetime.now(timezone.utc).isoformat(),
        "reason": reason
    }
    
    result = await db.devices.update_many(
        {"id": {"$in": device_ids}, "org_id": org_id},
        {
            "$set": {
                "status": DeviceStatus.PENDING_WIPE,
                "wipe_config": wipe_config
            },
            "$push": {
                "pending_actions": {
                    "action": "wipe",
                    "config": wipe_config,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    return {
        "message": f"Wipe initiated for {result.modified_count} devices",
        "devices_affected": result.modified_count
    }


@router.get("/{org_id}/stats")
async def get_device_stats(
    request: Request,
    org_id: str
):
    """Get device statistics for organization"""
    db = request.app.state.db
    
    # Count by status
    pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    status_counts = await db.devices.aggregate(pipeline).to_list(10)
    
    # Count by type
    type_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
    ]
    
    type_counts = await db.devices.aggregate(type_pipeline).to_list(10)
    
    # Active in last 24 hours
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
    active_24h = await db.devices.count_documents({
        "org_id": org_id,
        "last_seen": {"$gte": yesterday}
    })
    
    return {
        "by_status": {item["_id"]: item["count"] for item in status_counts},
        "by_type": {item["_id"]: item["count"] for item in type_counts},
        "active_last_24h": active_24h,
        "total_devices": sum(item["count"] for item in status_counts)
    }
