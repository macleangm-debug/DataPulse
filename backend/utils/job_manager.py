"""
DataPulse - Background Jobs

Celery-based background job processing for heavy computations.
Falls back to in-memory processing if Redis is unavailable.
"""

import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable
from enum import Enum
import json
import traceback

# In-memory job storage (fallback when Redis unavailable)
_job_store: Dict[str, dict] = {}


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobManager:
    """
    Manages background jobs with in-memory fallback.
    Supports progress tracking and result storage.
    """
    
    def __init__(self, redis_client=None):
        self.redis = redis_client
        self.use_redis = redis_client is not None
    
    async def create_job(
        self,
        job_type: str,
        params: dict,
        user_id: str,
        org_id: str
    ) -> str:
        """Create a new job and return job ID"""
        job_id = str(uuid.uuid4())
        
        job_data = {
            "id": job_id,
            "type": job_type,
            "params": params,
            "user_id": user_id,
            "org_id": org_id,
            "status": JobStatus.PENDING,
            "progress": 0,
            "message": "Job created",
            "created_at": datetime.utcnow().isoformat(),
            "started_at": None,
            "completed_at": None,
            "result": None,
            "error": None
        }
        
        if self.use_redis:
            await self.redis.setex(
                f"job:{job_id}",
                3600,  # 1 hour TTL
                json.dumps(job_data)
            )
        else:
            _job_store[job_id] = job_data
        
        return job_id
    
    async def get_job(self, job_id: str) -> Optional[dict]:
        """Get job status and details"""
        if self.use_redis:
            data = await self.redis.get(f"job:{job_id}")
            return json.loads(data) if data else None
        else:
            return _job_store.get(job_id)
    
    async def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result: Optional[Any] = None,
        error: Optional[str] = None
    ):
        """Update job status and progress"""
        job = await self.get_job(job_id)
        if not job:
            return
        
        if status:
            job["status"] = status
            if status == JobStatus.RUNNING and not job["started_at"]:
                job["started_at"] = datetime.utcnow().isoformat()
            elif status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                job["completed_at"] = datetime.utcnow().isoformat()
        
        if progress is not None:
            job["progress"] = min(100, max(0, progress))
        
        if message:
            job["message"] = message
        
        if result is not None:
            job["result"] = result
        
        if error:
            job["error"] = error
        
        if self.use_redis:
            await self.redis.setex(
                f"job:{job_id}",
                3600,
                json.dumps(job)
            )
        else:
            _job_store[job_id] = job
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a pending or running job"""
        job = await self.get_job(job_id)
        if not job:
            return False
        
        if job["status"] in [JobStatus.PENDING, JobStatus.RUNNING]:
            await self.update_job(
                job_id,
                status=JobStatus.CANCELLED,
                message="Job cancelled by user"
            )
            return True
        
        return False
    
    async def list_jobs(
        self,
        user_id: Optional[str] = None,
        org_id: Optional[str] = None,
        status: Optional[JobStatus] = None,
        limit: int = 20
    ) -> list:
        """List jobs with optional filters"""
        if self.use_redis:
            # Scan for job keys
            jobs = []
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(cursor, match="job:*", count=100)
                for key in keys:
                    data = await self.redis.get(key)
                    if data:
                        job = json.loads(data)
                        if self._matches_filter(job, user_id, org_id, status):
                            jobs.append(job)
                if cursor == 0:
                    break
            return sorted(jobs, key=lambda x: x["created_at"], reverse=True)[:limit]
        else:
            jobs = [
                job for job in _job_store.values()
                if self._matches_filter(job, user_id, org_id, status)
            ]
            return sorted(jobs, key=lambda x: x["created_at"], reverse=True)[:limit]
    
    def _matches_filter(
        self,
        job: dict,
        user_id: Optional[str],
        org_id: Optional[str],
        status: Optional[JobStatus]
    ) -> bool:
        """Check if job matches filter criteria"""
        if user_id and job.get("user_id") != user_id:
            return False
        if org_id and job.get("org_id") != org_id:
            return False
        if status and job.get("status") != status:
            return False
        return True
    
    async def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove jobs older than max_age_hours"""
        cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
        cutoff_str = cutoff.isoformat()
        
        if not self.use_redis:
            to_delete = [
                job_id for job_id, job in _job_store.items()
                if job.get("created_at", "") < cutoff_str
            ]
            for job_id in to_delete:
                del _job_store[job_id]


# Global job manager instance (initialized in server.py)
job_manager: Optional[JobManager] = None


def get_job_manager() -> JobManager:
    """Get the global job manager instance"""
    global job_manager
    if job_manager is None:
        job_manager = JobManager()
    return job_manager


async def run_background_job(
    job_id: str,
    task_func: Callable,
    *args,
    **kwargs
):
    """
    Run a function as a background job with progress tracking.
    
    The task_func should accept a progress_callback parameter.
    """
    manager = get_job_manager()
    
    try:
        await manager.update_job(
            job_id,
            status=JobStatus.RUNNING,
            message="Processing..."
        )
        
        async def progress_callback(current: int, total: int, message: str = None):
            progress = int((current / total) * 100) if total > 0 else 0
            await manager.update_job(
                job_id,
                progress=progress,
                message=message or f"Processing {current}/{total}..."
            )
        
        # Run the task
        if asyncio.iscoroutinefunction(task_func):
            result = await task_func(*args, progress_callback=progress_callback, **kwargs)
        else:
            result = task_func(*args, progress_callback=progress_callback, **kwargs)
        
        await manager.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Completed successfully",
            result=result
        )
        
    except Exception as e:
        await manager.update_job(
            job_id,
            status=JobStatus.FAILED,
            error=str(e),
            message=f"Failed: {str(e)}"
        )
        traceback.print_exc()
