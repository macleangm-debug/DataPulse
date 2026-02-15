"""DataPulse - Reproducibility Pack Routes
One-click export of complete analysis bundle for reproducibility
Contains: dataset snapshot, transform scripts, analysis outputs, run logs
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import io
import json
import zipfile
import hashlib

router = APIRouter(prefix="/reproducibility", tags=["Reproducibility"])


# ============ Models ============

class CreatePackRequest(BaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    snapshot_id: Optional[str] = None
    form_id: Optional[str] = None
    analysis_ids: Optional[List[str]] = None  # AI analyses to include
    include_raw_data: bool = True
    anonymize: bool = False  # Strip PII fields
    include_scripts: bool = True
    include_outputs: bool = True


class PackContents(BaseModel):
    dataset: bool = True
    schema: bool = True
    transforms: bool = True
    scripts: bool = True
    outputs: bool = True
    logs: bool = True
    codebook: bool = True


# ============ Pack Management ============

@router.post("/pack")
async def create_reproducibility_pack(request: Request, req: CreatePackRequest):
    """Create a new reproducibility pack"""
    db = request.app.state.db
    
    pack_id = str(uuid.uuid4())
    
    # Gather all components
    components = {
        "dataset": None,
        "schema": None,
        "transforms": [],
        "analyses": [],
        "metadata": {}
    }
    
    # Get snapshot or live data
    if req.snapshot_id:
        snapshot = await db.snapshots.find_one({"id": req.snapshot_id}, {"_id": 0})
        if snapshot:
            components["dataset"] = snapshot.get("data", [])
            components["schema"] = snapshot.get("schema", [])
            components["metadata"]["snapshot_id"] = req.snapshot_id
            components["metadata"]["snapshot_created"] = snapshot.get("created_at")
    elif req.form_id:
        # Get live submissions
        submissions = await db.submissions.find(
            {"form_id": req.form_id, "status": "approved"},
            {"_id": 0}
        ).to_list(10000)
        components["dataset"] = [s.get("data", {}) for s in submissions]
        
        # Get form schema
        form = await db.forms.find_one({"id": req.form_id}, {"_id": 0})
        if form:
            components["schema"] = form.get("fields", [])
            components["metadata"]["form_id"] = req.form_id
            components["metadata"]["form_name"] = form.get("name")
    
    # Get analyses if specified
    if req.analysis_ids:
        for analysis_id in req.analysis_ids:
            analysis = await db.ai_analyses.find_one({"id": analysis_id}, {"_id": 0})
            if analysis:
                components["analyses"].append(analysis)
    
    # Anonymize if requested
    if req.anonymize and components["dataset"]:
        components["dataset"] = anonymize_data(components["dataset"], components["schema"])
    
    # Create pack record
    pack = {
        "id": pack_id,
        "org_id": req.org_id,
        "name": req.name,
        "description": req.description,
        "snapshot_id": req.snapshot_id,
        "form_id": req.form_id,
        "analysis_ids": req.analysis_ids,
        "anonymized": req.anonymize,
        "record_count": len(components["dataset"]) if components["dataset"] else 0,
        "variable_count": len(components["schema"]) if components["schema"] else 0,
        "analysis_count": len(components["analyses"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "hash": compute_pack_hash(components)
    }
    
    await db.reproducibility_packs.insert_one(pack)
    
    return {
        "pack_id": pack_id,
        "records": pack["record_count"],
        "variables": pack["variable_count"],
        "analyses": pack["analysis_count"],
        "hash": pack["hash"]
    }


@router.get("/packs/{org_id}")
async def list_packs(request: Request, org_id: str):
    """List all reproducibility packs for an organization"""
    db = request.app.state.db
    
    packs = await db.reproducibility_packs.find(
        {"org_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return packs


@router.get("/pack/{pack_id}")
async def get_pack(request: Request, pack_id: str):
    """Get pack details"""
    db = request.app.state.db
    
    pack = await db.reproducibility_packs.find_one(
        {"id": pack_id},
        {"_id": 0}
    )
    
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    
    return pack


@router.get("/pack/{pack_id}/download")
async def download_pack(request: Request, pack_id: str, format: str = "zip"):
    """Download the complete reproducibility pack"""
    db = request.app.state.db
    
    # Get pack metadata
    pack = await db.reproducibility_packs.find_one({"id": pack_id}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    
    # Gather all data
    components = await gather_pack_components(db, pack)
    
    # Create ZIP file
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # README
        readme = generate_readme(pack, components)
        zf.writestr("README.md", readme)
        
        # Dataset (CSV)
        if components["dataset"]:
            csv_content = generate_csv(components["dataset"], components["schema"])
            zf.writestr("data/dataset.csv", csv_content)
        
        # Dataset (JSON)
        if components["dataset"]:
            zf.writestr("data/dataset.json", json.dumps(components["dataset"], indent=2, default=str))
        
        # Schema/Codebook
        if components["schema"]:
            codebook = generate_codebook(components["schema"])
            zf.writestr("documentation/codebook.md", codebook)
            zf.writestr("documentation/schema.json", json.dumps(components["schema"], indent=2))
        
        # Analyses
        for i, analysis in enumerate(components.get("analyses", [])):
            analysis_file = f"analyses/analysis_{i+1}_{analysis.get('id', 'unknown')[:8]}.json"
            zf.writestr(analysis_file, json.dumps(analysis, indent=2, default=str))
        
        # Scripts (Python example)
        if components["schema"]:
            script = generate_analysis_script(pack, components)
            zf.writestr("scripts/analysis.py", script)
        
        # Metadata/Logs
        metadata = {
            "pack_id": pack["id"],
            "created_at": pack["created_at"],
            "source": {
                "snapshot_id": pack.get("snapshot_id"),
                "form_id": pack.get("form_id"),
                "form_name": components.get("form_name")
            },
            "contents": {
                "records": pack["record_count"],
                "variables": pack["variable_count"],
                "analyses": pack["analysis_count"]
            },
            "anonymized": pack.get("anonymized", False),
            "hash": pack.get("hash"),
            "software_versions": {
                "datapulse": "1.0.0",
                "python": "3.11",
                "pandas": "2.x",
                "statsmodels": "0.14.x"
            }
        }
        zf.writestr("metadata/pack_info.json", json.dumps(metadata, indent=2))
        
        # Run log
        run_log = f"""Reproducibility Pack Generation Log
====================================
Pack ID: {pack['id']}
Generated: {datetime.now(timezone.utc).isoformat()}
Organization: {pack['org_id']}

Contents:
- Records: {pack['record_count']}
- Variables: {pack['variable_count']}
- Analyses: {pack['analysis_count']}

Data Hash: {pack.get('hash', 'N/A')}
Anonymized: {pack.get('anonymized', False)}
"""
        zf.writestr("metadata/run_log.txt", run_log)
    
    zip_buffer.seek(0)
    
    filename = f"reproducibility_pack_{pack['name'].replace(' ', '_')}_{pack_id[:8]}.zip"
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.delete("/pack/{pack_id}")
async def delete_pack(request: Request, pack_id: str):
    """Delete a reproducibility pack"""
    db = request.app.state.db
    
    result = await db.reproducibility_packs.delete_one({"id": pack_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pack not found")
    
    return {"message": "Pack deleted successfully"}


# ============ Helper Functions ============

def anonymize_data(data: List[Dict], schema: List[Dict]) -> List[Dict]:
    """Remove PII fields from data"""
    pii_types = {"email", "phone", "name", "address", "gps", "photo", "audio", "video"}
    pii_fields = set()
    
    for field in schema:
        field_type = field.get("type", "").lower()
        field_id = field.get("id", "")
        
        if field_type in pii_types or any(pii in field_id.lower() for pii in ["name", "email", "phone", "address"]):
            pii_fields.add(field_id)
    
    anonymized = []
    for record in data:
        anon_record = {}
        for key, value in record.items():
            if key not in pii_fields:
                anon_record[key] = value
            else:
                anon_record[key] = "[REDACTED]"
        anonymized.append(anon_record)
    
    return anonymized


def compute_pack_hash(components: Dict) -> str:
    """Compute SHA-256 hash of pack contents for integrity verification"""
    content = json.dumps(components, sort_keys=True, default=str)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


async def gather_pack_components(db, pack: Dict) -> Dict:
    """Gather all components for a pack"""
    components = {
        "dataset": [],
        "schema": [],
        "analyses": [],
        "form_name": None
    }
    
    # Get data from snapshot or form
    if pack.get("snapshot_id"):
        snapshot = await db.snapshots.find_one({"id": pack["snapshot_id"]}, {"_id": 0})
        if snapshot:
            components["dataset"] = snapshot.get("data", [])
            components["schema"] = snapshot.get("schema", [])
    elif pack.get("form_id"):
        submissions = await db.submissions.find(
            {"form_id": pack["form_id"], "status": "approved"},
            {"_id": 0}
        ).to_list(10000)
        components["dataset"] = [s.get("data", {}) for s in submissions]
        
        form = await db.forms.find_one({"id": pack["form_id"]}, {"_id": 0})
        if form:
            components["schema"] = form.get("fields", [])
            components["form_name"] = form.get("name")
    
    # Get analyses
    if pack.get("analysis_ids"):
        for analysis_id in pack["analysis_ids"]:
            analysis = await db.ai_analyses.find_one({"id": analysis_id}, {"_id": 0})
            if analysis:
                components["analyses"].append(analysis)
    
    # Apply anonymization if needed
    if pack.get("anonymized") and components["dataset"]:
        components["dataset"] = anonymize_data(components["dataset"], components["schema"])
    
    return components


def generate_readme(pack: Dict, components: Dict) -> str:
    """Generate README.md for the pack"""
    return f"""# Reproducibility Pack: {pack.get('name', 'Unnamed')}

## Description
{pack.get('description', 'No description provided.')}

## Contents

### Data
- `data/dataset.csv` - Main dataset in CSV format
- `data/dataset.json` - Main dataset in JSON format

### Documentation
- `documentation/codebook.md` - Variable definitions and value labels
- `documentation/schema.json` - Full schema in JSON format

### Analyses
- `analyses/` - Saved analysis outputs and configurations

### Scripts
- `scripts/analysis.py` - Python script to reproduce analyses

### Metadata
- `metadata/pack_info.json` - Pack metadata and software versions
- `metadata/run_log.txt` - Generation log

## Dataset Summary
- **Records**: {pack.get('record_count', 0)}
- **Variables**: {pack.get('variable_count', 0)}
- **Anonymized**: {'Yes' if pack.get('anonymized') else 'No'}

## Data Integrity
- **Hash**: {pack.get('hash', 'N/A')}
- **Generated**: {pack.get('created_at', 'Unknown')}

## Reproduction Instructions

1. Extract the ZIP file
2. Install requirements: `pip install pandas numpy scipy statsmodels`
3. Run the analysis script: `python scripts/analysis.py`
4. Compare outputs with saved results in `analyses/`

## License
This data is provided for research purposes. Please cite appropriately.
"""


def generate_csv(data: List[Dict], schema: List[Dict]) -> str:
    """Generate CSV content from data"""
    if not data:
        return ""
    
    # Get all columns
    columns = []
    for field in schema:
        columns.append(field.get("id", f"field_{len(columns)}"))
    
    # If no schema, use keys from first record
    if not columns and data:
        columns = list(data[0].keys())
    
    # Build CSV
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction='ignore')
    writer.writeheader()
    
    for record in data:
        writer.writerow(record)
    
    return output.getvalue()


def generate_codebook(schema: List[Dict]) -> str:
    """Generate codebook markdown from schema"""
    codebook = """# Codebook

## Variable Definitions

"""
    
    for field in schema:
        codebook += f"""### {field.get('id', 'Unknown')}
- **Label**: {field.get('label', 'No label')}
- **Type**: {field.get('type', 'Unknown')}
- **Required**: {'Yes' if field.get('required') else 'No'}
"""
        
        if field.get('options'):
            codebook += "- **Value Labels**:\n"
            for opt in field.get('options', []):
                codebook += f"  - `{opt.get('value', '')}`: {opt.get('label', '')}\n"
        
        codebook += "\n"
    
    return codebook


def generate_analysis_script(pack: Dict, components: Dict) -> str:
    """Generate Python analysis script"""
    return f'''"""
Reproducibility Script for: {pack.get('name', 'Analysis')}
Generated: {datetime.now(timezone.utc).isoformat()}
Pack ID: {pack.get('id', 'Unknown')}
"""

import pandas as pd
import numpy as np
from scipy import stats
import json

# Load data
print("Loading dataset...")
df = pd.read_csv("../data/dataset.csv")
print(f"Loaded {{len(df)}} records with {{len(df.columns)}} variables")

# Load schema
with open("../documentation/schema.json", "r") as f:
    schema = json.load(f)

# Basic descriptives
print("\\n=== Descriptive Statistics ===")
print(df.describe())

# Numeric variables
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
print(f"\\nNumeric variables: {{numeric_cols}}")

# Categorical variables
categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
print(f"Categorical variables: {{categorical_cols}}")

# Frequencies for categorical variables
print("\\n=== Categorical Frequencies ===")
for col in categorical_cols[:5]:  # First 5
    print(f"\\n{{col}}:")
    print(df[col].value_counts())

# Correlations for numeric variables
if len(numeric_cols) >= 2:
    print("\\n=== Correlation Matrix ===")
    print(df[numeric_cols].corr().round(3))

print("\\n=== Analysis Complete ===")
print(f"Results can be compared with saved outputs in ../analyses/")
'''
