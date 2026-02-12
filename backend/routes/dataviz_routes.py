"""
DataViz Studio - Analytics & Visualization Routes
Complete dashboard builder with charts, widgets, and export capabilities
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import json

router = APIRouter(prefix="/dataviz", tags=["DataViz Studio"])

# ============================================
# PYDANTIC MODELS
# ============================================

class WidgetConfig(BaseModel):
    id: str
    type: str  # chart, stat, table, map
    title: str
    chart_type: Optional[str] = None  # bar, line, pie, area, scatter, donut
    data_source: str  # form_id or 'all'
    field: Optional[str] = None  # field to aggregate
    aggregation: Optional[str] = "count"  # count, sum, avg, min, max
    group_by: Optional[str] = None
    filters: Optional[Dict[str, Any]] = {}
    colors: Optional[List[str]] = None
    position: Dict[str, int] = {"x": 0, "y": 0, "w": 4, "h": 3}
    settings: Optional[Dict[str, Any]] = {}

class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    widgets: List[WidgetConfig] = []
    layout: Optional[str] = "grid"  # grid, freeform
    is_public: bool = False
    refresh_interval: Optional[int] = 0  # seconds, 0 = manual

class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widgets: Optional[List[WidgetConfig]] = None
    layout: Optional[str] = None
    is_public: Optional[bool] = None
    refresh_interval: Optional[int] = None

class ChartDataRequest(BaseModel):
    form_id: str
    field: str
    aggregation: str = "count"
    group_by: Optional[str] = None
    filters: Optional[Dict[str, Any]] = {}
    date_range: Optional[Dict[str, str]] = None

# ============================================
# HELPER FUNCTIONS
# ============================================

def get_db(request: Request):
    return request.app.state.db

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == '_id':
            result['id'] = str(value)
        elif isinstance(value, ObjectId):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    return result

# ============================================
# DASHBOARD CRUD
# ============================================

@router.post("/dashboards")
async def create_dashboard(dashboard: DashboardCreate, request: Request, org_id: str = Query(...)):
    """Create a new dashboard"""
    db = get_db(request)
    
    doc = {
        "name": dashboard.name,
        "description": dashboard.description,
        "org_id": org_id,
        "widgets": [w.dict() for w in dashboard.widgets],
        "layout": dashboard.layout,
        "is_public": dashboard.is_public,
        "refresh_interval": dashboard.refresh_interval,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.dataviz_dashboards.insert_one(doc)
    
    return {
        "id": str(result.inserted_id),
        "message": "Dashboard created successfully"
    }

@router.get("/dashboards")
async def list_dashboards(request: Request, org_id: str = Query(...)):
    """List all dashboards for an organization"""
    db = get_db(request)
    
    dashboards = await db.dataviz_dashboards.find(
        {"org_id": org_id}
    ).sort("updated_at", -1).to_list(100)
    
    return {
        "dashboards": [serialize_doc(d) for d in dashboards],
        "count": len(dashboards)
    }

@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str, request: Request):
    """Get a specific dashboard"""
    db = get_db(request)
    
    dashboard = await db.dataviz_dashboards.find_one({"_id": ObjectId(dashboard_id)})
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return serialize_doc(dashboard)

@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(dashboard_id: str, update: DashboardUpdate, request: Request):
    """Update a dashboard"""
    db = get_db(request)
    
    update_doc = {"updated_at": datetime.now(timezone.utc)}
    
    if update.name is not None:
        update_doc["name"] = update.name
    if update.description is not None:
        update_doc["description"] = update.description
    if update.widgets is not None:
        update_doc["widgets"] = [w.dict() for w in update.widgets]
    if update.layout is not None:
        update_doc["layout"] = update.layout
    if update.is_public is not None:
        update_doc["is_public"] = update.is_public
    if update.refresh_interval is not None:
        update_doc["refresh_interval"] = update.refresh_interval
    
    result = await db.dataviz_dashboards.update_one(
        {"_id": ObjectId(dashboard_id)},
        {"$set": update_doc}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Dashboard updated successfully"}

@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, request: Request):
    """Delete a dashboard"""
    db = get_db(request)
    
    result = await db.dataviz_dashboards.delete_one({"_id": ObjectId(dashboard_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Dashboard deleted successfully"}

# ============================================
# CHART DATA AGGREGATION
# ============================================

@router.post("/charts/data")
async def get_chart_data(chart_request: ChartDataRequest, request: Request):
    """Get aggregated data for a chart"""
    db = get_db(request)
    
    # Build match stage
    match_stage = {"form_id": chart_request.form_id}
    
    if chart_request.filters:
        for key, value in chart_request.filters.items():
            match_stage[f"responses.{key}"] = value
    
    if chart_request.date_range:
        if chart_request.date_range.get("start"):
            match_stage["submitted_at"] = {"$gte": datetime.fromisoformat(chart_request.date_range["start"])}
        if chart_request.date_range.get("end"):
            if "submitted_at" in match_stage:
                match_stage["submitted_at"]["$lte"] = datetime.fromisoformat(chart_request.date_range["end"])
            else:
                match_stage["submitted_at"] = {"$lte": datetime.fromisoformat(chart_request.date_range["end"])}
    
    # Build aggregation pipeline
    pipeline = [{"$match": match_stage}]
    
    field_path = f"$responses.{chart_request.field}"
    
    if chart_request.group_by:
        group_by_path = f"$responses.{chart_request.group_by}"
        
        if chart_request.aggregation == "count":
            pipeline.append({
                "$group": {
                    "_id": group_by_path,
                    "value": {"$sum": 1}
                }
            })
        elif chart_request.aggregation == "sum":
            pipeline.append({
                "$group": {
                    "_id": group_by_path,
                    "value": {"$sum": {"$toDouble": field_path}}
                }
            })
        elif chart_request.aggregation == "avg":
            pipeline.append({
                "$group": {
                    "_id": group_by_path,
                    "value": {"$avg": {"$toDouble": field_path}}
                }
            })
    else:
        # Simple value distribution
        pipeline.append({
            "$group": {
                "_id": field_path,
                "value": {"$sum": 1}
            }
        })
    
    pipeline.append({"$sort": {"value": -1}})
    pipeline.append({"$limit": 50})
    
    results = await db.submissions.aggregate(pipeline).to_list(50)
    
    # Format for charts
    chart_data = []
    for r in results:
        label = r["_id"] if r["_id"] else "Unknown"
        chart_data.append({
            "name": str(label),
            "value": r["value"]
        })
    
    return {"data": chart_data}

@router.get("/charts/time-series")
async def get_time_series_data(
    request: Request,
    form_id: str = Query(...),
    field: Optional[str] = None,
    interval: str = Query("day"),  # hour, day, week, month
    days: int = Query(30)
):
    """Get time series data for submissions"""
    db = get_db(request)
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Date format based on interval
    date_formats = {
        "hour": "%Y-%m-%d %H:00",
        "day": "%Y-%m-%d",
        "week": "%Y-W%V",
        "month": "%Y-%m"
    }
    
    pipeline = [
        {"$match": {
            "form_id": form_id,
            "submitted_at": {"$gte": start_date}
        }},
        {"$group": {
            "_id": {
                "$dateToString": {
                    "format": date_formats.get(interval, "%Y-%m-%d"),
                    "date": "$submitted_at"
                }
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.submissions.aggregate(pipeline).to_list(100)
    
    return {
        "data": [{"date": r["_id"], "value": r["count"]} for r in results],
        "interval": interval
    }

@router.get("/charts/summary-stats")
async def get_summary_stats(request: Request, org_id: str = Query(...)):
    """Get summary statistics for the organization"""
    db = get_db(request)
    
    # Total submissions
    total_submissions = await db.submissions.count_documents({"org_id": org_id})
    
    # Submissions today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    submissions_today = await db.submissions.count_documents({
        "org_id": org_id,
        "submitted_at": {"$gte": today_start}
    })
    
    # Submissions this week
    week_start = today_start - timedelta(days=today_start.weekday())
    submissions_week = await db.submissions.count_documents({
        "org_id": org_id,
        "submitted_at": {"$gte": week_start}
    })
    
    # Total forms
    total_forms = await db.forms.count_documents({"org_id": org_id})
    
    # Active enumerators (unique submitters in last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_pipeline = [
        {"$match": {"org_id": org_id, "submitted_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$enumerator_id"}},
        {"$count": "count"}
    ]
    active_result = await db.submissions.aggregate(active_pipeline).to_list(1)
    active_enumerators = active_result[0]["count"] if active_result else 0
    
    return {
        "total_submissions": total_submissions,
        "submissions_today": submissions_today,
        "submissions_week": submissions_week,
        "total_forms": total_forms,
        "active_enumerators": active_enumerators
    }

# ============================================
# FORM FIELDS FOR CHART BUILDER
# ============================================

@router.get("/forms/{form_id}/fields")
async def get_form_fields(form_id: str, request: Request):
    """Get fields from a form for chart builder"""
    db = get_db(request)
    
    form = await db.forms.find_one({"_id": ObjectId(form_id)})
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    fields = []
    for field in form.get("fields", []):
        fields.append({
            "name": field.get("name", field.get("id")),
            "label": field.get("label", field.get("name", "")),
            "type": field.get("type", "text"),
            "choices": field.get("choices", [])
        })
    
    return {
        "form_id": form_id,
        "form_name": form.get("name", ""),
        "fields": fields
    }

@router.get("/forms/list")
async def list_forms_for_dataviz(request: Request, org_id: str = Query(...)):
    """List forms available for data visualization"""
    db = get_db(request)
    
    forms = await db.forms.find(
        {"org_id": org_id},
        {"_id": 1, "name": 1, "field_count": 1, "submission_count": 1}
    ).to_list(100)
    
    result = []
    for form in forms:
        # Get submission count
        sub_count = await db.submissions.count_documents({"form_id": str(form["_id"])})
        result.append({
            "id": str(form["_id"]),
            "name": form.get("name", "Untitled"),
            "submission_count": sub_count
        })
    
    return {"forms": result}

# ============================================
# TEMPLATES
# ============================================

@router.get("/templates")
async def get_dashboard_templates():
    """Get pre-built dashboard templates"""
    templates = [
        {
            "id": "submission-overview",
            "name": "Submission Overview",
            "description": "Track submission volume and trends",
            "thumbnail": "submission-overview.png",
            "widgets": [
                {"type": "stat", "title": "Total Submissions", "aggregation": "count"},
                {"type": "chart", "chart_type": "line", "title": "Submissions Over Time"},
                {"type": "chart", "chart_type": "bar", "title": "Submissions by Form"},
                {"type": "chart", "chart_type": "pie", "title": "Status Distribution"}
            ]
        },
        {
            "id": "data-quality",
            "name": "Data Quality Monitor",
            "description": "Monitor data quality metrics",
            "thumbnail": "data-quality.png",
            "widgets": [
                {"type": "stat", "title": "Quality Score"},
                {"type": "chart", "chart_type": "gauge", "title": "Completion Rate"},
                {"type": "chart", "chart_type": "bar", "title": "Issues by Type"},
                {"type": "table", "title": "Recent Quality Flags"}
            ]
        },
        {
            "id": "field-team",
            "name": "Field Team Performance",
            "description": "Track enumerator productivity",
            "thumbnail": "field-team.png",
            "widgets": [
                {"type": "stat", "title": "Active Enumerators"},
                {"type": "chart", "chart_type": "bar", "title": "Submissions by Enumerator"},
                {"type": "chart", "chart_type": "line", "title": "Daily Productivity"},
                {"type": "map", "title": "Collection Locations"}
            ]
        },
        {
            "id": "geographic",
            "name": "Geographic Analysis",
            "description": "Visualize data on maps",
            "thumbnail": "geographic.png",
            "widgets": [
                {"type": "map", "title": "Submission Locations"},
                {"type": "chart", "chart_type": "bar", "title": "By Region"},
                {"type": "stat", "title": "Coverage Area"}
            ]
        }
    ]
    
    return {"templates": templates}

# ============================================
# EXPORT
# ============================================

@router.post("/dashboards/{dashboard_id}/export")
async def export_dashboard(
    dashboard_id: str,
    request: Request,
    format: str = Query("pdf")  # pdf, png, excel
):
    """Export dashboard to PDF, PNG, or Excel"""
    db = get_db(request)
    
    dashboard = await db.dataviz_dashboards.find_one({"_id": ObjectId(dashboard_id)})
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # In a real implementation, this would generate the actual export
    # For now, return a placeholder response
    return {
        "message": f"Dashboard export initiated",
        "format": format,
        "dashboard_name": dashboard.get("name"),
        "download_url": f"/api/dataviz/exports/{dashboard_id}.{format}",
        "status": "processing"
    }
