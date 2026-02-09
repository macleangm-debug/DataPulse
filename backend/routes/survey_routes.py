"""DataPulse - Token/Panel Survey System
Industry-standard survey distribution with invite management.

Features:
- Invite lists with unique tokens
- One-time or multi-use links
- Expiration and re-entry policies
- Status tracking (sent, opened, started, partial, complete)
- Reminder scheduling
- Panel management for longitudinal studies
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import secrets
import hashlib

router = APIRouter(prefix="/surveys", tags=["Token/Panel Surveys"])


class InviteStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    OPENED = "opened"
    STARTED = "started"
    PARTIAL = "partial"
    COMPLETE = "complete"
    EXPIRED = "expired"
    BOUNCED = "bounced"
    OPTED_OUT = "opted_out"


class SurveyMode(str, Enum):
    CAWI = "cawi"  # Computer-Assisted Web Interviewing
    TOKEN = "token"  # Token-based access
    PANEL = "panel"  # Panel survey (longitudinal)
    PUBLIC = "public"  # Open public link


class ReminderType(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    BOTH = "both"


class SurveyCreate(BaseModel):
    form_id: str
    org_id: str
    name: str
    description: Optional[str] = None
    mode: SurveyMode = SurveyMode.TOKEN
    
    # Access settings
    allow_multiple_submissions: bool = False
    allow_save_and_continue: bool = True
    require_token: bool = True
    
    # Expiration
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    token_expires_hours: Optional[int] = None  # Per-token expiration
    
    # Limits
    max_responses: Optional[int] = None
    
    # Re-entry policy
    allow_reentry: bool = True
    reentry_window_hours: Optional[int] = 24  # Can re-enter within X hours
    
    # Reminders
    enable_reminders: bool = False
    reminder_type: ReminderType = ReminderType.EMAIL
    reminder_schedule: List[int] = []  # Days after invite to send reminder


class InviteCreate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    external_id: Optional[str] = None  # ID from external system
    metadata: Optional[Dict[str, Any]] = None  # Custom attributes
    
    # Panel-specific
    panel_id: Optional[str] = None
    wave_number: Optional[int] = None


class InviteBatch(BaseModel):
    invites: List[InviteCreate]
    send_immediately: bool = False


class PanelCreate(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    
    # Panel config
    total_waves: int = 1
    wave_interval_days: Optional[int] = None
    
    # Member attributes to track
    tracked_attributes: List[str] = []  # e.g., ["age", "region", "income_bracket"]


# ============ Survey Distribution Management ============

@router.post("/distributions")
async def create_survey_distribution(
    request: Request,
    survey: SurveyCreate
):
    """Create a new survey distribution"""
    db = request.app.state.db
    
    # Verify form exists
    form = await db.forms.find_one({"id": survey.form_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    distribution = {
        "id": f"dist_{survey.org_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **survey.dict(),
        "status": "draft",
        "public_link": None,
        "stats": {
            "total_invites": 0,
            "sent": 0,
            "opened": 0,
            "started": 0,
            "completed": 0,
            "response_rate": 0
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Generate public link if public mode
    if survey.mode == SurveyMode.PUBLIC:
        distribution["public_link"] = f"/s/{secrets.token_urlsafe(12)}"
    
    await db.survey_distributions.insert_one(distribution)
    
    return {
        "message": "Survey distribution created",
        "distribution_id": distribution["id"],
        "public_link": distribution.get("public_link")
    }


@router.get("/distributions/{org_id}")
async def list_distributions(
    request: Request,
    org_id: str,
    status: Optional[str] = None,
    mode: Optional[str] = None
):
    """List all survey distributions for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    if mode:
        query["mode"] = mode
    
    distributions = await db.survey_distributions.find(query).sort("created_at", -1).to_list(100)
    
    for d in distributions:
        d["_id"] = str(d.get("_id", ""))
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("start_date"):
            d["start_date"] = d["start_date"].isoformat()
        if d.get("end_date"):
            d["end_date"] = d["end_date"].isoformat()
    
    return {"distributions": distributions, "total": len(distributions)}


@router.get("/distributions/{org_id}/{dist_id}")
async def get_distribution(
    request: Request,
    org_id: str,
    dist_id: str
):
    """Get distribution details with stats"""
    db = request.app.state.db
    
    dist = await db.survey_distributions.find_one({"id": dist_id, "org_id": org_id})
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution not found")
    
    dist["_id"] = str(dist.get("_id", ""))
    
    # Recalculate stats
    invite_counts = await db.survey_invites.aggregate([
        {"$match": {"distribution_id": dist_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    stats = {"total_invites": 0, "sent": 0, "opened": 0, "started": 0, "completed": 0}
    for count in invite_counts:
        status = count["_id"]
        if status in stats:
            stats[status] = count["count"]
        stats["total_invites"] += count["count"]
    
    if stats["sent"] > 0:
        stats["response_rate"] = round((stats["completed"] / stats["sent"]) * 100, 1)
    else:
        stats["response_rate"] = 0
    
    dist["stats"] = stats
    
    return dist


@router.put("/distributions/{org_id}/{dist_id}/activate")
async def activate_distribution(
    request: Request,
    org_id: str,
    dist_id: str
):
    """Activate a distribution (start accepting responses)"""
    db = request.app.state.db
    
    result = await db.survey_distributions.update_one(
        {"id": dist_id, "org_id": org_id},
        {
            "$set": {
                "status": "active",
                "activated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Distribution not found")
    
    return {"message": "Distribution activated"}


@router.put("/distributions/{org_id}/{dist_id}/close")
async def close_distribution(
    request: Request,
    org_id: str,
    dist_id: str
):
    """Close a distribution (stop accepting responses)"""
    db = request.app.state.db
    
    result = await db.survey_distributions.update_one(
        {"id": dist_id, "org_id": org_id},
        {
            "$set": {
                "status": "closed",
                "closed_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Distribution not found")
    
    return {"message": "Distribution closed"}


# ============ Invite Management ============

@router.post("/distributions/{org_id}/{dist_id}/invites")
async def create_invites(
    request: Request,
    org_id: str,
    dist_id: str,
    batch: InviteBatch
):
    """Create invites for a distribution (batch)"""
    db = request.app.state.db
    
    dist = await db.survey_distributions.find_one({"id": dist_id, "org_id": org_id})
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution not found")
    
    invites_to_create = []
    tokens_created = []
    
    for invite_data in batch.invites:
        # Generate unique token
        token = secrets.token_urlsafe(16)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Calculate expiration
        expires_at = None
        if dist.get("token_expires_hours"):
            expires_at = datetime.now(timezone.utc) + timedelta(hours=dist["token_expires_hours"])
        elif dist.get("end_date"):
            expires_at = dist["end_date"]
        
        invite = {
            "id": f"inv_{dist_id}_{secrets.token_hex(8)}",
            "distribution_id": dist_id,
            "org_id": org_id,
            "form_id": dist["form_id"],
            "token": token,  # Only stored temporarily, returned once
            "token_hash": token_hash,
            "token_prefix": token[:8],
            "email": invite_data.email,
            "phone": invite_data.phone,
            "name": invite_data.name,
            "external_id": invite_data.external_id,
            "metadata": invite_data.metadata or {},
            "panel_id": invite_data.panel_id,
            "wave_number": invite_data.wave_number,
            "status": InviteStatus.PENDING,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "events": []  # Track status changes
        }
        
        invites_to_create.append(invite)
        tokens_created.append({
            "invite_id": invite["id"],
            "token": token,
            "email": invite_data.email,
            "survey_link": f"/survey/{dist_id}?token={token}"
        })
    
    if invites_to_create:
        # Remove token from storage (only return once)
        for inv in invites_to_create:
            del inv["token"]
        await db.survey_invites.insert_many(invites_to_create)
        
        # Update distribution stats
        await db.survey_distributions.update_one(
            {"id": dist_id},
            {"$inc": {"stats.total_invites": len(invites_to_create)}}
        )
    
    # Send immediately if requested
    if batch.send_immediately:
        # Would integrate with email/SMS service here
        await db.survey_invites.update_many(
            {"distribution_id": dist_id, "status": InviteStatus.PENDING},
            {
                "$set": {"status": InviteStatus.SENT, "sent_at": datetime.now(timezone.utc)},
                "$push": {"events": {"type": "sent", "timestamp": datetime.now(timezone.utc)}}
            }
        )
    
    return {
        "message": f"Created {len(tokens_created)} invites",
        "invites": tokens_created  # Return tokens only once
    }


@router.get("/distributions/{org_id}/{dist_id}/invites")
async def list_invites(
    request: Request,
    org_id: str,
    dist_id: str,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """List invites for a distribution"""
    db = request.app.state.db
    
    query = {"distribution_id": dist_id, "org_id": org_id}
    if status:
        query["status"] = status
    
    invites = await db.survey_invites.find(
        query,
        {"token_hash": 0}  # Don't expose hash
    ).skip(offset).limit(limit).to_list(limit)
    
    total = await db.survey_invites.count_documents(query)
    
    for inv in invites:
        inv["_id"] = str(inv.get("_id", ""))
        if inv.get("created_at"):
            inv["created_at"] = inv["created_at"].isoformat()
        if inv.get("expires_at"):
            inv["expires_at"] = inv["expires_at"].isoformat()
    
    return {
        "invites": invites,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/invites/{invite_id}/send")
async def send_invite(
    request: Request,
    invite_id: str
):
    """Send/resend an invite"""
    db = request.app.state.db
    
    invite = await db.survey_invites.find_one({"id": invite_id})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    # In production, would send email/SMS here
    
    await db.survey_invites.update_one(
        {"id": invite_id},
        {
            "$set": {"status": InviteStatus.SENT, "sent_at": datetime.now(timezone.utc)},
            "$push": {"events": {"type": "sent", "timestamp": datetime.now(timezone.utc)}}
        }
    )
    
    return {"message": "Invite sent"}


@router.delete("/invites/{invite_id}")
async def revoke_invite(
    request: Request,
    invite_id: str
):
    """Revoke an invite (prevent access)"""
    db = request.app.state.db
    
    result = await db.survey_invites.update_one(
        {"id": invite_id},
        {
            "$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc)},
            "$push": {"events": {"type": "revoked", "timestamp": datetime.now(timezone.utc)}}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    return {"message": "Invite revoked"}


# ============ Token Validation (for survey access) ============

@router.post("/validate-token")
async def validate_token(
    request: Request,
    token: str,
    distribution_id: str
):
    """Validate a survey token and return access info"""
    db = request.app.state.db
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    invite = await db.survey_invites.find_one({
        "distribution_id": distribution_id,
        "token_hash": token_hash
    })
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    # Check status
    if invite["status"] in ["revoked", "opted_out"]:
        raise HTTPException(status_code=403, detail="This invite has been revoked")
    
    if invite["status"] == "complete":
        dist = await db.survey_distributions.find_one({"id": distribution_id})
        if not dist.get("allow_multiple_submissions"):
            raise HTTPException(status_code=403, detail="Survey already completed")
    
    # Check expiration
    if invite.get("expires_at"):
        expires_at = invite["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at < datetime.now(timezone.utc):
            await db.survey_invites.update_one(
                {"id": invite["id"]},
                {"$set": {"status": InviteStatus.EXPIRED}}
            )
            raise HTTPException(status_code=403, detail="Token has expired")
    
    # Update status to opened
    if invite["status"] in [InviteStatus.PENDING, InviteStatus.SENT]:
        await db.survey_invites.update_one(
            {"id": invite["id"]},
            {
                "$set": {"status": InviteStatus.OPENED, "opened_at": datetime.now(timezone.utc)},
                "$push": {"events": {"type": "opened", "timestamp": datetime.now(timezone.utc)}}
            }
        )
    
    # Get distribution and form info
    dist = await db.survey_distributions.find_one({"id": distribution_id})
    
    return {
        "valid": True,
        "invite_id": invite["id"],
        "form_id": invite["form_id"],
        "respondent_name": invite.get("name"),
        "preload_data": invite.get("metadata", {}),
        "allow_save_and_continue": dist.get("allow_save_and_continue", True),
        "status": invite["status"]
    }


@router.post("/invites/{invite_id}/start")
async def mark_survey_started(
    request: Request,
    invite_id: str
):
    """Mark survey as started"""
    db = request.app.state.db
    
    await db.survey_invites.update_one(
        {"id": invite_id},
        {
            "$set": {"status": InviteStatus.STARTED, "started_at": datetime.now(timezone.utc)},
            "$push": {"events": {"type": "started", "timestamp": datetime.now(timezone.utc)}}
        }
    )
    
    return {"message": "Survey marked as started"}


@router.post("/invites/{invite_id}/complete")
async def mark_survey_complete(
    request: Request,
    invite_id: str,
    submission_id: str
):
    """Mark survey as complete and link submission"""
    db = request.app.state.db
    
    await db.survey_invites.update_one(
        {"id": invite_id},
        {
            "$set": {
                "status": InviteStatus.COMPLETE,
                "completed_at": datetime.now(timezone.utc),
                "submission_id": submission_id
            },
            "$push": {"events": {"type": "completed", "timestamp": datetime.now(timezone.utc)}}
        }
    )
    
    # Update distribution stats
    invite = await db.survey_invites.find_one({"id": invite_id})
    if invite:
        await db.survey_distributions.update_one(
            {"id": invite["distribution_id"]},
            {"$inc": {"stats.completed": 1}}
        )
    
    return {"message": "Survey marked as complete"}


@router.post("/invites/{invite_id}/save-progress")
async def save_survey_progress(
    request: Request,
    invite_id: str
):
    """Save partial survey progress"""
    db = request.app.state.db
    data = await request.json()
    
    await db.survey_invites.update_one(
        {"id": invite_id},
        {
            "$set": {
                "status": InviteStatus.PARTIAL,
                "partial_data": data.get("data", {}),
                "last_page": data.get("last_page", 0),
                "last_saved_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Progress saved"}


@router.get("/invites/{invite_id}/progress")
async def get_survey_progress(
    request: Request,
    invite_id: str
):
    """Get saved survey progress for continuation"""
    db = request.app.state.db
    
    invite = await db.survey_invites.find_one({"id": invite_id})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    return {
        "has_progress": bool(invite.get("partial_data")),
        "partial_data": invite.get("partial_data", {}),
        "last_page": invite.get("last_page", 0),
        "last_saved_at": invite.get("last_saved_at")
    }


# ============ Panel Management ============

@router.post("/panels")
async def create_panel(
    request: Request,
    panel: PanelCreate
):
    """Create a survey panel for longitudinal studies"""
    db = request.app.state.db
    
    panel_doc = {
        "id": f"panel_{panel.org_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **panel.dict(),
        "member_count": 0,
        "current_wave": 0,
        "waves": [],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.survey_panels.insert_one(panel_doc)
    
    return {"message": "Panel created", "panel_id": panel_doc["id"]}


@router.get("/panels/{org_id}")
async def list_panels(
    request: Request,
    org_id: str
):
    """List all panels for an organization"""
    db = request.app.state.db
    
    panels = await db.survey_panels.find({"org_id": org_id}).to_list(100)
    
    for p in panels:
        p["_id"] = str(p.get("_id", ""))
        if p.get("created_at"):
            p["created_at"] = p["created_at"].isoformat()
    
    return {"panels": panels}


@router.post("/panels/{panel_id}/members")
async def add_panel_members(
    request: Request,
    panel_id: str
):
    """Add members to a panel"""
    db = request.app.state.db
    data = await request.json()
    members = data.get("members", [])
    
    panel = await db.survey_panels.find_one({"id": panel_id})
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    members_to_add = []
    for m in members:
        member = {
            "id": f"pm_{panel_id}_{secrets.token_hex(8)}",
            "panel_id": panel_id,
            "email": m.get("email"),
            "phone": m.get("phone"),
            "name": m.get("name"),
            "external_id": m.get("external_id"),
            "attributes": m.get("attributes", {}),
            "status": "active",
            "wave_participation": {},
            "created_at": datetime.now(timezone.utc)
        }
        members_to_add.append(member)
    
    if members_to_add:
        await db.panel_members.insert_many(members_to_add)
        await db.survey_panels.update_one(
            {"id": panel_id},
            {"$inc": {"member_count": len(members_to_add)}}
        )
    
    return {"message": f"Added {len(members_to_add)} members"}


@router.post("/panels/{panel_id}/waves/{wave_number}/launch")
async def launch_panel_wave(
    request: Request,
    panel_id: str,
    wave_number: int,
    form_id: str
):
    """Launch a new wave for a panel"""
    db = request.app.state.db
    
    panel = await db.survey_panels.find_one({"id": panel_id})
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    # Create distribution for this wave
    dist = SurveyCreate(
        form_id=form_id,
        org_id=panel["org_id"],
        name=f"{panel['name']} - Wave {wave_number}",
        mode=SurveyMode.PANEL,
        require_token=True
    )
    
    # Create the distribution (reuse existing function logic)
    distribution = {
        "id": f"dist_{panel['org_id']}_{int(datetime.now(timezone.utc).timestamp())}",
        **dist.dict(),
        "panel_id": panel_id,
        "wave_number": wave_number,
        "status": "active",
        "stats": {"total_invites": 0, "sent": 0, "opened": 0, "started": 0, "completed": 0},
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.survey_distributions.insert_one(distribution)
    
    # Create invites for all active panel members
    members = await db.panel_members.find({
        "panel_id": panel_id,
        "status": "active"
    }).to_list(10000)
    
    invites_created = 0
    for member in members:
        token = secrets.token_urlsafe(16)
        invite = {
            "id": f"inv_{distribution['id']}_{secrets.token_hex(8)}",
            "distribution_id": distribution["id"],
            "org_id": panel["org_id"],
            "form_id": form_id,
            "token_hash": hashlib.sha256(token.encode()).hexdigest(),
            "token_prefix": token[:8],
            "email": member.get("email"),
            "phone": member.get("phone"),
            "name": member.get("name"),
            "panel_id": panel_id,
            "panel_member_id": member["id"],
            "wave_number": wave_number,
            "status": InviteStatus.PENDING,
            "metadata": member.get("attributes", {}),
            "created_at": datetime.now(timezone.utc),
            "events": []
        }
        await db.survey_invites.insert_one(invite)
        invites_created += 1
    
    # Update panel
    await db.survey_panels.update_one(
        {"id": panel_id},
        {
            "$set": {"current_wave": wave_number},
            "$push": {
                "waves": {
                    "number": wave_number,
                    "distribution_id": distribution["id"],
                    "form_id": form_id,
                    "launched_at": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    return {
        "message": f"Wave {wave_number} launched",
        "distribution_id": distribution["id"],
        "invites_created": invites_created
    }


# ============ Reminder Management ============

@router.post("/distributions/{dist_id}/send-reminders")
async def send_reminders(
    request: Request,
    dist_id: str,
    target_statuses: List[str] = None
):
    """Send reminders to non-completers"""
    db = request.app.state.db
    
    if not target_statuses:
        target_statuses = [InviteStatus.SENT, InviteStatus.OPENED, InviteStatus.STARTED, InviteStatus.PARTIAL]
    
    # Find invites that need reminders
    invites = await db.survey_invites.find({
        "distribution_id": dist_id,
        "status": {"$in": target_statuses}
    }).to_list(10000)
    
    reminder_count = 0
    for invite in invites:
        # In production, would send actual reminder here
        await db.survey_invites.update_one(
            {"id": invite["id"]},
            {
                "$push": {
                    "events": {"type": "reminder_sent", "timestamp": datetime.now(timezone.utc)}
                },
                "$inc": {"reminder_count": 1}
            }
        )
        reminder_count += 1
    
    return {"message": f"Sent {reminder_count} reminders"}


# ============ Stats and Reports ============

@router.get("/distributions/{dist_id}/response-report")
async def get_response_report(
    request: Request,
    dist_id: str
):
    """Get detailed response report for a distribution"""
    db = request.app.state.db
    
    dist = await db.survey_distributions.find_one({"id": dist_id})
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution not found")
    
    # Status breakdown
    status_counts = await db.survey_invites.aggregate([
        {"$match": {"distribution_id": dist_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Daily completion trend
    daily_completions = await db.survey_invites.aggregate([
        {"$match": {"distribution_id": dist_id, "status": "complete"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$completed_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(100)
    
    # Average completion time
    completion_times = await db.survey_invites.aggregate([
        {"$match": {"distribution_id": dist_id, "status": "complete", "started_at": {"$exists": True}}},
        {"$project": {
            "completion_time": {
                "$divide": [
                    {"$subtract": ["$completed_at", "$started_at"]},
                    60000  # Convert to minutes
                ]
            }
        }},
        {"$group": {
            "_id": None,
            "avg_minutes": {"$avg": "$completion_time"},
            "min_minutes": {"$min": "$completion_time"},
            "max_minutes": {"$max": "$completion_time"}
        }}
    ]).to_list(1)
    
    return {
        "distribution_id": dist_id,
        "status_breakdown": {s["_id"]: s["count"] for s in status_counts},
        "daily_completions": daily_completions,
        "completion_time": completion_times[0] if completion_times else None,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
