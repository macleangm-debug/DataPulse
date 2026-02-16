"""
Help Center Backend Routes - Reusable Template
===============================================
A complete FastAPI router for Help Center functionality including:
- Articles with categories and search
- FAQ management
- Troubleshooting guides
- Keyboard shortcuts
- Release notes (What's New)
- AI Chat Assistant (GPT-4o via Emergent LLM key)
- Feedback collection

SETUP:
1. Copy this file to your backend/routes/ folder
2. Add EMERGENT_LLM_KEY to your .env file
3. Register in server.py:
   from routes.help_routes import router as help_router
   api_router.include_router(help_router)

CUSTOMIZATION:
- Edit HELP_ARTICLES, FAQ_DATA, TROUBLESHOOTING_GUIDES with your content
- Modify AI_CONTEXT with your app's documentation
- Update KEYBOARD_SHORTCUTS and WHATS_NEW_DATA as needed
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/help", tags=["Help Center"])

# =============================================================================
# CONFIGURATION - Customize for your app
# =============================================================================

APP_NAME = "YourApp"  # Change this
HELP_CENTER_BASE = "/help"
SUPPORT_EMAIL = "support@yourapp.com"  # Change this

# =============================================================================
# AI ASSISTANT CONTEXT - Customize with your app's documentation
# =============================================================================

AI_CONTEXT = f"""
You are the {APP_NAME} AI Assistant - an expert guide for the platform.

When answering questions, include relevant article links in markdown format: [Article Title](LINK)

## Available Help Links:
- Getting Started: [Welcome Guide]({{base}}?tab=article&article=getting-started)
- Dashboard: [Dashboard Overview]({{base}}?tab=article&article=dashboard-overview)
- FAQ: [Frequently Asked Questions]({{base}}?tab=faq)
- Troubleshooting: [Troubleshooting Guide]({{base}}?tab=troubleshooting)
- Shortcuts: [Keyboard Shortcuts]({{base}}?tab=shortcuts)

## Platform Overview:
{APP_NAME} is a platform for [describe your app here].

## Key Features:
1. **Feature 1**: Description
2. **Feature 2**: Description
3. **Feature 3**: Description

## Common Tasks:
- Task 1: Navigation path
- Task 2: Navigation path

## Guidelines:
1. Be helpful, friendly, and concise
2. Include 1-2 relevant links when helpful
3. For technical issues, suggest checking the Troubleshooting Guide
4. For account issues, suggest contacting {SUPPORT_EMAIL}
""".format(base=HELP_CENTER_BASE)

# =============================================================================
# HELP ARTICLES - Add your app's documentation here
# =============================================================================

HELP_ARTICLES = {
    "getting-started": {
        "id": "getting-started",
        "title": "Getting Started",
        "category": "basics",
        "summary": "Learn the basics and get up and running quickly.",
        "content": """# Getting Started with {APP_NAME}

Welcome! This guide will help you get started.

## Quick Start

1. **Sign Up** - Create your account
2. **Set Up** - Configure your settings
3. **Explore** - Discover features

## Next Steps

- Check out our [Dashboard Overview](#)
- Read the [FAQ](#)
""".format(APP_NAME=APP_NAME),
        "tags": ["basics", "introduction", "popular"],
        "read_time": "3 min"
    },
    "dashboard-overview": {
        "id": "dashboard-overview",
        "title": "Dashboard Overview",
        "category": "basics",
        "summary": "Understand your main dashboard and its components.",
        "content": """# Dashboard Overview

Your dashboard is the central hub for all activities.

## Main Components

### Statistics Cards
At-a-glance metrics showing key data.

### Activity Feed
Recent actions and updates.

### Quick Actions
Shortcuts to common tasks.
""",
        "tags": ["dashboard", "navigation"],
        "read_time": "4 min"
    },
    # Add more articles as needed...
}

# =============================================================================
# CATEGORIES - Define your help categories
# =============================================================================

CATEGORIES = [
    {"id": "basics", "name": "Getting Started", "icon": "Zap", "description": "Learn the fundamentals"},
    {"id": "features", "name": "Features", "icon": "FileText", "description": "Explore all features"},
    {"id": "data", "name": "Data & Reports", "icon": "BarChart3", "description": "Analytics and exports"},
    {"id": "admin", "name": "Administration", "icon": "Settings", "description": "Settings and users"},
    {"id": "integrations", "name": "Integrations", "icon": "Plug", "description": "Connect with other tools"},
]

# =============================================================================
# FAQ DATA - Add your frequently asked questions
# =============================================================================

FAQ_DATA = [
    {
        "question": "How do I get started?",
        "answer": "Visit the Dashboard and follow the setup wizard. You can also check our Getting Started guide for detailed instructions.",
        "category": "basics"
    },
    {
        "question": "How do I reset my password?",
        "answer": "Click 'Forgot Password' on the login page, enter your email, and follow the reset link sent to you.",
        "category": "admin"
    },
    {
        "question": "Can I export my data?",
        "answer": "Yes! Go to Data > Export, select your format (CSV, Excel, JSON), apply any filters, and click Export.",
        "category": "data"
    },
    {
        "question": "How do I add team members?",
        "answer": "Go to Settings > Team, click 'Add Member', enter their email and role, then send the invitation.",
        "category": "admin"
    },
    {
        "question": "What integrations are available?",
        "answer": "We support integrations with popular tools. Check Settings > Integrations to see available options and connect your accounts.",
        "category": "integrations"
    },
    # Add more FAQ items...
]

# =============================================================================
# TROUBLESHOOTING GUIDES - Common issues and solutions
# =============================================================================

TROUBLESHOOTING_GUIDES = [
    {
        "id": "login-issues",
        "title": "Cannot Log In",
        "icon": "Shield",
        "severity": "medium",
        "steps": [
            "Verify your email address is correct",
            "Check caps lock is off",
            "Use 'Forgot Password' to reset",
            "Clear browser cookies and cache",
            "Try incognito/private browsing mode",
            "Contact support if issue persists"
        ],
        "common_causes": [
            "Incorrect password",
            "Caps lock enabled",
            "Account locked after failed attempts",
            "Session cookie issues"
        ]
    },
    {
        "id": "sync-issues",
        "title": "Data Not Syncing",
        "icon": "AlertCircle",
        "severity": "high",
        "steps": [
            "Check internet connection",
            "Verify you're logged in",
            "Refresh the page",
            "Check browser console for errors",
            "Clear cache and retry",
            "Contact support if issue persists"
        ],
        "common_causes": [
            "Network connectivity issues",
            "Session expired",
            "Browser cache issues",
            "Server maintenance"
        ]
    },
    {
        "id": "slow-performance",
        "title": "Application Running Slow",
        "icon": "Clock",
        "severity": "low",
        "steps": [
            "Close unnecessary browser tabs",
            "Clear browser cache",
            "Disable browser extensions",
            "Try a different browser",
            "Check your internet speed",
            "Reduce data range in queries"
        ],
        "common_causes": [
            "Too many browser tabs open",
            "Slow internet connection",
            "Large data queries",
            "Browser extensions interfering"
        ]
    },
    # Add more troubleshooting guides...
]

# =============================================================================
# KEYBOARD SHORTCUTS
# =============================================================================

KEYBOARD_SHORTCUTS = [
    {
        "category": "Navigation",
        "shortcuts": [
            {"keys": ["Ctrl", "K"], "action": "Open search"},
            {"keys": ["Ctrl", "D"], "action": "Go to Dashboard"},
            {"keys": ["Esc"], "action": "Close modal/dialog"}
        ]
    },
    {
        "category": "Actions",
        "shortcuts": [
            {"keys": ["Ctrl", "S"], "action": "Save"},
            {"keys": ["Ctrl", "Z"], "action": "Undo"},
            {"keys": ["Ctrl", "Y"], "action": "Redo"}
        ]
    },
    {
        "category": "General",
        "shortcuts": [
            {"keys": ["?"], "action": "Open help"},
            {"keys": ["Ctrl", "/"], "action": "Show shortcuts"},
            {"keys": ["Ctrl", ","], "action": "Open settings"}
        ]
    },
]

# =============================================================================
# WHAT'S NEW / RELEASE NOTES
# =============================================================================

WHATS_NEW_DATA = [
    {
        "version": "1.2.0",
        "date": "February 2026",
        "highlights": [
            {"type": "feature", "title": "Help Center", "description": "Comprehensive documentation and AI assistant"},
            {"type": "feature", "title": "New Dashboard", "description": "Redesigned dashboard with better analytics"},
            {"type": "improvement", "title": "Performance", "description": "50% faster page load times"}
        ]
    },
    {
        "version": "1.1.0",
        "date": "January 2026",
        "highlights": [
            {"type": "feature", "title": "Team Collaboration", "description": "Invite team members and collaborate"},
            {"type": "improvement", "title": "Export Options", "description": "New export formats available"},
            {"type": "bugfix", "title": "Login Issues", "description": "Fixed session timeout problems"}
        ]
    },
    # Add more releases...
]

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str

class FeedbackRequest(BaseModel):
    article_id: Optional[str] = None
    helpful: Optional[bool] = None
    comment: Optional[str] = None

# =============================================================================
# IN-MEMORY STORAGE (Use database in production)
# =============================================================================

chat_sessions: Dict[str, Any] = {}
feedback_store: List[Dict] = []

# =============================================================================
# API ROUTES
# =============================================================================

@router.get("/articles")
async def get_articles(category: Optional[str] = None, search: Optional[str] = None):
    """Get help articles, optionally filtered by category or search term"""
    articles = []
    
    for article_id, article in HELP_ARTICLES.items():
        articles.append({
            "id": article["id"],
            "title": article["title"],
            "category": article["category"],
            "summary": article["summary"],
            "tags": article.get("tags", []),
            "read_time": article.get("read_time", "5 min")
        })
    
    if category:
        articles = [a for a in articles if a["category"] == category]
    
    if search:
        search_lower = search.lower()
        articles = [
            a for a in articles 
            if search_lower in a["title"].lower() 
            or search_lower in a["summary"].lower()
            or any(search_lower in tag for tag in a.get("tags", []))
        ]
    
    return {"articles": articles}


@router.get("/articles/{article_id}")
async def get_article(article_id: str):
    """Get a specific help article by ID"""
    article = HELP_ARTICLES.get(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.get("/categories")
async def get_categories():
    """Get all help article categories"""
    return {"categories": CATEGORIES}


@router.get("/categories-full")
async def get_categories_full():
    """Get all categories with their articles"""
    categories_with_articles = []
    
    for cat in CATEGORIES:
        articles = [
            {
                "id": a["id"],
                "title": a["title"],
                "readTime": a.get("read_time", "5 min"),
                "popular": "popular" in a.get("tags", [])
            }
            for a in HELP_ARTICLES.values()
            if a["category"] == cat["id"]
        ]
        categories_with_articles.append({
            **cat,
            "articles": articles
        })
    
    return {"categories": categories_with_articles}


@router.get("/faq")
async def get_faq():
    """Get all FAQ items"""
    return {"faq": FAQ_DATA}


@router.get("/troubleshooting")
async def get_troubleshooting():
    """Get all troubleshooting guides"""
    return {"guides": TROUBLESHOOTING_GUIDES}


@router.get("/troubleshooting/{guide_id}")
async def get_troubleshooting_guide(guide_id: str):
    """Get a specific troubleshooting guide"""
    guide = next((g for g in TROUBLESHOOTING_GUIDES if g["id"] == guide_id), None)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    return guide


@router.get("/shortcuts")
async def get_shortcuts():
    """Get keyboard shortcuts reference"""
    return {"shortcuts": KEYBOARD_SHORTCUTS}


@router.get("/whats-new")
async def get_whats_new():
    """Get release notes and what's new"""
    return {"releases": WHATS_NEW_DATA}


@router.get("/search")
async def search_help(q: str):
    """Global search across articles, FAQ, and troubleshooting"""
    results = {
        "articles": [],
        "faq": [],
        "troubleshooting": []
    }
    
    q_lower = q.lower()
    
    # Search articles
    for article_id, article in HELP_ARTICLES.items():
        if (q_lower in article["title"].lower() or 
            q_lower in article["summary"].lower() or
            q_lower in article.get("content", "").lower() or
            any(q_lower in tag for tag in article.get("tags", []))):
            results["articles"].append({
                "id": article["id"],
                "title": article["title"],
                "summary": article["summary"],
                "category": article["category"]
            })
    
    # Search FAQ
    for faq in FAQ_DATA:
        if q_lower in faq["question"].lower() or q_lower in faq["answer"].lower():
            results["faq"].append(faq)
    
    # Search troubleshooting
    for guide in TROUBLESHOOTING_GUIDES:
        if (q_lower in guide["title"].lower() or
            any(q_lower in step.lower() for step in guide["steps"])):
            results["troubleshooting"].append({
                "id": guide["id"],
                "title": guide["title"]
            })
    
    return results


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest):
    """Chat with the AI Assistant"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI assistant not configured")
        
        session_id = request.session_id or str(uuid.uuid4())
        
        # Create or retrieve chat session
        if session_id not in chat_sessions:
            chat = LlmChat(
                api_key=api_key,
                session_id=session_id,
                system_message=AI_CONTEXT.format(base=HELP_CENTER_BASE)
            ).with_model("openai", "gpt-4o")
            chat_sessions[session_id] = chat
        else:
            chat = chat_sessions[session_id]
        
        # Send message and get response
        response = await chat.send_message(UserMessage(text=request.message))
        
        return ChatResponse(response=response, session_id=session_id)
        
    except ImportError:
        # Fallback if emergentintegrations not available
        return ChatResponse(
            response=f"I'm sorry, the AI assistant is temporarily unavailable. Please browse the Help Center articles or contact {SUPPORT_EMAIL} for assistance.",
            session_id=request.session_id or str(uuid.uuid4())
        )
    except Exception as e:
        print(f"Help assistant error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/feedback")
async def submit_feedback(
    request: Request,
    article_id: Optional[str] = None,
    helpful: Optional[bool] = None,
    comment: Optional[str] = None
):
    """Submit feedback on a help article or the assistant"""
    feedback_doc = {
        "article_id": article_id,
        "helpful": helpful,
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store in memory (use database in production)
    feedback_store.append(feedback_doc)
    
    # Optionally persist to database:
    # db = request.app.state.db
    # await db.help_feedback.insert_one(feedback_doc)
    
    return {"message": "Thank you for your feedback!"}


@router.get("/analytics")
async def get_help_analytics():
    """Get analytics on help center usage (admin endpoint)"""
    return {
        "total_feedback": len(feedback_store),
        "active_chat_sessions": len(chat_sessions),
        "helpful_count": len([f for f in feedback_store if f.get("helpful") == True]),
        "not_helpful_count": len([f for f in feedback_store if f.get("helpful") == False])
    }
