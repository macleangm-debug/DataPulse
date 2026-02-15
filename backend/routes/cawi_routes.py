"""DataPulse - CAWI (Computer-Assisted Web Interviewing) Routes
Enhanced web survey features including session management and progress saving.

Features:
- Survey session management
- Progress saving and resumption
- Multi-page navigation support
- Anonymous and token-based access
- Completion tracking
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import secrets

router = APIRouter(prefix="/cawi", tags=["CAWI Web Surveys"])


class SessionCreate(BaseModel):
    form_id: str
    token: Optional[str] = None
    responses: Dict[str, Any] = {}
    current_page: int = 0
    status: str = "in_progress"


class SessionUpdate(BaseModel):
    responses: Optional[Dict[str, Any]] = None
    current_page: Optional[int] = None
    status: Optional[str] = None


@router.post("/sessions")
async def create_or_update_session(
    request: Request,
    session: SessionCreate
):
    """Create or update a CAWI session"""
    db = request.app.state.db
    
    # Check if session exists for this token
    existing = None
    if session.token:
        existing = await db.cawi_sessions.find_one({
            "form_id": session.form_id,
            "token": session.token,
            "status": {"$ne": "completed"}
        })
    
    if existing:
        # Update existing session
        await db.cawi_sessions.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "responses": session.responses,
                    "current_page": session.current_page,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        return {"id": existing["id"], "updated": True}
    
    # Create new session
    session_id = f"cawi_{secrets.token_hex(12)}"
    session_doc = {
        "id": session_id,
        "form_id": session.form_id,
        "token": session.token,
        "responses": session.responses,
        "current_page": session.current_page,
        "status": session.status,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.cawi_sessions.insert_one(session_doc)
    
    return {"id": session_id, "created": True}


@router.get("/sessions/{session_id}")
async def get_session(
    request: Request,
    session_id: str
):
    """Get a CAWI session by ID"""
    db = request.app.state.db
    
    session = await db.cawi_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session["_id"] = str(session.get("_id", ""))
    if session.get("created_at"):
        session["created_at"] = session["created_at"].isoformat()
    if session.get("updated_at"):
        session["updated_at"] = session["updated_at"].isoformat()
    
    return session


@router.get("/sessions/by-token/{token}")
async def get_session_by_token(
    request: Request,
    token: str,
    form_id: Optional[str] = None
):
    """Get a CAWI session by token"""
    db = request.app.state.db
    
    query = {"token": token, "status": {"$ne": "completed"}}
    if form_id:
        query["form_id"] = form_id
    
    session = await db.cawi_sessions.find_one(query, sort=[("updated_at", -1)])
    
    if not session:
        return None
    
    session["_id"] = str(session.get("_id", ""))
    if session.get("created_at"):
        session["created_at"] = session["created_at"].isoformat()
    if session.get("updated_at"):
        session["updated_at"] = session["updated_at"].isoformat()
    
    return session


@router.put("/sessions/{session_id}")
async def update_session(
    request: Request,
    session_id: str,
    update: SessionUpdate
):
    """Update a CAWI session"""
    db = request.app.state.db
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if update.responses is not None:
        update_data["responses"] = update.responses
    if update.current_page is not None:
        update_data["current_page"] = update.current_page
    if update.status is not None:
        update_data["status"] = update.status
    
    result = await db.cawi_sessions.update_one(
        {"id": session_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session updated"}


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    request: Request,
    session_id: str
):
    """Mark a CAWI session as completed"""
    db = request.app.state.db
    
    session = await db.cawi_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.cawi_sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Session completed"}


@router.delete("/sessions/{session_id}")
async def delete_session(
    request: Request,
    session_id: str
):
    """Delete a CAWI session"""
    db = request.app.state.db
    
    result = await db.cawi_sessions.delete_one({"id": session_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted"}


# ============ Analytics ============

@router.get("/analytics/{form_id}")
async def get_cawi_analytics(
    request: Request,
    form_id: str
):
    """Get CAWI analytics for a form"""
    db = request.app.state.db
    
    # Total sessions
    total_sessions = await db.cawi_sessions.count_documents({"form_id": form_id})
    
    # Completed sessions
    completed = await db.cawi_sessions.count_documents({
        "form_id": form_id,
        "status": "completed"
    })
    
    # In-progress sessions
    in_progress = await db.cawi_sessions.count_documents({
        "form_id": form_id,
        "status": "in_progress"
    })
    
    # Completion rate
    completion_rate = (completed / total_sessions * 100) if total_sessions > 0 else 0
    
    # Average page reached
    pipeline = [
        {"$match": {"form_id": form_id}},
        {"$group": {
            "_id": None,
            "avg_page": {"$avg": "$current_page"},
            "max_page": {"$max": "$current_page"}
        }}
    ]
    page_stats = await db.cawi_sessions.aggregate(pipeline).to_list(1)
    
    # Drop-off by page
    dropoff_pipeline = [
        {"$match": {"form_id": form_id, "status": {"$ne": "completed"}}},
        {"$group": {
            "_id": "$current_page",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    dropoff = await db.cawi_sessions.aggregate(dropoff_pipeline).to_list(100)
    
    return {
        "total_sessions": total_sessions,
        "completed": completed,
        "in_progress": in_progress,
        "completion_rate": round(completion_rate, 1),
        "avg_page_reached": round(page_stats[0]["avg_page"], 1) if page_stats else 0,
        "max_page_reached": page_stats[0]["max_page"] if page_stats else 0,
        "dropoff_by_page": {str(d["_id"]): d["count"] for d in dropoff}
    }
