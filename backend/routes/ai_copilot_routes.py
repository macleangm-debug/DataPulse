"""DataPulse - AI Analysis Copilot
Natural language to statistical analysis with guardrails.

Features:
- Natural language query understanding
- Analysis plan generation
- Executable code generation
- Results with full traceability
- Evidence-linked narratives
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import json
import hashlib
import os

router = APIRouter(prefix="/ai-copilot", tags=["AI Analysis Copilot"])


# ============ Models ============

class AnalysisQuery(BaseModel):
    snapshot_id: Optional[str] = None
    form_id: Optional[str] = None
    org_id: str
    query: str  # Natural language query
    context: Optional[Dict[str, Any]] = None  # Additional context


class DataPrepSuggestion(BaseModel):
    snapshot_id: Optional[str] = None
    form_id: Optional[str] = None
    org_id: str
    variables: Optional[List[str]] = None


class NarrativeRequest(BaseModel):
    analysis_id: str
    org_id: str
    style: str = "executive"  # executive, technical, plain


# ============ AI Analysis Engine ============

async def get_schema_context(db, form_id: str) -> str:
    """Get form schema as context for AI"""
    form = await db.forms.find_one({"id": form_id})
    if not form:
        return "No schema available."
    
    fields = form.get("fields", [])
    context_lines = ["Available variables:"]
    for f in fields[:50]:  # Limit to first 50 fields
        var_type = f.get("type", "text")
        label = f.get("label", f.get("id", ""))
        options = f.get("options", [])
        
        line = f"- {f.get('id')}: {label} (type: {var_type})"
        if options:
            vals = [o.get("value", "") for o in options[:5]]
            line += f" [values: {', '.join(str(v) for v in vals)}]"
        context_lines.append(line)
    
    return "\n".join(context_lines)


async def get_data_summary(db, snapshot_id: str = None, form_id: str = None) -> str:
    """Get data summary for AI context"""
    if snapshot_id:
        snapshot = await db.snapshots.find_one({"id": snapshot_id})
        if snapshot:
            return f"Dataset: {snapshot.get('name')} with {snapshot.get('row_count', 0)} observations"
    
    if form_id:
        count = await db.submissions.count_documents({"form_id": form_id, "status": "approved"})
        return f"Form data with {count} approved submissions"
    
    return "No data context available"


@router.post("/analyze")
async def analyze_with_ai(
    request: Request,
    req: AnalysisQuery
):
    """
    Natural language to analysis with full traceability.
    
    The AI will:
    1. Parse the query to understand intent
    2. Generate an analysis plan
    3. Execute appropriate statistical tests
    4. Return results with citations
    """
    db = request.app.state.db
    
    # Get API key
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Build context
    schema_context = ""
    if req.form_id:
        schema_context = await get_schema_context(db, req.form_id)
    
    data_summary = await get_data_summary(db, req.snapshot_id, req.form_id)
    
    # Create analysis record for traceability
    analysis_id = f"analysis_{int(datetime.now(timezone.utc).timestamp())}_{hashlib.md5(req.query.encode()).hexdigest()[:8]}"
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        system_prompt = """You are a statistical analysis assistant for survey data. Your role is to:
1. Understand the user's analysis request
2. Identify the appropriate statistical methods
3. Specify exactly which variables to use
4. Provide a clear analysis plan

RULES (NON-NEGOTIABLE):
- Never invent or fabricate data
- Always specify exact variable names from the schema
- Recommend appropriate statistical tests based on data types
- Flag any assumptions that need to be checked
- If the query is unclear, ask for clarification

Respond in JSON format:
{
    "understood_query": "Plain language restatement of what user wants",
    "analysis_type": "descriptive|comparison|correlation|regression|other",
    "statistical_method": "Name of statistical method",
    "variables": {
        "dependent": "var_id or null",
        "independent": ["var_id1", "var_id2"],
        "grouping": "var_id or null"
    },
    "assumptions_to_check": ["assumption1", "assumption2"],
    "analysis_plan": ["Step 1", "Step 2", "Step 3"],
    "api_endpoint": "/api/statistics/endpoint_to_call",
    "api_params": {"param1": "value1"}
}"""

        user_content = f"""User query: {req.query}

{data_summary}

{schema_context}

Based on the available data and variables, provide an analysis plan."""

        # Initialize chat with system message
        chat = LlmChat(
            api_key=api_key,
            session_id=analysis_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        # Send user message
        response = await chat.send_message(UserMessage(text=user_content))
        
        # Parse AI response
        try:
            # Extract JSON from response
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            analysis_plan = json.loads(response_text)
        except json.JSONDecodeError:
            analysis_plan = {
                "understood_query": req.query,
                "analysis_type": "unknown",
                "raw_response": response,
                "error": "Could not parse structured response"
            }
        
        # Store analysis record
        analysis_record = {
            "id": analysis_id,
            "org_id": req.org_id,
            "query": req.query,
            "snapshot_id": req.snapshot_id,
            "form_id": req.form_id,
            "analysis_plan": analysis_plan,
            "status": "planned",
            "created_at": datetime.now(timezone.utc)
        }
        await db.ai_analyses.insert_one(analysis_record)
        
        # Execute the analysis if we have a valid endpoint
        results = None
        if analysis_plan.get("api_endpoint") and analysis_plan.get("api_params"):
            results = await execute_analysis(
                db, 
                analysis_plan["api_endpoint"],
                analysis_plan["api_params"],
                req.snapshot_id,
                req.form_id,
                req.org_id
            )
            
            # Update record with results
            await db.ai_analyses.update_one(
                {"id": analysis_id},
                {"$set": {"status": "completed", "results": results}}
            )
        
        return {
            "analysis_id": analysis_id,
            "query": req.query,
            "analysis_plan": analysis_plan,
            "results": results,
            "traceability": {
                "snapshot_id": req.snapshot_id,
                "form_id": req.form_id,
                "variables_used": analysis_plan.get("variables", {}),
                "method": analysis_plan.get("statistical_method"),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


async def execute_analysis(db, endpoint: str, params: dict, snapshot_id: str, form_id: str, org_id: str):
    """Execute the recommended analysis"""
    import pandas as pd
    import numpy as np
    from scipy import stats as scipy_stats
    
    # Get data
    if snapshot_id:
        snapshot_data = await db.snapshot_data.find_one({"snapshot_id": snapshot_id})
        if not snapshot_data:
            return {"error": "Snapshot not found"}
        data = snapshot_data.get("data", [])
    else:
        submissions = await db.submissions.find({
            "form_id": form_id,
            "status": "approved"
        }).to_list(None)
        data = [s.get("data", {}) for s in submissions]
    
    if not data:
        return {"error": "No data available"}
    
    df = pd.DataFrame(data)
    
    # Route to appropriate analysis
    if "descriptives" in endpoint or "quick" in endpoint:
        variables = params.get("variables", [])
        results = {}
        for var in variables:
            if var in df.columns:
                series = pd.to_numeric(df[var], errors='coerce').dropna()
                if len(series) > 0:
                    results[var] = {
                        "n": int(len(series)),
                        "mean": round(float(series.mean()), 4),
                        "std": round(float(series.std()), 4),
                        "median": round(float(series.median()), 4)
                    }
        return {"type": "descriptives", "results": results}
    
    elif "ttest" in endpoint:
        var = params.get("variable")
        group_var = params.get("group_var")
        
        if var and group_var and var in df.columns and group_var in df.columns:
            groups = df[group_var].dropna().unique()
            if len(groups) == 2:
                g1 = pd.to_numeric(df[df[group_var] == groups[0]][var], errors='coerce').dropna()
                g2 = pd.to_numeric(df[df[group_var] == groups[1]][var], errors='coerce').dropna()
                
                if len(g1) > 1 and len(g2) > 1:
                    t_stat, p_val = scipy_stats.ttest_ind(g1, g2)
                    return {
                        "type": "t_test",
                        "groups": [str(groups[0]), str(groups[1])],
                        "means": [round(float(g1.mean()), 4), round(float(g2.mean()), 4)],
                        "t_statistic": round(float(t_stat), 4),
                        "p_value": round(float(p_val), 4),
                        "significant": p_val < 0.05
                    }
        return {"error": "Could not execute t-test with given parameters"}
    
    elif "correlation" in endpoint:
        variables = params.get("variables", [])
        valid_vars = [v for v in variables if v in df.columns]
        
        if len(valid_vars) >= 2:
            df_subset = df[valid_vars].apply(pd.to_numeric, errors='coerce').dropna()
            corr_matrix = df_subset.corr()
            return {
                "type": "correlation",
                "variables": valid_vars,
                "correlation_matrix": corr_matrix.round(4).to_dict()
            }
        return {"error": "Need at least 2 numeric variables for correlation"}
    
    elif "crosstab" in endpoint:
        row_var = params.get("row_var")
        col_var = params.get("col_var")
        
        if row_var and col_var and row_var in df.columns and col_var in df.columns:
            ct = pd.crosstab(df[row_var], df[col_var], margins=True)
            return {
                "type": "crosstab",
                "row_variable": row_var,
                "col_variable": col_var,
                "table": ct.to_dict()
            }
        return {"error": "Could not create crosstab with given variables"}
    
    return {"error": f"Unknown endpoint: {endpoint}"}


# ============ Data Preparation Suggestions ============

@router.post("/suggest-prep")
async def suggest_data_preparation(
    request: Request,
    req: DataPrepSuggestion
):
    """AI-powered suggestions for data preparation"""
    db = request.app.state.db
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Get form schema
    form = await db.forms.find_one({"id": req.form_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    fields = form.get("fields", [])
    
    # Get sample data
    submissions = await db.submissions.find({
        "form_id": req.form_id,
        "status": "approved"
    }).limit(100).to_list(100)
    
    sample_data = [s.get("data", {}) for s in submissions]
    
    if not sample_data:
        return {"suggestions": [], "message": "No data available for analysis"}
    
    import pandas as pd
    df = pd.DataFrame(sample_data)
    
    # Analyze data patterns
    suggestions = []
    
    for field in fields:
        field_id = field.get("id")
        if field_id not in df.columns:
            continue
        
        series = df[field_id]
        
        # Check for potential missing value codes
        unique_vals = series.dropna().unique()
        potential_missing = []
        for val in unique_vals:
            str_val = str(val).lower()
            if str_val in ['98', '99', '999', '-1', '-99', 'na', 'n/a', 'dk', "don't know", 'refused']:
                potential_missing.append(val)
        
        if potential_missing:
            suggestions.append({
                "variable": field_id,
                "type": "missing_values",
                "suggestion": f"Consider treating {potential_missing} as missing values",
                "action": {
                    "type": "recode_missing",
                    "values": potential_missing
                }
            })
        
        # Check for sparse categories
        if field.get("type") in ["select", "radio"]:
            value_counts = series.value_counts()
            total = len(series.dropna())
            sparse_cats = value_counts[value_counts / total < 0.05].index.tolist()
            
            if len(sparse_cats) > 1:
                suggestions.append({
                    "variable": field_id,
                    "type": "sparse_categories",
                    "suggestion": f"Categories with <5% responses: {sparse_cats[:5]}. Consider collapsing.",
                    "action": {
                        "type": "collapse_categories",
                        "categories": sparse_cats
                    }
                })
        
        # Check for potential scale items
        if field.get("type") == "number":
            numeric_series = pd.to_numeric(series, errors='coerce').dropna()
            if len(numeric_series) > 10:
                min_val, max_val = numeric_series.min(), numeric_series.max()
                if max_val - min_val <= 10 and min_val >= 0:
                    suggestions.append({
                        "variable": field_id,
                        "type": "scale_item",
                        "suggestion": f"Appears to be a scale item (range {min_val}-{max_val}). Consider grouping with similar items.",
                        "action": {
                            "type": "create_scale",
                            "range": [int(min_val), int(max_val)]
                        }
                    })
    
    return {
        "form_id": req.form_id,
        "n_observations": len(sample_data),
        "n_variables": len(fields),
        "suggestions": suggestions
    }


# ============ Evidence-Linked Narratives ============

@router.post("/narrative")
async def generate_narrative(
    request: Request,
    req: NarrativeRequest
):
    """Generate evidence-linked narrative from analysis results"""
    db = request.app.state.db
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Get analysis record
    analysis = await db.ai_analyses.find_one({"id": req.analysis_id, "org_id": req.org_id})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    if not analysis.get("results"):
        return {"error": "Analysis has no results to narrate"}
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        style_instructions = {
            "executive": "Write a brief executive summary (2-3 paragraphs) highlighting key findings and implications.",
            "technical": "Write a detailed technical report with methodology, results, and statistical interpretations.",
            "plain": "Write in simple, non-technical language suitable for a general audience."
        }
        
        system_prompt = f"""You are a research analyst writing a summary of statistical analysis results.

{style_instructions.get(req.style, style_instructions["executive"])}

CRITICAL RULES:
1. Every claim MUST be directly supported by the provided data
2. Include specific numbers from the results
3. For each finding, cite the specific statistic (e.g., "mean = 4.2, SD = 1.1")
4. Acknowledge limitations and assumptions
5. Do not extrapolate beyond what the data shows

Format your response as:
{{
    "summary": "Main narrative text",
    "key_findings": ["Finding 1 with citation", "Finding 2 with citation"],
    "limitations": ["Limitation 1"],
    "citations": [
        {{"claim": "...", "evidence": "...", "statistic": "..."}}
    ]
}}"""

        user_content = f"""Analysis Query: {analysis.get('query')}

Analysis Method: {analysis.get('analysis_plan', {}).get('statistical_method', 'Unknown')}

Results:
{json.dumps(analysis.get('results', {}), indent=2)}

Generate a {req.style} narrative for these results."""

        # Initialize chat with system message
        narrative_id = f"narrative_{req.analysis_id}_{int(datetime.now(timezone.utc).timestamp())}"
        chat = LlmChat(
            api_key=api_key,
            session_id=narrative_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        # Send user message
        response = await chat.send_message(UserMessage(text=user_content))
        
        # Parse response
        try:
            response_text = response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            narrative = json.loads(response_text)
        except json.JSONDecodeError:
            narrative = {
                "summary": response,
                "key_findings": [],
                "limitations": [],
                "citations": []
            }
        
        return {
            "analysis_id": req.analysis_id,
            "style": req.style,
            "narrative": narrative,
            "source_data": {
                "query": analysis.get("query"),
                "method": analysis.get("analysis_plan", {}).get("statistical_method"),
                "snapshot_id": analysis.get("snapshot_id"),
                "form_id": analysis.get("form_id"),
                "timestamp": analysis.get("created_at").isoformat() if analysis.get("created_at") else None
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Narrative generation failed: {str(e)}")


# ============ Analysis History ============

@router.get("/history/{org_id}")
async def get_analysis_history(
    request: Request,
    org_id: str,
    limit: int = 20
):
    """Get AI analysis history for an organization"""
    db = request.app.state.db
    
    analyses = await db.ai_analyses.find({"org_id": org_id}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for a in analyses:
        a["_id"] = str(a.get("_id", ""))
        if a.get("created_at"):
            a["created_at"] = a["created_at"].isoformat()
    
    return analyses
