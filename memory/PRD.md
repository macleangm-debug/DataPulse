# DataPulse - Product Requirements Document

## Original Problem Statement
User requested to pull DataPulse from GitHub (https://github.com/macleangm-debug/DataPulse) and implement:
1. A comprehensive User Management module
2. Integrate DataViz module from exported zip file to enhance existing functionality
3. Dashboard Templates Library with 10 preset templates and 12 widget types
4. **Connect data visualization to real-time data collection**
5. Edit/Delete functionality for custom dashboard templates
6. Comprehensive Help Center with AI-powered assistant

## Project Overview
DataPulse is an enterprise-grade field data collection platform for research, M&E, and field surveys. It features offline-first data collection, real-time quality monitoring, and multi-language support.

## Architecture
- **Frontend**: React 19, TailwindCSS, Radix UI components, ECharts for visualizations
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT-based with SSO support
- **AI Integration**: GPT-4o via Emergent LLM key

## What's Been Implemented

### Session 1 - User Management Module (Feb 15, 2026)
- Backend routes for user CRUD, activity tracking, sessions, password policies
- Frontend page with stats dashboard, tabs, and dialogs

### Session 2 - DataViz Module Integration (Feb 15, 2026)
- New pages: ChartsPage, DashboardsPage, DashboardBuilderPage, ReportBuilderPage
- Backend routes for charts, dashboards, datasets

### Session 3 - Dashboard Templates Library (Feb 15, 2026)
- 10 preset templates with 12 widget types
- Category filtering
- Save dashboard as template feature

### Session 4 - Data Visualization Integration (Feb 15, 2026)
**Backend API** (`/app/backend/routes/data_sources_routes.py`):
- `GET /api/data-sources` - List all available data sources
- `GET /api/data-sources/{id}/data` - Get data from a source
- `GET /api/data-sources/{id}/aggregate` - Aggregate data for charts

### Session 5 - Dashboard Template Edit Feature (Feb 15, 2026)
- `PUT /api/dashboard-templates/{template_id}` - Update custom template
- Inline edit mode in DashboardTemplatesDialog

### Session 6 - Help Center with AI Assistant (Feb 15, 2026)
**Backend API** (`/app/backend/routes/help_assistant_routes.py`):
- `GET /api/help/articles` - List help articles with ?category and ?search filters
- `GET /api/help/articles/{article_id}` - Get specific article content
- `GET /api/help/categories` - List all 8 help categories
- `POST /api/help/chat` - AI chat using GPT-4o via Emergent LLM key
- `POST /api/help/feedback` - Submit article/chat feedback

**Frontend Components:**
- `HelpCenterPage.jsx` - Full help center with tabs: Home, FAQ, Troubleshooting, Shortcuts, What's New
- `HelpAssistant.jsx` - Floating AI chat assistant with GPT-4o integration

**Features:**
- 8 help categories (Getting Started, Forms, DataViz, Data Management, Mobile, Team, Quality, Settings)
- 12+ FAQ items grouped by category with expandable accordions
- 5 troubleshooting guides with severity levels (high/medium)
- Keyboard shortcuts reference grouped by Navigation, Forms, Data Entry, General
- What's New section with version releases (v2.5.0, v2.4.0, v2.3.0)
- Real-time search filtering with dropdown results
- AI Assistant chat widget with suggested questions and feedback buttons

## Core Requirements Status
- [x] Clone and set up DataPulse codebase
- [x] User Management module with all features
- [x] Charts Studio with AI suggestions
- [x] Dashboard Builder with widgets
- [x] Report Builder with PDF export
- [x] Data Transform tools
- [x] Backend API endpoints for all DataViz features
- [x] Dashboard Templates Library (10 presets + custom)
- [x] Category filtering for templates
- [x] 12 widget types support
- [x] Connect data visualization to real-time data collection
- [x] Edit/Delete custom dashboard templates
- [x] **Help Center with AI Assistant** (TESTED - 100% pass rate)

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/data-sources` - List all data sources
- `GET /api/data-sources/{id}/data?source_type={type}` - Get data from source
- `PUT /api/dashboard-templates/{template_id}` - Update custom template
- `DELETE /api/dashboard-templates/{template_id}` - Delete custom template
- `GET /api/help/articles` - List help articles (supports ?category, ?search filters)
- `GET /api/help/articles/{article_id}` - Get specific article
- `GET /api/help/categories` - List 8 help categories
- `POST /api/help/chat` - AI chat assistant (GPT-4o)
- `POST /api/help/feedback` - Submit feedback

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] User Management module
- [x] DataViz module integration
- [x] Dashboard Templates Library
- [x] Data visualization connected to real-time data
- [x] Edit/Delete custom dashboard templates
- [x] Help Center with AI Assistant

### P1 (High Priority)
- Email notifications for user actions
- Two-factor authentication (2FA)
- Add actual application screenshots to Help Center articles

### P2 (Medium Priority)
- User import/export (CSV)
- Advanced audit logging
- Real-time dashboard refresh (WebSocket)
- Custom role creation UI
- Persist AI chat sessions to database (currently in-memory)

### P3 (Nice to Have)
- User onboarding wizard
- AI-powered report generation
- Dashboard embedding for external sites
- Step-by-step interactive tutorials

## Recent Test Results
- **Iteration 6**: Help Center - 100% pass rate (backend 15/15, frontend all UI tests)
- All backend APIs tested and working
- All frontend features verified functional
