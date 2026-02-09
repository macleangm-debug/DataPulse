"""
DataPulse - Job Management Routes

API endpoints for managing and monitoring background jobs.
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from utils.job_manager import get_job_manager, JobStatus, run_background_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobResponse(BaseModel):
    id: str
    type: str
    status: str
    progress: int
    message: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None


class JobListResponse(BaseModel):
    jobs: List[JobResponse]
    total: int


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    """Get the status of a specific job"""
    manager = get_job_manager()
    job = await manager.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobResponse(
        id=job["id"],
        type=job["type"],
        status=job["status"],
        progress=job["progress"],
        message=job["message"],
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        error=job.get("error")
    )


@router.get("/{job_id}/result")
async def get_job_result(job_id: str):
    """Get the result of a completed job"""
    manager = get_job_manager()
    job = await manager.get_job(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed. Current status: {job['status']}"
        )
    
    return {
        "job_id": job_id,
        "status": job["status"],
        "result": job.get("result"),
        "completed_at": job.get("completed_at")
    }


@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a pending or running job"""
    manager = get_job_manager()
    
    success = await manager.cancel_job(job_id)
    
    if not success:
        job = await manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job['status']}"
        )
    
    return {"message": "Job cancelled", "job_id": job_id}


@router.get("/", response_model=JobListResponse)
async def list_jobs(
    request: Request,
    status: Optional[str] = None,
    limit: int = 20
):
    """List jobs for the current user"""
    manager = get_job_manager()
    
    # Get user info from request (set by auth middleware)
    user_id = getattr(request.state, 'user_id', None)
    org_id = request.query_params.get('org_id')
    
    status_filter = JobStatus(status) if status else None
    
    jobs = await manager.list_jobs(
        user_id=user_id,
        org_id=org_id,
        status=status_filter,
        limit=limit
    )
    
    return JobListResponse(
        jobs=[
            JobResponse(
                id=j["id"],
                type=j["type"],
                status=j["status"],
                progress=j["progress"],
                message=j["message"],
                created_at=j["created_at"],
                started_at=j.get("started_at"),
                completed_at=j.get("completed_at"),
                error=j.get("error")
            )
            for j in jobs
        ],
        total=len(jobs)
    )


@router.delete("/cleanup")
async def cleanup_old_jobs(max_age_hours: int = 24):
    """Clean up old completed/failed jobs"""
    manager = get_job_manager()
    await manager.cleanup_old_jobs(max_age_hours)
    return {"message": f"Cleaned up jobs older than {max_age_hours} hours"}
