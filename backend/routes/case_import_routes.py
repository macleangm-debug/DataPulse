"""DataPulse - Case Import Routes for batch CSV import"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import csv
import io
import json
from bson import ObjectId

from auth import get_current_user

router = APIRouter(prefix="/cases", tags=["Cases"])


def generate_case_id():
    """Generate a unique case ID"""
    return f"CASE-{str(ObjectId())[:8].upper()}"


@router.post("/import/preview")
async def preview_csv_import(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Preview CSV file before importing cases"""
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    
    try:
        # Try to detect encoding
        try:
            decoded = content.decode('utf-8')
        except UnicodeDecodeError:
            decoded = content.decode('latin-1')
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(decoded))
        rows = list(reader)
        
        if not rows:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        # Get column headers
        headers = list(rows[0].keys())
        
        # Detect potential field mappings
        field_suggestions = {}
        common_fields = {
            'case_id': ['case_id', 'caseid', 'id', 'case_number', 'case_no'],
            'subject_id': ['subject_id', 'subjectid', 'respondent_id', 'participant_id', 'subject'],
            'subject_name': ['name', 'subject_name', 'full_name', 'participant_name', 'respondent_name'],
            'status': ['status', 'case_status', 'state'],
            'priority': ['priority', 'urgency', 'importance'],
            'category': ['category', 'type', 'case_type', 'classification'],
            'assigned_to': ['assigned_to', 'assignee', 'owner', 'handler'],
            'description': ['description', 'notes', 'details', 'summary'],
            'location': ['location', 'address', 'region', 'area'],
            'phone': ['phone', 'telephone', 'mobile', 'contact'],
            'email': ['email', 'email_address'],
            'created_date': ['created_date', 'created_at', 'date', 'submission_date', 'open_date']
        }
        
        for field_name, possible_names in common_fields.items():
            for header in headers:
                if header.lower().replace('_', '').replace(' ', '') in [n.replace('_', '') for n in possible_names]:
                    field_suggestions[field_name] = header
                    break
        
        return {
            "filename": file.filename,
            "total_rows": len(rows),
            "headers": headers,
            "field_suggestions": field_suggestions,
            "sample_data": rows[:5],  # First 5 rows as preview
            "detected_encoding": "utf-8"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")


@router.post("/import")
async def import_cases_from_csv(
    request: Request,
    file: UploadFile = File(...),
    org_id: str = Form(...),
    project_id: Optional[str] = Form(None),
    field_mapping: str = Form(...),  # JSON string of field mappings
    skip_duplicates: bool = Form(True),
    update_existing: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """Import cases from CSV file"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Parse field mapping
    try:
        mapping = json.loads(field_mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid field mapping JSON")
    
    content = await file.read()
    
    try:
        decoded = content.decode('utf-8')
    except UnicodeDecodeError:
        decoded = content.decode('latin-1')
    
    reader = csv.DictReader(io.StringIO(decoded))
    rows = list(reader)
    
    results = {
        "total": len(rows),
        "imported": 0,
        "updated": 0,
        "skipped": 0,
        "errors": []
    }
    
    imported_cases = []
    
    for row_num, row in enumerate(rows, start=2):  # Start at 2 (header is row 1)
        try:
            # Map fields
            case_data = {
                "id": generate_case_id(),
                "org_id": org_id,
                "project_id": project_id,
                "created_by": current_user["user_id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "status": "open",
                "priority": "medium",
                "custom_fields": {}
            }
            
            # Apply field mapping
            for target_field, source_field in mapping.items():
                if source_field and source_field in row:
                    value = row[source_field]
                    
                    if target_field in ['case_id', 'subject_id', 'subject_name', 'status', 
                                       'priority', 'category', 'assigned_to', 'description',
                                       'location', 'phone', 'email']:
                        case_data[target_field] = value
                    elif target_field == 'created_date':
                        case_data['created_at'] = value
                    else:
                        # Store unmapped fields as custom fields
                        case_data['custom_fields'][target_field] = value
            
            # Store remaining unmapped columns as custom fields
            for header, value in row.items():
                if header not in mapping.values() and value:
                    case_data['custom_fields'][header] = value
            
            # Check for duplicates
            if skip_duplicates or update_existing:
                existing = None
                if 'subject_id' in case_data and case_data['subject_id']:
                    existing = await db.cases.find_one({
                        "org_id": org_id,
                        "subject_id": case_data['subject_id']
                    })
                
                if existing:
                    if update_existing:
                        # Update existing case
                        await db.cases.update_one(
                            {"id": existing["id"]},
                            {"$set": {
                                **{k: v for k, v in case_data.items() if k not in ['id', 'created_at', 'created_by']},
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        results["updated"] += 1
                        continue
                    else:
                        results["skipped"] += 1
                        continue
            
            # Insert new case
            await db.cases.insert_one(case_data)
            imported_cases.append(case_data["id"])
            results["imported"] += 1
            
        except Exception as e:
            results["errors"].append({
                "row": row_num,
                "error": str(e)
            })
    
    # Log import
    import_log = {
        "id": str(ObjectId()),
        "org_id": org_id,
        "user_id": current_user["user_id"],
        "filename": file.filename,
        "results": results,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_logs.insert_one(import_log)
    
    return {
        "success": True,
        "results": results,
        "imported_case_ids": imported_cases[:10]  # Return first 10 IDs
    }


@router.get("/import/template")
async def get_import_template():
    """Get CSV template for case import"""
    
    template_content = """case_id,subject_id,subject_name,status,priority,category,assigned_to,description,location,phone,email,created_date,custom_field_1,custom_field_2
CASE-001,SUBJ-001,John Doe,open,high,Support,user@example.com,Initial case description,New York,+1234567890,john@example.com,2024-01-15,value1,value2
CASE-002,SUBJ-002,Jane Smith,in_progress,medium,Inquiry,user@example.com,Follow-up required,Los Angeles,+1987654321,jane@example.com,2024-01-16,value3,value4"""
    
    return {
        "template": template_content,
        "instructions": {
            "required_fields": ["subject_id OR subject_name"],
            "optional_fields": ["case_id", "status", "priority", "category", "assigned_to", "description", "location", "phone", "email", "created_date"],
            "status_values": ["open", "in_progress", "pending", "resolved", "closed"],
            "priority_values": ["low", "medium", "high", "urgent"],
            "notes": [
                "If case_id is not provided, one will be generated automatically",
                "Custom fields can be added as additional columns",
                "Date format should be YYYY-MM-DD",
                "Duplicate subjects can be skipped or updated based on import settings"
            ]
        }
    }


@router.get("/import/history")
async def get_import_history(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get case import history for an organization"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    imports = await db.import_logs.find(
        {"org_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"imports": imports}
