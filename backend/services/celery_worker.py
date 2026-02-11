"""DataPulse - Celery Background Workers
Heavy AI processing, transcription, and async operations
"""
from celery import Celery
from celery.result import AsyncResult
import os
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import hashlib

# Celery Configuration
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

# Initialize Celery app
celery_app = Celery(
    "datapulse",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["services.celery_tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max per task
    task_soft_time_limit=540,  # 9 minutes soft limit
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=86400,  # Results expire after 24 hours
    
    # Task routes for different queues
    task_routes={
        "services.celery_tasks.transcribe_audio_task": {"queue": "ai_heavy"},
        "services.celery_tasks.sentiment_analysis_task": {"queue": "ai_light"},
        "services.celery_tasks.translate_text_task": {"queue": "ai_light"},
        "services.celery_tasks.quality_check_task": {"queue": "ai_heavy"},
        "services.celery_tasks.bulk_export_task": {"queue": "exports"},
        "services.celery_tasks.generate_report_task": {"queue": "reports"},
        "services.celery_tasks.blockchain_batch_record": {"queue": "blockchain"},
    },
    
    # Rate limits for AI tasks to prevent API abuse
    task_annotations={
        "services.celery_tasks.transcribe_audio_task": {"rate_limit": "10/m"},
        "services.celery_tasks.sentiment_analysis_task": {"rate_limit": "30/m"},
        "services.celery_tasks.translate_text_task": {"rate_limit": "30/m"},
        "services.celery_tasks.quality_check_task": {"rate_limit": "20/m"},
    }
)


class TaskStatus:
    """Task status tracking"""
    PENDING = "pending"
    STARTED = "started"
    SUCCESS = "success"
    FAILURE = "failure"
    RETRY = "retry"
    REVOKED = "revoked"


def get_task_status(task_id: str) -> Dict[str, Any]:
    """Get the status of a Celery task"""
    result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "status": result.status,
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
    }
    
    if result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.result)
    elif result.status == "STARTED":
        response["info"] = result.info
    
    return response


def revoke_task(task_id: str, terminate: bool = False) -> bool:
    """Revoke/cancel a task"""
    try:
        celery_app.control.revoke(task_id, terminate=terminate)
        return True
    except Exception as e:
        print(f"Failed to revoke task {task_id}: {e}")
        return False
