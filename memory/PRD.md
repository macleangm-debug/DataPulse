# DataPulse - Product Requirements Document

## Original Problem Statement
Build a sophisticated data collection platform (DataPulse) with:
- Redis/Celery infrastructure for async tasks
- Marketing landing page
- Interactive demo with guided tours
- Light/Dark mode
- Multilingual support (i18n)
- Pricing page
- Mobile enumerator data collection
- Complete DataViz Studio module

## Completed Features

### Core Platform
- [x] Redis/Celery infrastructure (Dec 2025)
- [x] Marketing landing page with floating animated icons (Feb 2026)
- [x] Interactive demo page with guided tour (Dec 2025)
- [x] Light/Dark mode toggle with persistence (Dec 2025)
- [x] i18n framework with 6 languages (Dec 2025)
- [x] **i18n translations applied across app pages** (Dec 2025) - Dashboard, Forms, Projects, Submissions, Settings, Team, Navigation
- [x] Pricing page with 4 tiers (Dec 2025)
- [x] Pro Tip banner removed (Feb 2026)

### Mobile Collection (Feb 2026)
- [x] Option A: Login-based collection (`/collect`)
- [x] Option B: Token-based collection (`/collect/{token}`)
- [x] Offline-first with sync support
- [x] PWA install banner

### DataViz Studio (Feb 2026)
- [x] Main hub with stats and templates
- [x] Dashboard Builder with drag-and-drop
- [x] Dashboard View with export options
- [x] Chart types: Bar, Line, Area, Pie, Stat
- [x] Data aggregation API
- [x] Time series charts
- [x] Form field selection for charts
- [x] **Data seeding script created** (Dec 2025) - 500 sample submissions across 2 forms
- [x] **End-to-end tested** (Dec 2025) - All 13 API tests passed

### Reusable Components Shared
- [x] ShareSurveyDialog - Survey sharing modal with **QR code** (qrcode.react)
- [x] OnboardingWizard - Interactive tour system
- [x] DashboardHeader - Toolbar with theme, lang, notifications

### i18n Implementation (Dec 2025)
- [x] Navigation labels use translation keys (all 6 languages)
- [x] Dashboard page fully translated
- [x] Forms page (title, filters, buttons)
- [x] Projects page (title, create dialog)
- [x] Submissions page (stats, filters)
- [x] Settings page (all 8 tabs)
- [x] Team page (header, dialogs)
- [x] Language selector working (sidebar)
- [x] **All 6 languages complete**: English, Spanish, French, Portuguese, Swahili, Arabic

## Architecture

### Frontend
- React + TailwindCSS
- Zustand (state management)
- Framer Motion (animations)
- react-i18next (internationalization)
- Recharts (data visualization)
- Shadcn/UI components

### Backend
- FastAPI (Python)
- MongoDB
- Celery + Redis (async tasks)

### Key Routes
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/pricing` | Pricing tiers |
| `/demo` | Interactive demo |
| `/login` | Authentication |
| `/dashboard` | Main dashboard |
| `/forms` | Form management |
| `/collect` | Mobile collection (login) |
| `/collect/{token}` | Mobile collection (token) |
| `/dataviz` | DataViz Studio |
| `/dataviz/builder/:id` | Dashboard builder |
| `/dataviz/view/:id` | Dashboard viewer |

## Test Credentials

### Admin
- Email: `demo@datapulse.io`
- Password: `Test123!`

### Enumerator
- Email: `enumerator@datapulse.io`
- Password: `field123`

### Token Collection
- URL: `/collect/demo_uIRtuzArFLyzUfi9jeRhlA`

## Backlog

### P0 (High Priority)
- [ ] Complete i18n translations across all pages
- [ ] Map visualization for GPS data
- [ ] Actual PDF/Excel export generation

### P1 (Medium Priority)
- [ ] Stripe subscription billing
- [ ] Dashboard sharing/embedding
- [ ] Real-time WebSocket updates
- [ ] Enhanced offline sync with IndexedDB

### P2 (Future)
- [ ] Celery tasks for background exports
- [ ] AI transcription integration
- [ ] Email report scheduling

## Test Data

### Seeded Data (Dec 2025)
- **Organization**: DataPulse Demo Organization (org_id: `904d278e`)
- **Project**: Customer Satisfaction Survey 2024
- **Forms**: 
  - Customer Feedback Form (form_id: `6d1cea4d`) - 10 fields
  - Product Usage Survey (form_id: `33408ffd`) - 6 fields
- **Submissions**: 500 total across 30 days
- **Enumerators**: 5 active field workers
- **Sample Dashboard**: Customer Insights Dashboard

### Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | demo@datapulse.io | Test123! |
| Enumerator | enumerator1@datapulse.io | field123 |

## Key Files
- `backend/scripts/seed_dataviz_data.py` - Data seeding for DataViz
- `backend/routes/dataviz_routes.py` - DataViz API endpoints
- `src/pages/dataviz/` - DataViz frontend pages
- `src/components/ShareSurveyDialog.jsx` - Share modal with QR code
