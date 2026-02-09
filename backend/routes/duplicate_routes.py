"""DataPulse - Duplicate Detection Service"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import hashlib
import json

from auth import get_current_user

router = APIRouter(prefix="/duplicates", tags=["Duplicates"])


class DuplicateRule(BaseModel):
    """Rule for detecting duplicates"""
    id: Optional[str] = None
    form_id: str
    name: str
    fields: List[str]  # Fields to check for duplicates
    threshold: float = 1.0  # 1.0 = exact match, 0.8 = 80% similarity
    action: str = "flag"  # "flag", "warn", "block"
    is_active: bool = True


class DuplicateMatch(BaseModel):
    """A detected duplicate match"""
    submission_id: str
    matched_submission_id: str
    similarity_score: float
    matched_fields: List[str]
    rule_id: str
    status: str = "pending"  # "pending", "confirmed", "dismissed"


def compute_field_hash(data: Dict, fields: List[str]) -> str:
    """Compute a hash of specified fields for exact matching"""
    values = []
    for field in sorted(fields):
        value = data.get(field, "")
        if value is None:
            value = ""
        values.append(str(value).lower().strip())
    return hashlib.md5("|".join(values).encode()).hexdigest()


def compute_similarity(data1: Dict, data2: Dict, fields: List[str]) -> tuple:
    """Compute similarity between two submissions"""
    matching_fields = []
    total_score = 0
    
    for field in fields:
        val1 = str(data1.get(field, "")).lower().strip()
        val2 = str(data2.get(field, "")).lower().strip()
        
        if not val1 and not val2:
            continue
        
        if val1 == val2:
            matching_fields.append(field)
            total_score += 1
        elif val1 and val2:
            # Simple character-level similarity
            longer = max(len(val1), len(val2))
            if longer > 0:
                matches = sum(c1 == c2 for c1, c2 in zip(val1, val2))
                field_score = matches / longer
                if field_score >= 0.8:
                    matching_fields.append(field)
                    total_score += field_score
    
    if len(fields) > 0:
        similarity = total_score / len(fields)
    else:
        similarity = 0
    
    return similarity, matching_fields


@router.get("/rules/{form_id}")
async def get_duplicate_rules(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get duplicate detection rules for a form"""
    db = request.app.state.db
    
    rules = await db.duplicate_rules.find(
        {"form_id": form_id},
        {"_id": 0}
    ).to_list(100)
    
    # Return default rules if none exist
    if not rules:
        return {
            "rules": [{
                "id": "default",
                "form_id": form_id,
                "name": "Default Duplicate Check",
                "fields": [],
                "threshold": 1.0,
                "action": "flag",
                "is_active": False,
                "description": "Configure fields to enable duplicate detection"
            }]
        }
    
    return {"rules": rules}


@router.post("/rules")
async def create_duplicate_rule(
    request: Request,
    rule: DuplicateRule,
    current_user: dict = Depends(get_current_user)
):
    """Create a new duplicate detection rule"""
    db = request.app.state.db
    
    rule_data = rule.model_dump()
    rule_data["id"] = str(ObjectId())
    rule_data["created_by"] = current_user["user_id"]
    rule_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.duplicate_rules.insert_one(rule_data)
    
    return {"id": rule_data["id"], "message": "Rule created successfully"}


@router.put("/rules/{rule_id}")
async def update_duplicate_rule(
    request: Request,
    rule_id: str,
    rule: DuplicateRule,
    current_user: dict = Depends(get_current_user)
):
    """Update a duplicate detection rule"""
    db = request.app.state.db
    
    result = await db.duplicate_rules.update_one(
        {"id": rule_id},
        {"$set": {
            "name": rule.name,
            "fields": rule.fields,
            "threshold": rule.threshold,
            "action": rule.action,
            "is_active": rule.is_active,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return {"message": "Rule updated successfully"}


@router.delete("/rules/{rule_id}")
async def delete_duplicate_rule(
    request: Request,
    rule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a duplicate detection rule"""
    db = request.app.state.db
    
    result = await db.duplicate_rules.delete_one({"id": rule_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return {"message": "Rule deleted successfully"}


@router.post("/check")
async def check_for_duplicates(
    request: Request,
    submission_data: Dict[str, Any],
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if submission data has duplicates before saving"""
    db = request.app.state.db
    
    # Get active rules for this form
    rules = await db.duplicate_rules.find(
        {"form_id": form_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    if not rules:
        return {"has_duplicates": False, "matches": []}
    
    # Get existing submissions
    existing = await db.submissions.find(
        {"form_id": form_id},
        {"_id": 0, "id": 1, "data": 1}
    ).to_list(1000)  # Limit for performance
    
    matches = []
    
    for rule in rules:
        fields = rule["fields"]
        threshold = rule.get("threshold", 1.0)
        
        if threshold >= 1.0:
            # Exact matching using hash
            new_hash = compute_field_hash(submission_data, fields)
            
            for sub in existing:
                sub_hash = compute_field_hash(sub.get("data", {}), fields)
                if new_hash == sub_hash:
                    matches.append({
                        "matched_submission_id": sub["id"],
                        "similarity_score": 1.0,
                        "matched_fields": fields,
                        "rule_id": rule["id"],
                        "rule_name": rule["name"],
                        "action": rule["action"]
                    })
        else:
            # Fuzzy matching
            for sub in existing:
                similarity, matched_fields = compute_similarity(
                    submission_data,
                    sub.get("data", {}),
                    fields
                )
                
                if similarity >= threshold:
                    matches.append({
                        "matched_submission_id": sub["id"],
                        "similarity_score": similarity,
                        "matched_fields": matched_fields,
                        "rule_id": rule["id"],
                        "rule_name": rule["name"],
                        "action": rule["action"]
                    })
    
    # Determine if we should block
    should_block = any(m["action"] == "block" for m in matches)
    should_warn = any(m["action"] == "warn" for m in matches)
    
    return {
        "has_duplicates": len(matches) > 0,
        "should_block": should_block,
        "should_warn": should_warn,
        "matches": matches
    }


@router.get("/submissions/{form_id}")
async def get_flagged_duplicates(
    request: Request,
    form_id: str,
    status: str = "pending",
    current_user: dict = Depends(get_current_user)
):
    """Get submissions flagged as potential duplicates"""
    db = request.app.state.db
    
    duplicates = await db.duplicate_matches.find(
        {"form_id": form_id, "status": status},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with submission data
    enriched = []
    for dup in duplicates:
        sub1 = await db.submissions.find_one(
            {"id": dup["submission_id"]},
            {"_id": 0, "id": 1, "data": 1, "submitted_at": 1, "submitted_by": 1}
        )
        sub2 = await db.submissions.find_one(
            {"id": dup["matched_submission_id"]},
            {"_id": 0, "id": 1, "data": 1, "submitted_at": 1, "submitted_by": 1}
        )
        
        if sub1 and sub2:
            enriched.append({
                **dup,
                "submission": sub1,
                "matched_submission": sub2
            })
    
    return {"duplicates": enriched}


@router.post("/resolve/{match_id}")
async def resolve_duplicate(
    request: Request,
    match_id: str,
    action: str,  # "confirm", "dismiss", "merge"
    keep_submission_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Resolve a duplicate match"""
    db = request.app.state.db
    
    match = await db.duplicate_matches.find_one({"id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if action == "dismiss":
        # Mark as not a duplicate
        await db.duplicate_matches.update_one(
            {"id": match_id},
            {"$set": {
                "status": "dismissed",
                "resolved_by": current_user["user_id"],
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    elif action == "confirm":
        # Mark as confirmed duplicate
        await db.duplicate_matches.update_one(
            {"id": match_id},
            {"$set": {
                "status": "confirmed",
                "resolved_by": current_user["user_id"],
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Optionally delete the duplicate submission
        if keep_submission_id:
            delete_id = match["submission_id"] if keep_submission_id == match["matched_submission_id"] else match["matched_submission_id"]
            await db.submissions.update_one(
                {"id": delete_id},
                {"$set": {"status": "deleted", "deleted_reason": "duplicate"}}
            )
    
    return {"message": f"Duplicate {action}ed successfully"}


@router.get("/stats/{form_id}")
async def get_duplicate_stats(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get duplicate detection statistics for a form"""
    db = request.app.state.db
    
    total = await db.duplicate_matches.count_documents({"form_id": form_id})
    pending = await db.duplicate_matches.count_documents({"form_id": form_id, "status": "pending"})
    confirmed = await db.duplicate_matches.count_documents({"form_id": form_id, "status": "confirmed"})
    dismissed = await db.duplicate_matches.count_documents({"form_id": form_id, "status": "dismissed"})
    
    return {
        "total": total,
        "pending": pending,
        "confirmed": confirmed,
        "dismissed": dismissed,
        "duplicate_rate": (confirmed / max(total, 1)) * 100
    }
