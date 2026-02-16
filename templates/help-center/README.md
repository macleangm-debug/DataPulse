# Help Center Template - Reusable Boilerplate

A complete, production-ready Help Center implementation with AI Assistant integration.

## Features
- Dynamic content from backend APIs
- AI-powered chat assistant (GPT-4o via Emergent LLM key)
- Searchable articles, FAQ, troubleshooting guides
- Keyboard shortcuts reference
- Release notes / What's New section
- Feedback collection system
- Responsive dark/light theme support

## File Structure
```
help-center/
├── backend/
│   └── help_routes.py          # FastAPI routes (copy to your routes folder)
├── frontend/
│   ├── HelpCenterPage.jsx      # Main Help Center page
│   └── HelpAssistant.jsx       # AI Chat widget component
├── data/
│   └── help_content_template.json  # Content structure template
└── README.md
```

## Quick Setup

### 1. Backend Setup

```bash
# Install required packages
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Add to requirements.txt
emergentintegrations==0.1.0
```

Add to your `.env`:
```
EMERGENT_LLM_KEY=your-emergent-llm-key
```

Register routes in `server.py`:
```python
from routes.help_routes import router as help_router
api_router.include_router(help_router)
```

### 2. Frontend Setup

```bash
# Dependencies (likely already installed)
yarn add lucide-react framer-motion react-router-dom
```

Add route in `App.js`:
```jsx
import HelpCenterPage from './pages/HelpCenterPage';

<Route path="/help" element={
  <ProtectedRoute>
    <HelpCenterPage />
  </ProtectedRoute>
} />
```

### 3. Customization

1. Edit `HELP_ARTICLES` dict in backend for your app's documentation
2. Update `FAQ_DATA` with your app-specific questions
3. Modify `TROUBLESHOOTING_GUIDES` for common issues
4. Customize `AI_CONTEXT` with your app's features and navigation

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/help/articles` | GET | List articles (supports `?category`, `?search`) |
| `/api/help/articles/{id}` | GET | Get specific article content |
| `/api/help/categories` | GET | List all categories |
| `/api/help/categories-full` | GET | Categories with article lists |
| `/api/help/faq` | GET | Get all FAQ items |
| `/api/help/troubleshooting` | GET | Get troubleshooting guides |
| `/api/help/shortcuts` | GET | Get keyboard shortcuts |
| `/api/help/whats-new` | GET | Get release notes |
| `/api/help/search?q={term}` | GET | Global search |
| `/api/help/chat` | POST | AI assistant chat |
| `/api/help/feedback` | POST | Submit feedback |

## Content Structure

### Articles
```python
{
    "id": "unique-slug",
    "title": "Article Title",
    "category": "category-id",
    "summary": "Brief description",
    "content": "Full markdown content...",
    "tags": ["tag1", "tag2"],
    "read_time": "5 min"
}
```

### FAQ
```python
{
    "question": "How do I...?",
    "answer": "You can...",
    "category": "category-id"
}
```

### Troubleshooting
```python
{
    "id": "issue-slug",
    "title": "Issue Title",
    "severity": "high|medium|low",
    "steps": ["Step 1", "Step 2"],
    "common_causes": ["Cause 1", "Cause 2"]
}
```

## Customizing the AI Assistant

Edit the `AI_CONTEXT` variable to include:
- Your app's name and description
- Navigation structure
- Feature documentation
- Common tasks and workflows
- Links to help articles (use `{base}` placeholder for help center URL)

Example:
```python
AI_CONTEXT = """
You are the {AppName} AI Assistant.

## Your App Overview
{Description of what your app does}

## Navigation
- **Dashboard**: Main overview
- **Feature 1**: Description
- **Feature 2**: Description

## Common Tasks
1. How to do X: Steps...
2. How to do Y: Steps...

## Help Links
- [Getting Started]({base}?article=getting-started)
- [Feature Guide]({base}?article=feature-guide)
"""
```

## License
MIT - Feel free to use and modify for your projects.
