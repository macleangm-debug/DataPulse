# DataViz Studio - Integration Guide

## Package Contents

This package contains the following modules from DataViz Studio:

### 1. Report Builder (`/frontend/pages/ReportBuilderPage.jsx`)
- WYSIWYG infographic-style report editor
- Customizable sections (stat cards, charts, text blocks, tables)
- 6 preset color themes + custom color picker
- Section resizing (25%, 50%, 75%, 100% width)
- Drag-and-drop reordering
- Multi-page PDF export with headers/footers

### 2. Chart Studio (`/frontend/pages/ChartsPage.jsx`)
- 9 chart types: bar, line, pie, area, scatter, radar, heatmap, treemap, funnel
- Apache ECharts integration
- Chart annotations (text labels, reference lines, highlight regions)
- Live preview with dataset binding

### 3. Dashboard System
- `DashboardsPage.jsx` - Dashboard list with templates
- `DashboardPage.jsx` - Dashboard viewer
- `DashboardBuilderPage.jsx` - Drag-drop dashboard builder (react-grid-layout)
- 6 pre-built dashboard templates

### 4. Data Transformation (`/frontend/pages/DataTransformPage.jsx`)
- Filter rows, rename columns, change types
- Calculate fields, fill missing values
- Drop columns, sort data
- Preview before applying

---

## Required Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "echarts": "^5.4.3",
    "echarts-for-react": "^3.0.2",
    "framer-motion": "^10.16.4",
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1",
    "lucide-react": "^0.294.0",
    "react-grid-layout": "^1.4.4",
    "sonner": "^1.2.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.1.0"
  }
}
```

Install with:
```bash
yarn add echarts echarts-for-react framer-motion html2canvas jspdf lucide-react react-grid-layout sonner @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-tabs class-variance-authority clsx tailwind-merge
```

---

## File Structure

Place files in your project as follows:

```
your-project/
├── src/
│   ├── components/
│   │   ├── report/           # Copy from /frontend/components/report/
│   │   │   ├── index.js
│   │   │   ├── StatCard.jsx
│   │   │   ├── ChartPreviews.jsx
│   │   │   ├── ThemeSelector.jsx
│   │   │   ├── ReportSection.jsx
│   │   │   └── AddSectionPanel.jsx
│   │   └── ui/               # Copy from /frontend/components/ui/
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── dialog.jsx
│   │       └── ... (other UI components)
│   └── pages/
│       ├── ReportBuilderPage.jsx
│       ├── ChartsPage.jsx
│       ├── DashboardsPage.jsx
│       ├── DashboardPage.jsx
│       ├── DashboardBuilderPage.jsx
│       └── DataTransformPage.jsx
```

---

## Integration Steps

### Step 1: Copy Files
Copy the folders to your project structure as shown above.

### Step 2: Update Imports
Update import paths in each file to match your project structure:

```jsx
// Example: In ReportBuilderPage.jsx, change:
import DashboardLayout from '../layouts/DashboardLayout';

// To your layout:
import YourLayout from '../layouts/YourLayout';
```

### Step 3: Connect to Your Data Source
The modules expect these API patterns:

```javascript
// Datasets API
GET  /api/datasets           // List all datasets
GET  /api/datasets/{id}      // Get dataset details
GET  /api/datasets/{id}/data // Get dataset rows

// Charts API
GET  /api/charts             // List charts
POST /api/charts             // Create chart
PUT  /api/charts/{id}        // Update chart
GET  /api/charts/{id}/data   // Get chart data

// Dashboards API
GET  /api/dashboards         // List dashboards
POST /api/dashboards         // Create dashboard
GET  /api/dashboards/{id}    // Get dashboard with widgets
```

### Step 4: Add Routes
Add routes in your router (React Router example):

```jsx
import ReportBuilderPage from './pages/ReportBuilderPage';
import ChartsPage from './pages/ChartsPage';
import DashboardsPage from './pages/DashboardsPage';
import DashboardPage from './pages/DashboardPage';
import DataTransformPage from './pages/DataTransformPage';

<Routes>
  <Route path="/report-builder" element={<ReportBuilderPage />} />
  <Route path="/charts" element={<ChartsPage />} />
  <Route path="/dashboards" element={<DashboardsPage />} />
  <Route path="/dashboards/:id" element={<DashboardPage />} />
  <Route path="/datasets/:id/transform" element={<DataTransformPage />} />
</Routes>
```

### Step 5: Environment Variables
Set your backend URL:

```env
REACT_APP_BACKEND_URL=https://your-api-url.com
```

---

## Key Features by Module

### Report Builder
| Feature | Description |
|---------|-------------|
| Stat Cards | 4-column metric cards with icons |
| Charts | Bar, Pie, Line chart previews |
| Data Table | Formatted data tables |
| Text Blocks | Intro, Conclusion, Custom notes |
| Themes | 6 presets + custom color picker |
| Resizing | 25%, 50%, 75%, 100% width options |
| PDF Export | Multi-page with headers/footers |

### Chart Studio
| Feature | Description |
|---------|-------------|
| Chart Types | 9 types via ECharts |
| Annotations | Text labels, reference lines, highlight regions |
| Live Preview | Real-time chart updates |
| Dataset Binding | Connect to your datasets |

### Dashboard Builder
| Feature | Description |
|---------|-------------|
| Drag-Drop | react-grid-layout based |
| Templates | 6 pre-built templates |
| Widgets | Stat, Chart, Table widgets |
| Responsive | Auto-resize on screen change |

---

## Customization

### Changing Themes
Edit `/components/report/ThemeSelector.jsx`:

```jsx
export const THEMES = [
  { id: 'your_theme', name: 'Your Theme', primary: '#HEX', accent: '#HEX', secondary: '#HEX', light: '#HEX' },
  // Add more themes...
];
```

### Adding Chart Types
Edit `ChartsPage.jsx` - add to CHART_TYPES array and implement in getChartOption function.

### Custom Section Types
Edit `/components/report/ReportSection.jsx` - add to SECTION_TYPES and implement in renderContent switch.

---

## Support

For questions about this integration, refer to the original DataViz Studio codebase or the PRD.md documentation.
