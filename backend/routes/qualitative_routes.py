"""
Qualitative Analysis Module - API Routes
Endpoints for qualitative research analysis
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import re

from models.qualitative_models import (
    # Project
    QualProjectCreate, QualProjectUpdate, QualProjectResponse,
    # Source
    SourceCreate, SourceUpdate, SourceResponse, SourceType, GroupType,
    Speaker, Utterance, CodingStatus,
    # Codebook
    CodeCreate, CodeUpdate, CodeResponse, CodeType,
    # Coding
    CodingCreate, CodingUpdate, CodingResponse,
    # Memo
    MemoCreate, MemoUpdate, MemoResponse, MemoType,
    # Theme
    ThemeCreate, ThemeUpdate, ThemeResponse, ThemeStatus, EvidenceLink,
    # Queries
    CodeQuery, TextSearchQuery, CoOccurrenceQuery, MatrixQuery,
)

router = APIRouter(prefix="/qualitative", tags=["Qualitative Analysis"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def parse_utterances(content: str, speakers: List[Speaker] = None) -> List[dict]:
    """Parse transcript content into utterances"""
    utterances = []
    paragraphs = content.split('\n\n')
    char_offset = 0
    
    speaker_pattern = re.compile(r'^([A-Z][^:]{0,30}):\s*(.*)$', re.MULTILINE)
    timestamp_pattern = re.compile(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]')
    
    for para_idx, para in enumerate(paragraphs):
        if not para.strip():
            char_offset += len(para) + 2
            continue
            
        # Try to extract speaker
        speaker_match = speaker_pattern.match(para)
        speaker_id = None
        text = para
        
        if speaker_match:
            speaker_name = speaker_match.group(1).strip()
            text = speaker_match.group(2).strip()
            
            # Find speaker ID
            if speakers:
                for s in speakers:
                    if s.name.lower() == speaker_name.lower():
                        speaker_id = s.id
                        break
        
        # Try to extract timestamp
        start_time = None
        timestamp_match = timestamp_pattern.search(para)
        if timestamp_match:
            time_str = timestamp_match.group(1)
            parts = time_str.split(':')
            if len(parts) == 2:
                start_time = int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                start_time = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        
        utterance = {
            "id": f"u_{para_idx}",
            "speaker_id": speaker_id,
            "text": text,
            "start_time": start_time,
            "end_time": None,
            "start_char": char_offset,
            "end_char": char_offset + len(para),
            "paragraph_index": para_idx
        }
        utterances.append(utterance)
        char_offset += len(para) + 2  # +2 for \n\n
    
    return utterances


async def get_user_info(user_id: str) -> dict:
    """Get user info from database"""
    if db is None:
        return {"id": user_id, "name": "Unknown"}
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        return {"id": user_id, "name": user.get("name", "Unknown")}
    return {"id": user_id, "name": "Unknown"}


def build_code_hierarchy(codes: List[dict]) -> List[dict]:
    """Build hierarchical code structure"""
    code_map = {str(c["_id"]): c for c in codes}
    root_codes = []
    
    for code in codes:
        code["id"] = str(code.pop("_id"))
        code["children"] = []
        
        parent_id = code.get("parent_id")
        if parent_id and parent_id in code_map:
            parent = code_map[parent_id]
            if "children" not in parent:
                parent["children"] = []
            parent["children"].append(code)
        else:
            root_codes.append(code)
    
    return root_codes


# =============================================================================
# PROJECTS
# =============================================================================

@router.post("/projects", response_model=dict)
async def create_project(
    project: QualProjectCreate,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Create a new qualitative analysis project"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    project_doc = {
        "name": project.name,
        "description": project.description,
        "research_questions": project.research_questions or [],
        "methodology": project.methodology,
        "settings": project.settings or {},
        "org_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "status": "active"
    }
    
    result = await db.qual_projects.insert_one(project_doc)
    
    return {
        "id": str(result.inserted_id),
        "message": "Project created successfully"
    }


@router.get("/projects", response_model=List[QualProjectResponse])
async def list_projects(
    org_id: str = Query(...),
    status: Optional[str] = None
):
    """List all qualitative projects"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"org_id": org_id}
    if status:
        query["status"] = status
    
    projects = await db.qual_projects.find(query).sort("updated_at", -1).to_list(100)
    
    result = []
    for proj in projects:
        # Get counts
        source_count = await db.qual_sources.count_documents({"project_id": str(proj["_id"])})
        code_count = await db.qual_codes.count_documents({"project_id": str(proj["_id"])})
        coding_count = await db.qual_codings.count_documents({"project_id": str(proj["_id"])})
        
        result.append(QualProjectResponse(
            id=str(proj["_id"]),
            name=proj["name"],
            description=proj.get("description"),
            research_questions=proj.get("research_questions"),
            methodology=proj.get("methodology"),
            source_count=source_count,
            code_count=code_count,
            coding_count=coding_count,
            created_at=proj["created_at"],
            updated_at=proj["updated_at"],
            created_by=proj["created_by"],
            org_id=proj["org_id"]
        ))
    
    return result


@router.get("/projects/{project_id}", response_model=QualProjectResponse)
async def get_project(project_id: str, org_id: str = Query(...)):
    """Get project details"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    project = await db.qual_projects.find_one({
        "_id": ObjectId(project_id),
        "org_id": org_id
    })
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    source_count = await db.qual_sources.count_documents({"project_id": project_id})
    code_count = await db.qual_codes.count_documents({"project_id": project_id})
    coding_count = await db.qual_codings.count_documents({"project_id": project_id})
    
    return QualProjectResponse(
        id=str(project["_id"]),
        name=project["name"],
        description=project.get("description"),
        research_questions=project.get("research_questions"),
        methodology=project.get("methodology"),
        source_count=source_count,
        code_count=code_count,
        coding_count=coding_count,
        created_at=project["created_at"],
        updated_at=project["updated_at"],
        created_by=project["created_by"],
        org_id=project["org_id"]
    )


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str,
    updates: QualProjectUpdate,
    org_id: str = Query(...)
):
    """Update project"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_doc = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.qual_projects.update_one(
        {"_id": ObjectId(project_id), "org_id": org_id},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project updated"}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, org_id: str = Query(...)):
    """Delete project and all related data"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Delete related data
    await db.qual_sources.delete_many({"project_id": project_id})
    await db.qual_codes.delete_many({"project_id": project_id})
    await db.qual_codings.delete_many({"project_id": project_id})
    await db.qual_memos.delete_many({"project_id": project_id})
    await db.qual_themes.delete_many({"project_id": project_id})
    
    result = await db.qual_projects.delete_one({
        "_id": ObjectId(project_id),
        "org_id": org_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted"}


# =============================================================================
# SOURCES (Transcripts, Notes, etc.)
# =============================================================================

@router.post("/sources", response_model=dict)
async def create_source(
    source: SourceCreate,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Create a new source document"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Parse content into utterances
    speakers = [Speaker(**s.model_dump()) for s in source.speakers] if source.speakers else []
    utterances = parse_utterances(source.content, speakers)
    
    source_doc = {
        "project_id": source.project_id,
        "name": source.name,
        "source_type": source.source_type.value,
        "content": source.content,
        "word_count": len(source.content.split()),
        "utterance_count": len(utterances),
        "utterances": utterances,
        
        "language": source.language,
        "date_collected": source.date_collected,
        "interviewer": source.interviewer,
        "site": source.site,
        "participant_id": source.participant_id,
        "participant_pseudonym": source.participant_pseudonym,
        "wave": source.wave,
        "group_type": source.group_type.value if source.group_type else None,
        
        "consent_verbatim_quotes": source.consent_verbatim_quotes,
        "consent_audio_retention": source.consent_audio_retention,
        "contains_pii": source.contains_pii,
        
        "speakers": [s.model_dump() for s in speakers] if speakers else [],
        "media_url": source.media_url,
        "media_duration": source.media_duration,
        "attributes": source.attributes or {},
        
        "coding_status": CodingStatus.IN_PROGRESS.value,
        "org_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.qual_sources.insert_one(source_doc)
    
    return {
        "id": str(result.inserted_id),
        "utterance_count": len(utterances),
        "word_count": source_doc["word_count"],
        "message": "Source created successfully"
    }


@router.get("/sources", response_model=List[dict])
async def list_sources(
    project_id: str = Query(...),
    org_id: str = Query(...),
    source_type: Optional[SourceType] = None,
    site: Optional[str] = None,
    wave: Optional[str] = None
):
    """List sources in a project"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if source_type:
        query["source_type"] = source_type.value
    if site:
        query["site"] = site
    if wave:
        query["wave"] = wave
    
    sources = await db.qual_sources.find(
        query,
        {"content": 0, "utterances": 0}  # Exclude large fields
    ).sort("created_at", -1).to_list(500)
    
    result = []
    for src in sources:
        coding_count = await db.qual_codings.count_documents({"source_id": str(src["_id"])})
        result.append({
            "id": str(src["_id"]),
            "project_id": src["project_id"],
            "name": src["name"],
            "source_type": src["source_type"],
            "word_count": src.get("word_count", 0),
            "utterance_count": src.get("utterance_count", 0),
            "language": src.get("language"),
            "date_collected": src.get("date_collected"),
            "interviewer": src.get("interviewer"),
            "site": src.get("site"),
            "participant_pseudonym": src.get("participant_pseudonym"),
            "wave": src.get("wave"),
            "group_type": src.get("group_type"),
            "coding_status": src.get("coding_status"),
            "coding_count": coding_count,
            "created_at": src["created_at"]
        })
    
    return result


@router.get("/sources/{source_id}", response_model=dict)
async def get_source(source_id: str, org_id: str = Query(...)):
    """Get source with full content"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    source = await db.qual_sources.find_one({
        "_id": ObjectId(source_id),
        "org_id": org_id
    })
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    # Get codings for this source
    codings = await db.qual_codings.find({"source_id": source_id}).to_list(1000)
    coding_count = len(codings)
    
    source["id"] = str(source.pop("_id"))
    source["coding_count"] = coding_count
    source["codings"] = [
        {
            "id": str(c["_id"]),
            "code_id": c["code_id"],
            "start_char": c["start_char"],
            "end_char": c["end_char"],
            "code_color": c.get("code_color", "#3B82F6")
        }
        for c in codings
    ]
    
    return source


@router.patch("/sources/{source_id}")
async def update_source(
    source_id: str,
    updates: SourceUpdate,
    org_id: str = Query(...)
):
    """Update source"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_doc = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    # Re-parse utterances if content changed
    if "content" in update_doc:
        source = await db.qual_sources.find_one({"_id": ObjectId(source_id)})
        speakers = [Speaker(**s) for s in source.get("speakers", [])]
        update_doc["utterances"] = parse_utterances(update_doc["content"], speakers)
        update_doc["word_count"] = len(update_doc["content"].split())
        update_doc["utterance_count"] = len(update_doc["utterances"])
    
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.qual_sources.update_one(
        {"_id": ObjectId(source_id), "org_id": org_id},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return {"message": "Source updated"}


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str, org_id: str = Query(...)):
    """Delete source and related codings"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    await db.qual_codings.delete_many({"source_id": source_id})
    
    result = await db.qual_sources.delete_one({
        "_id": ObjectId(source_id),
        "org_id": org_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Source not found")
    
    return {"message": "Source deleted"}


# =============================================================================
# CODEBOOK
# =============================================================================

@router.post("/codes", response_model=dict)
async def create_code(
    code: CodeCreate,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Create a new code"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get max sort order
    max_order = await db.qual_codes.find_one(
        {"project_id": code.project_id},
        sort=[("sort_order", -1)]
    )
    sort_order = (max_order.get("sort_order", 0) + 1) if max_order else 0
    
    code_doc = {
        "project_id": code.project_id,
        "name": code.name,
        "definition": code.definition,
        "description": code.description,
        "inclusion_criteria": code.inclusion_criteria,
        "exclusion_criteria": code.exclusion_criteria,
        "examples": code.examples or [],
        "parent_id": code.parent_id,
        "code_type": code.code_type.value,
        "polarity": code.polarity.value if code.polarity else None,
        "color": code.color,
        "is_sensitive": code.is_sensitive,
        "shortcut": code.shortcut,
        "sort_order": sort_order,
        "org_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.qual_codes.insert_one(code_doc)
    
    return {
        "id": str(result.inserted_id),
        "message": "Code created successfully"
    }


@router.get("/codes", response_model=List[dict])
async def list_codes(
    project_id: str = Query(...),
    org_id: str = Query(...),
    flat: bool = False
):
    """List codes (hierarchical or flat)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).sort("sort_order", 1).to_list(500)
    
    # Get usage counts
    for code in codes:
        code["usage_count"] = await db.qual_codings.count_documents({
            "code_id": str(code["_id"])
        })
    
    if flat:
        return [
            {
                "id": str(c["_id"]),
                "name": c["name"],
                "definition": c.get("definition"),
                "parent_id": c.get("parent_id"),
                "code_type": c.get("code_type"),
                "color": c.get("color", "#3B82F6"),
                "is_sensitive": c.get("is_sensitive", False),
                "shortcut": c.get("shortcut"),
                "usage_count": c.get("usage_count", 0),
                "sort_order": c.get("sort_order", 0)
            }
            for c in codes
        ]
    
    # Build hierarchy
    return build_code_hierarchy(codes)


@router.get("/codes/{code_id}", response_model=dict)
async def get_code(code_id: str, org_id: str = Query(...)):
    """Get code details"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    code = await db.qual_codes.find_one({
        "_id": ObjectId(code_id),
        "org_id": org_id
    })
    
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    
    code["id"] = str(code.pop("_id"))
    code["usage_count"] = await db.qual_codings.count_documents({"code_id": code_id})
    
    return code


@router.patch("/codes/{code_id}")
async def update_code(
    code_id: str,
    updates: CodeUpdate,
    org_id: str = Query(...)
):
    """Update code"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_doc = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    # Update color in all codings if color changed
    if "color" in update_doc:
        await db.qual_codings.update_many(
            {"code_id": code_id},
            {"$set": {"code_color": update_doc["color"]}}
        )
    
    result = await db.qual_codes.update_one(
        {"_id": ObjectId(code_id), "org_id": org_id},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    
    return {"message": "Code updated"}


@router.delete("/codes/{code_id}")
async def delete_code(code_id: str, org_id: str = Query(...)):
    """Delete code and update children"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get code to find parent
    code = await db.qual_codes.find_one({"_id": ObjectId(code_id)})
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    
    # Move children to parent (or root)
    await db.qual_codes.update_many(
        {"parent_id": code_id},
        {"$set": {"parent_id": code.get("parent_id")}}
    )
    
    # Delete codings with this code
    await db.qual_codings.delete_many({"code_id": code_id})
    
    await db.qual_codes.delete_one({
        "_id": ObjectId(code_id),
        "org_id": org_id
    })
    
    return {"message": "Code deleted"}


# =============================================================================
# CODING (Apply codes to excerpts)
# =============================================================================

@router.post("/codings", response_model=dict)
async def create_coding(
    coding: CodingCreate,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Apply a code to an excerpt"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get code info for color
    code = await db.qual_codes.find_one({"_id": ObjectId(coding.code_id)})
    if not code:
        raise HTTPException(status_code=404, detail="Code not found")
    
    # Get source info
    source = await db.qual_sources.find_one({"_id": ObjectId(coding.source_id)})
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    coding_doc = {
        "project_id": coding.project_id,
        "source_id": coding.source_id,
        "source_name": source["name"],
        "code_id": coding.code_id,
        "code_name": code["name"],
        "code_color": code.get("color", "#3B82F6"),
        
        "start_char": coding.start_char,
        "end_char": coding.end_char,
        "excerpt_text": coding.excerpt_text,
        "utterance_id": coding.utterance_id,
        "start_time": coding.start_time,
        "end_time": coding.end_time,
        
        "confidence": coding.confidence,
        "notes": coding.notes,
        "is_negative_case": coding.is_negative_case,
        
        "coder_id": user_id,
        "org_id": org_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.qual_codings.insert_one(coding_doc)
    
    return {
        "id": str(result.inserted_id),
        "message": "Coding created successfully"
    }


@router.get("/codings", response_model=List[CodingResponse])
async def list_codings(
    project_id: str = Query(...),
    org_id: str = Query(...),
    source_id: Optional[str] = None,
    code_id: Optional[str] = None,
    coder_id: Optional[str] = None,
    is_negative_case: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0
):
    """List codings with filters"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if source_id:
        query["source_id"] = source_id
    if code_id:
        query["code_id"] = code_id
    if coder_id:
        query["coder_id"] = coder_id
    if is_negative_case is not None:
        query["is_negative_case"] = is_negative_case
    
    codings = await db.qual_codings.find(query).skip(offset).limit(limit).to_list(limit)
    
    result = []
    for c in codings:
        # Get coder name
        coder_info = await get_user_info(c["coder_id"])
        
        result.append(CodingResponse(
            id=str(c["_id"]),
            project_id=c["project_id"],
            source_id=c["source_id"],
            source_name=c.get("source_name", "Unknown"),
            code_id=c["code_id"],
            code_name=c.get("code_name", "Unknown"),
            code_color=c.get("code_color", "#3B82F6"),
            start_char=c["start_char"],
            end_char=c["end_char"],
            excerpt_text=c["excerpt_text"],
            utterance_id=c.get("utterance_id"),
            start_time=c.get("start_time"),
            end_time=c.get("end_time"),
            confidence=c.get("confidence"),
            notes=c.get("notes"),
            is_negative_case=c.get("is_negative_case", False),
            coder_id=c["coder_id"],
            coder_name=coder_info["name"],
            created_at=c["created_at"],
            updated_at=c["updated_at"]
        ))
    
    return result


@router.patch("/codings/{coding_id}")
async def update_coding(
    coding_id: str,
    updates: CodingUpdate,
    org_id: str = Query(...)
):
    """Update coding"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_doc = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    # If code changed, update code info
    if "code_id" in update_doc:
        code = await db.qual_codes.find_one({"_id": ObjectId(update_doc["code_id"])})
        if code:
            update_doc["code_name"] = code["name"]
            update_doc["code_color"] = code.get("color", "#3B82F6")
    
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.qual_codings.update_one(
        {"_id": ObjectId(coding_id), "org_id": org_id},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Coding not found")
    
    return {"message": "Coding updated"}


@router.delete("/codings/{coding_id}")
async def delete_coding(coding_id: str, org_id: str = Query(...)):
    """Delete coding"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    result = await db.qual_codings.delete_one({
        "_id": ObjectId(coding_id),
        "org_id": org_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coding not found")
    
    return {"message": "Coding deleted"}


# =============================================================================
# RETRIEVAL & QUERIES
# =============================================================================

@router.post("/retrieve/by-code")
async def retrieve_by_code(
    query: CodeQuery,
    org_id: str = Query(...)
):
    """Retrieve all excerpts for given codes"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Build query
    match_query = {"project_id": query.project_id, "org_id": org_id}
    
    if query.operator == "AND":
        # All codes must be present on same excerpt (complex - use aggregation)
        pass  # Simplified for now
    elif query.operator == "NOT":
        match_query["code_id"] = {"$nin": query.code_ids}
    else:  # OR
        match_query["code_id"] = {"$in": query.code_ids}
    
    # Apply filters
    if query.source_ids:
        match_query["source_id"] = {"$in": query.source_ids}
    
    codings = await db.qual_codings.find(match_query).to_list(1000)
    
    # Apply source-level filters
    if query.sites or query.waves or query.group_types:
        source_query = {"project_id": query.project_id}
        if query.sites:
            source_query["site"] = {"$in": query.sites}
        if query.waves:
            source_query["wave"] = {"$in": query.waves}
        if query.group_types:
            source_query["group_type"] = {"$in": [g.value for g in query.group_types]}
        
        valid_sources = await db.qual_sources.find(source_query, {"_id": 1}).to_list(500)
        valid_source_ids = {str(s["_id"]) for s in valid_sources}
        codings = [c for c in codings if c["source_id"] in valid_source_ids]
    
    # Format results
    results = []
    for c in codings:
        excerpt = c["excerpt_text"]
        
        # Add context if requested
        if query.include_context:
            source = await db.qual_sources.find_one({"_id": ObjectId(c["source_id"])})
            if source:
                content = source["content"]
                start = max(0, c["start_char"] - query.context_chars)
                end = min(len(content), c["end_char"] + query.context_chars)
                context_before = content[start:c["start_char"]]
                context_after = content[c["end_char"]:end]
                excerpt = f"...{context_before}[{excerpt}]{context_after}..."
        
        results.append({
            "coding_id": str(c["_id"]),
            "source_id": c["source_id"],
            "source_name": c.get("source_name"),
            "code_id": c["code_id"],
            "code_name": c.get("code_name"),
            "code_color": c.get("code_color"),
            "excerpt": excerpt,
            "start_char": c["start_char"],
            "end_char": c["end_char"],
            "coder": c.get("coder_id"),
            "notes": c.get("notes"),
            "is_negative_case": c.get("is_negative_case", False)
        })
    
    return {
        "query": query.model_dump(),
        "total_results": len(results),
        "results": results
    }


@router.post("/retrieve/text-search")
async def text_search(
    query: TextSearchQuery,
    org_id: str = Query(...)
):
    """Search for text across sources"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Build regex pattern
    if query.search_type == "exact":
        pattern = re.escape(query.query)
    elif query.search_type == "fuzzy":
        # Simple fuzzy: allow single character variations
        pattern = "".join([f"{re.escape(c)}.?" for c in query.query])
    else:  # stemming - simplified
        pattern = query.query
    
    source_query = {"project_id": query.project_id, "org_id": org_id}
    if query.source_ids:
        source_query["_id"] = {"$in": [ObjectId(s) for s in query.source_ids]}
    
    sources = await db.qual_sources.find(source_query).to_list(500)
    
    results = []
    for source in sources:
        content = source["content"]
        matches = list(re.finditer(pattern, content, re.IGNORECASE))
        
        for match in matches:
            # Get context
            start = max(0, match.start() - 50)
            end = min(len(content), match.end() + 50)
            context = content[start:end]
            
            results.append({
                "source_id": str(source["_id"]),
                "source_name": source["name"],
                "match": match.group(),
                "context": f"...{context}...",
                "start_char": match.start(),
                "end_char": match.end()
            })
    
    return {
        "query": query.query,
        "search_type": query.search_type,
        "total_results": len(results),
        "results": results[:100]  # Limit to 100 results
    }


@router.post("/retrieve/co-occurrence")
async def code_co_occurrence(
    query: CoOccurrenceQuery,
    org_id: str = Query(...)
):
    """Find where two codes co-occur"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get codings for both codes
    codings_1 = await db.qual_codings.find({
        "project_id": query.project_id,
        "code_id": query.code_id_1,
        "org_id": org_id
    }).to_list(1000)
    
    codings_2 = await db.qual_codings.find({
        "project_id": query.project_id,
        "code_id": query.code_id_2,
        "org_id": org_id
    }).to_list(1000)
    
    # Find overlaps
    results = []
    for c1 in codings_1:
        for c2 in codings_2:
            if c1["source_id"] != c2["source_id"]:
                continue
            
            # Check proximity
            if query.proximity:
                # Within N characters
                distance = min(
                    abs(c1["start_char"] - c2["end_char"]),
                    abs(c2["start_char"] - c1["end_char"])
                )
                if distance > query.proximity:
                    continue
            else:
                # Must overlap
                if not (c1["start_char"] <= c2["end_char"] and c2["start_char"] <= c1["end_char"]):
                    continue
            
            results.append({
                "source_id": c1["source_id"],
                "source_name": c1.get("source_name"),
                "coding_1": {
                    "id": str(c1["_id"]),
                    "code_name": c1.get("code_name"),
                    "excerpt": c1["excerpt_text"]
                },
                "coding_2": {
                    "id": str(c2["_id"]),
                    "code_name": c2.get("code_name"),
                    "excerpt": c2["excerpt_text"]
                }
            })
    
    return {
        "code_1": query.code_id_1,
        "code_2": query.code_id_2,
        "proximity": query.proximity,
        "total_results": len(results),
        "results": results
    }


@router.post("/retrieve/matrix")
async def matrix_query(
    query: MatrixQuery,
    org_id: str = Query(...)
):
    """Generate code frequency matrix by attribute"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get all sources with their attributes
    sources = await db.qual_sources.find({
        "project_id": query.project_id,
        "org_id": org_id
    }).to_list(500)
    
    # Get codes
    codes = await db.qual_codes.find({
        "_id": {"$in": [ObjectId(c) for c in query.column_codes]}
    }).to_list(100)
    code_map = {str(c["_id"]): c["name"] for c in codes}
    
    # Build matrix
    matrix = {}
    for source in sources:
        row_value = source.get(query.row_attribute, "Unknown")
        if row_value not in matrix:
            matrix[row_value] = {code_map.get(cid, cid): 0 for cid in query.column_codes}
        
        # Count codings for this source
        codings = await db.qual_codings.find({
            "source_id": str(source["_id"]),
            "code_id": {"$in": query.column_codes}
        }).to_list(500)
        
        for coding in codings:
            code_name = code_map.get(coding["code_id"], coding["code_id"])
            matrix[row_value][code_name] += 1
    
    return {
        "row_attribute": query.row_attribute,
        "columns": [code_map.get(c, c) for c in query.column_codes],
        "matrix": matrix
    }


# =============================================================================
# MEMOS
# =============================================================================

@router.post("/memos", response_model=dict)
async def create_memo(
    memo: MemoCreate,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Create a memo"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    memo_doc = {
        "project_id": memo.project_id,
        "title": memo.title,
        "content": memo.content,
        "memo_type": memo.memo_type.value,
        "linked_source_id": memo.linked_source_id,
        "linked_code_id": memo.linked_code_id,
        "linked_coding_id": memo.linked_coding_id,
        "linked_theme_id": memo.linked_theme_id,
        "tags": memo.tags or [],
        "org_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.qual_memos.insert_one(memo_doc)
    
    return {"id": str(result.inserted_id), "message": "Memo created"}


@router.get("/memos", response_model=List[MemoResponse])
async def list_memos(
    project_id: str = Query(...),
    org_id: str = Query(...),
    memo_type: Optional[MemoType] = None,
    linked_code_id: Optional[str] = None,
    linked_source_id: Optional[str] = None
):
    """List memos"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if memo_type:
        query["memo_type"] = memo_type.value
    if linked_code_id:
        query["linked_code_id"] = linked_code_id
    if linked_source_id:
        query["linked_source_id"] = linked_source_id
    
    memos = await db.qual_memos.find(query).sort("created_at", -1).to_list(200)
    
    return [
        MemoResponse(
            id=str(m["_id"]),
            project_id=m["project_id"],
            title=m["title"],
            content=m["content"],
            memo_type=MemoType(m["memo_type"]),
            linked_source_id=m.get("linked_source_id"),
            linked_code_id=m.get("linked_code_id"),
            linked_coding_id=m.get("linked_coding_id"),
            linked_theme_id=m.get("linked_theme_id"),
            tags=m.get("tags"),
            created_at=m["created_at"],
            updated_at=m["updated_at"],
            created_by=m["created_by"]
        )
        for m in memos
    ]


# =============================================================================
# THEMES
# =============================================================================

@router.post("/themes", response_model=dict)
async def create_theme(
    theme: ThemeCreate,
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """Create a theme"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    theme_doc = {
        "project_id": theme.project_id,
        "title": theme.title,
        "description": theme.description,
        "parent_id": theme.parent_id,
        "status": ThemeStatus.DRAFT.value,
        "supporting_evidence": theme.supporting_evidence or [],
        "counter_evidence": theme.counter_evidence or [],
        "summary": theme.summary,
        "implications": theme.implications,
        "recommendations": theme.recommendations,
        "org_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.qual_themes.insert_one(theme_doc)
    
    return {"id": str(result.inserted_id), "message": "Theme created"}


@router.get("/themes", response_model=List[dict])
async def list_themes(
    project_id: str = Query(...),
    org_id: str = Query(...),
    status: Optional[ThemeStatus] = None
):
    """List themes"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if status:
        query["status"] = status.value
    
    themes = await db.qual_themes.find(query).sort("created_at", -1).to_list(100)
    
    result = []
    for t in themes:
        # Get evidence details
        supporting = []
        for coding_id in t.get("supporting_evidence", []):
            coding = await db.qual_codings.find_one({"_id": ObjectId(coding_id)})
            if coding:
                supporting.append({
                    "coding_id": coding_id,
                    "excerpt_text": coding["excerpt_text"],
                    "source_name": coding.get("source_name"),
                    "is_counter_evidence": False
                })
        
        counter = []
        for coding_id in t.get("counter_evidence", []):
            coding = await db.qual_codings.find_one({"_id": ObjectId(coding_id)})
            if coding:
                counter.append({
                    "coding_id": coding_id,
                    "excerpt_text": coding["excerpt_text"],
                    "source_name": coding.get("source_name"),
                    "is_counter_evidence": True
                })
        
        result.append({
            "id": str(t["_id"]),
            "project_id": t["project_id"],
            "title": t["title"],
            "description": t.get("description"),
            "parent_id": t.get("parent_id"),
            "status": t["status"],
            "supporting_evidence": supporting,
            "counter_evidence": counter,
            "summary": t.get("summary"),
            "implications": t.get("implications"),
            "recommendations": t.get("recommendations"),
            "created_at": t["created_at"],
            "updated_at": t["updated_at"],
            "created_by": t["created_by"]
        })
    
    return result


@router.patch("/themes/{theme_id}")
async def update_theme(
    theme_id: str,
    updates: ThemeUpdate,
    org_id: str = Query(...)
):
    """Update theme"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    update_doc = {k: v for k, v in updates.model_dump().items() if v is not None}
    if "status" in update_doc:
        update_doc["status"] = update_doc["status"].value
    update_doc["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.qual_themes.update_one(
        {"_id": ObjectId(theme_id), "org_id": org_id},
        {"$set": update_doc}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    return {"message": "Theme updated"}


# =============================================================================
# STATISTICS
# =============================================================================

@router.get("/stats/{project_id}")
async def get_project_stats(project_id: str, org_id: str = Query(...)):
    """Get project statistics"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Counts
    source_count = await db.qual_sources.count_documents({"project_id": project_id})
    code_count = await db.qual_codes.count_documents({"project_id": project_id})
    coding_count = await db.qual_codings.count_documents({"project_id": project_id})
    memo_count = await db.qual_memos.count_documents({"project_id": project_id})
    theme_count = await db.qual_themes.count_documents({"project_id": project_id})
    
    # Code frequency
    pipeline = [
        {"$match": {"project_id": project_id}},
        {"$group": {"_id": "$code_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    code_freq = []
    async for doc in db.qual_codings.aggregate(pipeline):
        code = await db.qual_codes.find_one({"_id": ObjectId(doc["_id"])})
        if code:
            code_freq.append({
                "code_id": doc["_id"],
                "code_name": code["name"],
                "color": code.get("color", "#3B82F6"),
                "count": doc["count"]
            })
    
    # Sources by site
    site_pipeline = [
        {"$match": {"project_id": project_id}},
        {"$group": {"_id": "$site", "count": {"$sum": 1}}}
    ]
    sources_by_site = {}
    async for doc in db.qual_sources.aggregate(site_pipeline):
        sources_by_site[doc["_id"] or "Unknown"] = doc["count"]
    
    return {
        "source_count": source_count,
        "code_count": code_count,
        "coding_count": coding_count,
        "memo_count": memo_count,
        "theme_count": theme_count,
        "code_frequency": code_freq,
        "sources_by_site": sources_by_site
    }
