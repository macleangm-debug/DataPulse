"""DataPulse - GPS Routes
Handles GPS data collection, visualization, and accuracy tracking
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/gps", tags=["GPS"])


class GPSPoint(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    altitude: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None
    timestamp: Optional[str] = None


class GPSSubmission(BaseModel):
    submission_id: str
    form_id: str
    project_id: str
    field_id: str
    gps: GPSPoint
    enumerator_id: str
    enumerator_name: Optional[str] = None


def get_db():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "datapulse")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


@router.post("/record")
async def record_gps_point(data: GPSSubmission):
    """Record a GPS point from a submission"""
    db = get_db()
    
    record = {
        "submission_id": data.submission_id,
        "form_id": data.form_id,
        "project_id": data.project_id,
        "field_id": data.field_id,
        "latitude": data.gps.latitude,
        "longitude": data.gps.longitude,
        "accuracy": data.gps.accuracy,
        "altitude": data.gps.altitude,
        "heading": data.gps.heading,
        "speed": data.gps.speed,
        "enumerator_id": data.enumerator_id,
        "enumerator_name": data.enumerator_name,
        "recorded_at": data.gps.timestamp or datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.gps_points.insert_one(record)
    
    return {"status": "recorded", "accuracy": data.gps.accuracy}


@router.get("/points")
async def get_gps_points(
    org_id: str,
    project_id: Optional[str] = None,
    form_id: Optional[str] = None,
    enumerator_id: Optional[str] = None,
    days: int = Query(default=7, le=90),
    limit: int = Query(default=1000, le=5000)
):
    """Get GPS points for map visualization"""
    db = get_db()
    
    # Build query
    query = {}
    
    if project_id:
        query["project_id"] = project_id
    if form_id:
        query["form_id"] = form_id
    if enumerator_id:
        query["enumerator_id"] = enumerator_id
    
    # Date filter
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query["created_at"] = {"$gte": cutoff.isoformat()}
    
    # Get points
    points = await db.gps_points.find(
        query,
        {
            "_id": 0,
            "latitude": 1,
            "longitude": 1,
            "accuracy": 1,
            "enumerator_name": 1,
            "submission_id": 1,
            "recorded_at": 1
        }
    ).sort("recorded_at", -1).limit(limit).to_list(limit)
    
    return {
        "points": points,
        "count": len(points),
        "bounds": calculate_bounds(points) if points else None
    }


@router.get("/clusters")
async def get_gps_clusters(
    org_id: str,
    project_id: Optional[str] = None,
    days: int = Query(default=7, le=90),
    grid_size: float = Query(default=0.01, description="Grid size in degrees for clustering")
):
    """Get clustered GPS points for efficient map rendering"""
    db = get_db()
    
    query = {}
    if project_id:
        query["project_id"] = project_id
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query["created_at"] = {"$gte": cutoff.isoformat()}
    
    # Aggregation pipeline for clustering
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": {
                    "lat_grid": {"$floor": {"$divide": ["$latitude", grid_size]}},
                    "lng_grid": {"$floor": {"$divide": ["$longitude", grid_size]}}
                },
                "count": {"$sum": 1},
                "avg_lat": {"$avg": "$latitude"},
                "avg_lng": {"$avg": "$longitude"},
                "avg_accuracy": {"$avg": "$accuracy"},
                "submissions": {"$push": "$submission_id"}
            }
        },
        {
            "$project": {
                "_id": 0,
                "latitude": "$avg_lat",
                "longitude": "$avg_lng",
                "count": 1,
                "avg_accuracy": 1,
                "submission_count": {"$size": "$submissions"}
            }
        }
    ]
    
    clusters = await db.gps_points.aggregate(pipeline).to_list(1000)
    
    return {
        "clusters": clusters,
        "total_points": sum(c["count"] for c in clusters),
        "cluster_count": len(clusters)
    }


@router.get("/coverage")
async def get_coverage_stats(
    org_id: str,
    project_id: Optional[str] = None,
    days: int = Query(default=30, le=90)
):
    """Get GPS coverage statistics"""
    db = get_db()
    
    query = {}
    if project_id:
        query["project_id"] = project_id
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query["created_at"] = {"$gte": cutoff.isoformat()}
    
    # Accuracy distribution
    pipeline = [
        {"$match": query},
        {
            "$bucket": {
                "groupBy": "$accuracy",
                "boundaries": [0, 10, 25, 50, 100, 500, float("inf")],
                "default": "unknown",
                "output": {
                    "count": {"$sum": 1}
                }
            }
        }
    ]
    
    accuracy_dist = await db.gps_points.aggregate(pipeline).to_list(10)
    
    # Total stats
    total = await db.gps_points.count_documents(query)
    
    # Enumerator coverage
    enum_pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": "$enumerator_id",
                "name": {"$first": "$enumerator_name"},
                "point_count": {"$sum": 1},
                "avg_accuracy": {"$avg": "$accuracy"}
            }
        },
        {"$sort": {"point_count": -1}},
        {"$limit": 20}
    ]
    
    enumerator_stats = await db.gps_points.aggregate(enum_pipeline).to_list(20)
    
    return {
        "total_points": total,
        "accuracy_distribution": accuracy_dist,
        "enumerator_coverage": enumerator_stats,
        "period_days": days
    }


def calculate_bounds(points: List[dict]) -> dict:
    """Calculate bounding box for a list of GPS points"""
    if not points:
        return None
    
    lats = [p["latitude"] for p in points if p.get("latitude")]
    lngs = [p["longitude"] for p in points if p.get("longitude")]
    
    if not lats or not lngs:
        return None
    
    return {
        "north": max(lats),
        "south": min(lats),
        "east": max(lngs),
        "west": min(lngs),
        "center": {
            "latitude": sum(lats) / len(lats),
            "longitude": sum(lngs) / len(lngs)
        }
    }
