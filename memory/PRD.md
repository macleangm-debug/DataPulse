# DataPulse - Product Requirements Document

## Original Problem Statement
User requested to build a full-featured SaaS application called DataPulse with:
1. User Management module
2. DataViz module integration with Charts, Dashboards, Reports
3. Dashboard Templates Library with 10 preset templates and 12 widget types
4. Real-time data visualization connected to data collection
5. Edit/Delete functionality for custom dashboard templates
6. Comprehensive Help Center with AI-powered assistant
7. Interactive Demo page for prospective users
8. **NEW: Application screenshots embedded in Help Center articles (P1)**
9. **NEW: Persistent AI chat sessions stored in MongoDB (P2)**

## Project Overview
DataPulse is an enterprise-grade field data collection platform for research, M&E, and field surveys. It features offline-first data collection, real-time quality monitoring, and multi-language support.

## Architecture
- **Frontend**: React 19, TailwindCSS, Radix UI components, ECharts for visualizations
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT-based with SSO support
- **AI Integration**: GPT-4o via Emergent LLM key

## What's Been Implemented

### Session 1-5 - Core Features (Feb 15, 2026)
- User Management module with CRUD, activity tracking, sessions
- DataViz module: ChartsPage, DashboardsPage, DashboardBuilderPage, ReportBuilderPage
- Dashboard Templates Library with 10 presets and 12 widget types
- Data source integration for real-time visualization
- Edit/Delete functionality for custom templates

### Session 6-8 - Help Center & Demo (Feb 16, 2026)
- Complete Help Center with 20+ articles, FAQ, troubleshooting, shortcuts
- AI Assistant powered by GPT-4o via Emergent LLM Key
- Dynamic content fetched from backend APIs
- Interactive Demo page at `/demo` with sample data

### Session 9 - Chat Persistence & Screenshots (Feb 16, 2026)

**P1: Application Screenshots in Help Center**
- Captured 6 authenticated screenshots using Playwright automation
- Screenshots stored in `/app/frontend/public/help-screenshots/`
- Files: dashboard.jpeg, forms.jpeg, dashboards.jpeg, charts.jpeg, user-management.jpeg, help-center.jpeg
- Backend maps article `screenshot` field to actual image URLs via `screenshot_url`
- Frontend displays screenshots with "Screenshot Reference:" label in article view

**P2: Persistent AI Chat Sessions**
- New MongoDB collection: `chat_sessions`
- Schema: `{session_id, user_id, messages[{role, content, timestamp}], created_at, updated_at}`
- New endpoints:
  - `GET /api/help/chat/sessions/{session_id}` - Retrieve chat history
  - `DELETE /api/help/chat/sessions/{session_id}` - Clear chat session
- Modified `POST /api/help/chat` to persist messages to MongoDB
- Frontend stores session_id in localStorage for persistence across page reloads
- Added "Clear Chat" button to reset conversation

## Core Requirements Status
- [x] Clone and set up DataPulse codebase
- [x] User Management module with all features
- [x] Charts Studio with AI suggestions
- [x] Dashboard Builder with widgets
- [x] Report Builder with PDF export
- [x] Data Transform tools
- [x] Dashboard Templates Library (10 presets + custom)
- [x] Category filtering for templates
- [x] 12 widget types support
- [x] Connect data visualization to real-time data collection
- [x] Edit/Delete custom dashboard templates
- [x] Help Center with AI Assistant
- [x] Interactive Demo Page
- [x] **Application screenshots in Help Center articles (P1)** - TESTED 100%
- [x] **Persistent AI chat sessions (P2)** - TESTED 100%

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/data-sources` - List all data sources
- `PUT /api/dashboard-templates/{template_id}` - Update custom template
- `DELETE /api/dashboard-templates/{template_id}` - Delete custom template
- `GET /api/help/articles/{article_id}` - Get article with screenshot_url
- `POST /api/help/chat` - AI chat with session persistence
- `GET /api/help/chat/sessions/{session_id}` - Get chat history
- `DELETE /api/help/chat/sessions/{session_id}` - Clear chat session

## Key DB Schema

### chat_sessions Collection (NEW)
```javascript
{
  session_id: String (UUID, unique),
  user_id: String (optional),
  messages: [
    {
      role: "user" | "assistant",
      content: String,
      timestamp: String (ISO8601)
    }
  ],
  created_at: String (ISO8601),
  updated_at: String (ISO8601)
}
```

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] All core features implemented and tested

### P1 (High Priority) - DONE
- [x] Add actual application screenshots to Help Center articles

### P2 (Medium Priority) - DONE
- [x] Persist AI chat sessions to database

### P3 (Nice to Have) - REMAINING
- [ ] Step-by-step interactive tutorials in Help Center
- [ ] Fully implement Guided Tour feature on Demo page
- [ ] Email notifications for user actions
- [ ] Two-factor authentication (2FA)
- [ ] User import/export (CSV)

## Recent Test Results
- **Iteration 9**: Chat Persistence & Screenshots - 100% pass rate (17/17 backend, 9/9 frontend)
- **Iteration 8**: Interactive Demo Page - 100% pass rate (17/17 frontend tests)
- **Iteration 7**: Help Center Dynamic Migration - 100% pass rate

## Files Modified in Latest Session
- `/app/backend/routes/help_assistant_routes.py` - Added chat persistence functions, new endpoints
- `/app/backend/server.py` - Added chat_sessions index
- `/app/frontend/src/components/HelpAssistant.jsx` - Session persistence, clear chat, load history
- `/app/frontend/src/pages/HelpCenterPage.jsx` - Screenshot display in articles
- `/app/frontend/public/help-screenshots/` - 6 new screenshot files
