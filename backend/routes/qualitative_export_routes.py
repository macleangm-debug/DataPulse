"""
Qualitative Analysis Module - REFI-QDA Export/Import
Interoperability with NVivo, ATLAS.ti, MAXQDA
"""

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import xml.etree.ElementTree as ET
from xml.dom import minidom
import io
import json
import zipfile

router = APIRouter(prefix="/qualitative/export", tags=["Qualitative Export/Import"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# REFI-QDA XML EXPORT
# =============================================================================

@router.get("/refi-qda/{project_id}")
async def export_refi_qda(
    project_id: str,
    org_id: str = Query(...),
    include_sources: bool = Query(default=True),
    include_codings: bool = Query(default=True)
):
    """
    Export project in REFI-QDA XML format
    Compatible with NVivo, ATLAS.ti, MAXQDA
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get project
    project = await db.qual_projects.find_one({
        "_id": ObjectId(project_id),
        "org_id": org_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create REFI-QDA XML structure
    root = ET.Element("Project")
    root.set("xmlns", "urn:QDA-XML:project:1.0")
    root.set("name", project["name"])
    root.set("creatingUserGUID", str(project.get("created_by", "")))
    root.set("creationDateTime", project["created_at"].isoformat() if project.get("created_at") else "")
    
    # Add Users element
    users = ET.SubElement(root, "Users")
    user_elem = ET.SubElement(users, "User")
    user_elem.set("guid", str(project.get("created_by", "user-1")))
    user_elem.set("name", "DataPulse User")
    
    # Add CodeBook
    codebook = ET.SubElement(root, "CodeBook")
    codes_elem = ET.SubElement(codebook, "Codes")
    
    # Get codes
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(500)
    code_guid_map = {}
    
    def add_code_element(code, parent_elem):
        code_elem = ET.SubElement(parent_elem, "Code")
        guid = f"code-{code['_id']}"
        code_guid_map[str(code["_id"])] = guid
        code_elem.set("guid", guid)
        code_elem.set("name", code["name"])
        code_elem.set("isCodable", "true")
        
        if code.get("color"):
            code_elem.set("color", code["color"])
        
        if code.get("definition"):
            desc = ET.SubElement(code_elem, "Description")
            desc.text = code["definition"]
        
        # Handle child codes (hierarchical)
        child_codes = [c for c in codes if c.get("parent_id") == str(code["_id"])]
        for child in child_codes:
            add_code_element(child, code_elem)
    
    # Add root-level codes
    root_codes = [c for c in codes if not c.get("parent_id")]
    for code in root_codes:
        add_code_element(code, codes_elem)
    
    # Add Sources
    if include_sources:
        sources_elem = ET.SubElement(root, "Sources")
        sources = await db.qual_sources.find({"project_id": project_id}).to_list(500)
        source_guid_map = {}
        
        for source in sources:
            source_elem = ET.SubElement(sources_elem, "TextSource")
            guid = f"source-{source['_id']}"
            source_guid_map[str(source["_id"])] = guid
            source_elem.set("guid", guid)
            source_elem.set("name", source["name"])
            source_elem.set("creatingUser", str(source.get("created_by", "")))
            source_elem.set("creationDateTime", source["created_at"].isoformat() if source.get("created_at") else "")
            
            # Add plain text content
            plain_text = ET.SubElement(source_elem, "PlainTextContent")
            plain_text.text = source.get("content", "")
            
            # Add codings for this source
            if include_codings:
                codings = await db.qual_codings.find({
                    "source_id": str(source["_id"])
                }).to_list(1000)
                
                if codings:
                    coding_elem = ET.SubElement(source_elem, "Coding")
                    for coding in codings:
                        code_ref = ET.SubElement(coding_elem, "CodeRef")
                        code_ref.set("targetGUID", code_guid_map.get(coding["code_id"], ""))
                        
                        # Add selection range
                        sel_range = ET.SubElement(code_ref, "SelectionRange")
                        sel_range.set("start", str(coding.get("start_char", 0)))
                        sel_range.set("end", str(coding.get("end_char", 0)))
    
    # Add Notes (Memos)
    memos = await db.qual_memos.find({"project_id": project_id}).to_list(200)
    if memos:
        notes_elem = ET.SubElement(root, "Notes")
        for memo in memos:
            note_elem = ET.SubElement(notes_elem, "Note")
            note_elem.set("guid", f"memo-{memo['_id']}")
            note_elem.set("name", memo.get("title", "Untitled"))
            note_elem.set("creatingUser", str(memo.get("created_by", "")))
            note_elem.set("creationDateTime", memo["created_at"].isoformat() if memo.get("created_at") else "")
            
            plain_text = ET.SubElement(note_elem, "PlainTextContent")
            plain_text.text = memo.get("content", "")
    
    # Pretty print XML
    xml_str = ET.tostring(root, encoding='unicode')
    dom = minidom.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent="  ")
    
    # Return as downloadable file
    return Response(
        content=pretty_xml,
        media_type="application/xml",
        headers={
            "Content-Disposition": f'attachment; filename="{project["name"]}_REFI-QDA.xml"'
        }
    )


# =============================================================================
# QDPX (QDA Project Exchange) EXPORT
# =============================================================================

@router.get("/qdpx/{project_id}")
async def export_qdpx(
    project_id: str,
    org_id: str = Query(...)
):
    """
    Export project as QDPX file (zipped REFI-QDA with sources)
    Full interoperability package for NVivo, ATLAS.ti, MAXQDA
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get project
    project = await db.qual_projects.find_one({
        "_id": ObjectId(project_id),
        "org_id": org_id
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create in-memory zip file
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Generate and add REFI-QDA XML
        root = ET.Element("Project")
        root.set("xmlns", "urn:QDA-XML:project:1.0")
        root.set("name", project["name"])
        
        # Add basic structure (simplified for QDPX)
        users = ET.SubElement(root, "Users")
        user_elem = ET.SubElement(users, "User")
        user_elem.set("guid", "user-1")
        user_elem.set("name", "DataPulse User")
        
        # CodeBook
        codebook = ET.SubElement(root, "CodeBook")
        codes_elem = ET.SubElement(codebook, "Codes")
        
        codes = await db.qual_codes.find({"project_id": project_id}).to_list(500)
        code_guid_map = {}
        
        for code in codes:
            if not code.get("parent_id"):
                code_elem = ET.SubElement(codes_elem, "Code")
                guid = f"code-{code['_id']}"
                code_guid_map[str(code["_id"])] = guid
                code_elem.set("guid", guid)
                code_elem.set("name", code["name"])
                if code.get("definition"):
                    desc = ET.SubElement(code_elem, "Description")
                    desc.text = code["definition"]
        
        # Sources with external files
        sources_elem = ET.SubElement(root, "Sources")
        sources = await db.qual_sources.find({"project_id": project_id}).to_list(500)
        
        for idx, source in enumerate(sources):
            source_elem = ET.SubElement(sources_elem, "TextSource")
            guid = f"source-{source['_id']}"
            source_elem.set("guid", guid)
            source_elem.set("name", source["name"])
            
            # Reference external file
            filename = f"Sources/{idx+1}_{source['name']}.txt"
            source_elem.set("plainTextPath", filename)
            
            # Add source content as separate file
            zf.writestr(filename, source.get("content", ""))
            
            # Add codings
            codings = await db.qual_codings.find({
                "source_id": str(source["_id"])
            }).to_list(1000)
            
            if codings:
                coding_elem = ET.SubElement(source_elem, "Coding")
                for coding in codings:
                    if coding["code_id"] in code_guid_map:
                        code_ref = ET.SubElement(coding_elem, "CodeRef")
                        code_ref.set("targetGUID", code_guid_map[coding["code_id"]])
                        sel = ET.SubElement(code_ref, "SelectionRange")
                        sel.set("start", str(coding.get("start_char", 0)))
                        sel.set("end", str(coding.get("end_char", 0)))
        
        # Write project XML
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        zf.writestr("project.qde", dom.toprettyxml(indent="  "))
        
        # Add manifest
        manifest = {
            "software": "DataPulse",
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "project_name": project["name"],
            "source_count": len(sources),
            "code_count": len(codes)
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{project["name"]}.qdpx"'
        }
    )


# =============================================================================
# CODEBOOK EXPORT (STANDALONE)
# =============================================================================

@router.get("/codebook/{project_id}")
async def export_codebook(
    project_id: str,
    org_id: str = Query(...),
    format: str = Query(default="json", description="json, csv, or xml")
):
    """
    Export codebook in various formats
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(500)
    
    if format == "json":
        codebook = []
        for code in codes:
            codebook.append({
                "id": str(code["_id"]),
                "name": code["name"],
                "definition": code.get("definition"),
                "description": code.get("description"),
                "color": code.get("color"),
                "parent_id": code.get("parent_id"),
                "inclusion_criteria": code.get("inclusion_criteria"),
                "exclusion_criteria": code.get("exclusion_criteria"),
                "examples": code.get("examples", [])
            })
        
        return Response(
            content=json.dumps(codebook, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="codebook.json"'
            }
        )
    
    elif format == "csv":
        lines = ["id,name,definition,color,parent_id"]
        for code in codes:
            line = f'"{code["_id"]}","{code["name"]}","{code.get("definition", "")}","{code.get("color", "")}","{code.get("parent_id", "")}"'
            lines.append(line)
        
        return Response(
            content="\n".join(lines),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="codebook.csv"'
            }
        )
    
    elif format == "xml":
        root = ET.Element("Codebook")
        for code in codes:
            code_elem = ET.SubElement(root, "Code")
            code_elem.set("id", str(code["_id"]))
            code_elem.set("name", code["name"])
            if code.get("color"):
                code_elem.set("color", code["color"])
            if code.get("definition"):
                def_elem = ET.SubElement(code_elem, "Definition")
                def_elem.text = code["definition"]
        
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        
        return Response(
            content=dom.toprettyxml(indent="  "),
            media_type="application/xml",
            headers={
                "Content-Disposition": f'attachment; filename="codebook.xml"'
            }
        )
    
    raise HTTPException(status_code=400, detail="Invalid format")


# =============================================================================
# CODINGS EXPORT
# =============================================================================

@router.get("/codings/{project_id}")
async def export_codings(
    project_id: str,
    org_id: str = Query(...),
    format: str = Query(default="json", description="json or csv")
):
    """
    Export all codings for a project
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(10000)
    
    if format == "json":
        export_data = []
        for c in codings:
            export_data.append({
                "id": str(c["_id"]),
                "source_id": c["source_id"],
                "source_name": c.get("source_name"),
                "code_id": c["code_id"],
                "code_name": c.get("code_name"),
                "excerpt_text": c["excerpt_text"],
                "start_char": c["start_char"],
                "end_char": c["end_char"],
                "coder_id": c.get("coder_id"),
                "created_at": c["created_at"].isoformat() if c.get("created_at") else None
            })
        
        return Response(
            content=json.dumps(export_data, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="codings.json"'
            }
        )
    
    elif format == "csv":
        lines = ["source_name,code_name,excerpt_text,start_char,end_char,coder_id"]
        for c in codings:
            excerpt = c["excerpt_text"].replace('"', '""').replace('\n', ' ')[:500]
            line = f'"{c.get("source_name", "")}","{c.get("code_name", "")}","{excerpt}",{c["start_char"]},{c["end_char"]},"{c.get("coder_id", "")}"'
            lines.append(line)
        
        return Response(
            content="\n".join(lines),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="codings.csv"'
            }
        )
    
    raise HTTPException(status_code=400, detail="Invalid format")


# =============================================================================
# IMPORT CODEBOOK
# =============================================================================

@router.post("/import-codebook/{project_id}")
async def import_codebook(
    project_id: str,
    org_id: str = Query(...),
    user_id: str = Query(...),
    codebook_data: List[dict] = None
):
    """
    Import codebook from JSON format
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not codebook_data:
        raise HTTPException(status_code=400, detail="No codebook data provided")
    
    imported_count = 0
    id_map = {}  # Map old IDs to new IDs for parent relationships
    
    # First pass: create codes without parents
    for code_data in codebook_data:
        code_doc = {
            "project_id": project_id,
            "name": code_data.get("name", "Imported Code"),
            "definition": code_data.get("definition"),
            "description": code_data.get("description"),
            "color": code_data.get("color", "#3B82F6"),
            "inclusion_criteria": code_data.get("inclusion_criteria"),
            "exclusion_criteria": code_data.get("exclusion_criteria"),
            "examples": code_data.get("examples", []),
            "parent_id": None,  # Set in second pass
            "org_id": org_id,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.qual_codes.insert_one(code_doc)
        id_map[code_data.get("id", "")] = str(result.inserted_id)
        imported_count += 1
    
    # Second pass: update parent relationships
    for code_data in codebook_data:
        old_parent = code_data.get("parent_id")
        if old_parent and old_parent in id_map:
            new_id = id_map.get(code_data.get("id"))
            new_parent = id_map.get(old_parent)
            if new_id and new_parent:
                await db.qual_codes.update_one(
                    {"_id": ObjectId(new_id)},
                    {"$set": {"parent_id": new_parent}}
                )
    
    return {
        "imported_count": imported_count,
        "message": f"Successfully imported {imported_count} codes"
    }
