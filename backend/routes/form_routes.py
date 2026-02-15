"""DataPulse - Form Builder Routes"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel

from models import Form, FormCreate, FormOut, FormDetailOut, FormField
from auth import get_current_user

router = APIRouter(prefix="/forms", tags=["Forms"])


class FormFieldUpdate(BaseModel):
    fields: List[Dict[str, Any]]


class FormSettingsUpdate(BaseModel):
    settings: Dict[str, Any]


async def check_project_access(db, project_id: str, user_id: str, required_roles: List[str] = None):
    """Check if user has access to project's organization"""
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        return None, None
    
    query = {"org_id": project["org_id"], "user_id": user_id}
    if required_roles:
        query["role"] = {"$in": required_roles}
    
    membership = await db.org_members.find_one(query, {"_id": 0})
    return membership, project


@router.post("", response_model=FormOut)
async def create_form(
    request: Request,
    data: FormCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new form"""
    db = request.app.state.db
    
    # Check project access
    membership, project = await check_project_access(
        db, data.project_id, current_user["user_id"],
        ["admin", "manager", "analyst"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Serialize fields
    fields_data = [f.model_dump() if hasattr(f, 'model_dump') else f for f in data.fields]
    
    # Create form
    form = Form(
        name=data.name,
        description=data.description,
        project_id=data.project_id,
        org_id=project["org_id"],
        default_language=data.default_language,
        languages=data.languages,
        fields=fields_data,
        created_by=current_user["user_id"]
    )
    
    form_dict = form.model_dump()
    form_dict["created_at"] = form_dict["created_at"].isoformat()
    form_dict["updated_at"] = form_dict["updated_at"].isoformat()
    if form_dict.get("published_at"):
        form_dict["published_at"] = form_dict["published_at"].isoformat()
    
    await db.forms.insert_one(form_dict)
    
    return FormOut(
        id=form.id,
        name=form.name,
        description=form.description,
        project_id=form.project_id,
        version=form.version,
        status=form.status,
        field_count=len(form.fields),
        submission_count=0,
        created_at=form.created_at,
        updated_at=form.updated_at,
        published_at=form.published_at
    )


@router.get("", response_model=List[FormOut])
async def list_forms(
    request: Request,
    project_id: Optional[str] = None,
    org_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List forms in a project or organization"""
    db = request.app.state.db
    
    # Require at least one filter
    if not project_id and not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either project_id or org_id is required"
        )
    
    # Build query
    query = {}
    
    if project_id:
        # Check project access
        membership, project = await check_project_access(
            db, project_id, current_user["user_id"]
        )
        
        if not membership and not current_user.get("is_superadmin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization"
            )
        query["project_id"] = project_id
    
    elif org_id:
        # Check org membership
        membership = await db.org_members.find_one({
            "org_id": org_id, 
            "user_id": current_user["user_id"]
        })
        
        if not membership and not current_user.get("is_superadmin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization"
            )
        
        # Get all projects in org
        projects = await db.projects.find({"org_id": org_id}, {"id": 1}).to_list(1000)
        project_ids = [p["id"] for p in projects]
        query["project_id"] = {"$in": project_ids}
    
    if status_filter:
        query["status"] = status_filter
    
    forms = await db.forms.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for form in forms:
        submission_count = await db.submissions.count_documents({"form_id": form["id"]})
        
        result.append(FormOut(
            id=form["id"],
            name=form["name"],
            description=form.get("description"),
            project_id=form["project_id"],
            version=form["version"],
            status=form["status"],
            field_count=len(form.get("fields", [])),
            submission_count=submission_count,
            created_at=datetime.fromisoformat(form["created_at"]) if isinstance(form["created_at"], str) else form["created_at"],
            updated_at=datetime.fromisoformat(form["updated_at"]) if isinstance(form["updated_at"], str) else form["updated_at"],
            published_at=datetime.fromisoformat(form["published_at"]) if form.get("published_at") else None
        ))
    
    return result


@router.get("/{form_id}", response_model=FormDetailOut)
async def get_form(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get form details with fields"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check project access
    membership, project = await check_project_access(
        db, form["project_id"], current_user["user_id"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization"
        )
    
    submission_count = await db.submissions.count_documents({"form_id": form_id})
    
    return FormDetailOut(
        id=form["id"],
        name=form["name"],
        description=form.get("description"),
        project_id=form["project_id"],
        version=form["version"],
        status=form["status"],
        field_count=len(form.get("fields", [])),
        submission_count=submission_count,
        created_at=datetime.fromisoformat(form["created_at"]) if isinstance(form["created_at"], str) else form["created_at"],
        updated_at=datetime.fromisoformat(form["updated_at"]) if isinstance(form["updated_at"], str) else form["updated_at"],
        published_at=datetime.fromisoformat(form["published_at"]) if form.get("published_at") else None,
        fields=form.get("fields", []),
        default_language=form.get("default_language", "en"),
        languages=form.get("languages", ["en"]),
        settings=form.get("settings", {})
    )


@router.put("/{form_id}", response_model=FormOut)
async def update_form(
    request: Request,
    form_id: str,
    data: FormCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update form metadata"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check project access
    membership, project = await check_project_access(
        db, form["project_id"], current_user["user_id"],
        ["admin", "manager", "analyst"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Serialize fields
    fields_data = [f.model_dump() if hasattr(f, 'model_dump') else f for f in data.fields]
    
    # Update
    update_data = {
        "name": data.name,
        "description": data.description,
        "default_language": data.default_language,
        "languages": data.languages,
        "fields": fields_data,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.forms.update_one({"id": form_id}, {"$set": update_data})
    
    submission_count = await db.submissions.count_documents({"form_id": form_id})
    
    return FormOut(
        id=form["id"],
        name=data.name,
        description=data.description,
        project_id=form["project_id"],
        version=form["version"],
        status=form["status"],
        field_count=len(fields_data),
        submission_count=submission_count,
        created_at=datetime.fromisoformat(form["created_at"]) if isinstance(form["created_at"], str) else form["created_at"],
        updated_at=datetime.now(timezone.utc),
        published_at=datetime.fromisoformat(form["published_at"]) if form.get("published_at") else None
    )


@router.patch("/{form_id}/fields")
async def update_form_fields(
    request: Request,
    form_id: str,
    data: FormFieldUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update form fields only"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check project access
    membership, _ = await check_project_access(
        db, form["project_id"], current_user["user_id"],
        ["admin", "manager", "analyst"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    await db.forms.update_one(
        {"id": form_id},
        {"$set": {
            "fields": data.fields,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Fields updated successfully", "field_count": len(data.fields)}


@router.post("/{form_id}/publish")
async def publish_form(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Publish a form for data collection"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check project access
    membership, _ = await check_project_access(
        db, form["project_id"], current_user["user_id"],
        ["admin", "manager"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager access required"
        )
    
    # Check if form has fields
    if not form.get("fields"):
        raise HTTPException(
            status_code=400,
            detail="Cannot publish form without fields"
        )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # If already published, increment version
    new_version = form["version"]
    if form["status"] == "published":
        new_version = form["version"] + 1
        
        # Store old version
        await db.form_versions.insert_one({
            "form_id": form_id,
            "version": form["version"],
            "fields": form["fields"],
            "settings": form.get("settings", {}),
            "archived_at": now
        })
    
    await db.forms.update_one(
        {"id": form_id},
        {"$set": {
            "status": "published",
            "version": new_version,
            "published_at": now,
            "updated_at": now
        }}
    )
    
    return {
        "message": "Form published successfully",
        "version": new_version,
        "published_at": now
    }


@router.post("/{form_id}/archive")
async def archive_form(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive a form"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check project access
    membership, _ = await check_project_access(
        db, form["project_id"], current_user["user_id"],
        ["admin", "manager"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager access required"
        )
    
    await db.forms.update_one(
        {"id": form_id},
        {"$set": {
            "status": "archived",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Form archived successfully"}


@router.post("/{form_id}/duplicate", response_model=FormOut)
async def duplicate_form(
    request: Request,
    form_id: str,
    new_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Duplicate a form"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Check project access
    membership, project = await check_project_access(
        db, form["project_id"], current_user["user_id"],
        ["admin", "manager", "analyst"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    import uuid
    
    # Create new form
    new_form = Form(
        name=new_name or f"{form['name']} (Copy)",
        description=form.get("description"),
        project_id=form["project_id"],
        org_id=form["org_id"],
        default_language=form.get("default_language", "en"),
        languages=form.get("languages", ["en"]),
        fields=form.get("fields", []),
        settings=form.get("settings", {}),
        created_by=current_user["user_id"]
    )
    
    form_dict = new_form.model_dump()
    form_dict["created_at"] = form_dict["created_at"].isoformat()
    form_dict["updated_at"] = form_dict["updated_at"].isoformat()
    
    await db.forms.insert_one(form_dict)
    
    return FormOut(
        id=new_form.id,
        name=new_form.name,
        description=new_form.description,
        project_id=new_form.project_id,
        version=new_form.version,
        status=new_form.status,
        field_count=len(new_form.fields),
        submission_count=0,
        created_at=new_form.created_at,
        updated_at=new_form.updated_at,
        published_at=None
    )
