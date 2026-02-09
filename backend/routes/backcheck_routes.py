"""DataPulse - Back-check Module
Industry-standard data quality verification through field spot-checks.

Features:
- Random sample selection for verification
- Configurable back-check questionnaires (subset of main form)
- Discrepancy detection and scoring
- Supervisor assignment and tracking
- Re-interview scheduling
- Quality metrics by enumerator
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import secrets
import random

router = APIRouter(prefix="/backcheck", tags=["Back-check Quality Control"])


class BackcheckStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DISCREPANCY_FOUND = "discrepancy_found"
    VERIFIED = "verified"
    FLAGGED = "flagged"
    CANCELLED = "cancelled"


class SamplingMethod(str, Enum):
    RANDOM = "random"
    STRATIFIED = "stratified"
    SYSTEMATIC = "systematic"
    TARGETED = "targeted"  # Manual selection


class DiscrepancySeverity(str, Enum):
    MINOR = "minor"  # Typos, formatting
    MODERATE = "moderate"  # Different responses but plausible
    MAJOR = "major"  # Significant differences
    CRITICAL = "critical"  # Suspected fraud/fabrication


class BackcheckConfigCreate(BaseModel):
    org_id: str
    project_id: str
    form_id: str
    name: str
    description: Optional[str] = None
    
    # Sampling settings
    sampling_method: SamplingMethod = SamplingMethod.RANDOM
    sample_percentage: float = 10.0  # % of submissions to back-check
    min_per_enumerator: int = 2  # Minimum checks per enumerator
    max_per_enumerator: Optional[int] = None
    
    # Which fields to verify (subset of main form)
    verification_fields: List[str] = []  # Field IDs to verify
    key_fields: List[str] = []  # Critical fields (higher weight)
    
    # Timing
    min_hours_after_submission: int = 24
    max_days_after_submission: int = 7
    
    # Discrepancy thresholds
    minor_threshold: float = 0.95  # >95% match = minor
    moderate_threshold: float = 0.80  # 80-95% = moderate
    major_threshold: float = 0.50  # 50-80% = major
    # <50% = critical
    
    # Actions
    auto_flag_on_critical: bool = True
    require_supervisor_review: bool = True
    notify_enumerator_on_discrepancy: bool = False


class BackcheckCreate(BaseModel):
    submission_id: str
    reason: Optional[str] = None
    priority: int = 0  # Higher = more urgent


class BackcheckResult(BaseModel):
    backcheck_id: str
    verifier_id: str
    responses: Dict[str, Any]  # Field ID -> verified value
    notes: Optional[str] = None
    respondent_available: bool = True
    verification_method: str = "in_person"  # in_person, phone, neighbor


# ============ Back-check Configuration ============

@router.post("/configs")
async def create_backcheck_config(
    request: Request,
    config: BackcheckConfigCreate
):
    """Create a back-check configuration for a project"""
    db = request.app.state.db
    
    # Verify form exists
    form = await db.forms.find_one({"id": config.form_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    config_doc = {
        "id": f"bc_config_{config.project_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "is_active": True,
        "stats": {
            "total_selected": 0,
            "completed": 0,
            "discrepancies_found": 0,
            "avg_match_rate": 0
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.backcheck_configs.insert_one(config_doc)
    
    return {"message": "Back-check configuration created", "config_id": config_doc["id"]}


@router.get("/configs/{org_id}")
async def list_backcheck_configs(
    request: Request,
    org_id: str,
    project_id: Optional[str] = None
):
    """List back-check configurations"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if project_id:
        query["project_id"] = project_id
    
    configs = await db.backcheck_configs.find(query).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


@router.get("/configs/{org_id}/{config_id}")
async def get_backcheck_config(
    request: Request,
    org_id: str,
    config_id: str
):
    """Get back-check configuration details"""
    db = request.app.state.db
    
    config = await db.backcheck_configs.find_one({"id": config_id, "org_id": org_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    config["_id"] = str(config.get("_id", ""))
    
    return config


@router.put("/configs/{config_id}")
async def update_backcheck_config(
    request: Request,
    config_id: str
):
    """Update back-check configuration"""
    db = request.app.state.db
    data = await request.json()
    
    # Remove protected fields
    data.pop("id", None)
    data.pop("org_id", None)
    data.pop("project_id", None)
    data.pop("created_at", None)
    data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.backcheck_configs.update_one(
        {"id": config_id},
        {"$set": data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {"message": "Configuration updated"}


# ============ Sample Selection ============

@router.post("/configs/{config_id}/generate-sample")
async def generate_backcheck_sample(
    request: Request,
    config_id: str
):
    """Generate back-check sample based on configuration"""
    db = request.app.state.db
    
    config = await db.backcheck_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Get eligible submissions
    min_time = datetime.now(timezone.utc) - timedelta(days=config.get("max_days_after_submission", 7))
    max_time = datetime.now(timezone.utc) - timedelta(hours=config.get("min_hours_after_submission", 24))
    
    # Find submissions not yet selected for back-check
    existing_backchecks = await db.backchecks.distinct(
        "submission_id",
        {"config_id": config_id}
    )
    
    eligible = await db.submissions.find({
        "form_id": config["form_id"],
        "submitted_at": {"$gte": min_time, "$lte": max_time},
        "id": {"$nin": existing_backchecks},
        "status": {"$in": ["submitted", "approved"]}
    }).to_list(10000)
    
    if not eligible:
        return {"message": "No eligible submissions found", "selected": 0}
    
    # Calculate sample size
    sample_size = max(1, int(len(eligible) * config["sample_percentage"] / 100))
    
    # Group by enumerator for stratified sampling
    by_enumerator = {}
    for sub in eligible:
        enum_id = sub.get("submitted_by", "unknown")
        if enum_id not in by_enumerator:
            by_enumerator[enum_id] = []
        by_enumerator[enum_id].append(sub)
    
    selected = []
    
    if config["sampling_method"] == SamplingMethod.RANDOM:
        selected = random.sample(eligible, min(sample_size, len(eligible)))
    
    elif config["sampling_method"] == SamplingMethod.STRATIFIED:
        # Equal representation from each enumerator
        per_enum = max(config.get("min_per_enumerator", 2), sample_size // len(by_enumerator))
        for enum_id, subs in by_enumerator.items():
            count = min(per_enum, len(subs))
            if config.get("max_per_enumerator"):
                count = min(count, config["max_per_enumerator"])
            selected.extend(random.sample(subs, count))
    
    elif config["sampling_method"] == SamplingMethod.SYSTEMATIC:
        # Every Nth submission
        step = max(1, len(eligible) // sample_size)
        selected = eligible[::step][:sample_size]
    
    # Create back-check records
    backchecks_created = []
    for sub in selected:
        backcheck = {
            "id": f"bc_{config_id}_{secrets.token_hex(8)}",
            "config_id": config_id,
            "org_id": config["org_id"],
            "project_id": config["project_id"],
            "form_id": config["form_id"],
            "submission_id": sub["id"],
            "original_enumerator_id": sub.get("submitted_by"),
            "status": BackcheckStatus.PENDING,
            "assigned_to": None,
            "priority": 0,
            "original_data": {f: sub.get("data", {}).get(f) for f in config.get("verification_fields", [])},
            "created_at": datetime.now(timezone.utc),
            "due_date": datetime.now(timezone.utc) + timedelta(days=3)
        }
        backchecks_created.append(backcheck)
    
    if backchecks_created:
        await db.backchecks.insert_many(backchecks_created)
        await db.backcheck_configs.update_one(
            {"id": config_id},
            {"$inc": {"stats.total_selected": len(backchecks_created)}}
        )
    
    return {
        "message": f"Generated {len(backchecks_created)} back-checks",
        "selected": len(backchecks_created),
        "by_enumerator": {k: len([b for b in backchecks_created if b["original_enumerator_id"] == k]) 
                          for k in by_enumerator.keys()}
    }


@router.post("/manual-select")
async def manually_select_for_backcheck(
    request: Request,
    backcheck: BackcheckCreate,
    config_id: str
):
    """Manually select a submission for back-check"""
    db = request.app.state.db
    
    config = await db.backcheck_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    submission = await db.submissions.find_one({"id": backcheck.submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if already selected
    existing = await db.backchecks.find_one({
        "config_id": config_id,
        "submission_id": backcheck.submission_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Submission already selected for back-check")
    
    backcheck_doc = {
        "id": f"bc_{config_id}_{secrets.token_hex(8)}",
        "config_id": config_id,
        "org_id": config["org_id"],
        "project_id": config["project_id"],
        "form_id": config["form_id"],
        "submission_id": backcheck.submission_id,
        "original_enumerator_id": submission.get("submitted_by"),
        "status": BackcheckStatus.PENDING,
        "assigned_to": None,
        "priority": backcheck.priority,
        "reason": backcheck.reason,
        "selection_type": "manual",
        "original_data": {f: submission.get("data", {}).get(f) for f in config.get("verification_fields", [])},
        "created_at": datetime.now(timezone.utc),
        "due_date": datetime.now(timezone.utc) + timedelta(days=3)
    }
    
    await db.backchecks.insert_one(backcheck_doc)
    
    return {"message": "Back-check created", "backcheck_id": backcheck_doc["id"]}


# ============ Back-check Assignment & Execution ============

@router.get("/queue/{org_id}")
async def get_backcheck_queue(
    request: Request,
    org_id: str,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get back-check queue"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if project_id:
        query["project_id"] = project_id
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    backchecks = await db.backchecks.find(query).sort([
        ("priority", -1),
        ("due_date", 1)
    ]).skip(offset).limit(limit).to_list(limit)
    
    total = await db.backchecks.count_documents(query)
    
    for bc in backchecks:
        bc["_id"] = str(bc.get("_id", ""))
        if bc.get("created_at"):
            bc["created_at"] = bc["created_at"].isoformat()
        if bc.get("due_date"):
            bc["due_date"] = bc["due_date"].isoformat()
    
    return {"backchecks": backchecks, "total": total, "limit": limit, "offset": offset}


@router.post("/assign/{backcheck_id}")
async def assign_backcheck(
    request: Request,
    backcheck_id: str,
    verifier_id: str
):
    """Assign a back-check to a verifier/supervisor"""
    db = request.app.state.db
    
    backcheck = await db.backchecks.find_one({"id": backcheck_id})
    if not backcheck:
        raise HTTPException(status_code=404, detail="Back-check not found")
    
    # Ensure verifier is different from original enumerator
    if verifier_id == backcheck.get("original_enumerator_id"):
        raise HTTPException(status_code=400, detail="Verifier cannot be the original enumerator")
    
    await db.backchecks.update_one(
        {"id": backcheck_id},
        {
            "$set": {
                "assigned_to": verifier_id,
                "assigned_at": datetime.now(timezone.utc),
                "status": BackcheckStatus.ASSIGNED
            }
        }
    )
    
    return {"message": "Back-check assigned"}


@router.post("/bulk-assign")
async def bulk_assign_backchecks(
    request: Request
):
    """Bulk assign back-checks to verifiers"""
    db = request.app.state.db
    data = await request.json()
    
    assignments = data.get("assignments", [])  # [{backcheck_id, verifier_id}, ...]
    
    assigned_count = 0
    for assignment in assignments:
        result = await db.backchecks.update_one(
            {"id": assignment["backcheck_id"]},
            {
                "$set": {
                    "assigned_to": assignment["verifier_id"],
                    "assigned_at": datetime.now(timezone.utc),
                    "status": BackcheckStatus.ASSIGNED
                }
            }
        )
        if result.modified_count > 0:
            assigned_count += 1
    
    return {"message": f"Assigned {assigned_count} back-checks"}


@router.get("/my-assignments/{verifier_id}")
async def get_my_backcheck_assignments(
    request: Request,
    verifier_id: str,
    status: Optional[str] = None
):
    """Get back-checks assigned to a verifier"""
    db = request.app.state.db
    
    query = {"assigned_to": verifier_id}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": [BackcheckStatus.ASSIGNED, BackcheckStatus.IN_PROGRESS]}
    
    backchecks = await db.backchecks.find(query).sort("due_date", 1).to_list(100)
    
    # Enrich with submission details
    for bc in backchecks:
        bc["_id"] = str(bc.get("_id", ""))
        
        # Get original submission location/identifier for finding respondent
        submission = await db.submissions.find_one({"id": bc["submission_id"]})
        if submission:
            bc["respondent_info"] = {
                "location": submission.get("data", {}).get("gps_location"),
                "respondent_id": submission.get("data", {}).get("respondent_id"),
                "respondent_name": submission.get("data", {}).get("respondent_name"),
                "submission_date": submission.get("submitted_at")
            }
    
    return {"backchecks": backchecks}


@router.post("/start/{backcheck_id}")
async def start_backcheck(
    request: Request,
    backcheck_id: str,
    verifier_id: str
):
    """Mark back-check as in progress"""
    db = request.app.state.db
    
    result = await db.backchecks.update_one(
        {"id": backcheck_id, "assigned_to": verifier_id},
        {
            "$set": {
                "status": BackcheckStatus.IN_PROGRESS,
                "started_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Back-check not found or not assigned to you")
    
    return {"message": "Back-check started"}


@router.post("/complete/{backcheck_id}")
async def complete_backcheck(
    request: Request,
    backcheck_id: str,
    result: BackcheckResult
):
    """Submit back-check results"""
    db = request.app.state.db
    
    backcheck = await db.backchecks.find_one({"id": backcheck_id})
    if not backcheck:
        raise HTTPException(status_code=404, detail="Back-check not found")
    
    config = await db.backcheck_configs.find_one({"id": backcheck["config_id"]})
    
    # Calculate discrepancies
    discrepancies = []
    total_fields = len(result.responses)
    matching_fields = 0
    
    for field_id, verified_value in result.responses.items():
        original_value = backcheck.get("original_data", {}).get(field_id)
        
        # Compare values
        is_match = compare_values(original_value, verified_value)
        
        if is_match:
            matching_fields += 1
        else:
            is_key_field = field_id in config.get("key_fields", [])
            discrepancies.append({
                "field_id": field_id,
                "original_value": original_value,
                "verified_value": verified_value,
                "is_key_field": is_key_field,
                "severity": calculate_severity(
                    original_value, verified_value, is_key_field, config
                )
            })
    
    # Calculate match rate
    match_rate = matching_fields / total_fields if total_fields > 0 else 1.0
    
    # Determine status
    has_critical = any(d["severity"] == DiscrepancySeverity.CRITICAL for d in discrepancies)
    
    if has_critical and config.get("auto_flag_on_critical"):
        status = BackcheckStatus.FLAGGED
    elif discrepancies:
        status = BackcheckStatus.DISCREPANCY_FOUND
    else:
        status = BackcheckStatus.VERIFIED
    
    # Update back-check
    await db.backchecks.update_one(
        {"id": backcheck_id},
        {
            "$set": {
                "status": status,
                "completed_at": datetime.now(timezone.utc),
                "verified_data": result.responses,
                "discrepancies": discrepancies,
                "match_rate": match_rate,
                "notes": result.notes,
                "respondent_available": result.respondent_available,
                "verification_method": result.verification_method
            }
        }
    )
    
    # Update config stats
    await db.backcheck_configs.update_one(
        {"id": backcheck["config_id"]},
        {
            "$inc": {
                "stats.completed": 1,
                "stats.discrepancies_found": 1 if discrepancies else 0
            }
        }
    )
    
    # Update enumerator quality score if discrepancies found
    if discrepancies:
        await update_enumerator_quality(db, backcheck["original_enumerator_id"], match_rate, has_critical)
    
    return {
        "message": "Back-check completed",
        "status": status,
        "match_rate": round(match_rate * 100, 1),
        "discrepancies": len(discrepancies)
    }


def compare_values(original, verified) -> bool:
    """Compare two values for equality (with tolerance)"""
    if original is None and verified is None:
        return True
    if original is None or verified is None:
        return False
    
    # Normalize strings
    if isinstance(original, str) and isinstance(verified, str):
        return original.strip().lower() == verified.strip().lower()
    
    # Numeric tolerance
    if isinstance(original, (int, float)) and isinstance(verified, (int, float)):
        return abs(original - verified) < 0.01 * max(abs(original), abs(verified), 1)
    
    return original == verified


def calculate_severity(original, verified, is_key_field: bool, config: dict) -> DiscrepancySeverity:
    """Calculate discrepancy severity"""
    # Key fields always at least moderate
    if is_key_field:
        if original is None or verified is None:
            return DiscrepancySeverity.CRITICAL
        
        # Completely different
        if isinstance(original, str) and isinstance(verified, str):
            if len(set(original.lower().split()) & set(verified.lower().split())) == 0:
                return DiscrepancySeverity.CRITICAL
        
        return DiscrepancySeverity.MAJOR
    
    # Non-key fields
    if original is None and verified is not None:
        return DiscrepancySeverity.MODERATE
    
    if isinstance(original, str) and isinstance(verified, str):
        # Check similarity
        orig_words = set(original.lower().split())
        ver_words = set(verified.lower().split())
        overlap = len(orig_words & ver_words) / max(len(orig_words | ver_words), 1)
        
        if overlap > 0.8:
            return DiscrepancySeverity.MINOR
        elif overlap > 0.5:
            return DiscrepancySeverity.MODERATE
        else:
            return DiscrepancySeverity.MAJOR
    
    return DiscrepancySeverity.MODERATE


async def update_enumerator_quality(db, enumerator_id: str, match_rate: float, has_critical: bool):
    """Update enumerator's quality metrics"""
    await db.enumerator_quality.update_one(
        {"enumerator_id": enumerator_id},
        {
            "$inc": {
                "total_backchecks": 1,
                "critical_discrepancies": 1 if has_critical else 0
            },
            "$push": {
                "match_rates": {
                    "$each": [match_rate],
                    "$slice": -50  # Keep last 50
                }
            },
            "$set": {"last_backcheck_at": datetime.now(timezone.utc)}
        },
        upsert=True
    )


# ============ Quality Reports ============

@router.get("/reports/{org_id}/summary")
async def get_backcheck_summary(
    request: Request,
    org_id: str,
    project_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """Get back-check summary report"""
    db = request.app.state.db
    
    match_query = {"org_id": org_id}
    if project_id:
        match_query["project_id"] = project_id
    if date_from:
        match_query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        match_query.setdefault("created_at", {})["$lte"] = datetime.fromisoformat(date_to)
    
    # Status breakdown
    status_counts = await db.backchecks.aggregate([
        {"$match": match_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Average match rate
    match_stats = await db.backchecks.aggregate([
        {"$match": {**match_query, "match_rate": {"$exists": True}}},
        {"$group": {
            "_id": None,
            "avg_match_rate": {"$avg": "$match_rate"},
            "min_match_rate": {"$min": "$match_rate"},
            "max_match_rate": {"$max": "$match_rate"}
        }}
    ]).to_list(1)
    
    # By enumerator
    by_enumerator = await db.backchecks.aggregate([
        {"$match": {**match_query, "status": {"$in": ["completed", "discrepancy_found", "verified", "flagged"]}}},
        {"$group": {
            "_id": "$original_enumerator_id",
            "total": {"$sum": 1},
            "verified": {"$sum": {"$cond": [{"$eq": ["$status", "verified"]}, 1, 0]}},
            "flagged": {"$sum": {"$cond": [{"$eq": ["$status", "flagged"]}, 1, 0]}},
            "avg_match_rate": {"$avg": "$match_rate"}
        }},
        {"$sort": {"avg_match_rate": 1}}  # Worst first
    ]).to_list(100)
    
    # Discrepancy trends (weekly)
    weekly_trends = await db.backchecks.aggregate([
        {"$match": {**match_query, "completed_at": {"$exists": True}}},
        {"$group": {
            "_id": {
                "week": {"$isoWeek": "$completed_at"},
                "year": {"$isoWeekYear": "$completed_at"}
            },
            "total": {"$sum": 1},
            "discrepancies": {"$sum": {"$cond": [{"$gt": [{"$size": {"$ifNull": ["$discrepancies", []]}}, 0]}, 1, 0]}},
            "avg_match": {"$avg": "$match_rate"}
        }},
        {"$sort": {"_id.year": 1, "_id.week": 1}}
    ]).to_list(52)
    
    return {
        "summary": {
            "status_breakdown": {s["_id"]: s["count"] for s in status_counts},
            "match_stats": match_stats[0] if match_stats else None
        },
        "by_enumerator": by_enumerator,
        "weekly_trends": weekly_trends,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/reports/{org_id}/enumerator/{enumerator_id}")
async def get_enumerator_backcheck_report(
    request: Request,
    org_id: str,
    enumerator_id: str
):
    """Get detailed back-check report for an enumerator"""
    db = request.app.state.db
    
    # Get enumerator quality record
    quality = await db.enumerator_quality.find_one({"enumerator_id": enumerator_id})
    
    # Get recent back-checks
    recent = await db.backchecks.find({
        "org_id": org_id,
        "original_enumerator_id": enumerator_id,
        "status": {"$in": ["completed", "discrepancy_found", "verified", "flagged"]}
    }).sort("completed_at", -1).limit(20).to_list(20)
    
    # Common discrepancy fields
    field_discrepancies = {}
    for bc in recent:
        for disc in bc.get("discrepancies", []):
            field_id = disc["field_id"]
            if field_id not in field_discrepancies:
                field_discrepancies[field_id] = {"count": 0, "severities": []}
            field_discrepancies[field_id]["count"] += 1
            field_discrepancies[field_id]["severities"].append(disc["severity"])
    
    for bc in recent:
        bc["_id"] = str(bc.get("_id", ""))
        if bc.get("completed_at"):
            bc["completed_at"] = bc["completed_at"].isoformat()
    
    return {
        "enumerator_id": enumerator_id,
        "quality_metrics": quality,
        "recent_backchecks": recent,
        "common_discrepancy_fields": field_discrepancies
    }
