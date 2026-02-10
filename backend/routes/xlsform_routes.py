"""DataPulse - XLSForm Import/Export Routes
Enables migration from SurveyCTO and other ODK-compatible platforms
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import io
import json
import uuid

from auth import get_current_user

router = APIRouter(prefix="/xlsform", tags=["XLSForm"])


# XLSForm type mappings
XLSFORM_TO_DATAPULSE = {
    "text": "text",
    "integer": "number",
    "decimal": "number",
    "date": "date",
    "datetime": "datetime",
    "time": "time",
    "select_one": "select",
    "select_multiple": "multiselect",
    "note": "note",
    "geopoint": "gps",
    "geotrace": "gps",
    "geoshape": "gps",
    "image": "photo",
    "audio": "audio",
    "video": "video",
    "barcode": "barcode",
    "calculate": "calculate",
    "acknowledge": "checkbox",
    "hidden": "text",
    "xml-external": "text",
    "start": "datetime",
    "end": "datetime",
    "today": "date",
    "deviceid": "text",
    "subscriberid": "text",
    "simserial": "text",
    "phonenumber": "text",
    "username": "text",
    "email": "text",
    "file": "photo",
    "range": "number",
    "rank": "multiselect",
}

DATAPULSE_TO_XLSFORM = {v: k for k, v in XLSFORM_TO_DATAPULSE.items()}
DATAPULSE_TO_XLSFORM.update({
    "select": "select_one",
    "multiselect": "select_multiple",
    "photo": "image",
    "textarea": "text",
    "radio": "select_one",
    "group": "begin_group",
    "repeat": "begin_repeat",
    "signature": "image",
})


class XLSFormImportResult(BaseModel):
    success: bool
    form_id: Optional[str] = None
    form_name: Optional[str] = None
    field_count: int = 0
    warnings: List[str] = []
    errors: List[str] = []


class XLSFormExportRequest(BaseModel):
    form_id: str
    include_choices: bool = True
    include_settings: bool = True


def parse_xlsform_type(xls_type: str) -> tuple:
    """Parse XLSForm type string into type and list_name"""
    if not xls_type:
        return "text", None
    
    parts = xls_type.strip().split()
    base_type = parts[0].lower()
    list_name = parts[1] if len(parts) > 1 else None
    
    return base_type, list_name


def parse_constraint(constraint: str) -> Dict[str, Any]:
    """Parse XLSForm constraint into validation rules"""
    validation = {}
    
    if not constraint:
        return validation
    
    constraint = constraint.strip()
    
    # Parse common constraint patterns
    if ">=" in constraint:
        parts = constraint.split(">=")
        if len(parts) == 2:
            try:
                validation["min_value"] = float(parts[1].strip().replace(".", "").replace(",", ".") or parts[1].strip())
            except:
                pass
    
    if "<=" in constraint:
        parts = constraint.split("<=")
        if len(parts) == 2:
            try:
                validation["max_value"] = float(parts[1].strip().replace(".", "").replace(",", ".") or parts[1].strip())
            except:
                pass
    
    if "regex(" in constraint.lower():
        import re
        match = re.search(r"regex\s*\(\s*\.\s*,\s*['\"](.+?)['\"]\s*\)", constraint, re.IGNORECASE)
        if match:
            validation["pattern"] = match.group(1)
    
    if "string-length" in constraint.lower():
        import re
        # Match string-length(.) <= 100 or string-length(.) >= 5
        matches = re.findall(r"string-length\s*\(\s*\.\s*\)\s*([<>=]+)\s*(\d+)", constraint, re.IGNORECASE)
        for op, val in matches:
            val = int(val)
            if "<=" in op or "<" in op:
                validation["max_length"] = val
            elif ">=" in op or ">" in op:
                validation["min_length"] = val
    
    return validation


def parse_relevant(relevant: str, field_name: str) -> Optional[Dict[str, Any]]:
    """Parse XLSForm relevant expression into show logic"""
    if not relevant:
        return None
    
    logic = {}
    relevant = relevant.strip()
    
    # Parse common patterns like ${field} = 'value' or ${field} = 1
    import re
    
    # Pattern: ${field_name} = 'value' or ${field_name} = value
    match = re.search(r"\$\{([^}]+)\}\s*(=|!=|>|<|>=|<=)\s*['\"]?([^'\"]+)['\"]?", relevant)
    if match:
        logic["show_if"] = match.group(1)
        operator_map = {
            "=": "eq",
            "!=": "neq",
            ">": "gt",
            "<": "lt",
            ">=": "gte",
            "<=": "lte"
        }
        logic["operator"] = operator_map.get(match.group(2), "eq")
        value = match.group(3).strip()
        # Try to convert to number
        try:
            value = float(value) if "." in value else int(value)
        except:
            pass
        logic["show_value"] = value
        return logic
    
    # Pattern: selected(${field}, 'value')
    match = re.search(r"selected\s*\(\s*\$\{([^}]+)\}\s*,\s*['\"]([^'\"]+)['\"]\s*\)", relevant)
    if match:
        logic["show_if"] = match.group(1)
        logic["operator"] = "contains"
        logic["show_value"] = match.group(2)
        return logic
    
    return None


def convert_xlsform_to_datapulse(survey_data: List[Dict], choices_data: List[Dict], settings_data: Dict) -> Dict[str, Any]:
    """Convert XLSForm data to DataPulse form format"""
    
    # Build choices lookup
    choices_lookup = {}
    for choice in choices_data:
        list_name = choice.get("list_name", choice.get("list name", ""))
        if list_name:
            if list_name not in choices_lookup:
                choices_lookup[list_name] = []
            choices_lookup[list_name].append({
                "value": str(choice.get("name", choice.get("value", ""))),
                "label": choice.get("label", choice.get("label::English", choice.get("label::en", ""))),
                "label_sw": choice.get("label::Swahili", choice.get("label::sw", ""))
            })
    
    # Convert survey rows to fields
    fields = []
    warnings = []
    group_stack = []  # Track nested groups
    
    for idx, row in enumerate(survey_data):
        xls_type = row.get("type", "")
        if not xls_type:
            continue
        
        base_type, list_name = parse_xlsform_type(xls_type)
        
        # Handle group/repeat begin/end
        if base_type in ["begin_group", "begin group"]:
            group_id = str(uuid.uuid4())
            group_stack.append(group_id)
            fields.append({
                "id": group_id,
                "type": "group",
                "name": row.get("name", f"group_{idx}"),
                "label": row.get("label", row.get("label::English", row.get("label::en", ""))),
                "label_sw": row.get("label::Swahili", row.get("label::sw", "")),
                "hint": row.get("hint", ""),
                "order": idx,
                "parent_id": group_stack[-2] if len(group_stack) > 1 else None
            })
            continue
        
        if base_type in ["end_group", "end group", "end_repeat", "end repeat"]:
            if group_stack:
                group_stack.pop()
            continue
        
        if base_type in ["begin_repeat", "begin repeat"]:
            group_id = str(uuid.uuid4())
            group_stack.append(group_id)
            fields.append({
                "id": group_id,
                "type": "repeat",
                "name": row.get("name", f"repeat_{idx}"),
                "label": row.get("label", row.get("label::English", row.get("label::en", ""))),
                "label_sw": row.get("label::Swahili", row.get("label::sw", "")),
                "hint": row.get("hint", ""),
                "order": idx,
                "parent_id": group_stack[-2] if len(group_stack) > 1 else None
            })
            continue
        
        # Map type
        dp_type = XLSFORM_TO_DATAPULSE.get(base_type, "text")
        if base_type not in XLSFORM_TO_DATAPULSE:
            warnings.append(f"Unknown type '{base_type}' at row {idx+1}, defaulting to text")
        
        # Build field
        field = {
            "id": str(uuid.uuid4()),
            "type": dp_type,
            "name": row.get("name", f"field_{idx}"),
            "label": row.get("label", row.get("label::English", row.get("label::en", ""))),
            "label_sw": row.get("label::Swahili", row.get("label::sw", "")),
            "hint": row.get("hint", row.get("hint::English", row.get("hint::en", ""))),
            "hint_sw": row.get("hint::Swahili", row.get("hint::sw", "")),
            "default_value": row.get("default", None),
            "calculation": row.get("calculation", None),
            "appearance": row.get("appearance", None),
            "order": idx,
            "parent_id": group_stack[-1] if group_stack else None,
            "options": [],
            "validation": {
                "required": row.get("required", "").lower() in ["yes", "true", "1"]
            }
        }
        
        # Add choices if applicable
        if list_name and list_name in choices_lookup:
            field["options"] = choices_lookup[list_name]
        
        # Parse constraint
        constraint = row.get("constraint", "")
        if constraint:
            field["validation"].update(parse_constraint(constraint))
            field["validation"]["custom_error"] = row.get("constraint_message", 
                row.get("constraint_message::English", ""))
        
        # Parse relevance/show logic
        relevant = row.get("relevant", "")
        if relevant:
            logic = parse_relevant(relevant, field["name"])
            if logic:
                field["logic"] = logic
        
        fields.append(field)
    
    # Build form settings
    form_settings = {
        "form_title": settings_data.get("form_title", "Imported Form"),
        "form_id": settings_data.get("form_id", str(uuid.uuid4())),
        "version": settings_data.get("version", "1"),
        "default_language": settings_data.get("default_language", "English"),
        "style": settings_data.get("style", ""),
    }
    
    return {
        "fields": fields,
        "settings": form_settings,
        "warnings": warnings
    }


def convert_datapulse_to_xlsform(form: Dict[str, Any]) -> Dict[str, List[Dict]]:
    """Convert DataPulse form to XLSForm format"""
    
    survey = []
    choices = []
    settings = []
    
    choice_lists_added = set()
    
    # Add settings
    settings.append({
        "form_title": form.get("name", "Exported Form"),
        "form_id": form.get("id", str(uuid.uuid4())),
        "version": str(form.get("version", 1)),
        "default_language": form.get("default_language", "en"),
    })
    
    # Convert fields
    for field in form.get("fields", []):
        dp_type = field.get("type", "text")
        xls_type = DATAPULSE_TO_XLSFORM.get(dp_type, "text")
        
        # Handle select types with choices
        if dp_type in ["select", "radio"]:
            list_name = f"{field.get('name', 'list')}_choices"
            xls_type = f"select_one {list_name}"
            
            if list_name not in choice_lists_added:
                for opt in field.get("options", []):
                    choices.append({
                        "list_name": list_name,
                        "name": opt.get("value", ""),
                        "label": opt.get("label", ""),
                        "label::Swahili": opt.get("label_sw", "")
                    })
                choice_lists_added.add(list_name)
        
        elif dp_type == "multiselect":
            list_name = f"{field.get('name', 'list')}_choices"
            xls_type = f"select_multiple {list_name}"
            
            if list_name not in choice_lists_added:
                for opt in field.get("options", []):
                    choices.append({
                        "list_name": list_name,
                        "name": opt.get("value", ""),
                        "label": opt.get("label", ""),
                        "label::Swahili": opt.get("label_sw", "")
                    })
                choice_lists_added.add(list_name)
        
        elif dp_type == "group":
            survey.append({
                "type": "begin_group",
                "name": field.get("name", ""),
                "label": field.get("label", ""),
                "label::Swahili": field.get("label_sw", ""),
            })
            continue
        
        elif dp_type == "repeat":
            survey.append({
                "type": "begin_repeat",
                "name": field.get("name", ""),
                "label": field.get("label", ""),
                "label::Swahili": field.get("label_sw", ""),
            })
            continue
        
        # Build survey row
        row = {
            "type": xls_type,
            "name": field.get("name", ""),
            "label": field.get("label", ""),
            "label::Swahili": field.get("label_sw", ""),
            "hint": field.get("hint", ""),
            "hint::Swahili": field.get("hint_sw", ""),
            "default": field.get("default_value", ""),
            "appearance": field.get("appearance", ""),
            "calculation": field.get("calculation", ""),
        }
        
        # Build constraint
        validation = field.get("validation", {})
        constraints = []
        
        if validation.get("min_value") is not None:
            constraints.append(f". >= {validation['min_value']}")
        if validation.get("max_value") is not None:
            constraints.append(f". <= {validation['max_value']}")
        if validation.get("pattern"):
            constraints.append(f"regex(., '{validation['pattern']}')")
        if validation.get("min_length"):
            constraints.append(f"string-length(.) >= {validation['min_length']}")
        if validation.get("max_length"):
            constraints.append(f"string-length(.) <= {validation['max_length']}")
        
        if constraints:
            row["constraint"] = " and ".join(constraints)
            row["constraint_message"] = validation.get("custom_error", "")
        
        row["required"] = "yes" if validation.get("required") else ""
        
        # Build relevant
        logic = field.get("logic")
        if logic and logic.get("show_if"):
            operator_map = {
                "eq": "=",
                "neq": "!=",
                "gt": ">",
                "lt": "<",
                "gte": ">=",
                "lte": "<=",
                "contains": "selected"
            }
            op = operator_map.get(logic.get("operator", "eq"), "=")
            value = logic.get("show_value", "")
            if isinstance(value, str):
                value = f"'{value}'"
            
            if op == "selected":
                row["relevant"] = f"selected(${{{logic['show_if']}}}, {value})"
            else:
                row["relevant"] = f"${{{logic['show_if']}}} {op} {value}"
        
        survey.append(row)
    
    # Close any open groups (simplified - assumes proper nesting)
    
    return {
        "survey": survey,
        "choices": choices,
        "settings": settings
    }


@router.post("/import", response_model=XLSFormImportResult)
async def import_xlsform(
    request: Request,
    file: UploadFile = File(...),
    project_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Import an XLSForm Excel file and create a DataPulse form"""
    db = request.app.state.db
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="File must be an Excel file (.xlsx or .xls)"
        )
    
    try:
        import pandas as pd
        
        # Read Excel file
        content = await file.read()
        excel_file = io.BytesIO(content)
        
        # Read sheets
        try:
            survey_df = pd.read_excel(excel_file, sheet_name="survey")
            excel_file.seek(0)
        except:
            raise HTTPException(status_code=400, detail="Missing 'survey' sheet in XLSForm")
        
        try:
            excel_file.seek(0)
            choices_df = pd.read_excel(excel_file, sheet_name="choices")
        except:
            choices_df = pd.DataFrame()
        
        try:
            excel_file.seek(0)
            settings_df = pd.read_excel(excel_file, sheet_name="settings")
        except:
            settings_df = pd.DataFrame()
        
        # Convert DataFrames to dicts
        survey_data = survey_df.fillna("").to_dict("records")
        choices_data = choices_df.fillna("").to_dict("records") if not choices_df.empty else []
        settings_data = settings_df.fillna("").to_dict("records")[0] if not settings_df.empty else {}
        
        # Convert to DataPulse format
        result = convert_xlsform_to_datapulse(survey_data, choices_data, settings_data)
        
        # Get project info
        if project_id:
            project = await db.projects.find_one({"id": project_id}, {"_id": 0})
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            org_id = project["org_id"]
        else:
            # Get user's default org
            membership = await db.org_members.find_one(
                {"user_id": current_user["user_id"]},
                {"_id": 0}
            )
            if not membership:
                raise HTTPException(status_code=400, detail="No organization found")
            org_id = membership["org_id"]
            
            # Create a default project if none specified
            project_id = str(uuid.uuid4())
        
        # Create form
        form_name = result["settings"].get("form_title", file.filename.replace(".xlsx", "").replace(".xls", ""))
        form_id = str(uuid.uuid4())
        
        form_doc = {
            "id": form_id,
            "name": form_name,
            "description": f"Imported from XLSForm: {file.filename}",
            "project_id": project_id,
            "org_id": org_id,
            "version": 1,
            "fields": result["fields"],
            "created_by": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "published_at": None,
            "status": "draft",
            "settings": result["settings"],
            "default_language": "en",
            "languages": ["en", "sw"],
            "import_source": "xlsform",
            "import_filename": file.filename
        }
        
        await db.forms.insert_one(form_doc)
        
        return XLSFormImportResult(
            success=True,
            form_id=form_id,
            form_name=form_name,
            field_count=len(result["fields"]),
            warnings=result["warnings"],
            errors=[]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        return XLSFormImportResult(
            success=False,
            errors=[str(e)],
            warnings=[]
        )


@router.get("/export/{form_id}")
async def export_xlsform(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Export a DataPulse form as XLSForm Excel file"""
    db = request.app.state.db
    
    # Get form
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    try:
        import pandas as pd
        
        # Convert to XLSForm format
        xlsform_data = convert_datapulse_to_xlsform(form)
        
        # Create Excel file
        output = io.BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Survey sheet
            survey_df = pd.DataFrame(xlsform_data["survey"])
            survey_df.to_excel(writer, sheet_name="survey", index=False)
            
            # Choices sheet
            if xlsform_data["choices"]:
                choices_df = pd.DataFrame(xlsform_data["choices"])
                choices_df.to_excel(writer, sheet_name="choices", index=False)
            
            # Settings sheet
            if xlsform_data["settings"]:
                settings_df = pd.DataFrame(xlsform_data["settings"])
                settings_df.to_excel(writer, sheet_name="settings", index=False)
        
        output.seek(0)
        
        filename = f"{form.get('name', 'form').replace(' ', '_')}_xlsform.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/template")
async def download_xlsform_template():
    """Download a blank XLSForm template"""
    try:
        import pandas as pd
        
        output = io.BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Survey sheet with example rows
            survey_data = [
                {"type": "start", "name": "start_time", "label": "", "hint": "", "required": "", "constraint": "", "relevant": ""},
                {"type": "end", "name": "end_time", "label": "", "hint": "", "required": "", "constraint": "", "relevant": ""},
                {"type": "text", "name": "respondent_name", "label": "What is your name?", "hint": "Enter full name", "required": "yes", "constraint": "", "relevant": ""},
                {"type": "integer", "name": "age", "label": "What is your age?", "hint": "", "required": "yes", "constraint": ". >= 0 and . <= 120", "relevant": ""},
                {"type": "select_one gender", "name": "gender", "label": "Gender", "hint": "", "required": "yes", "constraint": "", "relevant": ""},
                {"type": "select_multiple services", "name": "services_used", "label": "Which services have you used?", "hint": "Select all that apply", "required": "", "constraint": "", "relevant": ""},
                {"type": "geopoint", "name": "location", "label": "Record GPS location", "hint": "", "required": "", "constraint": "", "relevant": ""},
                {"type": "image", "name": "photo", "label": "Take a photo", "hint": "", "required": "", "constraint": "", "relevant": ""},
            ]
            pd.DataFrame(survey_data).to_excel(writer, sheet_name="survey", index=False)
            
            # Choices sheet
            choices_data = [
                {"list_name": "gender", "name": "male", "label": "Male"},
                {"list_name": "gender", "name": "female", "label": "Female"},
                {"list_name": "gender", "name": "other", "label": "Other"},
                {"list_name": "services", "name": "health", "label": "Health services"},
                {"list_name": "services", "name": "education", "label": "Education"},
                {"list_name": "services", "name": "water", "label": "Water & Sanitation"},
            ]
            pd.DataFrame(choices_data).to_excel(writer, sheet_name="choices", index=False)
            
            # Settings sheet
            settings_data = [
                {"form_title": "Sample Survey", "form_id": "sample_survey", "version": "1", "default_language": "English"}
            ]
            pd.DataFrame(settings_data).to_excel(writer, sheet_name="settings", index=False)
        
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=xlsform_template.xlsx"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template generation failed: {str(e)}")
