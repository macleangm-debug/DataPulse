# DataPulse - Product Requirements Document

## Original Problem Statement
User requested to pull DataPulse from GitHub (https://github.com/macleangm-debug/DataPulse) and implement:
1. A comprehensive User Management module
2. Integrate DataViz module from exported zip file to enhance existing functionality
3. Dashboard Templates Library with 10 preset templates and 12 widget types
4. **Connect data visualization to real-time data collection**

## Project Overview
DataPulse is an enterprise-grade field data collection platform for research, M&E, and field surveys. It features offline-first data collection, real-time quality monitoring, and multi-language support.

## Architecture
- **Frontend**: React 19, TailwindCSS, Radix UI components, ECharts for visualizations
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT-based with SSO support

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
**NEW Backend API** (`/app/backend/routes/data_sources_routes.py`):
- `GET /api/data-sources` - List all available data sources (forms, datasets, snapshots)
- `GET /api/data-sources/{id}/data` - Get data from a source
- `GET /api/data-sources/{id}/aggregate` - Aggregate data for charts
- `GET /api/data-sources/{id}/fields` - Get field schema
- `GET /api/data-sources/{id}/stats` - Get statistics summary

**Frontend Components Updated:**
1. **DataSourceSelector** (`/app/frontend/src/components/DataSourceSelector.jsx`):
   - Unified component for selecting forms, datasets, or snapshots
   - Shows record counts, field counts, last updated
   - Search and type filtering
   - Used in all visualization pages

2. **DashboardsPage** - When creating from template:
   - Shows DataSourceSelector after template selection
   - Can connect to form submissions or datasets
   - "Skip and use demo data" option

3. **ChartsPage** - Chart Studio:
   - Data source dropdown shows forms and datasets with type badges (FORM/DATA)
   - Uses unified `/api/data-sources` API
   - Creates charts from real submission data

4. **ReportBuilderPage**:
   - "Connect Data" button in header
   - Auto-generates report sections from connected data
   - Dynamic stat cards, pie charts, bar charts from data

**Test Data Seeded:**
- Form: "Customer Feedback Survey" with 50 submissions
- Dataset: "Sales Data" with 18 records

### Session 5 - Dashboard Template Edit Feature (Feb 15, 2026)
**Backend API** (`/app/backend/routes/dashboard_templates_routes.py`):
- `PUT /api/dashboard-templates/{template_id}` - Update custom template name/description

**Frontend Update** (`/app/frontend/src/components/DashboardTemplatesDialog.jsx`):
- Edit button (pencil icon) appears on hover over custom template cards
- Inline edit mode with name input (autofocused) and description textarea
- Save button calls PUT API, shows success toast, updates UI immediately
- Cancel button exits edit mode without saving
- Card border highlights in violet when in edit mode

### Session 6 - Help Center with AI Assistant (Feb 15, 2026)
**Backend API** (`/app/backend/routes/help_assistant_routes.py`):
- `GET /api/help/articles` - List help articles with ?category and ?search filters
- `GET /api/help/articles/{article_id}` - Get specific article content
- `GET /api/help/categories` - List all help categories
- `POST /api/help/chat` - AI chat using GPT-4o via Emergent LLM key
- `POST /api/help/feedback` - Submit article feedback

**Frontend Components:**
- `HelpCenterPage.jsx` - Full help center with tabs: Browse, FAQ, Troubleshoot, Shortcuts, What's New
- `HelpAssistant.jsx` - Floating AI chat assistant with GPT-4o integration
- Search filtering, category browsing, FAQ accordion, troubleshooting guides

**Integration:** GPT-4o via Emergent LLM key (emergentintegrations library)

### Session 7 - Comprehensive Help Center Expansion (Feb 15, 2026)
**Massively expanded Help Center content:**

**Articles (22 total):**
- Getting Started, Form Builder Guide, Skip Logic, Dashboards, Dashboard Templates
- Offline Collection, User Management, Data Export, Quality Checks, Report Builder
- Chart Studio, GPS Map, CATI/CAWI, Case Management, Datasets, Workflows
- Security Best Practices, Translations, Media Capture, Calculated Fields
- Plugins, API Documentation

**FAQ (20 items):** Covering forms, offline, dashboards, users, quality, exports, API, and more

**Troubleshooting Guides (10 guides with severity levels):**
- Data Not Syncing (high), Form Submission Errors (high), Cannot Log In (medium)
- GPS Not Working (medium), Media Upload Failing (medium), Submissions Missing (high)
- Export Not Working (medium), Dashboard Not Showing Data (medium)
- Application Running Slow (low), Form Builder Problems (medium)

**AI Knowledge Base:** Comprehensive documentation covering:
- All DataPulse features and navigation
- Step-by-step guides for common tasks
- Troubleshooting procedures
- Best practices and tips
- Keyboard shortcuts reference

## Data Flow Architecture
```
[Forms] → [Submissions] ←→ [Data Sources API] ←→ [Chart Studio]
                              ↓                    ↓
[Datasets] → [Records] ←───────────────→ [Dashboard Builder]
                              ↓                    ↓
[Snapshots] ───────────────────────────→ [Report Builder]
```

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
- [x] **Connect data visualization to real-time data collection** ✓
- [x] **Edit/Delete custom dashboard templates** ✓
- [x] **Help Center with AI Assistant** ✓

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/data-sources` - List all data sources
- `GET /api/data-sources/{id}/data?source_type={type}` - Get data from source
- `GET /api/data-sources/{id}/aggregate` - Aggregate data for charts
- `GET /api/dashboard-templates` - List all templates
- `POST /api/dashboard-templates` - Create custom template
- `PUT /api/dashboard-templates/{template_id}` - Update custom template name/description
- `DELETE /api/dashboard-templates/{template_id}` - Delete custom template
- `GET /api/dashboards/by-id/{id}` - Get dashboard by ID
- `GET /api/help/articles` - List help articles
- `GET /api/help/categories` - List help categories
- `GET /api/help/faq` - List all FAQ items
- `GET /api/help/troubleshooting` - List troubleshooting guides
- `GET /api/help/search?q=query` - Global search across help content
- `POST /api/help/chat` - AI chat assistant

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ User Management module
- ✅ DataViz module integration
- ✅ Dashboard Templates Library
- ✅ Data visualization connected to real-time data
- ✅ Edit/Delete custom dashboard templates
- ✅ Help Center with AI Assistant

### P1 (High Priority)
- Email notifications for user actions
- Two-factor authentication (2FA)

### P2 (Medium Priority)
- User import/export (CSV)
- Advanced audit logging
- Real-time dashboard refresh (WebSocket)
- Custom role creation UI

### P3 (Nice to Have)
- User onboarding wizard
- AI-powered report generation
- Dashboard embedding for external sites
