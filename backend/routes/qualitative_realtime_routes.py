"""
Qualitative Analysis Module - Real-time Collaboration
WebSocket-based live coding sessions
"""

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from typing import Optional, List, Dict, Any, Set
from datetime import datetime, timezone
from bson import ObjectId
import json
import asyncio

router = APIRouter(prefix="/qualitative/realtime", tags=["Qualitative Real-time"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# CONNECTION MANAGER
# =============================================================================

class ConnectionManager:
    def __init__(self):
        # project_id -> set of (websocket, user_info)
        self.active_connections: Dict[str, List[Dict]] = {}
        # project_id -> user_id -> cursor position
        self.cursors: Dict[str, Dict[str, Dict]] = {}
        # project_id -> user_id -> selection
        self.selections: Dict[str, Dict[str, Dict]] = {}
    
    async def connect(self, websocket: WebSocket, project_id: str, user_id: str, user_name: str):
        await websocket.accept()
        
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
            self.cursors[project_id] = {}
            self.selections[project_id] = {}
        
        connection_info = {
            "websocket": websocket,
            "user_id": user_id,
            "user_name": user_name,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        self.active_connections[project_id].append(connection_info)
        
        # Notify others of new user
        await self.broadcast(project_id, {
            "type": "user_joined",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
        
        # Send current presence to new user
        presence = self.get_presence(project_id)
        await websocket.send_json({
            "type": "presence_update",
            "users": presence,
            "cursors": self.cursors.get(project_id, {}),
            "selections": self.selections.get(project_id, {})
        })
    
    def disconnect(self, websocket: WebSocket, project_id: str, user_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id] = [
                c for c in self.active_connections[project_id]
                if c["websocket"] != websocket
            ]
            
            # Clean up cursor and selection
            if project_id in self.cursors and user_id in self.cursors[project_id]:
                del self.cursors[project_id][user_id]
            if project_id in self.selections and user_id in self.selections[project_id]:
                del self.selections[project_id][user_id]
    
    async def broadcast(self, project_id: str, message: dict, exclude_user: str = None):
        if project_id not in self.active_connections:
            return
        
        for connection in self.active_connections[project_id]:
            if exclude_user and connection["user_id"] == exclude_user:
                continue
            try:
                await connection["websocket"].send_json(message)
            except:
                pass
    
    def get_presence(self, project_id: str) -> List[Dict]:
        if project_id not in self.active_connections:
            return []
        return [
            {
                "user_id": c["user_id"],
                "user_name": c["user_name"],
                "connected_at": c["connected_at"]
            }
            for c in self.active_connections[project_id]
        ]
    
    def update_cursor(self, project_id: str, user_id: str, cursor_data: dict):
        if project_id not in self.cursors:
            self.cursors[project_id] = {}
        self.cursors[project_id][user_id] = cursor_data
    
    def update_selection(self, project_id: str, user_id: str, selection_data: dict):
        if project_id not in self.selections:
            self.selections[project_id] = {}
        self.selections[project_id][user_id] = selection_data


manager = ConnectionManager()


# =============================================================================
# WEBSOCKET ENDPOINT
# =============================================================================

@router.websocket("/ws/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
    user_id: str = Query(...),
    user_name: str = Query(default="Anonymous")
):
    """
    WebSocket endpoint for real-time collaboration
    
    Message types:
    - cursor_move: {type: "cursor_move", source_id, position}
    - selection: {type: "selection", source_id, start, end, text}
    - coding_added: {type: "coding_added", coding_data}
    - coding_removed: {type: "coding_removed", coding_id}
    - code_created: {type: "code_created", code_data}
    - ping: {type: "ping"}
    """
    await manager.connect(websocket, project_id, user_id, user_name)
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "cursor_move":
                manager.update_cursor(project_id, user_id, {
                    "source_id": data.get("source_id"),
                    "position": data.get("position"),
                    "user_name": user_name
                })
                await manager.broadcast(project_id, {
                    "type": "cursor_update",
                    "user_id": user_id,
                    "user_name": user_name,
                    "source_id": data.get("source_id"),
                    "position": data.get("position")
                }, exclude_user=user_id)
            
            elif msg_type == "selection":
                manager.update_selection(project_id, user_id, {
                    "source_id": data.get("source_id"),
                    "start": data.get("start"),
                    "end": data.get("end"),
                    "text": data.get("text", "")[:100],
                    "user_name": user_name
                })
                await manager.broadcast(project_id, {
                    "type": "selection_update",
                    "user_id": user_id,
                    "user_name": user_name,
                    "source_id": data.get("source_id"),
                    "start": data.get("start"),
                    "end": data.get("end")
                }, exclude_user=user_id)
            
            elif msg_type == "coding_added":
                # Broadcast new coding to all users
                await manager.broadcast(project_id, {
                    "type": "coding_added",
                    "user_id": user_id,
                    "user_name": user_name,
                    "coding": data.get("coding"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_user=user_id)
            
            elif msg_type == "coding_removed":
                await manager.broadcast(project_id, {
                    "type": "coding_removed",
                    "user_id": user_id,
                    "coding_id": data.get("coding_id"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_user=user_id)
            
            elif msg_type == "code_created":
                await manager.broadcast(project_id, {
                    "type": "code_created",
                    "user_id": user_id,
                    "user_name": user_name,
                    "code": data.get("code"),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_user=user_id)
            
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id, user_id)
        await manager.broadcast(project_id, {
            "type": "user_left",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })


# =============================================================================
# REST ENDPOINTS FOR PRESENCE
# =============================================================================

@router.get("/presence/{project_id}")
async def get_presence(project_id: str):
    """Get current users in a project session"""
    return {
        "project_id": project_id,
        "users": manager.get_presence(project_id),
        "user_count": len(manager.get_presence(project_id))
    }


@router.get("/cursors/{project_id}")
async def get_cursors(project_id: str):
    """Get current cursor positions for all users"""
    return {
        "project_id": project_id,
        "cursors": manager.cursors.get(project_id, {})
    }


@router.get("/selections/{project_id}")
async def get_selections(project_id: str):
    """Get current selections for all users"""
    return {
        "project_id": project_id,
        "selections": manager.selections.get(project_id, {})
    }


# =============================================================================
# SESSION MANAGEMENT
# =============================================================================

@router.post("/sessions")
async def create_session(
    project_id: str = Query(...),
    org_id: str = Query(...),
    user_id: str = Query(...),
    session_name: Optional[str] = None
):
    """
    Create a named collaboration session
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    session_doc = {
        "project_id": project_id,
        "name": session_name or f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "created_by": user_id,
        "org_id": org_id,
        "status": "active",
        "participants": [user_id],
        "created_at": datetime.now(timezone.utc),
        "ended_at": None
    }
    
    result = await db.qual_sessions.insert_one(session_doc)
    
    return {
        "id": str(result.inserted_id),
        "name": session_doc["name"],
        "message": "Session created"
    }


@router.get("/sessions")
async def list_sessions(
    project_id: str = Query(...),
    org_id: str = Query(...),
    status: Optional[str] = Query(default="active")
):
    """List collaboration sessions"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if status:
        query["status"] = status
    
    sessions = await db.qual_sessions.find(query).sort("created_at", -1).to_list(50)
    
    return [
        {
            "id": str(s["_id"]),
            "name": s["name"],
            "created_by": s["created_by"],
            "participants": s.get("participants", []),
            "status": s["status"],
            "created_at": s["created_at"],
            "current_users": len(manager.get_presence(project_id))
        }
        for s in sessions
    ]


@router.patch("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    org_id: str = Query(...)
):
    """End a collaboration session"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    await db.qual_sessions.update_one(
        {"_id": ObjectId(session_id), "org_id": org_id},
        {
            "$set": {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Session ended"}


# =============================================================================
# ACTIVITY FEED
# =============================================================================

@router.get("/activity/{project_id}")
async def get_activity_feed(
    project_id: str,
    org_id: str = Query(...),
    limit: int = Query(default=50, le=200)
):
    """
    Get recent activity in the project for real-time feed
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get recent codings
    recent_codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get recent codes
    recent_codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).sort("created_at", -1).limit(20).to_list(20)
    
    # Get recent memos
    recent_memos = await db.qual_memos.find({
        "project_id": project_id,
        "org_id": org_id
    }).sort("created_at", -1).limit(10).to_list(10)
    
    # Combine into activity feed
    activities = []
    
    for c in recent_codings:
        activities.append({
            "type": "coding",
            "id": str(c["_id"]),
            "user_id": c.get("coder_id"),
            "description": f"Coded: {c.get('code_name', 'Unknown')}",
            "excerpt": c["excerpt_text"][:80] + "..." if len(c["excerpt_text"]) > 80 else c["excerpt_text"],
            "source_name": c.get("source_name"),
            "timestamp": c["created_at"]
        })
    
    for code in recent_codes:
        activities.append({
            "type": "code_created",
            "id": str(code["_id"]),
            "user_id": code.get("created_by"),
            "description": f"Created code: {code['name']}",
            "timestamp": code["created_at"]
        })
    
    for memo in recent_memos:
        activities.append({
            "type": "memo",
            "id": str(memo["_id"]),
            "user_id": memo.get("created_by"),
            "description": f"Added memo: {memo.get('title', 'Untitled')}",
            "timestamp": memo["created_at"]
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "project_id": project_id,
        "activities": activities[:limit],
        "current_users": manager.get_presence(project_id)
    }
