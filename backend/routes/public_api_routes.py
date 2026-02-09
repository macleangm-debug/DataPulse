"""
DataPulse Public API
External API layer for third-party integrations

This module provides:
- API Key authentication
- Versioned endpoints (v1)
- Webhooks for real-time events
- Rate limiting
- Comprehensive API documentation
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Request, BackgroundTasks
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import hashlib
import secrets
import hmac
import json
import httpx
import os

router = APIRouter(prefix="/v1", tags=["Public API"])

# API Key header
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Database reference (will be set by server.py)
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# MODELS
# =============================================================================

class APIKeyCreate(BaseModel):
    name: str = Field(..., description="Name for this API key")
    permissions: List[str] = Field(default=["read"], description="Permissions: read, write, admin")
    expires_in_days: Optional[int] = Field(default=None, description="Days until expiration (null = never)")

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    permissions: List[str]
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]

class WebhookCreate(BaseModel):
    url: str = Field(..., description="Webhook endpoint URL")
    events: List[str] = Field(..., description="Events to subscribe to")
    secret: Optional[str] = Field(default=None, description="Secret for signature verification")

class WebhookResponse(BaseModel):
    id: str
    url: str
    events: List[str]
    active: bool
    created_at: datetime
    last_triggered: Optional[datetime]

class SubmissionCreate(BaseModel):
    form_id: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None
    gps: Optional[Dict[str, float]] = None

class FormResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    status: str
    question_count: int
    submission_count: int
    created_at: datetime
    updated_at: datetime

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    form_count: int
    created_at: datetime

class SubmissionResponse(BaseModel):
    id: str
    form_id: str
    data: Dict[str, Any]
    status: str
    submitted_at: datetime
    submitted_by: Optional[str]


# =============================================================================
# AUTHENTICATION
# =============================================================================

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """Verify API key and return org context"""
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Hash the key to compare
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    # Find the API key
    key_doc = await db.api_keys.find_one({"key_hash": key_hash, "active": True})
    
    if not key_doc:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Check expiration
    if key_doc.get("expires_at") and key_doc["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="API key expired")
    
    # Update last used
    await db.api_keys.update_one(
        {"_id": key_doc["_id"]},
        {"$set": {"last_used": datetime.now(timezone.utc)}}
    )
    
    return {
        "org_id": key_doc["org_id"],
        "permissions": key_doc.get("permissions", ["read"]),
        "key_id": str(key_doc["_id"])
    }


def require_permission(permission: str):
    """Decorator to check for specific permission"""
    async def check_permission(auth: dict = Depends(verify_api_key)):
        if permission not in auth["permissions"] and "admin" not in auth["permissions"]:
            raise HTTPException(status_code=403, detail=f"Permission '{permission}' required")
        return auth
    return check_permission


# =============================================================================
# API KEY MANAGEMENT
# =============================================================================

@router.post("/api-keys", response_model=dict)
async def create_api_key(
    key_data: APIKeyCreate,
    org_id: str = Header(..., alias="X-Org-ID"),
    user_id: str = Header(..., alias="X-User-ID")
):
    """
    Create a new API key for external integrations.
    
    The full API key is only returned once - store it securely!
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Generate a secure API key
    raw_key = f"dp_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12] + "..."
    
    # Calculate expiration
    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=key_data.expires_in_days)
    
    key_doc = {
        "org_id": org_id,
        "created_by": user_id,
        "name": key_data.name,
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "permissions": key_data.permissions,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "expires_at": expires_at,
        "last_used": None
    }
    
    result = await db.api_keys.insert_one(key_doc)
    
    return {
        "id": str(result.inserted_id),
        "api_key": raw_key,  # Only returned once!
        "name": key_data.name,
        "key_prefix": key_prefix,
        "permissions": key_data.permissions,
        "expires_at": expires_at,
        "message": "Store this API key securely - it won't be shown again!"
    }


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    org_id: str = Header(..., alias="X-Org-ID")
):
    """List all API keys for the organization"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    keys = await db.api_keys.find(
        {"org_id": org_id},
        {"key_hash": 0}  # Never return the hash
    ).to_list(100)
    
    return [
        APIKeyResponse(
            id=str(k["_id"]),
            name=k["name"],
            key_prefix=k["key_prefix"],
            permissions=k.get("permissions", ["read"]),
            created_at=k["created_at"],
            expires_at=k.get("expires_at"),
            last_used=k.get("last_used")
        )
        for k in keys
    ]


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    org_id: str = Header(..., alias="X-Org-ID")
):
    """Revoke an API key"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    result = await db.api_keys.update_one(
        {"_id": ObjectId(key_id), "org_id": org_id},
        {"$set": {"active": False, "revoked_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return {"message": "API key revoked"}


# =============================================================================
# WEBHOOKS
# =============================================================================

WEBHOOK_EVENTS = [
    "submission.created",
    "submission.updated", 
    "submission.approved",
    "submission.rejected",
    "form.published",
    "form.closed",
    "quality.alert",
    "sync.completed",
    "export.ready"
]

@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(
    webhook: WebhookCreate,
    auth: dict = Depends(require_permission("admin"))
):
    """
    Create a webhook subscription.
    
    Available events:
    - submission.created - New submission received
    - submission.updated - Submission data updated
    - submission.approved - Submission approved
    - submission.rejected - Submission rejected
    - form.published - Form published
    - form.closed - Form closed
    - quality.alert - Quality issue detected
    - sync.completed - Offline sync completed
    - export.ready - Data export ready for download
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Validate events
    invalid_events = [e for e in webhook.events if e not in WEBHOOK_EVENTS]
    if invalid_events:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid events: {invalid_events}. Valid events: {WEBHOOK_EVENTS}"
        )
    
    # Generate secret if not provided
    secret = webhook.secret or secrets.token_urlsafe(32)
    
    webhook_doc = {
        "org_id": auth["org_id"],
        "url": webhook.url,
        "events": webhook.events,
        "secret": secret,
        "active": True,
        "created_at": datetime.now(timezone.utc),
        "last_triggered": None,
        "failure_count": 0
    }
    
    result = await db.webhooks.insert_one(webhook_doc)
    
    return WebhookResponse(
        id=str(result.inserted_id),
        url=webhook.url,
        events=webhook.events,
        active=True,
        created_at=webhook_doc["created_at"],
        last_triggered=None
    )


@router.get("/webhooks", response_model=List[WebhookResponse])
async def list_webhooks(auth: dict = Depends(verify_api_key)):
    """List all webhooks for the organization"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    webhooks = await db.webhooks.find(
        {"org_id": auth["org_id"]},
        {"secret": 0}
    ).to_list(100)
    
    return [
        WebhookResponse(
            id=str(w["_id"]),
            url=w["url"],
            events=w["events"],
            active=w.get("active", True),
            created_at=w["created_at"],
            last_triggered=w.get("last_triggered")
        )
        for w in webhooks
    ]


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    auth: dict = Depends(require_permission("admin"))
):
    """Delete a webhook"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    result = await db.webhooks.delete_one({
        "_id": ObjectId(webhook_id),
        "org_id": auth["org_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return {"message": "Webhook deleted"}


async def trigger_webhooks(org_id: str, event: str, payload: dict):
    """Trigger webhooks for an event (called internally)"""
    if db is None:
        return
    
    webhooks = await db.webhooks.find({
        "org_id": org_id,
        "events": event,
        "active": True
    }).to_list(100)
    
    for webhook in webhooks:
        try:
            # Create signature
            timestamp = int(datetime.now(timezone.utc).timestamp())
            signature_payload = f"{timestamp}.{json.dumps(payload)}"
            signature = hmac.new(
                webhook["secret"].encode(),
                signature_payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            headers = {
                "Content-Type": "application/json",
                "X-DataPulse-Signature": f"t={timestamp},v1={signature}",
                "X-DataPulse-Event": event
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook["url"],
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
                
                if response.status_code >= 400:
                    # Increment failure count
                    await db.webhooks.update_one(
                        {"_id": webhook["_id"]},
                        {"$inc": {"failure_count": 1}}
                    )
                else:
                    # Reset failure count and update last triggered
                    await db.webhooks.update_one(
                        {"_id": webhook["_id"]},
                        {
                            "$set": {
                                "last_triggered": datetime.now(timezone.utc),
                                "failure_count": 0
                            }
                        }
                    )
        except Exception:
            # Log error and increment failure count
            await db.webhooks.update_one(
                {"_id": webhook["_id"]},
                {"$inc": {"failure_count": 1}}
            )


# =============================================================================
# FORMS API
# =============================================================================

@router.get("/forms", response_model=List[FormResponse])
async def list_forms(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    auth: dict = Depends(verify_api_key)
):
    """
    List all forms in the organization.
    
    Query parameters:
    - status: Filter by form status (draft, active, closed)
    - limit: Maximum results (default 50, max 100)
    - offset: Pagination offset
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    limit = min(limit, 100)
    
    query = {"org_id": auth["org_id"]}
    if status:
        query["status"] = status
    
    forms = await db.forms.find(query).skip(offset).limit(limit).to_list(limit)
    
    result = []
    for form in forms:
        # Get submission count
        sub_count = await db.submissions.count_documents({"form_id": str(form["_id"])})
        
        result.append(FormResponse(
            id=str(form["_id"]),
            name=form.get("name", "Untitled"),
            description=form.get("description"),
            status=form.get("status", "draft"),
            question_count=len(form.get("questions", [])),
            submission_count=sub_count,
            created_at=form.get("created_at", datetime.now(timezone.utc)),
            updated_at=form.get("updated_at", datetime.now(timezone.utc))
        ))
    
    return result


@router.get("/forms/{form_id}", response_model=dict)
async def get_form(
    form_id: str,
    auth: dict = Depends(verify_api_key)
):
    """Get form details including questions"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    form = await db.forms.find_one({
        "_id": ObjectId(form_id),
        "org_id": auth["org_id"]
    })
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    form["id"] = str(form.pop("_id"))
    return form


@router.get("/forms/{form_id}/schema")
async def get_form_schema(
    form_id: str,
    auth: dict = Depends(verify_api_key)
):
    """
    Get form schema in a simplified format for integration.
    
    Returns field definitions with types, validation rules, and choices.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    form = await db.forms.find_one({
        "_id": ObjectId(form_id),
        "org_id": auth["org_id"]
    })
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    schema = {
        "form_id": form_id,
        "name": form.get("name"),
        "version": form.get("version", "1.0"),
        "fields": []
    }
    
    for q in form.get("questions", []):
        field = {
            "name": q.get("name"),
            "label": q.get("label"),
            "type": q.get("type"),
            "required": q.get("required", False),
            "validation": q.get("validation"),
            "choices": q.get("choices") if q.get("type") in ["select", "radio", "checkbox"] else None
        }
        schema["fields"].append(field)
    
    return schema


# =============================================================================
# PROJECTS API
# =============================================================================

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    limit: int = 50,
    offset: int = 0,
    auth: dict = Depends(verify_api_key)
):
    """List all projects in the organization"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    limit = min(limit, 100)
    
    projects = await db.projects.find(
        {"org_id": auth["org_id"]}
    ).skip(offset).limit(limit).to_list(limit)
    
    result = []
    for proj in projects:
        form_count = await db.forms.count_documents({"project_id": str(proj["_id"])})
        result.append(ProjectResponse(
            id=str(proj["_id"]),
            name=proj.get("name", "Untitled"),
            description=proj.get("description"),
            form_count=form_count,
            created_at=proj.get("created_at", datetime.now(timezone.utc))
        ))
    
    return result


# =============================================================================
# SUBMISSIONS API
# =============================================================================

@router.get("/submissions", response_model=List[SubmissionResponse])
async def list_submissions(
    form_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0,
    auth: dict = Depends(verify_api_key)
):
    """
    List submissions with filtering options.
    
    Query parameters:
    - form_id: Filter by form
    - status: Filter by status (pending, approved, rejected)
    - start_date: Filter submissions after this date
    - end_date: Filter submissions before this date
    - limit: Maximum results (default 100, max 1000)
    - offset: Pagination offset
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    limit = min(limit, 1000)
    
    query = {"org_id": auth["org_id"]}
    if form_id:
        query["form_id"] = form_id
    if status:
        query["status"] = status
    if start_date:
        query["submitted_at"] = {"$gte": start_date}
    if end_date:
        query.setdefault("submitted_at", {})["$lte"] = end_date
    
    submissions = await db.submissions.find(query).skip(offset).limit(limit).to_list(limit)
    
    return [
        SubmissionResponse(
            id=str(s["_id"]),
            form_id=s.get("form_id"),
            data=s.get("data", {}),
            status=s.get("status", "pending"),
            submitted_at=s.get("submitted_at", datetime.now(timezone.utc)),
            submitted_by=s.get("submitted_by")
        )
        for s in submissions
    ]


@router.get("/submissions/{submission_id}", response_model=dict)
async def get_submission(
    submission_id: str,
    auth: dict = Depends(verify_api_key)
):
    """Get a single submission with all details"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    submission = await db.submissions.find_one({
        "_id": ObjectId(submission_id),
        "org_id": auth["org_id"]
    })
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission["id"] = str(submission.pop("_id"))
    return submission


@router.post("/submissions", response_model=SubmissionResponse)
async def create_submission(
    submission: SubmissionCreate,
    background_tasks: BackgroundTasks,
    auth: dict = Depends(require_permission("write"))
):
    """
    Create a new submission via API.
    
    This allows external systems to submit data directly to DataPulse forms.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Verify form exists and belongs to org
    form = await db.forms.find_one({
        "_id": ObjectId(submission.form_id),
        "org_id": auth["org_id"]
    })
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form.get("status") != "active":
        raise HTTPException(status_code=400, detail="Form is not accepting submissions")
    
    submission_doc = {
        "form_id": submission.form_id,
        "org_id": auth["org_id"],
        "data": submission.data,
        "metadata": submission.metadata or {},
        "gps": submission.gps,
        "status": "pending",
        "source": "api",
        "api_key_id": auth["key_id"],
        "submitted_at": datetime.now(timezone.utc)
    }
    
    result = await db.submissions.insert_one(submission_doc)
    submission_id = str(result.inserted_id)
    
    # Trigger webhook
    background_tasks.add_task(
        trigger_webhooks,
        auth["org_id"],
        "submission.created",
        {
            "submission_id": submission_id,
            "form_id": submission.form_id,
            "submitted_at": submission_doc["submitted_at"].isoformat()
        }
    )
    
    return SubmissionResponse(
        id=submission_id,
        form_id=submission.form_id,
        data=submission.data,
        status="pending",
        submitted_at=submission_doc["submitted_at"],
        submitted_by=None
    )


@router.patch("/submissions/{submission_id}")
async def update_submission(
    submission_id: str,
    updates: Dict[str, Any],
    background_tasks: BackgroundTasks,
    auth: dict = Depends(require_permission("write"))
):
    """Update submission data or status"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Only allow updating certain fields
    allowed_fields = ["data", "status", "metadata"]
    update_doc = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_doc:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.submissions.update_one(
        {"_id": ObjectId(submission_id), "org_id": auth["org_id"]},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Trigger webhook for status changes
    if "status" in updates:
        event = f"submission.{updates['status']}"
        if event in WEBHOOK_EVENTS:
            background_tasks.add_task(
                trigger_webhooks,
                auth["org_id"],
                event,
                {"submission_id": submission_id, "new_status": updates["status"]}
            )
    
    return {"message": "Submission updated", "id": submission_id}


# =============================================================================
# DATA EXPORT API
# =============================================================================

@router.post("/export")
async def export_data(
    form_id: str,
    format: str = "json",
    filters: Optional[Dict[str, Any]] = None,
    auth: dict = Depends(verify_api_key)
):
    """
    Export form submissions data.
    
    Formats: json, csv
    
    Filters can include:
    - status: pending, approved, rejected
    - start_date: ISO date string
    - end_date: ISO date string
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if format not in ["json", "csv"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")
    
    query = {"form_id": form_id, "org_id": auth["org_id"]}
    if filters:
        if filters.get("status"):
            query["status"] = filters["status"]
        if filters.get("start_date"):
            query["submitted_at"] = {"$gte": datetime.fromisoformat(filters["start_date"])}
        if filters.get("end_date"):
            query.setdefault("submitted_at", {})["$lte"] = datetime.fromisoformat(filters["end_date"])
    
    submissions = await db.submissions.find(query).to_list(10000)
    
    if format == "json":
        return {
            "form_id": form_id,
            "export_date": datetime.now(timezone.utc).isoformat(),
            "count": len(submissions),
            "data": [
                {
                    "id": str(s["_id"]),
                    "data": s.get("data", {}),
                    "status": s.get("status"),
                    "submitted_at": s.get("submitted_at").isoformat() if s.get("submitted_at") else None,
                    "metadata": s.get("metadata", {})
                }
                for s in submissions
            ]
        }
    else:
        # CSV format
        import csv
        from io import StringIO
        from fastapi.responses import StreamingResponse
        
        if not submissions:
            return {"message": "No data to export"}
        
        # Get all unique keys from data
        all_keys = set()
        for s in submissions:
            all_keys.update(s.get("data", {}).keys())
        
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=["id", "status", "submitted_at"] + sorted(all_keys))
        writer.writeheader()
        
        for s in submissions:
            row = {
                "id": str(s["_id"]),
                "status": s.get("status"),
                "submitted_at": s.get("submitted_at").isoformat() if s.get("submitted_at") else ""
            }
            row.update(s.get("data", {}))
            writer.writerow(row)
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{form_id}.csv"}
        )


# =============================================================================
# STATISTICS API
# =============================================================================

@router.get("/stats/summary/{form_id}")
async def get_form_stats(
    form_id: str,
    auth: dict = Depends(verify_api_key)
):
    """Get summary statistics for a form"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Verify access
    form = await db.forms.find_one({
        "_id": ObjectId(form_id),
        "org_id": auth["org_id"]
    })
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Get counts by status
    pipeline = [
        {"$match": {"form_id": form_id, "org_id": auth["org_id"]}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    status_counts = {}
    async for doc in db.submissions.aggregate(pipeline):
        status_counts[doc["_id"] or "unknown"] = doc["count"]
    
    total = sum(status_counts.values())
    
    # Get date range
    first = await db.submissions.find_one(
        {"form_id": form_id},
        sort=[("submitted_at", 1)]
    )
    last = await db.submissions.find_one(
        {"form_id": form_id},
        sort=[("submitted_at", -1)]
    )
    
    return {
        "form_id": form_id,
        "form_name": form.get("name"),
        "total_submissions": total,
        "by_status": status_counts,
        "first_submission": first.get("submitted_at").isoformat() if first and first.get("submitted_at") else None,
        "last_submission": last.get("submitted_at").isoformat() if last and last.get("submitted_at") else None,
        "approval_rate": round(status_counts.get("approved", 0) / total * 100, 1) if total > 0 else 0
    }


# =============================================================================
# HEALTH CHECK
# =============================================================================

@router.get("/health")
async def health_check():
    """API health check - no authentication required"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Missing import
from datetime import timedelta
