# DataPulse - Product Requirements Document

## Overview
DataPulse is an enterprise-grade research data collection and analysis platform with offline-first capabilities, AI-powered quality monitoring, and comprehensive analytics.

## Core Features

### 1. Data Collection Module (100% Complete)
- Survey instruments with versioning
- Datasets/Lookup tables
- Case management with longitudinal tracking
- Multi-channel collection (CAWI, CAPI, CATI)
- Offline-first with encrypted IndexedDB storage
- Device management with remote wipe
- Quality AI monitoring (speeding, straight-lining, GPS anomalies)
- Back-check system for field verification

### 2. Data Analysis Module (100% Complete)
- Response browsing with pagination and filtering
- Immutable dataset snapshots
- Transformation pipelines (8 imputation methods)
- Basic statistics (frequencies, crosstabs, descriptives)
- Advanced statistics (t-tests, ANOVA, regression, GLM, mixed models)
- Survey statistics (complex designs, design effects, replicate weights)
- AI Copilot for natural language queries
- Publication-quality visualizations (10 chart types)
- Interactive dashboards with drill-down
- Reproducibility packs with hash verification

### 3. PWA Features (Enhanced Feb 9, 2026)
- Service Worker for offline functionality
- Encrypted local storage (AES-GCM 256-bit)
- Background sync with conflict resolution
- Push Notifications Manager with 25+ notification types
- Notification categories: Sync, Quality, Submissions, Team, Devices, AI, Backcheck, System
- Storage management UI
- PWA Settings panel in Settings > App tab

### 4. Push Notification System (Added Feb 9, 2026)
- Backend VAPID key management with auto-generation
- Push subscription management per user/org
- Quality alert notifications (speeding, GPS, straight-lining, duplicates)
- Notification preferences stored in MongoDB
- Server-sent push notifications via pywebpush

### API Endpoints - Push Notifications
- `GET /api/push/vapid-public-key` - Get VAPID public key
- `POST /api/push/subscribe` - Subscribe to push
- `DELETE /api/push/unsubscribe` - Unsubscribe
- `POST /api/push/send` - Send notification
- `POST /api/push/trigger/quality-alert` - Trigger quality alert
- `POST /api/push/test` - Test notification
- `GET /api/push/history/{org_id}` - Notification history
- `GET /api/push/alerts/{org_id}` - Quality alerts list

## Architecture

### Backend
- Python FastAPI
- MongoDB database
- GPT-5.2 integration via Emergent LLM Key for AI features

### Frontend
- React with Vite
- TailwindCSS + Shadcn/UI components
- Zustand for state management
- Recharts for visualizations
- react-grid-layout for dashboards

### PWA Stack
- Service Worker (`/public/sw.js`)
- Web App Manifest (`/public/manifest.json`)
- Offline page (`/public/offline.html`)
- Encrypted storage (`/lib/encryptedStorage.js`)
- Sync manager (`/lib/offlineStorage.js`)

## Key Files Reference

### Backend Routes
- `routes/form_routes.py` - Survey instruments
- `routes/submission_routes.py` - Data submissions
- `routes/analysis_routes.py` - Analytics endpoints
- `routes/stats_routes.py` - Statistical functions
- `routes/survey_stats_routes.py` - Complex survey statistics
- `routes/ai_copilot_routes.py` - AI analysis
- `routes/quality_ai_routes.py` - Quality monitoring
- `routes/device_routes.py` - Device management

### Frontend Components
- `components/PWAComponents.jsx` - PWA features
- `components/NotificationCenter.jsx` - Notification system
- `components/OnboardingWizard.jsx` - Interactive onboarding tour
- `components/ContextualHelp.jsx` - Help system with tooltips and panel
- `components/CommandPalette.jsx` - ⌘K universal search and shortcuts
- `components/OfflineSync.jsx` - Sync UI
- `pages/SettingsPage.jsx` - Settings with App tab
- `layouts/DashboardLayout.jsx` - Main layout with mobile sidebar

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!
- Organization: ACME Research

## Changelog

### Feb 9, 2026
- **Command Palette (⌘K) (NEW)**:
  - Universal search with ⌘K / Ctrl+K keyboard shortcut
  - Navigation commands (Dashboard, Projects, Forms, Submissions, Analysis, etc.)
  - Quick actions (Create New Form, Create New Project, Import/Export Data)
  - Additional shortcuts: ⌘N (New Form), ⌘P (Projects), ⌘D (Dashboard), ⌘, (Settings)
  - Keyboard navigation (↑↓ Navigate, ↵ Select, ESC Close)
  - Recent commands history saved to localStorage
- **Mobile-Responsive Sidebar (ENHANCED)**:
  - Full-height slide-out drawer with smooth animations
  - Organization selector dropdown for quick switching
  - Quick action buttons (New Form, New Project) at top
  - Expandable navigation groups with animated transitions
  - User profile section with Settings and Sign out buttons
  - Mobile search button in header to open Command Palette
- **Contextual Help System (NEW)**:
  - Toggle-able help mode with indicators on UI elements
  - Help (?) button in header to access Help Center panel
  - Slide-out Help Center with categorized help topics (Navigation, Features, Builder, Analysis, Team)
  - 20+ help topics with descriptions and quick tips
  - Rotating Pro Tips banner at bottom of screen (10 tips, rotates every 30 seconds)
  - Keyboard shortcuts reference
  - Help preference saved to localStorage
- **Onboarding Wizard (NEW)**:
  - Interactive product tour with 10 steps for new users
  - Welcome modal highlighting key features (Offline, Analytics, AI Quality, Security)
  - Interactive tooltips for navigation rail, org selector, search, notifications
  - Feature spotlights for Offline Data Collection, Professional Data Analysis, AI Quality Monitoring
  - Completion screen with actionable next steps (Create Project, Build Form, Invite Team, Import Data)
  - "Replay Onboarding Tour" button in Settings > Profile tab
  - Triggers automatically on first login, remembers completion via localStorage
- **Header UI Redesign (Verified)**:
  - Moved Organization Selector from sidebar to top-left of header bar
  - Centered search bar with keyboard shortcut hint (⌘K)
  - User profile with avatar and role on top-right
  - New button dropdown for quick form/project creation
  - Notification bell with badge indicator
  - All dropdowns verified working without clipping
- Enhanced PWA components with new features:
  - PushNotificationsManager - Enable/disable notifications with preferences
  - OfflineModePage - Full-screen offline experience
  - PWASettingsPanel - Comprehensive PWA settings
  - SyncStatusToast - Real-time sync progress
- Created NotificationCenter with 25+ notification types in 8 categories
- Added "App" tab to Settings page for PWA management
- Added helper methods to offlineStorage.js (getCachedForms, getPendingCount)
- Push notification backend with VAPID keys and subscription management

### Feb 7-8, 2026
- Completed Data Analysis Module (100%)
- All statistical functions implemented
- AI Copilot with guardrails
- Reproducibility packs

### Feb 6, 2026
- Completed Data Collection Module (100%)
- CAPI offline functionality
- Quality AI monitoring
- Device management

## Roadmap

### P0 (Immediate) - COMPLETED
- ✅ Wire up backend quality alerts to trigger frontend notifications
- ✅ Real push notification server with VAPID keys
- ✅ Header UI redesign with organization selector in top bar
- ✅ Onboarding wizard for new users
- ✅ Contextual help system for user retention

### P1 (Next Sprint)
- Mobile device testing for PWA and onboarding
- Audio notification file
- Enhanced conflict resolution UI
- Add more contextual help topics throughout the app

### P2 (Future)
- Native mobile app wrapper (if needed)
- Real-time collaboration features
- Advanced export templates
