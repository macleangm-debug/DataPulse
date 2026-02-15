"""DataPulse - Form Versioning Service"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import difflib
import json

from auth import get_current_user

router = APIRouter(prefix="/forms/versions", tags=["Form Versioning"])


class FormVersion(BaseModel):
    """A saved version of a form"""
    id: Optional[str] = None
    form_id: str
    version_number: int
    name: str
    description: Optional[str] = None
    fields: List[Dict[str, Any]]
    settings: Dict[str, Any] = {}
    created_by: Optional[str] = None
    created_at: Optional[str] = None


def diff_fields(old_fields: List[Dict], new_fields: List[Dict]) -> Dict:
    """Compare two versions of form fields and return differences"""
    changes = {
        "added": [],
        "removed": [],
        "modified": [],
        "unchanged": []
    }
    
    old_map = {f.get("id") or f.get("name"): f for f in old_fields}
    new_map = {f.get("id") or f.get("name"): f for f in new_fields}
    
    old_keys = set(old_map.keys())
    new_keys = set(new_map.keys())
    
    # Added fields
    for key in new_keys - old_keys:
        changes["added"].append({
            "field_id": key,
            "field": new_map[key]
        })
    
    # Removed fields
    for key in old_keys - new_keys:
        changes["removed"].append({
            "field_id": key,
            "field": old_map[key]
        })
    
    # Check for modifications in common fields
    for key in old_keys & new_keys:
        old_field = old_map[key]
        new_field = new_map[key]
        
        field_changes = []
        
        # Compare each property
        all_props = set(old_field.keys()) | set(new_field.keys())
        for prop in all_props:
            old_val = old_field.get(prop)
            new_val = new_field.get(prop)
            
            if old_val != new_val:
                field_changes.append({
                    "property": prop,
                    "old_value": old_val,
                    "new_value": new_val
                })
        
        if field_changes:
            changes["modified"].append({
                "field_id": key,
                "field_name": new_field.get("name") or old_field.get("name"),
                "changes": field_changes
            })
        else:
            changes["unchanged"].append({
                "field_id": key,
                "field_name": new_field.get("name")
            })
    
    return changes


def generate_diff_html(old_text: str, new_text: str) -> str:
    """Generate HTML diff between two text versions"""
    differ = difflib.HtmlDiff()
    return differ.make_table(
        old_text.splitlines(),
        new_text.splitlines(),
        fromdesc="Previous Version",
        todesc="Current Version"
    )


@router.get("/{form_id}")
async def get_form_versions(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all versions of a form"""
    db = request.app.state.db
    
    versions = await db.form_versions.find(
        {"form_id": form_id},
        {"_id": 0}
    ).sort("version_number", -1).to_list(100)
    
    # Get user names for versions
    for version in versions:
        if version.get("created_by"):
            user = await db.users.find_one(
                {"id": version["created_by"]},
                {"_id": 0, "full_name": 1, "email": 1}
            )
            if user:
                version["created_by_name"] = user.get("full_name") or user.get("email")
    
    return {"versions": versions, "total": len(versions)}


@router.get("/{form_id}/changelog")
async def get_version_changelog(
    request: Request,
    form_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get a changelog showing all version changes"""
    db = request.app.state.db
    
    versions = await db.form_versions.find(
        {"form_id": form_id},
        {"_id": 0}
    ).sort("version_number", -1).to_list(limit)
    
    changelog = []
    
    for i, version in enumerate(versions):
        entry = {
            "version_number": version["version_number"],
            "name": version.get("name"),
            "description": version.get("description"),
            "created_by": version.get("created_by"),
            "created_at": version.get("created_at"),
            "field_count": len(version.get("fields", []))
        }
        
        # Compare with previous version if available
        if i < len(versions) - 1:
            prev_version = versions[i + 1]
            diff = diff_fields(
                prev_version.get("fields", []),
                version.get("fields", [])
            )
            entry["changes"] = {
                "added": len(diff["added"]),
                "removed": len(diff["removed"]),
                "modified": len(diff["modified"])
            }
        
        changelog.append(entry)
    
    return {"changelog": changelog}


@router.get("/{form_id}/{version_number}")
async def get_form_version(
    request: Request,
    form_id: str,
    version_number: int,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific version of a form"""
    db = request.app.state.db
    
    version = await db.form_versions.find_one(
        {"form_id": form_id, "version_number": version_number},
        {"_id": 0}
    )
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    return version


@router.post("/{form_id}")
async def save_form_version(
    request: Request,
    form_id: str,
    description: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Save current form state as a new version"""
    db = request.app.state.db
    
    # Get current form
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Get latest version number
    latest = await db.form_versions.find_one(
        {"form_id": form_id},
        {"_id": 0, "version_number": 1},
        sort=[("version_number", -1)]
    )
    
    new_version_number = (latest["version_number"] + 1) if latest else 1
    
    # Create version record
    version_data = {
        "id": str(ObjectId()),
        "form_id": form_id,
        "version_number": new_version_number,
        "name": f"v{new_version_number}",
        "description": description or f"Version {new_version_number}",
        "fields": form.get("fields", []),
        "settings": {
            "default_language": form.get("default_language"),
            "languages": form.get("languages"),
            "validation_rules": form.get("validation_rules")
        },
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.form_versions.insert_one(version_data)
    
    # Update form with current version
    await db.forms.update_one(
        {"id": form_id},
        {"$set": {"current_version": new_version_number}}
    )
    
    return {
        "version_number": new_version_number,
        "id": version_data["id"],
        "message": "Version saved successfully"
    }


@router.get("/{form_id}/compare/{v1}/{v2}")
async def compare_versions(
    request: Request,
    form_id: str,
    v1: int,
    v2: int,
    current_user: dict = Depends(get_current_user)
):
    """Compare two versions of a form"""
    db = request.app.state.db
    
    version1 = await db.form_versions.find_one(
        {"form_id": form_id, "version_number": v1},
        {"_id": 0}
    )
    version2 = await db.form_versions.find_one(
        {"form_id": form_id, "version_number": v2},
        {"_id": 0}
    )
    
    if not version1 or not version2:
        raise HTTPException(status_code=404, detail="One or both versions not found")
    
    # Get field differences
    field_diff = diff_fields(
        version1.get("fields", []),
        version2.get("fields", [])
    )
    
    # Generate summary stats
    summary = {
        "v1_fields": len(version1.get("fields", [])),
        "v2_fields": len(version2.get("fields", [])),
        "added_count": len(field_diff["added"]),
        "removed_count": len(field_diff["removed"]),
        "modified_count": len(field_diff["modified"]),
        "unchanged_count": len(field_diff["unchanged"])
    }
    
    return {
        "version1": {
            "version_number": version1["version_number"],
            "name": version1.get("name"),
            "description": version1.get("description"),
            "created_at": version1.get("created_at"),
            "field_count": len(version1.get("fields", []))
        },
        "version2": {
            "version_number": version2["version_number"],
            "name": version2.get("name"),
            "description": version2.get("description"),
            "created_at": version2.get("created_at"),
            "field_count": len(version2.get("fields", []))
        },
        "diff": field_diff,
        "summary": summary
    }


@router.post("/{form_id}/restore/{version_number}")
async def restore_version(
    request: Request,
    form_id: str,
    version_number: int,
    current_user: dict = Depends(get_current_user)
):
    """Restore a form to a previous version"""
    db = request.app.state.db
    
    # Get the version to restore
    version = await db.form_versions.find_one(
        {"form_id": form_id, "version_number": version_number},
        {"_id": 0}
    )
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # First save current state as a new version
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    
    # Get latest version number
    latest = await db.form_versions.find_one(
        {"form_id": form_id},
        {"_id": 0, "version_number": 1},
        sort=[("version_number", -1)]
    )
    new_version_number = (latest["version_number"] + 1) if latest else 1
    
    # Save current as backup
    backup_data = {
        "id": str(ObjectId()),
        "form_id": form_id,
        "version_number": new_version_number,
        "name": f"v{new_version_number} (before restore)",
        "description": f"Auto-saved before restoring to v{version_number}",
        "fields": form.get("fields", []),
        "settings": {
            "default_language": form.get("default_language"),
            "languages": form.get("languages")
        },
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.form_versions.insert_one(backup_data)
    
    # Restore the form
    await db.forms.update_one(
        {"id": form_id},
        {"$set": {
            "fields": version.get("fields", []),
            "default_language": version.get("settings", {}).get("default_language"),
            "languages": version.get("settings", {}).get("languages"),
            "current_version": new_version_number + 1,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Save restored version
    restored_data = {
        "id": str(ObjectId()),
        "form_id": form_id,
        "version_number": new_version_number + 1,
        "name": f"v{new_version_number + 1} (restored from v{version_number})",
        "description": f"Restored from version {version_number}",
        "fields": version.get("fields", []),
        "settings": version.get("settings", {}),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.form_versions.insert_one(restored_data)
    
    return {
        "message": f"Form restored to version {version_number}",
        "new_version": new_version_number + 1,
        "backup_version": new_version_number
    }
