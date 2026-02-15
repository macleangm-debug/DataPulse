# DataPulse - Product Requirements Document

## Original Problem Statement
User requested to pull DataPulse from GitHub (https://github.com/macleangm-debug/DataPulse) and implement:
1. A comprehensive User Management module
2. Integrate DataViz module from exported zip file to enhance existing functionality
3. Dashboard Templates Library with preset and user-created templates

## Project Overview
DataPulse is an enterprise-grade field data collection platform for research, M&E, and field surveys. It features offline-first data collection, real-time quality monitoring, and multi-language support.

## Architecture
- **Frontend**: React 19, TailwindCSS, Radix UI components, ECharts for visualizations
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT-based with SSO support

## What's Been Implemented

### Session 1 - User Management Module (Feb 15, 2026)
1. **Backend Routes** (`/app/backend/routes/user_management_routes.py`):
   - User CRUD, search, filtering, pagination
   - Activity tracking & login history
   - User suspension/deactivation/reactivation
   - Password policy configuration
   - Session management (view, revoke)
   - Bulk user actions
   - Suspicious activity detection

2. **Frontend Page** (`/app/frontend/src/pages/UserManagement/UserManagementPage.jsx`):
   - Stats dashboard, User/Activity/Sessions tabs
   - User details drawer, Edit user dialog
   - Password policy settings dialog

### Session 2 - DataViz Module Integration (Feb 15, 2026)
1. **New Pages Added**:
   - `ChartsPage.jsx` - Chart Studio with AI-powered suggestions
   - `DashboardsPage.jsx` - Dashboard list and management
   - `DashboardBuilderPage.jsx` - Drag-and-drop dashboard builder
   - `ReportBuilderPage.jsx` - Professional infographic-style report builder
   - `DataTransformPage.jsx` - Data transformation tools

2. **Backend Routes Added**:
   - `charts_routes.py` - Chart CRUD with query param support
   - Updated `dashboard_builder_routes.py` - Added query param endpoint
   - Updated `dataset_routes.py` - Added query param endpoint

### Session 3 - Dashboard Templates Library (Feb 15, 2026)
1. **Backend Routes** (`/app/backend/routes/dashboard_templates_routes.py`):
   - `GET /api/dashboard-templates` - List preset and custom templates
   - `POST /api/dashboard-templates` - Create custom template
   - `DELETE /api/dashboard-templates/{id}` - Delete custom template
   - `POST /api/dashboard-templates/from-dashboard/{id}` - Save dashboard as template
   - `GET /api/dashboard-templates/{id}` - Get specific template

2. **6 Preset Templates**:
   - Sales Overview (4 widgets)
   - Marketing Analytics (3 widgets)
   - Customer Insights (2 widgets)
   - Operations Monitor (2 widgets)
   - Financial Summary (2 widgets)
   - Blank Canvas (0 widgets)

3. **Frontend Components**:
   - `DashboardTemplatesDialog.jsx` - Modal with tabs for Preset/My Templates
   - `SaveAsTemplateButton.jsx` - Button to save current dashboard as template

4. **Bug Fix**:
   - Added `GET /api/dashboards/by-id/{dashboard_id}` endpoint to fix dashboard loading

## User Personas
- **Admin**: Full access to user management and dashboards
- **Manager**: Team management, dashboard viewing
- **Analyst**: Create charts, dashboards, reports
- **Enumerator/Viewer**: Standard data access

## Core Requirements Status
- [x] Clone and set up DataPulse codebase
- [x] User Management module with all features
- [x] Charts Studio with AI suggestions
- [x] Dashboard Builder with widgets
- [x] Report Builder with PDF export
- [x] Data Transform tools
- [x] Backend API endpoints for all DataViz features
- [x] Dashboard Templates Library (preset + custom)

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ User Management module
- ✅ DataViz module integration
- ✅ Dashboard Templates Library

### P1 (High Priority)
- Help Center documentation
- Email notifications for user actions
- Two-factor authentication (2FA)

### P2 (Medium Priority)
- User import/export (CSV)
- Advanced audit logging
- Custom role creation UI
- Real-time dashboard collaboration

### P3 (Nice to Have)
- User onboarding wizard
- AI-powered report generation
- Dashboard embedding for external sites

## Key API Endpoints
- `POST /api/auth/login` - User login
- `GET /api/dashboard-templates` - List all templates
- `POST /api/dashboard-templates` - Create custom template
- `POST /api/dashboard-templates/from-dashboard/{id}` - Save dashboard as template
- `GET /api/dashboards/by-id/{id}` - Get dashboard by ID
- `GET /api/dashboards?org_id={id}` - List dashboards
- `POST /api/dashboards` - Create dashboard

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!

## Next Steps
1. Add comprehensive Help Center
2. Implement email notifications
3. Add 2FA support
