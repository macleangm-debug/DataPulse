"""DataPulse - Real-time Collaboration Service using WebSockets"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from typing import Dict, List, Set, Optional, Any
from datetime import datetime, timezone
import json
import asyncio
from collections import defaultdict

router = APIRouter(prefix="/collaboration", tags=["Collaboration"])


class ConnectionManager:
    """Manages WebSocket connections for real-time collaboration"""
    
    def __init__(self):
        # Active connections by room (form_id, project_id, etc.)
        self.rooms: Dict[str, Dict[str, WebSocket]] = defaultdict(dict)
        # User presence tracking
        self.user_presence: Dict[str, Dict[str, Any]] = defaultdict(dict)
        # Active cursors/selections
        self.cursors: Dict[str, Dict[str, Any]] = defaultdict(dict)
        # Locks for editing
        self.locks: Dict[str, Dict[str, str]] = defaultdict(dict)  # room -> {field_id: user_id}
    
    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, user_name: str):
        """Connect a user to a collaboration room"""
        await websocket.accept()
        self.rooms[room_id][user_id] = websocket
        self.user_presence[room_id][user_id] = {
            "user_id": user_id,
            "user_name": user_name,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        
        # Notify others in the room
        await self.broadcast(room_id, {
            "type": "user_joined",
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude=user_id)
        
        # Send current room state to new user
        await websocket.send_json({
            "type": "room_state",
            "users": list(self.user_presence[room_id].values()),
            "cursors": self.cursors.get(room_id, {}),
            "locks": self.locks.get(room_id, {})
        })
    
    async def disconnect(self, room_id: str, user_id: str):
        """Disconnect a user from a room"""
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            del self.rooms[room_id][user_id]
        
        if room_id in self.user_presence and user_id in self.user_presence[room_id]:
            user_name = self.user_presence[room_id][user_id].get("user_name", "Unknown")
            del self.user_presence[room_id][user_id]
            
            # Release any locks held by this user
            if room_id in self.locks:
                locks_to_release = [k for k, v in self.locks[room_id].items() if v == user_id]
                for lock_id in locks_to_release:
                    del self.locks[room_id][lock_id]
            
            # Remove cursor
            if room_id in self.cursors and user_id in self.cursors[room_id]:
                del self.cursors[room_id][user_id]
            
            # Notify others
            await self.broadcast(room_id, {
                "type": "user_left",
                "user_id": user_id,
                "user_name": user_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        # Clean up empty rooms
        if room_id in self.rooms and not self.rooms[room_id]:
            del self.rooms[room_id]
            if room_id in self.user_presence:
                del self.user_presence[room_id]
            if room_id in self.cursors:
                del self.cursors[room_id]
            if room_id in self.locks:
                del self.locks[room_id]
    
    async def broadcast(self, room_id: str, message: dict, exclude: str = None):
        """Broadcast message to all users in a room"""
        if room_id not in self.rooms:
            return
        
        disconnected = []
        for user_id, websocket in self.rooms[room_id].items():
            if user_id != exclude:
                try:
                    await websocket.send_json(message)
                except:
                    disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            await self.disconnect(room_id, user_id)
    
    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        """Send message to specific user"""
        if room_id in self.rooms and user_id in self.rooms[room_id]:
            try:
                await self.rooms[room_id][user_id].send_json(message)
            except:
                await self.disconnect(room_id, user_id)
    
    def acquire_lock(self, room_id: str, field_id: str, user_id: str) -> bool:
        """Try to acquire a lock for editing a field"""
        if room_id not in self.locks:
            self.locks[room_id] = {}
        
        if field_id in self.locks[room_id]:
            return self.locks[room_id][field_id] == user_id
        
        self.locks[room_id][field_id] = user_id
        return True
    
    def release_lock(self, room_id: str, field_id: str, user_id: str) -> bool:
        """Release a lock"""
        if room_id in self.locks and field_id in self.locks[room_id]:
            if self.locks[room_id][field_id] == user_id:
                del self.locks[room_id][field_id]
                return True
        return False
    
    def update_cursor(self, room_id: str, user_id: str, cursor_data: dict):
        """Update user's cursor position"""
        if room_id not in self.cursors:
            self.cursors[room_id] = {}
        self.cursors[room_id][user_id] = cursor_data
    
    def get_room_users(self, room_id: str) -> List[dict]:
        """Get list of users in a room"""
        return list(self.user_presence.get(room_id, {}).values())


# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/ws/{room_type}/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_type: str,
    room_id: str,
    user_id: str = None,
    user_name: str = "Anonymous"
):
    """WebSocket endpoint for real-time collaboration
    
    room_type: 'form', 'project', 'submission'
    room_id: ID of the resource being collaborated on
    """
    full_room_id = f"{room_type}:{room_id}"
    
    if not user_id:
        user_id = f"anon_{datetime.now().timestamp()}"
    
    await manager.connect(websocket, full_room_id, user_id, user_name)
    
    try:
        while True:
            data = await websocket.receive_json()
            await handle_message(full_room_id, user_id, user_name, data)
    except WebSocketDisconnect:
        await manager.disconnect(full_room_id, user_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        await manager.disconnect(full_room_id, user_id)


async def handle_message(room_id: str, user_id: str, user_name: str, data: dict):
    """Handle incoming WebSocket messages"""
    message_type = data.get("type")
    
    if message_type == "cursor_move":
        # Update and broadcast cursor position
        manager.update_cursor(room_id, user_id, {
            "user_id": user_id,
            "user_name": user_name,
            "field_id": data.get("field_id"),
            "position": data.get("position")
        })
        await manager.broadcast(room_id, {
            "type": "cursor_update",
            "user_id": user_id,
            "user_name": user_name,
            "field_id": data.get("field_id"),
            "position": data.get("position")
        }, exclude=user_id)
    
    elif message_type == "field_focus":
        # User focused on a field - try to acquire lock
        field_id = data.get("field_id")
        acquired = manager.acquire_lock(room_id, field_id, user_id)
        
        if acquired:
            await manager.broadcast(room_id, {
                "type": "field_locked",
                "field_id": field_id,
                "user_id": user_id,
                "user_name": user_name
            })
        else:
            # Notify user they can't edit
            await manager.send_to_user(room_id, user_id, {
                "type": "lock_denied",
                "field_id": field_id,
                "locked_by": manager.locks[room_id].get(field_id)
            })
    
    elif message_type == "field_blur":
        # User left a field - release lock
        field_id = data.get("field_id")
        released = manager.release_lock(room_id, field_id, user_id)
        
        if released:
            await manager.broadcast(room_id, {
                "type": "field_unlocked",
                "field_id": field_id,
                "user_id": user_id
            })
    
    elif message_type == "field_change":
        # User changed a field value
        await manager.broadcast(room_id, {
            "type": "field_changed",
            "field_id": data.get("field_id"),
            "value": data.get("value"),
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude=user_id)
    
    elif message_type == "comment":
        # User added a comment
        await manager.broadcast(room_id, {
            "type": "new_comment",
            "field_id": data.get("field_id"),
            "comment": data.get("comment"),
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    elif message_type == "selection":
        # User selected multiple items
        await manager.broadcast(room_id, {
            "type": "selection_update",
            "selected_ids": data.get("selected_ids"),
            "user_id": user_id,
            "user_name": user_name
        }, exclude=user_id)
    
    elif message_type == "ping":
        # Keep-alive ping
        await manager.send_to_user(room_id, user_id, {"type": "pong"})
    
    elif message_type == "chat":
        # Chat message
        await manager.broadcast(room_id, {
            "type": "chat_message",
            "message": data.get("message"),
            "user_id": user_id,
            "user_name": user_name,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })


@router.get("/rooms/{room_type}/{room_id}/users")
async def get_room_users(room_type: str, room_id: str):
    """Get active users in a collaboration room"""
    full_room_id = f"{room_type}:{room_id}"
    return {
        "users": manager.get_room_users(full_room_id),
        "count": len(manager.get_room_users(full_room_id))
    }


@router.get("/presence/{user_id}")
async def get_user_presence(user_id: str):
    """Get rooms where a user is currently active"""
    active_rooms = []
    for room_id, users in manager.user_presence.items():
        if user_id in users:
            active_rooms.append({
                "room_id": room_id,
                "connected_at": users[user_id].get("connected_at")
            })
    return {"active_rooms": active_rooms}
