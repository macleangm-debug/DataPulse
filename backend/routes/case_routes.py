"""DataPulse - Case Management Routes"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone

from models import Case, CaseCreate, CaseOut
from auth import get_current_user

router = APIRouter(prefix="/cases", tags=["Cases"])


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


@router.post("", response_model=CaseOut)
async def create_case(
    request: Request,
    data: CaseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new case"""
    db = request.app.state.db
    
    # Check project access
    membership, project = await check_project_access(
        db, data.project_id, current_user["user_id"],
        ["admin", "manager", "analyst", "enumerator"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check for duplicate respondent ID
    existing = await db.cases.find_one(
        {"project_id": data.project_id, "respondent_id": data.respondent_id},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Respondent ID already exists in this project"
        )
    
    # Create case
    case = Case(
        respondent_id=data.respondent_id,
        name=data.name,
        metadata=data.metadata,
        org_id=project["org_id"],
        project_id=data.project_id,
        created_by=current_user["user_id"]
    )
    
    case_dict = case.model_dump()
    case_dict["created_at"] = case_dict["created_at"].isoformat()
    case_dict["updated_at"] = case_dict["updated_at"].isoformat()
    if case_dict.get("last_visit"):
        case_dict["last_visit"] = case_dict["last_visit"].isoformat()
    
    await db.cases.insert_one(case_dict)
    
    return CaseOut(
        id=case.id,
        respondent_id=case.respondent_id,
        name=case.name,
        project_id=case.project_id,
        status=case.status,
        visit_count=case.visit_count,
        last_visit=case.last_visit,
        created_at=case.created_at
    )


@router.get("", response_model=List[CaseOut])
async def list_cases(
    request: Request,
    project_id: str,
    status_filter: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user)
):
    """List cases in a project"""
    db = request.app.state.db
    
    # Check project access
    membership, project = await check_project_access(
        db, project_id, current_user["user_id"]
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    # Build query
    query = {"project_id": project_id}
    if status_filter:
        query["status"] = status_filter
    if assigned_to:
        query["assigned_to"] = assigned_to
    if search:
        query["$or"] = [
            {"respondent_id": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * page_size
    
    cases = await db.cases.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    
    return [
        CaseOut(
            id=c["id"],
            respondent_id=c["respondent_id"],
            name=c.get("name"),
            project_id=c["project_id"],
            status=c["status"],
            visit_count=c.get("visit_count", 0),
            last_visit=datetime.fromisoformat(c["last_visit"]) if c.get("last_visit") else None,
            created_at=datetime.fromisoformat(c["created_at"]) if isinstance(c["created_at"], str) else c["created_at"]
        )
        for c in cases
    ]


@router.get("/{case_id}", response_model=CaseOut)
async def get_case(
    request: Request,
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get case details"""
    db = request.app.state.db
    
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    membership = await db.org_members.find_one(
        {"org_id": case["org_id"], "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    return CaseOut(
        id=case["id"],
        respondent_id=case["respondent_id"],
        name=case.get("name"),
        project_id=case["project_id"],
        status=case["status"],
        visit_count=case.get("visit_count", 0),
        last_visit=datetime.fromisoformat(case["last_visit"]) if case.get("last_visit") else None,
        created_at=datetime.fromisoformat(case["created_at"]) if isinstance(case["created_at"], str) else case["created_at"]
    )


@router.put("/{case_id}", response_model=CaseOut)
async def update_case(
    request: Request,
    case_id: str,
    data: CaseCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update case details"""
    db = request.app.state.db
    
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    membership = await db.org_members.find_one(
        {
            "org_id": case["org_id"],
            "user_id": current_user["user_id"],
            "role": {"$in": ["admin", "manager", "analyst"]}
        },
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    
    # Update
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "name": data.name,
            "metadata": data.metadata,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    case["name"] = data.name
    
    return CaseOut(
        id=case["id"],
        respondent_id=case["respondent_id"],
        name=case.get("name"),
        project_id=case["project_id"],
        status=case["status"],
        visit_count=case.get("visit_count", 0),
        last_visit=datetime.fromisoformat(case["last_visit"]) if case.get("last_visit") else None,
        created_at=datetime.fromisoformat(case["created_at"]) if isinstance(case["created_at"], str) else case["created_at"]
    )


@router.patch("/{case_id}/status")
async def update_case_status(
    request: Request,
    case_id: str,
    new_status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update case status"""
    db = request.app.state.db
    
    valid_statuses = ["open", "in_progress", "completed", "closed"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    membership = await db.org_members.find_one(
        {"org_id": case["org_id"], "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Status updated", "status": new_status}


@router.patch("/{case_id}/assign")
async def assign_case(
    request: Request,
    case_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Assign case to an enumerator"""
    db = request.app.state.db
    
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check manager access
    membership = await db.org_members.find_one(
        {
            "org_id": case["org_id"],
            "user_id": current_user["user_id"],
            "role": {"$in": ["admin", "manager"]}
        },
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    
    # Verify assignee is org member
    assignee = await db.org_members.find_one(
        {"org_id": case["org_id"], "user_id": user_id},
        {"_id": 0}
    )
    
    if not assignee:
        raise HTTPException(
            status_code=400,
            detail="User is not a member of this organization"
        )
    
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "assigned_to": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Case assigned", "assigned_to": user_id}


@router.get("/{case_id}/submissions")
async def get_case_submissions(
    request: Request,
    case_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all submissions for a case"""
    db = request.app.state.db
    
    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check access
    membership = await db.org_members.find_one(
        {"org_id": case["org_id"], "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    submissions = await db.submissions.find(
        {"case_id": case_id},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(1000)
    
    return submissions
