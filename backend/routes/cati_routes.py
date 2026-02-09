"""DataPulse - CATI (Computer-Assisted Telephone Interviewing) Module
Industry-standard telephone survey management.

Features:
- Call queue management with priority
- Call scripts embedded in form
- Attempt log with disposition codes
- Callback scheduling
- Tap-to-call integration support
- Interviewer workload balancing
- Real-time call monitoring
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import secrets

router = APIRouter(prefix="/cati", tags=["CATI - Telephone Interviewing"])


class DispositionCode(str, Enum):
    # Successful outcomes
    COMPLETE = "complete"
    PARTIAL_COMPLETE = "partial_complete"
    
    # Non-contact
    NO_ANSWER = "no_answer"
    BUSY = "busy"
    VOICEMAIL = "voicemail"
    DISCONNECTED = "disconnected"
    WRONG_NUMBER = "wrong_number"
    
    # Contact but no interview
    CALLBACK_REQUESTED = "callback_requested"
    RESPONDENT_UNAVAILABLE = "respondent_unavailable"
    LANGUAGE_BARRIER = "language_barrier"
    
    # Refusal
    SOFT_REFUSAL = "soft_refusal"
    HARD_REFUSAL = "hard_refusal"
    REFUSED_GATEKEEPER = "refused_gatekeeper"
    
    # Ineligible
    INELIGIBLE = "ineligible"
    DECEASED = "deceased"
    INSTITUTIONALIZED = "institutionalized"
    
    # Technical
    SYSTEM_ERROR = "system_error"
    INTERVIEWER_ERROR = "interviewer_error"


class CallPriority(str, Enum):
    URGENT = "urgent"  # Scheduled callbacks
    HIGH = "high"  # Fresh leads
    NORMAL = "normal"  # Regular queue
    LOW = "low"  # Already attempted


class QueueItemStatus(str, Enum):
    AVAILABLE = "available"
    LOCKED = "locked"  # Assigned to interviewer
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXHAUSTED = "exhausted"  # Max attempts reached


class CATIProjectCreate(BaseModel):
    org_id: str
    name: str
    form_id: str
    description: Optional[str] = None
    
    # Call settings
    max_call_attempts: int = 5
    min_hours_between_attempts: int = 2
    callback_window_hours: int = 48
    
    # Working hours (for callback scheduling)
    working_hours_start: int = 9  # 9 AM
    working_hours_end: int = 21  # 9 PM
    working_days: List[int] = [0, 1, 2, 3, 4, 5]  # Mon-Sat
    
    # Interviewer settings
    max_locked_per_interviewer: int = 1
    lock_timeout_minutes: int = 30
    
    # Call script
    intro_script: Optional[str] = None
    outro_script: Optional[str] = None


class CallRecord(BaseModel):
    queue_item_id: str
    interviewer_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    disposition: DispositionCode
    notes: Optional[str] = None
    callback_datetime: Optional[datetime] = None


class QueueItemCreate(BaseModel):
    case_id: str
    phone_primary: str
    phone_secondary: Optional[str] = None
    respondent_name: Optional[str] = None
    preload_data: Optional[Dict[str, Any]] = None
    priority: CallPriority = CallPriority.NORMAL
    notes: Optional[str] = None


class QueueBulkLoad(BaseModel):
    items: List[QueueItemCreate]


# ============ CATI Project Management ============

@router.post("/projects")
async def create_cati_project(
    request: Request,
    project: CATIProjectCreate
):
    """Create a new CATI project"""
    db = request.app.state.db
    
    project_doc = {
        "id": f"cati_{project.org_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **project.dict(),
        "status": "setup",
        "stats": {
            "total_cases": 0,
            "completed": 0,
            "in_progress": 0,
            "pending": 0,
            "exhausted": 0,
            "completion_rate": 0,
            "contact_rate": 0
        },
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.cati_projects.insert_one(project_doc)
    
    return {"message": "CATI project created", "project_id": project_doc["id"]}


@router.get("/projects/{org_id}")
async def list_cati_projects(
    request: Request,
    org_id: str
):
    """List all CATI projects for an organization"""
    db = request.app.state.db
    
    projects = await db.cati_projects.find({"org_id": org_id}).to_list(100)
    
    for p in projects:
        p["_id"] = str(p.get("_id", ""))
        if p.get("created_at"):
            p["created_at"] = p["created_at"].isoformat()
    
    return {"projects": projects}


@router.get("/projects/{org_id}/{project_id}")
async def get_cati_project(
    request: Request,
    org_id: str,
    project_id: str
):
    """Get CATI project details with stats"""
    db = request.app.state.db
    
    project = await db.cati_projects.find_one({"id": project_id, "org_id": org_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project["_id"] = str(project.get("_id", ""))
    
    # Calculate fresh stats
    stats = await calculate_project_stats(db, project_id)
    project["stats"] = stats
    
    return project


@router.put("/projects/{project_id}/activate")
async def activate_cati_project(
    request: Request,
    project_id: str
):
    """Activate CATI project (start calling)"""
    db = request.app.state.db
    
    result = await db.cati_projects.update_one(
        {"id": project_id},
        {"$set": {"status": "active", "activated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project activated"}


# ============ Call Queue Management ============

@router.post("/projects/{project_id}/queue")
async def add_to_queue(
    request: Request,
    project_id: str,
    item: QueueItemCreate
):
    """Add a single item to the call queue"""
    db = request.app.state.db
    
    project = await db.cati_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    queue_item = {
        "id": f"cq_{project_id}_{secrets.token_hex(8)}",
        "project_id": project_id,
        "org_id": project["org_id"],
        "form_id": project["form_id"],
        **item.dict(),
        "status": QueueItemStatus.AVAILABLE,
        "attempt_count": 0,
        "call_history": [],
        "locked_by": None,
        "locked_at": None,
        "next_call_after": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.cati_queue.insert_one(queue_item)
    
    # Update project stats
    await db.cati_projects.update_one(
        {"id": project_id},
        {"$inc": {"stats.total_cases": 1, "stats.pending": 1}}
    )
    
    return {"message": "Added to queue", "queue_item_id": queue_item["id"]}


@router.post("/projects/{project_id}/queue/bulk")
async def bulk_add_to_queue(
    request: Request,
    project_id: str,
    bulk: QueueBulkLoad
):
    """Bulk add items to the call queue"""
    db = request.app.state.db
    
    project = await db.cati_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    items_to_add = []
    for item in bulk.items:
        queue_item = {
            "id": f"cq_{project_id}_{secrets.token_hex(8)}",
            "project_id": project_id,
            "org_id": project["org_id"],
            "form_id": project["form_id"],
            **item.dict(),
            "status": QueueItemStatus.AVAILABLE,
            "attempt_count": 0,
            "call_history": [],
            "locked_by": None,
            "locked_at": None,
            "next_call_after": None,
            "created_at": datetime.now(timezone.utc)
        }
        items_to_add.append(queue_item)
    
    if items_to_add:
        await db.cati_queue.insert_many(items_to_add)
        await db.cati_projects.update_one(
            {"id": project_id},
            {"$inc": {"stats.total_cases": len(items_to_add), "stats.pending": len(items_to_add)}}
        )
    
    return {"message": f"Added {len(items_to_add)} items to queue"}


@router.get("/queue/{project_id}")
async def get_queue(
    request: Request,
    project_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get call queue items"""
    db = request.app.state.db
    
    query = {"project_id": project_id}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    
    items = await db.cati_queue.find(query).skip(offset).limit(limit).to_list(limit)
    total = await db.cati_queue.count_documents(query)
    
    for item in items:
        item["_id"] = str(item.get("_id", ""))
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
    
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ============ Interviewer Workstation ============

@router.get("/workstation/{interviewer_id}/next-call")
async def get_next_call(
    request: Request,
    interviewer_id: str,
    project_id: str
):
    """Get next call for interviewer (with locking)"""
    db = request.app.state.db
    
    project = await db.cati_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if interviewer already has a locked item
    existing_lock = await db.cati_queue.find_one({
        "project_id": project_id,
        "locked_by": interviewer_id,
        "status": QueueItemStatus.LOCKED
    })
    
    if existing_lock:
        existing_lock["_id"] = str(existing_lock.get("_id", ""))
        return {"queue_item": existing_lock, "already_locked": True}
    
    # Check lock limit
    locked_count = await db.cati_queue.count_documents({
        "project_id": project_id,
        "locked_by": interviewer_id
    })
    
    if locked_count >= project.get("max_locked_per_interviewer", 1):
        raise HTTPException(status_code=400, detail="Maximum locked items reached")
    
    now = datetime.now(timezone.utc)
    
    # Priority order: callbacks due > urgent > high > normal > low
    # Also consider next_call_after timing
    
    # First, try to find scheduled callbacks that are due
    callback_item = await db.cati_queue.find_one_and_update(
        {
            "project_id": project_id,
            "status": QueueItemStatus.AVAILABLE,
            "priority": CallPriority.URGENT,
            "$or": [
                {"next_call_after": {"$lte": now}},
                {"next_call_after": None}
            ]
        },
        {
            "$set": {
                "status": QueueItemStatus.LOCKED,
                "locked_by": interviewer_id,
                "locked_at": now
            }
        },
        sort=[("next_call_after", 1)],
        return_document=True
    )
    
    if callback_item:
        callback_item["_id"] = str(callback_item.get("_id", ""))
        return {"queue_item": callback_item, "type": "scheduled_callback"}
    
    # Otherwise, get next available by priority
    for priority in [CallPriority.HIGH, CallPriority.NORMAL, CallPriority.LOW]:
        item = await db.cati_queue.find_one_and_update(
            {
                "project_id": project_id,
                "status": QueueItemStatus.AVAILABLE,
                "priority": priority,
                "$or": [
                    {"next_call_after": {"$lte": now}},
                    {"next_call_after": None}
                ]
            },
            {
                "$set": {
                    "status": QueueItemStatus.LOCKED,
                    "locked_by": interviewer_id,
                    "locked_at": now
                }
            },
            return_document=True
        )
        
        if item:
            item["_id"] = str(item.get("_id", ""))
            return {"queue_item": item, "type": "queue"}
    
    return {"queue_item": None, "message": "No calls available"}


@router.post("/workstation/release/{queue_item_id}")
async def release_call(
    request: Request,
    queue_item_id: str,
    interviewer_id: str
):
    """Release a locked call without recording disposition"""
    db = request.app.state.db
    
    result = await db.cati_queue.update_one(
        {"id": queue_item_id, "locked_by": interviewer_id},
        {
            "$set": {
                "status": QueueItemStatus.AVAILABLE,
                "locked_by": None,
                "locked_at": None
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found or not locked by you")
    
    return {"message": "Call released"}


@router.post("/workstation/record-call")
async def record_call_attempt(
    request: Request,
    call: CallRecord
):
    """Record a call attempt with disposition"""
    db = request.app.state.db
    
    queue_item = await db.cati_queue.find_one({"id": call.queue_item_id})
    if not queue_item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    project = await db.cati_projects.find_one({"id": queue_item["project_id"]})
    
    # Create call record
    call_record = {
        "id": f"call_{call.queue_item_id}_{int(datetime.now(timezone.utc).timestamp())}",
        "queue_item_id": call.queue_item_id,
        "project_id": queue_item["project_id"],
        "interviewer_id": call.interviewer_id,
        "start_time": call.start_time,
        "end_time": call.end_time or datetime.now(timezone.utc),
        "duration_seconds": call.duration_seconds,
        "disposition": call.disposition,
        "notes": call.notes,
        "callback_datetime": call.callback_datetime,
        "attempt_number": queue_item["attempt_count"] + 1
    }
    
    await db.cati_calls.insert_one(call_record)
    
    # Update queue item
    new_attempt_count = queue_item["attempt_count"] + 1
    
    # Determine new status and next actions
    update_fields = {
        "attempt_count": new_attempt_count,
        "last_attempt_at": datetime.now(timezone.utc),
        "last_disposition": call.disposition,
        "locked_by": None,
        "locked_at": None
    }
    
    # Determine outcome
    if call.disposition == DispositionCode.COMPLETE:
        update_fields["status"] = QueueItemStatus.COMPLETED
        update_fields["completed_at"] = datetime.now(timezone.utc)
        update_fields["submission_id"] = call_record.get("submission_id")
    
    elif call.disposition == DispositionCode.CALLBACK_REQUESTED:
        update_fields["status"] = QueueItemStatus.AVAILABLE
        update_fields["priority"] = CallPriority.URGENT
        update_fields["next_call_after"] = call.callback_datetime
    
    elif call.disposition in [
        DispositionCode.HARD_REFUSAL,
        DispositionCode.INELIGIBLE,
        DispositionCode.DECEASED,
        DispositionCode.DISCONNECTED
    ]:
        update_fields["status"] = QueueItemStatus.EXHAUSTED
        update_fields["final_disposition"] = call.disposition
    
    elif new_attempt_count >= project.get("max_call_attempts", 5):
        update_fields["status"] = QueueItemStatus.EXHAUSTED
        update_fields["final_disposition"] = "max_attempts_reached"
    
    else:
        # Non-contact or soft refusal - schedule retry
        update_fields["status"] = QueueItemStatus.AVAILABLE
        min_hours = project.get("min_hours_between_attempts", 2)
        update_fields["next_call_after"] = datetime.now(timezone.utc) + timedelta(hours=min_hours)
        
        # Lower priority after failed attempts
        if new_attempt_count > 2:
            update_fields["priority"] = CallPriority.LOW
    
    # Add to call history
    history_entry = {
        "call_id": call_record["id"],
        "disposition": call.disposition,
        "timestamp": datetime.now(timezone.utc),
        "interviewer_id": call.interviewer_id,
        "notes": call.notes
    }
    
    await db.cati_queue.update_one(
        {"id": call.queue_item_id},
        {
            "$set": update_fields,
            "$push": {"call_history": history_entry}
        }
    )
    
    return {
        "message": "Call recorded",
        "call_id": call_record["id"],
        "new_status": update_fields.get("status"),
        "next_call_after": update_fields.get("next_call_after")
    }


@router.get("/workstation/{interviewer_id}/stats")
async def get_interviewer_stats(
    request: Request,
    interviewer_id: str,
    project_id: str,
    date: Optional[str] = None
):
    """Get interviewer statistics for a project"""
    db = request.app.state.db
    
    if date:
        start_date = datetime.fromisoformat(date)
    else:
        start_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    end_date = start_date + timedelta(days=1)
    
    # Get call stats
    calls = await db.cati_calls.find({
        "project_id": project_id,
        "interviewer_id": interviewer_id,
        "start_time": {"$gte": start_date, "$lt": end_date}
    }).to_list(1000)
    
    total_calls = len(calls)
    completed = len([c for c in calls if c["disposition"] == DispositionCode.COMPLETE])
    contacts = len([c for c in calls if c["disposition"] not in [
        DispositionCode.NO_ANSWER, DispositionCode.BUSY, 
        DispositionCode.VOICEMAIL, DispositionCode.DISCONNECTED
    ]])
    
    total_duration = sum(c.get("duration_seconds", 0) or 0 for c in calls)
    avg_duration = total_duration / total_calls if total_calls > 0 else 0
    
    # Disposition breakdown
    disposition_counts = {}
    for c in calls:
        disp = c["disposition"]
        disposition_counts[disp] = disposition_counts.get(disp, 0) + 1
    
    return {
        "interviewer_id": interviewer_id,
        "project_id": project_id,
        "date": start_date.isoformat(),
        "stats": {
            "total_calls": total_calls,
            "completed": completed,
            "contacts": contacts,
            "completion_rate": (completed / total_calls * 100) if total_calls > 0 else 0,
            "contact_rate": (contacts / total_calls * 100) if total_calls > 0 else 0,
            "total_talk_time_minutes": total_duration / 60,
            "avg_call_duration_seconds": avg_duration
        },
        "disposition_breakdown": disposition_counts
    }


# ============ Callbacks Management ============

@router.get("/projects/{project_id}/callbacks")
async def get_scheduled_callbacks(
    request: Request,
    project_id: str,
    interviewer_id: Optional[str] = None,
    date: Optional[str] = None
):
    """Get scheduled callbacks"""
    db = request.app.state.db
    
    query = {
        "project_id": project_id,
        "status": QueueItemStatus.AVAILABLE,
        "priority": CallPriority.URGENT,
        "next_call_after": {"$ne": None}
    }
    
    if interviewer_id:
        # Get callbacks for specific interviewer (last called by them)
        query["call_history.interviewer_id"] = interviewer_id
    
    if date:
        target_date = datetime.fromisoformat(date)
        query["next_call_after"] = {
            "$gte": target_date,
            "$lt": target_date + timedelta(days=1)
        }
    
    callbacks = await db.cati_queue.find(query).sort("next_call_after", 1).to_list(100)
    
    for cb in callbacks:
        cb["_id"] = str(cb.get("_id", ""))
        if cb.get("next_call_after"):
            cb["next_call_after"] = cb["next_call_after"].isoformat()
    
    return {"callbacks": callbacks, "total": len(callbacks)}


@router.put("/queue/{queue_item_id}/reschedule")
async def reschedule_callback(
    request: Request,
    queue_item_id: str,
    new_datetime: datetime,
    notes: Optional[str] = None
):
    """Reschedule a callback"""
    db = request.app.state.db
    
    result = await db.cati_queue.update_one(
        {"id": queue_item_id},
        {
            "$set": {
                "next_call_after": new_datetime,
                "priority": CallPriority.URGENT
            },
            "$push": {
                "call_history": {
                    "type": "reschedule",
                    "new_time": new_datetime,
                    "notes": notes,
                    "timestamp": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    
    return {"message": "Callback rescheduled"}


# ============ Project Statistics ============

async def calculate_project_stats(db, project_id: str) -> Dict:
    """Calculate project statistics"""
    status_counts = await db.cati_queue.aggregate([
        {"$match": {"project_id": project_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    stats = {
        "total_cases": 0,
        "completed": 0,
        "in_progress": 0,
        "pending": 0,
        "exhausted": 0
    }
    
    for s in status_counts:
        status = s["_id"]
        count = s["count"]
        stats["total_cases"] += count
        
        if status == QueueItemStatus.COMPLETED:
            stats["completed"] = count
        elif status == QueueItemStatus.LOCKED:
            stats["in_progress"] = count
        elif status == QueueItemStatus.AVAILABLE:
            stats["pending"] = count
        elif status == QueueItemStatus.EXHAUSTED:
            stats["exhausted"] = count
    
    # Calculate rates
    if stats["total_cases"] > 0:
        stats["completion_rate"] = round((stats["completed"] / stats["total_cases"]) * 100, 1)
    else:
        stats["completion_rate"] = 0
    
    # Contact rate from calls
    total_calls = await db.cati_calls.count_documents({"project_id": project_id})
    contact_calls = await db.cati_calls.count_documents({
        "project_id": project_id,
        "disposition": {"$nin": [
            DispositionCode.NO_ANSWER,
            DispositionCode.BUSY,
            DispositionCode.VOICEMAIL,
            DispositionCode.DISCONNECTED
        ]}
    })
    
    stats["total_calls"] = total_calls
    stats["contact_rate"] = round((contact_calls / total_calls * 100), 1) if total_calls > 0 else 0
    
    return stats


@router.get("/projects/{project_id}/stats/detailed")
async def get_detailed_project_stats(
    request: Request,
    project_id: str
):
    """Get detailed project statistics"""
    db = request.app.state.db
    
    project = await db.cati_projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    stats = await calculate_project_stats(db, project_id)
    
    # Disposition breakdown
    disposition_counts = await db.cati_calls.aggregate([
        {"$match": {"project_id": project_id}},
        {"$group": {"_id": "$disposition", "count": {"$sum": 1}}}
    ]).to_list(50)
    
    # Hourly call distribution
    hourly_calls = await db.cati_calls.aggregate([
        {"$match": {"project_id": project_id}},
        {"$group": {
            "_id": {"$hour": "$start_time"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(24)
    
    # Interviewer performance
    interviewer_stats = await db.cati_calls.aggregate([
        {"$match": {"project_id": project_id}},
        {"$group": {
            "_id": "$interviewer_id",
            "total_calls": {"$sum": 1},
            "completed": {
                "$sum": {"$cond": [{"$eq": ["$disposition", "complete"]}, 1, 0]}
            },
            "total_duration": {"$sum": {"$ifNull": ["$duration_seconds", 0]}}
        }}
    ]).to_list(100)
    
    return {
        "project_id": project_id,
        "overview": stats,
        "disposition_breakdown": {d["_id"]: d["count"] for d in disposition_counts},
        "hourly_distribution": {str(h["_id"]): h["count"] for h in hourly_calls},
        "interviewer_performance": interviewer_stats
    }
