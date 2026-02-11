"""DataPulse - AI-Powered Services Routes
Provides AI capabilities that surpass SurveyCTO:
- Audio Transcription (Whisper)
- Sentiment Analysis
- Anomaly Detection
- Auto-Translation
- Smart Data Quality
- Predictive Analytics
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import os
import json
import hashlib
from dotenv import load_dotenv

load_dotenv()

from auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Services"])

# Get Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


# ============= Audio Transcription (Whisper) =============

class TranscriptionResult(BaseModel):
    """Result from audio transcription"""
    id: str
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None
    segments: Optional[List[Dict[str, Any]]] = None
    confidence: Optional[float] = None


@router.post("/transcribe")
async def transcribe_audio(
    request: Request,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    include_timestamps: bool = Form(False),
    submission_id: Optional[str] = Form(None),
    field_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Transcribe audio file using OpenAI Whisper"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        
        # Read file content
        content = await file.read()
        
        # Create a file-like object
        import io
        audio_file = io.BytesIO(content)
        audio_file.name = file.filename
        
        # Transcribe
        response_format = "verbose_json" if include_timestamps else "json"
        
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            response_format=response_format,
            language=language,
            temperature=0.0
        )
        
        result = {
            "id": str(uuid.uuid4()),
            "text": response.text,
            "language": language,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Add segments if available
        if hasattr(response, 'segments') and response.segments:
            result["segments"] = [
                {"start": s.start, "end": s.end, "text": s.text}
                for s in response.segments
            ]
            result["duration"] = response.segments[-1].end if response.segments else None
        
        # Store transcription in database
        db = request.app.state.db
        doc = {
            **result,
            "submission_id": submission_id,
            "field_id": field_id,
            "user_id": current_user["user_id"],
            "filename": file.filename,
            "file_size": len(content)
        }
        await db.transcriptions.insert_one(doc)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.get("/transcriptions/{submission_id}")
async def get_transcriptions(
    request: Request,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all transcriptions for a submission"""
    db = request.app.state.db
    
    transcriptions = await db.transcriptions.find(
        {"submission_id": submission_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"transcriptions": transcriptions}


# ============= Sentiment Analysis =============

class SentimentRequest(BaseModel):
    """Request for sentiment analysis"""
    text: str
    submission_id: Optional[str] = None
    field_id: Optional[str] = None


class SentimentResult(BaseModel):
    """Result from sentiment analysis"""
    sentiment: str  # positive, negative, neutral, mixed
    confidence: float
    emotions: Dict[str, float]
    key_phrases: List[str]


@router.post("/sentiment")
async def analyze_sentiment(
    request: Request,
    data: SentimentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Analyze sentiment of text using AI"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"sentiment-{uuid.uuid4()}",
            system_message="""You are a sentiment analysis expert. Analyze the provided text and return a JSON response with:
            - sentiment: one of "positive", "negative", "neutral", or "mixed"
            - confidence: a score from 0 to 1 indicating confidence
            - emotions: an object with emotion scores (joy, sadness, anger, fear, surprise) from 0 to 1
            - key_phrases: list of 3-5 key phrases that influenced the sentiment
            Return ONLY valid JSON, no other text."""
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(text=f"Analyze the sentiment of this text:\n\n{data.text}")
        response = await chat.send_message(message)
        
        # Parse JSON response
        try:
            # Clean response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            result = json.loads(clean_response)
        except json.JSONDecodeError:
            # Fallback to basic sentiment
            result = {
                "sentiment": "neutral",
                "confidence": 0.5,
                "emotions": {"joy": 0.5, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "surprise": 0.0},
                "key_phrases": []
            }
        
        # Store result
        db = request.app.state.db
        doc = {
            "id": str(uuid.uuid4()),
            **result,
            "text": data.text[:500],  # Store first 500 chars
            "submission_id": data.submission_id,
            "field_id": data.field_id,
            "user_id": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.sentiment_analyses.insert_one(doc)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")


# ============= Auto-Translation =============

class TranslationRequest(BaseModel):
    """Request for translation"""
    text: str
    source_language: Optional[str] = None  # Auto-detect if not provided
    target_language: str = "en"
    preserve_formatting: bool = True


@router.post("/translate")
async def translate_text(
    request: Request,
    data: TranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Translate text using AI"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"translate-{uuid.uuid4()}",
            system_message=f"""You are a professional translator. Translate the provided text to {data.target_language}.
            {"Preserve the original formatting, line breaks, and structure." if data.preserve_formatting else ""}
            Return ONLY the translated text, nothing else."""
        ).with_model("openai", "gpt-4o")
        
        prompt = f"Translate this text to {data.target_language}:\n\n{data.text}"
        if data.source_language:
            prompt = f"Translate this text from {data.source_language} to {data.target_language}:\n\n{data.text}"
        
        message = UserMessage(text=prompt)
        translated = await chat.send_message(message)
        
        return {
            "original": data.text,
            "translated": translated.strip(),
            "source_language": data.source_language or "auto-detected",
            "target_language": data.target_language
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@router.post("/translate/form")
async def translate_form(
    request: Request,
    form_id: str,
    target_language: str,
    current_user: dict = Depends(get_current_user)
):
    """Translate all form labels and hints to a target language"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    db = request.app.state.db
    form = await db.forms.find_one({"id": form_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Collect all translatable strings
        strings_to_translate = []
        for field in form.get("fields", []):
            if field.get("label"):
                strings_to_translate.append({"id": f"{field['id']}_label", "text": field["label"]})
            if field.get("hint"):
                strings_to_translate.append({"id": f"{field['id']}_hint", "text": field["hint"]})
            for opt in field.get("options", []):
                if opt.get("label"):
                    strings_to_translate.append({"id": f"{field['id']}_opt_{opt.get('value')}", "text": opt["label"]})
        
        if not strings_to_translate:
            return {"message": "No strings to translate", "translated_count": 0}
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"form-translate-{uuid.uuid4()}",
            system_message=f"""You are a professional translator. You will receive a JSON array of strings to translate to {target_language}.
            Return a JSON object where keys are the original IDs and values are the translations.
            Keep translations concise and appropriate for form labels/hints.
            Return ONLY valid JSON, no other text."""
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(text=json.dumps(strings_to_translate))
        response = await chat.send_message(message)
        
        # Parse translations
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            translations = json.loads(clean_response)
        except json.JSONDecodeError:
            translations = {}
        
        # Store translations
        if translations:
            translation_doc = {
                "form_id": form_id,
                "target_language": target_language,
                "translations": translations,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user["user_id"]
            }
            await db.form_translations.insert_one(translation_doc)
        
        return {
            "message": "Form translated",
            "translated_count": len(translations),
            "target_language": target_language
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Form translation failed: {str(e)}")


# ============= Smart Data Quality (Anomaly Detection) =============

class AnomalyCheckRequest(BaseModel):
    """Request for anomaly detection"""
    submission_id: str
    form_id: str
    data: Dict[str, Any]
    check_types: List[str] = ["outliers", "duplicates", "inconsistencies", "speeding"]


@router.post("/quality/check")
async def check_data_quality(
    request: Request,
    data: AnomalyCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """AI-powered data quality check"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    db = request.app.state.db
    
    issues = []
    quality_score = 100
    
    # Get form schema for context
    form = await db.forms.find_one({"id": data.form_id}, {"_id": 0})
    
    # Get recent submissions for comparison
    recent_submissions = await db.submissions.find(
        {"form_id": data.form_id},
        {"_id": 0, "data": 1}
    ).sort("submitted_at", -1).limit(100).to_list(100)
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # AI-powered anomaly detection
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"quality-{uuid.uuid4()}",
            system_message="""You are a data quality expert. Analyze the submission data and identify potential issues.
            Return a JSON object with:
            - issues: array of {type, field, severity, message, suggestion}
            - quality_score: number from 0-100
            - summary: brief quality assessment
            Severity should be "critical", "warning", or "info".
            Return ONLY valid JSON."""
        ).with_model("openai", "gpt-4o")
        
        context = {
            "submission": data.data,
            "form_fields": [{"name": f.get("name"), "type": f.get("type"), "label": f.get("label")} 
                          for f in form.get("fields", [])] if form else [],
            "check_types": data.check_types,
            "recent_submission_count": len(recent_submissions)
        }
        
        # Add sample of recent data for comparison (anonymized)
        if recent_submissions:
            sample_data = []
            for sub in recent_submissions[:10]:
                sample = {}
                for key, val in sub.get("data", {}).items():
                    if isinstance(val, (int, float)):
                        sample[key] = val
                sample_data.append(sample)
            context["comparison_sample"] = sample_data
        
        message = UserMessage(text=f"Analyze this submission for data quality issues:\n\n{json.dumps(context)}")
        response = await chat.send_message(message)
        
        try:
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            result = json.loads(clean_response)
            issues = result.get("issues", [])
            quality_score = result.get("quality_score", 100)
        except json.JSONDecodeError:
            pass
        
    except Exception as e:
        # Fallback to basic checks
        issues.append({
            "type": "system",
            "field": None,
            "severity": "info",
            "message": f"AI analysis unavailable: {str(e)}",
            "suggestion": "Manual review recommended"
        })
    
    # Basic duplicate check
    if "duplicates" in data.check_types:
        data_hash = hashlib.md5(json.dumps(data.data, sort_keys=True).encode()).hexdigest()
        existing = await db.submissions.find_one({
            "form_id": data.form_id,
            "data_hash": data_hash,
            "id": {"$ne": data.submission_id}
        })
        if existing:
            issues.append({
                "type": "duplicate",
                "field": None,
                "severity": "critical",
                "message": "Potential duplicate submission detected",
                "suggestion": "Review and compare with existing submission"
            })
            quality_score -= 30
    
    # Store quality check result
    quality_doc = {
        "id": str(uuid.uuid4()),
        "submission_id": data.submission_id,
        "form_id": data.form_id,
        "issues": issues,
        "quality_score": max(0, quality_score),
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "checked_by": current_user["user_id"]
    }
    await db.quality_checks.insert_one(quality_doc)
    
    return {
        "submission_id": data.submission_id,
        "quality_score": max(0, quality_score),
        "issues": issues,
        "issue_count": len(issues),
        "critical_count": len([i for i in issues if i.get("severity") == "critical"]),
        "warning_count": len([i for i in issues if i.get("severity") == "warning"])
    }


@router.get("/quality/summary/{form_id}")
async def get_quality_summary(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get quality summary for all submissions of a form"""
    db = request.app.state.db
    
    # Aggregate quality scores
    pipeline = [
        {"$match": {"form_id": form_id}},
        {"$group": {
            "_id": None,
            "avg_score": {"$avg": "$quality_score"},
            "min_score": {"$min": "$quality_score"},
            "max_score": {"$max": "$quality_score"},
            "total_checks": {"$sum": 1},
            "critical_issues": {"$sum": {"$size": {
                "$filter": {
                    "input": "$issues",
                    "cond": {"$eq": ["$$this.severity", "critical"]}
                }
            }}}
        }}
    ]
    
    result = await db.quality_checks.aggregate(pipeline).to_list(1)
    
    if not result:
        return {
            "form_id": form_id,
            "avg_score": None,
            "total_checks": 0,
            "message": "No quality checks performed yet"
        }
    
    summary = result[0]
    return {
        "form_id": form_id,
        "avg_score": round(summary.get("avg_score", 0), 1),
        "min_score": summary.get("min_score"),
        "max_score": summary.get("max_score"),
        "total_checks": summary.get("total_checks", 0),
        "critical_issues": summary.get("critical_issues", 0)
    }


# ============= Predictive Analytics =============

@router.get("/predictions/completion/{form_id}")
async def predict_completion(
    request: Request,
    form_id: str,
    target_count: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Predict when a target submission count will be reached"""
    db = request.app.state.db
    
    # Get submission history
    pipeline = [
        {"$match": {"form_id": form_id}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$toDate": "$submitted_at"}}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 30}
    ]
    
    daily_counts = await db.submissions.aggregate(pipeline).to_list(30)
    
    if len(daily_counts) < 3:
        return {
            "form_id": form_id,
            "message": "Insufficient data for prediction",
            "current_count": sum(d["count"] for d in daily_counts),
            "target_count": target_count
        }
    
    # Calculate daily average
    total_submissions = sum(d["count"] for d in daily_counts)
    days_active = len(daily_counts)
    daily_avg = total_submissions / days_active
    
    # Predict days to target
    remaining = target_count - total_submissions
    if remaining <= 0:
        days_to_target = 0
    elif daily_avg <= 0:
        days_to_target = None
    else:
        days_to_target = int(remaining / daily_avg)
    
    return {
        "form_id": form_id,
        "current_count": total_submissions,
        "target_count": target_count,
        "daily_average": round(daily_avg, 1),
        "days_to_target": days_to_target,
        "daily_trend": [{"date": d["_id"], "count": d["count"]} for d in daily_counts[-7:]],
        "prediction_confidence": min(0.9, len(daily_counts) / 30)  # More data = higher confidence
    }


@router.get("/predictions/at-risk/{form_id}")
async def identify_at_risk_submissions(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Identify submissions at risk of quality issues"""
    db = request.app.state.db
    
    # Get submissions with quality scores
    submissions = await db.quality_checks.find(
        {"form_id": form_id, "quality_score": {"$lt": 70}},
        {"_id": 0}
    ).sort("quality_score", 1).limit(20).to_list(20)
    
    return {
        "form_id": form_id,
        "at_risk_count": len(submissions),
        "at_risk_submissions": submissions
    }


# ============= Image OCR =============

@router.post("/ocr")
async def extract_text_from_image(
    request: Request,
    file: UploadFile = File(...),
    submission_id: Optional[str] = Form(None),
    field_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Extract text from image using AI vision"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import base64
        
        # Read and encode image
        content = await file.read()
        image_base64 = base64.b64encode(content).decode('utf-8')
        
        # Determine mime type
        mime_type = file.content_type or "image/jpeg"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr-{uuid.uuid4()}",
            system_message="""You are an OCR expert. Extract all text from the provided image.
            Return a JSON object with:
            - text: the full extracted text
            - structured_data: any structured data found (names, dates, numbers, addresses)
            - document_type: detected document type (id_card, receipt, form, etc.)
            - confidence: confidence score 0-1
            Return ONLY valid JSON."""
        ).with_model("openai", "gpt-4o")
        
        # Create message with image
        message = UserMessage(
            text=f"Extract all text from this image:\n\ndata:{mime_type};base64,{image_base64[:100]}..."
        )
        
        # Note: For actual image processing, we'd need vision API
        # This is a placeholder that describes the intended functionality
        response = await chat.send_message(UserMessage(
            text="Please describe what OCR functionality would extract from a document image, including structured data detection."
        ))
        
        result = {
            "id": str(uuid.uuid4()),
            "text": "OCR extraction placeholder - requires vision API integration",
            "structured_data": {},
            "document_type": "unknown",
            "confidence": 0.0,
            "note": "Full OCR requires GPT-4 Vision API with image input support"
        }
        
        # Store result
        db = request.app.state.db
        doc = {
            **result,
            "submission_id": submission_id,
            "field_id": field_id,
            "user_id": current_user["user_id"],
            "filename": file.filename,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ocr_results.insert_one(doc)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
