# DataPulse - Product Requirements Document

## Original Problem Statement
User requested to pull DataPulse from GitHub (https://github.com/macleangm-debug/DataPulse) and implement:
1. A comprehensive User Management module
2. Integrate DataViz module from exported zip file to enhance existing functionality

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

2. **Frontend Page** (`/app/frontend/src/pages/UserManagementPage.jsx`):
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

2. **New Components** (`/app/frontend/src/components/report/`):
   - ThemeSelector, StatCard, ChartPreviews
   - ReportSection, AddSectionPanel

3. **Backend Routes Added**:
   - `charts_routes.py` - Chart CRUD with query param support
   - Updated `dashboard_builder_routes.py` - Added query param endpoint
   - Updated `dataset_routes.py` - Added query param endpoint

4. **Navigation Updated**: Data menu includes Charts, Dashboards, Report Builder

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

## Prioritized Backlog

### P0 (Critical) - DONE
- ✅ User Management module
- ✅ DataViz module integration

### P1 (High Priority)
- Help Center documentation
- Email notifications for user actions
- Two-factor authentication (2FA)
- Dashboard templates library

### P2 (Medium Priority)
- User import/export (CSV)
- Advanced audit logging
- Custom role creation UI
- Real-time dashboard collaboration

### P3 (Nice to Have)
- User onboarding wizard
- AI-powered report generation
- Dashboard embedding for external sites

## Next Steps
1. Add comprehensive Help Center
2. Implement dashboard templates
3. Add email notifications
