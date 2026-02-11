"""DataPulse - Real-time Dashboard, Voice Input, and Geofencing Routes"""
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import json
import math
import asyncio

from auth import get_current_user

router = APIRouter(prefix="/realtime", tags=["Real-time Features"])


# ============= Real-time Dashboard =============

class DashboardWidget(BaseModel):
    """Dashboard widget configuration"""
    id: str
    type: str  # counter, chart, map, table, gauge
    title: str
    data_source: str  # submissions, quality, sensors, etc.
    filters: Dict[str, Any] = {}
    config: Dict[str, Any] = {}
    position: Dict[str, int] = {"x": 0, "y": 0, "w": 4, "h": 3}


class DashboardConfig(BaseModel):
    """Dashboard configuration"""
    name: str
    description: Optional[str] = None
    widgets: List[DashboardWidget]
    refresh_interval: int = 30  # seconds
    is_public: bool = False


@router.post("/dashboards")
async def create_dashboard(
    request: Request,
    config: DashboardConfig,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom real-time dashboard"""
    db = request.app.state.db
    
    dashboard = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "name": config.name,
        "description": config.description,
        "widgets": [w.model_dump() for w in config.widgets],
        "refresh_interval": config.refresh_interval,
        "is_public": config.is_public,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dashboards.insert_one(dashboard)
    
    return {"id": dashboard["id"], "message": "Dashboard created"}


@router.get("/dashboards")
async def list_dashboards(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all dashboards for an organization"""
    db = request.app.state.db
    
    dashboards = await db.dashboards.find(
        {"org_id": org_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"dashboards": dashboards}


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    request: Request,
    dashboard_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a dashboard with its current data"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return dashboard


@router.get("/dashboards/{dashboard_id}/data")
async def get_dashboard_data(
    request: Request,
    dashboard_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get real-time data for all widgets in a dashboard"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one({"id": dashboard_id}, {"_id": 0})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    widget_data = {}
    
    for widget in dashboard.get("widgets", []):
        widget_id = widget["id"]
        data_source = widget.get("data_source", "submissions")
        filters = widget.get("filters", {})
        
        try:
            if data_source == "submissions":
                # Get submission stats
                query = {}
                if filters.get("form_id"):
                    query["form_id"] = filters["form_id"]
                if filters.get("date_range"):
                    days = filters["date_range"]
                    query["submitted_at"] = {
                        "$gte": (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
                    }
                
                count = await db.submissions.count_documents(query)
                
                # Get trend data
                pipeline = [
                    {"$match": query},
                    {"$group": {
                        "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$toDate": "$submitted_at"}}},
                        "count": {"$sum": 1}
                    }},
                    {"$sort": {"_id": 1}},
                    {"$limit": 30}
                ]
                trend = await db.submissions.aggregate(pipeline).to_list(30)
                
                widget_data[widget_id] = {
                    "total": count,
                    "trend": [{"date": t["_id"], "value": t["count"]} for t in trend]
                }
                
            elif data_source == "quality":
                # Get quality stats
                pipeline = [
                    {"$match": filters},
                    {"$group": {
                        "_id": None,
                        "avg_score": {"$avg": "$quality_score"},
                        "total_checks": {"$sum": 1},
                        "critical_issues": {"$sum": "$critical_count"}
                    }}
                ]
                result = await db.quality_checks.aggregate(pipeline).to_list(1)
                widget_data[widget_id] = result[0] if result else {"avg_score": 0, "total_checks": 0}
                
            elif data_source == "locations":
                # Get GPS locations for map
                locations = await db.submissions.find(
                    {"data._gps": {"$exists": True}},
                    {"_id": 0, "id": 1, "data._gps": 1}
                ).limit(1000).to_list(1000)
                
                widget_data[widget_id] = {
                    "points": [
                        {
                            "id": loc["id"],
                            "lat": loc["data"]["_gps"].get("latitude"),
                            "lng": loc["data"]["_gps"].get("longitude")
                        }
                        for loc in locations
                        if loc.get("data", {}).get("_gps")
                    ]
                }
                
            else:
                widget_data[widget_id] = {"message": "Unknown data source"}
                
        except Exception as e:
            widget_data[widget_id] = {"error": str(e)}
    
    return {
        "dashboard_id": dashboard_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": widget_data
    }


@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(
    request: Request,
    dashboard_id: str,
    config: DashboardConfig,
    current_user: dict = Depends(get_current_user)
):
    """Update dashboard configuration"""
    db = request.app.state.db
    
    update_data = {
        "name": config.name,
        "description": config.description,
        "widgets": [w.model_dump() for w in config.widgets],
        "refresh_interval": config.refresh_interval,
        "is_public": config.is_public,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.dashboards.update_one(
        {"id": dashboard_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Dashboard updated"}


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(
    request: Request,
    dashboard_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a dashboard"""
    db = request.app.state.db
    
    result = await db.dashboards.delete_one({"id": dashboard_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    return {"message": "Dashboard deleted"}


# ============= Geofencing =============

class Geofence(BaseModel):
    """Geofence definition"""
    name: str
    description: Optional[str] = None
    type: str = "circle"  # circle, polygon
    center: Optional[Dict[str, float]] = None  # For circle: {lat, lng}
    radius: Optional[float] = None  # For circle: meters
    polygon: Optional[List[Dict[str, float]]] = None  # For polygon: [{lat, lng}, ...]
    action: str = "allow"  # allow, block, warn
    applies_to: List[str] = []  # Form IDs this applies to, empty = all


class GeofenceCheck(BaseModel):
    """Request to check if location is within geofences"""
    latitude: float
    longitude: float
    form_id: Optional[str] = None


@router.post("/geofences")
async def create_geofence(
    request: Request,
    geofence: Geofence,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a geofence"""
    db = request.app.state.db
    
    doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        **geofence.model_dump(),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.geofences.insert_one(doc)
    
    return {"id": doc["id"], "message": "Geofence created"}


@router.get("/geofences")
async def list_geofences(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all geofences for an organization"""
    db = request.app.state.db
    
    geofences = await db.geofences.find(
        {"org_id": org_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"geofences": geofences}


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def point_in_polygon(lat, lng, polygon):
    """Check if a point is inside a polygon using ray casting"""
    n = len(polygon)
    inside = False
    
    j = n - 1
    for i in range(n):
        if ((polygon[i]["lng"] > lng) != (polygon[j]["lng"] > lng)) and \
           (lat < (polygon[j]["lat"] - polygon[i]["lat"]) * (lng - polygon[i]["lng"]) / 
            (polygon[j]["lng"] - polygon[i]["lng"]) + polygon[i]["lat"]):
            inside = not inside
        j = i
    
    return inside


@router.post("/geofences/check")
async def check_geofence(
    request: Request,
    check: GeofenceCheck,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if a location is within any geofences"""
    db = request.app.state.db
    
    # Get applicable geofences
    query = {"org_id": org_id, "is_active": True}
    geofences = await db.geofences.find(query, {"_id": 0}).to_list(100)
    
    results = []
    overall_action = "allow"
    
    for fence in geofences:
        # Check if this geofence applies to the form
        if fence.get("applies_to") and check.form_id and check.form_id not in fence["applies_to"]:
            continue
        
        is_inside = False
        
        if fence["type"] == "circle" and fence.get("center") and fence.get("radius"):
            distance = haversine_distance(
                check.latitude, check.longitude,
                fence["center"]["lat"], fence["center"]["lng"]
            )
            is_inside = distance <= fence["radius"]
            
        elif fence["type"] == "polygon" and fence.get("polygon"):
            is_inside = point_in_polygon(check.latitude, check.longitude, fence["polygon"])
        
        if is_inside:
            results.append({
                "geofence_id": fence["id"],
                "name": fence["name"],
                "action": fence["action"],
                "inside": True
            })
            
            # Determine overall action (block > warn > allow)
            if fence["action"] == "block":
                overall_action = "block"
            elif fence["action"] == "warn" and overall_action != "block":
                overall_action = "warn"
    
    # If no geofences matched and there are blocking geofences, block
    blocking_fences = [f for f in geofences if f["action"] == "block"]
    if blocking_fences and not results:
        overall_action = "block"
        results.append({
            "geofence_id": None,
            "name": "Outside allowed areas",
            "action": "block",
            "inside": False
        })
    
    return {
        "location": {"lat": check.latitude, "lng": check.longitude},
        "overall_action": overall_action,
        "matched_geofences": results,
        "can_submit": overall_action != "block"
    }


@router.put("/geofences/{geofence_id}")
async def update_geofence(
    request: Request,
    geofence_id: str,
    geofence: Geofence,
    current_user: dict = Depends(get_current_user)
):
    """Update a geofence"""
    db = request.app.state.db
    
    update_data = {
        **geofence.model_dump(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.geofences.update_one(
        {"id": geofence_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    return {"message": "Geofence updated"}


@router.delete("/geofences/{geofence_id}")
async def delete_geofence(
    request: Request,
    geofence_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete (deactivate) a geofence"""
    db = request.app.state.db
    
    result = await db.geofences.update_one(
        {"id": geofence_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    return {"message": "Geofence deleted"}


# ============= Blockchain Verification =============

class BlockchainRecord(BaseModel):
    """Record for blockchain verification"""
    submission_id: str
    form_id: str
    data_hash: str
    timestamp: str
    previous_hash: Optional[str] = None


@router.post("/blockchain/record")
async def create_blockchain_record(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a blockchain-style immutable record for a submission"""
    db = request.app.state.db
    
    import hashlib
    
    # Get submission
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get previous record
    prev_records = await db.blockchain_records.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(1).to_list(1)
    
    prev_record = prev_records[0] if prev_records else None
    previous_hash = prev_record["block_hash"] if prev_record else "0" * 64
    
    # Create data hash
    data_str = json.dumps(submission.get("data", {}), sort_keys=True)
    data_hash = hashlib.sha256(data_str.encode()).hexdigest()
    
    # Create block hash
    block_content = f"{submission_id}{submission.get('form_id')}{data_hash}{previous_hash}{datetime.now(timezone.utc).isoformat()}"
    block_hash = hashlib.sha256(block_content.encode()).hexdigest()
    
    record = {
        "id": str(uuid.uuid4()),
        "submission_id": submission_id,
        "form_id": submission.get("form_id"),
        "data_hash": data_hash,
        "previous_hash": previous_hash,
        "block_hash": block_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["user_id"]
    }
    
    await db.blockchain_records.insert_one(record)
    
    # Update submission with blockchain reference
    await db.submissions.update_one(
        {"id": submission_id},
        {"$set": {"blockchain_record_id": record["id"], "blockchain_hash": block_hash}}
    )
    
    return {
        "record_id": record["id"],
        "block_hash": block_hash,
        "data_hash": data_hash,
        "message": "Blockchain record created"
    }


@router.get("/blockchain/verify/{submission_id}")
async def verify_blockchain_record(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify the integrity of a submission using blockchain record"""
    db = request.app.state.db
    
    import hashlib
    
    # Get submission
    submission = await db.submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get blockchain record
    record = await db.blockchain_records.find_one({"submission_id": submission_id}, {"_id": 0})
    if not record:
        return {
            "submission_id": submission_id,
            "verified": False,
            "message": "No blockchain record found"
        }
    
    # Verify data hash
    data_str = json.dumps(submission.get("data", {}), sort_keys=True)
    current_data_hash = hashlib.sha256(data_str.encode()).hexdigest()
    
    data_matches = current_data_hash == record["data_hash"]
    
    return {
        "submission_id": submission_id,
        "verified": data_matches,
        "block_hash": record["block_hash"],
        "data_hash_stored": record["data_hash"],
        "data_hash_current": current_data_hash,
        "data_integrity": "intact" if data_matches else "modified",
        "recorded_at": record["created_at"],
        "message": "Data integrity verified" if data_matches else "WARNING: Data has been modified since recording"
    }


@router.get("/blockchain/chain/{form_id}")
async def get_blockchain_chain(
    request: Request,
    form_id: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get the blockchain chain for a form's submissions"""
    db = request.app.state.db
    
    records = await db.blockchain_records.find(
        {"form_id": form_id},
        {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    
    # Verify chain integrity
    chain_valid = True
    for i in range(1, len(records)):
        if records[i]["previous_hash"] != records[i-1]["block_hash"]:
            chain_valid = False
            break
    
    return {
        "form_id": form_id,
        "chain_length": len(records),
        "chain_valid": chain_valid,
        "records": records
    }
