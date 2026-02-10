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

### 3. Qualitative Analysis Module (100% Complete - Feb 10, 2026)

#### Phase 1 - Core MVP ✅
- **Projects**: Create, list, update, delete qualitative research projects
- **Sources**: Import transcripts, field notes, open-ended responses with metadata
- **Codebook**: Hierarchical code management with definitions, colors, shortcuts
- **Coding**: Apply codes to text excerpts with position tracking
- **Memos**: Analytic, methodological, reflexive, and procedural memos
- **Themes**: Build themes with supporting and counter evidence
- **Retrieval**: Query codings by code, text search, co-occurrence analysis
- **Statistics**: Project-level statistics and code frequency analysis

#### Phase 2 - Advanced Analysis & Governance ✅
- **AI-Assisted Transcription**: OpenAI Whisper integration with timestamp support
- **PII Controls**: Pattern + AI-based PII detection, one-click anonymization
- **Advanced Queries**:
  - Boolean queries (AND/OR/NOT operators)
  - Proximity search (codes within N characters)
  - Matrix coding queries (cross-tabulation by attributes)
  - Cross-case comparison analysis
- **Multi-Coder Collaboration**:
  - Coder assignments with deadlines
  - Blind coding mode (hide other coders' work)
  - Coding review workflow (submit, approve, reject)
- **Audit Trails**: Immutable logs for all coding/codebook changes
- **Inter-Coder Reliability**: Cohen's Kappa calculation
- **Code Version History**: Save and restore code versions

#### Phase 3 - AI-Native Features & Reporting ✅
- **AI Coding Suggestions**: GPT-5.2 suggests codes for excerpts with confidence levels
- **Auto-Code Source**: AI automatically codes entire documents
- **AI Theme Synthesis**: Generate draft themes from coded data
- **Report Generation**: JSON, Markdown, HTML report formats
- **Code Frequency Analysis**: Detailed usage statistics and coverage metrics

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
- OpenAI Whisper for transcription

### Frontend
- React with TailwindCSS + Shadcn/UI
- Zustand for state management
- Recharts for visualizations
- react-grid-layout for dashboards

### Qualitative Module API Endpoints

#### Core APIs
- `GET/POST /api/qualitative/projects` - Project management
- `GET/POST /api/qualitative/sources` - Source/transcript management
- `GET/POST /api/qualitative/codes` - Codebook management
- `GET/POST /api/qualitative/codings` - Code application to excerpts
- `GET/POST /api/qualitative/memos` - Research memos
- `GET/POST /api/qualitative/themes` - Theme management

#### AI APIs (Phase 2 & 3)
- `POST /api/qualitative/ai/transcribe` - Audio transcription (Whisper)
- `POST /api/qualitative/ai/suggest-codes` - AI coding suggestions
- `POST /api/qualitative/ai/auto-code-source/{id}` - Auto-code entire source
- `POST /api/qualitative/ai/detect-pii/{id}` - Detect PII patterns
- `POST /api/qualitative/ai/anonymize/{id}` - Anonymize source content
- `POST /api/qualitative/ai/synthesize-themes` - Generate draft themes
- `POST /api/qualitative/ai/generate-report/{id}` - Create analysis report
- `GET /api/qualitative/ai/icr/{id}` - Inter-coder reliability

#### Collaboration APIs
- `POST/GET /api/qualitative/collab/assignments` - Coder assignments
- `GET /api/qualitative/collab/blind-source/{id}` - Blind coding view
- `POST/GET /api/qualitative/collab/reviews` - Coding reviews
- `GET /api/qualitative/collab/audit-trail/{id}` - Audit logs
- `POST/GET /api/qualitative/collab/codes/{id}/versions` - Code history

#### Advanced Query APIs
- `POST /api/qualitative/query/boolean` - Boolean queries
- `POST /api/qualitative/query/proximity` - Proximity search
- `POST /api/qualitative/query/matrix` - Matrix coding
- `POST /api/qualitative/query/cross-case` - Cross-case comparison
- `GET /api/qualitative/query/code-frequency/{id}` - Code statistics

### MongoDB Collections (Qualitative)
- `qual_projects` - Qualitative research projects
- `qual_sources` - Source documents/transcripts
- `qual_codes` - Codebook codes
- `qual_codings` - Applied codings
- `qual_memos` - Research memos
- `qual_themes` - Themes/findings
- `qual_assignments` - Coder assignments
- `qual_reviews` - Coding reviews
- `qual_audit_logs` - Audit trail
- `qual_code_versions` - Code version history

## Key Files Reference

### Backend
- `routes/qualitative_routes.py` - Core qualitative API endpoints
- `routes/qualitative_ai_routes.py` - AI features (transcription, suggestions, themes)
- `routes/qualitative_collab_routes.py` - Collaboration features
- `routes/qualitative_query_routes.py` - Advanced queries
- `qualitative_models.py` - Pydantic models

### Frontend
- `pages/QualitativeAnalysisPage.jsx` - Project list and creation
- `pages/QualitativeWorkspacePage.jsx` - Coding studio with AI tools
- `layouts/DashboardLayout.jsx` - Navigation with Qualitative link
- `components/CommandPalette.jsx` - Quick navigation

## Test Credentials
- Email: demo@datapulse.io
- Password: Test123!
- Organization: ACME Research

## Changelog

### Feb 10, 2026 - Qualitative Module Complete
- **Phase 1 MVP**: Projects, Sources, Codes, Codings, Memos, Themes, Retrieval
- **Phase 2**: AI Transcription, PII Detection/Anonymization, Advanced Queries, Collaboration, Audit Trails, ICR
- **Phase 3**: AI Coding Suggestions, Auto-Coding, Theme Synthesis, Report Generation
- **Testing**: 97% pass rate (38/39 backend tests)

### Feb 9, 2026
- Public REST API for External Integrations
- Command Palette (⌘K) with keyboard shortcuts
- Mobile-Responsive Sidebar improvements
- Contextual Help System
- Onboarding Wizard

## Roadmap

### Completed ✅
- Qualitative Analysis Module - All Phases (1, 2, 3)

### P1 - Next Sprint
- Mixed methods support (link qualitative themes with quantitative variables)
- REFI-QDA export format for interoperability
- Real-time collaboration (WebSocket-based)

### P2 - Future
- Native mobile app wrapper
- Advanced export templates
- External integrations (Twilio, Power BI, Azure AD)

### Known Issues
- Onboarding wizard modal persists after localStorage clear (pre-existing)
- Session state occasionally lost during testing
