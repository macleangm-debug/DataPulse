"""DataPulse - Media Upload Routes
Handles file uploads for photos, audio, and video with chunked upload support
"""

import os
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import aiofiles
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/media", tags=["Media"])

# Configuration
UPLOAD_DIR = "/app/uploads"
CHUNK_SIZE = 1024 * 1024  # 1MB chunks

# File size limits (in bytes)
FILE_LIMITS = {
    "photo": 10 * 1024 * 1024,    # 10MB
    "audio": 25 * 1024 * 1024,    # 25MB
    "video": 50 * 1024 * 1024,    # 50MB
    "document": 25 * 1024 * 1024  # 25MB
}

# Allowed MIME types
ALLOWED_TYPES = {
    "photo": ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    "audio": ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"],
    "video": ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    "document": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
}

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)
for subdir in ["photos", "audio", "videos", "documents", "chunks"]:
    os.makedirs(os.path.join(UPLOAD_DIR, subdir), exist_ok=True)


class MediaMetadata(BaseModel):
    id: str
    filename: str
    original_name: str
    media_type: str
    mime_type: str
    size: int
    submission_id: Optional[str] = None
    field_id: Optional[str] = None
    uploaded_by: str
    created_at: str
    url: str
    thumbnail_url: Optional[str] = None
    metadata: dict = {}


class ChunkUploadInit(BaseModel):
    filename: str
    total_size: int
    total_chunks: int
    media_type: str
    mime_type: str
    submission_id: Optional[str] = None
    field_id: Optional[str] = None


class ChunkUploadComplete(BaseModel):
    upload_id: str


def get_media_type(mime_type: str) -> str:
    """Determine media type from MIME type"""
    for media_type, mimes in ALLOWED_TYPES.items():
        if mime_type in mimes:
            return media_type
    return "unknown"


def validate_file(file: UploadFile, media_type: str) -> bool:
    """Validate file type and size"""
    if media_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid media type: {media_type}")
    
    if file.content_type not in ALLOWED_TYPES[media_type]:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES[media_type])}"
        )
    
    return True


def get_db():
    """Get database connection"""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "datapulse")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    media_type: str = Form(...),
    submission_id: Optional[str] = Form(None),
    field_id: Optional[str] = Form(None),
    user_id: str = Form(...)
):
    """
    Upload a media file (single file upload)
    Supports: photos (10MB), audio (25MB), video (50MB), documents (25MB)
    """
    db = get_db()
    
    # Validate media type
    if media_type not in FILE_LIMITS:
        raise HTTPException(status_code=400, detail=f"Invalid media type: {media_type}")
    
    # Validate file type
    validate_file(file, media_type)
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Check file size
    if file_size > FILE_LIMITS[media_type]:
        max_mb = FILE_LIMITS[media_type] / (1024 * 1024)
        raise HTTPException(
            status_code=400, 
            detail=f"File too large. Maximum size for {media_type}: {max_mb}MB"
        )
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    new_filename = f"{file_id}{file_ext}"
    
    # Determine subdirectory
    subdir = {
        "photo": "photos",
        "audio": "audio",
        "video": "videos",
        "document": "documents"
    }.get(media_type, "misc")
    
    file_path = os.path.join(UPLOAD_DIR, subdir, new_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Calculate hash for deduplication
    file_hash = hashlib.md5(content).hexdigest()
    
    # Create metadata record
    metadata = {
        "id": file_id,
        "filename": new_filename,
        "original_name": file.filename,
        "media_type": media_type,
        "mime_type": file.content_type,
        "size": file_size,
        "hash": file_hash,
        "submission_id": submission_id,
        "field_id": field_id,
        "uploaded_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "path": file_path,
        "url": f"/api/media/file/{file_id}",
        "thumbnail_url": f"/api/media/thumbnail/{file_id}" if media_type in ["photo", "video"] else None
    }
    
    # Save to database
    await db.media.insert_one(metadata)
    
    # Remove internal fields
    del metadata["path"]
    del metadata["hash"]
    if "_id" in metadata:
        del metadata["_id"]
    
    return metadata


@router.post("/upload/init")
async def init_chunked_upload(data: ChunkUploadInit, user_id: str = Form(...)):
    """
    Initialize a chunked upload for large files
    Returns an upload_id to use for uploading chunks
    """
    db = get_db()
    
    # Validate
    if data.media_type not in FILE_LIMITS:
        raise HTTPException(status_code=400, detail=f"Invalid media type: {data.media_type}")
    
    if data.total_size > FILE_LIMITS[data.media_type]:
        max_mb = FILE_LIMITS[data.media_type] / (1024 * 1024)
        raise HTTPException(
            status_code=400, 
            detail=f"File too large. Maximum size for {data.media_type}: {max_mb}MB"
        )
    
    upload_id = str(uuid.uuid4())
    
    # Create upload session
    session = {
        "upload_id": upload_id,
        "filename": data.filename,
        "total_size": data.total_size,
        "total_chunks": data.total_chunks,
        "received_chunks": [],
        "media_type": data.media_type,
        "mime_type": data.mime_type,
        "submission_id": data.submission_id,
        "field_id": data.field_id,
        "uploaded_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "in_progress"
    }
    
    await db.upload_sessions.insert_one(session)
    
    return {
        "upload_id": upload_id,
        "chunk_size": CHUNK_SIZE,
        "total_chunks": data.total_chunks
    }


@router.post("/upload/chunk/{upload_id}/{chunk_index}")
async def upload_chunk(
    upload_id: str,
    chunk_index: int,
    chunk: UploadFile = File(...)
):
    """Upload a single chunk of a file"""
    db = get_db()
    
    # Find upload session
    session = await db.upload_sessions.find_one({"upload_id": upload_id})
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if session["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Upload session is not active")
    
    # Save chunk
    chunk_content = await chunk.read()
    chunk_path = os.path.join(UPLOAD_DIR, "chunks", f"{upload_id}_{chunk_index}")
    
    async with aiofiles.open(chunk_path, 'wb') as f:
        await f.write(chunk_content)
    
    # Update session
    received = session.get("received_chunks", [])
    if chunk_index not in received:
        received.append(chunk_index)
    
    await db.upload_sessions.update_one(
        {"upload_id": upload_id},
        {"$set": {"received_chunks": received}}
    )
    
    return {
        "chunk_index": chunk_index,
        "received": len(received),
        "total": session["total_chunks"]
    }


@router.post("/upload/complete/{upload_id}")
async def complete_chunked_upload(upload_id: str, background_tasks: BackgroundTasks):
    """Complete a chunked upload by assembling all chunks"""
    db = get_db()
    
    # Find upload session
    session = await db.upload_sessions.find_one({"upload_id": upload_id})
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    received = session.get("received_chunks", [])
    total = session["total_chunks"]
    
    # Check all chunks received
    if len(received) != total:
        missing = [i for i in range(total) if i not in received]
        raise HTTPException(
            status_code=400, 
            detail=f"Missing chunks: {missing}"
        )
    
    # Generate final filename
    file_ext = os.path.splitext(session["filename"])[1].lower()
    file_id = str(uuid.uuid4())
    new_filename = f"{file_id}{file_ext}"
    
    # Determine subdirectory
    subdir = {
        "photo": "photos",
        "audio": "audio",
        "video": "videos",
        "document": "documents"
    }.get(session["media_type"], "misc")
    
    file_path = os.path.join(UPLOAD_DIR, subdir, new_filename)
    
    # Assemble chunks
    async with aiofiles.open(file_path, 'wb') as outfile:
        for i in range(total):
            chunk_path = os.path.join(UPLOAD_DIR, "chunks", f"{upload_id}_{i}")
            async with aiofiles.open(chunk_path, 'rb') as chunk_file:
                content = await chunk_file.read()
                await outfile.write(content)
    
    # Calculate file size and hash
    async with aiofiles.open(file_path, 'rb') as f:
        content = await f.read()
        file_size = len(content)
        file_hash = hashlib.md5(content).hexdigest()
    
    # Create metadata record
    metadata = {
        "id": file_id,
        "filename": new_filename,
        "original_name": session["filename"],
        "media_type": session["media_type"],
        "mime_type": session["mime_type"],
        "size": file_size,
        "hash": file_hash,
        "submission_id": session.get("submission_id"),
        "field_id": session.get("field_id"),
        "uploaded_by": session["uploaded_by"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "path": file_path,
        "url": f"/api/media/file/{file_id}",
        "thumbnail_url": f"/api/media/thumbnail/{file_id}" if session["media_type"] in ["photo", "video"] else None
    }
    
    # Save to database
    await db.media.insert_one(metadata)
    
    # Update session status
    await db.upload_sessions.update_one(
        {"upload_id": upload_id},
        {"$set": {"status": "completed", "file_id": file_id}}
    )
    
    # Clean up chunks in background
    background_tasks.add_task(cleanup_chunks, upload_id, total)
    
    # Remove internal fields
    del metadata["path"]
    del metadata["hash"]
    if "_id" in metadata:
        del metadata["_id"]
    
    return metadata


async def cleanup_chunks(upload_id: str, total_chunks: int):
    """Clean up chunk files after assembly"""
    for i in range(total_chunks):
        chunk_path = os.path.join(UPLOAD_DIR, "chunks", f"{upload_id}_{i}")
        try:
            os.remove(chunk_path)
        except:
            pass


@router.get("/file/{file_id}")
async def get_media_file(file_id: str):
    """Get a media file by ID"""
    db = get_db()
    
    media = await db.media.find_one({"id": file_id})
    if not media:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = media.get("path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        file_path,
        media_type=media.get("mime_type", "application/octet-stream"),
        filename=media.get("original_name", media.get("filename"))
    )


@router.get("/thumbnail/{file_id}")
async def get_thumbnail(file_id: str):
    """Get thumbnail for a media file (photos/videos)"""
    db = get_db()
    
    media = await db.media.find_one({"id": file_id})
    if not media:
        raise HTTPException(status_code=404, detail="File not found")
    
    if media.get("media_type") not in ["photo", "video"]:
        raise HTTPException(status_code=400, detail="Thumbnails only available for photos and videos")
    
    # For now, return the original file (thumbnail generation can be added later)
    file_path = media.get("path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        file_path,
        media_type=media.get("mime_type", "application/octet-stream")
    )


@router.delete("/{file_id}")
async def delete_media(file_id: str):
    """Delete a media file"""
    db = get_db()
    
    media = await db.media.find_one({"id": file_id})
    if not media:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete file from disk
    file_path = media.get("path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from database
    await db.media.delete_one({"id": file_id})
    
    return {"message": "File deleted", "id": file_id}


@router.get("/submission/{submission_id}")
async def get_submission_media(submission_id: str):
    """Get all media files for a submission"""
    db = get_db()
    
    media_list = await db.media.find(
        {"submission_id": submission_id},
        {"_id": 0, "path": 0, "hash": 0}
    ).to_list(100)
    
    return media_list


@router.get("/limits")
async def get_upload_limits():
    """Get file upload limits"""
    return {
        "limits": {k: f"{v / (1024*1024)}MB" for k, v in FILE_LIMITS.items()},
        "allowed_types": ALLOWED_TYPES,
        "chunk_size": f"{CHUNK_SIZE / (1024*1024)}MB"
    }
