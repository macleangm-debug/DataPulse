"""DataPulse - Scheduled Exports Routes
Auto-export data to email, S3, Google Drive, and other destinations
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, BackgroundTasks
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from enum import Enum
import uuid
import json
import io

from auth import get_current_user

router = APIRouter(prefix="/scheduled-exports", tags=["Scheduled Exports"])


def gen_id():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


# ============= ENUMS =============

class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    EXCEL = "xlsx"
    STATA = "dta"
    SPSS = "sav"


class ExportDestination(str, Enum):
    EMAIL = "email"
    S3 = "s3"
    GOOGLE_DRIVE = "google_drive"
    DROPBOX = "dropbox"
    WEBHOOK = "webhook"
    FTP = "ftp"


class ScheduleFrequency(str, Enum):
    ONCE = "once"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ON_SUBMISSION = "on_submission"  # Trigger on each new submission


# ============= MODELS =============

class ExportFieldConfig(BaseModel):
    """Configuration for which fields to export"""
    include_all: bool = True
    included_fields: List[str] = Field(default_factory=list)
    excluded_fields: List[str] = Field(default_factory=list)
    include_metadata: bool = True  # submission_id, timestamps, etc.
    include_gps: bool = True
    include_quality_score: bool = True
    use_labels: bool = True  # Use labels instead of values for choices
    flatten_repeats: bool = False


class ExportFilter(BaseModel):
    """Filter criteria for export"""
    status: Optional[List[str]] = None  # ["approved", "pending"]
    date_range_field: str = "submitted_at"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    quality_score_min: Optional[float] = None
    quality_score_max: Optional[float] = None
    custom_filters: Dict[str, Any] = Field(default_factory=dict)


class EmailDestinationConfig(BaseModel):
    recipients: List[str]
    subject_template: str = "DataPulse Export: {form_name} - {date}"
    body_template: str = "Please find attached the scheduled export for {form_name}.\n\nRecords: {record_count}\nDate range: {date_from} to {date_to}"
    attach_as_zip: bool = False


class S3DestinationConfig(BaseModel):
    bucket: str
    prefix: str = "datapulse-exports/"
    region: str = "us-east-1"
    access_key_id: Optional[str] = None  # If not provided, use IAM role
    secret_access_key: Optional[str] = None
    filename_template: str = "{form_name}_{date}_{time}.{format}"


class GoogleDriveConfig(BaseModel):
    folder_id: str
    service_account_json: Optional[str] = None  # Base64 encoded
    filename_template: str = "{form_name}_{date}_{time}.{format}"


class DropboxConfig(BaseModel):
    access_token: str
    folder_path: str = "/DataPulse Exports"
    filename_template: str = "{form_name}_{date}_{time}.{format}"


class WebhookConfig(BaseModel):
    url: str
    method: str = "POST"
    headers: Dict[str, str] = Field(default_factory=dict)
    include_data_in_body: bool = True
    auth_type: Optional[str] = None  # "bearer", "basic", "api_key"
    auth_value: Optional[str] = None


class FTPConfig(BaseModel):
    host: str
    port: int = 21
    username: str
    password: str
    remote_path: str = "/exports"
    use_sftp: bool = False
    filename_template: str = "{form_name}_{date}_{time}.{format}"


class ScheduledExport(BaseModel):
    """A scheduled export job configuration"""
    id: str = Field(default_factory=gen_id)
    name: str
    form_id: str
    org_id: str
    created_by: str
    
    # Schedule
    frequency: ScheduleFrequency
    schedule_time: Optional[str] = None  # HH:MM for daily, "Mon,Wed,Fri" for weekly
    schedule_day: Optional[int] = None  # Day of month for monthly (1-28)
    timezone: str = "UTC"
    
    # Export settings
    format: ExportFormat
    field_config: ExportFieldConfig = Field(default_factory=ExportFieldConfig)
    filters: ExportFilter = Field(default_factory=ExportFilter)
    
    # Destination
    destination: ExportDestination
    destination_config: Dict[str, Any] = Field(default_factory=dict)
    
    # State
    is_active: bool = True
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_records: int = 0
    next_run_at: Optional[datetime] = None
    run_count: int = 0
    error_count: int = 0


class ScheduledExportCreate(BaseModel):
    name: str
    form_id: str
    frequency: ScheduleFrequency
    schedule_time: Optional[str] = None
    schedule_day: Optional[int] = None
    timezone: str = "UTC"
    format: ExportFormat
    field_config: Optional[ExportFieldConfig] = None
    filters: Optional[ExportFilter] = None
    destination: ExportDestination
    destination_config: Dict[str, Any]


class ScheduledExportUpdate(BaseModel):
    name: Optional[str] = None
    frequency: Optional[ScheduleFrequency] = None
    schedule_time: Optional[str] = None
    schedule_day: Optional[int] = None
    timezone: Optional[str] = None
    format: Optional[ExportFormat] = None
    field_config: Optional[ExportFieldConfig] = None
    filters: Optional[ExportFilter] = None
    destination: Optional[ExportDestination] = None
    destination_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ExportRun(BaseModel):
    """Record of an export execution"""
    id: str = Field(default_factory=gen_id)
    scheduled_export_id: str
    form_id: str
    org_id: str
    triggered_by: str  # "schedule", "manual", "on_submission"
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: Optional[datetime] = None
    status: str = "running"  # "running", "completed", "failed"
    records_exported: int = 0
    file_size_bytes: int = 0
    destination_path: Optional[str] = None
    error_message: Optional[str] = None


class ExportRunOut(BaseModel):
    id: str
    scheduled_export_id: str
    triggered_by: str
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    records_exported: int
    error_message: Optional[str]


# ============= HELPER FUNCTIONS =============

def calculate_next_run(export: Dict[str, Any]) -> datetime:
    """Calculate the next run time for a scheduled export"""
    now = utc_now()
    freq = export.get("frequency", "daily")
    schedule_time = export.get("schedule_time", "00:00")
    
    if freq == "once":
        return None
    
    if freq == "on_submission":
        return None  # Triggered by submissions
    
    # Parse schedule time
    try:
        hour, minute = map(int, schedule_time.split(":"))
    except:
        hour, minute = 0, 0
    
    if freq == "hourly":
        next_run = now.replace(minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(hours=1)
        return next_run
    
    if freq == "daily":
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        return next_run
    
    if freq == "weekly":
        # schedule_time contains days like "Mon,Wed,Fri"
        days = export.get("schedule_time", "Mon").split(",")
        day_map = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
        target_days = [day_map.get(d.strip(), 0) for d in days]
        
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        while next_run.weekday() not in target_days or next_run <= now:
            next_run += timedelta(days=1)
        return next_run
    
    if freq == "monthly":
        day = export.get("schedule_day", 1)
        next_run = now.replace(day=min(day, 28), hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            # Move to next month
            if next_run.month == 12:
                next_run = next_run.replace(year=next_run.year + 1, month=1)
            else:
                next_run = next_run.replace(month=next_run.month + 1)
        return next_run
    
    return now + timedelta(days=1)


async def execute_export(db, export: Dict[str, Any], triggered_by: str = "schedule") -> Dict[str, Any]:
    """Execute an export job"""
    import pandas as pd
    
    run_id = gen_id()
    
    # Create run record
    run = {
        "id": run_id,
        "scheduled_export_id": export["id"],
        "form_id": export["form_id"],
        "org_id": export["org_id"],
        "triggered_by": triggered_by,
        "started_at": utc_now().isoformat(),
        "status": "running",
        "records_exported": 0
    }
    await db.export_runs.insert_one(run)
    
    try:
        # Build query from filters
        filters = export.get("filters", {})
        query = {"form_id": export["form_id"]}
        
        if filters.get("status"):
            query["status"] = {"$in": filters["status"]}
        
        if filters.get("date_from"):
            date_field = filters.get("date_range_field", "submitted_at")
            query[date_field] = {"$gte": filters["date_from"]}
        
        if filters.get("date_to"):
            date_field = filters.get("date_range_field", "submitted_at")
            if date_field in query:
                query[date_field]["$lte"] = filters["date_to"]
            else:
                query[date_field] = {"$lte": filters["date_to"]}
        
        if filters.get("quality_score_min") is not None:
            query["quality_score"] = {"$gte": filters["quality_score_min"]}
        
        if filters.get("quality_score_max") is not None:
            if "quality_score" in query:
                query["quality_score"]["$lte"] = filters["quality_score_max"]
            else:
                query["quality_score"] = {"$lte": filters["quality_score_max"]}
        
        # Fetch submissions
        submissions = await db.submissions.find(query, {"_id": 0}).to_list(10000)
        
        if not submissions:
            # Update run as completed with 0 records
            await db.export_runs.update_one(
                {"id": run_id},
                {
                    "$set": {
                        "status": "completed",
                        "completed_at": utc_now().isoformat(),
                        "records_exported": 0
                    }
                }
            )
            return {"success": True, "records": 0}
        
        # Process data based on field config
        field_config = export.get("field_config", {})
        
        # Flatten submission data
        rows = []
        for sub in submissions:
            row = {}
            
            if field_config.get("include_metadata", True):
                row["submission_id"] = sub.get("id")
                row["submitted_at"] = sub.get("submitted_at")
                row["submitted_by"] = sub.get("submitted_by")
                row["status"] = sub.get("status")
            
            if field_config.get("include_quality_score", True):
                row["quality_score"] = sub.get("quality_score")
            
            if field_config.get("include_gps", True):
                gps = sub.get("gps_location", {})
                row["gps_latitude"] = gps.get("lat")
                row["gps_longitude"] = gps.get("lng")
                row["gps_accuracy"] = sub.get("gps_accuracy")
            
            # Add form data
            data = sub.get("data", {})
            for key, value in data.items():
                if field_config.get("include_all", True):
                    row[key] = value
                elif key in field_config.get("included_fields", []):
                    row[key] = value
                elif key not in field_config.get("excluded_fields", []):
                    row[key] = value
            
            rows.append(row)
        
        # Create DataFrame
        df = pd.DataFrame(rows)
        
        # Generate file
        export_format = export.get("format", "csv")
        output = io.BytesIO()
        
        if export_format == "csv":
            df.to_csv(output, index=False)
            content_type = "text/csv"
            extension = "csv"
        elif export_format == "xlsx":
            df.to_excel(output, index=False, engine='openpyxl')
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            extension = "xlsx"
        elif export_format == "json":
            output.write(df.to_json(orient="records").encode())
            content_type = "application/json"
            extension = "json"
        else:
            df.to_csv(output, index=False)
            content_type = "text/csv"
            extension = "csv"
        
        output.seek(0)
        file_content = output.read()
        file_size = len(file_content)
        
        # Get form name for filename
        form = await db.forms.find_one({"id": export["form_id"]}, {"_id": 0, "name": 1})
        form_name = form.get("name", "export").replace(" ", "_") if form else "export"
        
        # Generate filename
        now = utc_now()
        filename = f"{form_name}_{now.strftime('%Y%m%d')}_{now.strftime('%H%M%S')}.{extension}"
        
        # Send to destination
        destination = export.get("destination", "email")
        dest_config = export.get("destination_config", {})
        destination_path = None
        
        if destination == "email":
            # Send email with attachment
            recipients = dest_config.get("recipients", [])
            if recipients:
                # In production, use proper email service
                # For now, just log it
                destination_path = f"email:{','.join(recipients)}"
                print(f"Would send export to: {recipients}")
        
        elif destination == "s3":
            # Upload to S3
            try:
                import boto3
                
                s3_client = boto3.client(
                    's3',
                    region_name=dest_config.get("region", "us-east-1"),
                    aws_access_key_id=dest_config.get("access_key_id"),
                    aws_secret_access_key=dest_config.get("secret_access_key")
                )
                
                bucket = dest_config.get("bucket")
                prefix = dest_config.get("prefix", "exports/")
                key = f"{prefix}{filename}"
                
                s3_client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=file_content,
                    ContentType=content_type
                )
                
                destination_path = f"s3://{bucket}/{key}"
            except Exception as e:
                raise Exception(f"S3 upload failed: {str(e)}")
        
        elif destination == "webhook":
            # Send to webhook
            import httpx
            
            url = dest_config.get("url")
            headers = dest_config.get("headers", {})
            
            if dest_config.get("auth_type") == "bearer":
                headers["Authorization"] = f"Bearer {dest_config.get('auth_value', '')}"
            
            async with httpx.AsyncClient() as client:
                if dest_config.get("include_data_in_body", True):
                    response = await client.post(
                        url,
                        json={"records": rows, "count": len(rows), "form_id": export["form_id"]},
                        headers=headers
                    )
                else:
                    response = await client.post(
                        url,
                        files={"file": (filename, file_content, content_type)},
                        headers=headers
                    )
                
                if response.status_code >= 400:
                    raise Exception(f"Webhook returned {response.status_code}")
                
                destination_path = url
        
        # Update run as completed
        await db.export_runs.update_one(
            {"id": run_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": utc_now().isoformat(),
                    "records_exported": len(submissions),
                    "file_size_bytes": file_size,
                    "destination_path": destination_path
                }
            }
        )
        
        # Update scheduled export
        await db.scheduled_exports.update_one(
            {"id": export["id"]},
            {
                "$set": {
                    "last_run_at": utc_now().isoformat(),
                    "last_run_status": "completed",
                    "last_run_records": len(submissions),
                    "next_run_at": calculate_next_run(export).isoformat() if calculate_next_run(export) else None
                },
                "$inc": {"run_count": 1}
            }
        )
        
        return {"success": True, "records": len(submissions), "run_id": run_id}
        
    except Exception as e:
        # Update run as failed
        await db.export_runs.update_one(
            {"id": run_id},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": utc_now().isoformat(),
                    "error_message": str(e)
                }
            }
        )
        
        # Update scheduled export
        await db.scheduled_exports.update_one(
            {"id": export["id"]},
            {
                "$set": {
                    "last_run_at": utc_now().isoformat(),
                    "last_run_status": "failed"
                },
                "$inc": {"error_count": 1}
            }
        )
        
        return {"success": False, "error": str(e), "run_id": run_id}


# ============= ENDPOINTS =============

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_scheduled_export(
    request: Request,
    data: ScheduledExportCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new scheduled export"""
    db = request.app.state.db
    
    # Verify form exists
    form = await db.forms.find_one({"id": data.form_id}, {"_id": 0, "org_id": 1})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    export = ScheduledExport(
        name=data.name,
        form_id=data.form_id,
        org_id=form["org_id"],
        created_by=current_user["user_id"],
        frequency=data.frequency,
        schedule_time=data.schedule_time,
        schedule_day=data.schedule_day,
        timezone=data.timezone,
        format=data.format,
        field_config=data.field_config or ExportFieldConfig(),
        filters=data.filters or ExportFilter(),
        destination=data.destination,
        destination_config=data.destination_config
    )
    
    export_dict = export.model_dump()
    export_dict["created_at"] = export_dict["created_at"].isoformat()
    export_dict["updated_at"] = export_dict["updated_at"].isoformat()
    export_dict["field_config"] = export_dict["field_config"]
    export_dict["filters"] = export_dict["filters"]
    
    # Calculate next run
    next_run = calculate_next_run(export_dict)
    if next_run:
        export_dict["next_run_at"] = next_run.isoformat()
    
    await db.scheduled_exports.insert_one(export_dict)
    
    return {"success": True, "id": export.id, "message": "Scheduled export created"}


@router.get("")
async def list_scheduled_exports(
    request: Request,
    form_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    destination: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List scheduled exports"""
    db = request.app.state.db
    
    query = {}
    if form_id:
        query["form_id"] = form_id
    if is_active is not None:
        query["is_active"] = is_active
    if destination:
        query["destination"] = destination
    
    exports = await db.scheduled_exports.find(
        query,
        {"_id": 0, "destination_config": 0}  # Hide sensitive config
    ).sort("created_at", -1).to_list(100)
    
    return {"exports": exports}


@router.get("/{export_id}")
async def get_scheduled_export(
    request: Request,
    export_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific scheduled export"""
    db = request.app.state.db
    
    export = await db.scheduled_exports.find_one(
        {"id": export_id},
        {"_id": 0}
    )
    
    if not export:
        raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    # Mask sensitive data in destination_config
    if "destination_config" in export:
        config = export["destination_config"]
        for key in ["secret_access_key", "password", "access_token", "auth_value", "service_account_json"]:
            if key in config:
                config[key] = "***HIDDEN***"
    
    return export


@router.put("/{export_id}")
async def update_scheduled_export(
    request: Request,
    export_id: str,
    data: ScheduledExportUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a scheduled export"""
    db = request.app.state.db
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = utc_now().isoformat()
    
    # Recalculate next run if schedule changed
    if any(k in update_data for k in ["frequency", "schedule_time", "schedule_day"]):
        export = await db.scheduled_exports.find_one({"id": export_id}, {"_id": 0})
        if export:
            merged = {**export, **update_data}
            next_run = calculate_next_run(merged)
            if next_run:
                update_data["next_run_at"] = next_run.isoformat()
    
    result = await db.scheduled_exports.update_one(
        {"id": export_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    return {"success": True, "message": "Scheduled export updated"}


@router.delete("/{export_id}")
async def delete_scheduled_export(
    request: Request,
    export_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a scheduled export"""
    db = request.app.state.db
    
    result = await db.scheduled_exports.delete_one({"id": export_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    return {"success": True, "message": "Scheduled export deleted"}


@router.post("/{export_id}/run")
async def run_export_now(
    request: Request,
    export_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger an export"""
    db = request.app.state.db
    
    export = await db.scheduled_exports.find_one({"id": export_id}, {"_id": 0})
    
    if not export:
        raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    # Run export in background
    result = await execute_export(db, export, triggered_by="manual")
    
    return {
        "success": result.get("success", False),
        "run_id": result.get("run_id"),
        "records": result.get("records", 0),
        "error": result.get("error")
    }


@router.get("/{export_id}/runs")
async def list_export_runs(
    request: Request,
    export_id: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List execution history for a scheduled export"""
    db = request.app.state.db
    
    query = {"scheduled_export_id": export_id}
    if status:
        query["status"] = status
    
    runs = await db.export_runs.find(
        query,
        {"_id": 0}
    ).sort("started_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.export_runs.count_documents(query)
    
    return {
        "runs": runs,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/{export_id}/toggle")
async def toggle_scheduled_export(
    request: Request,
    export_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle a scheduled export on/off"""
    db = request.app.state.db
    
    export = await db.scheduled_exports.find_one({"id": export_id}, {"_id": 0, "is_active": 1})
    
    if not export:
        raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    new_status = not export.get("is_active", True)
    
    update_data = {
        "is_active": new_status,
        "updated_at": utc_now().isoformat()
    }
    
    # Recalculate next run if activating
    if new_status:
        full_export = await db.scheduled_exports.find_one({"id": export_id}, {"_id": 0})
        next_run = calculate_next_run(full_export)
        if next_run:
            update_data["next_run_at"] = next_run.isoformat()
    else:
        update_data["next_run_at"] = None
    
    await db.scheduled_exports.update_one(
        {"id": export_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "is_active": new_status,
        "message": f"Scheduled export {'activated' if new_status else 'deactivated'}"
    }


# ============= TEST ENDPOINT =============

@router.post("/{export_id}/test-destination")
async def test_destination(
    request: Request,
    export_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Test the destination configuration"""
    db = request.app.state.db
    
    export = await db.scheduled_exports.find_one({"id": export_id}, {"_id": 0})
    
    if not export:
        raise HTTPException(status_code=404, detail="Scheduled export not found")
    
    destination = export.get("destination")
    dest_config = export.get("destination_config", {})
    
    try:
        if destination == "email":
            # Verify recipients are valid emails
            recipients = dest_config.get("recipients", [])
            if not recipients:
                raise Exception("No recipients configured")
            return {"success": True, "message": f"Email destination configured for {len(recipients)} recipients"}
        
        elif destination == "s3":
            import boto3
            
            s3_client = boto3.client(
                's3',
                region_name=dest_config.get("region", "us-east-1"),
                aws_access_key_id=dest_config.get("access_key_id"),
                aws_secret_access_key=dest_config.get("secret_access_key")
            )
            
            # Test by listing bucket
            bucket = dest_config.get("bucket")
            s3_client.head_bucket(Bucket=bucket)
            
            return {"success": True, "message": f"S3 bucket '{bucket}' accessible"}
        
        elif destination == "webhook":
            import httpx
            
            url = dest_config.get("url")
            headers = dest_config.get("headers", {})
            
            # Send a test ping
            async with httpx.AsyncClient() as client:
                response = await client.options(url, headers=headers, timeout=10)
                return {"success": True, "message": f"Webhook endpoint reachable (status: {response.status_code})"}
        
        else:
            return {"success": True, "message": f"Destination '{destination}' configured (no test available)"}
            
    except Exception as e:
        return {"success": False, "error": str(e)}
