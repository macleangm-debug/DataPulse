"""DataPulse - Push Notifications Module
Handles Web Push notifications for quality alerts, sync status, and real-time updates.

Features:
- VAPID key management for Web Push
- Push subscription management
- Quality alert notifications
- Sync status notifications
- Batch notification sending
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import json
import os
import hashlib
from dotenv import load_dotenv

# Web Push imports
from pywebpush import webpush, WebPushException
from py_vapid import Vapid

load_dotenv()

router = APIRouter(prefix="/push", tags=["Push Notifications"])

# ============ Models ============

class NotificationType(str, Enum):
    # Sync notifications
    SYNC_COMPLETE = "sync_complete"
    SYNC_FAILED = "sync_failed"
    SYNC_CONFLICT = "sync_conflict"
    
    # Quality alerts
    QUALITY_ISSUE = "quality_issue"
    SPEEDING_DETECTED = "speeding_detected"
    STRAIGHTLINING_DETECTED = "straightlining_detected"
    GPS_ANOMALY = "gps_anomaly"
    DUPLICATE_DETECTED = "duplicate_detected"
    
    # Submission notifications
    NEW_SUBMISSION = "new_submission"
    SUBMISSION_APPROVED = "submission_approved"
    SUBMISSION_REJECTED = "submission_rejected"
    REVISION_REQUIRED = "revision_required"
    
    # Team notifications
    TEAM_MEMBER_JOINED = "team_member_joined"
    ROLE_CHANGED = "role_changed"
    
    # Device notifications
    DEVICE_REGISTERED = "device_registered"
    DEVICE_OFFLINE = "device_offline"
    DEVICE_WIPED = "device_wiped"
    
    # AI notifications
    AI_ANALYSIS_COMPLETE = "ai_analysis_complete"
    AI_SUGGESTION = "ai_suggestion"
    
    # Backcheck notifications
    BACKCHECK_ASSIGNED = "backcheck_assigned"
    BACKCHECK_COMPLETED = "backcheck_completed"
    BACKCHECK_DISCREPANCY = "backcheck_discrepancy"
    
    # System notifications
    SYSTEM_UPDATE = "system_update"
    MAINTENANCE_SCHEDULED = "maintenance_scheduled"


class PushSubscriptionCreate(BaseModel):
    """Push subscription from the browser"""
    endpoint: str
    keys: Dict[str, str]  # p256dh and auth keys
    user_id: str
    org_id: str
    device_id: Optional[str] = None
    preferences: Optional[Dict[str, bool]] = None


class PushNotificationSend(BaseModel):
    """Send a push notification"""
    user_ids: Optional[List[str]] = None  # Specific users
    org_id: Optional[str] = None  # All users in org
    notification_type: NotificationType
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    icon: Optional[str] = "/icons/icon-192x192.png"
    badge: Optional[str] = "/icons/icon-72x72.png"
    tag: Optional[str] = None  # For notification grouping
    require_interaction: bool = False
    actions: Optional[List[Dict[str, str]]] = None  # Notification actions


class QualityAlertTrigger(BaseModel):
    """Trigger a quality alert notification"""
    org_id: str
    submission_id: str
    enumerator_id: Optional[str] = None
    alert_type: NotificationType
    severity: str = "medium"  # low, medium, high, critical
    details: Dict[str, Any]


# ============ VAPID Key Management ============

async def get_or_create_vapid_keys(db):
    """Get existing VAPID keys or create new ones"""
    # Check if keys exist in database
    keys_doc = await db.settings.find_one({"type": "vapid_keys"})
    
    if keys_doc:
        return {
            "public_key": keys_doc["public_key"],
            "private_key": keys_doc["private_key"],
            "subject": keys_doc["subject"]
        }
    
    # Generate new VAPID keys
    vapid = Vapid()
    vapid.generate_keys()
    
    # Get the keys in the correct format
    private_key = vapid.private_key
    
    # Convert to base64url format
    private_key_b64 = vapid.private_pem().decode('utf-8') if hasattr(vapid, 'private_pem') else str(private_key)
    
    # Get public key in applicationServerKey format
    public_key_b64 = vapid.public_key_urlsafe_base64()
    
    # Store in database
    keys_doc = {
        "type": "vapid_keys",
        "public_key": public_key_b64,
        "private_key": private_key_b64,
        "subject": "mailto:notifications@datapulse.io",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.settings.insert_one(keys_doc)
    
    return {
        "public_key": public_key_b64,
        "private_key": private_key_b64,
        "subject": "mailto:notifications@datapulse.io"
    }


@router.get("/vapid-public-key")
async def get_vapid_public_key(request: Request):
    """Get the VAPID public key for push subscription"""
    db = request.app.state.db
    
    vapid_keys = await get_or_create_vapid_keys(db)
    
    return {
        "public_key": vapid_keys["public_key"]
    }


# ============ Subscription Management ============

@router.post("/subscribe")
async def subscribe_to_push(
    request: Request,
    subscription: PushSubscriptionCreate
):
    """Subscribe a device to push notifications"""
    db = request.app.state.db
    
    # Hash the endpoint for lookup
    endpoint_hash = hashlib.sha256(subscription.endpoint.encode()).hexdigest()
    
    # Check if subscription already exists
    existing = await db.push_subscriptions.find_one({
        "endpoint_hash": endpoint_hash,
        "user_id": subscription.user_id
    })
    
    if existing:
        # Update existing subscription
        await db.push_subscriptions.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "endpoint": subscription.endpoint,
                    "keys": subscription.keys,
                    "preferences": subscription.preferences or existing.get("preferences", {}),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"message": "Subscription updated", "subscription_id": str(existing["_id"])}
    
    # Create new subscription
    sub_doc = {
        "endpoint": subscription.endpoint,
        "endpoint_hash": endpoint_hash,
        "keys": subscription.keys,
        "user_id": subscription.user_id,
        "org_id": subscription.org_id,
        "device_id": subscription.device_id,
        "preferences": subscription.preferences or {
            "sync": True,
            "quality": True,
            "submissions": True,
            "team": True,
            "devices": True,
            "ai": True,
            "backcheck": True,
            "system": False
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
        "is_active": True
    }
    
    result = await db.push_subscriptions.insert_one(sub_doc)
    
    return {
        "message": "Subscribed successfully",
        "subscription_id": str(result.inserted_id)
    }


@router.delete("/unsubscribe")
async def unsubscribe_from_push(
    request: Request,
    endpoint: str,
    user_id: str
):
    """Unsubscribe a device from push notifications"""
    db = request.app.state.db
    
    endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()
    
    result = db.push_subscriptions.delete_one({
        "endpoint_hash": endpoint_hash,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    return {"message": "Unsubscribed successfully"}


@router.get("/subscriptions/{user_id}")
async def get_user_subscriptions(
    request: Request,
    user_id: str
):
    """Get all push subscriptions for a user"""
    db = request.app.state.db
    
    subscriptions = list(db.push_subscriptions.find(
        {"user_id": user_id, "is_active": True},
        {"_id": 0, "endpoint": 0, "keys": 0}  # Don't expose sensitive data
    ))
    
    return {"subscriptions": subscriptions, "count": len(subscriptions)}


@router.put("/subscriptions/{user_id}/preferences")
async def update_notification_preferences(
    request: Request,
    user_id: str,
    preferences: Dict[str, bool]
):
    """Update notification preferences for a user"""
    db = request.app.state.db
    
    result = db.push_subscriptions.update_many(
        {"user_id": user_id},
        {"$set": {"preferences": preferences}}
    )
    
    return {
        "message": "Preferences updated",
        "updated_count": result.modified_count
    }


# ============ Send Notifications ============

async def send_push_notification(
    db,
    subscription: Dict,
    notification: Dict,
    vapid_keys: Dict
) -> bool:
    """Send a push notification to a single subscription"""
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": subscription["keys"]
            },
            data=json.dumps(notification),
            vapid_private_key=vapid_keys["private_key"],
            vapid_claims={
                "sub": vapid_keys["subject"]
            }
        )
        
        # Update last_used timestamp
        db.push_subscriptions.update_one(
            {"endpoint_hash": subscription.get("endpoint_hash")},
            {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
        )
        
        return True
        
    except WebPushException as e:
        # Handle subscription expiry
        if e.response and e.response.status_code in [404, 410]:
            # Subscription expired, mark as inactive
            db.push_subscriptions.update_one(
                {"endpoint_hash": subscription.get("endpoint_hash")},
                {"$set": {"is_active": False}}
            )
        return False
    except Exception as e:
        print(f"Push notification error: {e}")
        return False


def get_category_from_type(notification_type: NotificationType) -> str:
    """Map notification type to category"""
    type_to_category = {
        NotificationType.SYNC_COMPLETE: "sync",
        NotificationType.SYNC_FAILED: "sync",
        NotificationType.SYNC_CONFLICT: "sync",
        NotificationType.QUALITY_ISSUE: "quality",
        NotificationType.SPEEDING_DETECTED: "quality",
        NotificationType.STRAIGHTLINING_DETECTED: "quality",
        NotificationType.GPS_ANOMALY: "quality",
        NotificationType.DUPLICATE_DETECTED: "quality",
        NotificationType.NEW_SUBMISSION: "submissions",
        NotificationType.SUBMISSION_APPROVED: "submissions",
        NotificationType.SUBMISSION_REJECTED: "submissions",
        NotificationType.REVISION_REQUIRED: "submissions",
        NotificationType.TEAM_MEMBER_JOINED: "team",
        NotificationType.ROLE_CHANGED: "team",
        NotificationType.DEVICE_REGISTERED: "devices",
        NotificationType.DEVICE_OFFLINE: "devices",
        NotificationType.DEVICE_WIPED: "devices",
        NotificationType.AI_ANALYSIS_COMPLETE: "ai",
        NotificationType.AI_SUGGESTION: "ai",
        NotificationType.BACKCHECK_ASSIGNED: "backcheck",
        NotificationType.BACKCHECK_COMPLETED: "backcheck",
        NotificationType.BACKCHECK_DISCREPANCY: "backcheck",
        NotificationType.SYSTEM_UPDATE: "system",
        NotificationType.MAINTENANCE_SCHEDULED: "system",
    }
    return type_to_category.get(notification_type, "system")


@router.post("/send")
async def send_notification(
    request: Request,
    background_tasks: BackgroundTasks,
    notification: PushNotificationSend
):
    """Send push notifications to users"""
    db = request.app.state.db
    
    # Get VAPID keys
    vapid_keys = get_or_create_vapid_keys(db)
    
    # Build query for subscriptions
    query = {"is_active": True}
    
    if notification.user_ids:
        query["user_id"] = {"$in": notification.user_ids}
    elif notification.org_id:
        query["org_id"] = notification.org_id
    else:
        raise HTTPException(status_code=400, detail="Must specify user_ids or org_id")
    
    # Get category for preference checking
    category = get_category_from_type(notification.notification_type)
    
    # Filter by preferences
    query[f"preferences.{category}"] = {"$ne": False}
    
    subscriptions = list(db.push_subscriptions.find(query))
    
    if not subscriptions:
        return {
            "message": "No active subscriptions found",
            "sent_count": 0,
            "failed_count": 0
        }
    
    # Build notification payload
    payload = {
        "title": notification.title,
        "body": notification.body,
        "icon": notification.icon,
        "badge": notification.badge,
        "tag": notification.tag or notification.notification_type.value,
        "requireInteraction": notification.require_interaction,
        "data": {
            "type": notification.notification_type.value,
            "category": category,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **(notification.data or {})
        }
    }
    
    if notification.actions:
        payload["actions"] = notification.actions
    
    # Send notifications
    sent_count = 0
    failed_count = 0
    
    for sub in subscriptions:
        success = await send_push_notification(db, sub, payload, vapid_keys)
        if success:
            sent_count += 1
        else:
            failed_count += 1
    
    # Log notification
    db.notification_logs.insert_one({
        "notification_type": notification.notification_type.value,
        "title": notification.title,
        "body": notification.body,
        "user_ids": notification.user_ids,
        "org_id": notification.org_id,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "sent_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Notifications sent",
        "sent_count": sent_count,
        "failed_count": failed_count
    }


# ============ Quality Alert Triggers ============

@router.post("/trigger/quality-alert")
async def trigger_quality_alert(
    request: Request,
    background_tasks: BackgroundTasks,
    alert: QualityAlertTrigger
):
    """Trigger a quality alert notification"""
    db = request.app.state.db
    
    # Get VAPID keys
    vapid_keys = get_or_create_vapid_keys(db)
    
    # Build notification based on alert type
    title_map = {
        NotificationType.SPEEDING_DETECTED: "Interview Speeding Detected",
        NotificationType.STRAIGHTLINING_DETECTED: "Straight-lining Pattern Detected",
        NotificationType.GPS_ANOMALY: "GPS Anomaly Detected",
        NotificationType.DUPLICATE_DETECTED: "Duplicate Submission Detected",
        NotificationType.QUALITY_ISSUE: "Quality Issue Detected"
    }
    
    severity_emoji = {
        "low": "",
        "medium": "",
        "high": "",
        "critical": ""
    }
    
    title = f"{severity_emoji.get(alert.severity, '')} {title_map.get(alert.alert_type, 'Quality Alert')}"
    body = alert.details.get("message", f"Submission {alert.submission_id} flagged for review")
    
    # Get supervisors and admins for the org
    query = {
        "is_active": True,
        "org_id": alert.org_id,
        "preferences.quality": {"$ne": False}
    }
    
    # If enumerator specified, also notify them
    if alert.enumerator_id:
        query["$or"] = [
            {"user_id": alert.enumerator_id},
            {"org_id": alert.org_id}  # All org members
        ]
    
    subscriptions = list(db.push_subscriptions.find(query))
    
    payload = {
        "title": title.strip(),
        "body": body,
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-72x72.png",
        "tag": f"quality-{alert.submission_id}",
        "requireInteraction": alert.severity in ["high", "critical"],
        "data": {
            "type": alert.alert_type.value,
            "category": "quality",
            "submission_id": alert.submission_id,
            "severity": alert.severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_url": f"/quality/review/{alert.submission_id}",
            **alert.details
        },
        "actions": [
            {"action": "review", "title": "Review Now"},
            {"action": "dismiss", "title": "Dismiss"}
        ]
    }
    
    # Send notifications
    sent_count = 0
    for sub in subscriptions:
        if await send_push_notification(db, sub, payload, vapid_keys):
            sent_count += 1
    
    # Store alert in database
    db.quality_alerts.insert_one({
        "org_id": alert.org_id,
        "submission_id": alert.submission_id,
        "enumerator_id": alert.enumerator_id,
        "alert_type": alert.alert_type.value,
        "severity": alert.severity,
        "details": alert.details,
        "notifications_sent": sent_count,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending",  # pending, reviewed, dismissed
        "reviewed_by": None,
        "reviewed_at": None
    })
    
    return {
        "message": "Quality alert triggered",
        "notifications_sent": sent_count,
        "alert_type": alert.alert_type.value,
        "severity": alert.severity
    }


# ============ Convenience Functions for Quality Alerts ============

async def notify_speeding(
    db,
    org_id: str,
    submission_id: str,
    enumerator_id: str,
    completion_time: int,
    expected_time: int,
    threshold_type: str = "warning"
):
    """Helper function to send speeding notification"""
    vapid_keys = get_or_create_vapid_keys(db)
    
    severity = "high" if threshold_type == "critical" else "medium"
    percent = round((completion_time / expected_time) * 100)
    
    payload = {
        "title": f"Interview Speeding ({percent}% of expected time)",
        "body": f"Submission completed in {completion_time}s (expected: {expected_time}s)",
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-72x72.png",
        "tag": f"speeding-{submission_id}",
        "requireInteraction": severity == "high",
        "data": {
            "type": "speeding_detected",
            "category": "quality",
            "submission_id": submission_id,
            "enumerator_id": enumerator_id,
            "completion_time": completion_time,
            "expected_time": expected_time,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    
    subscriptions = list(db.push_subscriptions.find({
        "org_id": org_id,
        "is_active": True,
        "preferences.quality": {"$ne": False}
    }))
    
    sent_count = 0
    for sub in subscriptions:
        if await send_push_notification(db, sub, payload, vapid_keys):
            sent_count += 1
    
    return sent_count


async def notify_gps_anomaly(
    db,
    org_id: str,
    submission_id: str,
    enumerator_id: str,
    anomaly_details: Dict
):
    """Helper function to send GPS anomaly notification"""
    vapid_keys = get_or_create_vapid_keys(db)
    
    payload = {
        "title": "GPS Anomaly Detected",
        "body": anomaly_details.get("message", "Suspicious location detected"),
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-72x72.png",
        "tag": f"gps-{submission_id}",
        "requireInteraction": True,
        "data": {
            "type": "gps_anomaly",
            "category": "quality",
            "submission_id": submission_id,
            "enumerator_id": enumerator_id,
            "severity": "high",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **anomaly_details
        }
    }
    
    subscriptions = list(db.push_subscriptions.find({
        "org_id": org_id,
        "is_active": True,
        "preferences.quality": {"$ne": False}
    }))
    
    sent_count = 0
    for sub in subscriptions:
        if await send_push_notification(db, sub, payload, vapid_keys):
            sent_count += 1
    
    return sent_count


async def notify_straightlining(
    db,
    org_id: str,
    submission_id: str,
    enumerator_id: str,
    pattern_details: Dict
):
    """Helper function to send straight-lining notification"""
    vapid_keys = get_or_create_vapid_keys(db)
    
    payload = {
        "title": "Straight-lining Pattern Detected",
        "body": f"{pattern_details.get('affected_questions', 0)} questions with identical responses",
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-72x72.png",
        "tag": f"straightline-{submission_id}",
        "requireInteraction": False,
        "data": {
            "type": "straightlining_detected",
            "category": "quality",
            "submission_id": submission_id,
            "enumerator_id": enumerator_id,
            "severity": "medium",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **pattern_details
        }
    }
    
    subscriptions = list(db.push_subscriptions.find({
        "org_id": org_id,
        "is_active": True,
        "preferences.quality": {"$ne": False}
    }))
    
    sent_count = 0
    for sub in subscriptions:
        if await send_push_notification(db, sub, payload, vapid_keys):
            sent_count += 1
    
    return sent_count


# ============ Test Endpoint ============

@router.post("/test")
async def send_test_notification(
    request: Request,
    user_id: str
):
    """Send a test notification to verify push is working"""
    db = request.app.state.db
    
    vapid_keys = get_or_create_vapid_keys(db)
    
    subscriptions = list(db.push_subscriptions.find({
        "user_id": user_id,
        "is_active": True
    }))
    
    if not subscriptions:
        raise HTTPException(status_code=404, detail="No active subscriptions found")
    
    payload = {
        "title": "Test Notification",
        "body": "If you see this, push notifications are working!",
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/icon-72x72.png",
        "tag": "test-notification",
        "data": {
            "type": "system_update",
            "category": "system",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "test": True
        }
    }
    
    sent_count = 0
    for sub in subscriptions:
        if await send_push_notification(db, sub, payload, vapid_keys):
            sent_count += 1
    
    return {
        "message": "Test notification sent",
        "sent_count": sent_count,
        "total_subscriptions": len(subscriptions)
    }


# ============ Notification History ============

@router.get("/history/{org_id}")
async def get_notification_history(
    request: Request,
    org_id: str,
    limit: int = 50,
    notification_type: Optional[str] = None
):
    """Get notification history for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if notification_type:
        query["notification_type"] = notification_type
    
    logs = list(db.notification_logs.find(
        query,
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit))
    
    return {"logs": logs, "count": len(logs)}


@router.get("/alerts/{org_id}")
async def get_quality_alerts(
    request: Request,
    org_id: str,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get quality alerts for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    
    alerts = list(db.quality_alerts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit))
    
    return {"alerts": alerts, "count": len(alerts)}


@router.put("/alerts/{org_id}/{submission_id}/status")
async def update_alert_status(
    request: Request,
    org_id: str,
    submission_id: str,
    status: str,
    reviewed_by: str
):
    """Update quality alert status"""
    db = request.app.state.db
    
    if status not in ["pending", "reviewed", "dismissed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = db.quality_alerts.update_one(
        {"org_id": org_id, "submission_id": submission_id},
        {
            "$set": {
                "status": status,
                "reviewed_by": reviewed_by,
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert status updated"}
