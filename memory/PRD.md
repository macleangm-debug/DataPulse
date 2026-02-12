# DataPulse - Product Requirements Document

## Original Problem Statement
Build a sophisticated data collection platform (DataPulse) with:
- Redis/Celery infrastructure for async tasks
- Marketing landing page inspired by reference design
- Interactive demo with guided tours/tooltips
- Light/Dark mode
- Multilingual support (i18n)
- Pricing page with competitive analysis
- Floating animated icons for visual appeal
- Mobile enumerator data collection (login-based and token-based)

## User Personas
1. **Research Organizations** - Need robust offline data collection, AI transcription
2. **NGOs/Non-profits** - Budget-conscious, need multi-language support
3. **Field Teams/Enumerators** - Require offline-first, GPS tracking, media capture, simple mobile UI

## Core Requirements

### Completed Features
- [x] Redis/Celery infrastructure (Dec 2025)
- [x] Marketing landing page with hero, features, AI capabilities (Dec 2025)
- [x] Interactive demo page (`/demo`) with guided tour (Dec 2025)
- [x] Light/Dark mode toggle with persistence (Dec 2025)
- [x] i18n framework setup with 6 languages (Dec 2025)
- [x] Pricing page with 4 tiers (Dec 2025)
- [x] Navigation bar on pricing page (Feb 2026)
- [x] Catchy landing page hero with floating animated icons (Feb 2026)
- [x] Mobile Enumerator Collection - Option A: Login-based `/collect` (Feb 2026)
- [x] Mobile Enumerator Collection - Option B: Token-based `/collect/{token}` (Feb 2026)

### In Progress
- [ ] Apply i18n translations across entire application (P0)

### Backlog - P0 (High Priority)
- [ ] Complete i18n: Login page, Interactive Demo, Pricing page, Sidebar, Settings, Collection pages

### Backlog - P1 (Medium Priority)
- [ ] Stripe integration for subscription billing
- [ ] Enhanced form filling UI (photo capture, signatures, audio recording)
- [ ] Supervisor dashboard for managing collection tokens

### Backlog - P2 (Low Priority)
- [ ] Celery tasks for background data exports
- [ ] AI transcription integration
- [ ] Email report scheduling

## Mobile Collection Feature Details

### Option A: Login-Based Collection (`/collect`)
- Simple, mobile-optimized login form
- Shows forms assigned to enumerator's organization
- Sync status indicator (online/offline badge)
- PWA install banner for offline capability
- One-tap sync button for pending submissions
- Quick stats (forms available, pending sync count)

### Option B: Token-Based Collection (`/collect/{token}`)
- No login required - URL with token is authentication
- Supervisor creates token with assigned forms
- Token has expiration date (default 7 days)
- Shows enumerator name, assigned forms
- Works offline with sync when back online
- Usage tracking for supervisors

### Collection APIs
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/collect/login` | POST | None | Enumerator login |
| `/api/collect/forms` | GET | Bearer | Get assigned forms |
| `/api/collect/submit` | POST | Bearer | Submit data |
| `/api/collect/sync` | POST | Bearer | Bulk sync |
| `/api/collect/token/{token}` | GET | None | Get token info |
| `/api/collect/token/{token}/submit` | POST | None | Submit via token |
| `/api/collect/tokens/create` | POST | Admin | Create token |
| `/api/collect/tokens/list` | GET | Admin | List tokens |

## Architecture

### Frontend
- React with TailwindCSS
- Zustand for state management (with persist middleware)
- Framer Motion for animations
- react-i18next for internationalization
- Shadcn/UI components
- Custom CSS keyframe animations for floating icons
- Mobile-first responsive design for collection pages

### Backend
- FastAPI (Python)
- Celery with RabbitMQ broker
- Redis backend for task results
- MongoDB for data storage

### Key Files
- `/app/frontend/src/pages/LandingPage.jsx` - Marketing page
- `/app/frontend/src/pages/PricingPage.jsx` - Pricing tiers
- `/app/frontend/src/pages/MobileCollectPage.jsx` - Option A collection
- `/app/frontend/src/pages/TokenCollectPage.jsx` - Option B collection
- `/app/frontend/src/pages/CollectFormPage.jsx` - Form filling UI
- `/app/backend/routes/collect_routes.py` - Collection APIs

## Test Credentials

### Admin Login
- URL: `/login`
- Email: `demo@datapulse.io`
- Password: `Test123!`

### Enumerator Login (Option A)
- URL: `/collect`
- Email: `enumerator@datapulse.io`
- Password: `field123`

### Token-Based Access (Option B)
- URL: `/collect/demo_uIRtuzArFLyzUfi9jeRhlA`
- No login required
