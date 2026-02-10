"""DataPulse - Review & Correction Workflows Routes
Structured approval flow for submissions with correction requests
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from enum import Enum
import uuid

from auth import get_current_user

router = APIRouter(prefix="/review", tags=["Review Workflows"])


def gen_id():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


# ============= ENUMS =============

class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    CORRECTION_REQUESTED = "correction_requested"
    CORRECTED = "corrected"


class CorrectionPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ============= MODELS =============

class ReviewAssignment(BaseModel):
    """Assign a reviewer to submissions"""
    id: str = Field(default_factory=gen_id)
    form_id: str
    reviewer_id: str
    assigned_by: str
    assignment_type: str = "manual"  # "manual", "auto", "random"
    submission_filter: Dict[str, Any] = Field(default_factory=dict)  # Filter criteria
    max_submissions: Optional[int] = None
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: Optional[datetime] = None
    is_active: bool = True


class CorrectionRequest(BaseModel):
    """Request for correction on a submission"""
    id: str = Field(default_factory=gen_id)
    submission_id: str
    form_id: str
    org_id: str
    requested_by: str
    assigned_to: str  # Enumerator who needs to correct
    priority: CorrectionPriority = CorrectionPriority.MEDIUM
    field_corrections: List[Dict[str, Any]] = Field(default_factory=list)
    general_notes: Optional[str] = None
    deadline: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utc_now)
    status: str = "pending"  # "pending", "in_progress", "completed", "expired"
    completed_at: Optional[datetime] = None
    response_notes: Optional[str] = None


class FieldCorrection(BaseModel):
    """Correction request for a specific field"""
    field_id: str
    field_name: str
    current_value: Any
    issue_description: str
    suggested_value: Optional[Any] = None
    is_required: bool = True


class CorrectionRequestCreate(BaseModel):
    submission_id: str
    priority: CorrectionPriority = CorrectionPriority.MEDIUM
    field_corrections: List[FieldCorrection]
    general_notes: Optional[str] = None
    deadline: Optional[str] = None  # ISO datetime string


class CorrectionResponse(BaseModel):
    """Enumerator's response to a correction request"""
    corrected_values: Dict[str, Any]  # field_id -> new value
    response_notes: Optional[str] = None


class ReviewDecision(BaseModel):
    """Reviewer's decision on a submission"""
    decision: str  # "approve", "reject", "request_correction"
    notes: Optional[str] = None
    quality_flags: List[str] = Field(default_factory=list)
    field_comments: Dict[str, str] = Field(default_factory=dict)  # field_id -> comment


class ReviewWorkflowConfig(BaseModel):
    """Configuration for review workflow on a form"""
    enabled: bool = True
    auto_assign_reviewers: bool = False
    require_review_before_export: bool = True
    allow_self_review: bool = False
    min_reviewers: int = 1
    approval_threshold: float = 1.0  # Percentage of reviewers that must approve
    auto_approve_quality_score: Optional[float] = None  # Auto-approve if score >= this
    auto_reject_quality_score: Optional[float] = None  # Auto-reject if score <= this
    correction_deadline_hours: int = 48
    escalation_after_hours: int = 72
    notification_settings: Dict[str, bool] = Field(default_factory=lambda: {
        "on_submission": True,
        "on_review": True,
        "on_correction_request": True,
        "on_deadline_approaching": True
    })


class ReviewWorkflowConfigCreate(BaseModel):
    form_id: str
    config: ReviewWorkflowConfig


class SubmissionReviewOut(BaseModel):
    submission_id: str
    form_id: str
    status: str
    submitted_by: str
    submitted_at: datetime
    quality_score: Optional[float]
    reviewer_id: Optional[str]
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    correction_requests: List[Dict[str, Any]]
    review_history: List[Dict[str, Any]]


# ============= CONFIG ENDPOINTS =============

@router.post("/config")
async def create_or_update_workflow_config(
    request: Request,
    data: ReviewWorkflowConfigCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update review workflow configuration for a form"""
    db = request.app.state.db
    
    # Verify form exists
    form = await db.forms.find_one({"id": data.form_id}, {"_id": 0, "org_id": 1})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    config_doc = {
        "form_id": data.form_id,
        "org_id": form["org_id"],
        "config": data.config.model_dump(),
        "updated_by": current_user["user_id"],
        "updated_at": utc_now().isoformat()
    }
    
    await db.review_workflow_configs.update_one(
        {"form_id": data.form_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Review workflow configuration saved"}


@router.get("/config/{form_id}")
async def get_workflow_config(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get review workflow configuration for a form"""
    db = request.app.state.db
    
    config = await db.review_workflow_configs.find_one(
        {"form_id": form_id},
        {"_id": 0}
    )
    
    if not config:
        return {
            "form_id": form_id,
            "config": ReviewWorkflowConfig().model_dump()
        }
    
    return config


# ============= REVIEW QUEUE ENDPOINTS =============

@router.get("/queue")
async def get_review_queue(
    request: Request,
    form_id: Optional[str] = None,
    status: Optional[str] = None,
    reviewer_id: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get submissions pending review"""
    db = request.app.state.db
    
    # Build query
    query = {"status": {"$in": ["pending", "in_review", "correction_requested"]}}
    
    if form_id:
        query["form_id"] = form_id
    if status:
        query["status"] = status
    if reviewer_id:
        query["reviewer_id"] = reviewer_id
    
    # Get submissions
    cursor = db.submissions.find(
        query,
        {"_id": 0}
    ).sort([
        ("quality_score", 1),  # Lower quality first
        ("submitted_at", 1)   # Older first
    ]).skip(skip).limit(limit)
    
    submissions = await cursor.to_list(length=limit)
    total = await db.submissions.count_documents(query)
    
    # Enrich with correction requests
    for sub in submissions:
        corrections = await db.correction_requests.find(
            {"submission_id": sub["id"], "status": {"$ne": "completed"}},
            {"_id": 0}
        ).to_list(10)
        sub["pending_corrections"] = len(corrections)
    
    return {
        "submissions": submissions,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/queue/stats")
async def get_queue_stats(
    request: Request,
    form_id: Optional[str] = None,
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get review queue statistics"""
    db = request.app.state.db
    
    match_query = {}
    if form_id:
        match_query["form_id"] = form_id
    if org_id:
        match_query["org_id"] = org_id
    
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }
        }
    ]
    
    result = await db.submissions.aggregate(pipeline).to_list(20)
    
    status_counts = {r["_id"]: r["count"] for r in result}
    
    # Get correction request stats
    correction_pipeline = [
        {"$match": {**match_query, "status": {"$ne": "completed"}}},
        {"$count": "pending_corrections"}
    ]
    correction_result = await db.correction_requests.aggregate(correction_pipeline).to_list(1)
    pending_corrections = correction_result[0]["pending_corrections"] if correction_result else 0
    
    return {
        "pending": status_counts.get("pending", 0),
        "in_review": status_counts.get("in_review", 0),
        "approved": status_counts.get("approved", 0),
        "rejected": status_counts.get("rejected", 0),
        "correction_requested": status_counts.get("correction_requested", 0),
        "pending_corrections": pending_corrections,
        "total": sum(status_counts.values())
    }


# ============= REVIEW ACTION ENDPOINTS =============

@router.post("/submissions/{submission_id}/claim")
async def claim_submission(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Claim a submission for review"""
    db = request.app.state.db
    
    result = await db.submissions.update_one(
        {
            "id": submission_id,
            "status": {"$in": ["pending", "corrected"]},
            "$or": [
                {"reviewer_id": None},
                {"reviewer_id": {"$exists": False}}
            ]
        },
        {
            "$set": {
                "reviewer_id": current_user["user_id"],
                "status": "in_review",
                "review_started_at": utc_now().isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=400,
            detail="Submission not available for review or already claimed"
        )
    
    return {"success": True, "message": "Submission claimed for review"}


@router.post("/submissions/{submission_id}/release")
async def release_submission(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Release a claimed submission back to the queue"""
    db = request.app.state.db
    
    result = await db.submissions.update_one(
        {
            "id": submission_id,
            "reviewer_id": current_user["user_id"],
            "status": "in_review"
        },
        {
            "$set": {
                "status": "pending"
            },
            "$unset": {
                "reviewer_id": "",
                "review_started_at": ""
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail="Cannot release this submission")
    
    return {"success": True, "message": "Submission released"}


@router.post("/submissions/{submission_id}/decide")
async def submit_review_decision(
    request: Request,
    submission_id: str,
    decision: ReviewDecision,
    current_user: dict = Depends(get_current_user)
):
    """Submit a review decision for a submission"""
    db = request.app.state.db
    
    # Get submission
    submission = await db.submissions.find_one(
        {"id": submission_id},
        {"_id": 0}
    )
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Map decision to status
    status_map = {
        "approve": "approved",
        "reject": "rejected",
        "request_correction": "correction_requested"
    }
    
    new_status = status_map.get(decision.decision)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid decision")
    
    # Create review history entry
    review_entry = {
        "reviewer_id": current_user["user_id"],
        "decision": decision.decision,
        "notes": decision.notes,
        "quality_flags": decision.quality_flags,
        "field_comments": decision.field_comments,
        "timestamp": utc_now().isoformat()
    }
    
    # Update submission
    update_doc = {
        "$set": {
            "status": new_status,
            "reviewer_id": current_user["user_id"],
            "reviewed_at": utc_now().isoformat(),
            "review_notes": decision.notes,
            "quality_flags": decision.quality_flags
        },
        "$push": {
            "review_history": review_entry
        }
    }
    
    await db.submissions.update_one({"id": submission_id}, update_doc)
    
    # Log audit trail
    await db.audit_logs.insert_one({
        "entity_type": "submission",
        "entity_id": submission_id,
        "action": f"review_{decision.decision}",
        "user_id": current_user["user_id"],
        "timestamp": utc_now().isoformat(),
        "details": {
            "decision": decision.decision,
            "notes": decision.notes,
            "quality_flags": decision.quality_flags
        }
    })
    
    return {
        "success": True,
        "message": f"Submission {decision.decision}d",
        "new_status": new_status
    }


# ============= CORRECTION REQUEST ENDPOINTS =============

@router.post("/corrections")
async def create_correction_request(
    request: Request,
    data: CorrectionRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a correction request for a submission"""
    db = request.app.state.db
    
    # Get submission
    submission = await db.submissions.find_one(
        {"id": data.submission_id},
        {"_id": 0}
    )
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Create correction request
    correction = CorrectionRequest(
        submission_id=data.submission_id,
        form_id=submission["form_id"],
        org_id=submission["org_id"],
        requested_by=current_user["user_id"],
        assigned_to=submission["submitted_by"],
        priority=data.priority,
        field_corrections=[fc.model_dump() for fc in data.field_corrections],
        general_notes=data.general_notes,
        deadline=datetime.fromisoformat(data.deadline) if data.deadline else None
    )
    
    correction_dict = correction.model_dump()
    correction_dict["created_at"] = correction_dict["created_at"].isoformat()
    if correction_dict.get("deadline"):
        correction_dict["deadline"] = correction_dict["deadline"].isoformat()
    
    await db.correction_requests.insert_one(correction_dict)
    
    # Update submission status
    await db.submissions.update_one(
        {"id": data.submission_id},
        {"$set": {"status": "correction_requested"}}
    )
    
    return {
        "success": True,
        "correction_id": correction.id,
        "message": "Correction request created"
    }


@router.get("/corrections")
async def list_correction_requests(
    request: Request,
    submission_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List correction requests"""
    db = request.app.state.db
    
    query = {}
    if submission_id:
        query["submission_id"] = submission_id
    if assigned_to:
        query["assigned_to"] = assigned_to
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    
    cursor = db.correction_requests.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    corrections = await cursor.to_list(length=limit)
    total = await db.correction_requests.count_documents(query)
    
    return {
        "corrections": corrections,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/corrections/{correction_id}")
async def get_correction_request(
    request: Request,
    correction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific correction request"""
    db = request.app.state.db
    
    correction = await db.correction_requests.find_one(
        {"id": correction_id},
        {"_id": 0}
    )
    
    if not correction:
        raise HTTPException(status_code=404, detail="Correction request not found")
    
    return correction


@router.post("/corrections/{correction_id}/respond")
async def respond_to_correction(
    request: Request,
    correction_id: str,
    response: CorrectionResponse,
    current_user: dict = Depends(get_current_user)
):
    """Submit a response to a correction request (enumerator)"""
    db = request.app.state.db
    
    # Get correction request
    correction = await db.correction_requests.find_one(
        {"id": correction_id},
        {"_id": 0}
    )
    
    if not correction:
        raise HTTPException(status_code=404, detail="Correction request not found")
    
    # Verify user is the assignee
    if correction["assigned_to"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You are not assigned to this correction")
    
    # Update submission data with corrected values
    submission_update = {}
    for field_id, value in response.corrected_values.items():
        submission_update[f"data.{field_id}"] = value
    
    if submission_update:
        await db.submissions.update_one(
            {"id": correction["submission_id"]},
            {
                "$set": {
                    **submission_update,
                    "status": "corrected",
                    "last_corrected_at": utc_now().isoformat()
                }
            }
        )
    
    # Update correction request
    await db.correction_requests.update_one(
        {"id": correction_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": utc_now().isoformat(),
                "response_notes": response.response_notes,
                "corrected_values": response.corrected_values
            }
        }
    )
    
    # Log audit trail
    await db.audit_logs.insert_one({
        "entity_type": "correction_request",
        "entity_id": correction_id,
        "action": "correction_submitted",
        "user_id": current_user["user_id"],
        "timestamp": utc_now().isoformat(),
        "details": {
            "corrected_fields": list(response.corrected_values.keys()),
            "notes": response.response_notes
        }
    })
    
    return {"success": True, "message": "Correction submitted"}


@router.delete("/corrections/{correction_id}")
async def cancel_correction_request(
    request: Request,
    correction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a correction request"""
    db = request.app.state.db
    
    result = await db.correction_requests.update_one(
        {"id": correction_id, "status": "pending"},
        {"$set": {"status": "cancelled"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Correction request not found or not pending")
    
    return {"success": True, "message": "Correction request cancelled"}


# ============= ASSIGNMENT ENDPOINTS =============

@router.post("/assignments")
async def create_reviewer_assignment(
    request: Request,
    form_id: str,
    reviewer_id: str,
    assignment_type: str = "manual",
    max_submissions: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Assign a reviewer to a form's submissions"""
    db = request.app.state.db
    
    assignment = ReviewAssignment(
        form_id=form_id,
        reviewer_id=reviewer_id,
        assigned_by=current_user["user_id"],
        assignment_type=assignment_type,
        max_submissions=max_submissions
    )
    
    assignment_dict = assignment.model_dump()
    assignment_dict["created_at"] = assignment_dict["created_at"].isoformat()
    if assignment_dict.get("expires_at"):
        assignment_dict["expires_at"] = assignment_dict["expires_at"].isoformat()
    
    await db.review_assignments.insert_one(assignment_dict)
    
    return {"success": True, "assignment_id": assignment.id}


@router.get("/assignments")
async def list_assignments(
    request: Request,
    form_id: Optional[str] = None,
    reviewer_id: Optional[str] = None,
    is_active: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """List reviewer assignments"""
    db = request.app.state.db
    
    query = {"is_active": is_active}
    if form_id:
        query["form_id"] = form_id
    if reviewer_id:
        query["reviewer_id"] = reviewer_id
    
    assignments = await db.review_assignments.find(
        query,
        {"_id": 0}
    ).to_list(100)
    
    return {"assignments": assignments}


@router.delete("/assignments/{assignment_id}")
async def delete_assignment(
    request: Request,
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a reviewer assignment"""
    db = request.app.state.db
    
    result = await db.review_assignments.update_one(
        {"id": assignment_id},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return {"success": True, "message": "Assignment deactivated"}
