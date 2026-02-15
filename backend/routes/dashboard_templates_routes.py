"""DataPulse - Dashboard Templates Routes
Preset templates and user-created templates for dashboards
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from bson import ObjectId

from auth import get_current_user, get_optional_user

router = APIRouter(prefix="/dashboard-templates", tags=["Dashboard Templates"])


class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    widgets: List[Dict[str, Any]] = []
    icon: Optional[str] = "LayoutDashboard"
    color: Optional[str] = "from-blue-500 to-blue-600"
    category: Optional[str] = "custom"


# Supported Widget Types
WIDGET_TYPES = [
    "stat",        # KPI card with number
    "chart",       # Bar, line, pie, area, scatter
    "table",       # Data table
    "gauge",       # Circular gauge for percentages
    "progress",    # Progress bar with target
    "map",         # Geographic heatmap
    "funnel",      # Conversion funnel
    "heatmap",     # Activity/time heatmap
    "scorecard",   # Metric vs target comparison
    "list",        # Ranked list items
    "timeline",    # Events/milestones
    "sparkline",   # Mini trend line with value
]


# Pre-defined dashboard templates - 10 comprehensive templates
PRESET_TEMPLATES = [
    # 1. SALES DASHBOARD
    {
        "id": "preset_sales",
        "name": "Sales Dashboard",
        "description": "Track revenue, orders, and sales performance",
        "icon": "DollarSign",
        "color": "from-emerald-500 to-emerald-600",
        "category": "sales",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Total Revenue", "config": {"aggregation": "sum", "format": "currency", "icon": "DollarSign"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Orders", "config": {"aggregation": "count", "icon": "ShoppingCart"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Avg Order Value", "config": {"aggregation": "mean", "format": "currency", "icon": "TrendingUp"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "gauge", "title": "Sales Target", "config": {"min": 0, "max": 100, "target": 80, "unit": "%"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Revenue Trend", "config": {"chart_type": "area", "color": "#10b981"}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
            {"type": "chart", "title": "Sales by Category", "config": {"chart_type": "pie"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
            {"type": "funnel", "title": "Sales Funnel", "config": {"stages": ["Leads", "Qualified", "Proposal", "Negotiation", "Closed"]}, "position": {"x": 0, "y": 6, "w": 4, "h": 4}},
            {"type": "table", "title": "Top Products", "config": {"columns": ["Product", "Sales", "Revenue"], "limit": 5}, "position": {"x": 4, "y": 6, "w": 4, "h": 4}},
            {"type": "chart", "title": "Monthly Comparison", "config": {"chart_type": "bar"}, "position": {"x": 8, "y": 6, "w": 4, "h": 4}},
        ]
    },
    
    # 2. MARKETING ANALYTICS
    {
        "id": "preset_marketing",
        "name": "Marketing Analytics",
        "description": "Monitor campaigns, traffic, and conversion rates",
        "icon": "Target",
        "color": "from-violet-500 to-violet-600",
        "category": "marketing",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Total Visitors", "config": {"aggregation": "sum", "icon": "Users"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Conversion Rate", "config": {"aggregation": "mean", "format": "percent", "icon": "Percent"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Leads Generated", "config": {"aggregation": "count", "icon": "UserPlus"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "sparkline", "title": "Cost per Lead", "config": {"format": "currency", "trend": "down_good"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Traffic Over Time", "config": {"chart_type": "area", "color": "#8b5cf6"}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
            {"type": "chart", "title": "Traffic Sources", "config": {"chart_type": "donut"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
            {"type": "funnel", "title": "Conversion Funnel", "config": {"stages": ["Visitors", "Signups", "Activated", "Paid"]}, "position": {"x": 0, "y": 6, "w": 4, "h": 4}},
            {"type": "heatmap", "title": "Activity by Hour", "config": {"x_axis": "hour", "y_axis": "day"}, "position": {"x": 4, "y": 6, "w": 4, "h": 4}},
            {"type": "list", "title": "Top Campaigns", "config": {"metric": "conversions", "limit": 5}, "position": {"x": 8, "y": 6, "w": 4, "h": 4}},
        ]
    },
    
    # 3. CUSTOMER INSIGHTS
    {
        "id": "preset_customers",
        "name": "Customer Insights",
        "description": "Understand customer behavior and demographics",
        "icon": "Users",
        "color": "from-blue-500 to-blue-600",
        "category": "customers",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Total Customers", "config": {"aggregation": "count", "icon": "Users"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "New This Month", "config": {"aggregation": "count", "icon": "UserPlus"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "gauge", "title": "Retention Rate", "config": {"min": 0, "max": 100, "target": 85, "unit": "%"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "gauge", "title": "NPS Score", "config": {"min": -100, "max": 100, "target": 50}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Customer Growth", "config": {"chart_type": "line", "color": "#3b82f6"}, "position": {"x": 0, "y": 2, "w": 6, "h": 4}},
            {"type": "chart", "title": "Customer Segments", "config": {"chart_type": "pie"}, "position": {"x": 6, "y": 2, "w": 3, "h": 4}},
            {"type": "chart", "title": "Age Distribution", "config": {"chart_type": "bar"}, "position": {"x": 9, "y": 2, "w": 3, "h": 4}},
            {"type": "map", "title": "Customers by Region", "config": {"map_type": "choropleth"}, "position": {"x": 0, "y": 6, "w": 6, "h": 4}},
            {"type": "table", "title": "Top Customers", "config": {"columns": ["Name", "Orders", "Lifetime Value"], "limit": 5}, "position": {"x": 6, "y": 6, "w": 6, "h": 4}},
        ]
    },
    
    # 4. OPERATIONS MONITOR
    {
        "id": "preset_operations",
        "name": "Operations Monitor",
        "description": "Track inventory, orders, and fulfillment",
        "icon": "Activity",
        "color": "from-amber-500 to-amber-600",
        "category": "operations",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Pending Orders", "config": {"aggregation": "count", "icon": "Clock"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "In Stock Items", "config": {"aggregation": "count", "icon": "Package"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Low Stock Alerts", "config": {"aggregation": "count", "icon": "AlertTriangle", "alert": True}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "gauge", "title": "Fulfillment Rate", "config": {"min": 0, "max": 100, "target": 95, "unit": "%"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Orders by Status", "config": {"chart_type": "donut"}, "position": {"x": 0, "y": 2, "w": 4, "h": 4}},
            {"type": "chart", "title": "Daily Orders", "config": {"chart_type": "bar", "color": "#f59e0b"}, "position": {"x": 4, "y": 2, "w": 8, "h": 4}},
            {"type": "progress", "title": "Shipping Goals", "config": {"targets": [{"name": "Same Day", "current": 85, "target": 90}, {"name": "Next Day", "current": 95, "target": 95}, {"name": "Standard", "current": 100, "target": 98}]}, "position": {"x": 0, "y": 6, "w": 4, "h": 4}},
            {"type": "table", "title": "Recent Orders", "config": {"columns": ["Order ID", "Customer", "Status", "Total"], "limit": 8}, "position": {"x": 4, "y": 6, "w": 8, "h": 4}},
        ]
    },
    
    # 5. FINANCIAL SUMMARY
    {
        "id": "preset_financial",
        "name": "Financial Summary",
        "description": "Monitor P&L, cash flow, and financial health",
        "icon": "TrendingUp",
        "color": "from-rose-500 to-rose-600",
        "category": "finance",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Total Revenue", "config": {"aggregation": "sum", "format": "currency", "icon": "DollarSign"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Total Expenses", "config": {"aggregation": "sum", "format": "currency", "icon": "CreditCard"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "scorecard", "title": "Net Profit", "config": {"format": "currency", "comparison": "last_month"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "scorecard", "title": "Profit Margin", "config": {"format": "percent", "target": 25}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Revenue vs Expenses", "config": {"chart_type": "line", "multi_series": True}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
            {"type": "chart", "title": "Expense Breakdown", "config": {"chart_type": "pie"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
            {"type": "chart", "title": "Monthly P&L", "config": {"chart_type": "bar", "stacked": True}, "position": {"x": 0, "y": 6, "w": 6, "h": 4}},
            {"type": "chart", "title": "Cash Flow", "config": {"chart_type": "waterfall"}, "position": {"x": 6, "y": 6, "w": 6, "h": 4}},
        ]
    },
    
    # 6. WEB ANALYTICS
    {
        "id": "preset_analytics",
        "name": "Web Analytics",
        "description": "Website performance, traffic, and user behavior",
        "icon": "BarChart3",
        "color": "from-cyan-500 to-cyan-600",
        "category": "analytics",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Page Views", "config": {"aggregation": "sum", "icon": "Eye"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Unique Visitors", "config": {"aggregation": "count", "icon": "Users"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "sparkline", "title": "Bounce Rate", "config": {"format": "percent", "trend": "down_good"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "sparkline", "title": "Avg Session", "config": {"format": "duration"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Traffic Over Time", "config": {"chart_type": "area", "color": "#06b6d4"}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
            {"type": "chart", "title": "Traffic Sources", "config": {"chart_type": "donut"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
            {"type": "heatmap", "title": "Visits by Day/Hour", "config": {"x_axis": "hour", "y_axis": "weekday"}, "position": {"x": 0, "y": 6, "w": 4, "h": 4}},
            {"type": "list", "title": "Top Pages", "config": {"metric": "views", "limit": 5}, "position": {"x": 4, "y": 6, "w": 4, "h": 4}},
            {"type": "chart", "title": "Device Breakdown", "config": {"chart_type": "bar"}, "position": {"x": 8, "y": 6, "w": 4, "h": 4}},
        ]
    },
    
    # 7. EXECUTIVE SUMMARY
    {
        "id": "preset_executive",
        "name": "Executive Summary",
        "description": "High-level KPIs and business health overview",
        "icon": "Briefcase",
        "color": "from-slate-600 to-slate-700",
        "category": "executive",
        "is_preset": True,
        "widgets": [
            {"type": "scorecard", "title": "Revenue", "config": {"format": "currency", "comparison": "last_quarter", "target": 1000000}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "scorecard", "title": "Customers", "config": {"comparison": "last_quarter"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "scorecard", "title": "MRR", "config": {"format": "currency", "comparison": "last_month"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "scorecard", "title": "Churn Rate", "config": {"format": "percent", "trend": "down_good"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Quarterly Performance", "config": {"chart_type": "bar", "multi_series": True}, "position": {"x": 0, "y": 2, "w": 6, "h": 4}},
            {"type": "gauge", "title": "Q4 Target Progress", "config": {"min": 0, "max": 100, "target": 100, "unit": "%"}, "position": {"x": 6, "y": 2, "w": 3, "h": 4}},
            {"type": "gauge", "title": "Customer Satisfaction", "config": {"min": 0, "max": 100, "target": 90, "unit": "%"}, "position": {"x": 9, "y": 2, "w": 3, "h": 4}},
            {"type": "chart", "title": "Revenue by Region", "config": {"chart_type": "pie"}, "position": {"x": 0, "y": 6, "w": 4, "h": 4}},
            {"type": "map", "title": "Global Performance", "config": {"map_type": "bubble"}, "position": {"x": 4, "y": 6, "w": 8, "h": 4}},
        ]
    },
    
    # 8. PROJECT TRACKER
    {
        "id": "preset_project",
        "name": "Project Tracker",
        "description": "Track project progress, tasks, and milestones",
        "icon": "FolderKanban",
        "color": "from-indigo-500 to-indigo-600",
        "category": "project",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Active Projects", "config": {"aggregation": "count", "icon": "Folder"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Tasks Completed", "config": {"aggregation": "count", "icon": "CheckCircle"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Overdue Tasks", "config": {"aggregation": "count", "icon": "AlertCircle", "alert": True}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "gauge", "title": "On-Time Delivery", "config": {"min": 0, "max": 100, "target": 90, "unit": "%"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "progress", "title": "Project Progress", "config": {"targets": [{"name": "Project Alpha", "current": 75, "target": 100}, {"name": "Project Beta", "current": 45, "target": 100}, {"name": "Project Gamma", "current": 90, "target": 100}]}, "position": {"x": 0, "y": 2, "w": 4, "h": 4}},
            {"type": "chart", "title": "Tasks by Status", "config": {"chart_type": "donut"}, "position": {"x": 4, "y": 2, "w": 4, "h": 4}},
            {"type": "chart", "title": "Team Workload", "config": {"chart_type": "bar"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
            {"type": "timeline", "title": "Upcoming Milestones", "config": {"limit": 5}, "position": {"x": 0, "y": 6, "w": 6, "h": 4}},
            {"type": "table", "title": "Recent Activity", "config": {"columns": ["Task", "Assignee", "Status", "Due Date"], "limit": 6}, "position": {"x": 6, "y": 6, "w": 6, "h": 4}},
        ]
    },
    
    # 9. SUPPORT DASHBOARD
    {
        "id": "preset_support",
        "name": "Support Dashboard",
        "description": "Track tickets, response times, and satisfaction",
        "icon": "Headphones",
        "color": "from-orange-500 to-orange-600",
        "category": "support",
        "is_preset": True,
        "widgets": [
            {"type": "stat", "title": "Open Tickets", "config": {"aggregation": "count", "icon": "Ticket"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Avg Response Time", "config": {"format": "duration", "icon": "Clock"}, "position": {"x": 3, "y": 0, "w": 3, "h": 2}},
            {"type": "gauge", "title": "CSAT Score", "config": {"min": 0, "max": 100, "target": 90, "unit": "%"}, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
            {"type": "stat", "title": "Resolved Today", "config": {"aggregation": "count", "icon": "CheckCircle"}, "position": {"x": 9, "y": 0, "w": 3, "h": 2}},
            {"type": "chart", "title": "Tickets Over Time", "config": {"chart_type": "area", "color": "#f97316"}, "position": {"x": 0, "y": 2, "w": 8, "h": 4}},
            {"type": "chart", "title": "Tickets by Category", "config": {"chart_type": "pie"}, "position": {"x": 8, "y": 2, "w": 4, "h": 4}},
            {"type": "chart", "title": "Tickets by Priority", "config": {"chart_type": "bar"}, "position": {"x": 0, "y": 6, "w": 4, "h": 4}},
            {"type": "list", "title": "Top Agents", "config": {"metric": "resolved", "limit": 5}, "position": {"x": 4, "y": 6, "w": 4, "h": 4}},
            {"type": "heatmap", "title": "Ticket Volume by Hour", "config": {"x_axis": "hour", "y_axis": "weekday"}, "position": {"x": 8, "y": 6, "w": 4, "h": 4}},
        ]
    },
    
    # 10. BLANK CANVAS
    {
        "id": "preset_blank",
        "name": "Blank Canvas",
        "description": "Start from scratch with an empty dashboard",
        "icon": "Layers",
        "color": "from-gray-400 to-gray-500",
        "category": "custom",
        "is_preset": True,
        "widgets": []
    }
]


@router.get("")
async def list_templates(
    request: Request,
    current_user: dict = Depends(get_optional_user)
):
    """List all preset and user-created templates"""
    db = request.app.state.db
    
    # If user is authenticated, get their custom templates
    custom = []
    if current_user:
        user_id = current_user.get("id") or current_user.get("user_id")
        if user_id:
            cursor = db.dashboard_templates.find({"user_id": user_id}, {"_id": 0})
            custom = await cursor.to_list(length=100)
    
    return {"preset": PRESET_TEMPLATES, "custom": custom}


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
