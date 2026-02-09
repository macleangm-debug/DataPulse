"""DataPulse - Dashboard & Analytics Routes"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from models import DashboardStats, SubmissionTrend, QualityMetrics
from auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard statistics for an organization"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Get counts
    total_projects = await db.projects.count_documents({"org_id": org_id, "status": {"$ne": "archived"}})
    total_forms = await db.forms.count_documents({"org_id": org_id})
    total_submissions = await db.submissions.count_documents({"org_id": org_id})
    total_cases = await db.cases.count_documents({"org_id": org_id})
    
    # Today's submissions
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    submissions_today = await db.submissions.count_documents({
        "org_id": org_id,
        "submitted_at": {"$gte": today_start.isoformat()}
    })
    
    # Pending reviews
    pending_reviews = await db.submissions.count_documents({
        "org_id": org_id,
        "status": "pending"
    })
    
    # Active enumerators (submitted in last 7 days)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_submissions = await db.submissions.distinct("submitted_by", {
        "org_id": org_id,
        "submitted_at": {"$gte": week_ago}
    })
    active_enumerators = len(recent_submissions)
    
    return {
        "total_projects": total_projects,
        "total_forms": total_forms,
        "total_submissions": total_submissions,
        "total_cases": total_cases,
        "submissions_today": submissions_today,
        "pending_reviews": pending_reviews,
        "active_enumerators": active_enumerators
    }


@router.get("/submission-trends")
async def get_submission_trends(
    request: Request,
    org_id: str,
    days: int = 30,
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get submission trends over time"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Build date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Build query
    query = {
        "org_id": org_id,
        "submitted_at": {"$gte": start_date.isoformat()}
    }
    if project_id:
        query["project_id"] = project_id
    
    submissions = await db.submissions.find(
        query,
        {"_id": 0, "submitted_at": 1}
    ).to_list(None)
    
    # Group by date
    date_counts = defaultdict(int)
    for sub in submissions:
        sub_date = sub["submitted_at"][:10]  # Get YYYY-MM-DD
        date_counts[sub_date] += 1
    
    # Fill in missing dates
    result = []
    current = start_date
    while current <= end_date:
        date_str = current.strftime("%Y-%m-%d")
        result.append({
            "date": date_str,
            "count": date_counts.get(date_str, 0)
        })
        current += timedelta(days=1)
    
    return result


@router.get("/quality-metrics")
async def get_quality_metrics(
    request: Request,
    org_id: str,
    project_id: Optional[str] = None,
    form_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get data quality metrics"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Build query
    query = {"org_id": org_id}
    if project_id:
        query["project_id"] = project_id
    if form_id:
        query["form_id"] = form_id
    
    # Get submissions
    submissions = await db.submissions.find(
        query,
        {"_id": 0, "quality_score": 1, "quality_flags": 1, "status": 1}
    ).to_list(None)
    
    if not submissions:
        return {
            "avg_quality_score": 0,
            "flagged_count": 0,
            "approved_count": 0,
            "rejected_count": 0,
            "total_count": 0,
            "flag_distribution": {}
        }
    
    # Calculate metrics
    scores = [s["quality_score"] for s in submissions if s.get("quality_score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    flagged_count = len([s for s in submissions if s.get("quality_flags")])
    approved_count = len([s for s in submissions if s["status"] == "approved"])
    rejected_count = len([s for s in submissions if s["status"] == "rejected"])
    
    # Flag distribution
    flag_counts = defaultdict(int)
    for sub in submissions:
        for flag in sub.get("quality_flags", []):
            flag_counts[flag] += 1
    
    return {
        "avg_quality_score": round(avg_score, 2),
        "flagged_count": flagged_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "total_count": len(submissions),
        "flag_distribution": dict(flag_counts)
    }


@router.get("/enumerator-performance")
async def get_enumerator_performance(
    request: Request,
    org_id: str,
    project_id: Optional[str] = None,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get enumerator performance metrics"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Build query
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = {
        "org_id": org_id,
        "submitted_at": {"$gte": start_date}
    }
    if project_id:
        query["project_id"] = project_id
    
    submissions = await db.submissions.find(
        query,
        {"_id": 0, "submitted_by": 1, "quality_score": 1, "status": 1, "submitted_at": 1}
    ).to_list(None)
    
    # Group by enumerator
    enumerator_stats = defaultdict(lambda: {
        "submission_count": 0,
        "quality_scores": [],
        "approved_count": 0,
        "rejected_count": 0
    })
    
    for sub in submissions:
        user_id = sub["submitted_by"]
        enumerator_stats[user_id]["submission_count"] += 1
        if sub.get("quality_score") is not None:
            enumerator_stats[user_id]["quality_scores"].append(sub["quality_score"])
        if sub["status"] == "approved":
            enumerator_stats[user_id]["approved_count"] += 1
        elif sub["status"] == "rejected":
            enumerator_stats[user_id]["rejected_count"] += 1
    
    # Get user details and calculate averages
    result = []
    for user_id, stats in enumerator_stats.items():
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
        avg_quality = sum(stats["quality_scores"]) / len(stats["quality_scores"]) if stats["quality_scores"] else 0
        
        result.append({
            "user_id": user_id,
            "name": user["name"] if user else "Unknown",
            "email": user["email"] if user else "",
            "submission_count": stats["submission_count"],
            "avg_quality_score": round(avg_quality, 2),
            "approved_count": stats["approved_count"],
            "rejected_count": stats["rejected_count"],
            "approval_rate": round(stats["approved_count"] / stats["submission_count"] * 100, 1) if stats["submission_count"] > 0 else 0
        })
    
    # Sort by submission count
    result.sort(key=lambda x: x["submission_count"], reverse=True)
    
    return result


@router.get("/gps-locations")
async def get_submission_locations(
    request: Request,
    org_id: str,
    project_id: Optional[str] = None,
    form_id: Optional[str] = None,
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get GPS locations of recent submissions for map visualization"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Build query
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    query = {
        "org_id": org_id,
        "submitted_at": {"$gte": start_date},
        "gps_location": {"$exists": True, "$ne": None}
    }
    if project_id:
        query["project_id"] = project_id
    if form_id:
        query["form_id"] = form_id
    
    submissions = await db.submissions.find(
        query,
        {"_id": 0, "id": 1, "gps_location": 1, "gps_accuracy": 1, "submitted_by": 1, "submitted_at": 1, "status": 1}
    ).limit(1000).to_list(1000)
    
    return submissions


@router.get("/recent-activity")
async def get_recent_activity(
    request: Request,
    org_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get recent activity feed"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Get recent submissions
    submissions = await db.submissions.find(
        {"org_id": org_id},
        {"_id": 0, "id": 1, "form_id": 1, "submitted_by": 1, "submitted_at": 1, "status": 1}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)
    
    activities = []
    for sub in submissions:
        # Get user and form info
        user = await db.users.find_one({"id": sub["submitted_by"]}, {"_id": 0, "name": 1})
        form = await db.forms.find_one({"id": sub["form_id"]}, {"_id": 0, "name": 1})
        
        activities.append({
            "type": "submission",
            "id": sub["id"],
            "user_name": user["name"] if user else "Unknown",
            "form_name": form["name"] if form else "Unknown",
            "status": sub["status"],
            "timestamp": sub["submitted_at"]
        })
    
    return activities
