"""DataPulse Help Center AI Assistant Routes"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/help-assistant", tags=["Help Assistant"])

HELP_CENTER_BASE = "/help"

# Comprehensive DataPulse Help Context for AI
HELP_CENTER_CONTEXT = """
You are the DataPulse AI Assistant - an expert guide for the DataPulse enterprise data collection platform.

When answering questions, include relevant article links in markdown format: [Article Title](LINK)

## Available Help Links:
- Getting Started: [Welcome Guide]({base}?tab=article&category=getting-started&article=welcome)
- Dashboard: [Dashboard Overview]({base}?tab=article&category=getting-started&article=dashboard-overview)
- Forms: [Form Builder Guide]({base}?tab=article&category=forms&article=form-builder)
- Skip Logic: [Skip Logic Guide]({base}?tab=article&category=forms&article=skip-logic)
- Dashboards: [Building Dashboards]({base}?tab=article&category=dataviz&article=dashboard-builder)
- Offline: [Offline Collection]({base}?tab=article&category=mobile&article=offline-collection)
- Users: [User Management]({base}?tab=article&category=team&article=user-management)
- Export: [Exporting Data]({base}?tab=article&category=data&article=data-export)
- FAQ: [Frequently Asked Questions]({base}?tab=faq)
- Troubleshooting: [Troubleshooting Guide]({base}?tab=troubleshooting)
- Shortcuts: [Keyboard Shortcuts]({base}?tab=shortcuts)

## DataPulse Platform Overview:
DataPulse is an enterprise-grade field data collection platform for:
- Research surveys and studies
- Monitoring & Evaluation (M&E)
- Field data collection
- CATI/CAWI surveys

## Key Features:
1. **Offline-First Collection**: Collect data without internet, auto-sync when online
2. **Form Builder**: Drag-and-drop with 15+ field types (text, number, GPS, photo, audio, video, signature, barcode, etc.)
3. **Skip Logic**: Conditional branching based on answers
4. **DataViz Studio**: Charts, dashboards (10 templates), and reports
5. **Quality AI**: AI-powered data quality checks
6. **User Management**: Roles (Admin, Manager, Enumerator, Viewer)
7. **Multi-language**: English and Swahili support

## Common Tasks:
- Create form: Projects > Forms > New Form
- Build dashboard: Data > Dashboards > New Dashboard or Templates
- Export data: Data > Submissions > Export (CSV, Excel, JSON, SPSS)
- Add users: Settings > User Management > Add User
- Force sync: Settings > Sync > Force Sync

## Guidelines:
1. Be helpful, friendly, and concise
2. Include 1-2 relevant links when helpful
3. For technical issues, suggest checking the [Troubleshooting Guide]({base}?tab=troubleshooting)
4. For account issues, suggest contacting support@datapulse.io
""".format(base=HELP_CENTER_BASE)


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class FeedbackRequest(BaseModel):
    session_id: Optional[str] = None
    message_id: str
    is_helpful: bool
    question: Optional[str] = None


# In-memory storage (use Redis/database in production)
chat_sessions = {}
feedback_store = []
question_analytics = {}


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(chat_message: ChatMessage):
    """Chat with the DataPulse AI Assistant"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI assistant not configured")
        
        session_id = chat_message.session_id or str(uuid.uuid4())
        
        # Create or retrieve chat session
        if session_id not in chat_sessions:
            chat = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message=HELP_CENTER_CONTEXT
            ).with_model("openai", "gpt-4o")
            chat_sessions[session_id] = chat
        else:
            chat = chat_sessions[session_id]
        
        # Send message and get response
        response = await chat.send_message(UserMessage(text=chat_message.message))
        
        return ChatResponse(response=response, session_id=session_id)
        
    except ImportError:
        # Fallback if emergentintegrations not available
        return ChatResponse(
            response="I'm sorry, the AI assistant is temporarily unavailable. Please browse the Help Center articles or contact support@datapulse.io for assistance.",
            session_id=chat_message.session_id or str(uuid.uuid4())
        )
    except Exception as e:
        print(f"Help assistant error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """Submit feedback on an AI response"""
    feedback_store.append({
        "session_id": feedback.session_id,
        "message_id": feedback.message_id,
        "is_helpful": feedback.is_helpful,
        "question": feedback.question
    })
    
    # Track question analytics
    if feedback.question:
        q = feedback.question.lower().strip()
        if q not in question_analytics:
            question_analytics[q] = {
                "question": feedback.question,
                "count": 0,
                "helpful": 0,
                "not_helpful": 0
            }
        question_analytics[q]["count"] += 1
        if feedback.is_helpful:
            question_analytics[q]["helpful"] += 1
        else:
            question_analytics[q]["not_helpful"] += 1
    
    return {"success": True}


@router.get("/analytics")
async def get_analytics():
    """Get analytics on help assistant usage"""
    sorted_questions = sorted(
        question_analytics.values(),
        key=lambda x: x["count"],
        reverse=True
    )
    
    return {
        "total_questions": sum(q["count"] for q in sorted_questions),
        "top_questions": sorted_questions[:10],
        "feedback_count": len(feedback_store)
    }
