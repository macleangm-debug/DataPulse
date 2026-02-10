"""
Qualitative Analysis Module - Publication Visuals
Framework matrices, quote cards, charts, network diagrams
"""

from fastapi import APIRouter, HTTPException, Query, Response
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import json

router = APIRouter(prefix="/qualitative/visuals", tags=["Qualitative Visuals"])

# Database reference
db = None

def set_database(database):
    global db
    db = database


# =============================================================================
# FRAMEWORK MATRIX
# =============================================================================

@router.get("/framework-matrix/{project_id}")
async def get_framework_matrix(
    project_id: str,
    org_id: str = Query(...),
    row_type: str = Query(default="source", description="source, theme, or attribute"),
    row_attribute: Optional[str] = Query(default=None, description="Attribute name if row_type is attribute"),
    column_type: str = Query(default="code", description="code or theme")
):
    """
    Generate a framework matrix for qualitative analysis
    Rows: Sources, Themes, or Source Attributes
    Columns: Codes or Themes
    Cells: Excerpts/Summaries
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get sources
    sources = await db.qual_sources.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(200)
    
    # Get codes
    codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(100)
    
    # Get codings
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(5000)
    
    # Build row labels
    rows = []
    if row_type == "source":
        rows = [{"id": str(s["_id"]), "label": s["name"]} for s in sources]
    elif row_type == "theme":
        themes = await db.qual_themes.find({"project_id": project_id}).to_list(50)
        rows = [{"id": str(t["_id"]), "label": t["title"]} for t in themes]
    elif row_type == "attribute" and row_attribute:
        attr_values = set()
        for s in sources:
            val = s.get("attributes", {}).get(row_attribute, "Unknown")
            attr_values.add(val)
        rows = [{"id": val, "label": val} for val in sorted(attr_values)]
    
    # Build column labels
    columns = []
    if column_type == "code":
        columns = [{"id": str(c["_id"]), "label": c["name"], "color": c.get("color", "#3B82F6")} for c in codes]
    elif column_type == "theme":
        themes = await db.qual_themes.find({"project_id": project_id}).to_list(50)
        columns = [{"id": str(t["_id"]), "label": t["title"]} for t in themes]
    
    # Build matrix data
    matrix = []
    code_map = {str(c["_id"]): c["name"] for c in codes}
    
    for row in rows:
        row_data = {"row_id": row["id"], "row_label": row["label"], "cells": {}}
        
        for col in columns:
            cell_codings = []
            
            if row_type == "source" and column_type == "code":
                cell_codings = [
                    c for c in codings 
                    if c["source_id"] == row["id"] and c["code_id"] == col["id"]
                ]
            elif row_type == "attribute" and column_type == "code":
                # Find sources with this attribute value
                source_ids = [
                    str(s["_id"]) for s in sources 
                    if s.get("attributes", {}).get(row_attribute) == row["id"]
                ]
                cell_codings = [
                    c for c in codings 
                    if c["source_id"] in source_ids and c["code_id"] == col["id"]
                ]
            
            # Build cell content
            if cell_codings:
                excerpts = [c["excerpt_text"][:150] for c in cell_codings[:3]]
                row_data["cells"][col["id"]] = {
                    "count": len(cell_codings),
                    "excerpts": excerpts,
                    "has_data": True
                }
            else:
                row_data["cells"][col["id"]] = {
                    "count": 0,
                    "excerpts": [],
                    "has_data": False
                }
        
        matrix.append(row_data)
    
    return {
        "project_id": project_id,
        "row_type": row_type,
        "column_type": column_type,
        "rows": rows,
        "columns": columns,
        "matrix": matrix
    }


# =============================================================================
# QUOTE CARDS
# =============================================================================

@router.get("/quote-cards/{project_id}")
async def get_quote_cards(
    project_id: str,
    org_id: str = Query(...),
    theme_id: Optional[str] = None,
    code_id: Optional[str] = None,
    limit: int = Query(default=20, le=100)
):
    """
    Generate quote cards for presentations
    Each card contains an excerpt with metadata
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Build query
    query = {"project_id": project_id, "org_id": org_id}
    if code_id:
        query["code_id"] = code_id
    
    codings = await db.qual_codings.find(query).limit(limit * 2).to_list(limit * 2)
    
    # If theme_id specified, filter by theme's supporting evidence
    if theme_id:
        theme = await db.qual_themes.find_one({"_id": ObjectId(theme_id)})
        if theme:
            evidence_ids = [str(e) for e in theme.get("supporting_evidence", [])]
            codings = [c for c in codings if str(c["_id"]) in evidence_ids]
    
    # Get codes for labels
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    code_map = {str(c["_id"]): c for c in codes}
    
    # Generate quote cards
    cards = []
    for coding in codings[:limit]:
        code_info = code_map.get(coding["code_id"], {})
        
        card = {
            "id": str(coding["_id"]),
            "quote": coding["excerpt_text"],
            "source": coding.get("source_name", "Unknown Source"),
            "code": {
                "name": code_info.get("name", "Unknown"),
                "color": code_info.get("color", "#3B82F6")
            },
            "character_count": len(coding["excerpt_text"]),
            "word_count": len(coding["excerpt_text"].split()),
            "position": {
                "start": coding["start_char"],
                "end": coding["end_char"]
            },
            "metadata": {
                "coder": coding.get("coder_id"),
                "coded_at": coding["created_at"].isoformat() if coding.get("created_at") else None
            }
        }
        cards.append(card)
    
    return {
        "project_id": project_id,
        "card_count": len(cards),
        "cards": cards
    }


@router.get("/quote-cards/{project_id}/export")
async def export_quote_cards_html(
    project_id: str,
    org_id: str = Query(...),
    theme_id: Optional[str] = None,
    code_id: Optional[str] = None
):
    """
    Export quote cards as presentation-ready HTML
    """
    cards_response = await get_quote_cards(project_id, org_id, theme_id, code_id, limit=50)
    cards = cards_response["cards"]
    
    html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Quote Cards</title>
    <style>
        body { 
            font-family: 'Georgia', serif; 
            background: #f5f5f5; 
            padding: 40px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 24px;
        }
        .quote-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            position: relative;
            border-left: 4px solid #3B82F6;
        }
        .quote-text {
            font-size: 16px;
            line-height: 1.6;
            color: #1f2937;
            margin-bottom: 16px;
            font-style: italic;
        }
        .quote-text::before { content: '"'; font-size: 24px; color: #9ca3af; }
        .quote-text::after { content: '"'; font-size: 24px; color: #9ca3af; }
        .quote-source {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
        }
        .quote-code {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            color: white;
        }
        h1 { color: #1f2937; text-align: center; margin-bottom: 40px; }
    </style>
</head>
<body>
    <h1>Research Quotes</h1>
    <div class="cards-grid">
"""
    
    for card in cards:
        color = card["code"]["color"]
        html += f"""
        <div class="quote-card" style="border-left-color: {color};">
            <div class="quote-text">{card["quote"]}</div>
            <div class="quote-source">— {card["source"]}</div>
            <span class="quote-code" style="background: {color};">{card["code"]["name"]}</span>
        </div>
"""
    
    html += """
    </div>
</body>
</html>"""
    
    return Response(
        content=html,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="quote_cards.html"'
        }
    )


# =============================================================================
# CODE FREQUENCY CHART DATA
# =============================================================================

@router.get("/code-frequency-chart/{project_id}")
async def get_code_frequency_chart(
    project_id: str,
    org_id: str = Query(...),
    chart_type: str = Query(default="bar", description="bar, pie, treemap")
):
    """
    Get data for code frequency visualization
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get codes
    codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(100)
    
    code_map = {str(c["_id"]): c for c in codes}
    
    # Get codings
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(10000)
    
    # Count frequencies
    freq = {}
    for c in codings:
        code_id = c["code_id"]
        freq[code_id] = freq.get(code_id, 0) + 1
    
    # Build chart data
    total = len(codings)
    chart_data = []
    
    for code_id, count in sorted(freq.items(), key=lambda x: -x[1]):
        code_info = code_map.get(code_id, {})
        chart_data.append({
            "code_id": code_id,
            "name": code_info.get("name", "Unknown"),
            "color": code_info.get("color", "#3B82F6"),
            "count": count,
            "percentage": round(count / total * 100, 1) if total > 0 else 0
        })
    
    return {
        "project_id": project_id,
        "chart_type": chart_type,
        "total_codings": total,
        "data": chart_data
    }


# =============================================================================
# THEME NETWORK DIAGRAM
# =============================================================================

@router.get("/theme-network/{project_id}")
async def get_theme_network(
    project_id: str,
    org_id: str = Query(...)
):
    """
    Generate data for theme network diagram
    Shows relationships between themes, codes, and excerpts
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get themes
    themes = await db.qual_themes.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(50)
    
    # Get codes
    codes = await db.qual_codes.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(100)
    
    # Get codings to find code relationships
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(5000)
    
    # Build nodes
    nodes = []
    
    # Theme nodes
    for theme in themes:
        nodes.append({
            "id": f"theme-{theme['_id']}",
            "type": "theme",
            "label": theme["title"],
            "size": len(theme.get("supporting_evidence", [])) + 10,
            "color": "#8B5CF6"
        })
    
    # Code nodes
    for code in codes:
        code_count = len([c for c in codings if c["code_id"] == str(code["_id"])])
        nodes.append({
            "id": f"code-{code['_id']}",
            "type": "code",
            "label": code["name"],
            "size": code_count + 5,
            "color": code.get("color", "#3B82F6")
        })
    
    # Build edges
    edges = []
    
    # Theme-code relationships (based on related codes in AI-generated themes)
    for theme in themes:
        related_codes = theme.get("ai_related_codes", [])
        for code_name in related_codes:
            code = next((c for c in codes if c["name"].lower() == code_name.lower()), None)
            if code:
                edges.append({
                    "source": f"theme-{theme['_id']}",
                    "target": f"code-{code['_id']}",
                    "weight": 2,
                    "type": "theme_code"
                })
    
    # Code co-occurrence edges
    source_code_map = {}
    for coding in codings:
        source_id = coding["source_id"]
        code_id = coding["code_id"]
        if source_id not in source_code_map:
            source_code_map[source_id] = set()
        source_code_map[source_id].add(code_id)
    
    # Find code pairs that appear together
    co_occurrence = {}
    for source_id, code_ids in source_code_map.items():
        code_list = list(code_ids)
        for i in range(len(code_list)):
            for j in range(i + 1, len(code_list)):
                pair = tuple(sorted([code_list[i], code_list[j]]))
                co_occurrence[pair] = co_occurrence.get(pair, 0) + 1
    
    # Add co-occurrence edges (top 20)
    sorted_pairs = sorted(co_occurrence.items(), key=lambda x: -x[1])[:20]
    for (code1, code2), count in sorted_pairs:
        if count >= 2:
            edges.append({
                "source": f"code-{code1}",
                "target": f"code-{code2}",
                "weight": count,
                "type": "co_occurrence"
            })
    
    return {
        "project_id": project_id,
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges)
    }


# =============================================================================
# CODING TIMELINE
# =============================================================================

@router.get("/coding-timeline/{project_id}")
async def get_coding_timeline(
    project_id: str,
    org_id: str = Query(...),
    group_by: str = Query(default="day", description="hour, day, week")
):
    """
    Get coding activity over time for timeline visualization
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    codings = await db.qual_codings.find({
        "project_id": project_id,
        "org_id": org_id
    }).sort("created_at", 1).to_list(10000)
    
    # Group by time period
    timeline = {}
    
    for coding in codings:
        if not coding.get("created_at"):
            continue
        
        dt = coding["created_at"]
        if group_by == "hour":
            key = dt.strftime("%Y-%m-%d %H:00")
        elif group_by == "day":
            key = dt.strftime("%Y-%m-%d")
        elif group_by == "week":
            key = dt.strftime("%Y-W%W")
        else:
            key = dt.strftime("%Y-%m-%d")
        
        if key not in timeline:
            timeline[key] = {"count": 0, "codes": {}, "coders": set()}
        
        timeline[key]["count"] += 1
        code_name = coding.get("code_name", "Unknown")
        timeline[key]["codes"][code_name] = timeline[key]["codes"].get(code_name, 0) + 1
        if coding.get("coder_id"):
            timeline[key]["coders"].add(coding["coder_id"])
    
    # Convert to list
    timeline_data = []
    for period, data in sorted(timeline.items()):
        timeline_data.append({
            "period": period,
            "coding_count": data["count"],
            "unique_codes": len(data["codes"]),
            "unique_coders": len(data["coders"]),
            "top_code": max(data["codes"].items(), key=lambda x: x[1])[0] if data["codes"] else None
        })
    
    return {
        "project_id": project_id,
        "group_by": group_by,
        "periods": len(timeline_data),
        "timeline": timeline_data
    }


# =============================================================================
# SOURCE COVERAGE HEATMAP
# =============================================================================

@router.get("/coverage-heatmap/{project_id}")
async def get_coverage_heatmap(
    project_id: str,
    org_id: str = Query(...)
):
    """
    Generate heatmap showing which parts of sources have been coded
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    sources = await db.qual_sources.find({
        "project_id": project_id,
        "org_id": org_id
    }).to_list(100)
    
    heatmap_data = []
    
    for source in sources:
        source_id = str(source["_id"])
        content_length = len(source.get("content", ""))
        
        if content_length == 0:
            continue
        
        # Get codings for this source
        codings = await db.qual_codings.find({
            "source_id": source_id
        }).to_list(500)
        
        # Create coverage array (divide content into segments)
        num_segments = min(50, max(10, content_length // 200))
        segment_size = content_length / num_segments
        coverage = [0] * num_segments
        
        for coding in codings:
            start_seg = int(coding["start_char"] / segment_size)
            end_seg = int(coding["end_char"] / segment_size)
            for i in range(max(0, start_seg), min(num_segments, end_seg + 1)):
                coverage[i] += 1
        
        # Normalize coverage
        max_coverage = max(coverage) if coverage else 1
        normalized = [round(c / max_coverage * 100) for c in coverage]
        
        heatmap_data.append({
            "source_id": source_id,
            "source_name": source["name"],
            "content_length": content_length,
            "coding_count": len(codings),
            "coverage_percentage": round(sum(1 for c in coverage if c > 0) / num_segments * 100, 1),
            "segments": normalized
        })
    
    return {
        "project_id": project_id,
        "source_count": len(heatmap_data),
        "heatmap": heatmap_data
    }
