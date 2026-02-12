"""
Mobile Data Collection Routes for Enumerators
Supports both authenticated and token-based access
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import hashlib

router = APIRouter(prefix="/collect", tags=["Mobile Collection"])

# Pydantic models
class EnumeratorLogin(BaseModel):
    email: EmailStr
    password: str
    device_id: Optional[str] = None

class EnumeratorLoginResponse(BaseModel):
    access_token: str
    enumerator: Dict[str, Any]
    assigned_forms: List[Dict[str, Any]]

class TokenInfo(BaseModel):
    token: str
    enumerator_name: str
    enumerator_id: str
    org_id: str
    assigned_forms: List[Dict[str, Any]]
    expires_at: Optional[str] = None

class CreateTokenRequest(BaseModel):
    enumerator_id: str
    form_ids: List[str]
    expires_hours: Optional[int] = 72  # Default 3 days

class SubmissionData(BaseModel):
    form_id: str
    responses: Dict[str, Any]
    device_info: Optional[Dict[str, Any]] = None
    gps_location: Optional[Dict[str, float]] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class SyncRequest(BaseModel):
    submissions: List[Dict[str, Any]]
    device_id: str

# Helper functions
def get_db(request: Request):
    return request.app.state.db

def generate_collect_token():
    """Generate a secure collection token"""
    return secrets.token_urlsafe(32)

def hash_password(password: str) -> str:
    """Simple password hashing"""
    return hashlib.sha256(password.encode()).hexdigest()

# ==================== OPTION A: Authenticated Collection ====================

@router.post("/login", response_model=EnumeratorLoginResponse)
async def enumerator_login(login_data: EnumeratorLogin, request: Request):
    """
    Simple login for enumerators - returns token and assigned forms
    Mobile-optimized endpoint
    """
    db = get_db(request)
    
    # Find enumerator by email
    enumerator = await db.enumerators.find_one({"email": login_data.email.lower()})
    print(f"Login attempt: {login_data.email.lower()}, found enumerator: {enumerator is not None}")
    
    if not enumerator:
        # Also check users collection for enumerator role
        user = await db.users.find_one({
            "email": login_data.email.lower(),
            "role": {"$in": ["enumerator", "field_worker", "data_collector"]}
        })
        if user:
            enumerator = user
    
    if not enumerator:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    stored_password = enumerator.get("password_hash") or enumerator.get("password")
    input_hash = hash_password(login_data.password)
    print(f"Password check: stored={stored_password[:20]}..., input_hash={input_hash[:20]}...")
    
    if stored_password != input_hash:
        # Also try plain comparison for demo accounts
        if stored_password != login_data.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get assigned forms
    enumerator_id = str(enumerator.get("_id", enumerator.get("id")))
    org_id = enumerator.get("org_id")
    
    assigned_forms = await get_assigned_forms(db, enumerator_id, org_id)
    
    # Generate session token
    session_token = generate_collect_token()
    
    # Store session
    await db.collect_sessions.insert_one({
        "token": session_token,
        "enumerator_id": enumerator_id,
        "org_id": org_id,
        "device_id": login_data.device_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "authenticated"
    })
    
    return {
        "access_token": session_token,
        "enumerator": {
            "id": enumerator_id,
            "name": enumerator.get("name", enumerator.get("full_name", "Enumerator")),
            "email": enumerator.get("email"),
            "org_id": org_id
        },
        "assigned_forms": assigned_forms
    }

@router.get("/forms")
async def get_enumerator_forms(
    request: Request,
    authorization: str = Query(..., description="Bearer token from login")
):
    """Get forms assigned to the authenticated enumerator"""
    db = get_db(request)
    
    # Extract token
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    # Find session
    session = await db.collect_sessions.find_one({
        "token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    forms = await get_assigned_forms(db, session["enumerator_id"], session.get("org_id"))
    
    return {"forms": forms, "count": len(forms)}

@router.post("/submit")
async def submit_collection(
    submission: SubmissionData,
    request: Request,
    authorization: str = Query(..., description="Bearer token")
):
    """Submit collected data from authenticated enumerator"""
    db = get_db(request)
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    session = await db.collect_sessions.find_one({
        "token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    # Create submission
    submission_doc = {
        "form_id": submission.form_id,
        "enumerator_id": session["enumerator_id"],
        "org_id": session.get("org_id"),
        "responses": submission.responses,
        "device_info": submission.device_info,
        "gps_location": submission.gps_location,
        "started_at": submission.started_at,
        "completed_at": submission.completed_at or datetime.now(timezone.utc).isoformat(),
        "submitted_at": datetime.now(timezone.utc),
        "status": "submitted",
        "source": "mobile_collect"
    }
    
    result = await db.submissions.insert_one(submission_doc)
    
    return {
        "success": True,
        "submission_id": str(result.inserted_id),
        "message": "Data submitted successfully"
    }

@router.post("/sync")
async def sync_offline_data(sync_data: SyncRequest, request: Request, authorization: str = Query(...)):
    """Sync multiple offline submissions at once"""
    db = get_db(request)
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    session = await db.collect_sessions.find_one({
        "token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    synced = []
    failed = []
    
    for sub in sync_data.submissions:
        try:
            submission_doc = {
                "form_id": sub.get("form_id"),
                "enumerator_id": session["enumerator_id"],
                "org_id": session.get("org_id"),
                "responses": sub.get("responses", {}),
                "device_info": sub.get("device_info"),
                "device_id": sync_data.device_id,
                "gps_location": sub.get("gps_location"),
                "started_at": sub.get("started_at"),
                "completed_at": sub.get("completed_at"),
                "offline_id": sub.get("offline_id"),
                "submitted_at": datetime.now(timezone.utc),
                "status": "submitted",
                "source": "mobile_collect_sync"
            }
            
            result = await db.submissions.insert_one(submission_doc)
            synced.append({
                "offline_id": sub.get("offline_id"),
                "submission_id": str(result.inserted_id)
            })
        except Exception as e:
            failed.append({
                "offline_id": sub.get("offline_id"),
                "error": str(e)
            })
    
    return {
        "synced": len(synced),
        "failed": len(failed),
        "synced_items": synced,
        "failed_items": failed
    }

# ==================== OPTION B: Token-Based Collection ====================

@router.post("/tokens/create")
async def create_collection_token(
    token_request: CreateTokenRequest,
    request: Request,
    authorization: str = Query(..., description="Admin bearer token")
):
    """Create a collection token for an enumerator (supervisor action)"""
    db = get_db(request)
    
    # Verify admin/supervisor token
    admin_token = authorization.replace("Bearer ", "")
    # In production, verify this is a valid admin/supervisor token
    
    # Get enumerator info
    enumerator = await db.enumerators.find_one({"_id": ObjectId(token_request.enumerator_id)})
    if not enumerator:
        enumerator = await db.users.find_one({"_id": ObjectId(token_request.enumerator_id)})
    
    if not enumerator:
        raise HTTPException(status_code=404, detail="Enumerator not found")
    
    # Generate token
    collect_token = generate_collect_token()
    
    # Store token
    token_doc = {
        "token": collect_token,
        "enumerator_id": token_request.enumerator_id,
        "enumerator_name": enumerator.get("name", enumerator.get("full_name")),
        "org_id": str(enumerator.get("org_id", "")),
        "form_ids": token_request.form_ids,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=token_request.expires_hours),
        "is_active": True,
        "usage_count": 0
    }
    
    await db.collect_tokens.insert_one(token_doc)
    
    return {
        "token": collect_token,
        "expires_at": token_doc["expires_at"].isoformat(),
        "collect_url": f"/collect/{collect_token}"
    }

@router.get("/token/{token}")
async def get_token_info(token: str, request: Request):
    """
    Get enumerator info and assigned forms from token
    No authentication required - token is the auth
    """
    db = get_db(request)
    
    token_doc = await db.collect_tokens.find_one({
        "token": token,
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    # Get assigned forms
    forms = []
    for form_id in token_doc.get("form_ids", []):
        try:
            form = await db.forms.find_one({"_id": ObjectId(form_id)})
            if form:
                forms.append({
                    "id": str(form["_id"]),
                    "name": form.get("name", form.get("title", "Untitled")),
                    "description": form.get("description", ""),
                    "field_count": len(form.get("fields", [])),
                    "status": form.get("status", "active")
                })
        except:
            pass
    
    # Update usage count
    await db.collect_tokens.update_one(
        {"token": token},
        {"$inc": {"usage_count": 1}, "$set": {"last_used": datetime.now(timezone.utc)}}
    )
    
    return {
        "token": token,
        "enumerator_name": token_doc.get("enumerator_name", "Field Worker"),
        "enumerator_id": token_doc.get("enumerator_id"),
        "org_id": token_doc.get("org_id"),
        "assigned_forms": forms,
        "expires_at": token_doc["expires_at"].isoformat()
    }

@router.get("/token/{token}/form/{form_id}")
async def get_form_for_collection(token: str, form_id: str, request: Request):
    """Get full form structure for collection via token"""
    db = get_db(request)
    
    # Verify token
    token_doc = await db.collect_tokens.find_one({
        "token": token,
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    # Verify form is assigned to this token
    if form_id not in token_doc.get("form_ids", []):
        raise HTTPException(status_code=403, detail="Form not assigned to this token")
    
    # Get form
    form = await db.forms.find_one({"_id": ObjectId(form_id)})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    return {
        "id": str(form["_id"]),
        "name": form.get("name", form.get("title")),
        "description": form.get("description"),
        "fields": form.get("fields", []),
        "settings": form.get("settings", {}),
        "version": form.get("version", 1)
    }

@router.post("/token/{token}/submit")
async def submit_via_token(token: str, submission: SubmissionData, request: Request):
    """Submit collected data via token (no login required)"""
    db = get_db(request)
    
    # Verify token
    token_doc = await db.collect_tokens.find_one({
        "token": token,
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    # Verify form is assigned
    if submission.form_id not in token_doc.get("form_ids", []):
        raise HTTPException(status_code=403, detail="Form not assigned to this token")
    
    # Create submission
    submission_doc = {
        "form_id": submission.form_id,
        "enumerator_id": token_doc.get("enumerator_id"),
        "org_id": token_doc.get("org_id"),
        "responses": submission.responses,
        "device_info": submission.device_info,
        "gps_location": submission.gps_location,
        "started_at": submission.started_at,
        "completed_at": submission.completed_at or datetime.now(timezone.utc).isoformat(),
        "submitted_at": datetime.now(timezone.utc),
        "status": "submitted",
        "source": "token_collect",
        "collect_token": token
    }
    
    result = await db.submissions.insert_one(submission_doc)
    
    # Update token submission count
    await db.collect_tokens.update_one(
        {"token": token},
        {"$inc": {"submission_count": 1}}
    )
    
    return {
        "success": True,
        "submission_id": str(result.inserted_id),
        "message": "Data submitted successfully"
    }

@router.post("/token/{token}/sync")
async def sync_via_token(token: str, sync_data: SyncRequest, request: Request):
    """Sync multiple offline submissions via token"""
    db = get_db(request)
    
    token_doc = await db.collect_tokens.find_one({
        "token": token,
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not token_doc:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    
    synced = []
    failed = []
    
    for sub in sync_data.submissions:
        try:
            # Verify form is assigned
            if sub.get("form_id") not in token_doc.get("form_ids", []):
                failed.append({
                    "offline_id": sub.get("offline_id"),
                    "error": "Form not assigned to token"
                })
                continue
            
            submission_doc = {
                "form_id": sub.get("form_id"),
                "enumerator_id": token_doc.get("enumerator_id"),
                "org_id": token_doc.get("org_id"),
                "responses": sub.get("responses", {}),
                "device_info": sub.get("device_info"),
                "device_id": sync_data.device_id,
                "gps_location": sub.get("gps_location"),
                "started_at": sub.get("started_at"),
                "completed_at": sub.get("completed_at"),
                "offline_id": sub.get("offline_id"),
                "submitted_at": datetime.now(timezone.utc),
                "status": "submitted",
                "source": "token_collect_sync",
                "collect_token": token
            }
            
            result = await db.submissions.insert_one(submission_doc)
            synced.append({
                "offline_id": sub.get("offline_id"),
                "submission_id": str(result.inserted_id)
            })
        except Exception as e:
            failed.append({
                "offline_id": sub.get("offline_id"),
                "error": str(e)
            })
    
    return {
        "synced": len(synced),
        "failed": len(failed),
        "synced_items": synced,
        "failed_items": failed
    }

# ==================== Helper Functions ====================

async def get_assigned_forms(db, enumerator_id: str, org_id: str = None) -> List[Dict]:
    """Get forms assigned to an enumerator"""
    forms = []
    
    # Check form assignments
    assignments = await db.form_assignments.find({
        "$or": [
            {"enumerator_id": enumerator_id},
            {"assigned_to": enumerator_id}
        ]
    }).to_list(100)
    
    assigned_form_ids = [a.get("form_id") for a in assignments]
    
    # If no specific assignments, get all org forms
    if not assigned_form_ids and org_id:
        query = {"org_id": org_id, "status": {"$in": ["published", "active"]}}
    else:
        query = {"_id": {"$in": [ObjectId(fid) for fid in assigned_form_ids if fid]}}
    
    async for form in db.forms.find(query):
        forms.append({
            "id": str(form["_id"]),
            "name": form.get("name", form.get("title", "Untitled Form")),
            "description": form.get("description", ""),
            "field_count": len(form.get("fields", [])),
            "status": form.get("status", "active"),
            "version": form.get("version", 1),
            "updated_at": form.get("updated_at", form.get("created_at", "")).isoformat() if hasattr(form.get("updated_at", ""), "isoformat") else str(form.get("updated_at", ""))
        })
    
    return forms

# ==================== Token Management (Admin) ====================

@router.get("/tokens/list")
async def list_collection_tokens(
    request: Request,
    org_id: str = Query(...),
    authorization: str = Query(...)
):
    """List all collection tokens for an organization"""
    db = get_db(request)
    
    tokens = await db.collect_tokens.find({
        "org_id": org_id
    }).sort("created_at", -1).to_list(100)
    
    return {
        "tokens": [
            {
                "token": t["token"][:8] + "...",  # Truncate for security
                "full_token": t["token"],
                "enumerator_name": t.get("enumerator_name"),
                "enumerator_id": t.get("enumerator_id"),
                "form_count": len(t.get("form_ids", [])),
                "created_at": t["created_at"].isoformat(),
                "expires_at": t["expires_at"].isoformat(),
                "is_active": t.get("is_active", True),
                "usage_count": t.get("usage_count", 0),
                "submission_count": t.get("submission_count", 0)
            }
            for t in tokens
        ]
    }

@router.delete("/tokens/{token}")
async def revoke_collection_token(token: str, request: Request, authorization: str = Query(...)):
    """Revoke a collection token"""
    db = get_db(request)
    
    result = await db.collect_tokens.update_one(
        {"token": token},
        {"$set": {"is_active": False, "revoked_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    
    return {"success": True, "message": "Token revoked"}
