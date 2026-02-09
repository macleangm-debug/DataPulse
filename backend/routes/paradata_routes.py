"""DataPulse - Paradata (Audit Trail) Routes
Industry-standard paradata capture for research-grade data collection.

Captures:
- Time on question/page (start/end timestamps, duration)
- Navigation events (forward, backward, jump, skip)
- Edit events (value changes with before/after values)
- Pause/resume events (app backgrounding, screen lock)
- Focus/blur events on form fields
- Device metadata (device ID, OS, app version, screen size)
- GPS trail (periodic location updates if enabled)
- Validation trigger events
- Media capture events (photo, audio, video timestamps)
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import statistics

router = APIRouter(prefix="/paradata", tags=["Paradata"])


class EventType(str, Enum):
    # Navigation events
    FORM_START = "form_start"
    FORM_END = "form_end"
    PAGE_ENTER = "page_enter"
    PAGE_EXIT = "page_exit"
    QUESTION_FOCUS = "question_focus"
    QUESTION_BLUR = "question_blur"
    NAVIGATION_FORWARD = "nav_forward"
    NAVIGATION_BACKWARD = "nav_backward"
    NAVIGATION_JUMP = "nav_jump"
    
    # Edit events
    VALUE_CHANGE = "value_change"
    VALUE_CLEAR = "value_clear"
    
    # Validation events
    VALIDATION_TRIGGER = "validation_trigger"
    VALIDATION_FAIL = "validation_fail"
    VALIDATION_OVERRIDE = "validation_override"
    
    # Session events
    SESSION_PAUSE = "session_pause"
    SESSION_RESUME = "session_resume"
    SESSION_TIMEOUT = "session_timeout"
    APP_BACKGROUND = "app_background"
    APP_FOREGROUND = "app_foreground"
    
    # Media events
    PHOTO_CAPTURE_START = "photo_capture_start"
    PHOTO_CAPTURE_END = "photo_capture_end"
    AUDIO_RECORD_START = "audio_record_start"
    AUDIO_RECORD_END = "audio_record_end"
    VIDEO_RECORD_START = "video_record_start"
    VIDEO_RECORD_END = "video_record_end"
    
    # GPS events
    GPS_CAPTURE = "gps_capture"
    GPS_TRAIL_POINT = "gps_trail_point"
    
    # Error events
    SYNC_ERROR = "sync_error"
    VALIDATION_ERROR = "validation_error"
    NETWORK_ERROR = "network_error"


class ParadataEvent(BaseModel):
    event_type: EventType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Context
    page_index: Optional[int] = None
    page_name: Optional[str] = None
    question_name: Optional[str] = None
    question_type: Optional[str] = None
    
    # For value changes
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    
    # For navigation
    from_page: Optional[int] = None
    to_page: Optional[int] = None
    
    # For GPS
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    
    # For validation
    validation_rule: Optional[str] = None
    validation_message: Optional[str] = None
    
    # Additional metadata
    metadata: Optional[Dict[str, Any]] = None


class ParadataSession(BaseModel):
    submission_id: str
    form_id: str
    enumerator_id: str
    device_id: str
    
    # Device info
    device_os: Optional[str] = None
    device_model: Optional[str] = None
    app_version: Optional[str] = None
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    
    # Session timing
    session_start: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    session_end: Optional[datetime] = None
    
    # Events
    events: List[ParadataEvent] = []
    
    # Aggregated metrics (calculated on save)
    total_duration_seconds: Optional[float] = None
    active_duration_seconds: Optional[float] = None
    pause_duration_seconds: Optional[float] = None
    total_edits: Optional[int] = None
    total_backtracking: Optional[int] = None


class ParadataBatch(BaseModel):
    """Batch upload of paradata events (for offline sync)"""
    session_id: str
    events: List[ParadataEvent]


class QuestionTiming(BaseModel):
    question_name: str
    question_type: str
    page_index: int
    first_focus: Optional[datetime] = None
    last_blur: Optional[datetime] = None
    total_time_seconds: float = 0
    focus_count: int = 0
    edit_count: int = 0
    backtrack_count: int = 0


# ============ API Endpoints ============

@router.post("/sessions")
async def create_paradata_session(
    request: Request,
    session: ParadataSession
):
    """Create a new paradata session for a submission"""
    db = request.app.state.db
    
    session_doc = session.dict()
    session_doc["id"] = f"pds_{session.submission_id}_{int(datetime.now(timezone.utc).timestamp())}"
    session_doc["created_at"] = datetime.now(timezone.utc)
    
    await db.paradata_sessions.insert_one(session_doc)
    
    return {"session_id": session_doc["id"], "message": "Paradata session created"}


@router.post("/sessions/{session_id}/events")
async def add_paradata_events(
    request: Request,
    session_id: str,
    batch: ParadataBatch
):
    """Add paradata events to a session (supports batch upload for offline sync)"""
    db = request.app.state.db
    
    # Verify session exists
    session = await db.paradata_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Paradata session not found")
    
    # Convert events to dicts
    events_to_add = [e.dict() for e in batch.events]
    
    # Append events
    await db.paradata_sessions.update_one(
        {"id": session_id},
        {
            "$push": {"events": {"$each": events_to_add}},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"message": f"Added {len(events_to_add)} events", "session_id": session_id}


@router.post("/sessions/{session_id}/end")
async def end_paradata_session(
    request: Request,
    session_id: str
):
    """End a paradata session and calculate aggregated metrics"""
    db = request.app.state.db
    
    session = await db.paradata_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Paradata session not found")
    
    events = session.get("events", [])
    session_start = session.get("session_start")
    session_end = datetime.now(timezone.utc)
    
    # Calculate metrics
    metrics = calculate_session_metrics(events, session_start, session_end)
    
    await db.paradata_sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "session_end": session_end,
                **metrics
            }
        }
    )
    
    return {"message": "Session ended", "metrics": metrics}


@router.get("/submissions/{submission_id}")
async def get_submission_paradata(
    request: Request,
    submission_id: str
):
    """Get all paradata for a submission"""
    db = request.app.state.db
    
    sessions = await db.paradata_sessions.find(
        {"submission_id": submission_id}
    ).sort("session_start", 1).to_list(100)
    
    for s in sessions:
        s["_id"] = str(s.get("_id", ""))
    
    # Calculate question-level timing
    all_events = []
    for session in sessions:
        all_events.extend(session.get("events", []))
    
    question_timings = calculate_question_timings(all_events)
    
    return {
        "submission_id": submission_id,
        "sessions": sessions,
        "question_timings": question_timings,
        "summary": calculate_paradata_summary(sessions)
    }


@router.get("/submissions/{submission_id}/timeline")
async def get_submission_timeline(
    request: Request,
    submission_id: str
):
    """Get a timeline view of all events for a submission"""
    db = request.app.state.db
    
    sessions = await db.paradata_sessions.find(
        {"submission_id": submission_id}
    ).to_list(100)
    
    # Flatten all events with session context
    timeline = []
    for session in sessions:
        for event in session.get("events", []):
            timeline.append({
                "session_id": session["id"],
                "device_id": session.get("device_id"),
                "enumerator_id": session.get("enumerator_id"),
                **event
            })
    
    # Sort by timestamp
    timeline.sort(key=lambda x: x.get("timestamp", datetime.min))
    
    return {"submission_id": submission_id, "timeline": timeline}


@router.get("/enumerators/{enumerator_id}/stats")
async def get_enumerator_paradata_stats(
    request: Request,
    enumerator_id: str,
    days: int = 7
):
    """Get paradata statistics for an enumerator"""
    db = request.app.state.db
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    sessions = await db.paradata_sessions.find({
        "enumerator_id": enumerator_id,
        "session_start": {"$gte": start_date}
    }).to_list(1000)
    
    if not sessions:
        return {
            "enumerator_id": enumerator_id,
            "period_days": days,
            "total_sessions": 0,
            "stats": {}
        }
    
    # Calculate statistics
    durations = [s.get("total_duration_seconds", 0) for s in sessions if s.get("total_duration_seconds")]
    edits = [s.get("total_edits", 0) for s in sessions if s.get("total_edits") is not None]
    backtracks = [s.get("total_backtracking", 0) for s in sessions if s.get("total_backtracking") is not None]
    
    stats = {
        "total_sessions": len(sessions),
        "completed_sessions": len([s for s in sessions if s.get("session_end")]),
        "avg_duration_seconds": statistics.mean(durations) if durations else 0,
        "median_duration_seconds": statistics.median(durations) if durations else 0,
        "min_duration_seconds": min(durations) if durations else 0,
        "max_duration_seconds": max(durations) if durations else 0,
        "std_duration_seconds": statistics.stdev(durations) if len(durations) > 1 else 0,
        "avg_edits_per_session": statistics.mean(edits) if edits else 0,
        "avg_backtracks_per_session": statistics.mean(backtracks) if backtracks else 0,
    }
    
    # Flag potential anomalies
    anomalies = []
    if stats["avg_duration_seconds"] > 0:
        # Speeding detection (interviews faster than 50% of median)
        if stats["median_duration_seconds"] > 0:
            speed_threshold = stats["median_duration_seconds"] * 0.5
            fast_sessions = len([d for d in durations if d < speed_threshold])
            if fast_sessions > len(durations) * 0.2:  # More than 20% are fast
                anomalies.append({
                    "type": "speeding",
                    "message": f"{fast_sessions} sessions ({fast_sessions/len(durations)*100:.1f}%) completed faster than 50% of median",
                    "severity": "warning"
                })
    
    # High backtracking
    if stats["avg_backtracks_per_session"] > 10:
        anomalies.append({
            "type": "high_backtracking",
            "message": f"Average {stats['avg_backtracks_per_session']:.1f} backtracks per session",
            "severity": "info"
        })
    
    return {
        "enumerator_id": enumerator_id,
        "period_days": days,
        "stats": stats,
        "anomalies": anomalies
    }


@router.get("/forms/{form_id}/question-stats")
async def get_form_question_stats(
    request: Request,
    form_id: str,
    days: int = 30
):
    """Get question-level statistics for a form (useful for form optimization)"""
    db = request.app.state.db
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get all sessions for this form
    sessions = await db.paradata_sessions.find({
        "form_id": form_id,
        "session_start": {"$gte": start_date}
    }).to_list(5000)
    
    # Aggregate question stats
    question_stats = {}
    
    for session in sessions:
        for event in session.get("events", []):
            q_name = event.get("question_name")
            if not q_name:
                continue
            
            if q_name not in question_stats:
                question_stats[q_name] = {
                    "question_name": q_name,
                    "question_type": event.get("question_type"),
                    "focus_times": [],
                    "edit_counts": [],
                    "validation_failures": 0,
                    "skip_count": 0,
                }
            
            event_type = event.get("event_type")
            
            if event_type == "question_blur":
                # Calculate time spent if we have metadata
                metadata = event.get("metadata") or {}
                duration = metadata.get("duration_seconds")
                if duration:
                    question_stats[q_name]["focus_times"].append(duration)
            
            elif event_type == "value_change":
                question_stats[q_name]["edit_counts"].append(1)
            
            elif event_type == "validation_fail":
                question_stats[q_name]["validation_failures"] += 1
            
            elif event_type == "nav_jump":
                metadata = event.get("metadata") or {}
                if metadata.get("skipped"):
                    question_stats[q_name]["skip_count"] += 1
    
    # Calculate averages
    results = []
    for q_name, stats in question_stats.items():
        focus_times = stats["focus_times"]
        results.append({
            "question_name": q_name,
            "question_type": stats["question_type"],
            "avg_time_seconds": statistics.mean(focus_times) if focus_times else 0,
            "median_time_seconds": statistics.median(focus_times) if focus_times else 0,
            "total_responses": len(focus_times),
            "avg_edits": statistics.mean(stats["edit_counts"]) if stats["edit_counts"] else 0,
            "validation_failure_rate": stats["validation_failures"] / len(focus_times) if focus_times else 0,
            "skip_rate": stats["skip_count"] / len(sessions) if sessions else 0,
        })
    
    # Sort by average time (longest first - potential problem questions)
    results.sort(key=lambda x: x["avg_time_seconds"], reverse=True)
    
    return {
        "form_id": form_id,
        "period_days": days,
        "total_sessions": len(sessions),
        "question_stats": results
    }


@router.get("/quality/speeding-report")
async def get_speeding_report(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None,
    days: int = 7,
    threshold_percentile: float = 25
):
    """Generate speeding detection report"""
    db = request.app.state.db
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    query = {"session_start": {"$gte": start_date}}
    if form_id:
        query["form_id"] = form_id
    
    sessions = await db.paradata_sessions.find(query).to_list(10000)
    
    if not sessions:
        return {"message": "No sessions found", "flagged": []}
    
    # Calculate duration percentiles
    durations = [(s["id"], s.get("enumerator_id"), s.get("total_duration_seconds") or 0) 
                 for s in sessions if s.get("total_duration_seconds")]
    
    if not durations:
        return {"message": "No duration data", "flagged": []}
    
    duration_values = [d[2] for d in durations]
    
    # Need at least 2 data points for quantiles
    if len(duration_values) < 2:
        return {
            "message": "Insufficient data for statistical analysis (need at least 2 sessions)",
            "flagged": [],
            "total_sessions": len(sessions),
            "threshold_seconds": 0
        }
    
    threshold = statistics.quantiles(duration_values, n=100)[int(threshold_percentile) - 1]
    
    # Flag sessions below threshold
    flagged = []
    for session_id, enumerator_id, duration in durations:
        if duration < threshold:
            flagged.append({
                "session_id": session_id,
                "enumerator_id": enumerator_id,
                "duration_seconds": duration,
                "threshold_seconds": threshold,
                "percent_of_threshold": (duration / threshold) * 100 if threshold > 0 else 0
            })
    
    # Group by enumerator
    enumerator_counts = {}
    for f in flagged:
        eid = f["enumerator_id"]
        if eid not in enumerator_counts:
            enumerator_counts[eid] = 0
        enumerator_counts[eid] += 1
    
    return {
        "period_days": days,
        "threshold_percentile": threshold_percentile,
        "threshold_seconds": threshold,
        "total_sessions": len(sessions),
        "flagged_count": len(flagged),
        "flagged_percent": (len(flagged) / len(sessions)) * 100,
        "flagged_sessions": flagged[:100],  # Limit response
        "enumerator_summary": [
            {"enumerator_id": k, "flagged_count": v, "percent": (v / enumerator_counts.get(k, 1)) * 100}
            for k, v in sorted(enumerator_counts.items(), key=lambda x: x[1], reverse=True)
        ]
    }


# ============ Helper Functions ============

def calculate_session_metrics(events: List[Dict], session_start, session_end) -> Dict:
    """Calculate aggregated metrics from paradata events"""
    if not events:
        return {
            "total_duration_seconds": 0,
            "active_duration_seconds": 0,
            "pause_duration_seconds": 0,
            "total_edits": 0,
            "total_backtracking": 0
        }
    
    # Handle session_start - may be string, naive datetime, or aware datetime
    if isinstance(session_start, str):
        session_start = datetime.fromisoformat(session_start.replace("Z", "+00:00"))
    if session_start and session_start.tzinfo is None:
        session_start = session_start.replace(tzinfo=timezone.utc)
    
    # Handle session_end - ensure it's timezone aware
    if isinstance(session_end, str):
        session_end = datetime.fromisoformat(session_end.replace("Z", "+00:00"))
    if session_end and session_end.tzinfo is None:
        session_end = session_end.replace(tzinfo=timezone.utc)
    
    total_duration = (session_end - session_start).total_seconds() if session_start and session_end else 0
    
    # Count edits and backtracks
    total_edits = len([e for e in events if e.get("event_type") == "value_change"])
    total_backtracking = len([e for e in events if e.get("event_type") == "nav_backward"])
    
    # Calculate pause duration
    pause_duration = 0
    pause_start = None
    for event in events:
        event_type = event.get("event_type")
        if event_type in ["session_pause", "app_background"]:
            pause_start = event.get("timestamp")
        elif event_type in ["session_resume", "app_foreground"] and pause_start:
            if isinstance(pause_start, str):
                pause_start = datetime.fromisoformat(pause_start.replace("Z", "+00:00"))
            ts = event.get("timestamp")
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            pause_duration += (ts - pause_start).total_seconds()
            pause_start = None
    
    active_duration = total_duration - pause_duration
    
    return {
        "total_duration_seconds": total_duration,
        "active_duration_seconds": max(0, active_duration),
        "pause_duration_seconds": pause_duration,
        "total_edits": total_edits,
        "total_backtracking": total_backtracking
    }


def calculate_question_timings(events: List[Dict]) -> List[Dict]:
    """Calculate time spent on each question from events"""
    question_data = {}
    
    for event in events:
        q_name = event.get("question_name")
        if not q_name:
            continue
        
        if q_name not in question_data:
            question_data[q_name] = {
                "question_name": q_name,
                "question_type": event.get("question_type"),
                "page_index": event.get("page_index"),
                "focus_times": [],
                "edit_count": 0,
                "backtrack_count": 0,
                "current_focus_start": None
            }
        
        event_type = event.get("event_type")
        timestamp = event.get("timestamp")
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        
        if event_type == "question_focus":
            question_data[q_name]["current_focus_start"] = timestamp
        
        elif event_type == "question_blur":
            focus_start = question_data[q_name]["current_focus_start"]
            if focus_start and timestamp:
                duration = (timestamp - focus_start).total_seconds()
                question_data[q_name]["focus_times"].append(duration)
            question_data[q_name]["current_focus_start"] = None
        
        elif event_type == "value_change":
            question_data[q_name]["edit_count"] += 1
        
        elif event_type == "nav_backward":
            question_data[q_name]["backtrack_count"] += 1
    
    # Calculate totals
    results = []
    for q_name, data in question_data.items():
        results.append({
            "question_name": q_name,
            "question_type": data["question_type"],
            "page_index": data["page_index"],
            "total_time_seconds": sum(data["focus_times"]),
            "focus_count": len(data["focus_times"]),
            "avg_time_seconds": statistics.mean(data["focus_times"]) if data["focus_times"] else 0,
            "edit_count": data["edit_count"],
            "backtrack_count": data["backtrack_count"]
        })
    
    return results


def calculate_paradata_summary(sessions: List[Dict]) -> Dict:
    """Calculate overall paradata summary"""
    if not sessions:
        return {}
    
    # Handle None values that may be returned from database
    total_duration = sum(s.get("total_duration_seconds") or 0 for s in sessions)
    total_active = sum(s.get("active_duration_seconds") or 0 for s in sessions)
    total_pause = sum(s.get("pause_duration_seconds") or 0 for s in sessions)
    total_edits = sum(s.get("total_edits") or 0 for s in sessions)
    total_backtracks = sum(s.get("total_backtracking") or 0 for s in sessions)
    
    return {
        "total_sessions": len(sessions),
        "total_duration_seconds": total_duration,
        "total_active_seconds": total_active,
        "total_pause_seconds": total_pause,
        "total_edits": total_edits,
        "total_backtracks": total_backtracks,
        "avg_duration_per_session": total_duration / len(sessions) if sessions else 0
    }
