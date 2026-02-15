"""DataPulse - Audit Trail Routes

Comprehensive audit logging for exports, transformations, and dashboard actions.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime, timezone
from enum import Enum
import uuid

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


class AuditAction(str, Enum):
    # Data exports
    EXPORT_CSV = "export_csv"
    EXPORT_EXCEL = "export_excel"
    EXPORT_SPSS = "export_spss"
    EXPORT_STATA = "export_stata"
    EXPORT_PARQUET = "export_parquet"
    EXPORT_CODEBOOK = "export_codebook"
    
    # Data transformations
    TRANSFORM_RECODE = "transform_recode"
    TRANSFORM_COMPUTE = "transform_compute"
    TRANSFORM_IMPUTE = "transform_impute"
    TRANSFORM_MERGE = "transform_merge"
    TRANSFORM_RESHAPE = "transform_reshape"
    
    # Snapshots
    SNAPSHOT_CREATE = "snapshot_create"
    SNAPSHOT_DELETE = "snapshot_delete"
    
    # Dashboards
    DASHBOARD_CREATE = "dashboard_create"
    DASHBOARD_UPDATE = "dashboard_update"
    DASHBOARD_DELETE = "dashboard_delete"
    DASHBOARD_SHARE = "dashboard_share"
    DASHBOARD_PUBLISH = "dashboard_publish"
    
    # Reports
    REPORT_CREATE = "report_create"
    REPORT_GENERATE = "report_generate"
    REPORT_EXPORT = "report_export"
    
    # Analysis
    ANALYSIS_RUN = "analysis_run"
    
    # Access
    DATA_VIEW = "data_view"
    PII_ACCESS = "pii_access"


class AuditLogEntry(BaseModel):
    org_id: str
    user_id: str
    user_email: Optional[str] = None
    action: AuditAction
    resource_type: str  # e.g., "form", "snapshot", "dashboard"
    resource_id: str
    resource_name: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLogFilter(BaseModel):
    org_id: str
    action: Optional[AuditAction] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    user_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    page: int = 1
    page_size: int = 50


@router.post("/log")
async def create_audit_log(
    request: Request,
    entry: AuditLogEntry
):
    """Create a new audit log entry"""
    db = request.app.state.db
    
    log_record = {
        "id": str(uuid.uuid4()),
        "org_id": entry.org_id,
        "user_id": entry.user_id,
        "user_email": entry.user_email,
        "action": entry.action.value,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "resource_name": entry.resource_name,
        "details": entry.details or {},
        "ip_address": entry.ip_address or request.client.host if request.client else None,
        "user_agent": entry.user_agent or request.headers.get("user-agent"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.audit_logs.insert_one(log_record)
    
    return {"id": log_record["id"], "created_at": log_record["created_at"]}


@router.post("/logs")
async def get_audit_logs(
    request: Request,
    filter_params: AuditLogFilter
):
    """Get audit logs with filtering and pagination"""
    db = request.app.state.db
    
    # Build query
    query = {"org_id": filter_params.org_id}
    
    if filter_params.action:
        query["action"] = filter_params.action.value
    if filter_params.resource_type:
        query["resource_type"] = filter_params.resource_type
    if filter_params.resource_id:
        query["resource_id"] = filter_params.resource_id
    if filter_params.user_id:
        query["user_id"] = filter_params.user_id
    if filter_params.start_date:
        query["created_at"] = {"$gte": filter_params.start_date}
    if filter_params.end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = filter_params.end_date
        else:
            query["created_at"] = {"$lte": filter_params.end_date}
    
    # Count total
    total = await db.audit_logs.count_documents(query)
    
    # Get paginated results
    skip = (filter_params.page - 1) * filter_params.page_size
    logs = await db.audit_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(filter_params.page_size).to_list(None)
    
    return {
        "total": total,
        "page": filter_params.page,
        "page_size": filter_params.page_size,
        "total_pages": (total + filter_params.page_size - 1) // filter_params.page_size,
        "logs": logs
    }


@router.get("/summary/{org_id}")
async def get_audit_summary(
    request: Request,
    org_id: str,
    days: int = 30
):
    """Get audit activity summary for an organization"""
    db = request.app.state.db
    
    from datetime import timedelta
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Aggregate by action type
    pipeline = [
        {"$match": {"org_id": org_id, "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$action",
            "count": {"$sum": 1},
            "last_occurrence": {"$max": "$created_at"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    action_summary = await db.audit_logs.aggregate(pipeline).to_list(None)
    
    # Aggregate by user
    user_pipeline = [
        {"$match": {"org_id": org_id, "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"user_id": "$user_id", "user_email": "$user_email"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    user_summary = await db.audit_logs.aggregate(user_pipeline).to_list(None)
    
    # Aggregate by resource type
    resource_pipeline = [
        {"$match": {"org_id": org_id, "created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$resource_type",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    resource_summary = await db.audit_logs.aggregate(resource_pipeline).to_list(None)
    
    # Total count
    total = await db.audit_logs.count_documents({"org_id": org_id, "created_at": {"$gte": start_date}})
    
    # Export count
    export_actions = [a.value for a in AuditAction if a.value.startswith("export_")]
    export_count = await db.audit_logs.count_documents({
        "org_id": org_id,
        "action": {"$in": export_actions},
        "created_at": {"$gte": start_date}
    })
    
    # Sensitive access count (PII)
    pii_count = await db.audit_logs.count_documents({
        "org_id": org_id,
        "action": AuditAction.PII_ACCESS.value,
        "created_at": {"$gte": start_date}
    })
    
    return {
        "period_days": days,
        "total_actions": total,
        "export_count": export_count,
        "pii_access_count": pii_count,
        "by_action": [{"action": a["_id"], "count": a["count"], "last": a.get("last_occurrence")} for a in action_summary],
        "by_user": [{"user_id": u["_id"]["user_id"], "email": u["_id"].get("user_email"), "count": u["count"]} for u in user_summary],
        "by_resource": [{"resource": r["_id"], "count": r["count"]} for r in resource_summary]
    }


@router.get("/exports/{org_id}")
async def get_export_history(
    request: Request,
    org_id: str,
    page: int = 1,
    page_size: int = 20
):
    """Get export-specific audit history"""
    db = request.app.state.db
    
    export_actions = [a.value for a in AuditAction if a.value.startswith("export_")]
    
    query = {
        "org_id": org_id,
        "action": {"$in": export_actions}
    }
    
    total = await db.audit_logs.count_documents(query)
    skip = (page - 1) * page_size
    
    logs = await db.audit_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(page_size).to_list(None)
    
    return {
        "total": total,
        "page": page,
        "exports": logs
    }


@router.delete("/logs/{org_id}")
async def purge_old_logs(
    request: Request,
    org_id: str,
    days_to_keep: int = 365
):
    """Purge audit logs older than specified days (admin only)"""
    db = request.app.state.db
    
    from datetime import timedelta
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days_to_keep)).isoformat()
    
    result = await db.audit_logs.delete_many({
        "org_id": org_id,
        "created_at": {"$lt": cutoff_date}
    })
    
    return {
        "deleted_count": result.deleted_count,
        "cutoff_date": cutoff_date
    }
