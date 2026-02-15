"""DataPulse - Data Export Module
Export data in various formats with labels and codebook.

Supported formats:
- CSV (with/without labels)
- Excel (xlsx) with multiple sheets
- SPSS (.sav) with value labels
- Stata (.dta) with labels
- R (.rds) with factors
- Parquet (efficient storage)
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import pandas as pd
import numpy as np
import io
import json

router = APIRouter(prefix="/export", tags=["Data Export"])


# ============ Models ============

class ExportConfig(BaseModel):
    snapshot_id: Optional[str] = None
    form_id: Optional[str] = None
    org_id: str
    format: str = "csv"  # csv, xlsx, spss, stata, r, parquet
    variables: Optional[List[str]] = None  # None = all
    include_labels: bool = True
    include_metadata: bool = True
    include_codebook: bool = False
    anonymize: bool = False


class CodebookRequest(BaseModel):
    form_id: str
    org_id: str
    format: str = "xlsx"  # xlsx, csv, pdf


# ============ Helper Functions ============

async def get_export_data(db, config: ExportConfig):
    """Get data for export"""
    if config.snapshot_id:
        snapshot_data = await db.snapshot_data.find_one({"snapshot_id": config.snapshot_id})
        if not snapshot_data:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        data = snapshot_data.get("data", [])
        schema = snapshot_data.get("schema", [])
    else:
        submissions = await db.submissions.find({
            "form_id": config.form_id,
            "status": "approved"
        }).to_list(None)
        
        data = []
        for sub in submissions:
            row = sub.get("data", {})
            if config.include_metadata:
                row["_submission_id"] = sub.get("id")
                row["_submitted_at"] = sub.get("submitted_at").isoformat() if sub.get("submitted_at") else None
                row["_status"] = sub.get("status")
            data.append(row)
        
        form = await db.forms.find_one({"id": config.form_id})
        schema = form.get("fields", []) if form else []
    
    return data, schema


def build_labels_dict(schema: List[Dict]) -> Dict[str, Dict]:
    """Build variable and value labels from schema"""
    labels = {}
    for field in schema:
        field_id = field.get("id")
        labels[field_id] = {
            "variable_label": field.get("label", field_id),
            "value_labels": {}
        }
        
        # Value labels from options
        options = field.get("options", [])
        for opt in options:
            val = opt.get("value")
            label = opt.get("label", str(val))
            if val is not None:
                labels[field_id]["value_labels"][val] = label
    
    return labels


# ============ Export Endpoints ============

@router.post("/download")
async def export_data(
    request: Request,
    config: ExportConfig
):
    """Export data in specified format"""
    db = request.app.state.db
    
    data, schema = await get_export_data(db, config)
    
    if not data:
        raise HTTPException(status_code=404, detail="No data to export")
    
    df = pd.DataFrame(data)
    
    # Filter variables if specified
    if config.variables:
        valid_vars = [v for v in config.variables if v in df.columns]
        df = df[valid_vars]
    
    # Anonymize if requested
    if config.anonymize:
        pii_fields = [f["id"] for f in schema if f.get("pii")]
        for col in pii_fields:
            if col in df.columns:
                df[col] = "[REDACTED]"
    
    labels = build_labels_dict(schema)
    
    # Generate export based on format
    if config.format == "csv":
        return export_csv(df, labels, config.include_labels)
    
    elif config.format == "xlsx":
        return export_excel(df, labels, schema, config.include_labels, config.include_codebook)
    
    elif config.format == "spss":
        return export_spss(df, labels)
    
    elif config.format == "stata":
        return export_stata(df, labels)
    
    elif config.format == "parquet":
        return export_parquet(df)
    
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {config.format}")


def export_csv(df: pd.DataFrame, labels: Dict, include_labels: bool) -> StreamingResponse:
    """Export as CSV"""
    buffer = io.StringIO()
    
    if include_labels:
        # Create header row with labels
        header_labels = []
        for col in df.columns:
            label = labels.get(col, {}).get("variable_label", col)
            header_labels.append(f"{col} [{label}]")
        
        # Write with custom header
        df_copy = df.copy()
        df_copy.columns = header_labels
        df_copy.to_csv(buffer, index=False)
    else:
        df.to_csv(buffer, index=False)
    
    buffer.seek(0)
    
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


def export_excel(df: pd.DataFrame, labels: Dict, schema: List, include_labels: bool, include_codebook: bool) -> StreamingResponse:
    """Export as Excel with multiple sheets"""
    buffer = io.BytesIO()
    
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Main data sheet
        df.to_excel(writer, sheet_name='Data', index=False)
        
        # Variable labels sheet
        if include_labels:
            label_rows = []
            for col in df.columns:
                label_info = labels.get(col, {})
                label_rows.append({
                    "Variable": col,
                    "Label": label_info.get("variable_label", col),
                    "Type": str(df[col].dtype)
                })
            pd.DataFrame(label_rows).to_excel(writer, sheet_name='Variable Labels', index=False)
        
        # Codebook sheet
        if include_codebook:
            codebook_rows = []
            for field in schema:
                field_id = field.get("id")
                if field_id not in df.columns:
                    continue
                
                row = {
                    "Variable": field_id,
                    "Label": field.get("label", field_id),
                    "Type": field.get("type", ""),
                    "Required": "Yes" if field.get("required") else "No",
                    "Value Labels": ""
                }
                
                # Add value labels
                options = field.get("options", [])
                if options:
                    val_labels = "; ".join([f"{o.get('value')}={o.get('label', '')}" for o in options])
                    row["Value Labels"] = val_labels
                
                codebook_rows.append(row)
            
            pd.DataFrame(codebook_rows).to_excel(writer, sheet_name='Codebook', index=False)
    
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        }
    )


def export_spss(df: pd.DataFrame, labels: Dict) -> StreamingResponse:
    """Export as SPSS .sav file"""
    import pyreadstat
    import tempfile
    import os
    import re
    
    # Clean column names for SPSS compatibility (must start with letter, only letters/numbers/underscore)
    df_copy = df.copy()
    col_mapping = {}
    for col in df_copy.columns:
        clean_col = re.sub(r'^[^a-zA-Z]+', '', col)  # Remove leading non-letter chars
        clean_col = re.sub(r'[^a-zA-Z0-9_]', '_', clean_col)  # Replace invalid chars
        if not clean_col:
            clean_col = f"var_{col[:8]}"
        col_mapping[col] = clean_col
    
    df_copy.columns = [col_mapping[c] for c in df_copy.columns]
    
    # Prepare labels using cleaned column names
    column_labels = {}
    value_labels = {}
    for orig_col, new_col in col_mapping.items():
        orig_label = labels.get(orig_col, {}).get("variable_label", orig_col)
        column_labels[new_col] = orig_label
        
        col_val_labels = labels.get(orig_col, {}).get("value_labels", {})
        if col_val_labels:
            value_labels[new_col] = {str(k): v for k, v in col_val_labels.items()}
    
    # Write to temp file (pyreadstat doesn't support BytesIO)
    with tempfile.NamedTemporaryFile(suffix='.sav', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        pyreadstat.write_sav(
            df_copy,
            tmp_path,
            column_labels=column_labels,
            variable_value_labels=value_labels
        )
        
        # Read the file content
        with open(tmp_path, 'rb') as f:
            content = f.read()
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
    
    return StreamingResponse(
        iter([content]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sav"
        }
    )


def export_stata(df: pd.DataFrame, labels: Dict) -> StreamingResponse:
    """Export as Stata .dta file"""
    import pyreadstat
    import tempfile
    import os
    import re
    
    # Clean column names for Stata compatibility (must start with letter, only letters/numbers/underscore)
    df_copy = df.copy()
    col_mapping = {}
    for col in df_copy.columns:
        clean_col = re.sub(r'^[^a-zA-Z]+', '', col)  # Remove leading non-letter chars
        clean_col = re.sub(r'[^a-zA-Z0-9_]', '_', clean_col)  # Replace invalid chars
        if not clean_col:
            clean_col = f"var_{col[:8]}"
        col_mapping[col] = clean_col
    
    df_copy.columns = [col_mapping[c] for c in df_copy.columns]
    
    # Prepare labels using cleaned column names
    column_labels = {}
    value_labels = {}
    for orig_col, new_col in col_mapping.items():
        orig_label = labels.get(orig_col, {}).get("variable_label", orig_col)
        column_labels[new_col] = orig_label
        
        col_val_labels = labels.get(orig_col, {}).get("value_labels", {})
        if col_val_labels:
            value_labels[new_col] = {str(k): v for k, v in col_val_labels.items()}
    
    # Write to temp file (pyreadstat doesn't support BytesIO)
    with tempfile.NamedTemporaryFile(suffix='.dta', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        pyreadstat.write_dta(
            df_copy,
            tmp_path,
            column_labels=column_labels,
            variable_value_labels=value_labels
        )
        
        # Read the file content
        with open(tmp_path, 'rb') as f:
            content = f.read()
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
    
    return StreamingResponse(
        iter([content]),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.dta"
        }
    )


def export_parquet(df: pd.DataFrame) -> StreamingResponse:
    """Export as Parquet (efficient columnar format)"""
    buffer = io.BytesIO()
    df.to_parquet(buffer, index=False)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.parquet"
        }
    )


# ============ Codebook Generation ============

@router.post("/codebook")
async def generate_codebook(
    request: Request,
    req: CodebookRequest
):
    """Generate a detailed codebook for a form"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": req.form_id, "org_id": req.org_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    fields = form.get("fields", [])
    
    codebook_data = []
    for idx, field in enumerate(fields, 1):
        row = {
            "Position": idx,
            "Variable Name": field.get("id", ""),
            "Variable Label": field.get("label", ""),
            "Type": field.get("type", ""),
            "Required": "Yes" if field.get("required") else "No",
            "Skip Logic": field.get("relevance", ""),
            "Validation": field.get("constraint", ""),
            "Value Labels": ""
        }
        
        # Format value labels
        options = field.get("options", [])
        if options:
            val_labels = []
            for opt in options:
                val_labels.append(f"{opt.get('value', '')} = {opt.get('label', '')}")
            row["Value Labels"] = "\n".join(val_labels)
        
        codebook_data.append(row)
    
    df = pd.DataFrame(codebook_data)
    
    if req.format == "xlsx":
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Codebook', index=False)
            
            # Metadata sheet
            metadata = pd.DataFrame([
                {"Property": "Form Name", "Value": form.get("name", "")},
                {"Property": "Form ID", "Value": form.get("id", "")},
                {"Property": "Total Variables", "Value": len(fields)},
                {"Property": "Generated", "Value": datetime.now().isoformat()}
            ])
            metadata.to_excel(writer, sheet_name='Metadata', index=False)
        
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=codebook_{req.form_id}_{datetime.now().strftime('%Y%m%d')}.xlsx"
            }
        )
    
    elif req.format == "csv":
        buffer = io.StringIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)
        
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=codebook_{req.form_id}_{datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
    
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {req.format}")


# ============ Reproducibility Pack ============

@router.post("/reproducibility-pack/{snapshot_id}")
async def generate_reproducibility_pack(
    request: Request,
    snapshot_id: str,
    org_id: str
):
    """Generate a complete reproducibility pack for an analysis"""
    db = request.app.state.db
    
    # Get snapshot
    snapshot = await db.snapshots.find_one({"id": snapshot_id, "org_id": org_id})
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    snapshot_data = await db.snapshot_data.find_one({"snapshot_id": snapshot_id})
    if not snapshot_data:
        raise HTTPException(status_code=404, detail="Snapshot data not found")
    
    # Get related analyses
    analyses = await db.ai_analyses.find({"snapshot_id": snapshot_id}).to_list(100)
    
    # Create zip file
    import zipfile
    
    buffer = io.BytesIO()
    
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # README
        readme = f"""# Reproducibility Pack
Generated: {datetime.now().isoformat()}

## Contents
- data/snapshot.csv - Dataset snapshot
- data/schema.json - Variable schema
- metadata/snapshot_info.json - Snapshot metadata
- analyses/ - Analysis records and results

## Snapshot Info
- ID: {snapshot_id}
- Name: {snapshot.get('name')}
- Rows: {snapshot.get('row_count')}
- Data Hash: {snapshot.get('data_hash')}
- Schema Hash: {snapshot.get('schema_hash')}
"""
        zf.writestr("README.md", readme)
        
        # Data
        df = pd.DataFrame(snapshot_data.get("data", []))
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        zf.writestr("data/snapshot.csv", csv_buffer.getvalue())
        
        # Schema
        schema_json = json.dumps(snapshot_data.get("schema", []), indent=2)
        zf.writestr("data/schema.json", schema_json)
        
        # Metadata
        metadata = {
            "snapshot_id": snapshot_id,
            "name": snapshot.get("name"),
            "created_at": snapshot.get("created_at").isoformat() if snapshot.get("created_at") else None,
            "row_count": snapshot.get("row_count"),
            "data_hash": snapshot.get("data_hash"),
            "schema_hash": snapshot.get("schema_hash"),
            "config": snapshot.get("config")
        }
        zf.writestr("metadata/snapshot_info.json", json.dumps(metadata, indent=2))
        
        # Analyses
        for i, analysis in enumerate(analyses):
            analysis["_id"] = str(analysis.get("_id", ""))
            if analysis.get("created_at"):
                analysis["created_at"] = analysis["created_at"].isoformat()
            zf.writestr(f"analyses/analysis_{i+1}.json", json.dumps(analysis, indent=2, default=str))
    
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=reproducibility_pack_{snapshot_id}_{datetime.now().strftime('%Y%m%d')}.zip"
        }
    )
