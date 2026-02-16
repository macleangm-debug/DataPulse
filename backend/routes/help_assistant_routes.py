"""DataPulse - Comprehensive Help Center Routes
Complete documentation with AI Assistant for all DataPulse features
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/help", tags=["Help Center"])


# =============================================================================
# HELPER FUNCTION TO GET DATABASE
# =============================================================================

def get_db(request: Request):
    """Get database instance from app state"""
    return request.app.state.db


# =============================================================================
# CHAT SESSION PERSISTENCE FUNCTIONS
# =============================================================================

async def get_chat_session(db, session_id: str) -> Optional[Dict]:
    """Retrieve a chat session from the database"""
    session = await db.chat_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    return session


async def create_or_update_chat_session(
    db, 
    session_id: str, 
    user_message: str, 
    assistant_response: str,
    user_id: Optional[str] = None
) -> Dict:
    """Create or update a chat session with new messages"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if session exists
    existing = await db.chat_sessions.find_one({"session_id": session_id})
    
    if existing:
        # Append new messages to existing session
        await db.chat_sessions.update_one(
            {"session_id": session_id},
            {
                "$push": {
                    "messages": {
                        "$each": [
                            {"role": "user", "content": user_message, "timestamp": now},
                            {"role": "assistant", "content": assistant_response, "timestamp": now}
                        ]
                    }
                },
                "$set": {"updated_at": now}
            }
        )
    else:
        # Create new session
        session_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "messages": [
                {"role": "user", "content": user_message, "timestamp": now},
                {"role": "assistant", "content": assistant_response, "timestamp": now}
            ],
            "created_at": now,
            "updated_at": now
        }
        await db.chat_sessions.insert_one(session_doc)
    
    return {"session_id": session_id, "updated_at": now}


async def get_chat_history(db, session_id: str, limit: int = 10) -> List[Dict]:
    """Get recent chat history for a session"""
    session = await db.chat_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0, "messages": 1}
    )
    
    if session and session.get("messages"):
        # Return the last 'limit' messages
        return session["messages"][-limit:]
    
    return []

# =============================================================================
# COMPREHENSIVE AI KNOWLEDGE BASE
# =============================================================================

HELP_CENTER_CONTEXT = """
You are the DataPulse AI Assistant - an expert guide for the DataPulse enterprise data collection platform.

## PLATFORM OVERVIEW
DataPulse is an enterprise-grade field data collection platform for:
- Research surveys and studies
- Monitoring & Evaluation (M&E)
- Field data collection
- CATI/CAWI surveys
- Quality control and validation

Key differentiators:
- Offline-first architecture (collect data without internet)
- Real-time quality monitoring with AI
- Multi-language support (English/Swahili)
- GPS and location tracking
- Comprehensive media capture

## NAVIGATION STRUCTURE
The app uses a rail + panel navigation:
- **Home**: Dashboard with project overview, submission trends, quality metrics
- **Projects**: All Projects, Forms, Templates, Submissions
- **Data**: Cases, Import Cases, Datasets, Exports, Charts, Dashboards, Report Builder
- **Field Ops**: CATI Center, Back-check, Token Surveys, Preload/Writeback, Devices
- **Quality & AI**: Data Analysis, Quality AI, Simulation, Analytics, Quality, GPS Map
- **Apps**: Plugins, Workflows
- **Settings**: Team, User Management, Roles, Translations, API Security, Settings, Help Center, Super Admin

## DETAILED FEATURE DOCUMENTATION

### 1. FORMS & DATA COLLECTION

#### Creating a Form
1. Navigate to Projects > Forms
2. Click "New Form" button (top right)
3. Enter form name and description
4. Use the drag-and-drop builder to add fields
5. Configure each field's properties
6. Set up skip logic if needed
7. Preview the form
8. Save and Publish

#### Field Types Available
- **Text**: Short text (single line) or Long text (multi-line/paragraph)
- **Number**: Integer or decimal with min/max validation
- **Select**: Single choice dropdown or radio buttons
- **Multi-Select**: Multiple choice with checkboxes
- **Date**: Date picker with optional time
- **Time**: Time-only picker
- **GPS**: Captures latitude, longitude, accuracy, altitude
- **Photo**: Camera capture or gallery selection (max 10MB)
- **Audio**: Voice recording (max 5 minutes)
- **Video**: Video recording (max 2 minutes, 50MB)
- **Signature**: Digital signature capture
- **Barcode**: QR code and barcode scanner
- **Calculated**: Formula-based fields (sum, average, etc.)
- **Note**: Display-only text for instructions

#### Skip Logic Configuration
Skip logic controls when fields appear based on previous answers:
1. Select a field in the builder
2. Click "Logic" tab in properties panel
3. Add condition: "Show this field when..."
4. Select the triggering field
5. Choose operator (equals, not equals, contains, greater than, etc.)
6. Set the value to compare against
7. Multiple conditions can be combined with AND/OR

Example: Show "Specify Other" field only when "Other" is selected in previous question.

#### Calculated Fields
Create fields that auto-compute values:
- **Sum**: Add multiple numeric fields
- **Average**: Calculate mean of numeric fields
- **Count**: Count non-empty responses
- **Concatenate**: Combine text fields
- **Custom Formula**: Write JavaScript expressions

Example formula: `{field_age} >= 18 ? "Adult" : "Minor"`

#### Form Versioning
DataPulse tracks all form changes:
- View version history in Form Builder > Version History
- Compare versions side-by-side
- Restore previous versions
- Each publish creates a new version
- Submissions are linked to specific versions

### 2. SUBMISSIONS & DATA

#### Viewing Submissions
1. Go to Projects > Submissions
2. Filter by form, date range, status, or enumerator
3. Click a submission to view details
4. Edit submissions (if permitted by role)
5. Add review notes or flag for review

#### Submission Statuses
- **Draft**: Saved but not submitted
- **Pending**: Submitted, awaiting review
- **Approved**: Reviewed and accepted
- **Rejected**: Reviewed and rejected (needs correction)
- **Flagged**: Marked for special attention

#### Data Export
Export your data in multiple formats:
1. Go to Data > Exports
2. Select form(s) to export
3. Choose format: CSV, Excel, JSON, SPSS
4. Select fields to include
5. Apply filters (date range, status, etc.)
6. Click Export and download

Export options:
- Include metadata (submission time, GPS, device info)
- Include repeat groups as separate sheets
- Include attachments (media files)
- Include audit trail

### 3. DATAVIZ STUDIO

#### Chart Studio
Create visualizations from your data:
1. Go to Data > Charts
2. Click "Create Chart"
3. Select data source (form or dataset)
4. Choose chart type:
   - Bar Chart (vertical/horizontal)
   - Line Chart (trends over time)
   - Pie/Donut Chart (proportions)
   - Area Chart (cumulative values)
   - Scatter Plot (correlations)
5. Configure axes and series
6. Apply filters
7. Customize colors and labels
8. Save chart

#### Dashboard Builder
Build interactive dashboards:
1. Go to Data > Dashboards
2. Click "New Dashboard" or select a template
3. Choose from 10 preset templates:
   - Sales Dashboard
   - Marketing Analytics
   - Customer Insights
   - Operations Monitor
   - Financial Summary
   - Web Analytics
   - Executive Summary
   - Project Tracker
   - Support Dashboard
   - Blank Canvas

Widget Types (12 available):
- **Stat**: KPI card with big number
- **Chart**: Any chart type
- **Table**: Data table with sorting
- **Gauge**: Circular progress indicator
- **Progress**: Bar showing target progress
- **Map**: Geographic visualization
- **Funnel**: Conversion funnel
- **Heatmap**: Activity patterns
- **Scorecard**: Metric vs target
- **List**: Ranked items
- **Timeline**: Events/milestones
- **Sparkline**: Mini trend line

#### Report Builder
Generate PDF reports:
1. Go to Data > Report Builder
2. Click "Connect Data" to select source
3. Add sections:
   - Title/Header
   - Summary statistics
   - Charts and visualizations
   - Data tables
   - Custom text
4. Customize layout and styling
5. Preview report
6. Export as PDF

### 4. USER MANAGEMENT

#### Adding Users
1. Go to Settings > User Management
2. Click "Add User"
3. Enter email address
4. Select role:
   - **Admin**: Full access, can manage users
   - **Manager**: Can create forms, view all data
   - **Enumerator**: Can submit data only
   - **Viewer**: Read-only access
5. Assign to projects (optional)
6. Click "Send Invitation"

#### User Roles & Permissions
| Permission | Admin | Manager | Enumerator | Viewer |
|------------|-------|---------|------------|--------|
| Create Forms | Yes | Yes | No | No |
| Edit Forms | Yes | Yes | No | No |
| Submit Data | Yes | Yes | Yes | No |
| View Submissions | Yes | Yes | Own only | Yes |
| Edit Submissions | Yes | Yes | Own only | No |
| Manage Users | Yes | No | No | No |
| Export Data | Yes | Yes | No | Yes |
| View Analytics | Yes | Yes | No | Yes |

#### Password Policies
Configure in Settings > Security:
- Minimum length (default: 8 characters)
- Require uppercase letters
- Require numbers
- Require special characters
- Password expiry (days)
- Maximum login attempts
- Session timeout

### 5. OFFLINE DATA COLLECTION

#### How Offline Works
1. Forms are cached locally on the device
2. Submissions are saved to local storage when offline
3. Data syncs automatically when connection is restored
4. Conflict resolution handles simultaneous edits

#### Checking Sync Status
- Green indicator = Online and synced
- Yellow indicator = Pending sync (data waiting)
- Red indicator = Offline

#### Force Sync
If data isn't syncing:
1. Check internet connection
2. Go to Settings > Sync
3. Click "Force Sync"
4. View sync log for errors

### 6. QUALITY CONTROL

#### Quality AI Features
AI-powered data quality checks:
- **Outlier Detection**: Flags unusual numeric values
- **Duplicate Detection**: Finds similar submissions
- **Completeness Check**: Identifies missing required fields
- **Consistency Check**: Cross-validates related fields
- **Time Analysis**: Flags unusually fast/slow submissions

#### Running Quality Checks
1. Go to Quality & AI > Quality AI
2. Select form to analyze
3. Click "Run Analysis"
4. Review flagged submissions
5. Approve, reject, or mark for follow-up

#### Back-checks
Random re-verification of submissions:
1. Go to Field Ops > Back-check
2. Configure sampling rate (e.g., 10%)
3. Assign back-checkers
4. Review discrepancies
5. Generate back-check report

### 7. CATI/CAWI SURVEYS

#### CATI (Computer-Assisted Telephone Interviewing)
1. Go to Field Ops > CATI Center
2. Import contact list (CSV with phone numbers)
3. Assign to interviewers
4. Configure call scheduling
5. Track call outcomes:
   - Complete
   - No answer
   - Busy
   - Refused
   - Callback scheduled

#### CAWI (Computer-Assisted Web Interviewing)
1. Go to Field Ops > Token Surveys
2. Generate survey links/tokens
3. Distribute via email or SMS
4. Track completion rates
5. Set expiry dates

### 8. GPS & LOCATION

#### Capturing GPS
- GPS is captured automatically if form has GPS field
- Manual capture by clicking location button
- Accuracy indicator shows precision
- Indoor collection may have reduced accuracy

#### GPS Map View
1. Go to Quality & AI > GPS Map
2. View all submissions on map
3. Filter by form, date, enumerator
4. Click markers for submission details
5. Identify geographic patterns
6. Export coordinates

### 9. MEDIA CAPTURE

#### Photo Capture
- Maximum file size: 10MB
- Supported formats: JPG, PNG
- Option to use camera or select from gallery
- Automatic compression available
- Metadata captured (timestamp, GPS if enabled)

#### Audio Recording
- Maximum duration: 5 minutes
- Format: MP3 or WAV
- Background noise reduction
- Playback before submission

#### Video Recording
- Maximum duration: 2 minutes
- Maximum file size: 50MB
- Format: MP4
- Resolution options: 480p, 720p, 1080p

### 10. CASE MANAGEMENT

#### Cases vs Submissions
- **Cases**: Pre-loaded records to be surveyed (e.g., household list)
- **Submissions**: Completed survey responses linked to cases

#### Importing Cases
1. Go to Data > Import Cases
2. Upload CSV file with case data
3. Map columns to fields
4. Set unique identifier column
5. Import and validate

#### Case Workflows
Define multi-stage processes:
1. Go to Apps > Workflows
2. Create workflow with stages
3. Set transition rules
4. Assign users to stages
5. Track cases through pipeline

### 11. INTEGRATIONS

#### Preload/Writeback
Import data to pre-fill forms:
1. Go to Field Ops > Preload/Writeback
2. Upload preload data (CSV)
3. Map to form fields
4. Data appears in form during collection

Writeback exports submissions to external systems.

#### API Access
Access your data programmatically:
1. Go to Settings > API Security
2. Generate API key
3. Use REST API endpoints:
   - GET /api/forms - List forms
   - GET /api/submissions - Get submissions
   - POST /api/submissions - Create submission
   - Full API docs at /api/docs

### 12. KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + S | Save current work |
| Ctrl/Cmd + Z | Undo last action |
| Ctrl/Cmd + Y | Redo last action |
| Ctrl/Cmd + / | Show keyboard shortcuts |
| Ctrl/Cmd + K | Quick search |
| Esc | Close dialogs/modals |
| Tab | Move to next field |
| Shift + Tab | Move to previous field |

## TROUBLESHOOTING GUIDE

### Common Issues

**Data Not Syncing**
1. Check internet connection (indicator in header)
2. Verify you're logged in
3. Go to Settings > Sync > Force Sync
4. Check if storage quota exceeded
5. Clear app cache and retry
6. Contact support if persists

**Form Not Loading**
1. Check internet connection
2. Refresh the page
3. Clear browser cache
4. Try different browser
5. Check if form is published

**GPS Not Working**
1. Enable location services in browser/device
2. Grant location permission to DataPulse
3. Move to area with better signal
4. Wait for accuracy to improve
5. Use manual coordinate entry if needed

**Login Issues**
1. Verify email and password
2. Check caps lock is off
3. Use "Forgot Password" to reset
4. Clear browser cookies
5. Try incognito/private mode
6. Contact admin if account locked

**Media Upload Failing**
1. Check file size limits (photo 10MB, video 50MB)
2. Verify supported format
3. Check storage quota
4. Compress file and retry
5. Check internet stability

**Submissions Missing**
1. Check filters (date, status, form)
2. Verify correct project selected
3. Check if submissions in draft status
4. Review sync status for pending uploads
5. Check user permissions

**Export Not Working**
1. Check export permissions
2. Verify data exists for selected filters
3. Try smaller date range
4. Check popup blocker
5. Try different export format

**Dashboard Not Showing Data**
1. Verify data source is connected
2. Check date range filters
3. Refresh the page
4. Verify permissions for data access
5. Re-connect data source

## CONTACT & SUPPORT

For issues not covered here:
- Email: support@datapulse.io
- Response time: Within 24 hours
- Include: Screenshot, steps to reproduce, browser/device info

## BEST PRACTICES

**Form Design**
- Keep forms concise (< 50 questions recommended)
- Use clear, simple language
- Group related questions in sections
- Test thoroughly before deploying
- Include validation rules

**Data Quality**
- Train enumerators on form content
- Run quality checks regularly
- Review flagged submissions promptly
- Use back-checks for verification

**Security**
- Use strong passwords
- Enable 2FA when available
- Review user access regularly
- Export and backup data periodically
- Log out when done

Remember: I'm here to help! Ask me anything about DataPulse and I'll guide you through it.
"""


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = []


class ChatResponse(BaseModel):
    response: str
    session_id: str


# =============================================================================
# COMPREHENSIVE HELP ARTICLES
# =============================================================================

HELP_ARTICLES = {
    # GETTING STARTED
    "getting-started": {
        "id": "getting-started",
        "title": "Getting Started with DataPulse",
        "category": "basics",
        "summary": "Complete guide to setting up your organization and first project",
        "tags": ["beginner", "setup", "introduction", "onboarding"],
        "read_time": "10 min",
        "screenshot": "/dashboard",
        "content": """
# Getting Started with DataPulse

Welcome to DataPulse! This comprehensive guide will help you set up your organization, create your first project, and start collecting data.

## Step 1: Understanding the Interface

When you log in, you'll see the main dashboard with:
- **Navigation Rail** (left side): Access all major features
- **Header**: Search, notifications, and user menu
- **Main Content Area**: Current page content
- **Quick Actions**: Frequently used actions

**Screenshot Reference**: Navigate to `/dashboard` to see this view.

## Step 2: Create Your Organization

Before creating projects, you need an organization:

1. Click your avatar in the bottom-left corner
2. Select "Create Organization"
3. Fill in the details:
   - Organization name
   - Description
   - Logo (optional)
4. Click "Create"

Your organization is now ready. You can invite team members from Settings > Team.

## Step 3: Create Your First Project

Projects help organize related forms and data:

1. Click "Projects" in the navigation rail
2. Click the "+" button or "New Project"
3. Enter:
   - Project name (e.g., "Q1 Customer Survey")
   - Description
   - Start and end dates (optional)
4. Click "Create Project"

## Step 4: Build Your First Form

1. Inside your project, click "New Form"
2. Give your form a name
3. Use the Form Builder:
   - Drag field types from the left panel
   - Drop them into your form
   - Click each field to configure properties
4. Add these basic fields to start:
   - Text field for "Name"
   - Number field for "Age"
   - Select field for "Gender"
   - GPS field for "Location"
5. Click "Save Draft"
6. Click "Preview" to test
7. Click "Publish" when ready

## Step 5: Collect Your First Submission

1. Open your published form
2. Fill in the fields
3. Click "Submit"
4. View your submission in the Submissions page

## Step 6: View Your Data

1. Go to Projects > Submissions
2. Select your form
3. View submission details
4. Export to CSV if needed

## Next Steps

Now that you've completed the basics:
- Learn about [Skip Logic](/help/skip-logic) for conditional questions
- Explore [Dashboard Templates](/help/dashboard-templates) for visualization
- Set up [Offline Collection](/help/offline-collection) for field work
- Configure [User Management](/help/user-management) for your team

Need help? Use the AI Assistant (chat bubble in bottom-right) or contact support@datapulse.io.
        """
    },
    
    # FORM BUILDER
    "form-builder": {
        "id": "form-builder",
        "title": "Complete Form Builder Guide",
        "category": "forms",
        "summary": "Master the form builder with all field types and configurations",
        "tags": ["forms", "builder", "questions", "fields"],
        "read_time": "15 min",
        "screenshot": "/forms",
        "content": """
# Complete Form Builder Guide

The Form Builder is DataPulse's powerful tool for creating data collection forms.

## Accessing the Form Builder

1. Navigate to Projects > Forms
2. Click "New Form" to create, or click an existing form to edit

**Screenshot Reference**: Navigate to `/forms` to see the forms list.

## Field Types Reference

### Text Fields
- **Short Text**: Single line, up to 255 characters
- **Long Text**: Multi-line paragraph text
- **Email**: Validates email format
- **Phone**: Validates phone number format

Configuration options:
- Placeholder text
- Default value
- Character limits
- Pattern validation (regex)

### Number Fields
- **Integer**: Whole numbers only
- **Decimal**: Numbers with decimal places

Configuration options:
- Minimum value
- Maximum value
- Decimal places
- Unit label (e.g., "kg", "$")

### Choice Fields
- **Select (Dropdown)**: Single choice from list
- **Radio Buttons**: Single choice, all options visible
- **Checkboxes**: Multiple choice
- **Multi-Select**: Multiple choice dropdown

Configuration options:
- Option list (add/remove/reorder)
- "Other" option with text input
- Default selection
- Cascading options (dependent on other fields)

### Date & Time
- **Date**: Calendar picker
- **Time**: Time picker
- **DateTime**: Combined date and time

Configuration options:
- Minimum/maximum dates
- Date format
- Allow future/past dates
- Default to current date/time

### Media Fields
- **Photo**: Camera capture or gallery
  - Max size: 10MB
  - Formats: JPG, PNG
  - Optional compression
  
- **Audio**: Voice recording
  - Max duration: 5 minutes
  - Format: MP3
  
- **Video**: Video recording
  - Max duration: 2 minutes
  - Max size: 50MB
  - Format: MP4

### Location Fields
- **GPS**: Auto-captures coordinates
  - Latitude, longitude
  - Accuracy (meters)
  - Altitude (optional)
  
- **Address**: Text address with optional geocoding

### Special Fields
- **Signature**: Touch/mouse signature capture
- **Barcode**: QR code and barcode scanner
- **Calculated**: Formula-based computed values
- **Note**: Display-only instructions/text
- **Section**: Group fields together

## Building Your Form

### Step-by-Step Process

1. **Add Fields**: Drag from left panel to form
2. **Configure**: Click field to edit properties
3. **Arrange**: Drag to reorder fields
4. **Section**: Group related fields
5. **Logic**: Add skip logic (see below)
6. **Preview**: Test your form
7. **Publish**: Make form available

### Field Properties

Every field has these common properties:
- **Label**: The question text
- **Name**: Internal identifier (auto-generated)
- **Required**: Make field mandatory
- **Hint**: Help text shown below field
- **Read Only**: View only, no editing

### Validation Rules

Add validation to ensure data quality:
- Required field
- Minimum/maximum values
- Pattern matching (regex)
- Custom error messages

Example regex patterns:
- Email: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$`
- Phone: `^\\+?[1-9]\\d{1,14}$`
- ZIP Code: `^\\d{5}(-\\d{4})?$`

## Form Settings

Access via gear icon in form builder:
- **Form Name & Description**
- **Submission Settings**: Single or multiple submissions per user
- **Notifications**: Email on new submissions
- **Offline**: Enable/disable offline collection
- **Expiry**: Auto-close form after date

## Best Practices

1. **Keep forms concise**: 20-30 questions ideal
2. **Use clear language**: Avoid jargon
3. **Group logically**: Use sections
4. **Test thoroughly**: Preview before publishing
5. **Include validation**: Prevent bad data
6. **Add hints**: Help users understand questions
        """
    },
    
    # SKIP LOGIC
    "skip-logic": {
        "id": "skip-logic",
        "title": "Setting Up Skip Logic",
        "category": "forms",
        "summary": "Configure conditional display rules for dynamic forms",
        "tags": ["forms", "logic", "conditions", "branching"],
        "read_time": "8 min",
        "screenshot": "/forms",
        "content": """
# Setting Up Skip Logic

Skip logic (also called branching or conditional logic) shows or hides questions based on previous answers.

## Why Use Skip Logic?

- Show relevant questions only
- Shorter forms for respondents
- Cleaner data collection
- Better user experience

## Creating Skip Logic Rules

### Basic Steps

1. Open your form in the Form Builder
2. Click on the field you want to conditionally show
3. Click the "Logic" tab in the properties panel
4. Click "Add Condition"
5. Configure:
   - **When**: Select the triggering field
   - **Operator**: equals, not equals, contains, greater than, etc.
   - **Value**: The value to compare against

### Example: Show "Other" Text Field

Scenario: Show a text field when user selects "Other" in a dropdown.

1. Add a Select field: "Preferred Contact Method"
   - Options: Email, Phone, SMS, Other
2. Add a Text field: "Please Specify"
3. Click on "Please Specify" field
4. Go to Logic tab
5. Add condition:
   - When: "Preferred Contact Method"
   - Operator: "equals"
   - Value: "Other"
6. The text field now only shows when "Other" is selected

### Example: Age-Based Questions

Scenario: Show employment questions only for adults.

1. Add Number field: "Age"
2. Add Select field: "Employment Status"
3. Click on "Employment Status"
4. Add condition:
   - When: "Age"
   - Operator: "greater than or equal to"
   - Value: "18"

## Operators Available

| Operator | Use Case |
|----------|----------|
| equals | Exact match |
| not equals | All except value |
| contains | Partial text match |
| does not contain | Exclude partial match |
| greater than | Numeric comparison |
| less than | Numeric comparison |
| is empty | Field not answered |
| is not empty | Field has any value |

## Multiple Conditions

Combine conditions with AND/OR:

**AND**: All conditions must be true
- Show if Age >= 18 AND Country = "USA"

**OR**: Any condition can be true  
- Show if Status = "Employed" OR Status = "Self-employed"

## Nested Logic

Create complex branching:
1. Question A → shows Question B
2. Question B answer → shows Question C
3. And so on...

## Tips & Best Practices

1. **Plan your flow**: Sketch the logic before building
2. **Keep it simple**: Avoid over-complicated branching
3. **Test all paths**: Preview and test every combination
4. **Document**: Note your logic for future reference
5. **Consider offline**: Ensure logic works without internet
        """
    },
    
    # DASHBOARDS
    "dashboards": {
        "id": "dashboards",
        "title": "Building Interactive Dashboards",
        "category": "dataviz",
        "summary": "Create visual dashboards to monitor and analyze your data",
        "tags": ["dashboards", "widgets", "visualization", "analytics"],
        "read_time": "12 min",
        "screenshot": "/dashboards",
        "content": """
# Building Interactive Dashboards

Dashboards provide at-a-glance views of your key metrics and data visualizations.

## Accessing Dashboards

Navigate to Data > Dashboards

**Screenshot Reference**: Navigate to `/dashboards` to see your dashboard list.

## Creating a Dashboard

### Option 1: From Template

1. Click "New Dashboard"
2. Select a template from the library
3. Choose from 10 presets:
   - **Sales Dashboard**: Revenue, orders, products
   - **Marketing Analytics**: Traffic, conversions, campaigns
   - **Customer Insights**: Demographics, behavior, satisfaction
   - **Operations Monitor**: Inventory, fulfillment, orders
   - **Financial Summary**: P&L, cash flow, expenses
   - **Web Analytics**: Page views, bounce rate, sessions
   - **Executive Summary**: High-level KPIs
   - **Project Tracker**: Tasks, milestones, team workload
   - **Support Dashboard**: Tickets, response time, satisfaction
   - **Blank Canvas**: Start from scratch
4. Connect your data source
5. Customize widgets

### Option 2: From Scratch

1. Click "New Dashboard"
2. Choose "Blank Canvas"
3. Add widgets one by one
4. Configure each widget's data source
5. Arrange layout

## Widget Types

### Stat Widget
- Display single KPI number
- Optional comparison (vs last period)
- Configurable icon and color
- Trend indicator

### Chart Widget
Support multiple chart types:
- Bar (vertical/horizontal)
- Line
- Area
- Pie/Donut
- Scatter

### Table Widget
- Display data in rows/columns
- Sortable columns
- Pagination
- Row actions

### Gauge Widget
- Circular progress indicator
- Min/max/target values
- Color zones (red/yellow/green)

### Progress Widget
- Multiple progress bars
- Show actual vs target
- Percentage display

### Map Widget
- Geographic visualization
- Choropleth or bubble map
- Click for details

### Funnel Widget
- Conversion funnel
- Stage-by-stage breakdown
- Drop-off rates

### Heatmap Widget
- Activity patterns
- Day/hour grids
- Color intensity

### Scorecard Widget
- Metric vs target comparison
- Trend indicator
- Period comparison

### List Widget
- Ranked items
- Top N display
- Metrics and labels

### Timeline Widget
- Events and milestones
- Chronological order
- Click for details

### Sparkline Widget
- Mini trend line
- Current value
- Compact display

## Connecting Data

1. Click on a widget
2. Click "Edit" or the gear icon
3. Select "Data Source"
4. Choose from:
   - Form submissions
   - Datasets
   - API endpoints
5. Configure field mapping
6. Set filters if needed

## Layout & Arrangement

- Drag widgets to reposition
- Resize by dragging corners
- Grid-based alignment
- Responsive layout

## Saving & Sharing

- Auto-save enabled
- Manual save with Ctrl/Cmd + S
- Share via link
- Export to PDF
- Save as template for reuse
        """
    },
    
    # DASHBOARD TEMPLATES
    "dashboard-templates": {
        "id": "dashboard-templates",
        "title": "Using Dashboard Templates",
        "category": "dataviz",
        "summary": "Quick-start with pre-built dashboard templates",
        "tags": ["templates", "dashboards", "presets", "quick-start"],
        "read_time": "6 min",
        "screenshot": "/dashboards",
        "content": """
# Using Dashboard Templates

Dashboard templates help you quickly create professional dashboards without starting from scratch.

## Accessing Templates

1. Go to Data > Dashboards
2. Click "Templates" button (top right)
3. Browse Preset and Custom templates

## Preset Templates (10 Available)

### 1. Sales Dashboard
Best for: Sales teams, e-commerce
Widgets: Revenue, orders, avg order value, sales trend, top products, sales funnel

### 2. Marketing Analytics
Best for: Marketing teams, campaigns
Widgets: Traffic, conversion rate, leads, traffic sources, campaign performance

### 3. Customer Insights
Best for: Customer success, CRM
Widgets: Total customers, retention rate, NPS score, customer growth, segments

### 4. Operations Monitor
Best for: Operations, logistics
Widgets: Pending orders, inventory, fulfillment rate, shipping status

### 5. Financial Summary
Best for: Finance teams, executives
Widgets: Revenue, expenses, net profit, P&L trend, expense breakdown

### 6. Web Analytics
Best for: Digital teams, websites
Widgets: Page views, visitors, bounce rate, session duration, top pages

### 7. Executive Summary
Best for: C-suite, board reporting
Widgets: Revenue scorecard, customer scorecard, MRR, churn rate, global map

### 8. Project Tracker
Best for: Project managers, PMO
Widgets: Active projects, tasks completed, overdue tasks, project progress

### 9. Support Dashboard
Best for: Customer support teams
Widgets: Open tickets, response time, CSAT score, ticket categories

### 10. Blank Canvas
Best for: Custom dashboards
Widgets: None - build from scratch

## Creating a Dashboard from Template

1. Click "Templates" button
2. Browse templates (use category filter)
3. Click on a template to preview
4. Click "Use Template"
5. Select your data source
6. Dashboard creates with template widgets
7. Customize as needed

## Creating Custom Templates

Save your dashboards as templates for reuse:

1. Build your dashboard
2. Click "Save as Template" button
3. Enter template name and description
4. Template appears in "My Templates" tab

## Managing Custom Templates

In Templates dialog:
- **Edit**: Pencil icon to rename/update description
- **Delete**: Trash icon to remove template
- Templates are private to your account

## Tips

- Start with a template close to your needs
- Customize colors to match your brand
- Save modified dashboards as new templates
- Share templates with team via export
        """
    },
    
    # OFFLINE COLLECTION
    "offline-collection": {
        "id": "offline-collection",
        "title": "Offline Data Collection",
        "category": "mobile",
        "summary": "Collect data without internet connection",
        "tags": ["offline", "mobile", "sync", "field"],
        "read_time": "8 min",
        "screenshot": "/dashboard",
        "content": """
# Offline Data Collection

DataPulse is built with offline-first architecture, allowing data collection without internet.

## How Offline Works

### Caching
- Forms are cached locally when you're online
- Media files are stored on device
- No internet needed for data entry

### Storage
- Submissions saved to browser/app storage
- Up to 10,000 submissions offline
- Media stored until sync

### Syncing
- Automatic sync when online
- Background sync enabled
- Conflict resolution built-in

## Checking Your Connection Status

Look at the indicator in the header:
- **Green dot** + "Online": Connected and synced
- **Yellow dot** + "Syncing": Uploading pending data
- **Red dot** + "Offline": No connection

## Collecting Data Offline

1. **While Online**: Open the forms you need
2. **Go Offline**: Forms remain accessible
3. **Collect Data**: Fill and submit forms normally
4. **Submissions Queue**: Data saved locally
5. **Reconnect**: Data syncs automatically

## Preparing for Offline Collection

Before going to the field:
1. Log into DataPulse
2. Open each form you'll need
3. Wait for "Cached" indicator
4. Verify forms load offline
5. Test a sample submission

## Viewing Pending Submissions

1. Look for sync indicator in header
2. Click to see pending count
3. View list of unsynced submissions
4. Individual sync if needed

## Force Sync

If data isn't syncing:
1. Go to Settings > Sync
2. Click "Force Sync"
3. Wait for completion
4. Check sync log for errors

## Troubleshooting Offline Issues

### Forms Not Available Offline
- Ensure you opened form while online
- Check if form is published
- Clear cache and re-cache forms

### Submissions Not Syncing
1. Check internet connection
2. Verify you're logged in
3. Check storage quota
4. Review error messages
5. Try force sync
6. Contact support if persists

### Storage Full
- Export and clear old drafts
- Sync pending submissions
- Check device storage

## Best Practices

1. **Pre-cache forms** before field work
2. **Regular sync** when connection available
3. **Monitor queue** size during collection
4. **Backup data** periodically
5. **Train team** on offline procedures
        """
    },
    
    # USER MANAGEMENT
    "user-management": {
        "id": "user-management",
        "title": "Managing Users and Roles",
        "category": "admin",
        "summary": "Add users, assign roles, and configure permissions",
        "tags": ["users", "roles", "permissions", "admin", "team"],
        "read_time": "10 min",
        "screenshot": "/user-management",
        "content": """
# Managing Users and Roles

User management controls who can access your organization and what they can do.

## Accessing User Management

Navigate to Settings > User Management

**Screenshot Reference**: Navigate to `/user-management` to see the users dashboard.

## User Roles

### Admin
- Full system access
- Manage users and roles
- Configure organization settings
- Access all data and features
- Cannot be deleted (at least one required)

### Manager
- Create and edit forms
- View all submissions
- Run reports and exports
- Cannot manage users or settings

### Enumerator (Field User)
- Submit data only
- View own submissions
- Cannot edit forms
- Cannot see others' data

### Viewer
- Read-only access
- View forms and submissions
- Run reports
- Cannot submit or edit data

## Adding a New User

1. Go to Settings > User Management
2. Click "Add User" button
3. Fill in details:
   - Email address (required)
   - Full name
   - Select role
   - Assign to projects (optional)
4. Click "Send Invitation"
5. User receives email invitation
6. User sets password and activates

## Editing a User

1. Find user in the list
2. Click "Edit" (pencil icon)
3. Modify:
   - Name
   - Role
   - Project assignments
   - Active/Inactive status
4. Click "Save"

## Deactivating a User

Instead of deleting, deactivate users to preserve data history:
1. Find user in list
2. Click "Deactivate"
3. Confirm action
4. User can no longer log in
5. Reactivate anytime if needed

## User Activity

View user activity from User Management:
- Last login time
- Submissions count
- Active sessions
- Login history

## Password Management

### Reset User Password
1. Find user in list
2. Click "Reset Password"
3. User receives reset email

### Password Policies
Configure in Settings > Security:
- Minimum length
- Complexity requirements
- Expiry period
- Failed attempt lockout

## Bulk Operations

For multiple users:
1. Select users with checkboxes
2. Choose action:
   - Bulk role change
   - Bulk deactivate
   - Export user list
3. Confirm action

## Best Practices

1. **Principle of least privilege**: Give minimum needed access
2. **Regular audits**: Review user list monthly
3. **Deactivate promptly**: Remove access when users leave
4. **Use projects**: Limit access to relevant projects only
5. **Monitor activity**: Check for unusual patterns
        """
    },
    
    # DATA EXPORT
    "data-export": {
        "id": "data-export",
        "title": "Exporting Your Data",
        "category": "data",
        "summary": "Export submissions to CSV, Excel, or JSON",
        "tags": ["export", "csv", "excel", "data", "download"],
        "read_time": "6 min",
        "screenshot": "/exports",
        "content": """
# Exporting Your Data

Export your collected data in various formats for analysis or reporting.

## Export Formats

### CSV (Comma-Separated Values)
- Universal format
- Opens in Excel, Google Sheets
- Best for data analysis

### Excel (.xlsx)
- Native Excel format
- Multiple sheets for repeat groups
- Formatted headers

### JSON
- Structured data format
- Best for developers
- Full metadata included

### SPSS (.sav)
- Statistical analysis software format
- Variable labels included
- Ready for analysis

## How to Export

### Quick Export
1. Go to Data > Submissions
2. Select a form
3. Click "Export" button
4. Choose format
5. Download starts immediately

### Advanced Export
1. Go to Data > Exports
2. Click "New Export"
3. Configure options:
   - Select form(s)
   - Choose format
   - Date range filter
   - Status filter
   - Field selection
   - Include/exclude options
4. Click "Generate Export"
5. Download when ready

## Export Options

### Field Selection
- Choose which fields to include
- Reorder fields
- Rename columns in export

### Filters
- **Date Range**: Submissions within dates
- **Status**: Draft, Pending, Approved, etc.
- **Enumerator**: By specific user
- **Custom**: Based on field values

### Include Options
- **Metadata**: Submission time, GPS, device info
- **Repeat Groups**: As separate sheets or rows
- **Media Files**: Download attachments
- **Audit Trail**: Edit history

## Scheduling Exports

Set up automatic exports:
1. Go to Data > Exports
2. Click "Schedule Export"
3. Configure:
   - Frequency (daily, weekly, monthly)
   - Format
   - Filters
   - Delivery (email or storage)
4. Activate schedule

## Tips

- Large exports may take time - wait for completion
- Use filters to reduce file size
- Check column headers match expected format
- Verify row count matches submission count
- Keep exports secure - contains sensitive data
        """
    },
    
    # QUALITY CHECKS
    "quality-checks": {
        "id": "quality-checks",
        "title": "Data Quality Monitoring",
        "category": "quality",
        "summary": "Use AI-powered quality checks to ensure data integrity",
        "tags": ["quality", "ai", "validation", "checks"],
        "read_time": "10 min",
        "screenshot": "/quality-ai",
        "content": """
# Data Quality Monitoring

Quality checks help ensure your collected data is accurate, complete, and consistent.

## Quality AI Features

Navigate to Quality & AI > Quality AI

**Screenshot Reference**: Navigate to `/quality-ai` to see the quality dashboard.

### Automated Checks

**Outlier Detection**
- Identifies values significantly different from normal
- Uses statistical methods (IQR, Z-score)
- Flags for manual review

**Duplicate Detection**
- Finds similar/identical submissions
- Configurable similarity threshold
- Merge or remove duplicates

**Completeness Check**
- Identifies missing required fields
- Calculates completion percentage
- Flags incomplete submissions

**Consistency Check**
- Cross-validates related fields
- Example: Age matches birth date
- Custom consistency rules

**Time Analysis**
- Flags unusually fast submissions
- Identifies suspiciously slow entries
- Configurable thresholds

## Running Quality Checks

1. Go to Quality AI page
2. Select form to analyze
3. Choose check types to run
4. Click "Run Analysis"
5. Review results

## Quality Dashboard

View overall quality metrics:
- Quality score (0-100%)
- Issues by category
- Trend over time
- Top issues to address

## Reviewing Flagged Items

1. View flagged submissions list
2. Click to open submission detail
3. Review the issue
4. Take action:
   - **Approve**: Issue is acceptable
   - **Reject**: Send for correction
   - **Edit**: Fix the issue
   - **Flag**: Mark for further review

## Custom Quality Rules

Create your own validation rules:
1. Go to Quality Settings
2. Click "Add Rule"
3. Configure:
   - Name and description
   - Condition (when to flag)
   - Severity (high/medium/low)
   - Action (flag, reject, alert)
4. Enable rule

Example rules:
- GPS must be within 5km of target location
- Interview duration > 5 minutes
- Photo must be landscape orientation

## Quality Reports

Generate quality reports:
1. Click "Generate Report"
2. Select date range
3. Choose metrics to include
4. Export as PDF or Excel

## Best Practices

1. Run quality checks daily during collection
2. Address high-severity issues immediately
3. Train team on common issues
4. Adjust thresholds based on context
5. Document quality decisions
6. Use back-checks for verification
        """
    },
    
    # REPORT BUILDER
    "report-builder": {
        "id": "report-builder",
        "title": "Creating Reports",
        "category": "dataviz",
        "summary": "Generate professional PDF reports from your data",
        "tags": ["reports", "pdf", "export", "presentation"],
        "read_time": "8 min",
        "screenshot": "/report-builder",
        "content": """
# Creating Reports

The Report Builder helps you create professional, publication-ready reports.

## Accessing Report Builder

Navigate to Data > Report Builder

**Screenshot Reference**: Navigate to `/report-builder` to see the builder.

## Creating a New Report

1. Click "New Report" or "Connect Data"
2. Select your data source:
   - Form submissions
   - Dataset
   - Multiple sources
3. Report builder opens with connected data

## Report Sections

### Title/Header
- Report title
- Subtitle/description
- Date and author
- Logo (optional)

### Summary Statistics
- Key metrics
- Auto-calculated from data
- Configurable cards

### Charts
- Insert any chart type
- Configure data series
- Customize appearance

### Tables
- Data tables
- Column selection
- Sorting and filtering

### Text Blocks
- Custom narrative text
- Markdown support
- Dynamic data insertion

### Images
- Upload images
- Screenshots
- Charts as images

## Building Your Report

### Step 1: Add Sections
1. Click "Add Section"
2. Choose section type
3. Configure content

### Step 2: Configure Data
1. Select data source for each element
2. Apply filters if needed
3. Set grouping/aggregation

### Step 3: Customize Layout
- Drag sections to reorder
- Adjust widths
- Set page breaks

### Step 4: Style
- Font selection
- Color scheme
- Spacing and margins

### Step 5: Preview
- Click "Preview"
- Check all pages
- Verify data accuracy

### Step 6: Export
- Click "Export PDF"
- Download starts
- Share with stakeholders

## Tips

- Keep reports focused on key insights
- Use visuals to support narrative
- Include data source and date
- Review for accuracy before sharing
- Save as template for recurring reports
        """
    },
    
    # CHARTS
    "chart-studio": {
        "id": "chart-studio",
        "title": "Creating Charts",
        "category": "dataviz",
        "summary": "Build visualizations with Chart Studio",
        "tags": ["charts", "visualization", "graphs", "analysis"],
        "read_time": "10 min",
        "screenshot": "/charts",
        "content": """
# Creating Charts

Chart Studio helps you visualize your data with interactive charts.

## Accessing Chart Studio

Navigate to Data > Charts

**Screenshot Reference**: Navigate to `/charts` to see the studio.

## Chart Types

### Bar Chart
Best for: Comparing categories
- Vertical or horizontal
- Grouped or stacked
- Multiple series

### Line Chart
Best for: Trends over time
- Single or multiple lines
- Area fill option
- Smooth or stepped

### Pie Chart
Best for: Proportions
- Standard or donut style
- Legend positioning
- Label options

### Area Chart
Best for: Cumulative values
- Stacked areas
- Gradient fill
- Multiple series

### Scatter Plot
Best for: Correlations
- X-Y plotting
- Trend lines
- Size encoding

## Creating a Chart

1. Click "Create Chart"
2. Select data source (form or dataset)
3. Choose chart type
4. Configure:
   - X-axis field
   - Y-axis field (numeric)
   - Group by (optional)
   - Filters
5. Customize appearance
6. Save chart

## Chart Configuration

### Data
- Select fields for axes
- Apply aggregations (sum, count, average)
- Filter data subset
- Sort order

### Appearance
- Colors and themes
- Labels and legends
- Grid lines
- Axis formatting

### Interactivity
- Hover tooltips
- Click actions
- Zoom and pan

## Saving and Sharing

- Save to your chart library
- Add to dashboards
- Export as image
- Share link

## Tips

- Choose chart type based on data
- Keep visualizations simple
- Use clear labels
- Consider color blindness
- Test with real data
        """
    },
    
    # GPS MAP
    "gps-map": {
        "id": "gps-map",
        "title": "GPS and Location Tracking",
        "category": "mobile",
        "summary": "Capture and visualize geographic data",
        "tags": ["gps", "location", "map", "coordinates"],
        "read_time": "7 min",
        "screenshot": "/map",
        "content": """
# GPS and Location Tracking

Capture precise location data with your submissions.

## Adding GPS to Forms

1. Open Form Builder
2. Drag "GPS" field to form
3. Configure options:
   - Auto-capture on load
   - Manual capture button
   - Accuracy threshold
   - Include altitude

## Capturing GPS

### Automatic Capture
- GPS captured when form opens
- Updates periodically
- Shows accuracy indicator

### Manual Capture
- Click location button
- Wait for accuracy
- Confirm capture

## Accuracy Levels

- **High (< 10m)**: GPS enabled, clear sky
- **Medium (10-50m)**: GPS enabled, some obstruction
- **Low (> 50m)**: Indoor or weak signal

## GPS Map View

Navigate to Quality & AI > GPS Map

### Features
- View all submissions on map
- Filter by form, date, enumerator
- Click markers for details
- Cluster view for many points
- Heatmap option

### Analysis
- Geographic coverage
- Identify gaps
- Verify locations
- Export coordinates

## Troubleshooting GPS

### GPS Not Working
1. Enable location services
2. Grant browser permission
3. Move to open area
4. Wait for signal

### Poor Accuracy
1. Move outdoors
2. Wait longer for fix
3. Avoid tall buildings
4. Check device GPS

### Indoor Collection
- Use Wi-Fi positioning
- Enter coordinates manually
- Use address field instead

## Best Practices

1. Capture GPS outdoors when possible
2. Wait for good accuracy
3. Verify unusual locations
4. Use GPS map for QC
5. Document location requirements
        """
    },
    
    # CATI/CAWI
    "cati-cawi": {
        "id": "cati-cawi",
        "title": "CATI and CAWI Surveys",
        "category": "forms",
        "summary": "Telephone and web interviewing guide",
        "tags": ["cati", "cawi", "phone", "web", "survey"],
        "read_time": "8 min",
        "screenshot": "/cati",
        "content": """
# CATI and CAWI Surveys

DataPulse supports both telephone (CATI) and web (CAWI) survey methods.

## CATI - Computer-Assisted Telephone Interviewing

Navigate to Field Ops > CATI Center

### Setup
1. Create survey form
2. Import contact list (CSV)
3. Configure call schedule
4. Assign interviewers

### Contact List Import
CSV format required:
- Phone number (required)
- Name
- Additional fields for preload

### Call Management
- View call queue
- Make/receive calls
- Log call outcomes:
  - Complete
  - No answer
  - Busy
  - Refused
  - Callback

### Call Scheduling
- Set calling windows
- Automatic callback scheduling
- Time zone support
- Maximum attempts

## CAWI - Computer-Assisted Web Interviewing

Navigate to Field Ops > Token Surveys

### Setup
1. Create survey form
2. Enable CAWI mode
3. Generate survey tokens/links
4. Distribute to respondents

### Token Generation
- Unique link per respondent
- Bulk token generation
- CSV export for distribution

### Distribution
- Email via DataPulse
- Export for external sending
- SMS distribution

### Tracking
- Response rates
- Completion status
- Time to complete
- Drop-off analysis

## Mixed-Mode Surveys

Combine CATI and CAWI:
1. Start with web invitations
2. Follow up non-responders by phone
3. Unified data collection
4. Single dataset

## Tips

- Test surveys thoroughly before launch
- Train interviewers on scripts
- Monitor completion rates
- Follow up promptly
- Analyze mode effects
        """
    },
    
    # CASE MANAGEMENT
    "case-management": {
        "id": "case-management",
        "title": "Case Management",
        "category": "data",
        "summary": "Track survey cases through workflows",
        "tags": ["cases", "workflow", "tracking", "management"],
        "read_time": "8 min",
        "screenshot": "/cases",
        "content": """
# Case Management

Manage pre-loaded cases and track them through collection workflows.

## Cases vs Submissions

**Cases**: Pre-loaded records to be surveyed
- Household list
- Customer database
- Sample frame

**Submissions**: Completed responses linked to cases

## Importing Cases

Navigate to Data > Import Cases

### Step-by-Step
1. Prepare CSV file with case data
2. Click "Import Cases"
3. Upload CSV file
4. Map columns:
   - Case ID (unique identifier)
   - Name/Label fields
   - Preload data fields
5. Validate import
6. Confirm and import

### CSV Format
- First row: Column headers
- Unique ID column required
- UTF-8 encoding recommended

## Case List View

Navigate to Data > Cases

### Features
- View all cases
- Filter by status
- Search by ID or name
- Assign to enumerators
- Track completion

## Case Statuses

- **Not Started**: No submission yet
- **In Progress**: Draft saved
- **Complete**: Submission received
- **Verified**: Passed quality checks
- **Closed**: Case finalized

## Case Workflows

Navigate to Apps > Workflows

### Creating a Workflow
1. Click "New Workflow"
2. Define stages:
   - Initial contact
   - Interview scheduled
   - Interview complete
   - Quality review
   - Closed
3. Set transition rules
4. Assign users to stages

### Using Workflows
- Cases move through stages
- Track progress dashboard
- Automatic notifications
- Due date tracking

## Case Assignment

### Manual Assignment
1. Select cases
2. Click "Assign"
3. Choose enumerator
4. Confirm

### Auto-Assignment
- Rule-based assignment
- Geographic distribution
- Workload balancing

## Reporting

- Completion rates
- Stage distribution
- Assignment coverage
- Time in each stage
        """
    },
    
    # DATASETS
    "datasets": {
        "id": "datasets",
        "title": "Working with Datasets",
        "category": "data",
        "summary": "Create and manage structured data tables",
        "tags": ["datasets", "tables", "data", "import"],
        "read_time": "6 min",
        "screenshot": "/datasets",
        "content": """
# Working with Datasets

Datasets are structured data tables separate from form submissions.

## Use Cases

- Reference data (lookup tables)
- Sample frames
- Imported external data
- Aggregated data
- Analysis outputs

## Creating a Dataset

Navigate to Data > Datasets

### From CSV Import
1. Click "New Dataset"
2. Choose "Import CSV"
3. Upload file
4. Map columns and data types
5. Validate and import

### Manual Creation
1. Click "New Dataset"
2. Choose "Create Empty"
3. Define columns:
   - Name
   - Data type (text, number, date, etc.)
   - Required/optional
4. Add rows manually

## Editing Data

- Click cell to edit
- Bulk paste from Excel
- Add/remove rows
- Add/remove columns
- Sort and filter

## Data Types

- **Text**: Any text value
- **Number**: Integer or decimal
- **Date**: Date values
- **Boolean**: True/false
- **Select**: Predefined options

## Using Datasets

### In Forms (Preload)
- Link dataset to form
- Pre-fill fields from dataset
- Reference lookups

### In Visualizations
- Data source for charts
- Dashboard widgets
- Report Builder

### In API
- Query via REST API
- External integrations

## Data Transform

Navigate to Datasets > Transform

Apply transformations:
- Filter rows
- Calculate new columns
- Merge datasets
- Aggregate data
- Export results
        """
    },
    
    # WORKFLOWS
    "workflows": {
        "id": "workflows",
        "title": "Setting Up Workflows",
        "category": "admin",
        "summary": "Automate processes with custom workflows",
        "tags": ["workflows", "automation", "process", "stages"],
        "read_time": "8 min",
        "screenshot": "/workflows",
        "content": """
# Setting Up Workflows

Workflows automate multi-stage processes in DataPulse.

## Accessing Workflows

Navigate to Apps > Workflows

## Workflow Components

### Stages
Sequential steps in a process:
- Initial
- In Progress
- Review
- Approved
- Completed

### Transitions
Rules for moving between stages:
- Manual: User clicks to advance
- Automatic: Based on conditions
- Approval: Requires approval

### Actions
What happens at each stage:
- Send notification
- Assign to user
- Update field
- Trigger API

## Creating a Workflow

1. Click "New Workflow"
2. Name your workflow
3. Add stages:
   - Click "Add Stage"
   - Name and configure
   - Set permissions
4. Define transitions:
   - Connect stages
   - Set conditions
   - Add actions
5. Activate workflow

## Example: Submission Review Workflow

1. **Submitted**: New submission arrives
   - Transition: Automatic to "Pending Review"
   - Action: Notify reviewers

2. **Pending Review**: Awaiting review
   - Transition: Manual by reviewer
   - Options: Approve or Reject

3. **Approved**: Passed review
   - Transition: Automatic to "Complete"
   - Action: Update status field

4. **Rejected**: Failed review
   - Transition: Back to submitter
   - Action: Send rejection notification

5. **Complete**: Process finished

## Monitoring Workflows

- View items in each stage
- Track time in stage
- Identify bottlenecks
- View history/audit trail

## Best Practices

1. Keep workflows simple
2. Clear stage names
3. Define responsibilities
4. Test before activating
5. Document process
        """
    },
    
    # SECURITY
    "security": {
        "id": "security",
        "title": "Security Best Practices",
        "category": "admin",
        "summary": "Keep your organization and data secure",
        "tags": ["security", "passwords", "permissions", "privacy"],
        "read_time": "8 min",
        "screenshot": "/security",
        "content": """
# Security Best Practices

Protect your organization's data with these security practices.

## Password Security

### Strong Passwords
- Minimum 8 characters
- Mix of uppercase/lowercase
- Include numbers
- Include special characters
- No dictionary words

### Password Policies
Configure in Settings > Security:
- Minimum length
- Complexity requirements
- Expiry period (e.g., 90 days)
- History (prevent reuse)
- Lockout after failed attempts

## User Access

### Principle of Least Privilege
- Give minimum access needed
- Use roles appropriately
- Limit admin accounts

### Regular Audits
- Review user list monthly
- Remove inactive users
- Verify access levels
- Check activity logs

### Prompt Deactivation
- Deactivate when users leave
- Don't delete (preserve audit)
- Transfer ownership of items

## Data Protection

### Encryption
- Data encrypted in transit (HTTPS)
- Data encrypted at rest
- Media files encrypted

### Backups
- Automatic daily backups
- Export data regularly
- Store exports securely

### Data Retention
- Define retention periods
- Delete old data per policy
- Document retention rules

## API Security

Navigate to Settings > API Security

### API Keys
- Generate unique keys
- Set expiry dates
- Limit permissions
- Monitor usage

### Best Practices
- Never share keys
- Rotate keys regularly
- Use environment variables
- Monitor for abuse

## Session Management

- Session timeout after inactivity
- Force logout capability
- View active sessions
- Revoke sessions remotely

## Audit Logging

All actions are logged:
- Login/logout events
- Data changes
- Permission changes
- Export activities

Review logs in Settings > Audit Log.

## Two-Factor Authentication (2FA)

When available:
- Enable for all users
- Use authenticator app
- Backup codes for recovery

## Incident Response

If you suspect a breach:
1. Contact support immediately
2. Review audit logs
3. Deactivate affected accounts
4. Change API keys
5. Notify stakeholders
6. Document incident
        """
    },
    
    # TRANSLATIONS
    "translations": {
        "id": "translations",
        "title": "Multi-Language Support",
        "category": "admin",
        "summary": "Configure forms in multiple languages",
        "tags": ["translations", "languages", "localization", "multi-language"],
        "read_time": "6 min",
        "screenshot": "/translations",
        "content": """
# Multi-Language Support

DataPulse supports data collection in multiple languages.

## Supported Languages

Default languages:
- English (en)
- Swahili (sw)

Additional languages can be configured.

## Form Translations

### Adding Translations
1. Open Form Builder
2. Click "Translations" tab
3. Select target language
4. For each field:
   - Translate label
   - Translate hint
   - Translate options

### Translation Interface
- Side-by-side view
- Original | Translation
- Missing translations highlighted
- Progress indicator

## Language Selection

### Data Collection
- Language selector in form
- Enumerator selects language
- Submissions include language used

### User Interface
- User profile setting
- Affects all UI labels
- Persists across sessions

## Best Practices

1. **Professional Translation**
   - Use native speakers
   - Review for context
   - Test with users

2. **Consistent Terminology**
   - Create glossary
   - Maintain consistency
   - Document choices

3. **Testing**
   - Test all languages
   - Check text fitting
   - Verify option translation

## Import/Export Translations

### Export
1. Click "Export Translations"
2. Get XLSX file with all strings
3. Share with translators

### Import
1. Complete translation in XLSX
2. Click "Import Translations"
3. Upload completed file
4. Review and confirm
        """
    },
    
    # MEDIA CAPTURE
    "media-capture": {
        "id": "media-capture",
        "title": "Media Capture Guide",
        "category": "mobile",
        "summary": "Capture photos, audio, and video in your forms",
        "tags": ["photo", "audio", "video", "media", "capture"],
        "read_time": "7 min",
        "screenshot": "/forms",
        "content": """
# Media Capture Guide

Capture rich media with your form submissions.

## Photo Capture

### Configuration
In Form Builder, add Photo field:
- Maximum file size: 10MB
- Formats: JPG, PNG
- Source: Camera or Gallery
- Compression: Auto or manual

### Capturing Photos
1. Tap photo field
2. Choose Camera or Gallery
3. Take/select photo
4. Crop if needed
5. Confirm selection

### Photo Tips
- Ensure good lighting
- Hold device steady
- Frame subject properly
- Check preview before confirming

## Audio Recording

### Configuration
Add Audio field:
- Maximum duration: 5 minutes
- Format: MP3
- Quality: Standard/High

### Recording Audio
1. Tap record button
2. Speak clearly
3. Monitor duration
4. Tap stop
5. Review playback
6. Re-record if needed

### Audio Tips
- Minimize background noise
- Speak at consistent volume
- Hold device close
- Test playback before submitting

## Video Recording

### Configuration
Add Video field:
- Maximum duration: 2 minutes
- Maximum size: 50MB
- Format: MP4
- Resolution: 480p/720p/1080p

### Recording Video
1. Tap video field
2. Start recording
3. Monitor timer
4. Stop recording
5. Review video
6. Confirm or re-record

### Video Tips
- Stabilize device
- Ensure good lighting
- Mind background noise
- Check framing

## Storage and Sync

### Offline Storage
- Media stored locally
- Syncs when online
- Monitor storage space

### Compression
- Auto-compression available
- Reduces file size
- Minimal quality loss

### Sync Priority
- Submissions sync first
- Media syncs in background
- Check upload progress

## Troubleshooting

### Camera Not Working
- Grant camera permission
- Check if camera used by other app
- Restart device

### File Too Large
- Enable compression
- Use lower resolution
- Reduce duration

### Upload Failing
- Check internet connection
- Verify storage quota
- Try force sync
        """
    },
    
    # CALCULATED FIELDS
    "calculated-fields": {
        "id": "calculated-fields",
        "title": "Using Calculated Fields",
        "category": "forms",
        "summary": "Create auto-computed values in your forms",
        "tags": ["calculated", "formula", "compute", "fields"],
        "read_time": "8 min",
        "screenshot": "/forms",
        "content": """
# Using Calculated Fields

Calculated fields automatically compute values based on other fields.

## Adding Calculated Fields

1. Open Form Builder
2. Drag "Calculated" field to form
3. Configure formula
4. Set display options

## Formula Types

### Basic Math
- Addition: `{field1} + {field2}`
- Subtraction: `{field1} - {field2}`
- Multiplication: `{field1} * {field2}`
- Division: `{field1} / {field2}`

### Aggregations
- Sum: `SUM({field1}, {field2}, {field3})`
- Average: `AVG({field1}, {field2})`
- Count: `COUNT({field1})`
- Min/Max: `MIN({field1}, {field2})`

### Conditional
- If/Else: `{field1} > 18 ? "Adult" : "Minor"`
- Nested: `{field1} > 100 ? "High" : {field1} > 50 ? "Medium" : "Low"`

### Text
- Concatenate: `{firstName} + " " + {lastName}`
- Uppercase: `UPPER({field1})`
- Lowercase: `LOWER({field1})`

### Date
- Age: `YEARS_BETWEEN({birthDate}, TODAY())`
- Days: `DAYS_BETWEEN({startDate}, {endDate})`

## Examples

### Calculate BMI
```
{weight} / ({height} / 100) ^ 2
```

### Age Category
```
{age} < 18 ? "Minor" : {age} < 65 ? "Adult" : "Senior"
```

### Total Score
```
SUM({q1Score}, {q2Score}, {q3Score}, {q4Score})
```

### Full Name
```
{firstName} + " " + {lastName}
```

## Display Options

- Show/hide field
- Format (number, currency, percent)
- Decimal places
- Read-only (recommended)

## Tips

1. Test formulas with sample data
2. Handle null/empty values
3. Use clear field references
4. Document complex formulas
5. Consider display format
        """
    },
    
    # PLUGINS
    "plugins": {
        "id": "plugins",
        "title": "Working with Plugins",
        "category": "admin",
        "summary": "Extend DataPulse with plugins and integrations",
        "tags": ["plugins", "extensions", "integrations", "api"],
        "read_time": "6 min",
        "screenshot": "/plugins",
        "content": """
# Working with Plugins

Extend DataPulse functionality with plugins.

## Accessing Plugins

Navigate to Apps > Plugins

## Available Plugin Types

### Data Connectors
- Import from external databases
- Export to BI tools
- Real-time sync

### Custom Fields
- Specialized field types
- Third-party widgets
- Custom validation

### Notifications
- SMS providers
- Slack integration
- Email services

### Analytics
- Advanced visualizations
- Machine learning
- Custom reports

## Installing Plugins

1. Go to Apps > Plugins
2. Browse available plugins
3. Click "Install"
4. Configure settings
5. Activate plugin

## Plugin Configuration

Each plugin has settings:
- API keys
- Connection details
- Sync options
- Permissions

## Managing Plugins

- View installed plugins
- Update to latest version
- Disable/enable
- Uninstall

## Building Custom Plugins

For developers:
- Plugin SDK available
- REST API documentation
- Webhook support
- Custom event handlers

Contact support for plugin development guidance.
        """
    },
    
    # API
    "api-documentation": {
        "id": "api-documentation",
        "title": "API Reference",
        "category": "integrations",
        "summary": "Access DataPulse via REST API",
        "tags": ["api", "rest", "developers", "integration"],
        "read_time": "10 min",
        "screenshot": "/security",
        "content": """
# API Reference

Access DataPulse data and features programmatically.

## Getting Started

### API Base URL
```
https://subscription-hub-89.preview.emergentagent.com/api
```

### Authentication
Use Bearer token authentication:
```
Authorization: Bearer YOUR_API_KEY
```

### Getting an API Key
1. Go to Settings > API Security
2. Click "Generate API Key"
3. Copy and store securely

## Endpoints

### Authentication
```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "access_token": "...", "user": {...} }
```

### Forms
```
GET /api/forms              # List forms
GET /api/forms/{id}         # Get form details
POST /api/forms             # Create form
PUT /api/forms/{id}         # Update form
DELETE /api/forms/{id}      # Delete form
```

### Submissions
```
GET /api/submissions                    # List submissions
GET /api/submissions?form_id={id}      # Filter by form
POST /api/submissions                   # Create submission
PUT /api/submissions/{id}               # Update submission
DELETE /api/submissions/{id}            # Delete submission
```

### Users
```
GET /api/users              # List users (admin only)
GET /api/users/{id}         # Get user details
POST /api/users             # Create user
PUT /api/users/{id}         # Update user
```

### Data Sources
```
GET /api/data-sources       # List all data sources
GET /api/data-sources/{id}  # Get data from source
```

## Response Format

All responses are JSON:
```json
{
  "data": {...},
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

## Error Handling

Errors return appropriate HTTP codes:
- 400: Bad request
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Server error

Error response format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Rate Limits

- 1000 requests per minute per API key
- 429 status code when exceeded
- Retry-After header indicates wait time

## Best Practices

1. Store API key securely
2. Use environment variables
3. Handle rate limits gracefully
4. Cache responses when appropriate
5. Use pagination for large datasets
        """
    }
}

# =============================================================================
# COMPREHENSIVE TROUBLESHOOTING GUIDES
# =============================================================================

TROUBLESHOOTING_GUIDES = [
    {
        "id": "sync-issues",
        "title": "Data Not Syncing",
        "icon": "AlertCircle",
        "severity": "high",
        "steps": [
            "Check internet connection - look for green indicator in header",
            "Verify you're logged in - try refreshing the page",
            "Check sync queue - click the sync icon to see pending items",
            "Go to Settings > Sync > Force Sync",
            "Check if browser storage quota is exceeded",
            "Clear browser cache (Ctrl+Shift+Delete) and retry",
            "Try a different browser",
            "Check if firewall is blocking connections",
            "Contact support if issue persists"
        ],
        "common_causes": [
            "Intermittent internet connection",
            "Session expired - need to re-login",
            "Browser storage full",
            "Corporate firewall blocking"
        ]
    },
    {
        "id": "form-errors",
        "title": "Form Submission Errors",
        "icon": "FileText",
        "severity": "high",
        "steps": [
            "Check all required fields are filled (marked with *)",
            "Verify field validation requirements (min/max values, format)",
            "Ensure GPS is enabled if location is required",
            "Check file sizes for media (photo 10MB, video 50MB max)",
            "Try saving as draft first, then submit",
            "Check internet connection before submitting",
            "Review error message for specific field",
            "Refresh the form and try again",
            "Try different browser or device"
        ],
        "common_causes": [
            "Missing required fields",
            "Validation errors (invalid format, out of range)",
            "Media file too large",
            "Network timeout during submission"
        ]
    },
    {
        "id": "login-issues",
        "title": "Cannot Log In",
        "icon": "Shield",
        "severity": "medium",
        "steps": [
            "Verify email address is correct",
            "Check password - consider caps lock",
            "Use 'Forgot Password' to reset password",
            "Clear browser cookies and cache",
            "Try incognito/private browsing mode",
            "Check if account is locked (contact admin)",
            "Ensure browser allows cookies",
            "Try different browser",
            "Check if SSO is required for your organization"
        ],
        "common_causes": [
            "Incorrect password",
            "Caps lock enabled",
            "Account locked after failed attempts",
            "Session cookie issues"
        ]
    },
    {
        "id": "gps-issues",
        "title": "GPS Not Working",
        "icon": "MapPin",
        "severity": "medium",
        "steps": [
            "Enable location services in device settings",
            "Grant location permission to browser",
            "Move outdoors for better signal",
            "Wait 30-60 seconds for GPS fix",
            "Avoid tall buildings and heavy cover",
            "Refresh the page and try again",
            "Check if GPS works in other apps",
            "Try manual coordinate entry if available",
            "Restart device if GPS completely non-functional"
        ],
        "common_causes": [
            "Location services disabled",
            "Permission not granted",
            "Indoor location (weak signal)",
            "Device GPS hardware issue"
        ]
    },
    {
        "id": "media-upload",
        "title": "Media Upload Failing",
        "icon": "Image",
        "severity": "medium",
        "steps": [
            "Check file size (photo 10MB, video 50MB max)",
            "Verify file format is supported (JPG, PNG, MP4)",
            "Enable compression in settings",
            "Check internet connection stability",
            "Try capturing with lower resolution",
            "Clear app cache and retry",
            "Check device storage space",
            "Try force sync after upload fails",
            "Upload files one at a time"
        ],
        "common_causes": [
            "File too large",
            "Unsupported format",
            "Network interrupted during upload",
            "Storage quota exceeded"
        ]
    },
    {
        "id": "submission-missing",
        "title": "Submissions Missing or Not Showing",
        "icon": "FileQuestion",
        "severity": "high",
        "steps": [
            "Check date range filter - expand range",
            "Check status filter - include all statuses",
            "Verify correct form selected",
            "Check project filter if multi-project",
            "Look in Draft status for unsaved submissions",
            "Check sync status for pending uploads",
            "Verify user permissions to view submissions",
            "Check if submissions are in another project",
            "Contact admin if submissions confirmed lost"
        ],
        "common_causes": [
            "Date filter too narrow",
            "Wrong form selected",
            "Submissions still in sync queue",
            "Insufficient permissions"
        ]
    },
    {
        "id": "export-failing",
        "title": "Export Not Working",
        "icon": "Download",
        "severity": "medium",
        "steps": [
            "Check export permissions for your role",
            "Verify data exists for selected date range",
            "Try smaller date range for large datasets",
            "Check browser popup blocker settings",
            "Try different export format (CSV vs Excel)",
            "Clear browser cache and retry",
            "Wait longer for large exports to process",
            "Check network connection",
            "Try from different browser"
        ],
        "common_causes": [
            "No data matches filters",
            "Large dataset timeout",
            "Popup blocker preventing download",
            "Browser compatibility issue"
        ]
    },
    {
        "id": "dashboard-issues",
        "title": "Dashboard Not Showing Data",
        "icon": "LayoutDashboard",
        "severity": "medium",
        "steps": [
            "Verify data source is connected to dashboard",
            "Check date range filter on dashboard",
            "Refresh the page (Ctrl+F5 for hard refresh)",
            "Verify permissions to view data source",
            "Check if data exists in connected source",
            "Re-connect data source if needed",
            "Clear browser cache",
            "Check for JavaScript errors in browser console"
        ],
        "common_causes": [
            "Data source not connected",
            "Date filter excludes all data",
            "Permissions issue",
            "Data source empty"
        ]
    },
    {
        "id": "performance-slow",
        "title": "Application Running Slow",
        "icon": "Clock",
        "severity": "low",
        "steps": [
            "Clear browser cache and cookies",
            "Close unnecessary browser tabs",
            "Check internet connection speed",
            "Try different browser (Chrome recommended)",
            "Disable browser extensions temporarily",
            "Update browser to latest version",
            "Check if issue is page-specific",
            "Try during off-peak hours",
            "Report persistent issues to support"
        ],
        "common_causes": [
            "Browser cache bloated",
            "Slow internet connection",
            "Browser extensions interfering",
            "Outdated browser version"
        ]
    },
    {
        "id": "form-builder-issues",
        "title": "Form Builder Problems",
        "icon": "Wrench",
        "severity": "medium",
        "steps": [
            "Save your work frequently (Ctrl+S)",
            "Refresh page if builder becomes unresponsive",
            "Check for unsaved changes warning",
            "Try different browser if drag-drop not working",
            "Disable browser extensions",
            "Clear browser cache",
            "Check if another user is editing same form",
            "Export form as backup before major changes"
        ],
        "common_causes": [
            "Browser compatibility",
            "Session timeout",
            "Concurrent editing conflict",
            "Browser extensions interfering"
        ]
    }
]

# =============================================================================
# FAQ DATA
# =============================================================================

FAQ_DATA = [
    {
        "question": "How do I create a new form?",
        "answer": "Navigate to Projects > Forms, click 'New Form' button. Use the drag-and-drop builder to add fields, configure properties, preview, and then publish when ready. See the Form Builder Guide for detailed instructions.",
        "category": "forms"
    },
    {
        "question": "Can I collect data offline?",
        "answer": "Yes! DataPulse is built with offline-first architecture. Forms are cached locally, submissions are stored on device, and everything syncs automatically when internet is available. Look for the connection indicator in the header.",
        "category": "mobile"
    },
    {
        "question": "How do I add skip logic to my form?",
        "answer": "In the Form Builder, click on the field you want to conditionally show, go to the 'Logic' tab in properties, and add conditions. For example: Show 'Specify Other' when 'Other' is selected. Multiple conditions can be combined with AND/OR.",
        "category": "forms"
    },
    {
        "question": "How do I export my data?",
        "answer": "Go to Data > Exports or Data > Submissions and click 'Export'. Choose format (CSV, Excel, JSON, SPSS), select fields to include, apply filters if needed, and download. Large exports may take a few minutes to process.",
        "category": "data"
    },
    {
        "question": "How do I create a dashboard?",
        "answer": "Go to Data > Dashboards, click 'New Dashboard'. Choose from 10 preset templates (Sales, Marketing, etc.) or start blank. Add widgets, connect your data source, customize appearance, and save. Dashboards auto-save as you work.",
        "category": "dataviz"
    },
    {
        "question": "How do I add team members?",
        "answer": "Go to Settings > User Management, click 'Add User'. Enter their email, select a role (Admin, Manager, Enumerator, Viewer), optionally assign to specific projects, and send invitation. They'll receive an email to set their password.",
        "category": "admin"
    },
    {
        "question": "What is Quality AI?",
        "answer": "Quality AI automatically checks your data for anomalies, duplicates, and quality issues using machine learning. It detects outliers, incomplete submissions, consistency errors, and suspicious patterns. Run checks from Quality & AI > Quality AI.",
        "category": "quality"
    },
    {
        "question": "How do dashboard templates work?",
        "answer": "Templates are pre-configured dashboard layouts with appropriate widgets. Click Templates when creating a dashboard, choose one matching your needs (Sales, Marketing, etc.), connect your data source, and customize. You can also save your own dashboards as templates.",
        "category": "dataviz"
    },
    {
        "question": "What's the maximum file size for uploads?",
        "answer": "Photos: 10MB (JPG, PNG). Audio: 5 minutes duration (MP3). Video: 50MB or 2 minutes (MP4). Enable compression in settings to reduce file sizes. Large files may take longer to sync.",
        "category": "mobile"
    },
    {
        "question": "How do I reset my password?",
        "answer": "On the login page, click 'Forgot Password', enter your email, and follow the reset link sent to you. If you don't receive the email, check spam folder or contact your admin to reset it manually.",
        "category": "admin"
    },
    {
        "question": "Can I use DataPulse in multiple languages?",
        "answer": "Yes! DataPulse supports multiple languages. Forms can be translated via the Translations tab in Form Builder. Users can select their preferred language. English and Swahili are built-in; additional languages can be configured.",
        "category": "admin"
    },
    {
        "question": "How accurate is GPS capture?",
        "answer": "GPS accuracy depends on conditions. Outdoors with clear sky: <10 meters. Urban areas: 10-50 meters. Indoors: may be inaccurate or unavailable. Wait for accuracy indicator to improve before confirming capture.",
        "category": "mobile"
    },
    {
        "question": "How do I set up CATI (phone surveys)?",
        "answer": "Go to Field Ops > CATI Center. Create your survey form, import contact list (CSV with phone numbers), configure call scheduling, assign interviewers, and start calling. Track outcomes and schedule callbacks.",
        "category": "forms"
    },
    {
        "question": "What's the difference between cases and submissions?",
        "answer": "Cases are pre-loaded records to be surveyed (e.g., household list, sample frame). Submissions are the completed survey responses. Import cases from CSV, then link submissions to cases during data collection.",
        "category": "data"
    },
    {
        "question": "How do I generate reports?",
        "answer": "Go to Data > Report Builder, click 'Connect Data' to select your source, add sections (statistics, charts, tables, text), customize the layout and styling, preview, and export as PDF. Save as template for recurring reports.",
        "category": "dataviz"
    },
    {
        "question": "How do I access the API?",
        "answer": "Go to Settings > API Security to generate an API key. Use Bearer token authentication with the base URL. Documentation is available at /api/docs. Common endpoints: /api/forms, /api/submissions, /api/data-sources.",
        "category": "integrations"
    },
    {
        "question": "What happens if I lose internet during submission?",
        "answer": "Your submission is saved locally and queued for sync. When internet returns, it syncs automatically. Check the sync indicator in the header to see pending submissions. You can also force sync from Settings > Sync.",
        "category": "mobile"
    },
    {
        "question": "How do I configure workflows?",
        "answer": "Go to Apps > Workflows, create stages (e.g., Submitted, In Review, Approved), define transitions between stages, set conditions and actions, assign users to stages, and activate. Track items through the workflow dashboard.",
        "category": "admin"
    },
    {
        "question": "Can I import existing data?",
        "answer": "Yes! Import cases/contacts via Data > Import Cases (CSV). Import datasets via Data > Datasets > Import. For form submissions, use the API. Preload data can be imported via Field Ops > Preload/Writeback.",
        "category": "data"
    },
    {
        "question": "How secure is my data?",
        "answer": "DataPulse uses encryption in transit (HTTPS) and at rest. Strong password policies can be configured. All actions are logged in audit trail. API keys can be scoped and expired. Regular backups are maintained.",
        "category": "admin"
    }
]

# =============================================================================
# API ROUTES
# =============================================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest, req: Request):
    """Chat with the AI Help Assistant - GPT-4o powered with persistent sessions"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Get database connection
        db = get_db(req)
        
        # Generate or use existing session ID
        session_id = request.session_id or str(uuid.uuid4())
        
        # Retrieve chat history from database if session exists
        chat_history = await get_chat_history(db, session_id, limit=10)
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=f"""You are the DataPulse AI Assistant - an expert guide for the DataPulse enterprise data collection platform.

{HELP_CENTER_CONTEXT}

Guidelines:
- Give direct, actionable answers
- Use bullet points and numbered lists for clarity
- Reference specific navigation paths (e.g., "Go to Settings > User Management")
- Suggest relevant help articles when appropriate
- Keep responses helpful but concise
- If you're not sure about something specific to their account, suggest contacting support@datapulse.io
- Be friendly and professional
"""
        )
        
        chat.with_model("openai", "gpt-4o")
        
        # Load persisted chat history into LLM context
        if chat_history:
            for msg in chat_history[-5:]:
                if msg.get("role") == "user":
                    await chat.send_message(UserMessage(text=msg.get("content", "")))
        # Also include any conversation history from request (for backwards compatibility)
        elif request.conversation_history:
            for msg in request.conversation_history[-5:]:
                if msg.get("role") == "user":
                    await chat.send_message(UserMessage(text=msg.get("content", "")))
        
        user_msg = UserMessage(text=request.message)
        response = await chat.send_message(user_msg)
        
        # Persist the conversation to database
        await create_or_update_chat_session(
            db=db,
            session_id=session_id,
            user_message=request.message,
            assistant_response=response,
            user_id=None  # Could be extracted from auth token if available
        )
        
        return ChatResponse(response=response, session_id=session_id)
        
    except ImportError:
        return ChatResponse(
            response="I'm sorry, the AI assistant is temporarily unavailable. Please browse the Help Center articles or contact support@datapulse.io for assistance.",
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
    articles = []
    
    for article_id, article in HELP_ARTICLES.items():
        articles.append({
            "id": article["id"],
            "title": article["title"],
            "category": article["category"],
            "summary": article["summary"],
            "tags": article["tags"],
            "read_time": article.get("read_time", "5 min"),
            "screenshot": article.get("screenshot", None)
        })
    
    if category:
        articles = [a for a in articles if a["category"] == category]
    
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
    article = HELP_ARTICLES.get(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Map screenshot paths to actual image URLs
    screenshot_mapping = {
        "/dashboard": "/help-screenshots/dashboard.jpeg",
        "/forms": "/help-screenshots/forms.jpeg",
        "/dashboards": "/help-screenshots/dashboards.jpeg",
        "/charts": "/help-screenshots/charts.jpeg",
        "/user-management": "/help-screenshots/user-management.jpeg",
        "/help-center": "/help-screenshots/help-center.jpeg",
    }
    
    # Create response with screenshot URL
    result = {**article}
    if article.get("screenshot"):
        screenshot_path = article["screenshot"]
        result["screenshot_url"] = screenshot_mapping.get(screenshot_path)
    
    return result


@router.get("/categories")
async def get_categories():
    """Get all help article categories"""
    return {
        "categories": [
            {"id": "basics", "name": "Getting Started", "icon": "BookOpen", "description": "Learn the fundamentals"},
            {"id": "forms", "name": "Forms & Builder", "icon": "FileText", "description": "Create data collection forms"},
            {"id": "dataviz", "name": "DataViz Studio", "icon": "BarChart", "description": "Charts, dashboards, reports"},
            {"id": "data", "name": "Data Management", "icon": "Database", "description": "Import, export, transform"},
            {"id": "mobile", "name": "Mobile & Offline", "icon": "Smartphone", "description": "Field data collection"},
            {"id": "admin", "name": "Administration", "icon": "Settings", "description": "Users, roles, settings"},
            {"id": "quality", "name": "Quality Control", "icon": "Shield", "description": "Data quality and validation"},
            {"id": "integrations", "name": "Integrations", "icon": "Plug", "description": "API and external systems"}
        ]
    }


@router.get("/troubleshooting")
async def get_troubleshooting_guides():
    """Get all troubleshooting guides"""
    return {"guides": TROUBLESHOOTING_GUIDES}


@router.get("/troubleshooting/{guide_id}")
async def get_troubleshooting_guide(guide_id: str):
    """Get a specific troubleshooting guide"""
    guide = next((g for g in TROUBLESHOOTING_GUIDES if g["id"] == guide_id), None)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    return guide


@router.get("/faq")
async def get_faq():
    """Get all FAQ items"""
    return {"faq": FAQ_DATA}


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


@router.get("/chat/sessions/{session_id}")
async def get_session_history(session_id: str, request: Request):
    """Get chat history for a specific session"""
    db = get_db(request)
    
    session = await get_chat_session(db, session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session["session_id"],
        "messages": session.get("messages", []),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at")
    }


@router.delete("/chat/sessions/{session_id}")
async def clear_session_history(session_id: str, request: Request):
    """Clear chat history for a specific session"""
    db = get_db(request)
    
    result = await db.chat_sessions.delete_one({"session_id": session_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Chat session cleared successfully"}


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
            any(q_lower in tag for tag in article["tags"])):
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


# =============================================================================
# KEYBOARD SHORTCUTS DATA
# =============================================================================

KEYBOARD_SHORTCUTS = [
    {
        "category": "Navigation",
        "shortcuts": [
            {"keys": ["Ctrl", "K"], "action": "Open search"},
            {"keys": ["Ctrl", "D"], "action": "Go to Dashboard"},
            {"keys": ["Ctrl", "/"], "action": "Show keyboard shortcuts"},
            {"keys": ["Esc"], "action": "Close modal/dialog"}
        ]
    },
    {
        "category": "Forms",
        "shortcuts": [
            {"keys": ["Ctrl", "S"], "action": "Save form"},
            {"keys": ["Ctrl", "P"], "action": "Preview form"},
            {"keys": ["Ctrl", "Z"], "action": "Undo"},
            {"keys": ["Ctrl", "Y"], "action": "Redo"},
            {"keys": ["Delete"], "action": "Remove selected field"}
        ]
    },
    {
        "category": "Data Entry",
        "shortcuts": [
            {"keys": ["Tab"], "action": "Next field"},
            {"keys": ["Shift", "Tab"], "action": "Previous field"},
            {"keys": ["Enter"], "action": "Submit/Confirm"},
            {"keys": ["Space"], "action": "Toggle checkbox"}
        ]
    },
    {
        "category": "Dashboards",
        "shortcuts": [
            {"keys": ["Ctrl", "N"], "action": "New widget"},
            {"keys": ["Ctrl", "E"], "action": "Edit selected widget"},
            {"keys": ["Ctrl", "G"], "action": "Grid snap toggle"},
            {"keys": ["R"], "action": "Refresh data"}
        ]
    },
    {
        "category": "General",
        "shortcuts": [
            {"keys": ["?"], "action": "Open help center"},
            {"keys": ["Ctrl", "B"], "action": "Toggle sidebar"},
            {"keys": ["F11"], "action": "Fullscreen mode"},
            {"keys": ["Ctrl", ","], "action": "Open settings"}
        ]
    }
]

WHATS_NEW_DATA = [
    {
        "version": "2.5.0",
        "date": "February 2026",
        "highlights": [
            {"type": "feature", "title": "Comprehensive Help Center", "description": "22 articles, 20 FAQs, 10 troubleshooting guides, AI-powered assistant"},
            {"type": "feature", "title": "Dashboard Templates", "description": "10 preset templates for Sales, Marketing, Operations, and more"},
            {"type": "feature", "title": "AI Assistant", "description": "Get instant help with GPT-4o powered chat support"},
            {"type": "improvement", "title": "Real-time Data Integration", "description": "Connect visualizations directly to form submissions"}
        ]
    },
    {
        "version": "2.4.0",
        "date": "January 2026",
        "highlights": [
            {"type": "feature", "title": "User Management Module", "description": "Complete user, role, and permission management"},
            {"type": "feature", "title": "DataViz Studio", "description": "Chart Studio, Dashboard Builder, Report Builder"},
            {"type": "feature", "title": "Template Library", "description": "Save and reuse custom dashboard templates"},
            {"type": "improvement", "title": "Quality AI", "description": "AI-powered data quality checks and anomaly detection"}
        ]
    },
    {
        "version": "2.3.0",
        "date": "December 2025",
        "highlights": [
            {"type": "feature", "title": "Offline-First Architecture", "description": "Collect data without internet connection"},
            {"type": "feature", "title": "Multi-language Support", "description": "English and Swahili built-in, more languages configurable"},
            {"type": "improvement", "title": "GPS Enhancements", "description": "Improved accuracy and indoor positioning support"},
            {"type": "bugfix", "title": "Sync Reliability", "description": "Fixed background sync issues on mobile devices"}
        ]
    },
    {
        "version": "2.2.0",
        "date": "November 2025",
        "highlights": [
            {"type": "feature", "title": "CATI Module", "description": "Computer-Assisted Telephone Interviewing support"},
            {"type": "feature", "title": "Back-check System", "description": "Quality verification through re-interviews"},
            {"type": "improvement", "title": "Form Builder UX", "description": "Drag-and-drop improvements and field grouping"}
        ]
    }
]


@router.get("/shortcuts")
async def get_keyboard_shortcuts():
    """Get keyboard shortcuts reference"""
    return {"shortcuts": KEYBOARD_SHORTCUTS}


@router.get("/whats-new")
async def get_whats_new():
    """Get release notes and what's new"""
    return {"releases": WHATS_NEW_DATA}


@router.get("/categories-full")
async def get_categories_full():
    """Get all help categories with their articles"""
    categories = [
        {
            "id": "getting-started",
            "title": "Getting Started",
            "icon": "Zap",
            "description": "Learn the basics and set up your first project",
            "color": "teal",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "basics"]
        },
        {
            "id": "forms",
            "title": "Forms & Data Collection",
            "icon": "FileText",
            "description": "Build forms and collect data",
            "color": "blue",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "forms"]
        },
        {
            "id": "dataviz",
            "title": "DataViz Studio",
            "icon": "BarChart3",
            "description": "Charts, dashboards, and reports",
            "color": "violet",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "dataviz"]
        },
        {
            "id": "data",
            "title": "Data Management",
            "icon": "Database",
            "description": "Import, export, and manage data",
            "color": "amber",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "data"]
        },
        {
            "id": "mobile",
            "title": "Mobile & Offline",
            "icon": "Smartphone",
            "description": "Offline collection and mobile features",
            "color": "cyan",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "mobile"]
        },
        {
            "id": "team",
            "title": "Team & Users",
            "icon": "Users",
            "description": "Manage your team and permissions",
            "color": "pink",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "admin"]
        },
        {
            "id": "quality",
            "title": "Quality Control",
            "icon": "Shield",
            "description": "Ensure data quality",
            "color": "rose",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "quality"]
        },
        {
            "id": "settings",
            "title": "Account & Settings",
            "icon": "Settings",
            "description": "Configure your account",
            "color": "gray",
            "articles": [a for a in HELP_ARTICLES.values() if a["category"] == "integrations"]
        }
    ]
    
    # Simplify articles to just id, title, readTime
    for cat in categories:
        cat["articles"] = [
            {"id": a["id"], "title": a["title"], "readTime": a.get("read_time", "5 min"), "popular": a.get("tags", []).__contains__("popular")}
            for a in cat["articles"]
        ]
    
    return {"categories": categories}
