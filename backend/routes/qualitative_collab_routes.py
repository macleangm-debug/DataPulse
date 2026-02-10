"""
Qualitative Analysis Module - Collaboration & Audit (Phase 2)
Multi-coder workflows, blind coding, audit trails
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel

router = APIRouter(prefix="/qualitative/collab", tags=["Qualitative Collaboration"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class CoderAssignment(BaseModel):
    source_id: str
    coder_id: str
    is_blind: bool = False
    deadline: Optional[datetime] = None
    notes: Optional[str] = None


class CodingReview(BaseModel):
    coding_id: str
    status: str  # approved, rejected, needs_revision
    reviewer_notes: Optional[str] = None


# =============================================================================
# CODER ASSIGNMENTS
# =============================================================================

@router.post("/assignments")
async def create_assignment(
    assignment: CoderAssignment,
    project_id: str = Query(...),
    org_id: str = Query(...),
    assigned_by: str = Query(...)
):
    """
    Assign a coder to a source document
    Supports blind coding mode where coder can't see others' work
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Verify source exists
    source = await db.qual_sources.find_one({
        "_id": ObjectId(assignment.source_id),
        "org_id": org_id
    })
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Check for existing assignment
    existing = await db.qual_assignments.find_one({
        "source_id": assignment.source_id,
        "coder_id": assignment.coder_id,
        "status": {"$ne": "completed"}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Coder already assigned to this source")
    
    assignment_doc = {
        "project_id": project_id,
        "source_id": assignment.source_id,
        "coder_id": assignment.coder_id,
        "is_blind": assignment.is_blind,
        "deadline": assignment.deadline,
        "notes": assignment.notes,
        "status": "assigned",
        "assigned_by": assigned_by,
        "assigned_at": datetime.now(timezone.utc),
        "started_at": None,
        "completed_at": None,
        "org_id": org_id
    }
    
    result = await db.qual_assignments.insert_one(assignment_doc)
    
    # Log the assignment
    await log_audit_event(
        project_id=project_id,
        action="assignment_created",
        entity_type="assignment",
        entity_id=str(result.inserted_id),
        user_id=assigned_by,
        org_id=org_id,
        details={
            "source_id": assignment.source_id,
            "coder_id": assignment.coder_id,
            "is_blind": assignment.is_blind
        }
    )
    
    return {
        "id": str(result.inserted_id),
        "message": "Coder assigned successfully"
    }


@router.get("/assignments")
async def list_assignments(
    project_id: str = Query(...),
    org_id: str = Query(...),
    coder_id: Optional[str] = None,
    source_id: Optional[str] = None,
    status: Optional[str] = None
):
    """List coder assignments with filters"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if coder_id:
        query["coder_id"] = coder_id
    if source_id:
        query["source_id"] = source_id
    if status:
        query["status"] = status
    
    assignments = await db.qual_assignments.find(query).to_list(500)
    
    result = []
    for a in assignments:
        # Get source name
        source = await db.qual_sources.find_one({"_id": ObjectId(a["source_id"])})
        source_name = source["name"] if source else "Unknown"
        
        # Get coding count for this assignment
        coding_count = await db.qual_codings.count_documents({
            "source_id": a["source_id"],
            "coder_id": a["coder_id"]
        })
        
        result.append({
            "id": str(a["_id"]),
            "source_id": a["source_id"],
            "source_name": source_name,
            "coder_id": a["coder_id"],
            "is_blind": a.get("is_blind", False),
            "status": a["status"],
            "deadline": a.get("deadline"),
            "assigned_at": a["assigned_at"],
            "coding_count": coding_count
        })
    
    return result


@router.patch("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    org_id: str = Query(...),
    user_id: str = Query(...),
    status: Optional[str] = None,
    notes: Optional[str] = None
):
    """Update assignment status"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_doc = {"updated_at": datetime.now(timezone.utc)}
    
    if status:
        update_doc["status"] = status
        if status == "in_progress":
            update_doc["started_at"] = datetime.now(timezone.utc)
        elif status == "completed":
            update_doc["completed_at"] = datetime.now(timezone.utc)
    
    if notes:
        update_doc["notes"] = notes
    
    assignment = await db.qual_assignments.find_one({"_id": ObjectId(assignment_id)})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    await db.qual_assignments.update_one(
        {"_id": ObjectId(assignment_id), "org_id": org_id},
        {"$set": update_doc}
    )
    
    # Log status change
    if status:
        await log_audit_event(
            project_id=assignment["project_id"],
            action="assignment_status_changed",
            entity_type="assignment",
            entity_id=assignment_id,
            user_id=user_id,
            org_id=org_id,
            details={"new_status": status}
        )
    
    return {"message": "Assignment updated"}


# =============================================================================
# BLIND CODING
# =============================================================================

@router.get("/blind-source/{source_id}")
async def get_blind_source(
    source_id: str,
    org_id: str = Query(...),
    coder_id: str = Query(...)
):
    """
    Get source content for blind coding
    Excludes other coders' work from the response
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Verify assignment exists and is blind
    assignment = await db.qual_assignments.find_one({
        "source_id": source_id,
        "coder_id": coder_id,
        "org_id": org_id
    })
    
    if not assignment:
        raise HTTPException(status_code=403, detail="No assignment found for this source")
    
    source = await db.qual_sources.find_one({
        "_id": ObjectId(source_id),
        "org_id": org_id
    })
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Get only this coder's codings
    my_codings = []
    if not assignment.get("is_blind", False):
        # Not blind - can see all codings
        codings = await db.qual_codings.find({"source_id": source_id}).to_list(1000)
        my_codings = [
            {
                "id": str(c["_id"]),
                "code_id": c["code_id"],
                "code_name": c.get("code_name"),
                "code_color": c.get("code_color"),
                "start_char": c["start_char"],
                "end_char": c["end_char"],
                "coder_id": c["coder_id"]
            }
            for c in codings
        ]
    else:
        # Blind mode - only show own codings
        codings = await db.qual_codings.find({
            "source_id": source_id,
            "coder_id": coder_id
        }).to_list(1000)
        my_codings = [
            {
                "id": str(c["_id"]),
                "code_id": c["code_id"],
                "code_name": c.get("code_name"),
                "code_color": c.get("code_color"),
                "start_char": c["start_char"],
                "end_char": c["end_char"],
                "coder_id": c["coder_id"]
            }
            for c in codings
        ]
    
    return {
        "id": str(source["_id"]),
        "name": source["name"],
        "content": source["content"],
        "source_type": source.get("source_type"),
        "word_count": source.get("word_count", 0),
        "is_blind": assignment.get("is_blind", False),
        "codings": my_codings,
        "my_coding_count": len([c for c in my_codings if c["coder_id"] == coder_id])
    }


# =============================================================================
# CODING REVIEW WORKFLOW
# =============================================================================

@router.post("/reviews")
async def submit_for_review(
    project_id: str = Query(...),
    org_id: str = Query(...),
    coder_id: str = Query(...),
    source_id: str = Query(...)
):
    """Submit codings for review"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get codings by this coder for this source
    codings = await db.qual_codings.find({
        "source_id": source_id,
        "coder_id": coder_id
    }).to_list(500)
    
    if not codings:
        raise HTTPException(status_code=400, detail="No codings to review")
    
    review_doc = {
        "project_id": project_id,
        "source_id": source_id,
        "coder_id": coder_id,
        "coding_ids": [str(c["_id"]) for c in codings],
        "coding_count": len(codings),
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc),
        "reviewer_id": None,
        "reviewed_at": None,
        "reviewer_notes": None,
        "org_id": org_id
    }
    
    result = await db.qual_reviews.insert_one(review_doc)
    
    # Update assignment status
    await db.qual_assignments.update_one(
        {"source_id": source_id, "coder_id": coder_id},
        {"$set": {"status": "submitted_for_review"}}
    )
    
    return {
        "id": str(result.inserted_id),
        "coding_count": len(codings),
        "message": "Submitted for review"
    }


@router.get("/reviews")
async def list_reviews(
    project_id: str = Query(...),
    org_id: str = Query(...),
    status: Optional[str] = None,
    coder_id: Optional[str] = None
):
    """List coding reviews"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if status:
        query["status"] = status
    if coder_id:
        query["coder_id"] = coder_id
    
    reviews = await db.qual_reviews.find(query).sort("submitted_at", -1).to_list(100)
    
    result = []
    for r in reviews:
        source = await db.qual_sources.find_one({"_id": ObjectId(r["source_id"])})
        result.append({
            "id": str(r["_id"]),
            "source_id": r["source_id"],
            "source_name": source["name"] if source else "Unknown",
            "coder_id": r["coder_id"],
            "coding_count": r["coding_count"],
            "status": r["status"],
            "submitted_at": r["submitted_at"],
            "reviewer_id": r.get("reviewer_id"),
            "reviewed_at": r.get("reviewed_at"),
            "reviewer_notes": r.get("reviewer_notes")
        })
    
    return result


@router.patch("/reviews/{review_id}")
async def complete_review(
    review_id: str,
    org_id: str = Query(...),
    reviewer_id: str = Query(...),
    status: str = Query(..., description="approved, rejected, needs_revision"),
    reviewer_notes: Optional[str] = None
):
    """Complete a coding review"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if status not in ["approved", "rejected", "needs_revision"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    review = await db.qual_reviews.find_one({"_id": ObjectId(review_id)})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    await db.qual_reviews.update_one(
        {"_id": ObjectId(review_id), "org_id": org_id},
        {
            "$set": {
                "status": status,
                "reviewer_id": reviewer_id,
                "reviewed_at": datetime.now(timezone.utc),
                "reviewer_notes": reviewer_notes
            }
        }
    )
    
    # Update assignment status
    new_assignment_status = "completed" if status == "approved" else "needs_revision"
    await db.qual_assignments.update_one(
        {"source_id": review["source_id"], "coder_id": review["coder_id"]},
        {"$set": {"status": new_assignment_status}}
    )
    
    # Log the review
    await log_audit_event(
        project_id=review["project_id"],
        action="review_completed",
        entity_type="review",
        entity_id=review_id,
        user_id=reviewer_id,
        org_id=org_id,
        details={
            "status": status,
            "coder_id": review["coder_id"],
            "source_id": review["source_id"]
        }
    )
    
    return {"message": f"Review {status}"}


# =============================================================================
# AUDIT TRAIL
# =============================================================================

async def log_audit_event(
    project_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: str,
    org_id: str,
    details: Dict[str, Any] = None
):
    """Log an audit event"""
    if db is None:
        return
    
    audit_doc = {
        "project_id": project_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user_id,
        "org_id": org_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.qual_audit_logs.insert_one(audit_doc)


@router.get("/audit-trail/{project_id}")
async def get_audit_trail(
    project_id: str,
    org_id: str = Query(...),
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    """Get audit trail for a project"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    
    logs = await db.qual_audit_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [
        {
            "id": str(log["_id"]),
            "action": log["action"],
            "entity_type": log["entity_type"],
            "entity_id": log["entity_id"],
            "user_id": log["user_id"],
            "details": log.get("details", {}),
            "timestamp": log["timestamp"]
        }
        for log in logs
    ]


@router.get("/audit-trail/entity/{entity_type}/{entity_id}")
async def get_entity_history(
    entity_type: str,
    entity_id: str,
    org_id: str = Query(...)
):
    """Get complete history for a specific entity"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    logs = await db.qual_audit_logs.find({
        "entity_type": entity_type,
        "entity_id": entity_id,
        "org_id": org_id
    }).sort("timestamp", 1).to_list(200)
    
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "history_count": len(logs),
        "history": [
            {
                "action": log["action"],
                "user_id": log["user_id"],
                "details": log.get("details", {}),
                "timestamp": log["timestamp"]
            }
            for log in logs
        ]
    }


# =============================================================================
# CODE VERSION HISTORY
# =============================================================================

@router.post("/codes/{code_id}/versions")
async def save_code_version(
    code_id: str,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Save current state of a code as a version"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    code = await db.qual_codes.find_one({
        "_id": ObjectId(code_id),
        "org_id": org_id
    })
    
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    
    # Get current version number
    latest = await db.qual_code_versions.find_one(
        {"code_id": code_id},
        sort=[("version", -1)]
    )
    version = (latest["version"] + 1) if latest else 1
    
    # Save version
    version_doc = {
        "code_id": code_id,
        "project_id": code["project_id"],
        "version": version,
        "name": code["name"],
        "definition": code.get("definition"),
        "description": code.get("description"),
        "inclusion_criteria": code.get("inclusion_criteria"),
        "exclusion_criteria": code.get("exclusion_criteria"),
        "examples": code.get("examples", []),
        "color": code.get("color"),
        "saved_by": user_id,
        "saved_at": datetime.now(timezone.utc),
        "org_id": org_id
    }
    
    await db.qual_code_versions.insert_one(version_doc)
    
    # Log the version save
    await log_audit_event(
        project_id=code["project_id"],
        action="code_version_saved",
        entity_type="code",
        entity_id=code_id,
        user_id=user_id,
        org_id=org_id,
        details={"version": version}
    )
    
    return {"code_id": code_id, "version": version, "message": "Version saved"}


@router.get("/codes/{code_id}/versions")
async def get_code_versions(
    code_id: str,
    org_id: str = Query(...)
):
    """Get version history for a code"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    versions = await db.qual_code_versions.find({
        "code_id": code_id,
        "org_id": org_id
    }).sort("version", -1).to_list(50)
    
    return [
        {
            "version": v["version"],
            "name": v["name"],
            "definition": v.get("definition"),
            "saved_by": v["saved_by"],
            "saved_at": v["saved_at"]
        }
        for v in versions
    ]


@router.post("/codes/{code_id}/restore/{version}")
async def restore_code_version(
    code_id: str,
    version: int,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Restore a code to a previous version"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    version_doc = await db.qual_code_versions.find_one({
        "code_id": code_id,
        "version": version,
        "org_id": org_id
    })
    
    if not version_doc:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Save current as new version first
    await save_code_version(code_id, org_id, user_id)
    
    # Restore the old version
    await db.qual_codes.update_one(
        {"_id": ObjectId(code_id)},
        {
            "$set": {
                "name": version_doc["name"],
                "definition": version_doc.get("definition"),
                "description": version_doc.get("description"),
                "inclusion_criteria": version_doc.get("inclusion_criteria"),
                "exclusion_criteria": version_doc.get("exclusion_criteria"),
                "examples": version_doc.get("examples", []),
                "color": version_doc.get("color"),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Log the restore
    await log_audit_event(
        project_id=version_doc["project_id"],
        action="code_version_restored",
        entity_type="code",
        entity_id=code_id,
        user_id=user_id,
        org_id=org_id,
        details={"restored_version": version}
    )
    
    return {"message": f"Code restored to version {version}"}
