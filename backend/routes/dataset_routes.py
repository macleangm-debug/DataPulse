"""DataPulse - Lookup Datasets Module
Industry-standard reusable lookup tables for data collection.

Features:
- Reusable tables: schools, facilities, households, products, sampling frames
- Hierarchical data support (country > region > district > village)
- Offline-first with sync support
- Typeahead search optimized for thousands of records
- Versioned updates pushed by supervisor
- Sub-setting packages (only download enumerator's region/cluster)
- Write-back updates during data collection
"""
from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import csv
import io
import json

router = APIRouter(prefix="/datasets", tags=["Lookup Datasets"])


class DatasetType(str):
    SAMPLING_FRAME = "sampling_frame"
    FACILITY_LIST = "facility_list"
    SCHOOL_LIST = "school_list"
    HOUSEHOLD_ROSTER = "household_roster"
    PRODUCT_LIST = "product_list"
    LOCATION_HIERARCHY = "location_hierarchy"
    CUSTOM = "custom"


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    dataset_type: str = "custom"
    org_id: str
    
    # Schema definition
    columns: List[Dict[str, Any]]  # [{name, type, label, searchable, required}]
    
    # Hierarchy config (for location datasets)
    hierarchy_config: Optional[Dict[str, Any]] = None  # {levels: ["country", "region", "district"]}
    
    # Offline config
    enable_offline: bool = True
    offline_subset_field: Optional[str] = None  # Field to filter by for subset downloads
    
    # Search config
    searchable_fields: List[str] = []
    display_field: str = "name"  # Primary field for display
    value_field: str = "id"  # Field to use as value


class DatasetRecord(BaseModel):
    data: Dict[str, Any]


class DatasetBulkUpload(BaseModel):
    records: List[Dict[str, Any]]
    replace_existing: bool = False


class DatasetSubsetRequest(BaseModel):
    dataset_id: str
    filter_field: str
    filter_values: List[str]


class WriteBackUpdate(BaseModel):
    record_id: str
    updates: Dict[str, Any]
    submission_id: Optional[str] = None  # Link to submission that triggered update


# ============ Dataset Management ============

@router.post("/")
async def create_dataset(
    request: Request,
    dataset: DatasetCreate
):
    """Create a new lookup dataset"""
    db = request.app.state.db
    
    dataset_doc = {
        "id": f"ds_{dataset.org_id}_{int(datetime.now(timezone.utc).timestamp())}",
        **dataset.dict(),
        "version": 1,
        "record_count": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_active": True
    }
    
    await db.lookup_datasets.insert_one(dataset_doc)
    
    # Create index for searchable fields
    collection_name = f"dataset_{dataset_doc['id']}"
    dataset_collection = db[collection_name]
    
    # Create text index for search
    if dataset.searchable_fields:
        index_fields = [(f, "text") for f in dataset.searchable_fields]
        try:
            await dataset_collection.create_index(index_fields)
        except Exception:
            pass
    
    return {
        "message": "Dataset created",
        "dataset_id": dataset_doc["id"],
        "version": 1
    }


@router.get("/{org_id}")
async def list_datasets(
    request: Request,
    org_id: str,
    dataset_type: Optional[str] = None,
    include_inactive: bool = False
):
    """List all datasets for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if dataset_type:
        query["dataset_type"] = dataset_type
    if not include_inactive:
        query["is_active"] = True
    
    datasets = await db.lookup_datasets.find(query).to_list(100)
    
    for d in datasets:
        d["_id"] = str(d.get("_id", ""))
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("updated_at"):
            d["updated_at"] = d["updated_at"].isoformat()
    
    return {"datasets": datasets, "total": len(datasets)}


@router.get("/{org_id}/{dataset_id}")
async def get_dataset(
    request: Request,
    org_id: str,
    dataset_id: str
):
    """Get dataset metadata"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    dataset["_id"] = str(dataset.get("_id", ""))
    
    return dataset


@router.delete("/{org_id}/{dataset_id}")
async def delete_dataset(
    request: Request,
    org_id: str,
    dataset_id: str
):
    """Soft delete a dataset (mark as inactive)"""
    db = request.app.state.db
    
    result = await db.lookup_datasets.update_one(
        {"id": dataset_id, "org_id": org_id},
        {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {"message": "Dataset deleted"}


# ============ Record Management ============

@router.post("/{org_id}/{dataset_id}/records")
async def add_record(
    request: Request,
    org_id: str,
    dataset_id: str,
    record: DatasetRecord
):
    """Add a single record to a dataset"""
    db = request.app.state.db
    
    # Verify dataset exists
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Get the dataset collection
    collection = db[f"dataset_{dataset_id}"]
    
    # Add metadata to record
    record_doc = {
        "id": f"rec_{int(datetime.now(timezone.utc).timestamp())}_{hash(str(record.data)) % 10000}",
        **record.data,
        "_meta": {
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "version": 1,
            "is_active": True
        }
    }
    
    await collection.insert_one(record_doc)
    
    # Update dataset record count
    await db.lookup_datasets.update_one(
        {"id": dataset_id},
        {
            "$inc": {"record_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"message": "Record added", "record_id": record_doc["id"]}


@router.post("/{org_id}/{dataset_id}/records/bulk")
async def bulk_upload_records(
    request: Request,
    org_id: str,
    dataset_id: str,
    upload: DatasetBulkUpload
):
    """Bulk upload records to a dataset"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    if upload.replace_existing:
        # Clear existing records
        await collection.delete_many({})
    
    # Prepare records
    records_to_insert = []
    for idx, record_data in enumerate(upload.records):
        record_doc = {
            "id": f"rec_{int(datetime.now(timezone.utc).timestamp())}_{idx}",
            **record_data,
            "_meta": {
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "version": 1,
                "is_active": True
            }
        }
        records_to_insert.append(record_doc)
    
    if records_to_insert:
        await collection.insert_many(records_to_insert)
    
    # Update dataset
    new_count = await collection.count_documents({"_meta.is_active": True})
    new_version = dataset.get("version", 1) + 1
    
    await db.lookup_datasets.update_one(
        {"id": dataset_id},
        {
            "$set": {
                "record_count": new_count,
                "version": new_version,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": f"Uploaded {len(records_to_insert)} records",
        "total_records": new_count,
        "new_version": new_version
    }


@router.post("/{org_id}/{dataset_id}/upload-csv")
async def upload_csv(
    request: Request,
    org_id: str,
    dataset_id: str,
    file: UploadFile = File(...),
    replace_existing: bool = False
):
    """Upload records from CSV file"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Read CSV
    contents = await file.read()
    csv_text = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(csv_text))
    
    records = [row for row in reader]
    
    if not records:
        raise HTTPException(status_code=400, detail="No records found in CSV")
    
    # Use bulk upload
    upload = DatasetBulkUpload(records=records, replace_existing=replace_existing)
    return await bulk_upload_records(request, org_id, dataset_id, upload)


@router.get("/{org_id}/{dataset_id}/records")
async def get_records(
    request: Request,
    org_id: str,
    dataset_id: str,
    limit: int = 100,
    offset: int = 0,
    search: Optional[str] = None,
    filters: Optional[str] = None  # JSON string of filters
):
    """Get records from a dataset with pagination and search"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    query = {"_meta.is_active": True}
    
    # Apply search
    if search and dataset.get("searchable_fields"):
        search_conditions = []
        for field in dataset["searchable_fields"]:
            search_conditions.append({field: {"$regex": search, "$options": "i"}})
        query["$or"] = search_conditions
    
    # Apply filters
    if filters:
        try:
            filter_dict = json.loads(filters)
            for key, value in filter_dict.items():
                if isinstance(value, list):
                    query[key] = {"$in": value}
                else:
                    query[key] = value
        except json.JSONDecodeError:
            pass
    
    records = await collection.find(query, {"_id": 0}).skip(offset).limit(limit).to_list(limit)
    total = await collection.count_documents(query)
    
    return {
        "dataset_id": dataset_id,
        "records": records,
        "total": total,
        "limit": limit,
        "offset": offset,
        "version": dataset.get("version", 1)
    }


# ============ Typeahead Search ============

@router.get("/{org_id}/{dataset_id}/search")
async def typeahead_search(
    request: Request,
    org_id: str,
    dataset_id: str,
    q: str = Query(..., min_length=1),
    limit: int = 20,
    filter_field: Optional[str] = None,
    filter_value: Optional[str] = None
):
    """Typeahead search optimized for fast autocomplete"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    # Build search query
    searchable_fields = dataset.get("searchable_fields", ["name"])
    display_field = dataset.get("display_field", "name")
    value_field = dataset.get("value_field", "id")
    
    # Create regex search conditions
    search_conditions = []
    for field in searchable_fields:
        search_conditions.append({field: {"$regex": f"^{q}", "$options": "i"}})  # Starts with
        search_conditions.append({field: {"$regex": q, "$options": "i"}})  # Contains
    
    query = {
        "_meta.is_active": True,
        "$or": search_conditions
    }
    
    # Apply additional filter
    if filter_field and filter_value:
        query[filter_field] = filter_value
    
    # Project only needed fields for speed
    projection = {
        "_id": 0,
        "id": 1,
        display_field: 1,
        value_field: 1
    }
    
    # Add hierarchy fields if present
    if dataset.get("hierarchy_config"):
        for level in dataset["hierarchy_config"].get("levels", []):
            projection[level] = 1
    
    results = await collection.find(query, projection).limit(limit).to_list(limit)
    
    # Format for typeahead
    formatted = []
    for r in results:
        formatted.append({
            "value": r.get(value_field, r.get("id")),
            "label": r.get(display_field, str(r.get(value_field, ""))),
            "data": r
        })
    
    return {"results": formatted, "count": len(formatted)}


# ============ Hierarchical Data ============

@router.get("/{org_id}/{dataset_id}/hierarchy")
async def get_hierarchy_levels(
    request: Request,
    org_id: str,
    dataset_id: str
):
    """Get hierarchy configuration for a dataset"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    hierarchy_config = dataset.get("hierarchy_config")
    if not hierarchy_config:
        return {"message": "Dataset does not have hierarchy configured"}
    
    return {
        "dataset_id": dataset_id,
        "hierarchy": hierarchy_config
    }


@router.get("/{org_id}/{dataset_id}/hierarchy/{level}")
async def get_hierarchy_level_values(
    request: Request,
    org_id: str,
    dataset_id: str,
    level: str,
    parent_field: Optional[str] = None,
    parent_value: Optional[str] = None
):
    """Get distinct values for a hierarchy level, optionally filtered by parent"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    query = {"_meta.is_active": True}
    if parent_field and parent_value:
        query[parent_field] = parent_value
    
    # Get distinct values for the level
    values = await collection.distinct(level, query)
    
    return {
        "level": level,
        "values": sorted(values),
        "count": len(values),
        "parent_filter": {parent_field: parent_value} if parent_field else None
    }


# ============ Offline Subset Downloads ============

@router.post("/{org_id}/{dataset_id}/subset")
async def get_offline_subset(
    request: Request,
    org_id: str,
    dataset_id: str,
    subset_request: DatasetSubsetRequest
):
    """Get a subset of the dataset for offline use (e.g., only enumerator's region)"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    query = {
        "_meta.is_active": True,
        subset_request.filter_field: {"$in": subset_request.filter_values}
    }
    
    records = await collection.find(query, {"_id": 0}).to_list(10000)  # Limit for offline
    
    return {
        "dataset_id": dataset_id,
        "version": dataset.get("version", 1),
        "subset_filter": {
            "field": subset_request.filter_field,
            "values": subset_request.filter_values
        },
        "records": records,
        "record_count": len(records),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/{org_id}/{dataset_id}/offline-package")
async def get_offline_package(
    request: Request,
    org_id: str,
    dataset_id: str,
    enumerator_id: Optional[str] = None,
    region: Optional[str] = None,
    cluster: Optional[str] = None
):
    """Get a complete offline package for a dataset with optional filtering"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    query = {"_meta.is_active": True}
    
    # Apply subset filter based on offline config
    subset_field = dataset.get("offline_subset_field")
    if subset_field:
        if region:
            query[subset_field] = region
        elif cluster:
            query["cluster"] = cluster
    
    records = await collection.find(query, {"_id": 0}).to_list(50000)
    
    package = {
        "dataset_id": dataset_id,
        "dataset_name": dataset.get("name"),
        "version": dataset.get("version", 1),
        "columns": dataset.get("columns", []),
        "searchable_fields": dataset.get("searchable_fields", []),
        "display_field": dataset.get("display_field", "name"),
        "value_field": dataset.get("value_field", "id"),
        "hierarchy_config": dataset.get("hierarchy_config"),
        "records": records,
        "record_count": len(records),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters_applied": {
            "enumerator_id": enumerator_id,
            "region": region,
            "cluster": cluster
        }
    }
    
    return package


# ============ Write-Back Updates ============

@router.post("/{org_id}/{dataset_id}/records/{record_id}/write-back")
async def write_back_update(
    request: Request,
    org_id: str,
    dataset_id: str,
    record_id: str,
    update: WriteBackUpdate
):
    """Update a record based on data collection (write-back)"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    # Get current record
    record = await collection.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Log the write-back
    write_back_log = {
        "dataset_id": dataset_id,
        "record_id": record_id,
        "submission_id": update.submission_id,
        "previous_values": {k: record.get(k) for k in update.updates.keys()},
        "new_values": update.updates,
        "timestamp": datetime.now(timezone.utc)
    }
    await db.dataset_write_back_log.insert_one(write_back_log)
    
    # Apply updates
    current_version = record.get("_meta", {}).get("version", 1)
    update_doc = {
        **update.updates,
        "_meta.updated_at": datetime.now(timezone.utc),
        "_meta.version": current_version + 1,
        "_meta.last_write_back_submission": update.submission_id
    }
    
    await collection.update_one(
        {"id": record_id},
        {"$set": update_doc}
    )
    
    # Increment dataset version
    await db.lookup_datasets.update_one(
        {"id": dataset_id},
        {
            "$inc": {"version": 1},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "message": "Record updated via write-back",
        "record_id": record_id,
        "fields_updated": list(update.updates.keys())
    }


# ============ Version Sync ============

@router.get("/{org_id}/{dataset_id}/sync-status")
async def get_sync_status(
    request: Request,
    org_id: str,
    dataset_id: str,
    client_version: int = 0
):
    """Check if client needs to sync (for offline devices)"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    server_version = dataset.get("version", 1)
    needs_sync = client_version < server_version
    
    return {
        "dataset_id": dataset_id,
        "client_version": client_version,
        "server_version": server_version,
        "needs_sync": needs_sync,
        "records_changed": server_version - client_version if needs_sync else 0
    }


@router.get("/{org_id}/{dataset_id}/changes")
async def get_changes_since_version(
    request: Request,
    org_id: str,
    dataset_id: str,
    since_version: int = 0
):
    """Get records changed since a specific version (for incremental sync)"""
    db = request.app.state.db
    
    dataset = await db.lookup_datasets.find_one({"id": dataset_id, "org_id": org_id})
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    collection = db[f"dataset_{dataset_id}"]
    
    # Get records with version > since_version
    changed_records = await collection.find(
        {"_meta.version": {"$gt": since_version}},
        {"_id": 0}
    ).to_list(10000)
    
    return {
        "dataset_id": dataset_id,
        "since_version": since_version,
        "current_version": dataset.get("version", 1),
        "changed_records": changed_records,
        "change_count": len(changed_records)
    }
