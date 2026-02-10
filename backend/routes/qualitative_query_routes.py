"""
Qualitative Analysis Module - Advanced Queries (Phase 2)
Boolean queries, proximity search, matrix coding
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix="/qualitative/query", tags=["Qualitative Advanced Queries"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# BOOLEAN QUERIES
# =============================================================================

@router.post("/boolean")
async def boolean_query(
    project_id: str = Query(...),
    org_id: str = Query(...),
    code_ids: List[str] = Query(..., description="Code IDs to query"),
    operator: str = Query(default="AND", description="AND, OR, NOT"),
    exclude_codes: Optional[List[str]] = Query(default=None, description="Codes to exclude (for NOT)")
):
    """
    Execute boolean queries across codes
    - AND: Excerpts coded with ALL specified codes
    - OR: Excerpts coded with ANY specified codes  
    - NOT: Excerpts with codes but NOT exclude_codes
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    if not code_ids:
        raise HTTPException(status_code=400, detail="At least one code_id required")
    
    # Get all codings for the specified codes
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id,
        "code_id": {"$in": code_ids}
    }).to_list(5000)
    
    if operator == "OR":
        # Return all codings with any of the specified codes
        results = [
            {
                "id": str(c["_id"]),
                "source_id": c["source_id"],
                "source_name": c.get("source_name", "Unknown"),
                "code_id": c["code_id"],
                "code_name": c.get("code_name"),
                "excerpt_text": c["excerpt_text"],
                "start_char": c["start_char"],
                "end_char": c["end_char"]
            }
            for c in codings
        ]
        
    elif operator == "AND":
        # Group codings by source and position to find overlapping segments
        segment_map = {}
        
        for c in codings:
            key = f"{c['source_id']}:{c['start_char']}-{c['end_char']}"
            if key not in segment_map:
                segment_map[key] = {
                    "source_id": c["source_id"],
                    "source_name": c.get("source_name", "Unknown"),
                    "excerpt_text": c["excerpt_text"],
                    "start_char": c["start_char"],
                    "end_char": c["end_char"],
                    "codes": set()
                }
            segment_map[key]["codes"].add(c["code_id"])
        
        # Find segments with overlapping codes
        results = []
        for key, segment in segment_map.items():
            # Check if this segment overlaps with others that have different codes
            has_all_codes = all(cid in segment["codes"] for cid in code_ids)
            
            if not has_all_codes:
                # Check for nearby segments (within 100 chars)
                source_segments = [s for k, s in segment_map.items() 
                                   if s["source_id"] == segment["source_id"]]
                combined_codes = set()
                for other in source_segments:
                    # Check overlap or adjacency
                    if (abs(other["start_char"] - segment["start_char"]) < 100 or
                        (other["start_char"] <= segment["end_char"] and 
                         segment["start_char"] <= other["end_char"])):
                        combined_codes.update(other["codes"])
                
                has_all_codes = all(cid in combined_codes for cid in code_ids)
            
            if has_all_codes:
                results.append({
                    "source_id": segment["source_id"],
                    "source_name": segment["source_name"],
                    "excerpt_text": segment["excerpt_text"],
                    "start_char": segment["start_char"],
                    "end_char": segment["end_char"],
                    "codes_found": list(segment["codes"])
                })
        
        # Remove duplicates based on source and position
        seen = set()
        unique_results = []
        for r in results:
            key = f"{r['source_id']}:{r['start_char']}"
            if key not in seen:
                seen.add(key)
                unique_results.append(r)
        results = unique_results
        
    elif operator == "NOT":
        if not exclude_codes:
            raise HTTPException(status_code=400, detail="exclude_codes required for NOT operator")
        
        # Get codings with exclude codes
        exclude_codings = await db.qual_codings.find({
            "project_id": project_id,
            "org_id": org_id,
            "code_id": {"$in": exclude_codes}
        }).to_list(5000)
        
        # Build set of excluded segments
        excluded_segments = set()
        for c in exclude_codings:
            excluded_segments.add(f"{c['source_id']}:{c['start_char']}-{c['end_char']}")
        
        # Filter out excluded
        results = []
        for c in codings:
            key = f"{c['source_id']}:{c['start_char']}-{c['end_char']}"
            if key not in excluded_segments:
                results.append({
                    "id": str(c["_id"]),
                    "source_id": c["source_id"],
                    "source_name": c.get("source_name", "Unknown"),
                    "code_id": c["code_id"],
                    "code_name": c.get("code_name"),
                    "excerpt_text": c["excerpt_text"],
                    "start_char": c["start_char"],
                    "end_char": c["end_char"]
                })
    else:
        raise HTTPException(status_code=400, detail="Invalid operator. Use AND, OR, or NOT")
    
    return {
        "operator": operator,
        "code_ids": code_ids,
        "exclude_codes": exclude_codes,
        "result_count": len(results),
        "results": results
    }


# =============================================================================
# PROXIMITY SEARCH
# =============================================================================

@router.post("/proximity")
async def proximity_search(
    project_id: str = Query(...),
    org_id: str = Query(...),
    code_id_1: str = Query(..., description="First code"),
    code_id_2: str = Query(..., description="Second code"),
    max_distance: int = Query(default=500, description="Max characters between codes")
):
    """
    Find where two codes appear near each other
    Returns excerpts where both codes appear within max_distance characters
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get codings for both codes
    codings_1 = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id,
        "code_id": code_id_1
    }).to_list(2000)
    
    codings_2 = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id,
        "code_id": code_id_2
    }).to_list(2000)
    
    # Group by source
    source_codings_1 = {}
    for c in codings_1:
        sid = c["source_id"]
        if sid not in source_codings_1:
            source_codings_1[sid] = []
        source_codings_1[sid].append(c)
    
    source_codings_2 = {}
    for c in codings_2:
        sid = c["source_id"]
        if sid not in source_codings_2:
            source_codings_2[sid] = []
        source_codings_2[sid].append(c)
    
    # Find proximities
    results = []
    
    for source_id in set(source_codings_1.keys()) & set(source_codings_2.keys()):
        for c1 in source_codings_1[source_id]:
            for c2 in source_codings_2[source_id]:
                # Calculate distance
                if c1["end_char"] <= c2["start_char"]:
                    distance = c2["start_char"] - c1["end_char"]
                elif c2["end_char"] <= c1["start_char"]:
                    distance = c1["start_char"] - c2["end_char"]
                else:
                    # Overlapping
                    distance = 0
                
                if distance <= max_distance:
                    results.append({
                        "source_id": source_id,
                        "source_name": c1.get("source_name", "Unknown"),
                        "distance": distance,
                        "code_1": {
                            "id": c1["code_id"],
                            "name": c1.get("code_name"),
                            "excerpt": c1["excerpt_text"],
                            "start": c1["start_char"],
                            "end": c1["end_char"]
                        },
                        "code_2": {
                            "id": c2["code_id"],
                            "name": c2.get("code_name"),
                            "excerpt": c2["excerpt_text"],
                            "start": c2["start_char"],
                            "end": c2["end_char"]
                        }
                    })
    
    # Sort by distance
    results.sort(key=lambda x: x["distance"])
    
    return {
        "code_1": code_id_1,
        "code_2": code_id_2,
        "max_distance": max_distance,
        "result_count": len(results),
        "results": results[:100]  # Limit results
    }


# =============================================================================
# MATRIX CODING QUERY
# =============================================================================

@router.post("/matrix")
async def matrix_coding_query(
    project_id: str = Query(...),
    org_id: str = Query(...),
    row_attribute: str = Query(..., description="Attribute for rows (e.g., 'site', 'participant_type')"),
    column_codes: Optional[List[str]] = Query(default=None, description="Code IDs for columns (all if not specified)")
):
    """
    Generate a matrix coding query
    Rows: Source attribute values (e.g., sites, participant types)
    Columns: Codes
    Cells: Count of codings
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get all sources with the attribute
    sources = await db.qual_sources.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(500)
    
    # Build source attribute map
    source_attrs = {}
    attr_values = set()
    for s in sources:
        attrs = s.get("attributes", {})
        attr_value = attrs.get(row_attribute, "Unknown")
        source_attrs[str(s["_id"])] = attr_value
        attr_values.add(attr_value)
    
    # Get codes
    code_query = {"project_id": project_id, "org_id": org_id}
    if column_codes:
        code_query["_id"] = {"$in": [ObjectId(cid) for cid in column_codes]}
    
    codes = await db.qual_codes.find(code_query).to_list(100)
    code_names = {str(c["_id"]): c["name"] for c in codes}
    
    # Get all codings
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(5000)
    
    # Build matrix
    matrix = {}
    for attr_val in sorted(attr_values):
        matrix[attr_val] = {code_names[cid]: 0 for cid in code_names}
    
    # Count codings
    for c in codings:
        attr_val = source_attrs.get(c["source_id"], "Unknown")
        code_name = code_names.get(c["code_id"])
        if attr_val in matrix and code_name in matrix[attr_val]:
            matrix[attr_val][code_name] += 1
    
    # Convert to list format for easier rendering
    matrix_data = []
    for attr_val, code_counts in matrix.items():
        row = {row_attribute: attr_val}
        row.update(code_counts)
        row["_total"] = sum(code_counts.values())
        matrix_data.append(row)
    
    # Calculate column totals
    column_totals = {code_names[cid]: 0 for cid in code_names}
    for row in matrix_data:
        for code_name in code_names.values():
            column_totals[code_name] += row.get(code_name, 0)
    
    return {
        "row_attribute": row_attribute,
        "columns": list(code_names.values()),
        "rows": list(attr_values),
        "matrix": matrix_data,
        "column_totals": column_totals,
        "grand_total": sum(column_totals.values())
    }


# =============================================================================
# CROSS-CASE COMPARISON
# =============================================================================

@router.post("/cross-case")
async def cross_case_comparison(
    project_id: str = Query(...),
    org_id: str = Query(...),
    compare_attribute: str = Query(..., description="Attribute to compare (e.g., 'site', 'participant_type')"),
    code_ids: Optional[List[str]] = Query(default=None, description="Codes to include in comparison")
):
    """
    Compare coding patterns across different cases/groups
    Useful for identifying differences between sites, participant types, etc.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get sources grouped by attribute
    sources = await db.qual_sources.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(500)
    
    groups = {}
    for s in sources:
        attr_value = s.get("attributes", {}).get(compare_attribute, "Unknown")
        if attr_value not in groups:
            groups[attr_value] = {
                "sources": [],
                "source_count": 0,
                "total_words": 0
            }
        groups[attr_value]["sources"].append(str(s["_id"]))
        groups[attr_value]["source_count"] += 1
        groups[attr_value]["total_words"] += s.get("word_count", 0)
    
    # Get codings
    coding_query = {"project_id": project_id, "org_id": org_id}
    if code_ids:
        coding_query["code_id"] = {"$in": code_ids}
    
    codings = await db.qual_codings.find(coding_query).to_list(5000)
    
    # Get code names
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    code_map = {str(c["_id"]): c["name"] for c in codes}
    
    # Build comparison data
    comparison = {}
    for group_name, group_data in groups.items():
        group_source_ids = group_data["sources"]
        group_codings = [c for c in codings if c["source_id"] in group_source_ids]
        
        # Count codes
        code_counts = {}
        for c in group_codings:
            code_name = code_map.get(c["code_id"], c["code_id"])
            code_counts[code_name] = code_counts.get(code_name, 0) + 1
        
        # Calculate percentages
        total_codings = len(group_codings)
        code_percentages = {
            name: round(count / total_codings * 100, 1) if total_codings > 0 else 0
            for name, count in code_counts.items()
        }
        
        comparison[group_name] = {
            "source_count": group_data["source_count"],
            "total_words": group_data["total_words"],
            "total_codings": total_codings,
            "code_counts": code_counts,
            "code_percentages": code_percentages,
            "top_codes": sorted(code_counts.items(), key=lambda x: -x[1])[:5]
        }
    
    return {
        "compare_attribute": compare_attribute,
        "groups": list(comparison.keys()),
        "comparison": comparison
    }


# =============================================================================
# CODE FREQUENCY ANALYSIS
# =============================================================================

@router.get("/code-frequency/{project_id}")
async def code_frequency_analysis(
    project_id: str,
    org_id: str = Query(...),
    group_by: Optional[str] = Query(default=None, description="Group by source attribute")
):
    """
    Detailed code frequency analysis
    Shows absolute counts, percentages, and distribution
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get codes
    codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(100)
    
    code_map = {str(c["_id"]): {"name": c["name"], "color": c.get("color")} for c in codes}
    
    # Get codings
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(5000)
    
    # Count frequencies
    code_freq = {}
    source_coverage = {}
    
    for c in codings:
        code_id = c["code_id"]
        source_id = c["source_id"]
        
        if code_id not in code_freq:
            code_freq[code_id] = {
                "count": 0,
                "sources": set(),
                "char_coverage": 0
            }
        
        code_freq[code_id]["count"] += 1
        code_freq[code_id]["sources"].add(source_id)
        code_freq[code_id]["char_coverage"] += (c["end_char"] - c["start_char"])
        
        # Track source coverage
        if source_id not in source_coverage:
            source_coverage[source_id] = set()
        source_coverage[source_id].add(code_id)
    
    # Get total sources
    total_sources = await db.qual_sources.count_documents({
        "project_id": project_id,
        "org_id": org_id
    })
    
    # Build results
    total_codings = len(codings)
    results = []
    
    for code_id, freq_data in code_freq.items():
        code_info = code_map.get(code_id, {"name": code_id, "color": "#888"})
        
        results.append({
            "code_id": code_id,
            "code_name": code_info["name"],
            "code_color": code_info["color"],
            "count": freq_data["count"],
            "percentage": round(freq_data["count"] / total_codings * 100, 1) if total_codings > 0 else 0,
            "source_count": len(freq_data["sources"]),
            "source_coverage": round(len(freq_data["sources"]) / total_sources * 100, 1) if total_sources > 0 else 0,
            "avg_chars": round(freq_data["char_coverage"] / freq_data["count"]) if freq_data["count"] > 0 else 0
        })
    
    # Sort by count descending
    results.sort(key=lambda x: -x["count"])
    
    return {
        "project_id": project_id,
        "total_codings": total_codings,
        "total_codes_used": len(code_freq),
        "total_sources": total_sources,
        "frequencies": results
    }
