"""DataPulse - Background Task Management Routes
Endpoints for checking status of Celery background tasks
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(prefix="/tasks", tags=["Background Tasks"])


# Request/Response Models
class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    ready: bool
    successful: Optional[bool] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    info: Optional[dict] = None


class TaskSubmitResponse(BaseModel):
    task_id: str
    task_type: str
    submitted_at: str
    message: str


class TranscriptionRequest(BaseModel):
    submission_id: Optional[str] = None
    field_id: Optional[str] = None
    language: Optional[str] = None


class SentimentRequest(BaseModel):
    text: str
    submission_id: Optional[str] = None
    field_id: Optional[str] = None


class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = None


class QualityCheckRequest(BaseModel):
    submission_id: str
    form_id: str
    data: dict
    check_types: Optional[List[str]] = None


class BulkExportRequest(BaseModel):
    form_id: str
    export_format: str = "csv"
    filters: Optional[dict] = None
    include_fields: Optional[List[str]] = None


# ============= Task Status Endpoints =============

@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    Get the status of a background task by ID
    
    Returns:
    - PENDING: Task is waiting to be executed
    - STARTED: Task has started execution
    - SUCCESS: Task completed successfully
    - FAILURE: Task failed
    - RETRY: Task is being retried
    - REVOKED: Task was cancelled
    """
    try:
        from services.celery_worker import get_task_status
        status = get_task_status(task_id)
        return TaskStatusResponse(**status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")


@router.delete("/revoke/{task_id}")
async def revoke_task(task_id: str, terminate: bool = False):
    """
    Revoke/cancel a pending or running task
    
    - terminate: If True, forcefully terminate the task (use with caution)
    """
    try:
        from services.celery_worker import revoke_task as do_revoke
        success = do_revoke(task_id, terminate=terminate)
        if success:
            return {"message": "Task revoked successfully", "task_id": task_id}
        else:
            raise HTTPException(status_code=500, detail="Failed to revoke task")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revoke task: {str(e)}")


# ============= Task Submission Endpoints =============

@router.post("/transcribe", response_model=TaskSubmitResponse)
async def submit_transcription_task(
    request: Request,
    params: TranscriptionRequest
):
    """
    Submit an audio file for background transcription
    
    The audio file should be uploaded separately and the bytes passed here.
    For file uploads, use the /api/media/upload endpoint first.
    """
    try:
        # For now, return a placeholder since audio needs to be uploaded first
        return TaskSubmitResponse(
            task_id="placeholder-use-media-upload",
            task_type="transcription",
            submitted_at=datetime.now(timezone.utc).isoformat(),
            message="Upload audio via /api/media/upload first, then use /api/ai/transcribe"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sentiment", response_model=TaskSubmitResponse)
async def submit_sentiment_task(params: SentimentRequest):
    """
    Submit text for background sentiment analysis
    
    Returns a task_id that can be used to check status via /tasks/status/{task_id}
    """
    try:
        from services.celery_tasks import submit_sentiment_analysis
        task_id = submit_sentiment_analysis(
            text=params.text,
            submission_id=params.submission_id,
            field_id=params.field_id
        )
        return TaskSubmitResponse(
            task_id=task_id,
            task_type="sentiment_analysis",
            submitted_at=datetime.now(timezone.utc).isoformat(),
            message="Sentiment analysis task submitted successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate", response_model=TaskSubmitResponse)
async def submit_translation_task(params: TranslationRequest):
    """
    Submit text for background translation
    
    Returns a task_id that can be used to check status via /tasks/status/{task_id}
    """
    try:
        from services.celery_tasks import submit_translation
        task_id = submit_translation(
            text=params.text,
            target_language=params.target_language,
            source_language=params.source_language
        )
        return TaskSubmitResponse(
            task_id=task_id,
            task_type="translation",
            submitted_at=datetime.now(timezone.utc).isoformat(),
            message="Translation task submitted successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quality-check", response_model=TaskSubmitResponse)
async def submit_quality_check_task(params: QualityCheckRequest):
    """
    Submit submission data for background AI quality checking
    
    Returns a task_id that can be used to check status via /tasks/status/{task_id}
    """
    try:
        from services.celery_tasks import submit_quality_check
        task_id = submit_quality_check(
            submission_id=params.submission_id,
            form_id=params.form_id,
            data=params.data,
            check_types=params.check_types
        )
        return TaskSubmitResponse(
            task_id=task_id,
            task_type="quality_check",
            submitted_at=datetime.now(timezone.utc).isoformat(),
            message="Quality check task submitted successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export", response_model=TaskSubmitResponse)
async def submit_export_task(params: BulkExportRequest):
    """
    Submit a bulk data export job
    
    For large datasets, this runs in the background to prevent timeouts.
    Returns a task_id that can be used to check status via /tasks/status/{task_id}
    """
    try:
        from services.celery_tasks import submit_bulk_export
        task_id = submit_bulk_export(
            form_id=params.form_id,
            export_format=params.export_format,
            filters=params.filters,
            include_fields=params.include_fields
        )
        return TaskSubmitResponse(
            task_id=task_id,
            task_type="bulk_export",
            submitted_at=datetime.now(timezone.utc).isoformat(),
            message="Export task submitted successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Cache Management Endpoints =============

@router.get("/cache/stats")
async def get_cache_stats():
    """
    Get Redis cache statistics
    
    Returns cache hit/miss rates and memory usage
    """
    try:
        from services.cache_service import cache_service
        
        if not cache_service.enabled:
            return {
                "enabled": False,
                "message": "Redis cache is not connected"
            }
        
        # Get Redis info
        client = cache_service.client
        info = client.info("memory")
        
        return {
            "enabled": True,
            "memory_used": info.get("used_memory_human", "unknown"),
            "memory_peak": info.get("used_memory_peak_human", "unknown"),
            "connected_clients": client.info("clients").get("connected_clients", 0)
        }
    except Exception as e:
        return {
            "enabled": False,
            "error": str(e)
        }


@router.delete("/cache/invalidate/{prefix}")
async def invalidate_cache(prefix: str):
    """
    Invalidate cache entries by prefix
    
    Prefixes: dashboard, analytics, form, submission, quality, stats
    """
    try:
        from services.cache_service import cache_service
        
        if not cache_service.enabled:
            return {"message": "Cache not enabled", "deleted": 0}
        
        deleted = cache_service.delete_pattern(prefix)
        return {
            "message": f"Cache invalidated for prefix: {prefix}",
            "deleted": deleted
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= Infrastructure Health =============

@router.get("/health")
async def infrastructure_health():
    """
    Check health of background task infrastructure
    
    Returns status of Redis and Celery connections
    """
    health = {
        "redis": {"status": "unknown"},
        "celery": {"status": "unknown"},
        "cache": {"status": "unknown"}
    }
    
    # Check Redis
    try:
        from services.cache_service import get_redis_client
        redis_client = get_redis_client()
        if redis_client and redis_client.ping():
            health["redis"] = {"status": "connected"}
        else:
            health["redis"] = {"status": "disconnected"}
    except Exception as e:
        health["redis"] = {"status": "error", "message": str(e)}
    
    # Check Cache Service
    try:
        from services.cache_service import cache_service
        health["cache"] = {
            "status": "enabled" if cache_service.enabled else "disabled"
        }
    except Exception as e:
        health["cache"] = {"status": "error", "message": str(e)}
    
    # Check Celery (basic check)
    try:
        from services.celery_worker import celery_app
        # Just verify the app is configured
        health["celery"] = {
            "status": "configured",
            "broker": celery_app.conf.broker_url[:30] + "..." if celery_app.conf.broker_url else "not set"
        }
    except Exception as e:
        health["celery"] = {"status": "error", "message": str(e)}
    
    return health
