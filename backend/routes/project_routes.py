"""DataPulse - Project Routes"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional
from datetime import datetime, timezone

from models import Project, ProjectCreate, ProjectOut
from auth import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


async def check_org_access(db, org_id: str, user_id: str, required_roles: List[str] = None):
    """Check if user has access to organization"""
    query = {"org_id": org_id, "user_id": user_id}
    if required_roles:
        query["role"] = {"$in": required_roles}
    
    membership = await db.org_members.find_one(query, {"_id": 0})
    return membership


@router.post("", response_model=ProjectOut)
async def create_project(
    request: Request,
    data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new project"""
    db = request.app.state.db
    
    # Check org access
    membership = await check_org_access(
        db, data.org_id, current_user["user_id"],
        ["admin", "manager"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager access required"
        )
    
    # Create project
    project = Project(
        name=data.name,
        description=data.description,
        org_id=data.org_id,
        start_date=data.start_date,
        end_date=data.end_date,
        settings=data.settings,
        created_by=current_user["user_id"]
    )
    
    project_dict = project.model_dump()
    project_dict["created_at"] = project_dict["created_at"].isoformat()
    project_dict["updated_at"] = project_dict["updated_at"].isoformat()
    if project_dict.get("start_date"):
        project_dict["start_date"] = project_dict["start_date"].isoformat()
    if project_dict.get("end_date"):
        project_dict["end_date"] = project_dict["end_date"].isoformat()
    
    await db.projects.insert_one(project_dict)
    
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        org_id=project.org_id,
        status=project.status,
        start_date=project.start_date,
        end_date=project.end_date,
        created_at=project.created_at,
        form_count=0,
        submission_count=0
    )


@router.get("", response_model=List[ProjectOut])
async def list_projects(
    request: Request,
    org_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List projects in an organization"""
    db = request.app.state.db
    
    # Check org access
    membership = await check_org_access(db, org_id, current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization"
        )
    
    # Build query
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    
    projects = await db.projects.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for proj in projects:
        # Count forms and submissions
        form_count = await db.forms.count_documents({"project_id": proj["id"]})
        submission_count = await db.submissions.count_documents({"project_id": proj["id"]})
        
        result.append(ProjectOut(
            id=proj["id"],
            name=proj["name"],
            description=proj.get("description"),
            org_id=proj["org_id"],
            status=proj["status"],
            start_date=datetime.fromisoformat(proj["start_date"]) if proj.get("start_date") else None,
            end_date=datetime.fromisoformat(proj["end_date"]) if proj.get("end_date") else None,
            created_at=datetime.fromisoformat(proj["created_at"]) if isinstance(proj["created_at"], str) else proj["created_at"],
            form_count=form_count,
            submission_count=submission_count
        ))
    
    return result


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    request: Request,
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get project details"""
    db = request.app.state.db
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check org access
    membership = await check_org_access(db, project["org_id"], current_user["user_id"])
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization"
        )
    
    # Count forms and submissions
    form_count = await db.forms.count_documents({"project_id": project_id})
    submission_count = await db.submissions.count_documents({"project_id": project_id})
    
    return ProjectOut(
        id=project["id"],
        name=project["name"],
        description=project.get("description"),
        org_id=project["org_id"],
        status=project["status"],
        start_date=datetime.fromisoformat(project["start_date"]) if project.get("start_date") else None,
        end_date=datetime.fromisoformat(project["end_date"]) if project.get("end_date") else None,
        created_at=datetime.fromisoformat(project["created_at"]) if isinstance(project["created_at"], str) else project["created_at"],
        form_count=form_count,
        submission_count=submission_count
    )


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    request: Request,
    project_id: str,
    data: ProjectCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update project details"""
    db = request.app.state.db
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check org access
    membership = await check_org_access(
        db, project["org_id"], current_user["user_id"],
        ["admin", "manager"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager access required"
        )
    
    # Update
    update_data = {
        "name": data.name,
        "description": data.description,
        "settings": data.settings,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.start_date:
        update_data["start_date"] = data.start_date.isoformat()
    if data.end_date:
        update_data["end_date"] = data.end_date.isoformat()
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    project.update(update_data)
    
    form_count = await db.forms.count_documents({"project_id": project_id})
    submission_count = await db.submissions.count_documents({"project_id": project_id})
    
    return ProjectOut(
        id=project["id"],
        name=project["name"],
        description=project.get("description"),
        org_id=project["org_id"],
        status=project["status"],
        start_date=datetime.fromisoformat(project["start_date"]) if project.get("start_date") else None,
        end_date=datetime.fromisoformat(project["end_date"]) if project.get("end_date") else None,
        created_at=datetime.fromisoformat(project["created_at"]) if isinstance(project["created_at"], str) else project["created_at"],
        form_count=form_count,
        submission_count=submission_count
    )


@router.patch("/{project_id}/status")
async def update_project_status(
    request: Request,
    project_id: str,
    new_status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update project status"""
    db = request.app.state.db
    
    valid_statuses = ["draft", "active", "paused", "completed", "archived"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check org access
    membership = await check_org_access(
        db, project["org_id"], current_user["user_id"],
        ["admin", "manager"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager access required"
        )
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Status updated successfully", "status": new_status}


@router.delete("/{project_id}")
async def delete_project(
    request: Request,
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a project (archive it)"""
    db = request.app.state.db
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check org access
    membership = await check_org_access(
        db, project["org_id"], current_user["user_id"],
        ["admin"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Archive instead of delete
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"status": "archived", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Project archived successfully"}
