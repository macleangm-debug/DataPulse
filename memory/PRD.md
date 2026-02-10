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

### 3. Qualitative Analysis Module (Phase 1 Complete - Feb 10, 2026)
- **Projects**: Create, list, update, delete qualitative research projects
- **Sources**: Import transcripts, field notes, open-ended responses with metadata
- **Codebook**: Hierarchical code management with definitions, colors, shortcuts
- **Coding**: Apply codes to text excerpts with position tracking
- **Memos**: Analytic, methodological, reflexive, and procedural memos
- **Themes**: Build themes with supporting and counter evidence
- **Retrieval**: Query codings by code, text search, co-occurrence analysis
- **Statistics**: Project-level statistics and code frequency analysis

### 4. PWA Features (Enhanced Feb 9, 2026)
- Service Worker for offline functionality
- Encrypted local storage (AES-GCM 256-bit)
- Background sync with conflict resolution
- Push Notifications Manager with 25+ notification types
- Storage management UI

### 5. UX Enhancements
- Onboarding Wizard (driver.js) for new users
- Contextual Help System with side panel
- Command Palette (⌘K) for quick navigation
- Mobile-responsive sidebar

## Architecture

### Backend
- Python FastAPI
- MongoDB database
- GPT-5.2 integration via Emergent LLM Key for AI features

### Frontend
- React with TailwindCSS + Shadcn/UI
- Zustand for state management
- Recharts for visualizations
- react-grid-layout for dashboards

### Qualitative Module API Endpoints
- `GET/POST /api/qualitative/projects` - Project management
- `GET/POST /api/qualitative/sources` - Source/transcript management
- `GET/POST /api/qualitative/codes` - Codebook management
- `GET/POST /api/qualitative/codings` - Code application to excerpts
- `GET/POST /api/qualitative/memos` - Research memos
- `GET/POST /api/qualitative/themes` - Theme management
- `POST /api/qualitative/retrieve/by-code` - Retrieve excerpts by code
- `POST /api/qualitative/retrieve/text-search` - Full-text search
- `POST /api/qualitative/retrieve/co-occurrence` - Code co-occurrence analysis
- `POST /api/qualitative/retrieve/matrix` - Matrix coding queries
- `GET /api/qualitative/stats/{project_id}` - Project statistics

### MongoDB Collections (Qualitative)
- `qual_projects` - Qualitative research projects
- `qual_sources` - Source documents/transcripts
- `qual_codes` - Codebook codes
- `qual_codings` - Applied codings
- `qual_memos` - Research memos
- `qual_themes` - Themes/findings

## Key Files Reference

### Backend
- `routes/qualitative_routes.py` - Qualitative API endpoints (1300+ lines)
- `qualitative_models.py` - Pydantic models for qualitative module

### Frontend
- `pages/QualitativeAnalysisPage.jsx` - Project list and creation
- `pages/QualitativeWorkspacePage.jsx` - Coding studio workspace
- `layouts/DashboardLayout.jsx` - Navigation with Qualitative link
- `components/CommandPalette.jsx` - Quick navigation (includes Qualitative)

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!
- Organization: ACME Research

## Changelog

### Feb 10, 2026
- **Qualitative Analysis Module - Phase 1 MVP Complete**:
  - Full backend API implementation (Projects, Sources, Codes, Codings, Memos, Themes)
  - Frontend pages for project list and coding workspace
  - Navigation integration (sidebar + command palette)
  - Text selection and code application with visual highlighting
  - Retrieval queries (by-code, text search, co-occurrence, matrix)
  - Project statistics dashboard
  - Bug fixes: get_user_info ObjectId handling, CommandPalette hook ordering

### Feb 9, 2026
- Public REST API for External Integrations
- Command Palette (⌘K) with keyboard shortcuts
- Mobile-Responsive Sidebar improvements
- Contextual Help System
- Onboarding Wizard

## Roadmap

### P0 - Completed
- ✅ Qualitative Analysis Module Phase 1 (Core MVP)

### P1 - Next Sprint (Qualitative Phase 2)
- AI-Assisted Transcription with diarization
- PII detection and one-click anonymization
- Advanced queries (boolean, proximity)
- Multi-coder collaboration workflows
- Inter-coder reliability (ICR) calculations

### P2 - Future (Qualitative Phase 3)
- AI coding suggestions with rationale
- AI theme synthesis from coded data
- Report builder for themes and evidence packs
- Mixed methods support (link qual to quant)

### Known Issues
- Onboarding wizard modal persists after localStorage clear (pre-existing)
- Session state occasionally lost during testing
