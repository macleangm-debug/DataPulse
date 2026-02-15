"""DataPulse - Organization Routes"""
from fastapi import APIRouter, HTTPException, status, Request, Depends
from typing import List, Optional
from datetime import datetime, timezone
import re

from models import (
    Organization, OrganizationCreate, OrganizationOut,
    OrgMember, OrgMemberOut, UserOut
)
from auth import get_current_user

router = APIRouter(prefix="/organizations", tags=["Organizations"])


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


@router.post("", response_model=OrganizationOut)
async def create_organization(
    request: Request,
    data: OrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new organization"""
    db = request.app.state.db
    
    # Generate slug if not provided
    slug = data.slug or slugify(data.name)
    
    # Check slug uniqueness
    existing = await db.organizations.find_one({"slug": slug}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization slug already exists"
        )
    
    # Create organization
    org = Organization(
        name=data.name,
        slug=slug,
        description=data.description,
        logo=data.logo,
        settings=data.settings,
        created_by=current_user["user_id"]
    )
    
    org_dict = org.model_dump()
    org_dict["created_at"] = org_dict["created_at"].isoformat()
    org_dict["updated_at"] = org_dict["updated_at"].isoformat()
    
    await db.organizations.insert_one(org_dict)
    
    # Add creator as admin
    member = OrgMember(
        org_id=org.id,
        user_id=current_user["user_id"],
        role="admin"
    )
    member_dict = member.model_dump()
    member_dict["joined_at"] = member_dict["joined_at"].isoformat()
    
    await db.org_members.insert_one(member_dict)
    
    return OrganizationOut(
        id=org.id,
        name=org.name,
        slug=org.slug,
        description=org.description,
        logo=org.logo,
        is_active=org.is_active,
        created_at=org.created_at
    )


@router.get("", response_model=List[OrganizationOut])
async def list_organizations(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """List organizations the user belongs to"""
    db = request.app.state.db
    
    # Get user's org memberships
    memberships = await db.org_members.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    org_ids = [m["org_id"] for m in memberships]
    
    if not org_ids:
        return []
    
    # Get organizations
    orgs = await db.organizations.find(
        {"id": {"$in": org_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return [
        OrganizationOut(
            id=org["id"],
            name=org["name"],
            slug=org["slug"],
            description=org.get("description"),
            logo=org.get("logo"),
            is_active=org["is_active"],
            created_at=datetime.fromisoformat(org["created_at"]) if isinstance(org["created_at"], str) else org["created_at"]
        )
        for org in orgs
    ]


@router.get("/{org_id}", response_model=OrganizationOut)
async def get_organization(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get organization details"""
    db = request.app.state.db
    
    # Check membership
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization"
        )
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return OrganizationOut(
        id=org["id"],
        name=org["name"],
        slug=org["slug"],
        description=org.get("description"),
        logo=org.get("logo"),
        is_active=org["is_active"],
        created_at=datetime.fromisoformat(org["created_at"]) if isinstance(org["created_at"], str) else org["created_at"]
    )


@router.put("/{org_id}", response_model=OrganizationOut)
async def update_organization(
    request: Request,
    org_id: str,
    data: OrganizationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update organization details"""
    db = request.app.state.db
    
    # Check admin role
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"], "role": "admin"},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Update
    update_data = {
        "name": data.name,
        "description": data.description,
        "logo": data.logo,
        "settings": data.settings,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.organizations.update_one({"id": org_id}, {"$set": update_data})
    
    org.update(update_data)
    
    return OrganizationOut(
        id=org["id"],
        name=org["name"],
        slug=org["slug"],
        description=org.get("description"),
        logo=org.get("logo"),
        is_active=org["is_active"],
        created_at=datetime.fromisoformat(org["created_at"]) if isinstance(org["created_at"], str) else org["created_at"]
    )


@router.get("/{org_id}/members", response_model=List[OrgMemberOut])
async def list_org_members(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """List organization members"""
    db = request.app.state.db
    
    # Check membership
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization"
        )
    
    members = await db.org_members.find({"org_id": org_id}, {"_id": 0}).to_list(1000)
    
    result = []
    for member in members:
        user = await db.users.find_one({"id": member["user_id"]}, {"_id": 0})
        if user:
            result.append(OrgMemberOut(
                id=member["id"],
                user=UserOut(
                    id=user["id"],
                    email=user["email"],
                    name=user["name"],
                    avatar=user.get("avatar"),
                    locale=user.get("locale", "en"),
                    is_superadmin=user.get("is_superadmin", False)
                ),
                role=member["role"],
                joined_at=datetime.fromisoformat(member["joined_at"]) if isinstance(member["joined_at"], str) else member["joined_at"]
            ))
    
    return result


@router.post("/{org_id}/members")
async def add_org_member(
    request: Request,
    org_id: str,
    email: str,
    role: str = "viewer",
    current_user: dict = Depends(get_current_user)
):
    """Add a member to organization"""
    db = request.app.state.db
    
    # Check admin role
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"], "role": {"$in": ["admin", "manager"]}},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or manager access required"
        )
    
    # Find user by email
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already member
    existing = await db.org_members.find_one(
        {"org_id": org_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already a member")
    
    # Add member
    member = OrgMember(
        org_id=org_id,
        user_id=user["id"],
        role=role,
        invited_by=current_user["user_id"]
    )
    member_dict = member.model_dump()
    member_dict["joined_at"] = member_dict["joined_at"].isoformat()
    
    await db.org_members.insert_one(member_dict)
    
    return {"message": "Member added successfully", "member_id": member.id}


@router.delete("/{org_id}/members/{member_id}")
async def remove_org_member(
    request: Request,
    org_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from organization"""
    db = request.app.state.db
    
    # Check admin role
    membership = await db.org_members.find_one(
        {"org_id": org_id, "user_id": current_user["user_id"], "role": "admin"},
        {"_id": 0}
    )
    
    if not membership and not current_user.get("is_superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    result = await db.org_members.delete_one({"id": member_id, "org_id": org_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return {"message": "Member removed successfully"}
