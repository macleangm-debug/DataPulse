"""DataPulse - Cascading Selects and Advanced Field Types Routes"""
from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from auth import get_current_user

router = APIRouter(prefix="/advanced-fields", tags=["Advanced Fields"])


# ============= Cascading Selects =============

class CascadeLevel(BaseModel):
    """Single level in a cascade hierarchy"""
    field_name: str
    label: str
    parent_field: Optional[str] = None  # None for root level
    dataset_id: Optional[str] = None  # For dataset-backed cascades
    filter_field: Optional[str] = None  # Field to filter by parent value
    options: Optional[List[Dict[str, Any]]] = None  # For inline options


class CascadeConfig(BaseModel):
    """Configuration for cascading select fields"""
    name: str
    description: Optional[str] = None
    levels: List[CascadeLevel]
    allow_other: bool = False  # Allow "Other" option at any level
    search_enabled: bool = True


class CascadeOptionFilter(BaseModel):
    """Filter for getting cascade options"""
    parent_value: Optional[str] = None
    search_query: Optional[str] = None
    limit: int = 100


@router.post("/cascades")
async def create_cascade_config(
    request: Request,
    config: CascadeConfig,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a reusable cascade configuration"""
    db = request.app.state.db
    
    cascade_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "name": config.name,
        "description": config.description,
        "levels": [level.model_dump() for level in config.levels],
        "allow_other": config.allow_other,
        "search_enabled": config.search_enabled,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.cascade_configs.insert_one(cascade_doc)
    
    return {"id": cascade_doc["id"], "message": "Cascade configuration created"}


@router.get("/cascades")
async def list_cascade_configs(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all cascade configurations for an organization"""
    db = request.app.state.db
    
    configs = await db.cascade_configs.find(
        {"org_id": org_id}, 
        {"_id": 0}
    ).to_list(100)
    
    return {"configs": configs}


@router.get("/cascades/{config_id}")
async def get_cascade_config(
    request: Request,
    config_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific cascade configuration"""
    db = request.app.state.db
    
    config = await db.cascade_configs.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Cascade config not found")
    
    return config


@router.get("/cascades/{config_id}/options")
async def get_cascade_options(
    request: Request,
    config_id: str,
    level_index: int = 0,
    parent_value: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get options for a specific cascade level, filtered by parent selection"""
    db = request.app.state.db
    
    config = await db.cascade_configs.find_one({"id": config_id}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Cascade config not found")
    
    if level_index >= len(config["levels"]):
        raise HTTPException(status_code=400, detail="Invalid level index")
    
    level = config["levels"][level_index]
    options = []
    
    # If options are inline
    if level.get("options"):
        options = level["options"]
        
        # Filter by parent value
        if parent_value and level_index > 0:
            parent_field = config["levels"][level_index - 1]["field_name"]
            options = [o for o in options if o.get("parent_value") == parent_value]
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            options = [o for o in options if search_lower in o.get("label", "").lower()]
        
    # If backed by a dataset
    elif level.get("dataset_id"):
        dataset = await db.datasets.find_one({"id": level["dataset_id"]}, {"_id": 0})
        if dataset:
            query = {}
            
            # Filter by parent value
            if parent_value and level.get("filter_field"):
                query[level["filter_field"]] = parent_value
            
            # Apply search
            if search and dataset.get("searchable_fields"):
                search_conditions = []
                for field in dataset["searchable_fields"]:
                    search_conditions.append({field: {"$regex": search, "$options": "i"}})
                if search_conditions:
                    query["$or"] = search_conditions
            
            records = await db[f"dataset_{level['dataset_id']}"].find(
                query, {"_id": 0}
            ).limit(limit).to_list(limit)
            
            # Convert to options format
            value_field = dataset.get("value_field", "id")
            display_field = dataset.get("display_field", "name")
            options = [
                {"value": r.get(value_field), "label": r.get(display_field, r.get(value_field))}
                for r in records
            ]
    
    return {"options": options[:limit], "level": level["field_name"]}


@router.put("/cascades/{config_id}")
async def update_cascade_config(
    request: Request,
    config_id: str,
    config: CascadeConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update a cascade configuration"""
    db = request.app.state.db
    
    update_data = {
        "name": config.name,
        "description": config.description,
        "levels": [l.model_dump() for l in config.levels],
        "allow_other": config.allow_other,
        "search_enabled": config.search_enabled,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.cascade_configs.update_one(
        {"id": config_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cascade config not found")
    
    return {"message": "Cascade configuration updated"}


@router.delete("/cascades/{config_id}")
async def delete_cascade_config(
    request: Request,
    config_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a cascade configuration"""
    db = request.app.state.db
    
    result = await db.cascade_configs.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cascade config not found")
    
    return {"message": "Cascade configuration deleted"}


# ============= Sensor Metadata Collection =============

class SensorMetadata(BaseModel):
    """Device sensor metadata captured during submission"""
    submission_id: str
    form_id: str
    timestamp: str
    device_info: Dict[str, Any]  # Model, OS, version
    battery: Optional[Dict[str, Any]] = None  # Level, charging status
    location: Optional[Dict[str, Any]] = None  # GPS data
    accelerometer: Optional[Dict[str, Any]] = None  # Movement data
    network: Optional[Dict[str, Any]] = None  # Connection type, quality
    screen: Optional[Dict[str, Any]] = None  # Orientation, brightness


class SensorConfig(BaseModel):
    """Configuration for sensor data collection"""
    form_id: str
    collect_battery: bool = True
    collect_gps: bool = True
    collect_accelerometer: bool = False
    collect_network: bool = True
    gps_interval_seconds: int = 30
    accelerometer_sample_rate: int = 10  # Hz


@router.post("/sensors/metadata")
async def record_sensor_metadata(
    request: Request,
    metadata: SensorMetadata,
    current_user: dict = Depends(get_current_user)
):
    """Record sensor metadata for a submission"""
    db = request.app.state.db
    
    doc = {
        "id": str(uuid.uuid4()),
        **metadata.model_dump(),
        "recorded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sensor_metadata.insert_one(doc)
    
    # Update submission with sensor summary
    sensor_summary = {
        "has_sensor_data": True,
        "battery_level": metadata.battery.get("level") if metadata.battery else None,
        "location_accuracy": metadata.location.get("accuracy") if metadata.location else None,
        "network_type": metadata.network.get("type") if metadata.network else None
    }
    
    await db.submissions.update_one(
        {"id": metadata.submission_id},
        {"$set": {"sensor_metadata": sensor_summary}}
    )
    
    return {"id": doc["id"], "message": "Sensor metadata recorded"}


@router.get("/sensors/metadata/{submission_id}")
async def get_sensor_metadata(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all sensor metadata for a submission"""
    db = request.app.state.db
    
    metadata_list = await db.sensor_metadata.find(
        {"submission_id": submission_id},
        {"_id": 0}
    ).to_list(1000)
    
    return {"metadata": metadata_list}


@router.get("/sensors/config/{form_id}")
async def get_sensor_config(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get sensor collection config for a form"""
    db = request.app.state.db
    
    config = await db.sensor_configs.find_one({"form_id": form_id}, {"_id": 0})
    
    # Return default config if none exists
    if not config:
        config = {
            "form_id": form_id,
            "collect_battery": True,
            "collect_gps": True,
            "collect_accelerometer": False,
            "collect_network": True,
            "gps_interval_seconds": 30,
            "accelerometer_sample_rate": 10
        }
    
    return config


@router.put("/sensors/config/{form_id}")
async def update_sensor_config(
    request: Request,
    form_id: str,
    config: SensorConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update sensor collection config for a form"""
    db = request.app.state.db
    
    config_doc = {
        "form_id": form_id,
        **config.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sensor_configs.update_one(
        {"form_id": form_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"message": "Sensor config updated"}


# ============= Movement Quality Analysis =============

@router.get("/sensors/movement-analysis/{submission_id}")
async def analyze_movement(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Analyze movement patterns during data collection for quality checks"""
    db = request.app.state.db
    
    metadata_list = await db.sensor_metadata.find(
        {"submission_id": submission_id},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(1000)
    
    if not metadata_list:
        return {
            "submission_id": submission_id,
            "analysis": None,
            "message": "No sensor data available"
        }
    
    # Calculate movement metrics
    gps_points = []
    accelerometer_samples = []
    
    for m in metadata_list:
        if m.get("location"):
            gps_points.append(m["location"])
        if m.get("accelerometer"):
            accelerometer_samples.append(m["accelerometer"])
    
    analysis = {
        "total_samples": len(metadata_list),
        "gps_points_count": len(gps_points),
        "accelerometer_samples": len(accelerometer_samples),
        "location_changes": 0,
        "stationary_percentage": 100,
        "quality_flags": []
    }
    
    # Analyze GPS movement
    if len(gps_points) >= 2:
        location_changes = 0
        for i in range(1, len(gps_points)):
            lat_diff = abs(gps_points[i].get("latitude", 0) - gps_points[i-1].get("latitude", 0))
            lon_diff = abs(gps_points[i].get("longitude", 0) - gps_points[i-1].get("longitude", 0))
            if lat_diff > 0.0001 or lon_diff > 0.0001:  # Roughly 10m movement
                location_changes += 1
        
        analysis["location_changes"] = location_changes
        analysis["stationary_percentage"] = round((1 - location_changes / len(gps_points)) * 100, 1)
        
        # Quality flags
        if analysis["stationary_percentage"] < 50:
            analysis["quality_flags"].append({
                "flag": "high_mobility",
                "severity": "warning",
                "message": "Enumerator moved significantly during survey"
            })
    
    return {
        "submission_id": submission_id,
        "analysis": analysis
    }
