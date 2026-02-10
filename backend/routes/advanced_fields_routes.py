"""DataPulse - Advanced Field Types Routes
Barcode/QR Scanner, Signature Capture, and Cascading Selects
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid
import io
import base64
import json

from auth import get_current_user

router = APIRouter(prefix="/advanced-fields", tags=["Advanced Fields"])


def gen_id():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


# ============= MODELS =============

class BarcodeFormat(BaseModel):
    """Supported barcode formats"""
    format: str  # "qr", "code128", "ean13", "ean8", "upc_a", "code39", "itf", "codabar", "datamatrix"
    enabled: bool = True


class BarcodeScanConfig(BaseModel):
    """Configuration for barcode scanning on a field"""
    enabled: bool = True
    formats: List[str] = ["qr", "code128", "ean13", "code39"]
    auto_submit: bool = False  # Auto-submit form after scan
    beep_on_scan: bool = True
    vibrate_on_scan: bool = True
    continuous_scan: bool = False  # Keep scanning multiple codes
    target_field: Optional[str] = None  # Field to populate with scanned value
    validation_regex: Optional[str] = None  # Regex to validate scanned value
    prefix_filter: Optional[str] = None  # Only accept codes starting with this
    max_length: Optional[int] = None


class BarcodeScanResult(BaseModel):
    """Result of a barcode scan"""
    id: str = Field(default_factory=gen_id)
    submission_id: Optional[str] = None
    field_id: str
    form_id: str
    scanned_value: str
    format: str
    scanned_at: datetime = Field(default_factory=utc_now)
    device_id: Optional[str] = None
    location: Optional[Dict[str, float]] = None  # {lat, lng}
    is_valid: bool = True
    validation_error: Optional[str] = None


class SignatureConfig(BaseModel):
    """Configuration for signature capture field"""
    enabled: bool = True
    pen_color: str = "#000000"
    pen_width: int = 2
    background_color: str = "#ffffff"
    canvas_width: int = 400
    canvas_height: int = 200
    require_signature: bool = True
    min_points: int = 10  # Minimum points to consider valid signature
    save_as_png: bool = True
    save_as_svg: bool = False


class SignatureData(BaseModel):
    """Captured signature data"""
    id: str = Field(default_factory=gen_id)
    submission_id: Optional[str] = None
    field_id: str
    form_id: str
    image_data: str  # Base64 encoded PNG/SVG
    format: str = "png"  # "png" or "svg"
    points_count: int = 0
    captured_at: datetime = Field(default_factory=utc_now)
    device_id: Optional[str] = None
    signer_name: Optional[str] = None


class CascadingSelectConfig(BaseModel):
    """Configuration for cascading/filtered selects"""
    parent_field: str  # Field ID of parent select
    filter_column: str  # Column in choices to filter by
    choice_list: str  # Name of the choice list
    allow_other: bool = False
    other_label: str = "Other (specify)"


class CascadingSelectChoice(BaseModel):
    """A choice in a cascading select"""
    value: str
    label: str
    label_sw: Optional[str] = None  # Swahili translation
    parent_value: Optional[str] = None  # Value of parent that shows this choice
    filter_values: Dict[str, str] = Field(default_factory=dict)  # Multiple filter columns


class ChoiceList(BaseModel):
    """A reusable choice list for cascading selects"""
    id: str = Field(default_factory=gen_id)
    name: str
    org_id: str
    choices: List[CascadingSelectChoice]
    filter_columns: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AdvancedConstraint(BaseModel):
    """Advanced validation constraint"""
    type: str  # "regex", "cross_field", "calculated", "lookup"
    expression: str
    error_message: str
    error_message_sw: Optional[str] = None
    severity: str = "error"  # "error", "warning"
    # For cross_field constraints
    dependent_fields: List[str] = Field(default_factory=list)
    # For lookup constraints
    lookup_table: Optional[str] = None
    lookup_column: Optional[str] = None


# ============= BARCODE ENDPOINTS =============

@router.post("/barcode/config")
async def save_barcode_config(
    request: Request,
    form_id: str,
    field_id: str,
    config: BarcodeScanConfig,
    current_user: dict = Depends(get_current_user)
):
    """Save barcode scanning configuration for a field"""
    db = request.app.state.db
    
    config_doc = {
        "form_id": form_id,
        "field_id": field_id,
        "config": config.model_dump(),
        "updated_by": current_user["user_id"],
        "updated_at": utc_now().isoformat()
    }
    
    await db.barcode_configs.update_one(
        {"form_id": form_id, "field_id": field_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Barcode config saved"}


@router.get("/barcode/config/{form_id}/{field_id}")
async def get_barcode_config(
    request: Request,
    form_id: str,
    field_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get barcode scanning configuration for a field"""
    db = request.app.state.db
    
    config = await db.barcode_configs.find_one(
        {"form_id": form_id, "field_id": field_id},
        {"_id": 0}
    )
    
    if not config:
        return {"config": BarcodeScanConfig().model_dump()}
    
    return config


@router.post("/barcode/scan")
async def record_barcode_scan(
    request: Request,
    field_id: str = Form(...),
    form_id: str = Form(...),
    scanned_value: str = Form(...),
    format: str = Form("qr"),
    submission_id: Optional[str] = Form(None),
    device_id: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Record a barcode scan result"""
    db = request.app.state.db
    
    # Get config for validation
    config = await db.barcode_configs.find_one(
        {"form_id": form_id, "field_id": field_id},
        {"_id": 0}
    )
    
    is_valid = True
    validation_error = None
    
    if config:
        cfg = config.get("config", {})
        
        # Check format
        if cfg.get("formats") and format not in cfg["formats"]:
            is_valid = False
            validation_error = f"Format {format} not allowed"
        
        # Check prefix filter
        if cfg.get("prefix_filter") and not scanned_value.startswith(cfg["prefix_filter"]):
            is_valid = False
            validation_error = f"Value must start with {cfg['prefix_filter']}"
        
        # Check max length
        if cfg.get("max_length") and len(scanned_value) > cfg["max_length"]:
            is_valid = False
            validation_error = f"Value too long (max {cfg['max_length']} chars)"
        
        # Check regex validation
        if cfg.get("validation_regex"):
            import re
            if not re.match(cfg["validation_regex"], scanned_value):
                is_valid = False
                validation_error = "Value does not match expected pattern"
    
    scan_result = BarcodeScanResult(
        submission_id=submission_id,
        field_id=field_id,
        form_id=form_id,
        scanned_value=scanned_value,
        format=format,
        device_id=device_id,
        location={"lat": latitude, "lng": longitude} if latitude and longitude else None,
        is_valid=is_valid,
        validation_error=validation_error
    )
    
    scan_dict = scan_result.model_dump()
    scan_dict["scanned_at"] = scan_dict["scanned_at"].isoformat()
    scan_dict["user_id"] = current_user["user_id"]
    
    await db.barcode_scans.insert_one(scan_dict)
    
    return {
        "success": True,
        "scan_id": scan_result.id,
        "is_valid": is_valid,
        "validation_error": validation_error,
        "scanned_value": scanned_value
    }


@router.get("/barcode/scans")
async def list_barcode_scans(
    request: Request,
    form_id: Optional[str] = None,
    submission_id: Optional[str] = None,
    is_valid: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List barcode scan results"""
    db = request.app.state.db
    
    query = {}
    if form_id:
        query["form_id"] = form_id
    if submission_id:
        query["submission_id"] = submission_id
    if is_valid is not None:
        query["is_valid"] = is_valid
    
    scans = await db.barcode_scans.find(
        query, {"_id": 0}
    ).sort("scanned_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.barcode_scans.count_documents(query)
    
    return {"scans": scans, "total": total}


# ============= SIGNATURE ENDPOINTS =============

@router.post("/signature/config")
async def save_signature_config(
    request: Request,
    form_id: str,
    field_id: str,
    config: SignatureConfig,
    current_user: dict = Depends(get_current_user)
):
    """Save signature capture configuration for a field"""
    db = request.app.state.db
    
    config_doc = {
        "form_id": form_id,
        "field_id": field_id,
        "config": config.model_dump(),
        "updated_by": current_user["user_id"],
        "updated_at": utc_now().isoformat()
    }
    
    await db.signature_configs.update_one(
        {"form_id": form_id, "field_id": field_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Signature config saved"}


@router.get("/signature/config/{form_id}/{field_id}")
async def get_signature_config(
    request: Request,
    form_id: str,
    field_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get signature capture configuration for a field"""
    db = request.app.state.db
    
    config = await db.signature_configs.find_one(
        {"form_id": form_id, "field_id": field_id},
        {"_id": 0}
    )
    
    if not config:
        return {"config": SignatureConfig().model_dump()}
    
    return config


@router.post("/signature/capture")
async def capture_signature(
    request: Request,
    field_id: str = Form(...),
    form_id: str = Form(...),
    image_data: str = Form(...),  # Base64 encoded
    format: str = Form("png"),
    points_count: int = Form(0),
    submission_id: Optional[str] = Form(None),
    device_id: Optional[str] = Form(None),
    signer_name: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Save a captured signature"""
    db = request.app.state.db
    
    # Validate minimum points
    config = await db.signature_configs.find_one(
        {"form_id": form_id, "field_id": field_id},
        {"_id": 0}
    )
    
    if config:
        min_points = config.get("config", {}).get("min_points", 10)
        if points_count < min_points:
            raise HTTPException(
                status_code=400,
                detail=f"Signature too short (minimum {min_points} points required)"
            )
    
    signature = SignatureData(
        submission_id=submission_id,
        field_id=field_id,
        form_id=form_id,
        image_data=image_data,
        format=format,
        points_count=points_count,
        device_id=device_id,
        signer_name=signer_name
    )
    
    sig_dict = signature.model_dump()
    sig_dict["captured_at"] = sig_dict["captured_at"].isoformat()
    sig_dict["user_id"] = current_user["user_id"]
    
    await db.signatures.insert_one(sig_dict)
    
    return {
        "success": True,
        "signature_id": signature.id,
        "message": "Signature saved"
    }


@router.get("/signature/{signature_id}")
async def get_signature(
    request: Request,
    signature_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific signature"""
    db = request.app.state.db
    
    signature = await db.signatures.find_one(
        {"id": signature_id},
        {"_id": 0}
    )
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    return signature


@router.get("/signature/{signature_id}/image")
async def get_signature_image(
    request: Request,
    signature_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get signature as downloadable image"""
    db = request.app.state.db
    
    signature = await db.signatures.find_one(
        {"id": signature_id},
        {"_id": 0}
    )
    
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")
    
    image_data = signature.get("image_data", "")
    format = signature.get("format", "png")
    
    # Remove data URL prefix if present
    if "," in image_data:
        image_data = image_data.split(",")[1]
    
    content = base64.b64decode(image_data)
    
    content_type = "image/png" if format == "png" else "image/svg+xml"
    
    return StreamingResponse(
        io.BytesIO(content),
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename=signature_{signature_id}.{format}"}
    )


@router.get("/signatures")
async def list_signatures(
    request: Request,
    form_id: Optional[str] = None,
    submission_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List captured signatures"""
    db = request.app.state.db
    
    query = {}
    if form_id:
        query["form_id"] = form_id
    if submission_id:
        query["submission_id"] = submission_id
    
    # Exclude large image data from list
    signatures = await db.signatures.find(
        query, {"_id": 0, "image_data": 0}
    ).sort("captured_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.signatures.count_documents(query)
    
    return {"signatures": signatures, "total": total}


# ============= CASCADING SELECT ENDPOINTS =============

@router.post("/choice-lists")
async def create_choice_list(
    request: Request,
    name: str,
    org_id: str,
    choices: List[CascadingSelectChoice],
    filter_columns: List[str] = [],
    current_user: dict = Depends(get_current_user)
):
    """Create a reusable choice list for cascading selects"""
    db = request.app.state.db
    
    choice_list = ChoiceList(
        name=name,
        org_id=org_id,
        choices=choices,
        filter_columns=filter_columns
    )
    
    list_dict = choice_list.model_dump()
    list_dict["created_at"] = list_dict["created_at"].isoformat()
    list_dict["updated_at"] = list_dict["updated_at"].isoformat()
    list_dict["choices"] = [c.model_dump() for c in choices]
    list_dict["created_by"] = current_user["user_id"]
    
    await db.choice_lists.insert_one(list_dict)
    
    return {"success": True, "id": choice_list.id}


@router.get("/choice-lists")
async def list_choice_lists(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List all choice lists for an organization"""
    db = request.app.state.db
    
    lists = await db.choice_lists.find(
        {"org_id": org_id},
        {"_id": 0, "choices": 0}  # Exclude choices for list view
    ).to_list(100)
    
    return {"choice_lists": lists}


@router.get("/choice-lists/{list_id}")
async def get_choice_list(
    request: Request,
    list_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific choice list with all choices"""
    db = request.app.state.db
    
    choice_list = await db.choice_lists.find_one(
        {"id": list_id},
        {"_id": 0}
    )
    
    if not choice_list:
        raise HTTPException(status_code=404, detail="Choice list not found")
    
    return choice_list


@router.get("/choice-lists/{list_id}/filtered")
async def get_filtered_choices(
    request: Request,
    list_id: str,
    parent_value: Optional[str] = None,
    filter_column: Optional[str] = None,
    filter_value: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get filtered choices from a choice list (for cascading selects)"""
    db = request.app.state.db
    
    choice_list = await db.choice_lists.find_one(
        {"id": list_id},
        {"_id": 0}
    )
    
    if not choice_list:
        raise HTTPException(status_code=404, detail="Choice list not found")
    
    choices = choice_list.get("choices", [])
    
    # Filter by parent value
    if parent_value:
        choices = [c for c in choices if c.get("parent_value") == parent_value]
    
    # Filter by specific column/value
    if filter_column and filter_value:
        choices = [
            c for c in choices 
            if c.get("filter_values", {}).get(filter_column) == filter_value
        ]
    
    return {"choices": choices, "total": len(choices)}


@router.put("/choice-lists/{list_id}")
async def update_choice_list(
    request: Request,
    list_id: str,
    name: Optional[str] = None,
    choices: Optional[List[CascadingSelectChoice]] = None,
    filter_columns: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a choice list"""
    db = request.app.state.db
    
    update_data = {"updated_at": utc_now().isoformat()}
    
    if name:
        update_data["name"] = name
    if choices is not None:
        update_data["choices"] = [c.model_dump() for c in choices]
    if filter_columns is not None:
        update_data["filter_columns"] = filter_columns
    
    result = await db.choice_lists.update_one(
        {"id": list_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Choice list not found")
    
    return {"success": True, "message": "Choice list updated"}


@router.delete("/choice-lists/{list_id}")
async def delete_choice_list(
    request: Request,
    list_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a choice list"""
    db = request.app.state.db
    
    result = await db.choice_lists.delete_one({"id": list_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Choice list not found")
    
    return {"success": True, "message": "Choice list deleted"}


# ============= ADVANCED CONSTRAINTS ENDPOINTS =============

@router.post("/constraints")
async def save_field_constraints(
    request: Request,
    form_id: str,
    field_id: str,
    constraints: List[AdvancedConstraint],
    current_user: dict = Depends(get_current_user)
):
    """Save advanced constraints for a field"""
    db = request.app.state.db
    
    config_doc = {
        "form_id": form_id,
        "field_id": field_id,
        "constraints": [c.model_dump() for c in constraints],
        "updated_by": current_user["user_id"],
        "updated_at": utc_now().isoformat()
    }
    
    await db.field_constraints.update_one(
        {"form_id": form_id, "field_id": field_id},
        {"$set": config_doc},
        upsert=True
    )
    
    return {"success": True, "message": "Constraints saved"}


@router.get("/constraints/{form_id}/{field_id}")
async def get_field_constraints(
    request: Request,
    form_id: str,
    field_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get advanced constraints for a field"""
    db = request.app.state.db
    
    config = await db.field_constraints.find_one(
        {"form_id": form_id, "field_id": field_id},
        {"_id": 0}
    )
    
    if not config:
        return {"constraints": []}
    
    return config


@router.post("/constraints/validate")
async def validate_field_value(
    request: Request,
    form_id: str,
    field_id: str,
    value: Any,
    all_values: Dict[str, Any] = {},  # All field values for cross-field validation
    current_user: dict = Depends(get_current_user)
):
    """Validate a field value against its constraints"""
    db = request.app.state.db
    
    config = await db.field_constraints.find_one(
        {"form_id": form_id, "field_id": field_id},
        {"_id": 0}
    )
    
    if not config:
        return {"is_valid": True, "errors": [], "warnings": []}
    
    errors = []
    warnings = []
    
    for constraint in config.get("constraints", []):
        c_type = constraint.get("type")
        expression = constraint.get("expression", "")
        error_message = constraint.get("error_message", "Validation failed")
        severity = constraint.get("severity", "error")
        
        is_valid = True
        
        if c_type == "regex":
            import re
            try:
                if not re.match(expression, str(value)):
                    is_valid = False
            except:
                pass
        
        elif c_type == "cross_field":
            # Simple expression evaluation
            # Expression like: "field1 > field2" or "field1 + field2 <= 100"
            try:
                # Replace field references with actual values
                eval_expr = expression
                for field_name, field_value in all_values.items():
                    eval_expr = eval_expr.replace(f"${{{field_name}}}", str(field_value))
                eval_expr = eval_expr.replace("${value}", str(value))
                
                # Safe evaluation (basic operators only)
                is_valid = eval(eval_expr, {"__builtins__": {}}, {})
            except:
                pass
        
        elif c_type == "calculated":
            # Expression that must evaluate to true
            try:
                eval_expr = expression.replace("${value}", str(value))
                is_valid = eval(eval_expr, {"__builtins__": {}}, {"len": len, "int": int, "float": float})
            except:
                pass
        
        if not is_valid:
            if severity == "error":
                errors.append(error_message)
            else:
                warnings.append(error_message)
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }


@router.get("/constraints/form/{form_id}")
async def get_all_form_constraints(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all constraints for a form"""
    db = request.app.state.db
    
    constraints = await db.field_constraints.find(
        {"form_id": form_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"constraints": constraints}
