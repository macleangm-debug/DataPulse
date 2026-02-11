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

## User Personas
1. **Research Organizations** - Need robust offline data collection, AI transcription
2. **NGOs/Non-profits** - Budget-conscious, need multi-language support
3. **Field Teams** - Require offline-first, GPS tracking, media capture

## Core Requirements

### Completed Features
- [x] Redis/Celery infrastructure (Dec 2025)
- [x] Marketing landing page with hero, features, AI capabilities, comparison table (Dec 2025)
- [x] Interactive demo page (`/demo`) with guided tour (Dec 2025)
- [x] Light/Dark mode toggle with persistence (Dec 2025)
- [x] i18n framework setup with 6 languages (EN, ES, FR, SW, PT, AR) (Dec 2025)
- [x] Pricing page with 4 tiers (Free, Starter, Professional, Enterprise) (Dec 2025)
- [x] Navigation bar on pricing page (Feb 2026)
- [x] Catchy landing page hero redesign (Feb 2026)
- [x] Removed storage calculator and SurveyCTO comparison from pricing (Feb 2026)
- [x] Floating animated icons on landing page hero (Feb 2026)

### In Progress
- [ ] Apply i18n translations across entire application (P0)

### Backlog - P0 (High Priority)
- [ ] Complete i18n: Login page, Interactive Demo, Pricing page, Sidebar, Settings

### Backlog - P1 (Medium Priority)
- [ ] Stripe integration for subscription billing
- [ ] Checkout sessions & payment webhooks
- [ ] Feature restrictions based on plan

### Backlog - P2 (Low Priority)
- [ ] Celery tasks for background data exports
- [ ] AI transcription integration
- [ ] Email report scheduling

## Architecture

### Frontend
- React with TailwindCSS
- Zustand for state management (with persist middleware)
- Framer Motion for animations
- react-i18next for internationalization
- Shadcn/UI components
- Custom CSS keyframe animations for floating icons

### Backend
- Flask (Python)
- Celery with RabbitMQ broker
- Redis backend for task results
- MongoDB for data storage

### Key Files
- `/app/frontend/src/pages/LandingPage.jsx` - Marketing landing page with floating icons
- `/app/frontend/src/pages/PricingPage.jsx` - Pricing tiers & FAQ
- `/app/frontend/src/pages/InteractiveDemoPage.jsx` - Interactive demo
- `/app/frontend/src/components/DemoTour.jsx` - Guided tour component
- `/app/frontend/src/i18n.js` - i18n configuration
- `/app/frontend/src/locales/` - Translation files
- `/app/frontend/src/stores/uiStore.js` - Theme & UI state

## API Endpoints
- `/api/tasks/status/<task_id>` - Check Celery task status (GET)

## Test Credentials
- URL: `/login`
- Email: `demo@datapulse.io`
- Password: `Test123!`

## UI Components

### Floating Icons (Landing Page Hero)
- 10 icons total (5 left, 5 right)
- Left: MapPin, Camera, Mic, WifiOff, Brain
- Right: BarChart3, Globe, Shield, QrCode, Cloud
- Animation: Custom float keyframes with staggered delays
- Visible only on lg screens and above

## Notes
- Interactive demo uses mocked data for demonstration
- Theme preference persisted in localStorage
- i18n translations only applied to Dashboard page currently
- Floating icons use CSS keyframe animations for performance
