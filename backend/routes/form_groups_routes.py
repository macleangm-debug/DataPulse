"""DataPulse - Form Groups/Folders Routes
Organize forms hierarchically with folders
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

from auth import get_current_user

router = APIRouter(prefix="/form-groups", tags=["Form Groups"])


def gen_id():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


# ============= MODELS =============

class FormGroup(BaseModel):
    """A folder/group for organizing forms"""
    id: str = Field(default_factory=gen_id)
    name: str
    description: Optional[str] = None
    org_id: str
    parent_id: Optional[str] = None  # For nested groups
    color: Optional[str] = None  # Hex color for UI
    icon: Optional[str] = None  # Icon name
    order: int = 0
    created_by: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    is_archived: bool = False
    settings: Dict[str, Any] = Field(default_factory=dict)


class FormGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    order: int = 0


class FormGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    is_archived: Optional[bool] = None


class FormGroupOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    parent_id: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    order: int
    form_count: int = 0
    child_count: int = 0
    created_at: datetime
    is_archived: bool


class FormGroupTree(BaseModel):
    """Hierarchical tree structure of form groups"""
    id: str
    name: str
    description: Optional[str]
    color: Optional[str]
    icon: Optional[str]
    form_count: int = 0
    children: List["FormGroupTree"] = []
    forms: List[Dict[str, Any]] = []


class MoveFormRequest(BaseModel):
    form_id: str
    target_group_id: Optional[str] = None  # None = move to root


class BulkMoveFormsRequest(BaseModel):
    form_ids: List[str]
    target_group_id: Optional[str] = None


# ============= ENDPOINTS =============

@router.post("", response_model=FormGroupOut, status_code=status.HTTP_201_CREATED)
async def create_form_group(
    request: Request,
    data: FormGroupCreate,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Create a new form group/folder"""
    db = request.app.state.db
    
    # Verify org membership
    membership = await db.org_members.find_one({
        "org_id": org_id,
        "user_id": current_user["user_id"]
    })
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    # Verify parent exists if specified
    if data.parent_id:
        parent = await db.form_groups.find_one({"id": data.parent_id, "org_id": org_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent group not found")
    
    group = FormGroup(
        name=data.name,
        description=data.description,
        org_id=org_id,
        parent_id=data.parent_id,
        color=data.color,
        icon=data.icon,
        order=data.order,
        created_by=current_user["user_id"]
    )
    
    group_dict = group.model_dump()
    group_dict["created_at"] = group_dict["created_at"].isoformat()
    group_dict["updated_at"] = group_dict["updated_at"].isoformat()
    
    await db.form_groups.insert_one(group_dict)
    
    return FormGroupOut(
        id=group.id,
        name=group.name,
        description=group.description,
        parent_id=group.parent_id,
        color=group.color,
        icon=group.icon,
        order=group.order,
        form_count=0,
        child_count=0,
        created_at=group.created_at,
        is_archived=group.is_archived
    )


@router.get("")
async def list_form_groups(
    request: Request,
    org_id: str,
    parent_id: Optional[str] = None,
    include_archived: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List form groups at a specific level"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    
    if parent_id:
        query["parent_id"] = parent_id
    else:
        query["$or"] = [{"parent_id": None}, {"parent_id": {"$exists": False}}]
    
    if not include_archived:
        query["is_archived"] = {"$ne": True}
    
    groups = await db.form_groups.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    # Enrich with counts
    for group in groups:
        # Count forms in this group
        form_count = await db.forms.count_documents({"group_id": group["id"]})
        group["form_count"] = form_count
        
        # Count child groups
        child_count = await db.form_groups.count_documents({"parent_id": group["id"]})
        group["child_count"] = child_count
    
    return {"groups": groups}


@router.get("/tree")
async def get_form_groups_tree(
    request: Request,
    org_id: str,
    include_forms: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get hierarchical tree of all form groups"""
    db = request.app.state.db
    
    # Get all groups
    groups = await db.form_groups.find(
        {"org_id": org_id, "is_archived": {"$ne": True}},
        {"_id": 0}
    ).to_list(500)
    
    # Get all forms if requested
    forms = []
    if include_forms:
        forms = await db.forms.find(
            {"org_id": org_id},
            {"_id": 0, "id": 1, "name": 1, "status": 1, "group_id": 1}
        ).to_list(500)
    
    # Build lookup
    group_lookup = {g["id"]: g for g in groups}
    
    # Build tree
    def build_node(group):
        node = {
            "id": group["id"],
            "name": group["name"],
            "description": group.get("description"),
            "color": group.get("color"),
            "icon": group.get("icon"),
            "children": [],
            "forms": []
        }
        
        # Add child groups
        for g in groups:
            if g.get("parent_id") == group["id"]:
                node["children"].append(build_node(g))
        
        # Add forms
        if include_forms:
            node["forms"] = [f for f in forms if f.get("group_id") == group["id"]]
        
        node["form_count"] = len(node["forms"])
        
        return node
    
    # Build root level
    tree = []
    for group in groups:
        if not group.get("parent_id"):
            tree.append(build_node(group))
    
    # Add ungrouped forms
    ungrouped_forms = []
    if include_forms:
        ungrouped_forms = [f for f in forms if not f.get("group_id")]
    
    return {
        "tree": tree,
        "ungrouped_forms": ungrouped_forms,
        "total_groups": len(groups),
        "total_forms": len(forms)
    }


@router.get("/{group_id}")
async def get_form_group(
    request: Request,
    group_id: str,
    include_forms: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific form group with its contents"""
    db = request.app.state.db
    
    group = await db.form_groups.find_one({"id": group_id}, {"_id": 0})
    
    if not group:
        raise HTTPException(status_code=404, detail="Form group not found")
    
    # Get child groups
    children = await db.form_groups.find(
        {"parent_id": group_id, "is_archived": {"$ne": True}},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get forms if requested
    forms = []
    if include_forms:
        forms = await db.forms.find(
            {"group_id": group_id},
            {"_id": 0, "id": 1, "name": 1, "description": 1, "status": 1, "version": 1, "created_at": 1}
        ).to_list(100)
    
    # Get breadcrumb path
    breadcrumb = []
    current = group
    while current:
        breadcrumb.insert(0, {"id": current["id"], "name": current["name"]})
        if current.get("parent_id"):
            current = await db.form_groups.find_one({"id": current["parent_id"]}, {"_id": 0})
        else:
            current = None
    
    return {
        "group": group,
        "children": children,
        "forms": forms,
        "breadcrumb": breadcrumb,
        "form_count": len(forms),
        "child_count": len(children)
    }


@router.put("/{group_id}")
async def update_form_group(
    request: Request,
    group_id: str,
    data: FormGroupUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a form group"""
    db = request.app.state.db
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Prevent circular parent reference
    if "parent_id" in update_data and update_data["parent_id"]:
        if update_data["parent_id"] == group_id:
            raise HTTPException(status_code=400, detail="Group cannot be its own parent")
        
        # Check if target parent is a descendant
        async def is_descendant(parent_id, target_id):
            if parent_id == target_id:
                return True
            children = await db.form_groups.find(
                {"parent_id": parent_id},
                {"_id": 0, "id": 1}
            ).to_list(100)
            for child in children:
                if await is_descendant(child["id"], target_id):
                    return True
            return False
        
        if await is_descendant(group_id, update_data["parent_id"]):
            raise HTTPException(status_code=400, detail="Cannot move group to its descendant")
    
    update_data["updated_at"] = utc_now().isoformat()
    
    result = await db.form_groups.update_one(
        {"id": group_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form group not found")
    
    return {"success": True, "message": "Form group updated"}


@router.delete("/{group_id}")
async def delete_form_group(
    request: Request,
    group_id: str,
    move_contents_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Delete a form group (optionally move contents)"""
    db = request.app.state.db
    
    # Check if group has contents
    form_count = await db.forms.count_documents({"group_id": group_id})
    child_count = await db.form_groups.count_documents({"parent_id": group_id})
    
    if form_count > 0 or child_count > 0:
        if move_contents_to:
            # Move forms to target group
            await db.forms.update_many(
                {"group_id": group_id},
                {"$set": {"group_id": move_contents_to}}
            )
            
            # Move child groups to target
            await db.form_groups.update_many(
                {"parent_id": group_id},
                {"$set": {"parent_id": move_contents_to}}
            )
        else:
            # Move to root (ungroup)
            await db.forms.update_many(
                {"group_id": group_id},
                {"$unset": {"group_id": ""}}
            )
            
            # Move child groups to root
            await db.form_groups.update_many(
                {"parent_id": group_id},
                {"$unset": {"parent_id": ""}}
            )
    
    result = await db.form_groups.delete_one({"id": group_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Form group not found")
    
    return {"success": True, "message": "Form group deleted"}


@router.post("/{group_id}/archive")
async def archive_form_group(
    request: Request,
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive a form group"""
    db = request.app.state.db
    
    result = await db.form_groups.update_one(
        {"id": group_id},
        {"$set": {"is_archived": True, "updated_at": utc_now().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form group not found")
    
    return {"success": True, "message": "Form group archived"}


@router.post("/{group_id}/unarchive")
async def unarchive_form_group(
    request: Request,
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unarchive a form group"""
    db = request.app.state.db
    
    result = await db.form_groups.update_one(
        {"id": group_id},
        {"$set": {"is_archived": False, "updated_at": utc_now().isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Form group not found")
    
    return {"success": True, "message": "Form group unarchived"}


# ============= FORM ASSIGNMENT ENDPOINTS =============

@router.post("/move-form")
async def move_form_to_group(
    request: Request,
    data: MoveFormRequest,
    current_user: dict = Depends(get_current_user)
):
    """Move a form to a different group"""
    db = request.app.state.db
    
    # Verify form exists
    form = await db.forms.find_one({"id": data.form_id}, {"_id": 0, "id": 1})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Verify target group exists if specified
    if data.target_group_id:
        group = await db.form_groups.find_one({"id": data.target_group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Target group not found")
        
        await db.forms.update_one(
            {"id": data.form_id},
            {"$set": {"group_id": data.target_group_id}}
        )
    else:
        # Move to root (ungroup)
        await db.forms.update_one(
            {"id": data.form_id},
            {"$unset": {"group_id": ""}}
        )
    
    return {"success": True, "message": "Form moved"}


@router.post("/move-forms-bulk")
async def move_forms_bulk(
    request: Request,
    data: BulkMoveFormsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Move multiple forms to a group"""
    db = request.app.state.db
    
    # Verify target group if specified
    if data.target_group_id:
        group = await db.form_groups.find_one({"id": data.target_group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Target group not found")
        
        result = await db.forms.update_many(
            {"id": {"$in": data.form_ids}},
            {"$set": {"group_id": data.target_group_id}}
        )
    else:
        result = await db.forms.update_many(
            {"id": {"$in": data.form_ids}},
            {"$unset": {"group_id": ""}}
        )
    
    return {"success": True, "moved_count": result.modified_count}


@router.put("/reorder")
async def reorder_groups(
    request: Request,
    org_id: str,
    order: List[Dict[str, Any]],  # [{"id": "...", "order": 0}, ...]
    current_user: dict = Depends(get_current_user)
):
    """Reorder form groups"""
    db = request.app.state.db
    
    for item in order:
        await db.form_groups.update_one(
            {"id": item["id"], "org_id": org_id},
            {"$set": {"order": item["order"]}}
        )
    
    return {"success": True, "message": "Groups reordered"}
