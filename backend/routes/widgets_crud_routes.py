"""DataPulse - Widgets CRUD Routes for Dashboard Builder"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/widgets", tags=["Dashboard Widgets"])


# ============ Models ============

class CreateWidgetRequest(BaseModel):
    dashboard_id: str
    type: str  # stat, chart, table, text
    title: str
    dataset_id: Optional[str] = None
    config: Dict[str, Any] = {}
    position: Dict[str, int] = {"x": 0, "y": 0, "w": 4, "h": 3}


class UpdateWidgetRequest(BaseModel):
    dashboard_id: str
    type: str
    title: str
    dataset_id: Optional[str] = None
    config: Dict[str, Any] = {}
    position: Dict[str, int] = {"x": 0, "y": 0, "w": 4, "h": 3}


# ============ Widget CRUD ============

@router.post("")
async def create_widget(request: Request, req: CreateWidgetRequest):
    """Create a new widget and add it to a dashboard"""
    db = request.app.state.db
    
    # Generate widget ID
    widget_id = str(uuid.uuid4())
    
    widget = {
        "id": widget_id,
        "type": req.type,
        "title": req.title,
        "dataset_id": req.dataset_id,
        "config": req.config,
        "position": req.position,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add widget to dashboard's widgets array
    result = await db.dashboards.update_one(
        {"id": req.dashboard_id},
        {
            "$push": {"widgets": widget},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"id": widget_id, "position": req.position, "message": "Widget created"}


@router.get("/{widget_id}/data")
async def get_widget_data(request: Request, widget_id: str):
    """Get data for a specific widget"""
    db = request.app.state.db
    
    # Find the dashboard containing this widget
    dashboard = await db.dashboards.find_one(
        {"widgets.id": widget_id},
        {"_id": 0, "widgets": 1, "form_id": 1, "snapshot_id": 1}
    )
    
    if not dashboard:
        return {"data": None, "error": "Widget not found"}
    
    # Find the specific widget
    widget = None
    for w in dashboard.get("widgets", []):
        if w.get("id") == widget_id:
            widget = w
            break
    
    if not widget:
        return {"data": None, "error": "Widget not found"}
    
    widget_type = widget.get("type", "stat")
    config = widget.get("config", {})
    dataset_id = widget.get("dataset_id")
    
    # Get data based on widget configuration
    data = None
    
    if dataset_id:
        # Get data from dataset
        dataset = await db.datasets.find_one({"id": dataset_id}, {"_id": 0})
        if dataset:
            data = await compute_widget_data(db, widget_type, config, dataset)
    elif dashboard.get("snapshot_id"):
        snapshot = await db.snapshots.find_one({"id": dashboard["snapshot_id"]}, {"_id": 0})
        if snapshot:
            data = {"source": "snapshot", "value": len(snapshot.get("data", []))}
    elif dashboard.get("form_id"):
        submissions_count = await db.submissions.count_documents({"form_id": dashboard["form_id"]})
        data = {"source": "form", "value": submissions_count}
    
    # Return computed or mock data
    if data is None:
        data = get_mock_widget_data(widget_type, config)
    
    return {"data": data}


async def compute_widget_data(db, widget_type: str, config: dict, dataset: dict):
    """Compute widget data from dataset"""
    field = config.get("field")
    aggregation = config.get("aggregation", "count")
    x_field = config.get("x_field")
    y_field = config.get("y_field")
    
    # Get dataset data
    rows = dataset.get("data", [])
    if not rows:
        return None
    
    if widget_type == "stat":
        if aggregation == "count":
            return {"value": len(rows), "aggregation": "count"}
        elif field and field in rows[0]:
            values = [r.get(field) for r in rows if r.get(field) is not None]
            numeric_values = [float(v) for v in values if isinstance(v, (int, float)) or (isinstance(v, str) and v.replace('.','').replace('-','').isdigit())]
            
            if numeric_values:
                if aggregation == "sum":
                    return {"value": sum(numeric_values), "aggregation": "sum"}
                elif aggregation == "mean":
                    return {"value": round(sum(numeric_values) / len(numeric_values), 2), "aggregation": "average"}
                elif aggregation == "max":
                    return {"value": max(numeric_values), "aggregation": "maximum"}
                elif aggregation == "min":
                    return {"value": min(numeric_values), "aggregation": "minimum"}
        return {"value": len(rows), "aggregation": "count"}
    
    elif widget_type == "chart":
        if x_field and x_field in rows[0]:
            # Group by x_field
            counts = {}
            for row in rows:
                key = str(row.get(x_field, "Unknown"))
                if y_field and y_field in row:
                    value = row.get(y_field, 0)
                    try:
                        value = float(value)
                    except (ValueError, TypeError):
                        value = 1
                    counts[key] = counts.get(key, 0) + value
                else:
                    counts[key] = counts.get(key, 0) + 1
            
            return [{"name": k, "value": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:10]]
        return []
    
    elif widget_type == "table":
        # Return first 10 rows
        return rows[:10]
    
    return None


def get_mock_widget_data(widget_type: str, config: dict):
    """Return mock data for widgets without a data source"""
    if widget_type == "stat":
        return {"value": 0, "aggregation": config.get("aggregation", "count")}
    elif widget_type == "chart":
        return []
    elif widget_type == "table":
        return []
    elif widget_type == "text":
        return {"content": config.get("content", "")}
    return None


@router.put("/{widget_id}")
async def update_widget(request: Request, widget_id: str, req: UpdateWidgetRequest):
    """Update a widget"""
    db = request.app.state.db
    
    # Update widget in the dashboard's widgets array
    result = await db.dashboards.update_one(
        {"id": req.dashboard_id, "widgets.id": widget_id},
        {
            "$set": {
                "widgets.$.type": req.type,
                "widgets.$.title": req.title,
                "widgets.$.dataset_id": req.dataset_id,
                "widgets.$.config": req.config,
                "widgets.$.position": req.position,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Widget or dashboard not found")
    
    return {"message": "Widget updated"}


@router.delete("/{widget_id}")
async def delete_widget(request: Request, widget_id: str):
    """Delete a widget from its dashboard"""
    db = request.app.state.db
    
    # Remove widget from dashboard's widgets array
    result = await db.dashboards.update_one(
        {"widgets.id": widget_id},
        {
            "$pull": {"widgets": {"id": widget_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Widget not found")
    
    return {"message": "Widget deleted"}
