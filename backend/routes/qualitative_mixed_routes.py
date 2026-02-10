"""
Qualitative Analysis Module - Mixed Methods Support
Link qualitative themes with quantitative variables
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel

router = APIRouter(prefix="/qualitative/mixed", tags=["Qualitative Mixed Methods"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ThemeVariableLink(BaseModel):
    theme_id: str
    variable_name: str
    variable_type: str  # categorical, numeric, date
    relationship: str  # correlates, explains, contradicts, elaborates
    notes: Optional[str] = None


class JointDisplayConfig(BaseModel):
    qual_theme_ids: List[str]
    quant_variables: List[str]
    grouping_variable: Optional[str] = None
    display_type: str = "side_by_side"  # side_by_side, integrated, sequential


# =============================================================================
# THEME-VARIABLE LINKING
# =============================================================================

@router.post("/links")
async def create_theme_variable_link(
    link: ThemeVariableLink,
    project_id: str = Query(...),
    org_id: str = Query(...),
    user_id: str = Query(...)
):
    """
    Create a link between a qualitative theme and a quantitative variable
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Verify theme exists
    theme = await db.qual_themes.find_one({
        "_id": ObjectId(link.theme_id),
        "project_id": project_id
    })
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    
    link_doc = {
        "project_id": project_id,
        "theme_id": link.theme_id,
        "theme_title": theme["title"],
        "variable_name": link.variable_name,
        "variable_type": link.variable_type,
        "relationship": link.relationship,
        "notes": link.notes,
        "org_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.qual_mixed_links.insert_one(link_doc)
    
    return {
        "id": str(result.inserted_id),
        "message": "Theme-variable link created"
    }


@router.get("/links")
async def list_theme_variable_links(
    project_id: str = Query(...),
    org_id: str = Query(...),
    theme_id: Optional[str] = None,
    variable_name: Optional[str] = None
):
    """List all theme-variable links for a project"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    query = {"project_id": project_id, "org_id": org_id}
    if theme_id:
        query["theme_id"] = theme_id
    if variable_name:
        query["variable_name"] = variable_name
    
    links = await db.qual_mixed_links.find(query).to_list(200)
    
    return [
        {
            "id": str(link["_id"]),
            "theme_id": link["theme_id"],
            "theme_title": link.get("theme_title"),
            "variable_name": link["variable_name"],
            "variable_type": link["variable_type"],
            "relationship": link["relationship"],
            "notes": link.get("notes"),
            "created_at": link["created_at"]
        }
        for link in links
    ]


@router.delete("/links/{link_id}")
async def delete_theme_variable_link(
    link_id: str,
    org_id: str = Query(...)
):
    """Delete a theme-variable link"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    result = await db.qual_mixed_links.delete_one({
        "_id": ObjectId(link_id),
        "org_id": org_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {"message": "Link deleted"}


# =============================================================================
# JOINT DISPLAY GENERATION
# =============================================================================

@router.post("/joint-display")
async def generate_joint_display(
    config: JointDisplayConfig,
    project_id: str = Query(...),
    org_id: str = Query(...)
):
    """
    Generate a joint display combining qualitative and quantitative data
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get themes with their evidence
    themes_data = []
    for theme_id in config.qual_theme_ids:
        theme = await db.qual_themes.find_one({"_id": ObjectId(theme_id)})
        if theme:
            # Get supporting quotes
            quotes = []
            for coding_id in theme.get("supporting_evidence", [])[:5]:
                try:
                    coding = await db.qual_codings.find_one({"_id": ObjectId(coding_id)})
                    if coding:
                        quotes.append({
                            "text": coding["excerpt_text"],
                            "source": coding.get("source_name", "Unknown")
                        })
                except:
                    pass
            
            themes_data.append({
                "id": str(theme["_id"]),
                "title": theme["title"],
                "description": theme.get("description"),
                "quotes": quotes,
                "evidence_count": len(theme.get("supporting_evidence", []))
            })
    
    # Get quantitative data from submissions
    quant_data = {}
    
    # Try to get submission data with the requested variables
    try:
        # Get submissions from the project's linked form
        project = await db.qual_projects.find_one({"_id": ObjectId(project_id)})
        form_id = project.get("linked_form_id") if project else None
        
        if form_id:
            submissions = await db.submissions.find({"form_id": form_id}).to_list(500)
            
            for var in config.quant_variables:
                var_values = []
                for sub in submissions:
                    data = sub.get("data", {})
                    if var in data:
                        var_values.append(data[var])
                
                if var_values:
                    # Calculate basic statistics
                    if all(isinstance(v, (int, float)) for v in var_values if v is not None):
                        numeric_vals = [v for v in var_values if v is not None]
                        quant_data[var] = {
                            "type": "numeric",
                            "count": len(numeric_vals),
                            "mean": sum(numeric_vals) / len(numeric_vals) if numeric_vals else 0,
                            "min": min(numeric_vals) if numeric_vals else 0,
                            "max": max(numeric_vals) if numeric_vals else 0
                        }
                    else:
                        # Categorical - count frequencies
                        freq = {}
                        for v in var_values:
                            v_str = str(v) if v is not None else "Missing"
                            freq[v_str] = freq.get(v_str, 0) + 1
                        quant_data[var] = {
                            "type": "categorical",
                            "count": len(var_values),
                            "frequencies": freq
                        }
    except Exception as e:
        print(f"Error fetching quant data: {e}")
    
    # Build joint display
    joint_display = {
        "project_id": project_id,
        "display_type": config.display_type,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "qualitative": {
            "themes": themes_data,
            "theme_count": len(themes_data),
            "total_quotes": sum(len(t["quotes"]) for t in themes_data)
        },
        "quantitative": {
            "variables": quant_data,
            "variable_count": len(quant_data)
        },
        "integration": []
    }
    
    # Create integrated view if we have links
    links = await db.qual_mixed_links.find({
        "project_id": project_id,
        "theme_id": {"$in": config.qual_theme_ids}
    }).to_list(100)
    
    for link in links:
        theme_data = next((t for t in themes_data if t["id"] == link["theme_id"]), None)
        var_data = quant_data.get(link["variable_name"])
        
        if theme_data and var_data:
            joint_display["integration"].append({
                "theme": theme_data["title"],
                "variable": link["variable_name"],
                "relationship": link["relationship"],
                "theme_evidence_count": theme_data["evidence_count"],
                "variable_summary": var_data,
                "notes": link.get("notes")
            })
    
    return joint_display


# =============================================================================
# CROSS-REFERENCE ANALYSIS
# =============================================================================

@router.post("/cross-reference")
async def cross_reference_analysis(
    project_id: str = Query(...),
    org_id: str = Query(...),
    source_attribute: str = Query(..., description="Source attribute to cross-reference"),
    quant_variable: str = Query(..., description="Quantitative variable to analyze")
):
    """
    Cross-reference qualitative codings with quantitative variables
    Shows how coding patterns differ across groups defined by quant variables
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get sources with their attributes
    sources = await db.qual_sources.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(500)
    
    # Group sources by the attribute
    source_groups = {}
    for s in sources:
        attr_value = s.get("attributes", {}).get(source_attribute, "Unknown")
        if attr_value not in source_groups:
            source_groups[attr_value] = []
        source_groups[attr_value].append(str(s["_id"]))
    
    # Get codes
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    code_map = {str(c["_id"]): c["name"] for c in codes}
    
    # Get all codings
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(5000)
    
    # Analyze coding patterns by group
    analysis = {}
    for group_name, source_ids in source_groups.items():
        group_codings = [c for c in codings if c["source_id"] in source_ids]
        
        code_counts = {}
        for c in group_codings:
            code_name = code_map.get(c["code_id"], "Unknown")
            code_counts[code_name] = code_counts.get(code_name, 0) + 1
        
        total = len(group_codings)
        analysis[group_name] = {
            "source_count": len(source_ids),
            "coding_count": total,
            "code_distribution": {
                name: {
                    "count": count,
                    "percentage": round(count / total * 100, 1) if total > 0 else 0
                }
                for name, count in sorted(code_counts.items(), key=lambda x: -x[1])[:10]
            }
        }
    
    return {
        "project_id": project_id,
        "grouping_attribute": source_attribute,
        "quant_variable": quant_variable,
        "groups": list(analysis.keys()),
        "analysis": analysis
    }


# =============================================================================
# CONVERGENCE ANALYSIS
# =============================================================================

@router.get("/convergence/{project_id}")
async def convergence_analysis(
    project_id: str,
    org_id: str = Query(...)
):
    """
    Analyze convergence/divergence between qualitative themes and quantitative findings
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get all links
    links = await db.qual_mixed_links.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(200)
    
    # Categorize by relationship type
    convergent = []
    divergent = []
    elaborating = []
    
    for link in links:
        link_summary = {
            "theme": link.get("theme_title"),
            "variable": link["variable_name"],
            "notes": link.get("notes")
        }
        
        if link["relationship"] in ["correlates", "confirms"]:
            convergent.append(link_summary)
        elif link["relationship"] in ["contradicts", "challenges"]:
            divergent.append(link_summary)
        else:  # explains, elaborates
            elaborating.append(link_summary)
    
    return {
        "project_id": project_id,
        "total_links": len(links),
        "convergent": {
            "count": len(convergent),
            "findings": convergent
        },
        "divergent": {
            "count": len(divergent),
            "findings": divergent
        },
        "elaborating": {
            "count": len(elaborating),
            "findings": elaborating
        },
        "integration_score": round(
            (len(convergent) - len(divergent) * 0.5 + len(elaborating) * 0.3) / 
            max(len(links), 1) * 100, 1
        ) if links else 0
    }
