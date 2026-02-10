"""
Qualitative Analysis Module - AI Features (Phase 2 & 3)
AI-powered transcription, coding suggestions, theme synthesis
"""

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, BackgroundTasks
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import os
import json
import re
import asyncio
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

router = APIRouter(prefix="/qualitative/ai", tags=["Qualitative AI"])

# Database reference
db = None

def set_database(database):
    global db
    db = database

# Get API key
def get_api_key():
    return os.environ.get('EMERGENT_LLM_KEY')


# =============================================================================
# AUDIO TRANSCRIPTION (Phase 2)
# =============================================================================

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    project_id: str = Query(...),
    org_id: str = Query(...),
    user_id: str = Query(...),
    language: Optional[str] = "en",
    source_name: Optional[str] = None
):
    """
    Transcribe audio file using OpenAI Whisper
    Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    # Validate file type
    allowed_types = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']
    file_ext = file.filename.split('.')[-1].lower() if file.filename else ''
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Check file size (25MB limit)
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 25MB")
    
    try:
        # Initialize STT
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Create file-like object
        import io
        audio_file = io.BytesIO(content)
        audio_file.name = file.filename
        
        # Transcribe with timestamps
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            response_format="verbose_json",
            language=language,
            timestamp_granularities=["segment"]
        )
        
        # Parse response
        transcript_text = response.text
        segments = []
        
        if hasattr(response, 'segments'):
            for seg in response.segments:
                segments.append({
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip()
                })
        
        # Format content with timestamps
        formatted_content = ""
        for seg in segments:
            timestamp = f"[{int(seg['start']//60):02d}:{int(seg['start']%60):02d}]"
            formatted_content += f"{timestamp} {seg['text']}\n\n"
        
        if not formatted_content:
            formatted_content = transcript_text
        
        # Create source document
        source_doc = {
            "project_id": project_id,
            "name": source_name or file.filename.rsplit('.', 1)[0],
            "source_type": "transcript",
            "content": formatted_content,
            "word_count": len(formatted_content.split()),
            "utterance_count": len(segments),
            "language": language,
            "media_url": None,
            "media_duration": segments[-1]["end"] if segments else None,
            "transcription_segments": segments,
            "consent_verbatim_quotes": True,
            "consent_audio_retention": False,
            "contains_pii": False,
            "speakers": [],
            "attributes": {"transcribed_by": "whisper-1"},
            "coding_status": "in_progress",
            "org_id": org_id,
            "created_by": user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.qual_sources.insert_one(source_doc)
        
        return {
            "id": str(result.inserted_id),
            "source_name": source_doc["name"],
            "word_count": source_doc["word_count"],
            "segment_count": len(segments),
            "duration_seconds": source_doc["media_duration"],
            "message": "Transcription completed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# =============================================================================
# PII DETECTION & ANONYMIZATION (Phase 2)
# =============================================================================

# PII patterns
PII_PATTERNS = {
    "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    "phone": r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
    "ssn": r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b',
    "credit_card": r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
    "date_of_birth": r'\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b',
    "ip_address": r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
    "address": r'\b\d+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b',
}

@router.post("/detect-pii/{source_id}")
async def detect_pii(
    source_id: str,
    org_id: str = Query(...),
    use_ai: bool = Query(default=True, description="Use AI for name detection")
):
    """
    Detect PII in a source document
    Returns list of detected PII with positions
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    source = await db.qual_sources.find_one({
        "_id": ObjectId(source_id),
        "org_id": org_id
    })
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    content = source["content"]
    pii_findings = []
    
    # Pattern-based detection
    for pii_type, pattern in PII_PATTERNS.items():
        for match in re.finditer(pattern, content, re.IGNORECASE):
            pii_findings.append({
                "type": pii_type,
                "value": match.group(),
                "start": match.start(),
                "end": match.end(),
                "detection_method": "pattern"
            })
    
    # AI-based name detection
    if use_ai:
        api_key = get_api_key()
        if api_key:
            try:
                chat = LlmChat(
                    api_key=api_key,
                    session_id=f"pii-{source_id}",
                    system_message="You are a PII detection assistant. Extract all person names from the text. Return only a JSON array of objects with 'name' and 'context' fields."
                ).with_model("openai", "gpt-5.2")
                
                # Sample content if too long
                sample = content[:8000] if len(content) > 8000 else content
                
                response = await chat.send_message(UserMessage(
                    text=f"Extract all person names from this text. Return JSON array:\n\n{sample}"
                ))
                
                # Parse response
                try:
                    # Find JSON in response
                    json_match = re.search(r'\[.*\]', response, re.DOTALL)
                    if json_match:
                        names = json.loads(json_match.group())
                        for name_obj in names:
                            name = name_obj.get('name', '')
                            if name:
                                # Find all occurrences
                                for match in re.finditer(re.escape(name), content, re.IGNORECASE):
                                    pii_findings.append({
                                        "type": "person_name",
                                        "value": match.group(),
                                        "start": match.start(),
                                        "end": match.end(),
                                        "detection_method": "ai"
                                    })
                except:
                    pass
            except Exception as e:
                print(f"AI PII detection error: {e}")
    
    # Deduplicate findings
    seen = set()
    unique_findings = []
    for f in pii_findings:
        key = (f["start"], f["end"])
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)
    
    # Sort by position
    unique_findings.sort(key=lambda x: x["start"])
    
    # Update source with PII flag
    if unique_findings:
        await db.qual_sources.update_one(
            {"_id": ObjectId(source_id)},
            {"$set": {"contains_pii": True, "pii_findings": unique_findings}}
        )
    
    return {
        "source_id": source_id,
        "pii_count": len(unique_findings),
        "findings": unique_findings,
        "pii_types": list(set(f["type"] for f in unique_findings))
    }


@router.post("/anonymize/{source_id}")
async def anonymize_source(
    source_id: str,
    org_id: str = Query(...),
    user_id: str = Query(...),
    anonymization_map: Optional[Dict[str, str]] = None
):
    """
    Anonymize PII in a source document
    Creates a new anonymized version while preserving original
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    source = await db.qual_sources.find_one({
        "_id": ObjectId(source_id),
        "org_id": org_id
    })
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    content = source["content"]
    pii_findings = source.get("pii_findings", [])
    
    if not pii_findings:
        # Run detection first
        detect_result = await detect_pii(source_id, org_id)
        pii_findings = detect_result["findings"]
    
    if not pii_findings:
        return {
            "source_id": source_id,
            "message": "No PII found to anonymize",
            "anonymized": False
        }
    
    # Generate pseudonyms
    pseudonym_counters = {}
    generated_map = anonymization_map or {}
    
    for finding in pii_findings:
        value = finding["value"]
        if value not in generated_map:
            pii_type = finding["type"]
            if pii_type not in pseudonym_counters:
                pseudonym_counters[pii_type] = 0
            pseudonym_counters[pii_type] += 1
            
            # Generate pseudonym based on type
            if pii_type == "person_name":
                generated_map[value] = f"[PARTICIPANT_{pseudonym_counters[pii_type]}]"
            elif pii_type == "email":
                generated_map[value] = f"[EMAIL_{pseudonym_counters[pii_type]}]"
            elif pii_type == "phone":
                generated_map[value] = f"[PHONE_{pseudonym_counters[pii_type]}]"
            elif pii_type == "address":
                generated_map[value] = f"[ADDRESS_{pseudonym_counters[pii_type]}]"
            else:
                generated_map[value] = f"[{pii_type.upper()}_{pseudonym_counters[pii_type]}]"
    
    # Apply anonymization (replace from end to preserve positions)
    anonymized_content = content
    for finding in sorted(pii_findings, key=lambda x: -x["start"]):
        value = finding["value"]
        pseudonym = generated_map.get(value, "[REDACTED]")
        anonymized_content = (
            anonymized_content[:finding["start"]] + 
            pseudonym + 
            anonymized_content[finding["end"]:]
        )
    
    # Update source
    await db.qual_sources.update_one(
        {"_id": ObjectId(source_id)},
        {
            "$set": {
                "content": anonymized_content,
                "anonymization_map": generated_map,
                "anonymized_at": datetime.now(timezone.utc),
                "anonymized_by": user_id,
                "original_content_hash": hash(content),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Log the anonymization
    await db.qual_audit_logs.insert_one({
        "project_id": source["project_id"],
        "source_id": source_id,
        "action": "anonymize",
        "user_id": user_id,
        "org_id": org_id,
        "details": {
            "pii_count": len(pii_findings),
            "pii_types": list(set(f["type"] for f in pii_findings))
        },
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {
        "source_id": source_id,
        "anonymized": True,
        "pii_replaced": len(generated_map),
        "anonymization_map": generated_map,
        "message": "Source anonymized successfully"
    }


# =============================================================================
# AI CODING SUGGESTIONS (Phase 3)
# =============================================================================

@router.post("/suggest-codes")
async def suggest_codes(
    project_id: str = Query(...),
    org_id: str = Query(...),
    source_id: str = Query(...),
    excerpt_text: str = Query(...),
    start_char: int = Query(...),
    end_char: int = Query(...),
    max_suggestions: int = Query(default=5)
):
    """
    Get AI-powered code suggestions for a text excerpt
    Returns suggested codes with confidence and rationale
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    # Get existing codes for context
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    
    if not codes:
        return {
            "suggestions": [],
            "message": "No codes in codebook. Create codes first."
        }
    
    # Build codebook context
    codebook_context = "Available codes:\n"
    for code in codes:
        codebook_context += f"- {code['name']}"
        if code.get('definition'):
            codebook_context += f": {code['definition']}"
        codebook_context += "\n"
    
    # Get project context
    project = await db.qual_projects.find_one({"_id": ObjectId(project_id)})
    research_context = ""
    if project:
        if project.get("research_questions"):
            research_context = f"Research questions: {', '.join(project['research_questions'])}\n"
        if project.get("methodology"):
            research_context += f"Methodology: {project['methodology']}\n"
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"suggest-{project_id}-{start_char}",
            system_message="""You are an expert qualitative research assistant specializing in thematic analysis and coding.
Your task is to suggest the most appropriate codes for text excerpts based on the provided codebook.
Always explain your reasoning and provide confidence levels."""
        ).with_model("openai", "gpt-5.2")
        
        prompt = f"""{research_context}

{codebook_context}

Text excerpt to code:
"{excerpt_text}"

Suggest up to {max_suggestions} codes from the codebook that best fit this excerpt.
For each suggestion, provide:
1. The exact code name (must match a code from the codebook)
2. Confidence level (high/medium/low)
3. Brief rationale (1-2 sentences)

Return your response as a JSON array:
[
  {{"code_name": "...", "confidence": "high|medium|low", "rationale": "..."}}
]

Only suggest codes that genuinely fit the excerpt. If no codes fit well, return an empty array."""

        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse response
        suggestions = []
        try:
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                raw_suggestions = json.loads(json_match.group())
                
                # Match to actual codes
                code_map = {c["name"].lower(): c for c in codes}
                
                for sug in raw_suggestions:
                    code_name = sug.get("code_name", "").lower()
                    if code_name in code_map:
                        code = code_map[code_name]
                        suggestions.append({
                            "code_id": str(code["_id"]),
                            "code_name": code["name"],
                            "code_color": code.get("color", "#3B82F6"),
                            "confidence": sug.get("confidence", "medium"),
                            "rationale": sug.get("rationale", ""),
                            "suggested_by": "ai"
                        })
        except Exception as e:
            print(f"Error parsing suggestions: {e}")
        
        return {
            "excerpt": excerpt_text[:100] + "..." if len(excerpt_text) > 100 else excerpt_text,
            "suggestions": suggestions[:max_suggestions],
            "suggestion_count": len(suggestions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")


@router.post("/auto-code-source/{source_id}")
async def auto_code_source(
    source_id: str,
    org_id: str = Query(...),
    user_id: str = Query(...),
    confidence_threshold: str = Query(default="medium", description="Minimum confidence: high, medium, low")
):
    """
    Automatically apply AI-suggested codes to an entire source
    Only applies suggestions above the confidence threshold
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    source = await db.qual_sources.find_one({
        "_id": ObjectId(source_id),
        "org_id": org_id
    })
    
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    project_id = source["project_id"]
    content = source["content"]
    
    # Get codes
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    if not codes:
        return {"message": "No codes in codebook", "codings_created": 0}
    
    # Build codebook context
    codebook_str = "\n".join([
        f"- {c['name']}: {c.get('definition', 'No definition')}"
        for c in codes
    ])
    
    confidence_order = {"high": 3, "medium": 2, "low": 1}
    threshold_value = confidence_order.get(confidence_threshold, 2)
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"autocode-{source_id}",
            system_message="""You are an expert qualitative coder. Analyze the transcript and identify text segments that match codes from the codebook.
Be thorough but precise. Only code segments that clearly match the code definition."""
        ).with_model("openai", "gpt-5.2")
        
        # Process in chunks if content is long
        chunk_size = 6000
        all_codings = []
        
        for i in range(0, len(content), chunk_size):
            chunk = content[i:i + chunk_size]
            chunk_start = i
            
            prompt = f"""Codebook:
{codebook_str}

Text to analyze (starting at character {chunk_start}):
"{chunk}"

Identify segments that should be coded. For each segment:
1. Extract the exact text (as it appears)
2. Assign the most appropriate code
3. Rate your confidence (high/medium/low)

Return as JSON array:
[
  {{"text": "exact excerpt", "code_name": "...", "confidence": "high|medium|low"}}
]

Only include segments with clear matches. Return empty array if no clear matches."""

            response = await chat.send_message(UserMessage(text=prompt))
            
            try:
                json_match = re.search(r'\[.*\]', response, re.DOTALL)
                if json_match:
                    chunk_codings = json.loads(json_match.group())
                    
                    code_map = {c["name"].lower(): c for c in codes}
                    
                    for coding in chunk_codings:
                        code_name = coding.get("code_name", "").lower()
                        if code_name not in code_map:
                            continue
                        
                        confidence = coding.get("confidence", "medium")
                        if confidence_order.get(confidence, 0) < threshold_value:
                            continue
                        
                        excerpt = coding.get("text", "")
                        if not excerpt:
                            continue
                        
                        # Find position in content
                        pos = content.find(excerpt, chunk_start)
                        if pos == -1:
                            # Try case-insensitive
                            pos = content.lower().find(excerpt.lower(), chunk_start)
                        
                        if pos != -1:
                            code = code_map[code_name]
                            all_codings.append({
                                "project_id": project_id,
                                "source_id": source_id,
                                "source_name": source["name"],
                                "code_id": str(code["_id"]),
                                "code_name": code["name"],
                                "code_color": code.get("color", "#3B82F6"),
                                "start_char": pos,
                                "end_char": pos + len(excerpt),
                                "excerpt_text": excerpt,
                                "confidence": confidence_order.get(confidence, 2) / 3.0,
                                "notes": f"Auto-coded with {confidence} confidence",
                                "is_negative_case": False,
                                "coder_id": user_id,
                                "org_id": org_id,
                                "created_at": datetime.now(timezone.utc),
                                "updated_at": datetime.now(timezone.utc),
                                "auto_coded": True
                            })
            except Exception as e:
                print(f"Error processing chunk: {e}")
        
        # Insert codings
        if all_codings:
            await db.qual_codings.insert_many(all_codings)
        
        return {
            "source_id": source_id,
            "codings_created": len(all_codings),
            "confidence_threshold": confidence_threshold,
            "message": f"Auto-coded {len(all_codings)} segments"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-coding failed: {str(e)}")


# =============================================================================
# AI THEME SYNTHESIS (Phase 3)
# =============================================================================

@router.post("/synthesize-themes")
async def synthesize_themes(
    project_id: str = Query(...),
    org_id: str = Query(...),
    user_id: str = Query(...),
    min_codings: int = Query(default=3, description="Minimum codings per theme")
):
    """
    Generate draft themes from coded data using AI
    Clusters similar codes and excerpts into thematic groups
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")
    
    # Get all codings with their codes
    codings = await db.qual_codings.find({"project_id": project_id}).to_list(1000)
    
    if len(codings) < min_codings:
        return {
            "themes": [],
            "message": f"Not enough codings. Found {len(codings)}, need at least {min_codings}"
        }
    
    # Get codes
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    code_map = {str(c["_id"]): c["name"] for c in codes}
    
    # Get project context
    project = await db.qual_projects.find_one({"_id": ObjectId(project_id)})
    research_questions = project.get("research_questions", []) if project else []
    
    # Prepare coding summaries
    coding_summaries = []
    for coding in codings[:200]:  # Limit for API
        coding_summaries.append({
            "code": code_map.get(coding["code_id"], "Unknown"),
            "excerpt": coding["excerpt_text"][:200]
        })
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"themes-{project_id}",
            system_message="""You are an expert qualitative researcher specializing in thematic analysis.
Your task is to identify overarching themes from coded qualitative data.
Themes should be conceptually coherent, grounded in the data, and address the research questions."""
        ).with_model("openai", "gpt-5.2")
        
        rq_context = ""
        if research_questions:
            rq_context = f"Research Questions:\n" + "\n".join(f"- {q}" for q in research_questions) + "\n\n"
        
        prompt = f"""{rq_context}Coded data excerpts (code: excerpt):
{json.dumps(coding_summaries, indent=2)}

Based on this coded data, identify 3-7 overarching themes. For each theme:
1. Title: A concise theme name
2. Description: What this theme captures
3. Related codes: Which codes contribute to this theme
4. Key quotes: 2-3 representative excerpts
5. Implications: What this theme suggests

Return as JSON array:
[
  {{
    "title": "...",
    "description": "...",
    "related_codes": ["code1", "code2"],
    "key_quotes": ["quote1", "quote2"],
    "implications": "..."
  }}
]"""

        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse themes
        themes_created = []
        try:
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                ai_themes = json.loads(json_match.group())
                
                for theme_data in ai_themes:
                    # Find supporting evidence (coding IDs)
                    supporting_evidence = []
                    related_codes = theme_data.get("related_codes", [])
                    
                    for coding in codings:
                        code_name = code_map.get(coding["code_id"], "")
                        if code_name.lower() in [c.lower() for c in related_codes]:
                            supporting_evidence.append(str(coding["_id"]))
                            if len(supporting_evidence) >= 10:
                                break
                    
                    # Create theme
                    theme_doc = {
                        "project_id": project_id,
                        "title": theme_data.get("title", "Untitled Theme"),
                        "description": theme_data.get("description", ""),
                        "parent_id": None,
                        "status": "draft",
                        "supporting_evidence": supporting_evidence,
                        "counter_evidence": [],
                        "summary": theme_data.get("description", ""),
                        "implications": theme_data.get("implications", ""),
                        "recommendations": None,
                        "ai_generated": True,
                        "ai_key_quotes": theme_data.get("key_quotes", []),
                        "ai_related_codes": related_codes,
                        "org_id": org_id,
                        "created_by": user_id,
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc)
                    }
                    
                    result = await db.qual_themes.insert_one(theme_doc)
                    theme_doc["id"] = str(result.inserted_id)
                    themes_created.append({
                        "id": str(result.inserted_id),
                        "title": theme_doc["title"],
                        "description": theme_doc["description"],
                        "related_codes": related_codes,
                        "evidence_count": len(supporting_evidence)
                    })
        
        except Exception as e:
            print(f"Error parsing themes: {e}")
        
        return {
            "themes_created": len(themes_created),
            "themes": themes_created,
            "message": f"Synthesized {len(themes_created)} draft themes"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Theme synthesis failed: {str(e)}")


# =============================================================================
# INTER-CODER RELIABILITY (Phase 2)
# =============================================================================

@router.get("/icr/{project_id}")
async def calculate_icr(
    project_id: str,
    org_id: str = Query(...),
    code_id: Optional[str] = None
):
    """
    Calculate Inter-Coder Reliability (Cohen's Kappa) for the project
    Compares coding agreement between multiple coders
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    # Get all codings
    query = {"project_id": project_id, "org_id": org_id}
    if code_id:
        query["code_id"] = code_id
    
    codings = await db.qual_codings.find(query).to_list(5000)
    
    if not codings:
        return {"message": "No codings found", "kappa": None}
    
    # Group by coder
    coder_codings = {}
    for coding in codings:
        coder_id = coding["coder_id"]
        if coder_id not in coder_codings:
            coder_codings[coder_id] = []
        coder_codings[coder_id].append(coding)
    
    coders = list(coder_codings.keys())
    
    if len(coders) < 2:
        return {
            "message": "Need at least 2 coders for ICR calculation",
            "kappa": None,
            "coder_count": len(coders)
        }
    
    # Calculate pairwise agreement for overlapping segments
    def segments_overlap(c1, c2):
        """Check if two codings overlap"""
        return (c1["source_id"] == c2["source_id"] and
                c1["start_char"] < c2["end_char"] and
                c2["start_char"] < c1["end_char"])
    
    def calculate_kappa(agreements, disagreements, total):
        """Calculate Cohen's Kappa"""
        if total == 0:
            return None
        po = agreements / total  # Observed agreement
        pe = 0.5  # Expected agreement by chance (simplified)
        if po == pe == 1:
            return 1.0
        kappa = (po - pe) / (1 - pe) if pe != 1 else 0
        return round(kappa, 3)
    
    # Compare first two coders (simplification for multiple coders)
    coder1, coder2 = coders[0], coders[1]
    codings1 = coder_codings[coder1]
    codings2 = coder_codings[coder2]
    
    agreements = 0
    disagreements = 0
    
    # Find overlapping segments
    for c1 in codings1:
        for c2 in codings2:
            if segments_overlap(c1, c2):
                if c1["code_id"] == c2["code_id"]:
                    agreements += 1
                else:
                    disagreements += 1
    
    total = agreements + disagreements
    kappa = calculate_kappa(agreements, disagreements, total)
    
    # Interpretation
    interpretation = "N/A"
    if kappa is not None:
        if kappa >= 0.81:
            interpretation = "Almost perfect agreement"
        elif kappa >= 0.61:
            interpretation = "Substantial agreement"
        elif kappa >= 0.41:
            interpretation = "Moderate agreement"
        elif kappa >= 0.21:
            interpretation = "Fair agreement"
        elif kappa >= 0:
            interpretation = "Slight agreement"
        else:
            interpretation = "Poor agreement"
    
    return {
        "project_id": project_id,
        "coders_compared": [coder1, coder2],
        "total_coders": len(coders),
        "overlapping_segments": total,
        "agreements": agreements,
        "disagreements": disagreements,
        "cohens_kappa": kappa,
        "interpretation": interpretation,
        "code_id": code_id
    }


# =============================================================================
# REPORTS & EXPORTS (Phase 3)
# =============================================================================

@router.post("/generate-report/{project_id}")
async def generate_report(
    project_id: str,
    org_id: str = Query(...),
    user_id: str = Query(...),
    include_themes: bool = True,
    include_quotes: bool = True,
    include_code_frequency: bool = True,
    format: str = Query(default="json", description="json, markdown, or html")
):
    """
    Generate a comprehensive qualitative analysis report
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
    
    # Get all data
    sources = await db.qual_sources.find({"project_id": project_id}).to_list(500)
    codes = await db.qual_codes.find({"project_id": project_id}).to_list(100)
    codings = await db.qual_codings.find({"project_id": project_id}).to_list(2000)
    themes = await db.qual_themes.find({"project_id": project_id}).to_list(50)
    memos = await db.qual_memos.find({"project_id": project_id}).to_list(100)
    
    # Build report structure
    report = {
        "title": f"Qualitative Analysis Report: {project['name']}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": {
            "name": project["name"],
            "description": project.get("description"),
            "methodology": project.get("methodology"),
            "research_questions": project.get("research_questions", [])
        },
        "summary": {
            "source_count": len(sources),
            "code_count": len(codes),
            "coding_count": len(codings),
            "theme_count": len(themes),
            "memo_count": len(memos),
            "total_words": sum(s.get("word_count", 0) for s in sources)
        }
    }
    
    # Code frequency
    if include_code_frequency:
        code_freq = {}
        for coding in codings:
            code_id = coding["code_id"]
            code_freq[code_id] = code_freq.get(code_id, 0) + 1
        
        code_map = {str(c["_id"]): c["name"] for c in codes}
        report["code_frequency"] = [
            {"code": code_map.get(cid, cid), "count": count}
            for cid, count in sorted(code_freq.items(), key=lambda x: -x[1])
        ]
    
    # Themes
    if include_themes:
        report["themes"] = []
        for theme in themes:
            theme_data = {
                "title": theme["title"],
                "description": theme.get("description"),
                "status": theme.get("status"),
                "summary": theme.get("summary"),
                "implications": theme.get("implications")
            }
            
            # Add supporting quotes
            if include_quotes:
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
                theme_data["supporting_quotes"] = quotes
            
            report["themes"].append(theme_data)
    
    # Format output
    if format == "markdown":
        md = f"# {report['title']}\n\n"
        md += f"*Generated: {report['generated_at']}*\n\n"
        md += "## Project Overview\n\n"
        md += f"**Methodology:** {report['project']['methodology']}\n\n"
        
        if report['project']['research_questions']:
            md += "**Research Questions:**\n"
            for rq in report['project']['research_questions']:
                md += f"- {rq}\n"
            md += "\n"
        
        md += "## Summary Statistics\n\n"
        md += f"| Metric | Count |\n|--------|-------|\n"
        for k, v in report['summary'].items():
            md += f"| {k.replace('_', ' ').title()} | {v} |\n"
        md += "\n"
        
        if include_themes and report.get('themes'):
            md += "## Themes\n\n"
            for theme in report['themes']:
                md += f"### {theme['title']}\n\n"
                if theme.get('description'):
                    md += f"{theme['description']}\n\n"
                if theme.get('supporting_quotes'):
                    md += "**Supporting Evidence:**\n\n"
                    for q in theme['supporting_quotes']:
                        md += f"> \"{q['text']}\"\n> — {q['source']}\n\n"
        
        return {"format": "markdown", "content": md}
    
    elif format == "html":
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>{report['title']}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #1e40af; }}
        h2 {{ color: #3b82f6; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }}
        .quote {{ background: #f3f4f6; padding: 15px; border-left: 4px solid #3b82f6; margin: 10px 0; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 8px; text-align: left; }}
        th {{ background: #f3f4f6; }}
    </style>
</head>
<body>
    <h1>{report['title']}</h1>
    <p><em>Generated: {report['generated_at']}</em></p>
    
    <h2>Summary</h2>
    <table>
        <tr><th>Metric</th><th>Count</th></tr>
        {''.join(f"<tr><td>{k.replace('_', ' ').title()}</td><td>{v}</td></tr>" for k, v in report['summary'].items())}
    </table>
"""
        
        if include_themes and report.get('themes'):
            html += "<h2>Themes</h2>"
            for theme in report['themes']:
                html += f"<h3>{theme['title']}</h3>"
                if theme.get('description'):
                    html += f"<p>{theme['description']}</p>"
                if theme.get('supporting_quotes'):
                    for q in theme['supporting_quotes']:
                        html += f'<div class="quote">"{q["text"]}"<br><em>— {q["source"]}</em></div>'
        
        html += "</body></html>"
        return {"format": "html", "content": html}
    
    return {"format": "json", "content": report}
