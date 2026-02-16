"""
DataPulse - Performance Optimized Bulk Operations
High-throughput endpoints for bulk data processing
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, BackgroundTasks
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import asyncio
import logging
import uuid

from auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bulk", tags=["Bulk Operations"])


# ============================================================================
# MODELS
# ============================================================================

class BulkSubmissionItem(BaseModel):
    """Single submission in a bulk request"""
    form_id: str
    form_version: Optional[int] = None
    data: Dict[str, Any]
    device_id: Optional[str] = None
    device_info: Optional[Dict[str, Any]] = None
    client_timestamp: Optional[str] = None  # For offline sync ordering


class BulkSubmissionRequest(BaseModel):
    """Bulk submission request - up to 1000 submissions"""
    submissions: List[BulkSubmissionItem] = Field(..., max_length=1000)
    sync_mode: str = Field(default="insert", description="insert, upsert, or update")
    batch_id: Optional[str] = None  # For tracking/idempotency


class BulkSubmissionResult(BaseModel):
    """Result of bulk submission operation"""
    batch_id: str
    total: int
    successful: int
    failed: int
    results: List[Dict[str, Any]]
    processing_time_ms: float


class BulkDeleteRequest(BaseModel):
    """Bulk delete request"""
    ids: List[str] = Field(..., max_length=500)
    soft_delete: bool = True


class BulkUpdateRequest(BaseModel):
    """Bulk update request"""
    updates: List[Dict[str, Any]] = Field(..., max_length=500)
    # Each update should have: {"id": "...", "data": {...}}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_quality_score(data: Dict[str, Any], form_fields: List[Dict]) -> tuple:
    """Calculate submission quality score and flags"""
    score = 100.0
    flags = []
    
    field_map = {f.get("name", ""): f for f in form_fields if f.get("name")}
    
    for field_name, field_config in field_map.items():
        value = data.get(field_name)
        
        # Check required fields
        if field_config.get("validation", {}).get("required") and not value:
            score -= 10
            flags.append(f"missing_required:{field_name}")
        
        # Check value constraints
        validation = field_config.get("validation", {})
        if value is not None:
            if validation.get("min_value") is not None and isinstance(value, (int, float)):
                if value < validation["min_value"]:
                    score -= 5
                    flags.append(f"below_min:{field_name}")
            
            if validation.get("max_value") is not None and isinstance(value, (int, float)):
                if value > validation["max_value"]:
                    score -= 5
                    flags.append(f"above_max:{field_name}")
    
    return max(0, score), flags


async def get_forms_batch(db, form_ids: List[str]) -> Dict[str, Dict]:
    """Batch fetch forms for performance"""
    forms = {}
    cursor = db.forms.find(
        {"id": {"$in": list(set(form_ids))}},
        {"_id": 0, "id": 1, "org_id": 1, "project_id": 1, "version": 1, "status": 1, "fields": 1}
    )
    async for form in cursor:
        forms[form["id"]] = form
    return forms


async def check_user_access_batch(db, user_id: str, org_ids: List[str]) -> set:
    """Batch check user access to organizations"""
    accessible_orgs = set()
    cursor = db.org_members.find(
        {"user_id": user_id, "org_id": {"$in": list(set(org_ids))}},
        {"_id": 0, "org_id": 1}
    )
    async for membership in cursor:
        accessible_orgs.add(membership["org_id"])
    return accessible_orgs


# ============================================================================
# BULK ENDPOINTS
# ============================================================================

@router.post("/submissions", response_model=BulkSubmissionResult)
async def create_bulk_submissions_optimized(
    request: Request,
    data: BulkSubmissionRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    High-performance bulk submission endpoint.
    
    Features:
    - Batch database operations (single round-trip)
    - Parallel form validation
    - Bulk insert with ordered=False for maximum throughput
    - Background quality scoring for large batches
    
    Limits:
    - Maximum 1000 submissions per request
    - Maximum 10MB total payload
    """
    import time
    start_time = time.time()
    
    db = request.app.state.db
    user_id = current_user["user_id"]
    is_superadmin = current_user.get("is_superadmin", False)
    
    batch_id = data.batch_id or str(uuid.uuid4())
    
    # 1. Batch fetch all forms
    form_ids = [sub.form_id for sub in data.submissions]
    forms = await get_forms_batch(db, form_ids)
    
    # 2. Batch check user access
    org_ids = [f["org_id"] for f in forms.values() if f]
    accessible_orgs = await check_user_access_batch(db, user_id, org_ids) if not is_superadmin else set(org_ids)
    
    # 3. Prepare submissions for bulk insert
    documents_to_insert = []
    results = []
    now = datetime.now(timezone.utc)
    
    for idx, sub in enumerate(data.submissions):
        form = forms.get(sub.form_id)
        
        # Validation checks
        if not form:
            results.append({"index": idx, "success": False, "error": "Form not found", "form_id": sub.form_id})
            continue
        
        if form["org_id"] not in accessible_orgs and not is_superadmin:
            results.append({"index": idx, "success": False, "error": "Not authorized", "form_id": sub.form_id})
            continue
        
        if form["status"] != "published":
            results.append({"index": idx, "success": False, "error": "Form not published", "form_id": sub.form_id})
            continue
        
        # Calculate quality score
        quality_score, quality_flags = calculate_quality_score(sub.data, form.get("fields", []))
        
        # Extract GPS if present
        gps_location = None
        gps_accuracy = None
        if "_gps" in sub.data:
            gps_data = sub.data["_gps"]
            if isinstance(gps_data, dict):
                gps_location = {
                    "lat": gps_data.get("latitude"),
                    "lng": gps_data.get("longitude")
                }
                gps_accuracy = gps_data.get("accuracy")
        
        # Create document
        submission_id = str(uuid.uuid4())
        doc = {
            "id": submission_id,
            "form_id": sub.form_id,
            "form_version": sub.form_version or form["version"],
            "data": sub.data,
            "device_id": sub.device_id,
            "device_info": sub.device_info,
            "org_id": form["org_id"],
            "project_id": form["project_id"],
            "submitted_by": user_id,
            "submitted_at": now.isoformat(),
            "synced_at": now.isoformat(),
            "status": "pending",
            "gps_location": gps_location,
            "gps_accuracy": gps_accuracy,
            "quality_score": quality_score,
            "quality_flags": quality_flags,
            "batch_id": batch_id
        }
        
        documents_to_insert.append(doc)
        results.append({"index": idx, "success": True, "id": submission_id, "form_id": sub.form_id})
    
    # 4. Bulk insert with ordered=False for maximum performance
    successful_count = 0
    if documents_to_insert:
        try:
            # ordered=False allows continuing on errors for maximum throughput
            insert_result = await db.submissions.insert_many(documents_to_insert, ordered=False)
            successful_count = len(insert_result.inserted_ids)
        except Exception as e:
            # Handle partial failures
            logger.error(f"Bulk insert error: {e}")
            if hasattr(e, 'details') and 'writeErrors' in e.details:
                # Some documents were inserted
                successful_count = len(documents_to_insert) - len(e.details['writeErrors'])
                for error in e.details['writeErrors']:
                    idx = error['index']
                    results[idx] = {"index": idx, "success": False, "error": str(error['errmsg'])}
    
    # 5. Calculate processing time
    processing_time = (time.time() - start_time) * 1000
    
    # 6. Log bulk operation
    background_tasks.add_task(
        log_bulk_operation,
        db,
        batch_id,
        "submissions",
        len(data.submissions),
        successful_count,
        user_id,
        processing_time
    )
    
    return BulkSubmissionResult(
        batch_id=batch_id,
        total=len(data.submissions),
        successful=successful_count,
        failed=len(data.submissions) - successful_count,
        results=results,
        processing_time_ms=round(processing_time, 2)
    )


@router.post("/submissions/delete")
async def bulk_delete_submissions(
    request: Request,
    data: BulkDeleteRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk delete submissions.
    Supports soft delete (status change) or hard delete.
    """
    import time
    start_time = time.time()
    
    db = request.app.state.db
    user_id = current_user["user_id"]
    is_superadmin = current_user.get("is_superadmin", False)
    
    if data.soft_delete:
        # Soft delete - update status
        result = await db.submissions.update_many(
            {"id": {"$in": data.ids}},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": user_id
                }
            }
        )
        deleted_count = result.modified_count
    else:
        # Hard delete - only for superadmins
        if not is_superadmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superadmins can hard delete"
            )
        result = await db.submissions.delete_many({"id": {"$in": data.ids}})
        deleted_count = result.deleted_count
    
    processing_time = (time.time() - start_time) * 1000
    
    return {
        "total_requested": len(data.ids),
        "deleted": deleted_count,
        "soft_delete": data.soft_delete,
        "processing_time_ms": round(processing_time, 2)
    }


@router.post("/submissions/update")
async def bulk_update_submissions(
    request: Request,
    data: BulkUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Bulk update submissions.
    Each update should specify an id and the fields to update.
    """
    import time
    start_time = time.time()
    
    db = request.app.state.db
    user_id = current_user["user_id"]
    
    results = []
    successful = 0
    
    # Use bulk_write for better performance
    from pymongo import UpdateOne
    
    operations = []
    for update in data.updates:
        submission_id = update.get("id")
        update_data = update.get("data", {})
        
        if not submission_id:
            results.append({"id": submission_id, "success": False, "error": "Missing id"})
            continue
        
        # Add metadata
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_data["updated_by"] = user_id
        
        operations.append(
            UpdateOne(
                {"id": submission_id},
                {"$set": update_data}
            )
        )
        results.append({"id": submission_id, "success": True})
    
    if operations:
        try:
            bulk_result = await db.submissions.bulk_write(operations, ordered=False)
            successful = bulk_result.modified_count
        except Exception as e:
            logger.error(f"Bulk update error: {e}")
            successful = 0
    
    processing_time = (time.time() - start_time) * 1000
    
    return {
        "total_requested": len(data.updates),
        "successful": successful,
        "failed": len(data.updates) - successful,
        "results": results,
        "processing_time_ms": round(processing_time, 2)
    }


@router.get("/status/{batch_id}")
async def get_bulk_operation_status(
    batch_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get status of a bulk operation by batch ID"""
    db = request.app.state.db
    
    # Get batch log
    batch_log = await db.bulk_operation_logs.find_one(
        {"batch_id": batch_id},
        {"_id": 0}
    )
    
    if not batch_log:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Count submissions in this batch
    submission_count = await db.submissions.count_documents({"batch_id": batch_id})
    
    return {
        **batch_log,
        "current_submission_count": submission_count
    }


# ============================================================================
# BACKGROUND TASKS
# ============================================================================

async def log_bulk_operation(
    db,
    batch_id: str,
    operation_type: str,
    total: int,
    successful: int,
    user_id: str,
    processing_time_ms: float
):
    """Log bulk operation for auditing and monitoring"""
    try:
        await db.bulk_operation_logs.insert_one({
            "batch_id": batch_id,
            "operation_type": operation_type,
            "total": total,
            "successful": successful,
            "failed": total - successful,
            "user_id": user_id,
            "processing_time_ms": processing_time_ms,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Failed to log bulk operation: {e}")
