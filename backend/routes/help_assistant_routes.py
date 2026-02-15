"""DataPulse - Help Center AI Assistant Routes"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/help", tags=["Help Center"])

# DataPulse Help Center Knowledge Base
HELP_CENTER_CONTEXT = """
You are the DataPulse AI Assistant, a helpful guide for the DataPulse data collection platform.

## About DataPulse
DataPulse is an enterprise-grade field data collection platform designed for research, monitoring & evaluation (M&E), and field surveys. Key features include:
- Offline-first data collection
- Real-time quality monitoring
- Multi-language support (EN/SW)
- GPS and location tracking
- Media capture (photos, audio, video)
- Advanced form logic and skip patterns

## Core Modules

### Forms & Data Collection
- **Form Builder**: Create surveys with drag-and-drop interface
- **Field Types**: Text, number, select, multi-select, date, GPS, media, signature, barcode
- **Skip Logic**: Conditional display based on previous answers
- **Calculated Fields**: Auto-compute values from other fields
- **Form Versioning**: Track changes and roll back if needed

### Data Management
- **Submissions**: View, edit, and manage collected data
- **Datasets**: Create structured data tables
- **Data Transform**: Clean and transform your data
- **Import/Export**: CSV, Excel, JSON formats supported

### DataViz Studio
- **Charts Page**: Create bar, line, pie, area, scatter charts from your data
- **Dashboards**: Build custom dashboards with widgets (stats, charts, tables, gauges)
- **Report Builder**: Generate PDF reports with your data
- **Dashboard Templates**: 10 preset templates for sales, marketing, customers, operations, finance, analytics, executive, projects, support, and custom

### User Management
- **Users**: Add, edit, deactivate users
- **Roles**: Admin, Manager, Enumerator, Viewer
- **Activity Tracking**: Monitor user activity and sessions
- **Password Policies**: Enforce security requirements

### Quality Control
- **Quality AI**: AI-powered data quality checks
- **Backcheck**: Random verification of submissions
- **Duplicate Detection**: Find and merge duplicate entries

### Additional Features
- **CATI/CAWI**: Computer-assisted telephone/web interviewing
- **Case Management**: Track survey cases through workflows
- **GPS Map**: Visualize submission locations
- **Device Management**: Monitor field devices

## Common Tasks

### Creating a Form
1. Go to Forms page
2. Click "New Form"
3. Add questions using the form builder
4. Configure skip logic if needed
5. Preview and publish

### Building a Dashboard
1. Go to Dashboards page
2. Click "New Dashboard" or use a template
3. Add widgets (stats, charts, tables)
4. Connect to your data source
5. Save and share

### Generating Reports
1. Go to Report Builder
2. Select your data source
3. Add sections and visualizations
4. Customize the layout
5. Export as PDF

### Managing Users
1. Go to User Management
2. Click "Add User"
3. Set role and permissions
4. Send invitation

## Keyboard Shortcuts
- Ctrl/Cmd + S: Save
- Ctrl/Cmd + Z: Undo
- Ctrl/Cmd + Y: Redo
- Ctrl/Cmd + /: Show shortcuts
- Esc: Close dialogs

## Getting Help
- Use this AI assistant for quick answers
- Browse the Help Center for detailed guides
- Contact support at support@datapulse.io

Always be helpful, concise, and guide users to the right features. If you don't know something specific, suggest they contact support.
"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = []


class ChatResponse(BaseModel):
    response: str
    session_id: str


class ArticleSearch(BaseModel):
    query: str
    category: Optional[str] = None


# In-memory session storage (in production, use Redis or database)
sessions: Dict[str, List[ChatMessage]] = {}


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest, req: Request):
    """Chat with the AI Help Assistant"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Get or create session
        session_id = request.session_id or str(uuid.uuid4())
        
        # Initialize chat with context
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=f"""You are the DataPulse AI Assistant. Be helpful, friendly, and concise.

{HELP_CENTER_CONTEXT}

Guidelines:
- Give direct, actionable answers
- Use bullet points for lists
- Reference specific features when relevant
- Keep responses under 200 words unless detailed explanation needed
- If unsure, suggest contacting support@datapulse.io
"""
        )
        
        # Use GPT-4o for faster responses
        chat.with_model("openai", "gpt-4o")
        
        # Build conversation context
        if request.conversation_history:
            for msg in request.conversation_history[-5:]:  # Last 5 messages for context
                if msg.get("role") == "user":
                    await chat.send_message(UserMessage(text=msg.get("content", "")))
        
        # Send user message
        user_msg = UserMessage(text=request.message)
        response = await chat.send_message(user_msg)
        
        return ChatResponse(
            response=response,
            session_id=session_id
        )
        
    except ImportError:
        # Fallback if emergentintegrations not available
        return ChatResponse(
            response="I'm sorry, the AI assistant is temporarily unavailable. Please try again later or contact support@datapulse.io for help.",
            session_id=request.session_id or str(uuid.uuid4())
        )
    except Exception as e:
        print(f"Help assistant error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/articles")
async def get_help_articles(
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """Get help articles, optionally filtered by category or search term"""
    
    articles = [
        {
            "id": "getting-started",
            "title": "Getting Started with DataPulse",
            "category": "basics",
            "summary": "Learn the basics of DataPulse and set up your first project",
            "content": "Welcome to DataPulse! This guide will help you get started...",
            "tags": ["beginner", "setup", "introduction"]
        },
        {
            "id": "form-builder",
            "title": "Creating Forms with Form Builder",
            "category": "forms",
            "summary": "Step-by-step guide to creating data collection forms",
            "content": "The Form Builder is a powerful tool for creating surveys...",
            "tags": ["forms", "builder", "questions"]
        },
        {
            "id": "skip-logic",
            "title": "Setting Up Skip Logic",
            "category": "forms",
            "summary": "Configure conditional display rules for your form fields",
            "content": "Skip logic allows you to show or hide questions based on responses...",
            "tags": ["forms", "logic", "conditions"]
        },
        {
            "id": "dashboards",
            "title": "Building Dashboards",
            "category": "dataviz",
            "summary": "Create visual dashboards to monitor your data",
            "content": "Dashboards help you visualize key metrics at a glance...",
            "tags": ["dashboards", "charts", "visualization"]
        },
        {
            "id": "dashboard-templates",
            "title": "Using Dashboard Templates",
            "category": "dataviz",
            "summary": "Quick-start with pre-built dashboard templates",
            "content": "DataPulse offers 10 preset templates for different use cases...",
            "tags": ["templates", "dashboards", "presets"]
        },
        {
            "id": "offline-collection",
            "title": "Offline Data Collection",
            "category": "mobile",
            "summary": "Collect data without internet connection",
            "content": "DataPulse supports offline-first data collection...",
            "tags": ["offline", "mobile", "sync"]
        },
        {
            "id": "user-management",
            "title": "Managing Users and Roles",
            "category": "admin",
            "summary": "Add users, assign roles, and manage permissions",
            "content": "User management allows you to control access to your organization...",
            "tags": ["users", "roles", "permissions", "admin"]
        },
        {
            "id": "data-export",
            "title": "Exporting Your Data",
            "category": "data",
            "summary": "Export submissions to CSV, Excel, or JSON",
            "content": "You can export your collected data in various formats...",
            "tags": ["export", "csv", "excel", "data"]
        },
        {
            "id": "quality-checks",
            "title": "Data Quality Monitoring",
            "category": "quality",
            "summary": "Use AI-powered quality checks to ensure data integrity",
            "content": "Quality AI automatically scans your submissions for anomalies...",
            "tags": ["quality", "ai", "validation"]
        },
        {
            "id": "report-builder",
            "title": "Creating Reports",
            "category": "dataviz",
            "summary": "Generate professional PDF reports from your data",
            "content": "The Report Builder helps you create publication-ready reports...",
            "tags": ["reports", "pdf", "export"]
        }
    ]
    
    # Filter by category
    if category:
        articles = [a for a in articles if a["category"] == category]
    
    # Search filter
    if search:
        search_lower = search.lower()
        articles = [
            a for a in articles 
            if search_lower in a["title"].lower() 
            or search_lower in a["summary"].lower()
            or any(search_lower in tag for tag in a["tags"])
        ]
    
    return {"articles": articles}


@router.get("/articles/{article_id}")
async def get_article(article_id: str):
    """Get a specific help article by ID"""
    
    # Full article content mapping
    articles_content = {
        "getting-started": {
            "id": "getting-started",
            "title": "Getting Started with DataPulse",
            "category": "basics",
            "content": """
# Getting Started with DataPulse

Welcome to DataPulse! This guide will help you set up your first project and start collecting data.

## 1. Create Your Organization

After logging in, you'll need to create or join an organization:
1. Click on **Team** in the sidebar
2. Click **Create Organization**
3. Enter your organization name and details
4. Invite team members

## 2. Create Your First Project

Projects help you organize related forms and data:
1. Go to **Projects** page
2. Click **New Project**
3. Enter project name and description
4. Select team members to add

## 3. Build Your First Form

1. Navigate to **Forms**
2. Click **New Form**
3. Drag and drop field types to build your survey
4. Configure field properties and validation
5. Click **Save** and then **Publish**

## 4. Collect Data

- **Web**: Share the form link for online submissions
- **Mobile**: Download the DataPulse app for offline collection
- **CATI**: Use computer-assisted telephone interviewing

## 5. Analyze Results

View your submissions in the **Submissions** page, or create visualizations in **DataViz Studio**.

Need more help? Use the AI Assistant or contact support@datapulse.io
            """,
            "updated_at": "2026-02-15"
        },
        "form-builder": {
            "id": "form-builder",
            "title": "Creating Forms with Form Builder",
            "category": "forms",
            "content": """
# Creating Forms with Form Builder

The Form Builder is a powerful drag-and-drop tool for creating data collection forms.

## Field Types Available

- **Text**: Short and long text inputs
- **Number**: Numeric values with validation
- **Select**: Single choice from options
- **Multi-Select**: Multiple choice selection
- **Date/Time**: Date and time pickers
- **GPS**: Location capture with coordinates
- **Media**: Photo, audio, and video capture
- **Signature**: Digital signature capture
- **Barcode**: QR and barcode scanning
- **Calculated**: Auto-computed values

## Creating a Form

1. Click **Forms** > **New Form**
2. Enter form name and description
3. Drag fields from the left panel
4. Click on a field to edit its properties
5. Set validation rules if needed
6. Preview your form
7. Save and publish

## Field Properties

Each field can be configured with:
- **Label**: The question text
- **Required**: Make the field mandatory
- **Hint**: Help text for enumerators
- **Default Value**: Pre-filled value
- **Validation**: Rules for acceptable values

## Tips

- Use sections to group related questions
- Add skip logic for conditional questions
- Test thoroughly before deploying
            """,
            "updated_at": "2026-02-15"
        }
    }
    
    article = articles_content.get(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return article


@router.get("/categories")
async def get_categories():
    """Get all help article categories"""
    return {
        "categories": [
            {"id": "basics", "name": "Getting Started", "icon": "BookOpen"},
            {"id": "forms", "name": "Forms & Builder", "icon": "FileText"},
            {"id": "dataviz", "name": "DataViz Studio", "icon": "BarChart"},
            {"id": "data", "name": "Data Management", "icon": "Database"},
            {"id": "mobile", "name": "Mobile & Offline", "icon": "Smartphone"},
            {"id": "admin", "name": "Administration", "icon": "Settings"},
            {"id": "quality", "name": "Quality Control", "icon": "Shield"},
            {"id": "integrations", "name": "Integrations", "icon": "Plug"}
        ]
    }


@router.post("/feedback")
async def submit_feedback(
    request: Request,
    article_id: Optional[str] = None,
    helpful: Optional[bool] = None,
    comment: Optional[str] = None
):
    """Submit feedback on a help article or the assistant"""
    db = request.app.state.db
    
    feedback_doc = {
        "article_id": article_id,
        "helpful": helpful,
        "comment": comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.help_feedback.insert_one(feedback_doc)
    
    return {"message": "Thank you for your feedback!"}
