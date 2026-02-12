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

### Reusable Components Shared
- [x] ShareSurveyDialog - Survey sharing modal
- [x] OnboardingWizard - Interactive tour system
- [x] DashboardHeader - Toolbar with theme, lang, notifications

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
