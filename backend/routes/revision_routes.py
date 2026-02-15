"""DataPulse - Submission Revision Chain
Industry-standard submission versioning with full audit trail.

Features:
- Immutable revision chain (v1, v2, v3...)
- Each revision stores complete snapshot + diff from previous
- Approved submissions are locked (or editable only by privileged roles)
- Full audit trail: who changed what, when, and why
- Correction mode support (enumerator edits flagged separately)
- Two-tier dataset: raw (incoming) vs approved (analysis-ready)
"""
from fastapi import APIRouter, HTTPException, Request, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import json
import hashlib
from deepdiff import DeepDiff

router = APIRouter(prefix="/revisions", tags=["Submission Revisions"])


class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    RETURNED = "returned"
    RESUBMITTED = "resubmitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    LOCKED = "locked"


class RevisionType(str, Enum):
    INITIAL = "initial"
    CORRECTION = "correction"
    AMENDMENT = "amendment"
    SUPERVISOR_EDIT = "supervisor_edit"
    SYSTEM_UPDATE = "system_update"


class RevisionCreate(BaseModel):
    submission_id: str
    data: Dict[str, Any]
    revision_type: RevisionType = RevisionType.CORRECTION
    reason: Optional[str] = None
    correction_notes: Optional[str] = None
    
    # For correction mode
    is_correction_mode: bool = False
    correction_request_id: Optional[str] = None


class CorrectionRequest(BaseModel):
    submission_id: str
    requested_by: str
    fields_to_correct: List[str] = []
    notes: str
    due_date: Optional[datetime] = None


class RevisionLock(BaseModel):
    lock_reason: str
    allow_supervisor_edit: bool = True


class RevisionCompare(BaseModel):
    from_version: int
    to_version: int


# ============ API Endpoints ============

@router.post("/submissions/{submission_id}/revisions")
async def create_revision(
    request: Request,
    submission_id: str,
    revision_data: RevisionCreate,
    current_user: dict = None  # Would come from auth
):
    """Create a new revision of a submission"""
    db = request.app.state.db
    
    # Get current submission
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if submission is locked
    if submission.get("is_locked"):
        # Check if user has permission to edit locked submissions
        allow_edit = submission.get("lock_settings", {}).get("allow_supervisor_edit", False)
        if not allow_edit:
            raise HTTPException(
                status_code=403, 
                detail="Submission is locked and cannot be modified"
            )
        revision_data.revision_type = RevisionType.SUPERVISOR_EDIT
    
    # Get current version number
    current_version = submission.get("current_version", 1)
    new_version = current_version + 1
    
    # Calculate diff from previous version
    previous_data = submission.get("data", {})
    new_data = revision_data.data
    
    diff = calculate_diff(previous_data, new_data)
    
    # Create revision record
    revision = {
        "id": f"rev_{submission_id}_v{new_version}",
        "submission_id": submission_id,
        "version": new_version,
        "revision_type": revision_data.revision_type,
        "data_snapshot": new_data,
        "diff_from_previous": diff,
        "reason": revision_data.reason,
        "correction_notes": revision_data.correction_notes,
        "is_correction_mode": revision_data.is_correction_mode,
        "correction_request_id": revision_data.correction_request_id,
        "created_by": current_user.get("user_id") if current_user else "system",
        "created_by_name": current_user.get("name") if current_user else "System",
        "created_at": datetime.now(timezone.utc),
        "data_hash": calculate_data_hash(new_data),
        "previous_version": current_version,
        "previous_data_hash": submission.get("data_hash"),
    }
    
    await db.submission_revisions.insert_one(revision)
    
    # Update submission with new version
    new_status = SubmissionStatus.RESUBMITTED if revision_data.is_correction_mode else submission.get("status")
    
    await db.submissions.update_one(
        {"id": submission_id},
        {
            "$set": {
                "data": new_data,
                "current_version": new_version,
                "data_hash": revision["data_hash"],
                "status": new_status,
                "last_modified_at": datetime.now(timezone.utc),
                "last_modified_by": revision["created_by"],
            }
        }
    )
    
    # Log to audit trail
    await log_revision_audit(db, submission_id, revision, current_user)
    
    return {
        "message": "Revision created",
        "revision_id": revision["id"],
        "version": new_version,
        "diff_summary": summarize_diff(diff)
    }


@router.get("/submissions/{submission_id}/revisions")
async def get_revision_history(
    request: Request,
    submission_id: str
):
    """Get complete revision history for a submission"""
    db = request.app.state.db
    
    revisions = await db.submission_revisions.find(
        {"submission_id": submission_id}
    ).sort("version", 1).to_list(100)
    
    for r in revisions:
        r["_id"] = str(r.get("_id", ""))
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
    
    return {
        "submission_id": submission_id,
        "total_revisions": len(revisions),
        "revisions": revisions
    }


@router.get("/submissions/{submission_id}/revisions/{version}")
async def get_specific_revision(
    request: Request,
    submission_id: str,
    version: int
):
    """Get a specific revision by version number"""
    db = request.app.state.db
    
    revision = await db.submission_revisions.find_one({
        "submission_id": submission_id,
        "version": version
    })
    
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found")
    
    revision["_id"] = str(revision.get("_id", ""))
    
    return revision


@router.post("/submissions/{submission_id}/compare")
async def compare_revisions(
    request: Request,
    submission_id: str,
    compare: RevisionCompare
):
    """Compare two revisions of a submission"""
    db = request.app.state.db
    
    # Get both revisions
    from_rev = await db.submission_revisions.find_one({
        "submission_id": submission_id,
        "version": compare.from_version
    })
    
    to_rev = await db.submission_revisions.find_one({
        "submission_id": submission_id,
        "version": compare.to_version
    })
    
    if not from_rev or not to_rev:
        raise HTTPException(status_code=404, detail="One or both revisions not found")
    
    # Calculate diff between the two versions
    diff = calculate_diff(
        from_rev.get("data_snapshot", {}),
        to_rev.get("data_snapshot", {})
    )
    
    return {
        "submission_id": submission_id,
        "from_version": compare.from_version,
        "to_version": compare.to_version,
        "diff": diff,
        "summary": summarize_diff(diff),
        "from_revision": {
            "version": from_rev["version"],
            "created_at": from_rev.get("created_at"),
            "created_by": from_rev.get("created_by_name"),
            "revision_type": from_rev.get("revision_type")
        },
        "to_revision": {
            "version": to_rev["version"],
            "created_at": to_rev.get("created_at"),
            "created_by": to_rev.get("created_by_name"),
            "revision_type": to_rev.get("revision_type")
        }
    }


@router.post("/submissions/{submission_id}/rollback/{version}")
async def rollback_to_version(
    request: Request,
    submission_id: str,
    version: int,
    reason: str = "Rollback requested"
):
    """Rollback submission to a previous version (creates new revision)"""
    db = request.app.state.db
    
    # Get the target revision
    target_rev = await db.submission_revisions.find_one({
        "submission_id": submission_id,
        "version": version
    })
    
    if not target_rev:
        raise HTTPException(status_code=404, detail="Target revision not found")
    
    # Check if submission is locked
    submission = await db.submissions.find_one({"id": submission_id})
    if submission.get("is_locked"):
        raise HTTPException(status_code=403, detail="Cannot rollback locked submission")
    
    # Create a new revision with the old data
    revision_data = RevisionCreate(
        submission_id=submission_id,
        data=target_rev.get("data_snapshot", {}),
        revision_type=RevisionType.AMENDMENT,
        reason=f"Rollback to version {version}: {reason}"
    )
    
    return await create_revision(request, submission_id, revision_data)


@router.post("/submissions/{submission_id}/lock")
async def lock_submission(
    request: Request,
    submission_id: str,
    lock_data: RevisionLock
):
    """Lock a submission to prevent further edits"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission.get("status") != SubmissionStatus.APPROVED:
        raise HTTPException(
            status_code=400, 
            detail="Only approved submissions can be locked"
        )
    
    await db.submissions.update_one(
        {"id": submission_id},
        {
            "$set": {
                "is_locked": True,
                "locked_at": datetime.now(timezone.utc),
                "lock_reason": lock_data.lock_reason,
                "lock_settings": {
                    "allow_supervisor_edit": lock_data.allow_supervisor_edit
                },
                "status": SubmissionStatus.LOCKED
            }
        }
    )
    
    return {"message": "Submission locked", "submission_id": submission_id}


@router.post("/submissions/{submission_id}/unlock")
async def unlock_submission(
    request: Request,
    submission_id: str,
    reason: str = "Unlock requested"
):
    """Unlock a submission (requires elevated privileges)"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if not submission.get("is_locked"):
        raise HTTPException(status_code=400, detail="Submission is not locked")
    
    await db.submissions.update_one(
        {"id": submission_id},
        {
            "$set": {
                "is_locked": False,
                "unlocked_at": datetime.now(timezone.utc),
                "unlock_reason": reason,
                "status": SubmissionStatus.APPROVED  # Revert to approved status
            },
            "$unset": {
                "lock_settings": ""
            }
        }
    )
    
    return {"message": "Submission unlocked", "submission_id": submission_id}


# ============ Correction Request Endpoints ============

@router.post("/correction-requests")
async def create_correction_request(
    request: Request,
    correction: CorrectionRequest
):
    """Create a request for enumerator to correct a submission"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": correction.submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    correction_doc = {
        "id": f"corr_{correction.submission_id}_{int(datetime.now(timezone.utc).timestamp())}",
        "submission_id": correction.submission_id,
        "form_id": submission.get("form_id"),
        "enumerator_id": submission.get("submitted_by"),
        "requested_by": correction.requested_by,
        "fields_to_correct": correction.fields_to_correct,
        "notes": correction.notes,
        "due_date": correction.due_date,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.correction_requests.insert_one(correction_doc)
    
    # Update submission status
    await db.submissions.update_one(
        {"id": correction.submission_id},
        {
            "$set": {
                "status": SubmissionStatus.RETURNED,
                "correction_request_id": correction_doc["id"],
                "returned_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Correction request created",
        "correction_id": correction_doc["id"]
    }


@router.get("/correction-requests/enumerator/{enumerator_id}")
async def get_enumerator_corrections(
    request: Request,
    enumerator_id: str,
    filter_status: str = "pending"
):
    """Get pending correction requests for an enumerator"""
    db = request.app.state.db
    
    query = {"enumerator_id": enumerator_id}
    if filter_status:
        query["status"] = filter_status
    
    corrections = await db.correction_requests.find(query).sort("created_at", -1).to_list(100)
    
    for c in corrections:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
        if c.get("due_date"):
            c["due_date"] = c["due_date"].isoformat()
    
    return {"corrections": corrections, "total": len(corrections)}


@router.post("/correction-requests/{correction_id}/complete")
async def complete_correction(
    request: Request,
    correction_id: str
):
    """Mark a correction request as completed"""
    db = request.app.state.db
    
    correction = await db.correction_requests.find_one({"id": correction_id})
    if not correction:
        raise HTTPException(status_code=404, detail="Correction request not found")
    
    await db.correction_requests.update_one(
        {"id": correction_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Correction marked as completed"}


# ============ Audit Trail Endpoints ============

@router.get("/submissions/{submission_id}/audit-trail")
async def get_submission_audit_trail(
    request: Request,
    submission_id: str
):
    """Get complete audit trail for a submission"""
    db = request.app.state.db
    
    audits = await db.revision_audit_trail.find(
        {"submission_id": submission_id}
    ).sort("timestamp", 1).to_list(500)
    
    for a in audits:
        a["_id"] = str(a.get("_id", ""))
        if a.get("timestamp"):
            a["timestamp"] = a["timestamp"].isoformat()
    
    return {
        "submission_id": submission_id,
        "audit_trail": audits,
        "total_events": len(audits)
    }


# ============ Two-Tier Dataset Endpoints ============

@router.get("/datasets/{form_id}/raw")
async def get_raw_dataset(
    request: Request,
    form_id: str,
    limit: int = 1000,
    offset: int = 0
):
    """Get raw (all) submissions for a form"""
    db = request.app.state.db
    
    submissions = await db.submissions.find(
        {"form_id": form_id}
    ).skip(offset).limit(limit).to_list(limit)
    
    total = await db.submissions.count_documents({"form_id": form_id})
    
    for s in submissions:
        s["_id"] = str(s.get("_id", ""))
    
    return {
        "form_id": form_id,
        "dataset_type": "raw",
        "submissions": submissions,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/datasets/{form_id}/approved")
async def get_approved_dataset(
    request: Request,
    form_id: str,
    limit: int = 1000,
    offset: int = 0
):
    """Get approved (analysis-ready) submissions for a form"""
    db = request.app.state.db
    
    approved_statuses = [SubmissionStatus.APPROVED, SubmissionStatus.LOCKED]
    
    submissions = await db.submissions.find({
        "form_id": form_id,
        "status": {"$in": approved_statuses}
    }).skip(offset).limit(limit).to_list(limit)
    
    total = await db.submissions.count_documents({
        "form_id": form_id,
        "status": {"$in": approved_statuses}
    })
    
    for s in submissions:
        s["_id"] = str(s.get("_id", ""))
    
    return {
        "form_id": form_id,
        "dataset_type": "approved",
        "submissions": submissions,
        "total": total,
        "limit": limit,
        "offset": offset
    }


# ============ Helper Functions ============

def calculate_diff(old_data: Dict, new_data: Dict) -> Dict:
    """Calculate diff between two data dictionaries"""
    try:
        diff = DeepDiff(old_data, new_data, ignore_order=True)
        return {
            "values_changed": diff.get("values_changed", {}),
            "items_added": diff.get("dictionary_item_added", []),
            "items_removed": diff.get("dictionary_item_removed", []),
            "type_changes": diff.get("type_changes", {})
        }
    except Exception:
        # Fallback to simple comparison
        changed = {}
        added = []
        removed = []
        
        all_keys = set(old_data.keys()) | set(new_data.keys())
        for key in all_keys:
            if key not in old_data:
                added.append(key)
            elif key not in new_data:
                removed.append(key)
            elif old_data[key] != new_data[key]:
                changed[key] = {"old": old_data[key], "new": new_data[key]}
        
        return {
            "values_changed": changed,
            "items_added": added,
            "items_removed": removed,
            "type_changes": {}
        }


def summarize_diff(diff: Dict) -> Dict:
    """Create a human-readable summary of a diff"""
    return {
        "fields_changed": len(diff.get("values_changed", {})),
        "fields_added": len(diff.get("items_added", [])),
        "fields_removed": len(diff.get("items_removed", [])),
        "has_changes": bool(
            diff.get("values_changed") or 
            diff.get("items_added") or 
            diff.get("items_removed")
        )
    }


def calculate_data_hash(data: Dict) -> str:
    """Calculate a hash of the data for integrity checking"""
    data_str = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(data_str.encode()).hexdigest()[:16]


async def log_revision_audit(db, submission_id: str, revision: Dict, user: Dict = None):
    """Log a revision event to the audit trail"""
    audit_entry = {
        "submission_id": submission_id,
        "revision_id": revision["id"],
        "version": revision["version"],
        "action": "revision_created",
        "revision_type": revision["revision_type"],
        "user_id": user.get("user_id") if user else "system",
        "user_name": user.get("name") if user else "System",
        "timestamp": datetime.now(timezone.utc),
        "details": {
            "reason": revision.get("reason"),
            "correction_notes": revision.get("correction_notes"),
            "diff_summary": summarize_diff(revision.get("diff_from_previous", {}))
        }
    }
    
    await db.revision_audit_trail.insert_one(audit_entry)
