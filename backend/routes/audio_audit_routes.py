"""DataPulse - Audio Audit System Routes
Background recording during surveys for field verification
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid
import io
import base64

from auth import get_current_user

router = APIRouter(prefix="/audio-audit", tags=["Audio Audit"])


def gen_id():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


# ============= MODELS =============

class AudioAuditConfig(BaseModel):
    """Configuration for audio audit on a form"""
    enabled: bool = False
    mode: str = "full"  # "full", "random", "segments"
    random_percentage: int = 20  # For random mode: % of submissions to record
    segment_duration: int = 30  # For segments mode: duration in seconds
    segment_interval: int = 60  # For segments mode: interval between segments
    encrypt_recordings: bool = True
    retention_days: int = 90  # How long to keep recordings
    notify_enumerator: bool = True  # Show recording indicator
    quality: str = "medium"  # "low", "medium", "high"
    format: str = "webm"  # "webm", "mp3", "wav"


class AudioAuditConfigCreate(BaseModel):
    form_id: str
    config: AudioAuditConfig


class AudioAuditRecording(BaseModel):
    """A single audio recording from a submission"""
    id: str = Field(default_factory=gen_id)
    submission_id: str
    form_id: str
    org_id: str
    enumerator_id: str
    device_id: Optional[str] = None
    recording_type: str = "full"  # "full", "random_spot", "segment"
    segment_number: Optional[int] = None
    duration_seconds: float = 0
    file_size_bytes: int = 0
    file_path: Optional[str] = None  # GridFS or S3 path
    encrypted: bool = False
    recorded_at: datetime = Field(default_factory=utc_now)
    uploaded_at: datetime = Field(default_factory=utc_now)
    status: str = "pending"  # "pending", "uploaded", "reviewed", "flagged"
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    quality_flags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AudioAuditRecordingOut(BaseModel):
    id: str
    submission_id: str
    form_id: str
    enumerator_id: str
    recording_type: str
    duration_seconds: float
    recorded_at: datetime
    status: str
    reviewer_id: Optional[str]
    review_notes: Optional[str]
    quality_flags: List[str]


class AudioAuditUpload(BaseModel):
    submission_id: str
    form_id: str
    recording_type: str = "full"
    segment_number: Optional[int] = None
    duration_seconds: float
    device_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AudioAuditReview(BaseModel):
    status: str  # "reviewed", "flagged"
    notes: Optional[str] = None
    quality_flags: List[str] = Field(default_factory=list)


class AudioAuditStats(BaseModel):
    total_recordings: int
    total_duration_hours: float
    recordings_by_status: Dict[str, int]
    recordings_by_type: Dict[str, int]
    flagged_count: int
    reviewed_count: int
    pending_count: int


# ============= CONFIG ENDPOINTS =============

@router.post("/config")
async def create_or_update_config(
    request: Request,
    data: AudioAuditConfigCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update audio audit configuration for a form"""
    db = request.app.state.db
    
    # Verify form exists and user has access
    form = await db.forms.find_one({"id": data.form_id}, {"_id": 0, "org_id": 1})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check permission
    membership = await db.org_members.find_one({
        "org_id": form["org_id"],
        "user_id": current_user["user_id"],
        "role": {"$in": ["admin", "manager"]}
    })
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    config_doc = {
        "form_id": data.form_id,
        "org_id": form["org_id"],
        "config": data.config.model_dump(),
        "updated_by": current_user["user_id"],
        "updated_at": utc_now().isoformat()
    }
    
    # Upsert config
    await db.audio_audit_configs.update_one(
        {"form_id": data.form_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Audio audit configuration saved"}


@router.get("/config/{form_id}")
async def get_config(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get audio audit configuration for a form"""
    db = request.app.state.db
    
    config = await db.audio_audit_configs.find_one(
        {"form_id": form_id},
        {"_id": 0}
    )
    
    if not config:
        # Return default config
        return {
            "form_id": form_id,
            "config": AudioAuditConfig().model_dump()
        }
    
    return config


@router.delete("/config/{form_id}")
async def delete_config(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete audio audit configuration for a form"""
    db = request.app.state.db
    
    result = await db.audio_audit_configs.delete_one({"form_id": form_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {"success": True, "message": "Configuration deleted"}


# ============= RECORDING ENDPOINTS =============

@router.post("/upload")
async def upload_recording(
    request: Request,
    file: UploadFile = File(...),
    submission_id: str = Form(...),
    form_id: str = Form(...),
    recording_type: str = Form("full"),
    segment_number: Optional[int] = Form(None),
    duration_seconds: float = Form(0),
    device_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload an audio recording for a submission"""
    db = request.app.state.db
    
    # Verify submission exists
    submission = await db.submissions.find_one(
        {"id": submission_id},
        {"_id": 0, "org_id": 1, "project_id": 1}
    )
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Store in GridFS or as base64 in document (for smaller files)
    recording_id = gen_id()
    
    if file_size > 5 * 1024 * 1024:  # > 5MB, use GridFS
        from gridfs import GridFS
        import motor.motor_asyncio
        
        # Store in GridFS
        fs = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db)
        file_id = await fs.upload_from_stream(
            f"audio_{recording_id}.{file.filename.split('.')[-1]}",
            io.BytesIO(content),
            metadata={
                "recording_id": recording_id,
                "submission_id": submission_id,
                "form_id": form_id
            }
        )
        file_path = f"gridfs:{file_id}"
    else:
        # Store as base64 in document
        file_path = f"base64:{base64.b64encode(content).decode()}"
    
    # Create recording document
    recording = AudioAuditRecording(
        id=recording_id,
        submission_id=submission_id,
        form_id=form_id,
        org_id=submission["org_id"],
        enumerator_id=current_user["user_id"],
        device_id=device_id,
        recording_type=recording_type,
        segment_number=segment_number,
        duration_seconds=duration_seconds,
        file_size_bytes=file_size,
        file_path=file_path,
        status="uploaded",
        metadata={
            "filename": file.filename,
            "content_type": file.content_type
        }
    )
    
    recording_dict = recording.model_dump()
    recording_dict["recorded_at"] = recording_dict["recorded_at"].isoformat()
    recording_dict["uploaded_at"] = recording_dict["uploaded_at"].isoformat()
    
    await db.audio_audit_recordings.insert_one(recording_dict)
    
    return {
        "success": True,
        "recording_id": recording_id,
        "message": "Recording uploaded successfully"
    }


@router.get("/recordings")
async def list_recordings(
    request: Request,
    form_id: Optional[str] = None,
    submission_id: Optional[str] = None,
    enumerator_id: Optional[str] = None,
    status: Optional[str] = None,
    recording_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List audio audit recordings with filters"""
    db = request.app.state.db
    
    # Build query
    query = {}
    
    if form_id:
        query["form_id"] = form_id
    if submission_id:
        query["submission_id"] = submission_id
    if enumerator_id:
        query["enumerator_id"] = enumerator_id
    if status:
        query["status"] = status
    if recording_type:
        query["recording_type"] = recording_type
    if start_date:
        query["recorded_at"] = {"$gte": start_date}
    if end_date:
        if "recorded_at" in query:
            query["recorded_at"]["$lte"] = end_date
        else:
            query["recorded_at"] = {"$lte": end_date}
    
    # Get recordings
    cursor = db.audio_audit_recordings.find(
        query,
        {"_id": 0, "file_path": 0}  # Exclude file content
    ).sort("recorded_at", -1).skip(skip).limit(limit)
    
    recordings = await cursor.to_list(length=limit)
    total = await db.audio_audit_recordings.count_documents(query)
    
    return {
        "recordings": recordings,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/recordings/{recording_id}")
async def get_recording(
    request: Request,
    recording_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific recording metadata"""
    db = request.app.state.db
    
    recording = await db.audio_audit_recordings.find_one(
        {"id": recording_id},
        {"_id": 0, "file_path": 0}
    )
    
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    return recording


@router.get("/recordings/{recording_id}/download")
async def download_recording(
    request: Request,
    recording_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download the audio file for a recording"""
    db = request.app.state.db
    
    recording = await db.audio_audit_recordings.find_one(
        {"id": recording_id},
        {"_id": 0}
    )
    
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    file_path = recording.get("file_path", "")
    
    if file_path.startswith("base64:"):
        # Decode base64
        content = base64.b64decode(file_path[7:])
        content_type = recording.get("metadata", {}).get("content_type", "audio/webm")
        filename = recording.get("metadata", {}).get("filename", f"recording_{recording_id}.webm")
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    elif file_path.startswith("gridfs:"):
        # Retrieve from GridFS
        import motor.motor_asyncio
        from bson import ObjectId
        
        file_id = ObjectId(file_path[7:])
        fs = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db)
        
        grid_out = await fs.open_download_stream(file_id)
        content = await grid_out.read()
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type="audio/webm",
            headers={"Content-Disposition": f"attachment; filename=recording_{recording_id}.webm"}
        )
    
    raise HTTPException(status_code=404, detail="Recording file not found")


@router.put("/recordings/{recording_id}/review")
async def review_recording(
    request: Request,
    recording_id: str,
    review: AudioAuditReview,
    current_user: dict = Depends(get_current_user)
):
    """Review an audio recording"""
    db = request.app.state.db
    
    # Update recording
    result = await db.audio_audit_recordings.update_one(
        {"id": recording_id},
        {
            "$set": {
                "status": review.status,
                "reviewer_id": current_user["user_id"],
                "reviewed_at": utc_now().isoformat(),
                "review_notes": review.notes,
                "quality_flags": review.quality_flags
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    return {"success": True, "message": "Recording reviewed"}


@router.delete("/recordings/{recording_id}")
async def delete_recording(
    request: Request,
    recording_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an audio recording"""
    db = request.app.state.db
    
    # Get recording to check file path
    recording = await db.audio_audit_recordings.find_one(
        {"id": recording_id},
        {"_id": 0, "file_path": 1}
    )
    
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    # Delete from GridFS if applicable
    file_path = recording.get("file_path", "")
    if file_path.startswith("gridfs:"):
        import motor.motor_asyncio
        from bson import ObjectId
        
        file_id = ObjectId(file_path[7:])
        fs = motor.motor_asyncio.AsyncIOMotorGridFSBucket(db)
        await fs.delete(file_id)
    
    # Delete document
    await db.audio_audit_recordings.delete_one({"id": recording_id})
    
    return {"success": True, "message": "Recording deleted"}


# ============= STATS ENDPOINTS =============

@router.get("/stats")
async def get_stats(
    request: Request,
    form_id: Optional[str] = None,
    org_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get audio audit statistics"""
    db = request.app.state.db
    
    # Build match query
    match_query = {}
    if form_id:
        match_query["form_id"] = form_id
    if org_id:
        match_query["org_id"] = org_id
    
    # Aggregation pipeline
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": None,
                "total_recordings": {"$sum": 1},
                "total_duration_seconds": {"$sum": "$duration_seconds"},
                "flagged_count": {
                    "$sum": {"$cond": [{"$eq": ["$status", "flagged"]}, 1, 0]}
                },
                "reviewed_count": {
                    "$sum": {"$cond": [{"$eq": ["$status", "reviewed"]}, 1, 0]}
                },
                "pending_count": {
                    "$sum": {"$cond": [{"$in": ["$status", ["pending", "uploaded"]]}, 1, 0]}
                }
            }
        }
    ]
    
    result = await db.audio_audit_recordings.aggregate(pipeline).to_list(1)
    
    if not result:
        return AudioAuditStats(
            total_recordings=0,
            total_duration_hours=0,
            recordings_by_status={},
            recordings_by_type={},
            flagged_count=0,
            reviewed_count=0,
            pending_count=0
        )
    
    stats = result[0]
    
    # Get breakdown by status
    status_pipeline = [
        {"$match": match_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_result = await db.audio_audit_recordings.aggregate(status_pipeline).to_list(10)
    recordings_by_status = {r["_id"]: r["count"] for r in status_result}
    
    # Get breakdown by type
    type_pipeline = [
        {"$match": match_query},
        {"$group": {"_id": "$recording_type", "count": {"$sum": 1}}}
    ]
    type_result = await db.audio_audit_recordings.aggregate(type_pipeline).to_list(10)
    recordings_by_type = {r["_id"]: r["count"] for r in type_result}
    
    return AudioAuditStats(
        total_recordings=stats.get("total_recordings", 0),
        total_duration_hours=stats.get("total_duration_seconds", 0) / 3600,
        recordings_by_status=recordings_by_status,
        recordings_by_type=recordings_by_type,
        flagged_count=stats.get("flagged_count", 0),
        reviewed_count=stats.get("reviewed_count", 0),
        pending_count=stats.get("pending_count", 0)
    )


@router.get("/enumerator-stats/{enumerator_id}")
async def get_enumerator_stats(
    request: Request,
    enumerator_id: str,
    form_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get audio audit statistics for a specific enumerator"""
    db = request.app.state.db
    
    match_query = {"enumerator_id": enumerator_id}
    if form_id:
        match_query["form_id"] = form_id
    
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": None,
                "total_recordings": {"$sum": 1},
                "total_duration_seconds": {"$sum": "$duration_seconds"},
                "flagged_count": {
                    "$sum": {"$cond": [{"$eq": ["$status", "flagged"]}, 1, 0]}
                },
                "avg_duration": {"$avg": "$duration_seconds"}
            }
        }
    ]
    
    result = await db.audio_audit_recordings.aggregate(pipeline).to_list(1)
    
    if not result:
        return {
            "enumerator_id": enumerator_id,
            "total_recordings": 0,
            "total_duration_hours": 0,
            "flagged_count": 0,
            "avg_duration_minutes": 0,
            "flag_rate": 0
        }
    
    stats = result[0]
    total = stats.get("total_recordings", 0)
    flagged = stats.get("flagged_count", 0)
    
    return {
        "enumerator_id": enumerator_id,
        "total_recordings": total,
        "total_duration_hours": stats.get("total_duration_seconds", 0) / 3600,
        "flagged_count": flagged,
        "avg_duration_minutes": stats.get("avg_duration", 0) / 60,
        "flag_rate": (flagged / total * 100) if total > 0 else 0
    }
