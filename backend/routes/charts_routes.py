"""DataPulse - Charts Routes
Chart management for visualizations
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/charts", tags=["Charts"])


# ============ Models ============

class ChartConfig(BaseModel):
    type: str  # bar, line, pie, scatter, heatmap, etc.
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    series: Optional[List[str]] = None
    aggregation: Optional[str] = None  # sum, count, avg, etc.
    filters: Optional[Dict[str, Any]] = None
    colors: Optional[List[str]] = None
    title: Optional[str] = None
    legend: bool = True
    stacked: bool = False


class CreateChartRequest(BaseModel):
    org_id: str
    dataset_id: str
    name: str
    description: Optional[str] = None
    config: ChartConfig


class UpdateChartRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[ChartConfig] = None


# ============ Endpoints ============

@router.get("")
async def list_charts(request: Request, org_id: str = Query(None)):
    """List all charts for an organization"""
    db = request.app.state.db
    
    if not org_id:
        return {"charts": [], "total": 0}
    
    charts = await db.charts.find(
        {"org_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"charts": charts, "total": len(charts)}


@router.post("")
async def create_chart(request: Request, chart: CreateChartRequest):
    """Create a new chart"""
    db = request.app.state.db
    
    chart_doc = {
        "id": str(uuid.uuid4()),
        "org_id": chart.org_id,
        "dataset_id": chart.dataset_id,
        "name": chart.name,
        "description": chart.description,
        "config": chart.config.model_dump(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.charts.insert_one(chart_doc)
    
    return {"id": chart_doc["id"], "message": "Chart created successfully"}


@router.get("/{chart_id}")
async def get_chart(request: Request, chart_id: str, org_id: str = Query(None)):
    """Get a specific chart"""
    db = request.app.state.db
    
    query = {"id": chart_id}
    if org_id:
        query["org_id"] = org_id
    
    chart = await db.charts.find_one(query, {"_id": 0})
    
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    return chart


@router.put("/{chart_id}")
async def update_chart(request: Request, chart_id: str, update: UpdateChartRequest, org_id: str = Query(None)):
    """Update a chart"""
    db = request.app.state.db
    
    query = {"id": chart_id}
    if org_id:
        query["org_id"] = org_id
    
    chart = await db.charts.find_one(query)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    update_data = {}
    if update.name:
        update_data["name"] = update.name
    if update.description:
        update_data["description"] = update.description
    if update.config:
        update_data["config"] = update.config.model_dump()
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.charts.update_one(query, {"$set": update_data})
    
    return {"message": "Chart updated successfully"}


@router.delete("/{chart_id}")
async def delete_chart(request: Request, chart_id: str, org_id: str = Query(None)):
    """Delete a chart"""
    db = request.app.state.db
    
    query = {"id": chart_id}
    if org_id:
        query["org_id"] = org_id
    
    result = await db.charts.delete_one(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    return {"message": "Chart deleted successfully"}


@router.get("/{chart_id}/data")
async def get_chart_data(request: Request, chart_id: str, org_id: str = Query(None)):
    """Get data for a chart (executes the query and returns results)"""
    db = request.app.state.db
    
    query = {"id": chart_id}
    if org_id:
        query["org_id"] = org_id
    
    chart = await db.charts.find_one(query, {"_id": 0})
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    # Get dataset data
    dataset = await db.datasets.find_one({"id": chart.get("dataset_id")}, {"_id": 0})
    if not dataset:
        return {"data": [], "message": "Dataset not found"}
    
    # Get records from dataset
    records = await db.dataset_records.find(
        {"dataset_id": chart.get("dataset_id")},
        {"_id": 0}
    ).limit(1000).to_list(1000)
    
    return {"data": records, "chart": chart, "dataset": dataset}


@router.get("/{chart_id}/drill-options")
async def get_drill_options(request: Request, chart_id: str, org_id: str = Query(None)):
    """Get drill-down options for a chart"""
    db = request.app.state.db
    
    query = {"id": chart_id}
    if org_id:
        query["org_id"] = org_id
    
    chart = await db.charts.find_one(query, {"_id": 0})
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    # Get dataset schema to determine drill options
    dataset = await db.datasets.find_one({"id": chart.get("dataset_id")}, {"_id": 0})
    
    drill_options = []
    if dataset and dataset.get("schema"):
        for field in dataset.get("schema", []):
            drill_options.append({
                "field": field.get("name"),
                "type": field.get("type"),
                "label": field.get("label", field.get("name"))
            })
    
    return {"drill_options": drill_options, "current_config": chart.get("config")}
