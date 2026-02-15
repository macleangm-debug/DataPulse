# DataPulse - Product Requirements Document

## Original Problem Statement
User requested to pull DataPulse from GitHub (https://github.com/macleangm-debug/DataPulse) and implement a comprehensive User Management module.

## Project Overview
DataPulse is an enterprise-grade field data collection platform for research, M&E, and field surveys. It features offline-first data collection, real-time quality monitoring, and multi-language support.

## Architecture
- **Frontend**: React 19, TailwindCSS, Radix UI components
- **Backend**: FastAPI (Python), Motor (async MongoDB driver)
- **Database**: MongoDB
- **Authentication**: JWT-based with SSO support

## What's Been Implemented (Feb 15, 2026)

### User Management Module
1. **Backend Routes** (`/app/backend/routes/user_management_routes.py`):
   - `GET /api/users` - List users with search, filtering, pagination
   - `GET /api/users/stats` - User statistics (total, active, suspended, sessions)
   - `GET /api/users/{user_id}` - Detailed user profile with activity
   - `PUT /api/users/{user_id}` - Update user info (role, status, department)
   - `POST /api/users/bulk-action` - Bulk suspend/activate/deactivate
   - `GET /api/users/{user_id}/activity` - User activity history
   - `GET /api/users/activity/all` - Organization-wide activity
   - `GET /api/users/{user_id}/sessions` - User sessions
   - `POST /api/users/{user_id}/sessions/revoke` - Revoke specific sessions
   - `POST /api/users/{user_id}/sessions/revoke-all` - Revoke all sessions
   - `GET /api/users/sessions/active` - All active org sessions
   - `GET /api/users/config/password-policy` - Password policy settings
   - `PUT /api/users/config/password-policy` - Update password policy
   - `POST /api/users/{user_id}/force-password-reset` - Force password reset
   - `GET /api/users/{user_id}/login-history` - Login history
   - `GET /api/users/login-history/suspicious` - Suspicious login activity

2. **Frontend Page** (`/app/frontend/src/pages/UserManagementPage.jsx`):
   - Stats dashboard (Total Users, Active Users, Sessions, Failed Logins)
   - Users tab with search, status/role filters, bulk actions
   - Activity tab with recent activity and suspicious activity alerts
   - Sessions tab showing active sessions across org
   - User details drawer with overview, activity, sessions, security tabs
   - Edit user dialog
   - Password policy settings dialog
   - Proper data-testid attributes for testing

3. **Navigation**: Added to Settings sidebar in DashboardLayout

## User Personas
- **Admin**: Full access to user management, can suspend/activate users
- **Manager**: Can view team members, limited management
- **Analyst/Enumerator/Viewer**: Standard users with role-based access

## Core Requirements
- [x] Clone and set up DataPulse codebase
- [x] User listing with search and filtering
- [x] User activity/login history tracking
- [x] User suspension/deactivation
- [x] Password policy configuration
- [x] Session management (view, revoke)
- [x] Bulk user actions

## Test Results (Feb 15, 2026)
- Backend: 93.8% success rate (15/16 endpoints working)
- Frontend: User Management page fully functional
- Minor fix applied: Password policy endpoint route conflict resolved

## Prioritized Backlog

### P0 (Critical)
- N/A - Core functionality complete

### P1 (High Priority)
- Help Center documentation (user requested comparison feature)
- Email notifications for user actions
- Two-factor authentication (2FA) support

### P2 (Medium Priority)
- User import/export (CSV)
- Advanced audit logging with export
- Custom role creation UI
- Session device fingerprinting

### P3 (Nice to Have)
- User onboarding wizard
- Bulk invite via email
- Integration with external identity providers
- User analytics dashboard

## Next Steps
1. Add comprehensive Help Center (per user's initial question)
2. Implement email notifications for suspension/password reset
3. Add 2FA support for enhanced security
