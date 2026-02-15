"""DataPulse - Dashboard Templates Routes
Preset templates and user-created templates for dashboards
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from bson import ObjectId

from auth import get_current_user

router = APIRouter(prefix="/dashboard-templates", tags=["Dashboard Templates"])


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    widgets: List[Dict[str, Any]] = []
    icon: Optional[str] = "LayoutDashboard"
    color: Optional[str] = "from-blue-500 to-blue-600"


# Pre-defined dashboard templates
PRESET_TEMPLATES = [
    {
        "id": "preset_sales",
        "name": "Sales Overview",
        "description": "Track sales performance and revenue",
        "icon": "DollarSign",
        "color": "from-emerald-500 to-emerald-600",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Total Revenue", "config": {"aggregation": "sum"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Orders", "config": {"aggregation": "count"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Revenue Trend", "config": {"chart_type": "line"}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
            {"type": "chart", "title": "Sales by Category", "config": {"chart_type": "pie"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
        ]
    },
    {
        "id": "preset_marketing",
        "name": "Marketing Analytics",
        "description": "Monitor campaigns and conversions",
        "icon": "Target",
        "color": "from-violet-500 to-violet-600",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Visitors", "config": {"aggregation": "sum"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Conversion Rate", "config": {"aggregation": "mean"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Traffic Sources", "config": {"chart_type": "pie"}, "position": {"x": 0, "y": 2, "w": 6, "h": 4}},
        ]
    },
    {
        "id": "preset_customers",
        "name": "Customer Insights",
        "description": "Understand customer behavior",
        "icon": "Users",
        "color": "from-blue-500 to-blue-600",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Total Customers", "config": {"aggregation": "count"}, "position": {"x": 0, "y": 0, "w": 4, "h": 2}},
            {"type": "chart", "title": "Customer Segments", "config": {"chart_type": "pie"}, "position": {"x": 0, "y": 2, "w": 6, "h": 4}},
        ]
    },
    {
        "id": "preset_operations",
        "name": "Operations Monitor",
        "description": "Track inventory and orders",
        "icon": "Activity",
        "color": "from-amber-500 to-amber-600",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Pending Orders", "config": {"aggregation": "count"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Order Status", "config": {"chart_type": "pie"}, "position": {"x": 0, "y": 2, "w": 6, "h": 4}},
        ]
    },
    {
        "id": "preset_financial",
        "name": "Financial Summary",
        "description": "Monitor P&L and expenses",
        "icon": "TrendingUp",
        "color": "from-rose-500 to-rose-600",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Revenue", "config": {"aggregation": "sum"}, "position": {"x": 0, "y": 0, "w": 4, "h": 2}},
            {"type": "chart", "title": "Revenue vs Expenses", "config": {"chart_type": "line"}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
        ]
    },
    {
        "id": "preset_blank",
        "name": "Blank Canvas",
        "description": "Start from scratch",
        "icon": "Layers",
        "color": "from-gray-500 to-gray-600",
        "is_preset": True,
        "widgets": []
    },
]


@router.get("")
async def list_templates(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """List all preset and user-created templates"""
    db = request.app.state.db
    
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        cursor = db.dashboard_templates.find({"user_id": user_id}, {"_id": 0})
        custom = await cursor.to_list(length=100)
        return {"preset": PRESET_TEMPLATES, "custom": custom}
    except Exception:
        return {"preset": PRESET_TEMPLATES, "custom": []}


@router.post("")
async def create_template(
    template: TemplateCreate,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a new custom template"""
    db = request.app.state.db
    
    user_id = current_user.get("id") or current_user.get("user_id")
    template_id = str(ObjectId())
    
    doc = {
        "id": template_id,
        "user_id": user_id,
        "name": template.name,
        "description": template.description,
        "widgets": template.widgets,
        "icon": template.icon,
        "color": template.color,
        "is_preset": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dashboard_templates.insert_one(doc)
    
    return {"id": template_id, "message": "Template created"}


@router.post("/from-dashboard/{dashboard_id}")
async def save_dashboard_as_template(
    dashboard_id: str,
    request: Request,
    name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Save an existing dashboard as a template"""
    db = request.app.state.db
    
    user_id = current_user.get("id") or current_user.get("user_id")
    
    # Get the dashboard
    dashboard = await db.dashboards.find_one({"id": dashboard_id})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Get widgets for this dashboard
    cursor = db.widgets.find({"dashboard_id": dashboard_id}, {"_id": 0})
    widgets_list = await cursor.to_list(length=100)
    
    # Extract widget configurations (without IDs)
    widgets = [
        {
            "type": w.get("type"),
            "title": w.get("title"),
            "config": w.get("config", {}),
            "position": w.get("position", {})
        }
        for w in widgets_list
    ]
    
    template_id = str(ObjectId())
    
    doc = {
        "id": template_id,
        "user_id": user_id,
        "name": name or f"{dashboard.get('name')} Template",
        "description": dashboard.get("description", ""),
        "widgets": widgets,
        "icon": "LayoutDashboard",
        "color": "from-indigo-500 to-indigo-600",
        "is_preset": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dashboard_templates.insert_one(doc)
    
    return {"id": template_id, "message": "Dashboard saved as template"}


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom template"""
    db = request.app.state.db
    
    user_id = current_user.get("id") or current_user.get("user_id")
    
    result = await db.dashboard_templates.delete_one({
        "id": template_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted"}


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    request: Request
):
    """Get a specific template by ID"""
    db = request.app.state.db
    
    # Check preset templates first
    preset = next((t for t in PRESET_TEMPLATES if t["id"] == template_id), None)
    if preset:
        return preset
    
    # Check custom templates
    template = await db.dashboard_templates.find_one(
        {"id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template
