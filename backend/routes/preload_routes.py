"""DataPulse - Preload/Write-back Module
Industry-standard pre-population and database write-back for longitudinal data.

Features:
- Preload data from previous waves/submissions
- Pre-populate forms with case data
- Write-back verified responses to datasets
- Conditional preload rules
- Data transformation and mapping
- Synchronization with external systems
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timezone
from enum import Enum
import secrets

router = APIRouter(prefix="/preload", tags=["Preload & Write-back"])


class PreloadSource(str, Enum):
    CASE = "case"  # From case management
    DATASET = "dataset"  # From lookup dataset
    PREVIOUS_SUBMISSION = "previous_submission"  # From earlier wave
    EXTERNAL_API = "external_api"  # From external system
    MANUAL = "manual"  # Manual entry


class WritebackTrigger(str, Enum):
    ON_SUBMIT = "on_submit"  # When submission is saved
    ON_APPROVE = "on_approve"  # When submission is approved
    ON_REVIEW = "on_review"  # When submission passes review
    MANUAL = "manual"  # Manual trigger only


class TransformationType(str, Enum):
    DIRECT = "direct"  # Direct copy
    FORMAT = "format"  # String formatting
    CALCULATE = "calculate"  # Arithmetic
    LOOKUP = "lookup"  # Value mapping
    CONDITIONAL = "conditional"  # If-then-else


class PreloadConfigCreate(BaseModel):
    org_id: str
    form_id: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    
    # Preload sources
    sources: List[Dict[str, Any]] = []  # List of source configurations
    
    # Field mappings
    mappings: List[Dict[str, Any]] = []  # source_field -> form_field mappings
    
    # Conditional rules
    conditions: Optional[List[Dict[str, Any]]] = None


class PreloadMapping(BaseModel):
    source_type: PreloadSource
    source_field: str
    target_field: str
    transformation: TransformationType = TransformationType.DIRECT
    transform_config: Optional[Dict[str, Any]] = None
    required: bool = False
    default_value: Optional[Any] = None


class WritebackConfigCreate(BaseModel):
    org_id: str
    form_id: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    
    # Target configuration
    target_type: str  # "dataset", "case", "external_api"
    target_id: Optional[str] = None  # Dataset ID or API config ID
    
    # Trigger
    trigger: WritebackTrigger = WritebackTrigger.ON_APPROVE
    
    # Field mappings (form_field -> target_field)
    mappings: List[Dict[str, Any]] = []
    
    # Conditions for write-back
    conditions: Optional[List[Dict[str, Any]]] = None
    
    # Options
    create_if_missing: bool = False  # Create new record if no match
    match_fields: List[str] = []  # Fields to match for update


class ExternalApiConfig(BaseModel):
    org_id: str
    name: str
    base_url: str
    auth_type: str = "bearer"  # bearer, basic, api_key
    auth_config: Dict[str, str] = {}  # Encrypted credentials
    headers: Optional[Dict[str, str]] = None
    timeout_seconds: int = 30


# ============ Preload Configuration ============

@router.post("/configs")
async def create_preload_config(
    request: Request,
    config: PreloadConfigCreate
):
    """Create a preload configuration for a form"""
    db = request.app.state.db
    
    config_doc = {
        "id": f"preload_{config.form_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "stats": {
            "total_preloads": 0,
            "successful": 0,
            "failed": 0
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.preload_configs.insert_one(config_doc)
    
    return {"message": "Preload configuration created", "config_id": config_doc["id"]}


@router.get("/configs/{org_id}")
async def list_preload_configs(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None
):
    """List preload configurations"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if form_id:
        query["form_id"] = form_id
    
    configs = await db.preload_configs.find(query).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


@router.get("/configs/{org_id}/{config_id}")
async def get_preload_config(
    request: Request,
    org_id: str,
    config_id: str
):
    """Get preload configuration details"""
    db = request.app.state.db
    
    config = await db.preload_configs.find_one({"id": config_id, "org_id": org_id})
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    config["_id"] = str(config.get("_id", ""))
    
    return config


@router.put("/configs/{config_id}")
async def update_preload_config(
    request: Request,
    config_id: str
):
    """Update preload configuration"""
    db = request.app.state.db
    data = await request.json()
    
    data.pop("id", None)
    data.pop("org_id", None)
    data.pop("created_at", None)
    data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.preload_configs.update_one(
        {"id": config_id},
        {"$set": data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {"message": "Configuration updated"}


@router.delete("/configs/{config_id}")
async def delete_preload_config(
    request: Request,
    config_id: str
):
    """Delete preload configuration"""
    db = request.app.state.db
    
    result = await db.preload_configs.delete_one({"id": config_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {"message": "Configuration deleted"}


# ============ Execute Preload ============

@router.post("/execute/{form_id}")
async def execute_preload(
    request: Request,
    form_id: str
):
    """Execute preload for a form submission"""
    db = request.app.state.db
    data = await request.json()
    
    # Get context data
    case_id = data.get("case_id")
    respondent_id = data.get("respondent_id")
    previous_submission_id = data.get("previous_submission_id")
    token_metadata = data.get("token_metadata", {})
    
    # Get active preload configs for this form
    configs = await db.preload_configs.find({
        "form_id": form_id,
        "is_active": True
    }).to_list(10)
    
    if not configs:
        return {"preload_data": {}, "sources_used": []}
    
    preload_data = {}
    sources_used = []
    
    for config in configs:
        try:
            config_data, source_info = await execute_single_preload(
                db, config, case_id, respondent_id, previous_submission_id, token_metadata
            )
            preload_data.update(config_data)
            sources_used.append(source_info)
        except Exception as e:
            # Log error but continue with other configs
            await db.preload_logs.insert_one({
                "config_id": config["id"],
                "form_id": form_id,
                "case_id": case_id,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc)
            })
    
    # Log successful preload
    await db.preload_logs.insert_one({
        "form_id": form_id,
        "case_id": case_id,
        "status": "success",
        "fields_preloaded": list(preload_data.keys()),
        "sources_used": sources_used,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Update stats
    for config in configs:
        await db.preload_configs.update_one(
            {"id": config["id"]},
            {"$inc": {"stats.total_preloads": 1, "stats.successful": 1}}
        )
    
    return {
        "preload_data": preload_data,
        "sources_used": sources_used
    }


async def execute_single_preload(
    db, config: dict, case_id: str, respondent_id: str, 
    previous_submission_id: str, token_metadata: dict
) -> tuple:
    """Execute a single preload configuration"""
    preload_data = {}
    source_info = {"config_id": config["id"], "config_name": config["name"], "fields": []}
    
    for mapping in config.get("mappings", []):
        source_type = mapping.get("source_type", PreloadSource.CASE)
        source_field = mapping["source_field"]
        target_field = mapping["target_field"]
        
        value = None
        
        # Get value from source
        if source_type == PreloadSource.CASE and case_id:
            case = await db.cases.find_one({"id": case_id})
            if case:
                value = case.get("data", {}).get(source_field) or case.get(source_field)
        
        elif source_type == PreloadSource.DATASET:
            dataset_id = mapping.get("dataset_id")
            lookup_field = mapping.get("lookup_field")
            lookup_value = mapping.get("lookup_value") or respondent_id
            
            if dataset_id and lookup_field:
                record = await db.dataset_records.find_one({
                    "dataset_id": dataset_id,
                    lookup_field: lookup_value
                })
                if record:
                    value = record.get("data", {}).get(source_field)
        
        elif source_type == PreloadSource.PREVIOUS_SUBMISSION:
            if previous_submission_id:
                prev_sub = await db.submissions.find_one({"id": previous_submission_id})
            else:
                # Find most recent submission for this case/respondent
                query = {"form_id": config["form_id"]}
                if case_id:
                    query["case_id"] = case_id
                elif respondent_id:
                    query["data.respondent_id"] = respondent_id
                
                prev_sub = await db.submissions.find_one(
                    query,
                    sort=[("submitted_at", -1)]
                )
            
            if prev_sub:
                value = prev_sub.get("data", {}).get(source_field)
        
        elif source_type == PreloadSource.MANUAL:
            value = token_metadata.get(source_field)
        
        # Apply transformation
        if value is not None:
            value = apply_transformation(
                value,
                mapping.get("transformation", TransformationType.DIRECT),
                mapping.get("transform_config", {})
            )
        
        # Use default if no value
        if value is None and mapping.get("default_value") is not None:
            value = mapping["default_value"]
        
        # Skip if required but missing
        if value is None and mapping.get("required"):
            continue
        
        if value is not None:
            preload_data[target_field] = value
            source_info["fields"].append(target_field)
    
    return preload_data, source_info


def apply_transformation(value: Any, transform_type: str, config: dict) -> Any:
    """Apply transformation to preloaded value"""
    if transform_type == TransformationType.DIRECT:
        return value
    
    elif transform_type == TransformationType.FORMAT:
        template = config.get("template", "{value}")
        return template.format(value=value, **config.get("extra_vars", {}))
    
    elif transform_type == TransformationType.CALCULATE:
        operation = config.get("operation", "none")
        operand = config.get("operand", 0)
        
        if isinstance(value, (int, float)):
            if operation == "add":
                return value + operand
            elif operation == "subtract":
                return value - operand
            elif operation == "multiply":
                return value * operand
            elif operation == "divide" and operand != 0:
                return value / operand
        return value
    
    elif transform_type == TransformationType.LOOKUP:
        lookup_table = config.get("lookup_table", {})
        return lookup_table.get(str(value), config.get("default", value))
    
    elif transform_type == TransformationType.CONDITIONAL:
        conditions = config.get("conditions", [])
        for cond in conditions:
            if evaluate_condition(value, cond):
                return cond.get("then_value", value)
        return config.get("else_value", value)
    
    return value


def evaluate_condition(value: Any, condition: dict) -> bool:
    """Evaluate a condition"""
    operator = condition.get("operator", "eq")
    compare_value = condition.get("value")
    
    if operator == "eq":
        return value == compare_value
    elif operator == "neq":
        return value != compare_value
    elif operator == "gt":
        return value > compare_value
    elif operator == "gte":
        return value >= compare_value
    elif operator == "lt":
        return value < compare_value
    elif operator == "lte":
        return value <= compare_value
    elif operator == "contains":
        return compare_value in str(value)
    elif operator == "in":
        return value in compare_value
    
    return False


# ============ Write-back Configuration ============

@router.post("/writeback/configs")
async def create_writeback_config(
    request: Request,
    config: WritebackConfigCreate
):
    """Create a write-back configuration"""
    db = request.app.state.db
    
    config_doc = {
        "id": f"wb_{config.form_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "stats": {
            "total_writebacks": 0,
            "successful": 0,
            "failed": 0
        },
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.writeback_configs.insert_one(config_doc)
    
    return {"message": "Write-back configuration created", "config_id": config_doc["id"]}


@router.get("/writeback/configs/{org_id}")
async def list_writeback_configs(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None
):
    """List write-back configurations"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if form_id:
        query["form_id"] = form_id
    
    configs = await db.writeback_configs.find(query).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


@router.put("/writeback/configs/{config_id}")
async def update_writeback_config(
    request: Request,
    config_id: str
):
    """Update write-back configuration"""
    db = request.app.state.db
    data = await request.json()
    
    data.pop("id", None)
    data.pop("org_id", None)
    data.pop("created_at", None)
    data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.writeback_configs.update_one(
        {"id": config_id},
        {"$set": data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {"message": "Configuration updated"}


# ============ Execute Write-back ============

@router.post("/writeback/execute/{submission_id}")
async def execute_writeback(
    request: Request,
    submission_id: str,
    trigger: Optional[WritebackTrigger] = None
):
    """Execute write-back for a submission"""
    db = request.app.state.db
    
    submission = await db.submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Get active write-back configs for this form
    query = {
        "form_id": submission["form_id"],
        "is_active": True
    }
    if trigger:
        query["trigger"] = trigger
    
    configs = await db.writeback_configs.find(query).to_list(10)
    
    if not configs:
        return {"message": "No write-back configurations found", "writebacks": []}
    
    results = []
    
    for config in configs:
        try:
            result = await execute_single_writeback(db, config, submission)
            results.append({
                "config_id": config["id"],
                "config_name": config["name"],
                "status": "success",
                **result
            })
            
            await db.writeback_configs.update_one(
                {"id": config["id"]},
                {"$inc": {"stats.total_writebacks": 1, "stats.successful": 1}}
            )
        except Exception as e:
            results.append({
                "config_id": config["id"],
                "config_name": config["name"],
                "status": "error",
                "error": str(e)
            })
            
            await db.writeback_configs.update_one(
                {"id": config["id"]},
                {"$inc": {"stats.total_writebacks": 1, "stats.failed": 1}}
            )
    
    # Log write-back execution
    await db.writeback_logs.insert_one({
        "submission_id": submission_id,
        "form_id": submission["form_id"],
        "trigger": trigger,
        "results": results,
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": "Write-back executed", "results": results}


async def execute_single_writeback(db, config: dict, submission: dict) -> dict:
    """Execute a single write-back configuration"""
    target_type = config["target_type"]
    target_data = {}
    
    # Map fields
    for mapping in config.get("mappings", []):
        source_field = mapping["source_field"]
        target_field = mapping["target_field"]
        
        value = submission.get("data", {}).get(source_field)
        
        # Apply transformation if specified
        if mapping.get("transformation"):
            value = apply_transformation(
                value,
                mapping["transformation"],
                mapping.get("transform_config", {})
            )
        
        if value is not None:
            target_data[target_field] = value
    
    # Execute based on target type
    if target_type == "dataset":
        return await writeback_to_dataset(db, config, submission, target_data)
    
    elif target_type == "case":
        return await writeback_to_case(db, config, submission, target_data)
    
    elif target_type == "external_api":
        return await writeback_to_external_api(db, config, submission, target_data)
    
    return {"fields_written": list(target_data.keys())}


async def writeback_to_dataset(db, config: dict, submission: dict, target_data: dict) -> dict:
    """Write back to a lookup dataset"""
    dataset_id = config.get("target_id")
    if not dataset_id:
        raise ValueError("Dataset ID not specified")
    
    # Build match query
    match_query = {"dataset_id": dataset_id}
    for field in config.get("match_fields", []):
        if field in target_data:
            match_query[f"data.{field}"] = target_data[field]
        elif field in submission.get("data", {}):
            match_query[f"data.{field}"] = submission["data"][field]
    
    # Find or create record
    existing = await db.dataset_records.find_one(match_query)
    
    if existing:
        # Update existing record
        await db.dataset_records.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    **{f"data.{k}": v for k, v in target_data.items()},
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by_submission": submission["id"]
                }
            }
        )
        return {"action": "updated", "record_id": existing.get("id")}
    
    elif config.get("create_if_missing"):
        # Create new record
        new_record = {
            "id": f"rec_{dataset_id}_{secrets.token_hex(8)}",
            "dataset_id": dataset_id,
            "data": target_data,
            "source_submission": submission["id"],
            "created_at": datetime.now(timezone.utc)
        }
        await db.dataset_records.insert_one(new_record)
        return {"action": "created", "record_id": new_record["id"]}
    
    return {"action": "skipped", "reason": "no_match"}


async def writeback_to_case(db, config: dict, submission: dict, target_data: dict) -> dict:
    """Write back to case management"""
    case_id = submission.get("case_id")
    
    if not case_id:
        # Try to find case by match fields
        match_query = {}
        for field in config.get("match_fields", []):
            if field in submission.get("data", {}):
                match_query[f"data.{field}"] = submission["data"][field]
        
        if match_query:
            case = await db.cases.find_one(match_query)
            if case:
                case_id = case["id"]
    
    if not case_id:
        if config.get("create_if_missing"):
            # Create new case
            new_case = {
                "id": f"case_{secrets.token_hex(8)}",
                "project_id": submission.get("project_id"),
                "org_id": submission.get("org_id"),
                "data": target_data,
                "status": "active",
                "source_submission": submission["id"],
                "created_at": datetime.now(timezone.utc)
            }
            await db.cases.insert_one(new_case)
            return {"action": "created", "case_id": new_case["id"]}
        return {"action": "skipped", "reason": "no_case_found"}
    
    # Update existing case
    await db.cases.update_one(
        {"id": case_id},
        {
            "$set": {
                **{f"data.{k}": v for k, v in target_data.items()},
                "updated_at": datetime.now(timezone.utc),
                "last_submission_id": submission["id"]
            }
        }
    )
    
    return {"action": "updated", "case_id": case_id}


async def writeback_to_external_api(db, config: dict, submission: dict, target_data: dict) -> dict:
    """Write back to external API (placeholder)"""
    # In production, this would make HTTP requests to external systems
    # For now, just log the attempt
    
    api_config_id = config.get("target_id")
    if not api_config_id:
        raise ValueError("API configuration ID not specified")
    
    api_config = await db.external_api_configs.find_one({"id": api_config_id})
    if not api_config:
        raise ValueError("API configuration not found")
    
    # Log the write-back attempt
    await db.external_api_logs.insert_one({
        "api_config_id": api_config_id,
        "submission_id": submission["id"],
        "payload": target_data,
        "status": "pending",  # Would be updated after actual API call
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"action": "queued", "api_config": api_config["name"]}


# ============ External API Configuration ============

@router.post("/external-apis")
async def create_external_api_config(
    request: Request,
    config: ExternalApiConfig
):
    """Create external API configuration"""
    db = request.app.state.db
    
    config_doc = {
        "id": f"api_{config.org_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **config.dict(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    # In production, encrypt auth_config
    
    await db.external_api_configs.insert_one(config_doc)
    
    return {"message": "API configuration created", "config_id": config_doc["id"]}


@router.get("/external-apis/{org_id}")
async def list_external_api_configs(
    request: Request,
    org_id: str
):
    """List external API configurations"""
    db = request.app.state.db
    
    configs = await db.external_api_configs.find(
        {"org_id": org_id},
        {"auth_config": 0}  # Don't expose credentials
    ).to_list(100)
    
    for c in configs:
        c["_id"] = str(c.get("_id", ""))
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
    
    return {"configs": configs}


# ============ Logs and History ============

@router.get("/logs/{org_id}")
async def get_preload_logs(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
):
    """Get preload execution logs"""
    db = request.app.state.db
    
    # Get form IDs for this org
    forms = await db.forms.find({"org_id": org_id}, {"id": 1}).to_list(1000)
    form_ids = [f["id"] for f in forms]
    
    query = {"form_id": {"$in": form_ids}}
    if form_id:
        query["form_id"] = form_id
    if status:
        query["status"] = status
    
    logs = await db.preload_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log["_id"] = str(log.get("_id", ""))
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {"logs": logs}


@router.get("/writeback/logs/{org_id}")
async def get_writeback_logs(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None,
    limit: int = 100
):
    """Get write-back execution logs"""
    db = request.app.state.db
    
    # Get form IDs for this org
    forms = await db.forms.find({"org_id": org_id}, {"id": 1}).to_list(1000)
    form_ids = [f["id"] for f in forms]
    
    query = {"form_id": {"$in": form_ids}}
    if form_id:
        query["form_id"] = form_id
    
    logs = await db.writeback_logs.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log["_id"] = str(log.get("_id", ""))
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    
    return {"logs": logs}
