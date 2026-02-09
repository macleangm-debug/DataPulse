"""DataPulse - Dashboard Widgets API Routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/dashboard/widgets", tags=["dashboard-widgets"])

# Widget Types
WIDGET_TYPES = [
    {
        "id": "stat_card",
        "name": "Stat Card",
        "description": "Display a single metric with optional trend",
        "config_schema": {
            "metric": {"type": "select", "options": ["submissions", "forms", "projects", "users", "quality_score"]},
            "show_trend": {"type": "boolean", "default": True},
            "period": {"type": "select", "options": ["today", "week", "month", "all_time"]}
        }
    },
    {
        "id": "line_chart",
        "name": "Line Chart",
        "description": "Show trends over time",
        "config_schema": {
            "metric": {"type": "select", "options": ["submissions", "quality_score", "response_time"]},
            "period": {"type": "select", "options": ["7_days", "14_days", "30_days", "90_days"]},
            "group_by": {"type": "select", "options": ["day", "week", "month"]}
        }
    },
    {
        "id": "bar_chart",
        "name": "Bar Chart",
        "description": "Compare values across categories",
        "config_schema": {
            "metric": {"type": "select", "options": ["submissions_by_form", "submissions_by_user", "quality_by_form"]},
            "limit": {"type": "number", "default": 5}
        }
    },
    {
        "id": "pie_chart",
        "name": "Pie Chart",
        "description": "Show distribution of values",
        "config_schema": {
            "metric": {"type": "select", "options": ["status_distribution", "quality_distribution", "form_distribution"]}
        }
    },
    {
        "id": "table",
        "name": "Data Table",
        "description": "Display tabular data",
        "config_schema": {
            "data_source": {"type": "select", "options": ["recent_submissions", "top_performers", "flagged_submissions"]},
            "limit": {"type": "number", "default": 10}
        }
    },
    {
        "id": "map",
        "name": "Map Widget",
        "description": "Geographic visualization of submissions",
        "config_schema": {
            "view_mode": {"type": "select", "options": ["clusters", "points", "heatmap"]},
            "period": {"type": "select", "options": ["7_days", "30_days", "all_time"]}
        }
    },
    {
        "id": "activity_feed",
        "name": "Activity Feed",
        "description": "Recent activity stream",
        "config_schema": {
            "limit": {"type": "number", "default": 10},
            "activity_types": {"type": "multiselect", "options": ["submission", "approval", "rejection", "form_update"]}
        }
    },
    {
        "id": "progress",
        "name": "Progress Widget",
        "description": "Show progress towards a goal",
        "config_schema": {
            "metric": {"type": "select", "options": ["submissions_target", "quality_target"]},
            "target": {"type": "number"},
            "period": {"type": "select", "options": ["week", "month", "quarter"]}
        }
    }
]

class WidgetConfig(BaseModel):
    widget_type: str
    title: str
    config: Dict[str, Any]
    position: Dict[str, int]  # {x, y, w, h}
    
class DashboardLayout(BaseModel):
    org_id: str
    user_id: str
    name: str
    widgets: List[WidgetConfig]
    is_default: bool = False

# In-memory storage for demo (replace with MongoDB in production)
dashboard_layouts: Dict[str, Dict] = {}

@router.get("/widget-types")
async def get_widget_types():
    """Get available widget types and their configuration schemas"""
    return {"widget_types": WIDGET_TYPES}

@router.get("/layouts/{org_id}")
async def get_dashboard_layouts(org_id: str, user_id: Optional[str] = None):
    """Get dashboard layouts for an organization"""
    layouts = [
        layout for layout in dashboard_layouts.values()
        if layout["org_id"] == org_id and (not user_id or layout["user_id"] == user_id)
    ]
    
    # Return default layout if none exists
    if not layouts:
        return {
            "layouts": [{
                "id": "default",
                "name": "Default Dashboard",
                "is_default": True,
                "widgets": [
                    {
                        "id": "w1",
                        "widget_type": "stat_card",
                        "title": "Total Submissions",
                        "config": {"metric": "submissions", "show_trend": True, "period": "week"},
                        "position": {"x": 0, "y": 0, "w": 3, "h": 2}
                    },
                    {
                        "id": "w2",
                        "widget_type": "stat_card",
                        "title": "Active Forms",
                        "config": {"metric": "forms", "show_trend": True, "period": "week"},
                        "position": {"x": 3, "y": 0, "w": 3, "h": 2}
                    },
                    {
                        "id": "w3",
                        "widget_type": "stat_card",
                        "title": "Quality Score",
                        "config": {"metric": "quality_score", "show_trend": True, "period": "week"},
                        "position": {"x": 6, "y": 0, "w": 3, "h": 2}
                    },
                    {
                        "id": "w4",
                        "widget_type": "stat_card",
                        "title": "Team Members",
                        "config": {"metric": "users", "show_trend": False, "period": "all_time"},
                        "position": {"x": 9, "y": 0, "w": 3, "h": 2}
                    },
                    {
                        "id": "w5",
                        "widget_type": "line_chart",
                        "title": "Submission Trends",
                        "config": {"metric": "submissions", "period": "14_days", "group_by": "day"},
                        "position": {"x": 0, "y": 2, "w": 8, "h": 4}
                    },
                    {
                        "id": "w6",
                        "widget_type": "activity_feed",
                        "title": "Recent Activity",
                        "config": {"limit": 5, "activity_types": ["submission", "approval"]},
                        "position": {"x": 8, "y": 2, "w": 4, "h": 4}
                    },
                    {
                        "id": "w7",
                        "widget_type": "bar_chart",
                        "title": "Submissions by Form",
                        "config": {"metric": "submissions_by_form", "limit": 5},
                        "position": {"x": 0, "y": 6, "w": 6, "h": 4}
                    },
                    {
                        "id": "w8",
                        "widget_type": "pie_chart",
                        "title": "Status Distribution",
                        "config": {"metric": "status_distribution"},
                        "position": {"x": 6, "y": 6, "w": 6, "h": 4}
                    }
                ]
            }]
        }
    
    return {"layouts": layouts}

@router.post("/layouts")
async def save_dashboard_layout(layout: DashboardLayout):
    """Save a custom dashboard layout"""
    layout_id = str(ObjectId())
    layout_data = layout.dict()
    layout_data["id"] = layout_id
    layout_data["created_at"] = datetime.utcnow().isoformat()
    layout_data["updated_at"] = datetime.utcnow().isoformat()
    
    dashboard_layouts[layout_id] = layout_data
    return {"id": layout_id, "message": "Layout saved successfully"}

@router.put("/layouts/{layout_id}")
async def update_dashboard_layout(layout_id: str, layout: DashboardLayout):
    """Update a dashboard layout"""
    if layout_id not in dashboard_layouts:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    layout_data = layout.dict()
    layout_data["id"] = layout_id
    layout_data["updated_at"] = datetime.utcnow().isoformat()
    layout_data["created_at"] = dashboard_layouts[layout_id].get("created_at")
    
    dashboard_layouts[layout_id] = layout_data
    return {"message": "Layout updated successfully"}

@router.delete("/layouts/{layout_id}")
async def delete_dashboard_layout(layout_id: str):
    """Delete a dashboard layout"""
    if layout_id not in dashboard_layouts:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    del dashboard_layouts[layout_id]
    return {"message": "Layout deleted successfully"}

@router.get("/widget-data/{widget_type}")
async def get_widget_data(
    widget_type: str,
    org_id: str,
    metric: Optional[str] = None,
    period: Optional[str] = None,
    limit: int = 10
):
    """Get data for a specific widget type"""
    
    # Generate sample data based on widget type
    if widget_type == "stat_card":
        return {
            "value": 1247,
            "trend": 12.5,
            "previous_value": 1108,
            "period": period or "week"
        }
    
    elif widget_type == "line_chart":
        from datetime import timedelta
        days = 14 if period == "14_days" else 7 if period == "7_days" else 30
        data = []
        for i in range(days):
            date = datetime.now() - timedelta(days=days-i-1)
            data.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": 50 + (i * 3) + (i % 3 * 10)
            })
        return {"data": data, "metric": metric}
    
    elif widget_type == "bar_chart":
        return {
            "data": [
                {"name": "Household Survey", "value": 234},
                {"name": "Health Screening", "value": 189},
                {"name": "Customer Feedback", "value": 156},
                {"name": "Event Registration", "value": 98},
                {"name": "Agriculture Survey", "value": 67}
            ][:limit]
        }
    
    elif widget_type == "pie_chart":
        return {
            "data": [
                {"name": "Approved", "value": 65, "color": "#22c55e"},
                {"name": "Pending", "value": 25, "color": "#f59e0b"},
                {"name": "Rejected", "value": 10, "color": "#ef4444"}
            ]
        }
    
    elif widget_type == "activity_feed":
        return {
            "activities": [
                {"user": "John Doe", "action": "submitted", "form": "Household Survey", "time": "5 min ago"},
                {"user": "Jane Smith", "action": "approved", "form": "Health Screening", "time": "12 min ago"},
                {"user": "Mike Johnson", "action": "submitted", "form": "Customer Feedback", "time": "28 min ago"},
                {"user": "Sarah Williams", "action": "rejected", "form": "Event Registration", "time": "45 min ago"},
                {"user": "Tom Brown", "action": "submitted", "form": "Agriculture Survey", "time": "1 hour ago"}
            ][:limit]
        }
    
    elif widget_type == "progress":
        return {
            "current": 847,
            "target": 1000,
            "percentage": 84.7,
            "remaining": 153
        }
    
    elif widget_type == "table":
        return {
            "columns": ["Submission ID", "Form", "User", "Status", "Date"],
            "rows": [
                ["SUB-001", "Household Survey", "John Doe", "Approved", "2024-01-15"],
                ["SUB-002", "Health Screening", "Jane Smith", "Pending", "2024-01-15"],
                ["SUB-003", "Customer Feedback", "Mike Johnson", "Approved", "2024-01-14"],
                ["SUB-004", "Event Registration", "Sarah Williams", "Rejected", "2024-01-14"],
                ["SUB-005", "Agriculture Survey", "Tom Brown", "Approved", "2024-01-13"]
            ][:limit]
        }
    
    return {"error": "Unknown widget type"}
