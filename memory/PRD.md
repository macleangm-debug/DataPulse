# DataPulse - Product Requirements Document

## Original Problem Statement
Build a modern, secure, scalable data collection platform similar to SurveyCTO, optimized for research, monitoring & evaluation, and field data collection. Support for online/offline data collection, strong data quality controls, and advanced analytics integrations.

## Target Users
- Research institutions
- NGOs
- Government agencies
- Market research firms
- Health & education programs

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn UI + Canva-style Navigation
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (multi-tenant)
- **Auth**: JWT + SSO (Software Galaxy integration ready)
- **PWA**: Service Worker + IndexedDB for offline support (with encryption)
- **UI Theme**: Violet/Purple color scheme inspired by Canva

---

## FINAL STATUS: DATA ANALYSIS MODULE - PRODUCTION READY (Last Update: Feb 8, 2026)

### Scalability & Robustness Implementation (Feb 8, 2026) - COMPLETE

**1. Data Loading Optimization**
- Cursor-based pagination with configurable limits
- Auto-sampling for datasets > 10K rows (configurable threshold)
- Memory-safe loading with MAX_ROWS_IN_MEMORY = 50,000
- Streaming data chunks for large exports
- Files: `/app/backend/utils/data_loader.py`, `/app/backend/config/scalability.py`

**2. Rate Limiting**
- Per-user/IP rate limiting using SlowAPI
- Statistics endpoints: 30 requests/minute
- Export endpoints: 10 requests/minute
- General API: 100 requests/minute
- Custom rate limit exceeded handler with retry-after
- File: `/app/backend/utils/rate_limiter.py`

**3. Background Job System**
- In-memory job manager (Redis-ready when available)
- Job status tracking: pending, running, completed, failed, cancelled
- Progress tracking with percentage updates
- Job result storage and cleanup
- API endpoints: GET/POST /api/jobs/
- Files: `/app/backend/utils/job_manager.py`, `/app/backend/routes/job_routes.py`

**4. Streaming Exports**
- Memory-efficient CSV/JSON streaming
- Chunked file generation (5000 rows/chunk)
- Progress tracking for large exports
- File: `/app/backend/utils/streaming_export.py`

**5. MongoDB Connection Pooling**
- minPoolSize: 5, maxPoolSize: 50
- maxIdleTimeMS: 30,000
- serverSelectionTimeoutMS: 5,000
- Updated in `/app/backend/server.py`

**6. Data Sampling Info in Responses**
- All statistics endpoints now return `data_info` metadata:
  - `is_sampled`: boolean
  - `total_count`: original dataset size
  - `loaded_count`: rows used in analysis
  - `sample_size`: sample size if sampled

### Code Refactoring (Feb 8, 2026) - COMPLETE

**Backend Refactoring** - Split `stats_routes.py` (2281 lines) into modular files:
```
/app/backend/routes/statistics/
├── __init__.py          # Router aggregation (45 lines)
├── utils.py             # Shared utilities (100 lines)
├── descriptive.py       # Descriptive stats (95 lines)
├── comparison.py        # T-tests, ANOVA, ANCOVA (280 lines)
├── correlation.py       # Pearson, Spearman (100 lines)
├── regression.py        # OLS, Logistic, Poisson, GLM (165 lines)
├── nonparametric.py     # Mann-Whitney, Kruskal-Wallis (175 lines)
├── clustering.py        # K-Means, Hierarchical (125 lines)
├── factor.py            # EFA, Reliability (195 lines)
└── proportions.py       # Chi-square, Proportions (155 lines)
```

**Frontend Refactoring** - Extracted components from `DataAnalysisPage.jsx`:
```
/app/frontend/src/pages/analysis/
├── index.js             # Exports
├── ResponseBrowser.jsx  # Response table component (120 lines)
├── SnapshotManager.jsx  # Snapshot CRUD component (135 lines)
├── FormSelector.jsx     # Form dropdown component (55 lines)
└── hooks/
    └── useAnalysisData.js  # Data fetching hooks (100 lines)
```

**Benefits:**
- Improved maintainability with domain-specific files
- Each file now < 300 lines
- Easier testing and debugging
- Better code organization
- Original routes preserved for backward compatibility

### Quick Analysis Wizard (Feb 8, 2026) - COMPLETE
- **New Component**: `/app/frontend/src/components/analysis/QuickAnalysis.jsx`
- **Features**:
  - 3-step guided wizard for statistical test selection
  - Step 1: Research goal selection (Compare Groups, Explore Relationships, Predict Outcomes, Describe Data, Test Proportions)
  - Step 2: Variable configuration with auto-detection of numeric/categorical types
  - Step 3: Smart recommendations with confidence scores and one-click "Run" buttons
- **Test Recommendations**:
  - Compare Groups: T-test, Mann-Whitney, ANOVA, Kruskal-Wallis (based on group count and normality)
  - Relationships: Pearson, Spearman correlation, Chi-square
  - Predictions: Linear, Logistic, Poisson regression
  - Supports paired/repeated measures detection
- **Integration**: Added to DataAnalysisPage in the Browse tab

### P2/P3 Features Implementation (Feb 8, 2026) - COMPLETE
1. **Replicate Weights UI** (P2)
   - Added new "Rep Wt" tab in Survey Statistics panel
   - Supports BRR, Jackknife, and Bootstrap methods
   - Configurable Fay coefficient for BRR (0-1 slider)
   - PSU/Cluster variable selection for delete-a-group jackknife
   - Bootstrap replicate count configuration (50-500)
   - Connected to `/api/statistics/survey/replicate-weights` endpoint

2. **Enhanced AI Narrative Evidence Linking** (P2)
   - Improved narrative generator with explicit table/chart references
   - Added evidence links with citation counts
   - Supports ANOVA, T-tests, Correlation, Regression results
   - Bold formatting for section headers (**Sample Overview**, **ANOVA Results**, etc.)
   - Displays effect sizes and interpretation levels
   - Dark mode compatible styling

3. **Enhanced Design-Based Regressions** (P3)
   - Added Negative Binomial model type
   - Added interaction term support (var1*var2 format)
   - Automatic interaction column generation
   - Model diagnostics (Durbin-Watson, Jarque-Bera, condition number)
   - Files modified:
     - `/app/backend/routes/stats_routes.py` - Added negbin model, interactions, diagnostics
     - `/app/frontend/src/components/analysis/SurveyStatsPanel.jsx` - New Rep Wt tab, enhanced regression UI
     - `/app/frontend/src/components/analysis/EnhancedAICopilot.jsx` - Enhanced narrative generation

### Online Status Quick Links & Enhanced Settings (Feb 8, 2026) - COMPLETE
- **Online Status Moved**: Relocated from bottom of sidebar to top, with dropdown containing quick navigation links
- **Quick Links Added**: Dashboard, Recent Projects, Recent Forms, New Form, Data Analysis, Submissions, Settings
- **Settings Module Enhanced**: Added new tabs and sections:
  - **Security Tab**: Password change, Connected devices management, Session timeout settings
  - **Privacy Tab**: Privacy settings, Data & storage management, Danger zone (delete account)
  - Total of 7 tabs: Profile, Appearance, Alerts, Security, Privacy, Org, API
- **Files Modified**:
  - `/app/frontend/src/layouts/DashboardLayout.jsx` - Moved Online status, added dropdown
  - `/app/frontend/src/pages/SettingsPage.jsx` - Added Security and Privacy tabs with full functionality

### UI Dark Mode Fix (Feb 8, 2026) - COMPLETE
- **Issue**: Cards across the application had poor contrast and visibility in dark mode
- **Root Cause**: DashboardLayout used hardcoded light theme colors (bg-slate-50, bg-white) while cards used CSS variables that correctly adapted to dark mode
- **Fix Applied**:
  - Updated DashboardLayout.jsx to use CSS variable-based classes (bg-background, bg-card, text-foreground, etc.)
  - Updated index.css dark mode CSS variables with better contrast ratios
  - Removed shadow from Card component that was affecting visual appearance
  - Updated ProjectsPage.jsx text colors to use semantic classes
- **Files Modified**:
  - `/app/frontend/src/layouts/DashboardLayout.jsx`
  - `/app/frontend/src/index.css`
  - `/app/frontend/src/components/ui/card.jsx`
  - `/app/frontend/src/pages/ProjectsPage.jsx`

### Data Analysis Module - Complete Implementation
- **Statistical Tests**: T-tests, ANOVA, Correlation, Regression (OLS/Logistic), GLM, Mixed Models, Factor Analysis, Nonparametric Tests, Proportions Tests, Clustering
- **Survey Statistics**: Complex survey design, weighted estimates, design-based regression
- **Data Operations**: Missing data imputation (8 methods), transformations, snapshots
- **Visualizations**: 10 chart types including violin, coefficient plots, heatmaps, dashboard drill-down
- **Reports**: PDF/Word/HTML export, reproducibility packs with scripts and data
- **Security**: Audit trail for all actions, RBAC with 4 roles and 28 permissions
- **AI Copilot**: Natural language to analysis with auto-execute

### Final Test Results
- **Iteration 25**: 100% backend (23/23), 100% frontend - All features verified
- **Critical Issues**: NONE

---

## P0 - Core Data Collection (COMPLETE)

### Paradata/Audit Trail System
- [x] Industry-standard paradata capture
- [x] Time on question tracking
- [x] Navigation patterns
- [x] Edit history
- [x] Pause detection
- [x] GPS trail

### Submission Revision Chain
- [x] Version chain (v1 → v2 → v3)
- [x] Field-level diffs
- [x] Locking mechanism
- [x] Correction workflow

### Lookup Datasets Module
- [x] Schools, facilities, sampling frames
- [x] Offline support
- [x] Write-back capability

---

## P1 - Field Operations (COMPLETE)

### Token/Panel Surveys (869 LOC)
- [x] Survey Distribution Management
- [x] Token-based, CAWI, Panel, Public Link modes
- [x] Multiple submissions toggle
- [x] Save & continue functionality
- [x] Automated reminders
- [x] Invite Management (single/bulk, CSV import)
- [x] Panel Surveys with wave tracking

### CATI Center (779 LOC)
- [x] Project Management
- [x] Interviewer Workstation
- [x] Call Disposition System (15 codes)
- [x] Callback scheduling
- [x] Call queue with priority
- [x] Statistics dashboard

### Back-check Quality Control (785 LOC)
- [x] Sampling methods (Random, Stratified, Systematic, Targeted)
- [x] Sample percentage configuration
- [x] Verification field selection
- [x] Discrepancy detection & severity
- [x] Back-check queue management
- [x] Enumerator quality reports

### Preload & Write-back (829 LOC)
- [x] Multiple source types
- [x] Field mapping with transformations
- [x] Write-back triggers
- [x] External API integration
- [x] Execution logging

---

## P2 - Quality & AI Monitoring (COMPLETE)

### Interview Speeding Detection (936 LOC total)
- [x] Min expected completion time
- [x] Warning/critical thresholds
- [x] Auto-flag critical submissions
- [x] Median time calculation

### Audio Audit
- [x] Audio field selection
- [x] Minimum duration requirement
- [x] Sample percentage
- [x] Compliance checking

### AI Monitoring Assistant (GPT-5.2)
- [x] Speeding detection
- [x] Straight-lining detection
- [x] Response anomaly detection
- [x] GPS anomaly detection
- [x] Duplicate detection
- [x] AI Deep Analysis with recommendations

### Barcode & Signature Capture
- [x] BarcodeCapture component (camera-based)
- [x] SignatureCapture component (canvas-based)
- [x] Integrated into Form Builder

---

## P3 - Platform Features (COMPLETE)

### True Offline-First CAPI
- [x] **ENCRYPTED** IndexedDB storage (AES-GCM 256-bit) ✅ NEW
- [x] Automatic key management with PBKDF2
- [x] Secure key derivation from user credentials
- [x] useOfflineSync hook
- [x] Conflict resolution
- [x] Background sync
- [x] Storage management UI

### Plugin/Widget SDK
- [x] WidgetRegistry class
- [x] PluginManager class
- [x] Custom validation hooks
- [x] Lifecycle hooks
- [x] External plugin loading
- [x] Example widgets (Star Rating, NPS, Matrix)

### CAWI Enhancements
- [x] Multi-page navigation
- [x] Progress saving
- [x] Auto-save (30 sec)
- [x] Session resumption
- [x] Offline support

---

## GAP FEATURES IMPLEMENTED (Feb 6, 2026)

### 1. Encrypted IndexedDB Storage ✅
- **File**: `/app/frontend/src/lib/encryptedStorage.js`
- AES-GCM 256-bit encryption using Web Crypto API
- PBKDF2 key derivation from user credentials
- IV per record for security
- Secure wipe functionality

### 2. AI Field Simulation ✅
- **Backend**: `/app/backend/routes/simulation_routes.py`
- **Frontend**: `/app/frontend/src/pages/SimulationPage.jsx`
- Synthetic path testing through forms
- Detect dead-ends and unreachable questions
- Validate skip logic completeness
- Estimate interview duration distribution
- AI-powered insights (GPT-5.2)

### 3. Remote Wipe / Device Management ✅
- **Backend**: `/app/backend/routes/device_routes.py`
- **Frontend**: `/app/frontend/src/pages/DeviceManagementPage.jsx`
- Device registration and tracking
- Remote device lock/unlock with unlock codes
- Remote data wipe (full or submissions-only)
- Device revocation
- Activity monitoring and audit logs
- Bulk operations for multiple devices

### 4. Enhanced Roster/Repeat Groups ✅
- **File**: `/app/frontend/src/components/RosterGroup.jsx`
- Add/remove roster entries dynamically
- Carry-forward values from previous entries
- Computed variables within rosters
- Validation per entry
- Configurable min/max entries
- "Add another" UX with confirmation
- Roster-level aggregations (sum, avg, count, min, max)
- useRoster hook for state management

---

## Additional Features (COMPLETE)

### Advanced Analytics Dashboard
- [x] Overview, Submissions, Quality, Performance tabs
- [x] Time period filters
- [x] CSV export
- [x] Interactive Recharts

### Role-Based Access Control
- [x] 5 System Roles
- [x] 31 granular permissions
- [x] Custom role creation
- [x] User assignments

### Workflow Automation
- [x] 7 Trigger types
- [x] 9 Action types
- [x] 8 Condition operators
- [x] 4 Pre-built templates

### Multi-Language Support
- [x] 14 Languages
- [x] RTL support
- [x] Translation glossary
- [x] Form batch translation

### Form Logic Visualization
- [x] React Flow integration
- [x] Field/condition/calculation nodes
- [x] Interactive controls

### API Security & Rate Limiting
- [x] API Key Management
- [x] Rate limit tiers
- [x] Audit logs
- [x] Security settings

### Super Admin Dashboard
- [x] Organization management
- [x] Billing tiers (Free/Pro/Enterprise)
- [x] Invoice generation
- [x] Usage alerts
- [x] System analytics

---

## Test Credentials
- **Email**: test@datapulse.io
- **Password**: password123

## API Base URL
- **Production**: https://stats-preview-fix.preview.emergentagent.com

## Backend Routes (35 modules)
All routes under `/app/backend/routes/`:
- auth_routes.py, org_routes.py, project_routes.py
- form_routes.py, submission_routes.py, case_routes.py
- cati_routes.py (779 LOC), backcheck_routes.py (785 LOC)
- quality_ai_routes.py (936 LOC), survey_routes.py (869 LOC)
- preload_routes.py (829 LOC), dataset_routes.py
- analytics_routes.py, rbac_routes.py, workflow_routes.py
- translation_routes.py, security_routes.py, admin_routes.py
- paradata_routes.py, revision_routes.py, cawi_routes.py
- **simulation_routes.py** (NEW), **device_routes.py** (NEW)
- And more...

## Frontend Pages (30 pages)
All pages under `/app/frontend/src/pages/`:
- DashboardPage, ProjectsPage, FormsPage, FormBuilderPage
- CATIPage, BackcheckPage, TokenSurveysPage, PreloadWritebackPage
- QualityAIPage, AnalyticsPage, RBACPage, WorkflowsPage
- TranslationsPage, SecurityPage, SuperAdminPage, DatasetsPage
- PluginsPage, CAWISurveyPage
- **SimulationPage** (NEW), **DeviceManagementPage** (NEW)
- And more...

---

## PRD Checklist Status (All Items Complete)

| Section | Feature | Status |
|---------|---------|--------|
| 2.1 | Survey Instrument (versioned) | ✅ |
| 2.2 | Datasets (Lookup Tables) | ✅ |
| 2.3 | Cases Dataset | ✅ |
| 2.4 | Submission states | ✅ |
| 2.5 | Paradata | ✅ |
| 3.1 | CAWI | ✅ |
| 3.2 | Token/Panel | ✅ |
| 3.3 | CAPI Offline | ✅ |
| 3.4 | CATI | ✅ |
| 4.1 | Encrypted local DB | ✅ (NEW) |
| 4.1 | Outbox queue | ✅ |
| 4.1 | Conflict resolution | ✅ |
| 4.4 | Barcode/QR scan | ✅ |
| 4.4 | Signature capture | ✅ |
| 4.5 | Remote wipe | ✅ (NEW) |
| 5.1 | Skip logic | ✅ |
| 5.1 | Calculations | ✅ |
| 5.2 | Repeat groups/Rosters | ✅ (ENHANCED) |
| 5.3 | Preload/Write-back | ✅ |
| 6.1 | Audio Audit | ✅ |
| 6.2 | Paradata | ✅ |
| 6.3 | Quality Rules | ✅ |
| 7.x | Monitoring Console | ✅ |
| 7.4 | Back-check | ✅ |
| 8 | Review Workflow | ✅ |
| 9.1 | AI Instrument QA | ✅ |
| 9.2 | AI Field Simulation | ✅ (NEW) |
| 9.3 | AI Monitoring | ✅ |
| 10 | Plugin SDK | ✅ |
| 11 | Security | ✅ |

---

## PROJECT 100% COMPLETE
All requested features from the PRD checklist have been implemented and tested.
Gap features implemented: Feb 6, 2026

---

## DATA ANALYSIS MODULE - PHASE 1 (COMPLETE - Feb 7, 2026)

### Implementation Summary
The Data Analysis Module provides research-grade statistical analysis capabilities.

### Features Implemented

#### 1. Response Browsing & Filtering ✅
- **API**: `/api/analysis/responses/browse`
- Paginated response browsing
- Multi-field filtering support
- Preview data display
- Status filtering

#### 2. Basic Statistics ✅
- **API**: `/api/analysis/stats/quick`
- Frequencies for categorical variables
- Descriptives for numeric variables (mean, std, min, max, quartiles)
- Sample size (N) reporting

#### 3. Cross-tabulation ✅
- **API**: `/api/analysis/stats/crosstab`
- Row x Column cross-tabs
- Chi-square test with p-value
- Row and column percentages
- Margin totals

#### 4. Advanced Descriptives ✅
- **API**: `/api/statistics/descriptives`
- Full descriptive statistics
- Normality tests (Shapiro-Wilk, D'Agostino-Pearson)
- Skewness and kurtosis

#### 5. Data Exports ✅
- **API**: `/api/export/download`
- CSV with labels
- Excel (multi-sheet with codebook)
- SPSS (.sav) with variable/value labels
- Stata (.dta) with labels
- Parquet (columnar format)
- Codebook generation

#### 6. Dataset Snapshots ✅
- **API**: `/api/analysis/snapshots/*`
- Create immutable point-in-time snapshots
- List and manage snapshots
- Reproducibility support

#### 7. AI Copilot ✅
- **API**: `/api/ai-copilot/analyze`
- Natural language to analysis plan
- Query understanding and method recommendation
- Variable identification from schema
- Full traceability and citations

---

## DATA ANALYSIS MODULE - PHASE 2 (COMPLETE - Feb 7, 2026)

### Features Implemented

#### 1. Variable View ✅
- New "Variables" tab in Data Analysis page
- Table showing: Variable ID, Label, Type, Values, Required
- Visual display of variable options
- Form metadata management interface

#### 2. Advanced Statistics Panel ✅
- **Component**: `/app/frontend/src/components/analysis/AdvancedStatsPanel.jsx`
- 4 sub-tabs: T-Test, ANOVA, Correlation, Regression
- Interactive configuration panels
- Results visualization with statistical interpretation

#### 3. T-Tests ✅
- **API**: `/api/statistics/ttest`
- Independent samples t-test (Levene's test for homogeneity)
- One-sample t-test
- Effect size (Cohen's d) with interpretation
- 95% Confidence intervals

#### 4. ANOVA ✅
- **API**: `/api/statistics/anova`
- One-way ANOVA
- F-statistic and p-value
- Group statistics (N, Mean, SD)
- Effect size (η²)
- Post-hoc Tukey HSD comparisons

#### 5. Correlation Matrix ✅
- **API**: `/api/statistics/correlation`
- Pearson, Spearman, Kendall methods
- Full correlation matrix with p-values
- Significance markers
- Pairwise correlation extraction

#### 6. Regression Analysis ✅
- **API**: `/api/statistics/regression`
- OLS (Ordinary Least Squares)
- Logistic regression support
- Model fit (R², Adjusted R², F-statistic)
- Coefficients table with SE, t-value, p-value
- Robust standard errors option
- Model diagnostics (AIC, BIC)

### UI Updates
- 7 tabs: Browse, Variables, Basic Stats, Advanced, Charts, AI Copilot, Export
- AdvancedStatsPanel with results visualization
- Statistical significance indicators
- Effect size interpretations

### Test Results
- Backend: 14/14 tests passed (100%)
- Frontend: All 7 tabs verified working
- Bug fixed: numpy.bool serialization in regression API

### Frontend (DataAnalysisPage.jsx)
- **Route**: `/analysis`
- 5 Tabs: Browse, Statistics, Charts, AI Copilot, Export
- Form selection dropdown
- Response pagination
- Export format cards
- Integrated with Canva-style navigation

### Libraries Used
- **pandas**: Data manipulation
- **numpy**: Numerical computing
- **scipy**: Statistical tests
- **statsmodels**: Advanced statistics
- **pingouin**: Post-hoc tests
- **pyreadstat**: SPSS/Stata export
- **pyarrow**: Parquet export
- **emergentintegrations**: AI Copilot (GPT-5.2)

### Test Data
- Organization: "Test Organization" (id: ad326e2a-f7a4-4b3f-b4d2-0e1ba0fd9fbd)
- Form: "MobilePayment" (id: 124427aa-d482-4292-af6e-2042ae5cabbd)
- 50 test submissions with: age, gender, satisfaction, recommend, comments

---

## DATA ANALYSIS MODULE - PHASE 3 (COMPLETE - Feb 7, 2026)

### Features Implemented

#### 1. Chart Studio ✅
- **Component**: `/app/frontend/src/components/analysis/ChartStudio.jsx`
- 7 Chart Types: Bar, Horizontal Bar, Pie, Donut, Line, Area, Scatter
- 6 Color Palettes: Default, Pastel, Dark, Monochrome, Warm, Cool
- Customization: Title, Subtitle, Legend, Grid, Value Labels, Label Rotation
- PNG Export via Canvas conversion
- Data Summary Table preview
- Interactive chart configuration panel

#### 2. Enhanced AI Copilot ✅
- **Component**: `/app/frontend/src/components/analysis/EnhancedAICopilot.jsx`
- Auto-execute toggle for instant analysis
- Conversation history with timestamps
- Suggested Queries panel with 4 categories:
  - Descriptive (summary stats, frequencies, distribution)
  - Comparison (group comparisons, t-tests, ANOVA)
  - Relationship (correlations, associations)
  - Trends (patterns, changes over time)
- Data Context info (Variables, Numeric, Categorical counts)
- Copy results to clipboard
- Expandable results view
- Clear history function

### Test Results
- Frontend: 100% verified
- All chart types working
- AI Copilot conversation flow working
- Auto-execute and suggested queries functional

---

## DATA ANALYSIS MODULE - PHASE 4 (COMPLETE - Feb 7, 2026)

### Features Implemented

#### 1. Report Builder ✅
- **Backend**: `/app/backend/routes/report_routes.py`
- **Frontend**: `/app/frontend/src/components/analysis/ReportBuilder.jsx`
- Create reports with multiple sections (Text, Table, Chart, Page Break)
- Report templates (Summary, Detailed Analysis)
- Export formats: PDF (WeasyPrint), Word (python-docx), HTML
- Auto-include methodology and appendix
- Report metadata: title, subtitle, author

#### 2. Reproducibility Pack ✅
- **Backend**: `/app/backend/routes/reproducibility_routes.py`
- One-click export of complete analysis bundle
- ZIP contains:
  - README.md with instructions
  - data/dataset.csv and dataset.json
  - documentation/codebook.md and schema.json
  - analyses/*.json (AI analyses)
  - scripts/analysis.py (reproducible Python script)
  - metadata/pack_info.json and run_log.txt
- Data anonymization option (strips PII fields)
- SHA-256 hash for integrity verification
- Software version logging

### APIs
- `POST /api/reports` - Create report
- `GET /api/reports/templates/{org_id}` - List templates
- `POST /api/reports/generate` - Generate PDF/Word/HTML
- `POST /api/reproducibility/pack` - Create pack
- `GET /api/reproducibility/pack/{id}/download` - Download ZIP

---

## DATA ANALYSIS MODULE - PHASE 5 (COMPLETE - Feb 7, 2026)

### Complex Survey Statistics

#### 1. Survey Design Specification ✅
- Strata variable support
- PSU/Cluster variable support
- Sampling weight variable
- Finite Population Correction (FPC)
- Nested design support

#### 2. Survey-Weighted Estimates ✅
- **API**: `/api/survey/mean` - Weighted mean with design-based SE
- **API**: `/api/survey/proportion` - Weighted proportions with CI
- **API**: `/api/survey/total` - Population totals with SE

#### 3. Design Effects Reporting ✅
- **API**: `/api/survey/design-effects`
- DEFF calculation per variable
- Effective sample size computation
- Interpretation (No effect / Low / Moderate / High / Very High)

#### 4. Survey Regression ✅
- **API**: `/api/survey/regression`
- Weighted OLS with cluster-robust SE
- Weighted logistic regression
- Model fit statistics (R², AIC, BIC)
- Coefficient table with CI

### Implementation
- Uses `statsmodels` for weighted regression
- Cluster-robust SE via `cov_type='cluster'`
- Stratified SE computation
- Taylor linearization for variance estimation

---

## FRONTEND INTEGRATION (COMPLETE - Feb 7, 2026)

### Data Analysis Page Tabs (10 total)
1. **Browse** - Response browsing with pagination
2. **Variables** - Variable metadata view
3. **Stats** - Basic statistics (frequencies, descriptives, crosstabs)
4. **Advanced** - T-tests, ANOVA, Correlation, Regression, **GLM, Mixed Models**
5. **Survey** - Complex survey statistics (weighted, design-based)
6. **Charts** - Chart Studio (7 types, 6 palettes)
7. **Dashboards** - Interactive Dashboard Builder (drag-drop widgets)
8. **AI** - Enhanced AI Copilot (auto-execute, suggestions)
9. **Reports** - Report Builder (PDF/Word/HTML export)
10. **Export** - Data exports (CSV, Excel, SPSS, Stata, Parquet)

### Components Created
- `/app/frontend/src/components/analysis/AdvancedStatsPanel.jsx` (6 sub-tabs: T-Test, ANOVA, Correlation, Regression, GLM, Mixed)
- `/app/frontend/src/components/analysis/ChartStudio.jsx`
- `/app/frontend/src/components/analysis/EnhancedAICopilot.jsx`
- `/app/frontend/src/components/analysis/ReportBuilder.jsx`
- `/app/frontend/src/components/analysis/SurveyStatsPanel.jsx`
- `/app/frontend/src/components/analysis/DashboardBuilder.jsx` (NEW - Feb 7, 2026)

---

## PHASE 6 & 7 COMPLETE (Feb 7, 2026)

### Phase 6: Interactive Dashboards - FULLY COMPLETE
- ✅ Dashboard CRUD endpoints (`/api/dashboards/*`)
- ✅ Widget system (stat, chart, table, text types)
- ✅ Filter controls with options retrieval
- ✅ Dashboard data computation with applied filters
- ✅ Share permissions (viewer, editor, public with password)
- ✅ Frontend Dashboard Builder UI with drag-drop (react-grid-layout)
- ✅ Widget configuration dialogs (stat, chart, table, text)
- 🔲 Drill-down capability (future)

### Phase 7: Advanced Models - FULLY COMPLETE
- ✅ GLM (Generalized Linear Models) - `/api/models/glm`
  - Gaussian, Binomial, Poisson, Gamma, Inverse Gaussian, Negative Binomial families
  - Customizable link functions (Identity, Log, Logit, Probit, Inverse, Sqrt)
  - Frontend UI in AdvancedStatsPanel
- ✅ Mixed Models (LMM) - `/api/models/mixed`
  - Random intercepts and slopes
  - ICC calculation
  - REML estimation
  - Frontend UI in AdvancedStatsPanel
- ✅ Margins/Predicted Probabilities - `/api/models/margins`
- ✅ Predictions endpoint - `/api/models/predict`
- ✅ Frontend UI for GLM/Mixed Models in AdvancedStatsPanel

### Phase 8: Reports & Reproducibility - FULLY COMPLETE (Feb 7, 2026)
- ✅ Report Builder with 3 export formats:
  - PDF (using reportlab - pure Python)
  - Word/DOCX (using python-docx)
  - HTML
- ✅ Report sections: Text, Table, Page Break
- ✅ Reproducibility Packs:
  - Creates complete analysis bundles (ZIP)
  - Includes: README, dataset (CSV/JSON), schema, codebook, scripts, metadata
  - Hash for integrity verification
  - Anonymization option for PII redaction
- ✅ Frontend UI in Reports tab with two sub-tabs:
  - Reports: Builder with export buttons
  - Reproducibility: Pack list + creation form

### Phase 9: Factor Analysis - COMPLETE (Feb 7, 2026)
- ✅ Backend endpoint `/api/statistics/factor-analysis`
  - KMO sampling adequacy with interpretation
  - Bartlett's sphericity test
  - Eigenvalue decomposition (scree plot data)
  - Factor loadings with varimax rotation option
  - Communalities calculation
  - Factor interpretation (high loading variables)
- ✅ Frontend UI in Advanced Stats panel (7th tab: EFA)
  - Variable selection (min 3 required)
  - Number of factors input (auto or custom)
  - Rotation method dropdown
  - Results display: summary stats, KMO/Bartlett, loading matrix, factor summary

### Phase 10: Missing Data Imputation - COMPLETE (Feb 7, 2026)
- ✅ Backend endpoints:
  - `/api/analysis/imputation/missing-summary/{form_id}` - Get missing data statistics
  - `/api/analysis/imputation/preview` - Preview imputation without applying
  - `/api/analysis/imputation/apply` - Apply imputation and create new snapshot
- ✅ 8 Imputation methods:
  - Mean, Median (numeric only)
  - Mode (most frequent)
  - Constant (user-defined)
  - Forward Fill, Backward Fill
  - Linear Interpolation (numeric only)
  - Drop Rows with missing
- ✅ Features:
  - Group-wise imputation (calculate mean/median within groups)
  - Before/after preview with sample changes
  - Creates immutable snapshot with transformation metadata
- ✅ Frontend UI in Variables tab → Missing Data sub-tab

### Phase 11: Dashboard Drill-Down & Advanced Charts - COMPLETE (Feb 7, 2026)
- ✅ **Dashboard Drill-Down**:
  - Click on chart elements to filter all other widgets
  - Drill-down indicator shows active filter with Clear button
  - Combines with regular filters in API calls
  - Works with bar, pie, donut, and line charts
- ✅ **New Chart Types in Chart Studio** (10 total):
  - Bar, Horizontal Bar, Pie, Donut, Line, Area, Scatter (existing)
  - **Violin Plot** - Distribution visualization with quartiles
  - **Coefficient Plot** - Regression coefficients with confidence intervals
  - **Heatmap** - Correlation matrix visualization
- ✅ **Backend Endpoints**:
  - `/api/analysis/charts/heatmap` - Correlation matrix for 2+ numeric vars
  - `/api/analysis/charts/violin` - Distribution stats with percentiles
  - `/api/analysis/charts/coefficient` - OLS regression with confidence intervals

### Phase 12: Audit Trail & RBAC - COMPLETE (Feb 7, 2026)
- ✅ **Audit Trail System**:
  - `/api/audit/log` - Create audit log entries
  - `/api/audit/logs` - Paginated logs with filtering
  - `/api/audit/summary/{org_id}` - Activity summary with aggregations
  - `/api/audit/exports/{org_id}` - Export-specific history
  - Action types: export_*, transform_*, snapshot_*, dashboard_*, report_*, pii_access
- ✅ **Role-Based Access Control (RBAC)**:
  - 4 default roles: Viewer, Analyst, Senior Analyst, Admin
  - 28 granular permissions across 7 categories
  - Custom role creation and management
  - Permission checking endpoint
- ✅ **Frontend Audit Trail UI** in Reports tab → Audit Trail sub-tab:
  - Summary cards (Total Actions, Exports, PII Access, Active Users)
  - Paginated activity log with filtering
  - Activity breakdown by action type

### Phase 13: Statistical Tests Completion - COMPLETE (Feb 7, 2026)
- ✅ **Nonparametric Tests** (`/api/statistics/nonparametric`):
  - Mann-Whitney U test (2 independent groups)
  - Wilcoxon signed-rank test (paired samples)
  - Kruskal-Wallis H test (3+ groups with post-hoc)
- ✅ **Proportions Tests** (`/api/statistics/proportions`):
  - One-sample z-test for proportions
  - Two-sample proportions comparison
  - Chi-square test with Cramér's V
- ✅ **Clustering Algorithms** (`/api/statistics/clustering`):
  - K-means with elbow method and silhouette scores
  - Hierarchical clustering with dendrogram
  - Cluster profiles with variable means

### Phase 14: Module Complete ✅
All major features from the Data Analysis Module checklist have been implemented.

---

## UPDATE: Feb 8, 2026 - Final Features Completed

### Features Completed
1. **Replicate Weights (BRR/Jackknife/Bootstrap)**
   - BRR (Balanced Repeated Replication) with Fay adjustment
   - Delete-a-group Jackknife for clustered designs
   - Bootstrap variance estimation with percentile CI
   - Design effect and effective sample size calculation
   - CV-based reliability assessment

2. **Dashboard Sharing Permissions UI**
   - Public/Private toggle with password protection
   - User access management (add/remove users)
   - Role-based permissions (Viewer/Editor)
   - Embed code generation for external sites
   - Link sharing with copy functionality

3. **Enhanced AI Narratives with Evidence Linking**
   - Auto-generated narrative summaries
   - Evidence verification badges
   - Source endpoint attribution
   - Interpretation verification

4. **Parquet Export**
   - Efficient columnar storage format
   - PyArrow engine for fast export
   - Preserves data types

### Backend Endpoints Added
- `POST /api/statistics/survey/replicate-weights` - BRR/Jackknife/Bootstrap
- `POST /api/exports/parquet` - Parquet format export
- `POST /api/dashboards/{id}/share` - Enhanced sharing

### Frontend Enhancements
- DashboardBuilder: Full sharing dialog with tabs (Link/Users/Embed)
- EnhancedAICopilot: Evidence-linked narrative generation

### Dependencies Added
- `pyarrow==23.0.0` - Parquet support
- `fastparquet==2025.12.0` - Parquet support

---

## UPDATE: Feb 8, 2026 - Proportions Tests & PPTX Export

### Features Completed
1. **Proportions Tests** (new Props tab in Advanced Statistics)
   - One-Sample Z-Test: Test observed vs hypothesized proportion
   - Two-Sample Z-Test: Compare proportions between groups with Cohen's h
   - Chi-Square Goodness of Fit: Test distribution against expected proportions
   - Full results with CI, effect sizes, standardized residuals

2. **PowerPoint Export**
   - Export charts as PPTX slides with title/subtitle
   - Widescreen 16:9 format
   - Centered chart with footer
   - New format option in ChartStudio dropdown

### Backend Endpoints Added
- `POST /api/statistics/proportions` - All three proportions test types
- `POST /api/analysis/export-chart-pptx` - PowerPoint slide generation

### Frontend Changes
- Advanced Statistics now has 11 tabs (added Props)
- ChartStudio export dropdown now includes PPTX option

### Dependencies Added
- `python-pptx==1.0.2` - PowerPoint generation

---

## UPDATE: Feb 8, 2026 - AI-Assisted Data Preparation

### Features Completed
**AI Data Preparation Assistant** - Full implementation ✅

1. **Data Quality Analysis**
   - Missing data detection (high/medium/low priority by percentage)
   - Outlier detection using IQR method
   - Distribution skewness analysis
   - Zero variance detection
   - Duplicate row detection

2. **Categorical Data Analysis**
   - Inconsistent labels (case/whitespace variations)
   - Rare categories (< 2%)
   - High cardinality warnings
   - Identifier column detection

3. **Dataset-Level Checks**
   - Sample size warnings (< 30)
   - Multicollinearity detection (r > 0.9)

4. **Actionable Transformations**
   - Imputation (mean, median, mode)
   - Outlier handling (winsorize, remove)
   - Log/sqrt transformations
   - Case standardization
   - Duplicate removal

### Backend
- `POST /api/analysis/data-prep-suggestions` - Analyze data and return suggestions
- `POST /api/analysis/apply-transformation` - Apply selected transformation to snapshot

### Frontend
- New "Data Prep" sub-tab under AI tab
- Collapsible suggestion cards with priority badges
- One-click action buttons for transformations
- Refresh capability after applying changes

---

## UPDATE: Feb 8, 2026 - ANCOVA Implementation

### Features Completed
1. **ANCOVA (Analysis of Covariance)**
   - Compare group means while controlling for continuous covariates
   - Displays raw vs adjusted means for each group
   - Effect sizes: Partial η² with interpretation
   - Covariate regression coefficients and significance
   - Post-hoc pairwise comparisons with Bonferroni correction
   - Model fit statistics (R², Adjusted R²)
   - Interpretive text

### Backend
- `POST /api/statistics/ancova` - Full ANCOVA analysis
- Uses statsmodels for Type II ANOVA (correct for unbalanced designs)
- Returns adjusted means estimated at covariate means

### Frontend
- New "ANCOVA" tab in AdvancedStatsPanel (now 10 tabs total)
- Configuration: dependent variable, grouping factor, multiple covariates
- Rich results display with tables, badges, and effect interpretations

---

## UPDATE: Feb 8, 2026 - Diagnostic Visualizations Implemented

### Features Completed
1. **ROC Curve Analysis**
   - Binary classification evaluation
   - AUC calculation with 95% CI (bootstrap)
   - Optimal threshold detection (Youden's J)
   - Visual curve with diagonal reference
   - Interpretation text

2. **Residual Diagnostics**
   - Residuals vs Fitted plot
   - Q-Q plot for normality assessment
   - Scale-Location plot for heteroscedasticity
   - Diagnostic tests: Shapiro-Wilk, Durbin-Watson, Breusch-Pagan
   - Color-coded pass/fail indicators

### Backend Endpoints Added
- `POST /api/statistics/diagnostics/roc` - Generate ROC curve data
- `POST /api/statistics/diagnostics/residuals` - Generate residual plot data

### Files Created/Modified
- `/app/frontend/src/components/analysis/DiagnosticPlots.jsx` (NEW)
- `/app/frontend/src/pages/DataAnalysisPage.jsx` (MODIFIED - added Diag tab)
- `/app/backend/routes/stats_routes.py` (MODIFIED - added diagnostic endpoints)

---

## UPDATE: Feb 8, 2026 - Frontend UI for NonParametric Tests & Clustering

### Features Completed
1. **Nonparametric Tests UI** (NonP tab in Advanced Statistics)
   - Mann-Whitney U test (2 independent groups)
   - Wilcoxon Signed-Rank test (paired samples)
   - Kruskal-Wallis H test (3+ groups with post-hoc)
   - Contextual info text for each test type

2. **Clustering UI** (Cluster tab in Advanced Statistics)
   - K-Means clustering with auto-detection (elbow method)
   - Hierarchical clustering with linkage options (Ward, Complete, Average, Single)
   - Cluster profile visualization
   - Silhouette score display

### Components Updated
- `/app/frontend/src/components/analysis/AdvancedStatsPanel.jsx`
  - Now has 9 tabs: T-Test, ANOVA, Corr, Reg, GLM, Mixed, EFA, NonP, Cluster
  - Added NonparametricResults and ClusteringResults components
  - Added state management for nonparametric and clustering configurations

### Bug Fixes
- Fixed numpy.bool serialization in Wilcoxon test (stats_routes.py line 1048)
- Fixed numpy.bool serialization in Kruskal-Wallis post-hoc (stats_routes.py line 1102)

### Test Results (Iteration 26)
- Backend: 100% (11/11 tests passed)
- Frontend: 100% - All 9 tabs verified working

---

## UPDATE: Feb 8, 2026 - Security Decorators Applied

### Features Completed
1. **Security Utilities Created** (`/app/backend/utils/security.py`)
   - `@requires_permission(permission)` - Checks user has specific permission
   - `@requires_role([roles])` - Checks user role membership
   - `check_permission()` - Inline permission checking
   - `get_user_permissions()` - Fetches user permissions from DB

2. **Audit Logging Utilities Created** (`/app/backend/utils/audit.py`)
   - `@log_action(action, target_type)` - Decorator for automatic audit logging
   - `log_audit_event()` - Inline audit logging function
   - `get_audit_logs()` - Query audit logs with filters

3. **Decorators Applied to Critical Endpoints**
   - Export Routes: `export_csv`, `export_json`, `export_excel`
   - Stats Routes: `descriptives`, `ttest`, `anova`, `factor_analysis`, `clustering`, `nonparametric`, `regression`
   - Report Routes: `create_report`, `generate_report`

4. **Chart Export Functionality** (`ChartStudio.jsx`)
   - Export charts as PNG (high resolution 2x)
   - Export charts as SVG (vector format)
   - Export charts as PDF with title/subtitle (via backend)
   - Format selector dropdown in UI
   - Backend endpoint: `/api/analysis/export-chart-pdf`

### Files Created/Modified
- `/app/backend/utils/__init__.py` (NEW)
- `/app/backend/utils/security.py` (NEW)
- `/app/backend/utils/audit.py` (NEW)
- `/app/backend/routes/export_routes.py` (MODIFIED)
- `/app/backend/routes/stats_routes.py` (MODIFIED)
- `/app/backend/routes/report_routes.py` (MODIFIED)
- `/app/backend/routes/analysis_routes.py` (MODIFIED - added chart PDF export)
- `/app/frontend/src/components/analysis/ChartStudio.jsx` (MODIFIED - export UI)

---

## BUG FIXES (Feb 7, 2026)

### Issue #1: T-Test Validation for >2 Groups ✅
- **File**: `/app/backend/routes/stats_routes.py` (Lines 293-304)
- Added validation for independent samples t-test
- Returns user-friendly error: "Independent samples t-test requires exactly 2 groups... Please use ANOVA for 3+ groups"

### Issue #2: Form Selection State Persistence ✅
- **Store**: `/app/frontend/src/store/index.js` (useAnalysisStore)
- Created new Zustand store with persist middleware
- Persists: selectedFormId, selectedSnapshotId, activeTab, selectedVariables
- Form selection now maintained when switching between analysis tabs

### Issue #3: GLM Link Function Empty Value Bug ✅
- **File**: `/app/frontend/src/components/analysis/AdvancedStatsPanel.jsx` (Line 658)
- Changed SelectItem value from empty string to "default"
- Updated API call to handle "default" value properly

---

## Test Credentials
- **Email**: demo@datapulse.io
- **Password**: Test123!
- **Org**: ACME Research (a07e901a-bd5f-450d-8533-ed4f7ec629a5)
