"""DataPulse - Data Sources API Routes
Provides unified access to data sources for visualization components.
"""

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

from auth import get_current_user, get_optional_user

router = APIRouter(prefix="/data-sources", tags=["Data Sources"])


class DataSourceInfo(BaseModel):
    id: str
    name: str
    type: str  # 'form', 'dataset', 'snapshot'
    description: Optional[str] = None
    record_count: int = 0
    fields: List[Dict[str, Any]] = []
    last_updated: Optional[str] = None


@router.get("")
async def list_data_sources(
    request: Request,
    org_id: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),  # 'form', 'dataset', 'all'
    current_user: dict = Depends(get_optional_user)
):
    """List all available data sources (forms, datasets) for visualization"""
    db = request.app.state.db
    
    sources = []
    
    # Get forms with submissions
    # Note: We show all forms regardless of org for now to enable cross-org data access
    if source_type in [None, 'all', 'form']:
        query = {}
        # Only filter by org_id if explicitly requested AND org_id is not empty/None
        if org_id and org_id.strip():
            query["org_id"] = org_id
        
        forms_cursor = db.forms.find(query, {"_id": 0})
        forms = await forms_cursor.to_list(length=100)
        
        for form in forms:
            # Count submissions for this form
            sub_count = await db.submissions.count_documents({"form_id": form.get("id")})
            
            # Extract fields from form
            fields = []
            for field in form.get("fields", []):
                fields.append({
                    "name": field.get("name") or field.get("id"),
                    "label": field.get("label") or field.get("name"),
                    "type": field.get("type", "text"),
                    "options": field.get("options", [])
                })
            
            sources.append({
                "id": form.get("id"),
                "name": form.get("name", "Untitled Form"),
                "type": "form",
                "description": form.get("description", ""),
                "record_count": sub_count,
                "fields": fields,
                "last_updated": form.get("updated_at") or form.get("created_at"),
                "project_id": form.get("project_id")
            })
    
    # Get datasets
    if source_type in [None, 'all', 'dataset']:
        query = {}
        # Only filter by org_id if explicitly requested AND org_id is not empty/None
        if org_id and org_id.strip():
            query["org_id"] = org_id
        
        datasets_cursor = db.datasets.find(query, {"_id": 0})
        datasets = await datasets_cursor.to_list(length=100)
        
        for dataset in datasets:
            # Count records
            record_count = await db.dataset_records.count_documents({"dataset_id": dataset.get("id")})
            
            sources.append({
                "id": dataset.get("id"),
                "name": dataset.get("name", "Untitled Dataset"),
                "type": "dataset",
                "description": dataset.get("description", ""),
                "record_count": record_count,
                "fields": dataset.get("columns", []),
                "last_updated": dataset.get("updated_at") or dataset.get("created_at"),
                "dataset_type": dataset.get("dataset_type", "custom")
            })
    
    # Get snapshots (saved data states)
    if source_type in [None, 'all', 'snapshot']:
        query = {}
        if org_id:
            query["org_id"] = org_id
        
        snapshots_cursor = db.snapshots.find(query, {"_id": 0})
        snapshots = await snapshots_cursor.to_list(length=50)
        
        for snapshot in snapshots:
            data = snapshot.get("data", [])
            sources.append({
                "id": snapshot.get("id"),
                "name": snapshot.get("name", "Untitled Snapshot"),
                "type": "snapshot",
                "description": snapshot.get("description", ""),
                "record_count": len(data),
                "fields": snapshot.get("schema", []),
                "last_updated": snapshot.get("created_at")
            })
    
    return {
        "sources": sources,
        "total": len(sources)
    }


@router.get("/{source_id}/data")
async def get_source_data(
    request: Request,
    source_id: str,
    source_type: str = Query(...),  # 'form', 'dataset', 'snapshot'
    limit: int = Query(1000, le=10000),
    offset: int = Query(0),
    filters: Optional[str] = Query(None),  # JSON string of filters
    current_user: dict = Depends(get_optional_user)
):
    """Get data from a specific source for visualization"""
    db = request.app.state.db
    
    data = []
    schema = []
    total = 0
    
    import json as json_lib
    filter_dict = {}
    if filters:
        try:
            filter_dict = json_lib.loads(filters)
        except (json_lib.JSONDecodeError, ValueError):
            pass
    
    if source_type == "form":
        # Get form submissions
        form = await db.forms.find_one({"id": source_id}, {"_id": 0})
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        query = {"form_id": source_id}
        if filter_dict:
            for key, value in filter_dict.items():
                query[f"data.{key}"] = value
        
        total = await db.submissions.count_documents(query)
        submissions_cursor = db.submissions.find(query, {"_id": 0}).skip(offset).limit(limit)
        submissions = await submissions_cursor.to_list(length=limit)
        
        # Flatten submission data
        for sub in submissions:
            record = sub.get("data", {})
            record["_submission_id"] = sub.get("id")
            record["_submitted_at"] = sub.get("submitted_at")
            record["_submitted_by"] = sub.get("submitted_by")
            record["_status"] = sub.get("status", "pending")
            data.append(record)
        
        # Build schema from form fields
        schema = [
            {"name": "_submission_id", "label": "Submission ID", "type": "text"},
            {"name": "_submitted_at", "label": "Submitted At", "type": "datetime"},
            {"name": "_status", "label": "Status", "type": "select"}
        ]
        for field in form.get("fields", []):
            schema.append({
                "name": field.get("name") or field.get("id"),
                "label": field.get("label") or field.get("name"),
                "type": field.get("type", "text"),
                "options": field.get("options", [])
            })
    
    elif source_type == "dataset":
        # Get dataset records
        dataset = await db.datasets.find_one({"id": source_id}, {"_id": 0})
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        query = {"dataset_id": source_id}
        if filter_dict:
            for key, value in filter_dict.items():
                query[f"data.{key}"] = value
        
        total = await db.dataset_records.count_documents(query)
        records_cursor = db.dataset_records.find(query, {"_id": 0}).skip(offset).limit(limit)
        records = await records_cursor.to_list(length=limit)
        
        for record in records:
            rec_data = record.get("data", {})
            rec_data["_record_id"] = record.get("id")
            data.append(rec_data)
        
        schema = dataset.get("columns", [])
    
    elif source_type == "snapshot":
        # Get snapshot data
        snapshot = await db.snapshots.find_one({"id": source_id}, {"_id": 0})
        if not snapshot:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        
        all_data = snapshot.get("data", [])
        total = len(all_data)
        data = all_data[offset:offset + limit]
        schema = snapshot.get("schema", [])
    
    else:
        raise HTTPException(status_code=400, detail="Invalid source_type")
    
    return {
        "data": data,
        "schema": schema,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{source_id}/aggregate")
async def aggregate_source_data(
    request: Request,
    source_id: str,
    source_type: str = Query(...),
    group_by: str = Query(...),
    metric: str = Query("count"),  # count, sum, avg, min, max
    metric_field: Optional[str] = Query(None),
    current_user: dict = Depends(get_optional_user)
):
    """Aggregate data for charts"""
    # Get the raw data first
    data_response = await get_source_data(
        request=request,
        source_id=source_id,
        source_type=source_type,
        limit=10000,
        offset=0,
        filters=None,
        current_user=current_user
    )
    
    raw_data = data_response.get("data", [])
    
    if not raw_data:
        return {"aggregated": [], "labels": [], "values": []}
    
    # Perform aggregation
    import pandas as pd
    df = pd.DataFrame(raw_data)
    
    if group_by not in df.columns:
        return {"aggregated": [], "labels": [], "values": [], "error": f"Field '{group_by}' not found"}
    
    aggregated = []
    
    if metric == "count":
        grouped = df.groupby(group_by).size().reset_index(name='value')
    elif metric in ["sum", "avg", "min", "max"] and metric_field:
        if metric_field not in df.columns:
            return {"aggregated": [], "error": f"Metric field '{metric_field}' not found"}
        
        # Convert to numeric if possible
        df[metric_field] = pd.to_numeric(df[metric_field], errors='coerce')
        
        if metric == "sum":
            grouped = df.groupby(group_by)[metric_field].sum().reset_index(name='value')
        elif metric == "avg":
            grouped = df.groupby(group_by)[metric_field].mean().reset_index(name='value')
        elif metric == "min":
            grouped = df.groupby(group_by)[metric_field].min().reset_index(name='value')
        elif metric == "max":
            grouped = df.groupby(group_by)[metric_field].max().reset_index(name='value')
    else:
        grouped = df.groupby(group_by).size().reset_index(name='value')
    
    labels = grouped[group_by].fillna("Unknown").tolist()
    values = grouped['value'].fillna(0).tolist()
    
    aggregated = [{"name": str(label), "value": float(val)} for label, val in zip(labels, values)]
    
    return {
        "aggregated": aggregated,
        "labels": labels,
        "values": values,
        "group_by": group_by,
        "metric": metric,
        "total_records": len(raw_data)
    }


@router.get("/{source_id}/fields")
async def get_source_fields(
    request: Request,
    source_id: str,
    source_type: str = Query(...),
    current_user: dict = Depends(get_optional_user)
):
    """Get fields/schema for a data source"""
    db = request.app.state.db
    
    if source_type == "form":
        form = await db.forms.find_one({"id": source_id}, {"_id": 0})
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        fields = [
            {"name": "_submission_id", "label": "Submission ID", "type": "text"},
            {"name": "_submitted_at", "label": "Submitted At", "type": "datetime"},
            {"name": "_status", "label": "Status", "type": "select", "options": ["pending", "approved", "rejected"]}
        ]
        for field in form.get("fields", []):
            fields.append({
                "name": field.get("name") or field.get("id"),
                "label": field.get("label") or field.get("name"),
                "type": field.get("type", "text"),
                "options": field.get("options", [])
            })
        
        return {"fields": fields, "form_name": form.get("name")}
    
    elif source_type == "dataset":
        dataset = await db.datasets.find_one({"id": source_id}, {"_id": 0})
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        return {"fields": dataset.get("columns", []), "dataset_name": dataset.get("name")}
    
    elif source_type == "snapshot":
        snapshot = await db.snapshots.find_one({"id": source_id}, {"_id": 0})
        if not snapshot:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        
        return {"fields": snapshot.get("schema", []), "snapshot_name": snapshot.get("name")}
    
    raise HTTPException(status_code=400, detail="Invalid source_type")


@router.get("/{source_id}/stats")
async def get_source_stats(
    request: Request,
    source_id: str,
    source_type: str = Query(...),
    current_user: dict = Depends(get_optional_user)
):
    """Get statistics summary for a data source"""
    # Get data
    data_response = await get_source_data(
        request=request,
        source_id=source_id,
        source_type=source_type,
        limit=10000,
        offset=0,
        filters=None,
        current_user=current_user
    )
    
    raw_data = data_response.get("data", [])
    schema = data_response.get("schema", [])
    
    if not raw_data:
        return {"stats": {}, "record_count": 0}
    
    import pandas as pd
    df = pd.DataFrame(raw_data)
    
    stats = {
        "record_count": len(df),
        "fields": {}
    }
    
    for field in schema:
        field_name = field.get("name")
        if field_name and field_name in df.columns:
            field_stats = {
                "non_null": int(df[field_name].notna().sum()),
                "unique": int(df[field_name].nunique())
            }
            
            # Numeric stats
            if df[field_name].dtype in ['int64', 'float64']:
                field_stats["min"] = float(df[field_name].min()) if not pd.isna(df[field_name].min()) else None
                field_stats["max"] = float(df[field_name].max()) if not pd.isna(df[field_name].max()) else None
                field_stats["mean"] = float(df[field_name].mean()) if not pd.isna(df[field_name].mean()) else None
                field_stats["sum"] = float(df[field_name].sum()) if not pd.isna(df[field_name].sum()) else None
            
            # Top values for categorical
            if df[field_name].dtype == 'object' or field.get("type") in ["select", "radio", "checkbox"]:
                value_counts = df[field_name].value_counts().head(5).to_dict()
                field_stats["top_values"] = [{"value": str(k), "count": int(v)} for k, v in value_counts.items()]
            
            stats["fields"][field_name] = field_stats
    
    return stats
