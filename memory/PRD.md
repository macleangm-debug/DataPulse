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
- Statistics: frequencies, crosstabs, t-tests, ANOVA, regression, GLM, mixed models
- Survey statistics with complex designs and replicate weights
- AI Copilot for natural language queries
- Publication-quality visualizations (10 chart types)
- Interactive dashboards with drill-down
- Reproducibility packs with hash verification

### 3. Qualitative Analysis Module (100% Complete - Feb 10, 2026)

#### Phase 1 - Core MVP ✅
- Projects, Sources, Codebook, Coding, Memos, Themes
- Retrieval: by-code, text search, co-occurrence
- Project statistics

#### Phase 2 - Advanced Analysis & Governance ✅
- AI-Assisted Transcription (OpenAI Whisper)
- PII Detection & Anonymization
- Advanced Queries (Boolean, Proximity, Matrix)
- Multi-Coder Collaboration & Blind Coding
- Audit Trails & Inter-Coder Reliability (Cohen's Kappa)
- Code Version History

#### Phase 3 - AI-Native Features & Reporting ✅
- AI Coding Suggestions (GPT-5.2)
- Auto-Code Source
- AI Theme Synthesis
- Report Generation (JSON/Markdown/HTML)

#### Phase 4 - Advanced Features ✅ (NEW)
- **Mixed Methods Support**: Theme-variable linking, joint display, convergence analysis
- **REFI-QDA Export**: NVivo/ATLAS.ti/MAXQDA interoperability (XML, QDPX)
- **Real-time Collaboration**: WebSocket-based live coding with presence
- **Publication Visuals**: Framework matrices, quote cards, network diagrams

### 4. PWA Features
- Service Worker for offline functionality
- Encrypted local storage (AES-GCM 256-bit)
- Background sync with conflict resolution
- Push Notifications Manager

### 5. UX Enhancements
- Onboarding Wizard (driver.js)
- Contextual Help System
- Command Palette (⌘K)
- Mobile-responsive sidebar

## Architecture

### Backend (FastAPI + MongoDB)
- GPT-5.2 via Emergent LLM Key
- OpenAI Whisper for transcription
- WebSocket for real-time features

### Frontend (React + TailwindCSS + Shadcn/UI)
- Zustand for state management
- Recharts for visualizations

## Complete API Reference

### Core Qualitative APIs
```
GET/POST /api/qualitative/projects
GET/POST /api/qualitative/sources
GET/POST /api/qualitative/codes
GET/POST /api/qualitative/codings
GET/POST /api/qualitative/memos
GET/POST /api/qualitative/themes
```

### AI APIs
```
POST /api/qualitative/ai/transcribe
POST /api/qualitative/ai/suggest-codes
POST /api/qualitative/ai/auto-code-source/{id}
POST /api/qualitative/ai/detect-pii/{id}
POST /api/qualitative/ai/anonymize/{id}
POST /api/qualitative/ai/synthesize-themes
POST /api/qualitative/ai/generate-report/{id}
GET  /api/qualitative/ai/icr/{id}
```

### Advanced Query APIs
```
POST /api/qualitative/query/boolean
POST /api/qualitative/query/proximity
POST /api/qualitative/query/matrix
POST /api/qualitative/query/cross-case
GET  /api/qualitative/query/code-frequency/{id}
```

### Mixed Methods APIs
```
POST /api/qualitative/mixed/links
GET  /api/qualitative/mixed/links
POST /api/qualitative/mixed/joint-display
POST /api/qualitative/mixed/cross-reference
GET  /api/qualitative/mixed/convergence/{id}
```

### Export/Import APIs (REFI-QDA)
```
GET  /api/qualitative/export/refi-qda/{id}
GET  /api/qualitative/export/qdpx/{id}
GET  /api/qualitative/export/codebook/{id}
GET  /api/qualitative/export/codings/{id}
POST /api/qualitative/export/import-codebook/{id}
```

### Real-time Collaboration APIs
```
WS   /api/qualitative/realtime/ws/{project_id}
GET  /api/qualitative/realtime/presence/{id}
GET  /api/qualitative/realtime/cursors/{id}
GET  /api/qualitative/realtime/selections/{id}
POST /api/qualitative/realtime/sessions
GET  /api/qualitative/realtime/sessions
GET  /api/qualitative/realtime/activity/{id}
```

### Visualization APIs
```
GET  /api/qualitative/visuals/framework-matrix/{id}
GET  /api/qualitative/visuals/quote-cards/{id}
GET  /api/qualitative/visuals/quote-cards/{id}/export
GET  /api/qualitative/visuals/code-frequency-chart/{id}
GET  /api/qualitative/visuals/theme-network/{id}
GET  /api/qualitative/visuals/coding-timeline/{id}
GET  /api/qualitative/visuals/coverage-heatmap/{id}
```

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!
- Organization: ACME Research

## Changelog

### Feb 10, 2026 - Qualitative Module Complete
- **Phase 1-3**: Core MVP, AI features, advanced queries
- **Phase 4**: Mixed methods, REFI-QDA export, real-time collaboration, visuals
- **Testing**: 100% backend pass rate (69+ tests)

## Roadmap

### Completed ✅
- All Qualitative Analysis Module features (Phases 1-4)

### Known Issues
- None - All issues resolved

### Feb 10, 2026 - Final Bug Fix
- Fixed org_id mismatch preventing test data from appearing in UI
- Updated all qualitative collections to use correct org_id: `09872b0e-9cb6-4aac-b46d-54a709c7f4b6`
- Verified D3.js Theme Network visualization renders correctly (14 nodes, 7 connections)
- All features tested and working at 100% success rate

### P1 - Future Enhancements
- Full D3.js/force-directed theme network visualization ✅ IMPLEMENTED
- Video transcription support
- Real-time collaboration UI refinements
