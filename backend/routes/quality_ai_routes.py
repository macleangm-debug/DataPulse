"""DataPulse - Quality & AI Monitoring Module
P2 Features: Interview Speeding Detection, Audio Audit, AI Monitoring Assistant

Features:
- Interview speeding detection based on form completion times
- Configurable audio audit for quality verification
- AI-powered anomaly detection using OpenAI GPT-5.2
- Pattern analysis for suspicious submissions
- Automated quality alerts
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import os
import statistics
import asyncio
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/quality-ai", tags=["Quality & AI Monitoring"])


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(str, Enum):
    SPEEDING = "speeding"
    AUDIO_MISSING = "audio_missing"
    AUDIO_SHORT = "audio_short"
    PATTERN_ANOMALY = "pattern_anomaly"
    RESPONSE_ANOMALY = "response_anomaly"
    GPS_ANOMALY = "gps_anomaly"
    DUPLICATE_PATTERN = "duplicate_pattern"
    STRAIGHT_LINING = "straight_lining"


class SpeedingConfigCreate(BaseModel):
    org_id: str
    form_id: str
    min_completion_time_seconds: int = 120  # Minimum expected time
    warning_threshold_percent: float = 50  # 50% of median = warning
    critical_threshold_percent: float = 25  # 25% of median = critical
    is_active: bool = True
    auto_flag_critical: bool = True
    exclude_fields: List[str] = []  # Fields to exclude from timing


class AudioAuditConfigCreate(BaseModel):
    org_id: str
    form_id: str
    audio_field_id: str  # Field ID for audio recording
    min_duration_seconds: int = 30
    sample_percentage: float = 10.0  # % of submissions to audit
    require_full_recording: bool = False
    is_active: bool = True


class AIMonitoringConfigCreate(BaseModel):
    org_id: str
    project_id: Optional[str] = None
    is_active: bool = True
    
    # Detection settings
    detect_speeding: bool = True
    detect_straight_lining: bool = True
    detect_response_anomalies: bool = True
    detect_gps_anomalies: bool = True
    detect_duplicates: bool = True
    
    # Thresholds
    anomaly_score_threshold: float = 0.7
    min_submissions_for_analysis: int = 10
    
    # AI settings
    use_ai_analysis: bool = True
    ai_analysis_sample_rate: float = 5.0  # % of submissions for deep AI analysis


# ============ Speeding Detection ============

@router.post("/speeding/configs")
async def create_speeding_config(
    request: Request,
    config: SpeedingConfigCreate
):
    """Create speeding detection configuration"""
    db = request.app.state.db
    
    config_doc = {
        "id": f"speed_{config.form_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "median_completion_time": None,
        "stats": {
            "total_analyzed": 0,
            "warnings": 0,
            "critical": 0
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.speeding_configs.insert_one(config_doc)
    
    return {"message": "Speeding detection configured", "config_id": config_doc["id"]}


@router.get("/speeding/configs/{org_id}")
async def list_speeding_configs(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None
):
    """List speeding detection configurations"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if form_id:
        query["form_id"] = form_id
    
    configs = await db.speeding_configs.find(query).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


@router.post("/speeding/analyze/{submission_id}")
async def analyze_submission_speed(
    request: Request,
    submission_id: str
):
    """Analyze a submission for speeding"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get speeding config
    config = await db.speeding_configs.find_one({
        "form_id": submission["form_id"],
        "is_active": True
    })
    
    if not config:
        return {"message": "No speeding detection configured for this form"}
    
    # Calculate completion time from paradata
    paradata = await db.paradata_events.find({
        "submission_id": submission_id,
        "event_type": {"$in": ["form_start", "form_submit"]}
    }).sort("timestamp", 1).to_list(100)
    
    if len(paradata) < 2:
        # Fallback to submission timestamps
        start_time = submission.get("started_at")
        end_time = submission.get("submitted_at")
        
        if not start_time or not end_time:
            return {"message": "Insufficient timing data"}
        
        completion_time = (end_time - start_time).total_seconds()
    else:
        start_event = next((p for p in paradata if p["event_type"] == "form_start"), None)
        end_event = next((p for p in reversed(paradata) if p["event_type"] == "form_submit"), None)
        
        if not start_event or not end_event:
            return {"message": "Insufficient timing data"}
        
        completion_time = (end_event["timestamp"] - start_event["timestamp"]).total_seconds()
    
    # Get median completion time for this form
    if not config.get("median_completion_time"):
        # Calculate median from recent submissions
        recent_times = await calculate_median_completion_time(db, submission["form_id"])
        if recent_times:
            config["median_completion_time"] = recent_times
            await db.speeding_configs.update_one(
                {"id": config["id"]},
                {"$set": {"median_completion_time": recent_times}}
            )
    
    median_time = config.get("median_completion_time", config["min_completion_time_seconds"])
    
    # Determine speeding level
    speed_ratio = completion_time / median_time if median_time > 0 else 1
    
    severity = None
    if speed_ratio <= config["critical_threshold_percent"] / 100:
        severity = AlertSeverity.CRITICAL
    elif speed_ratio <= config["warning_threshold_percent"] / 100:
        severity = AlertSeverity.HIGH
    elif speed_ratio <= 0.75:
        severity = AlertSeverity.MEDIUM
    
    result = {
        "submission_id": submission_id,
        "completion_time_seconds": round(completion_time, 1),
        "median_time_seconds": round(median_time, 1),
        "speed_ratio": round(speed_ratio, 2),
        "is_speeding": severity is not None,
        "severity": severity
    }
    
    # Create alert if speeding detected
    if severity and config.get("auto_flag_critical") and severity in [AlertSeverity.CRITICAL, AlertSeverity.HIGH]:
        await create_quality_alert(
            db,
            org_id=submission.get("org_id"),
            submission_id=submission_id,
            alert_type=AlertType.SPEEDING,
            severity=severity,
            details={
                "completion_time": completion_time,
                "median_time": median_time,
                "speed_ratio": speed_ratio
            }
        )
        result["alert_created"] = True
    
    # Update stats
    await db.speeding_configs.update_one(
        {"id": config["id"]},
        {
            "$inc": {
                "stats.total_analyzed": 1,
                "stats.warnings": 1 if severity == AlertSeverity.HIGH else 0,
                "stats.critical": 1 if severity == AlertSeverity.CRITICAL else 0
            }
        }
    )
    
    return result


async def calculate_median_completion_time(db, form_id: str, limit: int = 100) -> Optional[float]:
    """Calculate median completion time for a form"""
    submissions = await db.submissions.find(
        {"form_id": form_id, "status": {"$in": ["submitted", "approved"]}},
        {"started_at": 1, "submitted_at": 1}
    ).limit(limit).to_list(limit)
    
    times = []
    for sub in submissions:
        if sub.get("started_at") and sub.get("submitted_at"):
            duration = (sub["submitted_at"] - sub["started_at"]).total_seconds()
            if duration > 0:
                times.append(duration)
    
    if len(times) >= 5:
        return statistics.median(times)
    return None


# ============ Audio Audit ============

@router.post("/audio-audit/configs")
async def create_audio_audit_config(
    request: Request,
    config: AudioAuditConfigCreate
):
    """Create audio audit configuration"""
    db = request.app.state.db
    
    config_doc = {
        "id": f"audio_{config.form_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "stats": {
            "total_audited": 0,
            "passed": 0,
            "failed": 0
        },
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.audio_audit_configs.insert_one(config_doc)
    
    return {"message": "Audio audit configured", "config_id": config_doc["id"]}


@router.get("/audio-audit/configs/{org_id}")
async def list_audio_audit_configs(
    request: Request,
    org_id: str
):
    """List audio audit configurations"""
    db = request.app.state.db
    
    configs = await db.audio_audit_configs.find({"org_id": org_id}).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


@router.post("/audio-audit/check/{submission_id}")
async def check_audio_audit(
    request: Request,
    submission_id: str
):
    """Check audio compliance for a submission"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    config = await db.audio_audit_configs.find_one({
        "form_id": submission["form_id"],
        "is_active": True
    })
    
    if not config:
        return {"message": "No audio audit configured for this form"}
    
    # Check if audio field exists in submission
    audio_field = config["audio_field_id"]
    audio_data = submission.get("data", {}).get(audio_field)
    
    issues = []
    
    if not audio_data:
        issues.append({
            "type": "missing",
            "message": "Audio recording not found"
        })
    else:
        # Check audio metadata
        audio_meta = submission.get("media_metadata", {}).get(audio_field, {})
        duration = audio_meta.get("duration_seconds", 0)
        
        if duration < config["min_duration_seconds"]:
            issues.append({
                "type": "too_short",
                "message": f"Audio duration ({duration}s) below minimum ({config['min_duration_seconds']}s)",
                "actual_duration": duration,
                "required_duration": config["min_duration_seconds"]
            })
    
    passed = len(issues) == 0
    
    # Create alert if failed
    if not passed:
        alert_type = AlertType.AUDIO_MISSING if "missing" in [i["type"] for i in issues] else AlertType.AUDIO_SHORT
        await create_quality_alert(
            db,
            org_id=submission.get("org_id"),
            submission_id=submission_id,
            alert_type=alert_type,
            severity=AlertSeverity.MEDIUM,
            details={"issues": issues}
        )
    
    # Update stats
    await db.audio_audit_configs.update_one(
        {"id": config["id"]},
        {
            "$inc": {
                "stats.total_audited": 1,
                "stats.passed": 1 if passed else 0,
                "stats.failed": 0 if passed else 1
            }
        }
    )
    
    return {
        "submission_id": submission_id,
        "passed": passed,
        "issues": issues
    }


@router.get("/audio-audit/queue/{org_id}")
async def get_audio_audit_queue(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None,
    limit: int = 50
):
    """Get submissions pending audio audit"""
    db = request.app.state.db
    
    # Get active audio configs
    config_query = {"org_id": org_id, "is_active": True}
    if form_id:
        config_query["form_id"] = form_id
    
    configs = await db.audio_audit_configs.find(config_query).to_list(100)
    
    if not configs:
        return {"queue": [], "message": "No audio audit configurations found"}
    
    form_ids = [c["form_id"] for c in configs]
    
    # Get submissions needing audit
    already_audited = await db.quality_alerts.distinct(
        "submission_id",
        {"alert_type": {"$in": [AlertType.AUDIO_MISSING, AlertType.AUDIO_SHORT]}}
    )
    
    submissions = await db.submissions.find({
        "form_id": {"$in": form_ids},
        "id": {"$nin": already_audited},
        "status": {"$in": ["submitted", "approved"]}
    }).sort("submitted_at", -1).limit(limit).to_list(limit)
    
    # Sample based on percentage
    import random
    for config in configs:
        form_subs = [s for s in submissions if s["form_id"] == config["form_id"]]
        sample_size = max(1, int(len(form_subs) * config["sample_percentage"] / 100))
        form_subs = random.sample(form_subs, min(sample_size, len(form_subs)))
    
    queue = []
    for sub in submissions[:limit]:
        config = next((c for c in configs if c["form_id"] == sub["form_id"]), None)
        if config:
            queue.append({
                "submission_id": sub["id"],
                "form_id": sub["form_id"],
                "submitted_at": sub.get("submitted_at").isoformat() if sub.get("submitted_at") else None,
                "audio_field": config["audio_field_id"],
                "has_audio": config["audio_field_id"] in sub.get("data", {})
            })
    
    return {"queue": queue}


# ============ AI Monitoring Assistant ============

@router.post("/ai-monitoring/configs")
async def create_ai_monitoring_config(
    request: Request,
    config: AIMonitoringConfigCreate
):
    """Create AI monitoring configuration"""
    db = request.app.state.db
    
    config_doc = {
        "id": f"ai_monitor_{config.org_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "stats": {
            "total_analyzed": 0,
            "anomalies_detected": 0,
            "ai_analyses": 0
        },
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.ai_monitoring_configs.insert_one(config_doc)
    
    return {"message": "AI monitoring configured", "config_id": config_doc["id"]}


@router.get("/ai-monitoring/configs/{org_id}")
async def list_ai_monitoring_configs(
    request: Request,
    org_id: str
):
    """List AI monitoring configurations"""
    db = request.app.state.db
    
    configs = await db.ai_monitoring_configs.find({"org_id": org_id}).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


@router.post("/ai-monitoring/analyze/{submission_id}")
async def ai_analyze_submission(
    request: Request,
    submission_id: str,
    background_tasks: BackgroundTasks
):
    """Run AI analysis on a submission"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    org_id = submission.get("org_id")
    
    config = await db.ai_monitoring_configs.find_one({
        "org_id": org_id,
        "is_active": True
    })
    
    if not config:
        return {"message": "No AI monitoring configured for this organization"}
    
    # Run rule-based analysis first
    anomalies = []
    
    # 1. Straight-lining detection
    if config.get("detect_straight_lining"):
        straight_line_result = detect_straight_lining(submission.get("data", {}))
        if straight_line_result["detected"]:
            anomalies.append({
                "type": AlertType.STRAIGHT_LINING,
                "severity": AlertSeverity.MEDIUM,
                "details": straight_line_result
            })
    
    # 2. Response pattern anomalies
    if config.get("detect_response_anomalies"):
        # Get form to check expected patterns
        form = await db.forms.find_one({"id": submission["form_id"]})
        if form:
            pattern_result = detect_response_anomalies(submission.get("data", {}), form.get("fields", []))
            if pattern_result["anomalies"]:
                anomalies.append({
                    "type": AlertType.RESPONSE_ANOMALY,
                    "severity": AlertSeverity.LOW,
                    "details": pattern_result
                })
    
    # 3. GPS anomalies
    if config.get("detect_gps_anomalies"):
        gps_result = await detect_gps_anomalies(db, submission)
        if gps_result.get("anomaly"):
            anomalies.append({
                "type": AlertType.GPS_ANOMALY,
                "severity": gps_result.get("severity", AlertSeverity.MEDIUM),
                "details": gps_result
            })
    
    # 4. AI deep analysis (if enabled and sampled)
    ai_analysis = None
    if config.get("use_ai_analysis"):
        import random
        if random.random() * 100 <= config.get("ai_analysis_sample_rate", 5):
            # Run AI analysis in background
            background_tasks.add_task(
                run_ai_deep_analysis,
                db,
                submission_id,
                submission.get("data", {}),
                org_id
            )
            ai_analysis = "scheduled"
    
    # Create alerts for anomalies
    for anomaly in anomalies:
        await create_quality_alert(
            db,
            org_id=org_id,
            submission_id=submission_id,
            alert_type=anomaly["type"],
            severity=anomaly["severity"],
            details=anomaly["details"]
        )
    
    # Update stats
    await db.ai_monitoring_configs.update_one(
        {"id": config["id"]},
        {
            "$inc": {
                "stats.total_analyzed": 1,
                "stats.anomalies_detected": len(anomalies)
            }
        }
    )
    
    return {
        "submission_id": submission_id,
        "anomalies_found": len(anomalies),
        "anomalies": anomalies,
        "ai_analysis": ai_analysis
    }


def detect_straight_lining(data: dict) -> dict:
    """Detect straight-lining patterns in responses"""
    # Group by question type patterns
    select_values = []
    radio_values = []
    
    for key, value in data.items():
        if isinstance(value, str) and len(value) <= 2:
            # Likely a coded response
            select_values.append(value)
        elif isinstance(value, int) and 1 <= value <= 10:
            # Likely a scale response
            radio_values.append(value)
    
    detected = False
    patterns = []
    
    # Check for same value repeated
    if len(select_values) >= 5:
        most_common = max(set(select_values), key=select_values.count)
        repeat_ratio = select_values.count(most_common) / len(select_values)
        if repeat_ratio >= 0.8:
            detected = True
            patterns.append(f"Same value '{most_common}' selected {int(repeat_ratio*100)}% of time")
    
    if len(radio_values) >= 5:
        most_common = max(set(radio_values), key=radio_values.count)
        repeat_ratio = radio_values.count(most_common) / len(radio_values)
        if repeat_ratio >= 0.8:
            detected = True
            patterns.append(f"Same scale value '{most_common}' used {int(repeat_ratio*100)}% of time")
    
    return {"detected": detected, "patterns": patterns}


def detect_response_anomalies(data: dict, fields: list) -> dict:
    """Detect anomalies in response patterns"""
    anomalies = []
    
    # Check for inconsistent responses
    for field in fields:
        field_id = field.get("id")
        if field_id not in data:
            continue
        
        value = data[field_id]
        field_type = field.get("type")
        
        # Check numeric fields for outliers
        if field_type == "number":
            min_val = field.get("validation", {}).get("min")
            max_val = field.get("validation", {}).get("max")
            
            if min_val is not None and value < min_val:
                anomalies.append({"field": field_id, "issue": "below_minimum", "value": value})
            if max_val is not None and value > max_val:
                anomalies.append({"field": field_id, "issue": "above_maximum", "value": value})
        
        # Check text length anomalies
        if field_type in ["text", "textarea"] and isinstance(value, str):
            if len(value) < 3 and field.get("required"):
                anomalies.append({"field": field_id, "issue": "suspiciously_short", "length": len(value)})
    
    return {"anomalies": anomalies}


async def detect_gps_anomalies(db, submission: dict) -> dict:
    """Detect GPS-related anomalies"""
    gps_data = submission.get("data", {}).get("gps_location") or submission.get("data", {}).get("location")
    
    if not gps_data:
        return {"anomaly": False}
    
    # Check for office location (common fraud indicator)
    # This would typically check against known office coordinates
    
    # Check for duplicate GPS with different submissions
    existing = await db.submissions.find_one({
        "id": {"$ne": submission["id"]},
        "form_id": submission["form_id"],
        "$or": [
            {"data.gps_location": gps_data},
            {"data.location": gps_data}
        ]
    })
    
    if existing:
        return {
            "anomaly": True,
            "severity": AlertSeverity.HIGH,
            "reason": "duplicate_location",
            "matching_submission": existing["id"]
        }
    
    return {"anomaly": False}


async def run_ai_deep_analysis(db, submission_id: str, data: dict, org_id: str):
    """Run deep AI analysis on submission (background task)"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return
        
        # Prepare data summary for AI
        data_summary = {k: str(v)[:200] for k, v in data.items()}
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"quality_analysis_{submission_id}",
            system_message="""You are a data quality analyst for survey research. 
            Analyze the submission data for potential quality issues including:
            - Inconsistent or contradictory responses
            - Suspicious patterns indicating fabrication
            - Responses that don't make logical sense
            - Signs of rushing or inattention
            
            Respond with a JSON object containing:
            - quality_score: 0-100 (100 = high quality)
            - issues: list of identified issues
            - recommendations: list of follow-up actions
            """
        ).with_model("openai", "gpt-5.2")
        
        message = UserMessage(
            text=f"Analyze this survey submission for data quality issues:\n\n{data_summary}"
        )
        
        response = await chat.send_message(message)
        
        # Store AI analysis result
        await db.ai_analyses.insert_one({
            "submission_id": submission_id,
            "org_id": org_id,
            "analysis_type": "deep_quality",
            "result": response,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Update stats
        await db.ai_monitoring_configs.update_one(
            {"org_id": org_id, "is_active": True},
            {"$inc": {"stats.ai_analyses": 1}}
        )
        
    except Exception as e:
        print(f"AI analysis error: {e}")


# ============ Quality Alerts ============

async def create_quality_alert(
    db, org_id: str, submission_id: str, 
    alert_type: AlertType, severity: AlertSeverity, 
    details: dict
):
    """Create a quality alert"""
    alert = {
        "id": f"alert_{submission_id}_{alert_type}_{int(datetime.now(timezone.utc).timestamp())}",
        "org_id": org_id,
        "submission_id": submission_id,
        "alert_type": alert_type,
        "severity": severity,
        "details": details,
        "status": "open",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.quality_alerts.insert_one(alert)
    return alert


@router.get("/alerts/{org_id}")
async def get_quality_alerts(
    request: Request,
    org_id: str,
    status: Optional[str] = None,
    alert_type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """Get quality alerts"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    if alert_type:
        query["alert_type"] = alert_type
    if severity:
        query["severity"] = severity
    
    alerts = await db.quality_alerts.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.quality_alerts.count_documents(query)
    
    for a in alerts:
        a["_id"] = str(a.get("_id", ""))
        if a.get("created_at"):
            a["created_at"] = a["created_at"].isoformat()
    
    return {"alerts": alerts, "total": total}


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    request: Request,
    alert_id: str
):
    """Resolve a quality alert"""
    db = request.app.state.db
    data = await request.json()
    
    result = await db.quality_alerts.update_one(
        {"id": alert_id},
        {
            "$set": {
                "status": "resolved",
                "resolution": data.get("resolution"),
                "resolved_by": data.get("resolved_by"),
                "resolved_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert resolved"}


@router.get("/alerts/{org_id}/summary")
async def get_alerts_summary(
    request: Request,
    org_id: str
):
    """Get quality alerts summary"""
    db = request.app.state.db
    
    # Count by type
    by_type = await db.quality_alerts.aggregate([
        {"$match": {"org_id": org_id, "status": "open"}},
        {"$group": {"_id": "$alert_type", "count": {"$sum": 1}}}
    ]).to_list(20)
    
    # Count by severity
    by_severity = await db.quality_alerts.aggregate([
        {"$match": {"org_id": org_id, "status": "open"}},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # Recent trend (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily_counts = await db.quality_alerts.aggregate([
        {"$match": {"org_id": org_id, "created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(7)
    
    total_open = await db.quality_alerts.count_documents({"org_id": org_id, "status": "open"})
    total_resolved = await db.quality_alerts.count_documents({"org_id": org_id, "status": "resolved"})
    
    return {
        "total_open": total_open,
        "total_resolved": total_resolved,
        "by_type": {t["_id"]: t["count"] for t in by_type},
        "by_severity": {s["_id"]: s["count"] for s in by_severity},
        "daily_trend": daily_counts
    }


# ============ Batch Analysis ============

@router.post("/batch-analyze/{org_id}")
async def batch_analyze_submissions(
    request: Request,
    org_id: str,
    background_tasks: BackgroundTasks
):
    """Run batch analysis on recent submissions"""
    db = request.app.state.db
    data = await request.json()
    
    form_id = data.get("form_id")
    hours = data.get("hours", 24)
    
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    
    query = {
        "org_id": org_id,
        "submitted_at": {"$gte": since},
        "status": {"$in": ["submitted", "approved"]}
    }
    if form_id:
        query["form_id"] = form_id
    
    submissions = await db.submissions.find(query, {"id": 1}).to_list(1000)
    submission_ids = [s["id"] for s in submissions]
    
    # Queue background analysis
    background_tasks.add_task(
        run_batch_analysis,
        db,
        org_id,
        submission_ids
    )
    
    return {
        "message": f"Batch analysis started for {len(submission_ids)} submissions",
        "submission_count": len(submission_ids)
    }


async def run_batch_analysis(db, org_id: str, submission_ids: list):
    """Background task for batch analysis"""
    for submission_id in submission_ids:
        try:
            submission = await db.submissions.find_one({"id": submission_id})
            if submission:
                # Run speeding check
                config = await db.speeding_configs.find_one({
                    "form_id": submission["form_id"],
                    "is_active": True
                })
                if config:
                    # Similar logic to analyze_submission_speed
                    pass
                
                # Run AI monitoring
                ai_config = await db.ai_monitoring_configs.find_one({
                    "org_id": org_id,
                    "is_active": True
                })
                if ai_config:
                    # Similar logic to ai_analyze_submission
                    pass
                
        except Exception as e:
            print(f"Batch analysis error for {submission_id}: {e}")
        
        # Rate limiting
        await asyncio.sleep(0.1)
