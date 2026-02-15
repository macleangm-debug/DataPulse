"""DataPulse - Dashboard Routes
Interactive dashboards with widgets, filters, and sharing
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])


# ============ Models ============

class DashboardWidget(BaseModel):
    id: str
    type: str  # chart, stat, table, text
    title: str
    config: Dict[str, Any]  # Widget-specific configuration
    position: Dict[str, int]  # x, y, w, h for grid placement
    data_source: Optional[Dict[str, Any]] = None  # Variable, snapshot, etc.


class DashboardFilter(BaseModel):
    id: str
    variable: str
    label: str
    type: str  # select, multiselect, range, date
    default_value: Optional[Any] = None


class CreateDashboardRequest(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    form_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    widgets: List[DashboardWidget] = []
    filters: List[DashboardFilter] = []
    layout: Optional[Dict[str, Any]] = None  # Grid settings
    theme: str = "light"
    refresh_interval: Optional[int] = None  # Auto-refresh in seconds


class ShareDashboardRequest(BaseModel):
    user_ids: Optional[List[str]] = None
    role: str = "viewer"  # viewer, editor
    public: bool = False
    password: Optional[str] = None


class DashboardDataRequest(BaseModel):
    dashboard_id: str
    filters: Optional[Dict[str, Any]] = None  # Applied filter values


# ============ Dashboard CRUD ============

@router.post("")
async def create_dashboard(request: Request, req: CreateDashboardRequest):
    """Create a new dashboard"""
    db = request.app.state.db
    
    dashboard_id = str(uuid.uuid4())
    
    dashboard = {
        "id": dashboard_id,
        "org_id": req.org_id,
        "name": req.name,
        "description": req.description,
        "form_id": req.form_id,
        "snapshot_id": req.snapshot_id,
        "widgets": [w.dict() for w in req.widgets],
        "filters": [f.dict() for f in req.filters],
        "layout": req.layout or {"cols": 12, "row_height": 100},
        "theme": req.theme,
        "refresh_interval": req.refresh_interval,
        "sharing": {"public": False, "users": []},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dashboards.insert_one(dashboard)
    
    return {"id": dashboard_id, "message": "Dashboard created"}


@router.get("/{org_id}")
async def list_dashboards(request: Request, org_id: str):
    """List all dashboards for an organization"""
    db = request.app.state.db
    
    dashboards = await db.dashboards.find(
        {"org_id": org_id},
        {"_id": 0, "widgets": 0}  # Exclude heavy data
    ).sort("updated_at", -1).to_list(100)
    
    return dashboards


@router.get("/{org_id}/{dashboard_id}")
async def get_dashboard(request: Request, org_id: str, dashboard_id: str):
    """Get a specific dashboard"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one(
        {"id": dashboard_id, "org_id": org_id},
        {"_id": 0}
    )
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return dashboard


@router.put("/{org_id}/{dashboard_id}")
async def update_dashboard(request: Request, org_id: str, dashboard_id: str, req: CreateDashboardRequest):
    """Update a dashboard"""
    db = request.app.state.db
    
    result = await db.dashboards.update_one(
        {"id": dashboard_id, "org_id": org_id},
        {"$set": {
            "name": req.name,
            "description": req.description,
            "widgets": [w.dict() for w in req.widgets],
            "filters": [f.dict() for f in req.filters],
            "layout": req.layout,
            "theme": req.theme,
            "refresh_interval": req.refresh_interval,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Dashboard updated"}


@router.delete("/{org_id}/{dashboard_id}")
async def delete_dashboard(request: Request, org_id: str, dashboard_id: str):
    """Delete a dashboard"""
    db = request.app.state.db
    
    result = await db.dashboards.delete_one({"id": dashboard_id, "org_id": org_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Dashboard deleted"}


# ============ Widget Data ============

@router.post("/data")
async def get_dashboard_data(request: Request, req: DashboardDataRequest):
    """Get data for all widgets in a dashboard with applied filters"""
    db = request.app.state.db
    
    # Get dashboard
    dashboard = await db.dashboards.find_one({"id": req.dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Get data source
    data = []
    schema = []
    
    if dashboard.get("snapshot_id"):
        snapshot = await db.snapshots.find_one({"id": dashboard["snapshot_id"]}, {"_id": 0})
        if snapshot:
            data = snapshot.get("data", [])
            schema = snapshot.get("schema", [])
    elif dashboard.get("form_id"):
        submissions = await db.submissions.find(
            {"form_id": dashboard["form_id"], "status": "approved"},
            {"_id": 0}
        ).to_list(10000)
        data = [s.get("data", {}) for s in submissions]
        
        form = await db.forms.find_one({"id": dashboard["form_id"]}, {"_id": 0})
        if form:
            schema = form.get("fields", [])
    
    if not data:
        return {"widgets": {}, "total_records": 0}
    
    import pandas as pd
    df = pd.DataFrame(data)
    
    # Apply filters
    if req.filters:
        for var, value in req.filters.items():
            if var in df.columns and value is not None:
                if isinstance(value, list):
                    df = df[df[var].isin(value)]
                else:
                    df = df[df[var] == value]
    
    # Compute data for each widget
    widget_data = {}
    
    for widget in dashboard.get("widgets", []):
        widget_id = widget["id"]
        widget_type = widget["type"]
        config = widget.get("config", {})
        
        try:
            if widget_type == "stat":
                widget_data[widget_id] = compute_stat_widget(df, config)
            elif widget_type == "chart":
                widget_data[widget_id] = compute_chart_widget(df, config)
            elif widget_type == "table":
                widget_data[widget_id] = compute_table_widget(df, config)
            elif widget_type == "text":
                widget_data[widget_id] = {"content": config.get("content", "")}
        except Exception as e:
            widget_data[widget_id] = {"error": str(e)}
    
    return {
        "widgets": widget_data,
        "total_records": len(df),
        "filtered": req.filters is not None and len(req.filters) > 0
    }


def compute_stat_widget(df, config):
    """Compute single statistic for stat widget"""
    variable = config.get("variable")
    stat_type = config.get("stat_type", "count")
    
    if not variable or variable not in df.columns:
        return {"value": len(df), "label": "Count"}
    
    import numpy as np
    
    series = pd.to_numeric(df[variable], errors='coerce').dropna()
    
    if stat_type == "count":
        return {"value": int(len(df)), "label": "Count"}
    elif stat_type == "sum":
        return {"value": round(float(series.sum()), 2), "label": "Sum"}
    elif stat_type == "mean":
        return {"value": round(float(series.mean()), 2), "label": "Mean"}
    elif stat_type == "median":
        return {"value": round(float(series.median()), 2), "label": "Median"}
    elif stat_type == "min":
        return {"value": round(float(series.min()), 2), "label": "Min"}
    elif stat_type == "max":
        return {"value": round(float(series.max()), 2), "label": "Max"}
    elif stat_type == "std":
        return {"value": round(float(series.std()), 2), "label": "Std Dev"}
    else:
        return {"value": int(len(df)), "label": "Count"}


def compute_chart_widget(df, config):
    """Compute chart data"""
    import numpy as np
    
    chart_type = config.get("chart_type", "bar")
    variable = config.get("variable")
    group_by = config.get("group_by")
    
    if not variable or variable not in df.columns:
        return {"data": [], "type": chart_type}
    
    if chart_type in ["bar", "pie", "donut"]:
        # Frequency distribution
        counts = df[variable].value_counts().head(10)
        data = [{"name": str(k), "value": int(v)} for k, v in counts.items()]
        return {"data": data, "type": chart_type}
    
    elif chart_type == "line":
        # Time series or sequential
        if group_by and group_by in df.columns:
            grouped = df.groupby(group_by)[variable].mean()
            data = [{"name": str(k), "value": round(float(v), 2)} for k, v in grouped.items()]
        else:
            data = [{"name": str(i), "value": float(v)} for i, v in enumerate(df[variable].head(50))]
        return {"data": data, "type": chart_type}
    
    elif chart_type == "scatter":
        x_var = config.get("x_variable", variable)
        y_var = config.get("y_variable")
        
        if y_var and y_var in df.columns:
            sample = df[[x_var, y_var]].dropna().head(100)
            data = [{"x": float(row[x_var]), "y": float(row[y_var])} for _, row in sample.iterrows()]
        else:
            data = []
        return {"data": data, "type": chart_type}
    
    return {"data": [], "type": chart_type}


def compute_table_widget(df, config):
    """Compute table data"""
    columns = config.get("columns", list(df.columns)[:5])
    limit = config.get("limit", 10)
    sort_by = config.get("sort_by")
    sort_order = config.get("sort_order", "desc")
    
    # Filter to requested columns
    available_cols = [c for c in columns if c in df.columns]
    if not available_cols:
        available_cols = list(df.columns)[:5]
    
    result_df = df[available_cols].copy()
    
    # Sort if specified
    if sort_by and sort_by in result_df.columns:
        result_df = result_df.sort_values(sort_by, ascending=(sort_order == "asc"))
    
    # Limit rows
    result_df = result_df.head(limit)
    
    # Convert to serializable format
    rows = result_df.to_dict(orient="records")
    
    return {
        "columns": available_cols,
        "rows": rows,
        "total": len(df)
    }


# ============ Sharing ============

@router.post("/{dashboard_id}/share")
async def share_dashboard(request: Request, dashboard_id: str, req: ShareDashboardRequest):
    """Update sharing settings for a dashboard"""
    db = request.app.state.db
    
    sharing = {
        "public": req.public,
        "password": req.password,
        "users": []
    }
    
    if req.user_ids:
        sharing["users"] = [{"user_id": uid, "role": req.role} for uid in req.user_ids]
    
    result = await db.dashboards.update_one(
        {"id": dashboard_id},
        {"$set": {"sharing": sharing, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Sharing settings updated"}


@router.get("/public/{dashboard_id}")
async def get_public_dashboard(request: Request, dashboard_id: str, password: Optional[str] = None):
    """Get a publicly shared dashboard"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    sharing = dashboard.get("sharing", {})
    
    if not sharing.get("public"):
        raise HTTPException(status_code=403, detail="Dashboard is not public")
    
    if sharing.get("password") and sharing["password"] != password:
        raise HTTPException(status_code=403, detail="Invalid password")
    
    return dashboard


# ============ Filter Options ============

@router.get("/{dashboard_id}/filter-options")
async def get_filter_options(request: Request, dashboard_id: str):
    """Get available filter options based on data"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    # Get data
    data = []
    if dashboard.get("snapshot_id"):
        snapshot = await db.snapshots.find_one({"id": dashboard["snapshot_id"]}, {"_id": 0})
        if snapshot:
            data = snapshot.get("data", [])
    elif dashboard.get("form_id"):
        submissions = await db.submissions.find(
            {"form_id": dashboard["form_id"], "status": "approved"},
            {"_id": 0, "data": 1}
        ).to_list(10000)
        data = [s.get("data", {}) for s in submissions]
    
    if not data:
        return {"filters": {}}
    
    import pandas as pd
    df = pd.DataFrame(data)
    
    # Get unique values for each filter
    filter_options = {}
    for filter_def in dashboard.get("filters", []):
        var = filter_def["variable"]
        if var in df.columns:
            unique_values = df[var].dropna().unique().tolist()
            filter_options[var] = {
                "label": filter_def.get("label", var),
                "type": filter_def.get("type", "select"),
                "options": sorted([str(v) for v in unique_values])[:50]  # Limit options
            }
    
    return {"filters": filter_options}


# Import pandas at module level
import pandas as pd
