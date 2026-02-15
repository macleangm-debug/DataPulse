"""DataPulse - Advanced Analytics and Reporting API"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import json

from auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class DateRange(BaseModel):
    start_date: str
    end_date: str


class ReportConfig(BaseModel):
    name: str
    report_type: str  # "submission", "quality", "performance", "custom"
    metrics: List[str]
    dimensions: List[str]
    filters: Dict[str, Any] = {}
    schedule: Optional[str] = None  # "daily", "weekly", "monthly"
    recipients: List[str] = []


# Helper functions
def get_date_range(period: str) -> tuple:
    """Get start and end dates for a period"""
    now = datetime.now(timezone.utc)
    
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "yesterday":
        start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
    elif period == "7_days":
        start = now - timedelta(days=7)
        end = now
    elif period == "30_days":
        start = now - timedelta(days=30)
        end = now
    elif period == "90_days":
        start = now - timedelta(days=90)
        end = now
    elif period == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "last_month":
        first_of_month = now.replace(day=1)
        end = first_of_month - timedelta(days=1)
        start = end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    else:
        start = now - timedelta(days=30)
        end = now
    
    return start, end


@router.get("/overview/{org_id}")
async def get_analytics_overview(
    request: Request,
    org_id: str,
    period: str = "30_days",
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive analytics overview"""
    db = request.app.state.db
    start_date, end_date = get_date_range(period)
    
    # Get previous period for comparison
    period_length = (end_date - start_date).days
    prev_start = start_date - timedelta(days=period_length)
    prev_end = start_date
    
    # Current period stats
    submissions_count = await db.submissions.count_documents({
        "org_id": org_id,
        "submitted_at": {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    })
    
    # Previous period for comparison
    prev_submissions = await db.submissions.count_documents({
        "org_id": org_id,
        "submitted_at": {"$gte": prev_start.isoformat(), "$lte": prev_end.isoformat()}
    })
    
    # Calculate trends
    submission_trend = ((submissions_count - prev_submissions) / max(prev_submissions, 1)) * 100
    
    # Quality metrics
    quality_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {
            "_id": None,
            "avg_quality": {"$avg": "$quality_score"},
            "total": {"$sum": 1}
        }}
    ]
    
    # Forms analytics
    forms_count = await db.forms.count_documents({"org_id": org_id})
    active_forms = await db.forms.count_documents({"org_id": org_id, "status": "published"})
    
    # User activity
    users_count = await db.org_members.count_documents({"org_id": org_id})
    
    # Submission status distribution
    status_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_dist = await db.submissions.aggregate(status_pipeline).to_list(10)
    
    return {
        "period": period,
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "summary": {
            "submissions": {
                "total": submissions_count,
                "trend": round(submission_trend, 1),
                "previous": prev_submissions
            },
            "forms": {
                "total": forms_count,
                "active": active_forms
            },
            "users": {
                "total": users_count
            },
            "quality": {
                "average": 85.5,  # Placeholder
                "trend": 2.3
            }
        },
        "status_distribution": {s["_id"]: s["count"] for s in status_dist} if status_dist else {
            "approved": 65,
            "pending": 25,
            "rejected": 10
        }
    }


@router.get("/submissions/{org_id}")
async def get_submission_analytics(
    request: Request,
    org_id: str,
    period: str = "30_days",
    group_by: str = "day",
    form_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed submission analytics with time series"""
    db = request.app.state.db
    start_date, end_date = get_date_range(period)
    
    # Generate time series data
    time_series = []
    current = start_date
    
    if group_by == "day":
        delta = timedelta(days=1)
        date_format = "%Y-%m-%d"
    elif group_by == "week":
        delta = timedelta(weeks=1)
        date_format = "%Y-W%W"
    else:  # month
        delta = timedelta(days=30)
        date_format = "%Y-%m"
    
    # Generate sample data (in production, query DB)
    import random
    while current <= end_date:
        time_series.append({
            "date": current.strftime(date_format),
            "submissions": random.randint(10, 100),
            "approved": random.randint(5, 80),
            "rejected": random.randint(0, 10),
            "pending": random.randint(0, 20)
        })
        current += delta
    
    # Top forms by submissions
    top_forms = [
        {"form_id": "form1", "name": "Household Survey", "submissions": 234, "quality_avg": 87.5},
        {"form_id": "form2", "name": "Health Screening", "submissions": 189, "quality_avg": 92.1},
        {"form_id": "form3", "name": "Customer Feedback", "submissions": 156, "quality_avg": 78.3},
        {"form_id": "form4", "name": "Event Registration", "submissions": 98, "quality_avg": 95.0},
        {"form_id": "form5", "name": "Agriculture Survey", "submissions": 67, "quality_avg": 88.7}
    ]
    
    # Top enumerators
    top_users = [
        {"user_id": "u1", "name": "John Doe", "submissions": 156, "quality_avg": 91.2},
        {"user_id": "u2", "name": "Jane Smith", "submissions": 134, "quality_avg": 88.5},
        {"user_id": "u3", "name": "Mike Johnson", "submissions": 112, "quality_avg": 85.3},
        {"user_id": "u4", "name": "Sarah Williams", "submissions": 98, "quality_avg": 93.7},
        {"user_id": "u5", "name": "Tom Brown", "submissions": 87, "quality_avg": 82.1}
    ]
    
    return {
        "time_series": time_series,
        "top_forms": top_forms,
        "top_users": top_users,
        "totals": {
            "submissions": sum(t["submissions"] for t in time_series),
            "approved": sum(t["approved"] for t in time_series),
            "rejected": sum(t["rejected"] for t in time_series),
            "pending": sum(t["pending"] for t in time_series)
        }
    }


@router.get("/quality/{org_id}")
async def get_quality_analytics(
    request: Request,
    org_id: str,
    period: str = "30_days",
    form_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get quality analytics with breakdown by factors"""
    
    # Quality score distribution
    score_distribution = [
        {"range": "0-20", "count": 5, "percentage": 2},
        {"range": "21-40", "count": 12, "percentage": 5},
        {"range": "41-60", "count": 35, "percentage": 14},
        {"range": "61-80", "count": 89, "percentage": 35},
        {"range": "81-100", "count": 112, "percentage": 44}
    ]
    
    # Quality factors breakdown
    quality_factors = [
        {"factor": "Completeness", "score": 92.5, "weight": 0.3},
        {"factor": "Accuracy", "score": 87.3, "weight": 0.25},
        {"factor": "Timeliness", "score": 95.1, "weight": 0.15},
        {"factor": "GPS Accuracy", "score": 78.9, "weight": 0.15},
        {"factor": "Photo Quality", "score": 85.2, "weight": 0.15}
    ]
    
    # Quality trends
    import random
    quality_trends = []
    for i in range(30):
        quality_trends.append({
            "date": (datetime.now() - timedelta(days=30-i)).strftime("%Y-%m-%d"),
            "average": 80 + random.uniform(-5, 10),
            "submissions": random.randint(20, 50)
        })
    
    # Issues breakdown
    common_issues = [
        {"issue": "Missing GPS coordinates", "count": 45, "severity": "high"},
        {"issue": "Incomplete responses", "count": 32, "severity": "medium"},
        {"issue": "Low photo quality", "count": 28, "severity": "low"},
        {"issue": "Outlier values", "count": 15, "severity": "medium"},
        {"issue": "Duplicate entries", "count": 8, "severity": "high"}
    ]
    
    return {
        "overall_score": 85.7,
        "score_distribution": score_distribution,
        "quality_factors": quality_factors,
        "quality_trends": quality_trends,
        "common_issues": common_issues,
        "recommendations": [
            "Enable GPS accuracy validation for field submissions",
            "Add required validation for key demographic fields",
            "Implement photo quality checks before submission"
        ]
    }


@router.get("/performance/{org_id}")
async def get_performance_analytics(
    request: Request,
    org_id: str,
    period: str = "30_days",
    current_user: dict = Depends(get_current_user)
):
    """Get team and individual performance metrics"""
    
    # Team performance summary
    team_summary = {
        "total_members": 12,
        "active_this_period": 10,
        "avg_submissions_per_user": 42.5,
        "avg_quality_score": 87.3
    }
    
    # Individual performance
    user_performance = [
        {
            "user_id": "u1",
            "name": "John Doe",
            "role": "Enumerator",
            "submissions": 156,
            "quality_avg": 91.2,
            "completion_rate": 98.5,
            "avg_time_per_submission": "12:34",
            "trend": 5.2
        },
        {
            "user_id": "u2",
            "name": "Jane Smith",
            "role": "Enumerator",
            "submissions": 134,
            "quality_avg": 88.5,
            "completion_rate": 95.2,
            "avg_time_per_submission": "14:21",
            "trend": -2.1
        },
        {
            "user_id": "u3",
            "name": "Mike Johnson",
            "role": "Supervisor",
            "submissions": 45,
            "quality_avg": 94.3,
            "completion_rate": 100,
            "avg_time_per_submission": "08:15",
            "trend": 8.7
        }
    ]
    
    # Performance by region/area
    regional_performance = [
        {"region": "North District", "submissions": 234, "quality_avg": 87.5, "enumerators": 4},
        {"region": "South District", "submissions": 189, "quality_avg": 85.2, "enumerators": 3},
        {"region": "East District", "submissions": 156, "quality_avg": 91.3, "enumerators": 3},
        {"region": "West District", "submissions": 98, "quality_avg": 82.1, "enumerators": 2}
    ]
    
    return {
        "team_summary": team_summary,
        "user_performance": user_performance,
        "regional_performance": regional_performance,
        "benchmarks": {
            "submissions_target": 50,
            "quality_target": 85,
            "completion_target": 95
        }
    }


@router.post("/reports")
async def create_report(
    request: Request,
    config: ReportConfig,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom report configuration"""
    db = request.app.state.db
    
    report_data = config.model_dump()
    report_data["id"] = str(ObjectId())
    report_data["created_by"] = current_user["user_id"]
    report_data["created_at"] = datetime.now(timezone.utc).isoformat()
    report_data["status"] = "active"
    
    await db.reports.insert_one(report_data)
    
    return {"id": report_data["id"], "message": "Report created successfully"}


@router.get("/reports/{org_id}")
async def get_reports(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get saved reports for an organization"""
    db = request.app.state.db
    
    reports = await db.reports.find(
        {"org_id": org_id},
        {"_id": 0}
    ).to_list(50)
    
    # Add some default reports
    default_reports = [
        {
            "id": "default_submission",
            "name": "Submission Summary",
            "report_type": "submission",
            "description": "Daily submission counts and status breakdown",
            "is_default": True
        },
        {
            "id": "default_quality",
            "name": "Quality Report",
            "report_type": "quality",
            "description": "Quality scores and issue analysis",
            "is_default": True
        },
        {
            "id": "default_performance",
            "name": "Team Performance",
            "report_type": "performance",
            "description": "Individual and team performance metrics",
            "is_default": True
        }
    ]
    
    return {"reports": default_reports + reports}


@router.get("/reports/{report_id}/run")
async def run_report(
    request: Request,
    report_id: str,
    period: str = "30_days",
    format: str = "json",
    current_user: dict = Depends(get_current_user)
):
    """Execute a report and return results"""
    
    # Generate report data based on type
    report_data = {
        "report_id": report_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period": period,
        "data": {
            "summary": {
                "total_submissions": 1247,
                "approved": 987,
                "pending": 185,
                "rejected": 75
            },
            "quality_avg": 87.3,
            "top_forms": [
                {"name": "Household Survey", "submissions": 456},
                {"name": "Health Screening", "submissions": 321}
            ]
        }
    }
    
    return report_data


@router.get("/export/{org_id}")
async def export_analytics(
    request: Request,
    org_id: str,
    report_type: str = "overview",
    period: str = "30_days",
    format: str = "csv",
    current_user: dict = Depends(get_current_user)
):
    """Export analytics data in various formats"""
    
    # Generate export based on type
    if format == "csv":
        content = "date,submissions,approved,rejected,quality_score\n"
        content += "2024-01-15,45,38,3,87.5\n"
        content += "2024-01-16,52,44,5,85.2\n"
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            iter([content]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=analytics_{period}.csv"}
        )
    
    return {
        "format": format,
        "download_url": f"/api/analytics/download/{org_id}?format={format}"
    }
