"""DataPulse - Export Routes"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import io
import csv
import json
import pandas as pd

from models import ExportRequest, ExportJob
from auth import get_current_user
from utils.security import requires_permission, check_permission
from utils.audit import log_action

router = APIRouter(prefix="/exports", tags=["Exports"])


async def check_form_access(db, form_id: str, user_id: str):
    """Check if user has access to form's organization"""
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        return None, None
    
    membership = await db.org_members.find_one(
        {"org_id": form["org_id"], "user_id": user_id},
        {"_id": 0}
    )
    return membership, form


def flatten_dict(d: Dict, parent_key: str = '', sep: str = '.') -> Dict:
    """Flatten nested dictionary"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


@router.post("/csv")
@log_action("export_csv", target_type="form")
async def export_to_csv(
    request: Request,
    data: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Export submissions to CSV"""
    db = request.app.state.db
    
    # Check form access
    membership, form = await check_form_access(db, data.form_id, current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Build query
    query = {"form_id": data.form_id}
    query.update(data.filters)
    
    submissions = await db.submissions.find(query, {"_id": 0}).to_list(None)
    
    if not submissions:
        raise HTTPException(status_code=404, detail="No submissions found")
    
    # Get field names from form
    field_names = ["id", "submitted_by", "submitted_at", "status", "quality_score"]
    for field in form.get("fields", []):
        field_names.append(field["name"])
    
    # Create CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=field_names, extrasaction='ignore')
    writer.writeheader()
    
    for sub in submissions:
        row = {
            "id": sub["id"],
            "submitted_by": sub["submitted_by"],
            "submitted_at": sub["submitted_at"],
            "status": sub["status"],
            "quality_score": sub.get("quality_score")
        }
        # Flatten submission data
        flat_data = flatten_dict(sub.get("data", {}))
        row.update(flat_data)
        writer.writerow(row)
    
    output.seek(0)
    
    # Log export
    export_log = ExportJob(
        org_id=form["org_id"],
        user_id=current_user["user_id"],
        form_id=data.form_id,
        format="csv",
        status="completed",
        row_count=len(submissions),
        completed_at=datetime.now(timezone.utc)
    )
    log_dict = export_log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    log_dict["completed_at"] = log_dict["completed_at"].isoformat()
    await db.export_jobs.insert_one(log_dict)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={form['name'].replace(' ', '_')}_export.csv"
        }
    )


@router.post("/json")
@log_action("export_json", target_type="form")
async def export_to_json(
    request: Request,
    data: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Export submissions to JSON"""
    db = request.app.state.db
    
    # Check form access
    membership, form = await check_form_access(db, data.form_id, current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Build query
    query = {"form_id": data.form_id}
    query.update(data.filters)
    
    submissions = await db.submissions.find(query, {"_id": 0}).to_list(None)
    
    if not submissions:
        raise HTTPException(status_code=404, detail="No submissions found")
    
    # Log export
    export_log = ExportJob(
        org_id=form["org_id"],
        user_id=current_user["user_id"],
        form_id=data.form_id,
        format="json",
        status="completed",
        row_count=len(submissions),
        completed_at=datetime.now(timezone.utc)
    )
    log_dict = export_log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    log_dict["completed_at"] = log_dict["completed_at"].isoformat()
    await db.export_jobs.insert_one(log_dict)
    
    return StreamingResponse(
        iter([json.dumps(submissions, default=str, indent=2)]),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={form['name'].replace(' ', '_')}_export.json"
        }
    )


@router.post("/xlsx")
@log_action("export_excel", target_type="form")
async def export_to_xlsx(
    request: Request,
    data: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Export submissions to Excel"""
    db = request.app.state.db
    
    try:
        import xlsxwriter
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel export not available")
    
    # Check form access
    membership, form = await check_form_access(db, data.form_id, current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Build query
    query = {"form_id": data.form_id}
    query.update(data.filters)
    
    submissions = await db.submissions.find(query, {"_id": 0}).to_list(None)
    
    if not submissions:
        raise HTTPException(status_code=404, detail="No submissions found")
    
    # Get field names
    field_names = ["id", "submitted_by", "submitted_at", "status", "quality_score"]
    for field in form.get("fields", []):
        field_names.append(field["name"])
    
    # Create Excel file
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet('Submissions')
    
    # Header format
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#4F46E5',
        'font_color': 'white'
    })
    
    # Write headers
    for col, name in enumerate(field_names):
        worksheet.write(0, col, name, header_format)
    
    # Write data
    for row_num, sub in enumerate(submissions, start=1):
        worksheet.write(row_num, 0, sub["id"])
        worksheet.write(row_num, 1, sub["submitted_by"])
        worksheet.write(row_num, 2, str(sub["submitted_at"]))
        worksheet.write(row_num, 3, sub["status"])
        worksheet.write(row_num, 4, sub.get("quality_score"))
        
        flat_data = flatten_dict(sub.get("data", {}))
        for col, field_name in enumerate(field_names[5:], start=5):
            value = flat_data.get(field_name, "")
            worksheet.write(row_num, col, str(value) if value else "")
    
    workbook.close()
    output.seek(0)
    
    # Log export
    export_log = ExportJob(
        org_id=form["org_id"],
        user_id=current_user["user_id"],
        form_id=data.form_id,
        format="xlsx",
        status="completed",
        row_count=len(submissions),
        completed_at=datetime.now(timezone.utc)
    )
    log_dict = export_log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    log_dict["completed_at"] = log_dict["completed_at"].isoformat()
    await db.export_jobs.insert_one(log_dict)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={form['name'].replace(' ', '_')}_export.xlsx"
        }
    )


@router.post("/parquet")
@log_action("export_parquet", target_type="form")
async def export_to_parquet(
    request: Request,
    data: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Export data as Parquet format (efficient columnar storage)"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": data.form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Build query
    query = {"form_id": data.form_id, "is_deleted": {"$ne": True}}
    if data.filters:
        for f in data.filters:
            query[f"data.{f.field}"] = f.value
    
    submissions = await db.responses.find(query, {"_id": 0}).to_list(None)
    
    if not submissions:
        raise HTTPException(status_code=404, detail="No data to export")
    
    # Create DataFrame
    rows = []
    for sub in submissions:
        row = {"response_id": sub.get("id", "")}
        row.update(sub.get("data", {}))
        row["submitted_at"] = sub.get("created_at", "")
        rows.append(row)
    
    df = pd.DataFrame(rows)
    
    # Export to Parquet
    output = io.BytesIO()
    df.to_parquet(output, engine='pyarrow', index=False)
    output.seek(0)
    
    # Log export
    export_log = ExportJob(
        org_id=form["org_id"],
        user_id=current_user["user_id"],
        form_id=data.form_id,
        format="parquet",
        status="completed",
        row_count=len(submissions),
        completed_at=datetime.now(timezone.utc)
    )
    log_dict = export_log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    log_dict["completed_at"] = log_dict["completed_at"].isoformat()
    await db.export_jobs.insert_one(log_dict)
    
    return StreamingResponse(
        output,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename={form['name'].replace(' ', '_')}_export.parquet"
        }
    )


@router.get("/history")
async def get_export_history(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get export history for an organization"""
    db = request.app.state.db
    
    # Check org access
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    exports = await db.export_jobs.find(
        {"org_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    # Enrich with form names
    result = []
    for exp in exports:
        form = await db.forms.find_one({"id": exp["form_id"]}, {"_id": 0, "name": 1})
        result.append({
            **exp,
            "form_name": form["name"] if form else "Unknown"
        })
    
    return result


@router.post("/stata")
async def export_to_stata(
    request: Request,
    data: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Export submissions to Stata format (.do file with data import script)"""
    db = request.app.state.db
    
    # Check form access
    membership, form = await check_form_access(db, data.form_id, current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Build query
    query = {"form_id": data.form_id}
    query.update(data.filters)
    
    submissions = await db.submissions.find(query, {"_id": 0}).to_list(None)
    
    if not submissions:
        raise HTTPException(status_code=404, detail="No submissions found")
    
    # Get field info
    field_info = []
    for field in form.get("fields", []):
        field_info.append({
            "name": field["name"],
            "type": field["type"],
            "label": field.get("label", field["name"]),
            "options": field.get("options", [])
        })
    
    form_name = form['name'].replace(' ', '_')
    
    # Generate Stata do-file
    do_file = f"""* DataPulse Export - Stata Import Script
* Form: {form['name']}
* Export Date: {datetime.now(timezone.utc).isoformat()}
* Total Records: {len(submissions)}

* Step 1: Import the CSV data (export CSV first, then run this script)
* import delimited "{form_name}_export.csv", clear

* Alternatively, input data directly:
clear
input str20 id str30 submitted_by str25 submitted_at str10 status quality_score """
    
    # Add field variable definitions
    for field in field_info:
        if field["type"] in ["text", "textarea", "select", "radio"]:
            do_file += f"str100 {field['name']} "
        elif field["type"] in ["number", "calculate"]:
            do_file += f"{field['name']} "
        elif field["type"] == "date":
            do_file += f"str10 {field['name']} "
        elif field["type"] == "gps":
            do_file += f"double {field['name']}_lat double {field['name']}_lng "
    
    do_file += "\n"
    
    # Add sample data rows (first 10)
    for sub in submissions[:10]:
        row = f'"{sub["id"]}" "{sub.get("submitted_by", "")}" "{sub.get("submitted_at", "")}" "{sub.get("status", "")}" {sub.get("quality_score", 0)} '
        flat_data = flatten_dict(sub.get("data", {}))
        for field in field_info:
            val = flat_data.get(field["name"], "")
            if field["type"] in ["text", "textarea", "select", "radio", "date"]:
                row += f'"{val}" '
            elif field["type"] == "gps" and isinstance(val, dict):
                row += f'{val.get("latitude", 0)} {val.get("longitude", 0)} '
            else:
                row += f'{val if val else 0} '
        do_file += row + "\n"
    
    do_file += """end

* Variable labels
label variable id "Submission ID"
label variable submitted_by "Submitted By"
label variable submitted_at "Submission Date/Time"
label variable status "Submission Status"
label variable quality_score "Quality Score (0-100)"
"""
    
    # Add field labels
    for field in field_info:
        do_file += f'label variable {field["name"]} "{field["label"]}"\n'
    
    # Add value labels for select/radio fields
    for field in field_info:
        if field["type"] in ["select", "radio"] and field["options"]:
            label_name = f'{field["name"]}_lbl'
            do_file += f'\nlabel define {label_name} '
            for i, opt in enumerate(field["options"], 1):
                opt_label = opt.get("label", opt.get("value", str(i)))
                do_file += f'{i} "{opt_label}" '
            do_file += f'\nencode {field["name"]}, gen({field["name"]}_coded) label({label_name})\n'
    
    do_file += f"""
* Save as Stata format
save "{form_name}_data.dta", replace

* Summary statistics
describe
summarize
"""
    
    # Log export
    export_log = ExportJob(
        org_id=form["org_id"],
        user_id=current_user["user_id"],
        form_id=data.form_id,
        format="stata",
        status="completed",
        row_count=len(submissions),
        completed_at=datetime.now(timezone.utc)
    )
    log_dict = export_log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    log_dict["completed_at"] = log_dict["completed_at"].isoformat()
    await db.export_jobs.insert_one(log_dict)
    
    return StreamingResponse(
        iter([do_file]),
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename={form_name}_import.do"
        }
    )


@router.post("/spss")
async def export_to_spss(
    request: Request,
    data: ExportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Export submissions to SPSS format (.sps syntax file)"""
    db = request.app.state.db
    
    # Check form access
    membership, form = await check_form_access(db, data.form_id, current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Build query
    query = {"form_id": data.form_id}
    query.update(data.filters)
    
    submissions = await db.submissions.find(query, {"_id": 0}).to_list(None)
    
    if not submissions:
        raise HTTPException(status_code=404, detail="No submissions found")
    
    # Get field info
    field_info = []
    for field in form.get("fields", []):
        field_info.append({
            "name": field["name"],
            "type": field["type"],
            "label": field.get("label", field["name"]),
            "options": field.get("options", [])
        })
    
    form_name = form['name'].replace(' ', '_')
    
    # Generate SPSS syntax
    spss_syntax = f"""* DataPulse Export - SPSS Syntax File
* Form: {form['name']}
* Export Date: {datetime.now(timezone.utc).isoformat()}
* Total Records: {len(submissions)}

* Define variable list
DATA LIST FREE / id (A20) submitted_by (A50) submitted_at (A25) status (A15) quality_score (F3) """
    
    # Add field definitions
    for field in field_info:
        if field["type"] in ["text", "textarea"]:
            spss_syntax += f"{field['name']} (A200) "
        elif field["type"] in ["select", "radio"]:
            spss_syntax += f"{field['name']} (A100) "
        elif field["type"] in ["number", "calculate"]:
            spss_syntax += f"{field['name']} (F10.2) "
        elif field["type"] == "date":
            spss_syntax += f"{field['name']} (A10) "
        elif field["type"] == "checkbox":
            spss_syntax += f"{field['name']} (A200) "
    
    spss_syntax += ".\n\nBEGIN DATA\n"
    
    # Add data rows
    for sub in submissions:
        row = f"{sub['id']} {sub.get('submitted_by', 'NA')} {sub.get('submitted_at', 'NA')} {sub.get('status', 'NA')} {sub.get('quality_score', 0)} "
        flat_data = flatten_dict(sub.get("data", {}))
        for field in field_info:
            val = flat_data.get(field["name"], "")
            if val is None:
                val = ""
            if isinstance(val, (list, dict)):
                val = json.dumps(val)
            row += f"{str(val).replace(' ', '_')[:100] if val else 'NA'} "
        spss_syntax += row + "\n"
    
    spss_syntax += """END DATA.

* Variable labels
VARIABLE LABELS
    id 'Submission ID'
    submitted_by 'Submitted By'
    submitted_at 'Submission Date/Time'
    status 'Submission Status'
    quality_score 'Quality Score (0-100)'
"""
    
    # Add field labels
    for field in field_info:
        spss_syntax += f"    {field['name']} '{field['label']}'\n"
    
    spss_syntax += ".\n"
    
    # Add value labels for categorical fields
    for field in field_info:
        if field["type"] in ["select", "radio"] and field["options"]:
            spss_syntax += f"\nVALUE LABELS {field['name']}\n"
            for opt in field["options"]:
                opt_val = opt.get("value", "")
                opt_label = opt.get("label", opt_val)
                spss_syntax += f"    '{opt_val}' '{opt_label}'\n"
            spss_syntax += ".\n"
    
    spss_syntax += f"""
* Descriptive statistics
DESCRIPTIVES VARIABLES=quality_score
    /STATISTICS=MEAN STDDEV MIN MAX.

FREQUENCIES VARIABLES=status
    /ORDER=ANALYSIS.

* Save the data file
SAVE OUTFILE='{form_name}_data.sav'.
"""
    
    # Log export
    export_log = ExportJob(
        org_id=form["org_id"],
        user_id=current_user["user_id"],
        form_id=data.form_id,
        format="spss",
        status="completed",
        row_count=len(submissions),
        completed_at=datetime.now(timezone.utc)
    )
    log_dict = export_log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    log_dict["completed_at"] = log_dict["completed_at"].isoformat()
    await db.export_jobs.insert_one(log_dict)
    
    return StreamingResponse(
        iter([spss_syntax]),
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename={form_name}_import.sps"
        }
    )


@router.get("/formats")
async def get_export_formats():
    """Get available export formats"""
    return {
        "formats": [
            {
                "id": "csv",
                "name": "CSV",
                "extension": ".csv",
                "description": "Comma-separated values, compatible with Excel and most tools"
            },
            {
                "id": "xlsx",
                "name": "Excel",
                "extension": ".xlsx",
                "description": "Microsoft Excel format with formatting support"
            },
            {
                "id": "json",
                "name": "JSON",
                "extension": ".json",
                "description": "JavaScript Object Notation for developers"
            },
            {
                "id": "stata",
                "name": "Stata",
                "extension": ".do",
                "description": "Stata do-file for statistical analysis"
            },
            {
                "id": "spss",
                "name": "SPSS",
                "extension": ".sps",
                "description": "SPSS syntax file for statistical analysis"
            }
        ]
    }

