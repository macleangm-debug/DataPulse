/**
 * HelpCenter Component - Main Help Center Page for DataPulse
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, HelpCircle, ChevronRight, ChevronDown, Users, BarChart3, Settings, CreditCard,
  Zap, AlertCircle, ThumbsUp, ThumbsDown, Keyboard, ArrowLeft, ClipboardList, Sparkles,
  FileText, Database, Smartphone, Shield, MapPin, Plug
} from 'lucide-react';
import { HelpAssistant } from '../components/HelpAssistant';
import DashboardLayout from '../layouts/DashboardLayout';

function cn(...classes) { return classes.filter(Boolean).join(' '); }

// ========== DATAPULSE HELP CATEGORIES ==========
const HELP_CATEGORIES = [
  {
    id: 'getting-started', title: 'Getting Started', icon: Zap,
    description: 'Learn the basics and set up your first project', color: 'teal',
    articles: [
      { id: 'welcome', title: 'Welcome to DataPulse', readTime: '3 min', popular: true },
      { id: 'first-project', title: 'Create Your First Project', readTime: '5 min' },
      { id: 'dashboard-overview', title: 'Dashboard Overview', readTime: '4 min' },
      { id: 'navigation-guide', title: 'Navigation Guide', readTime: '3 min' },
    ]
  },
  {
    id: 'forms', title: 'Forms & Data Collection', icon: FileText,
    description: 'Build forms and collect data', color: 'blue',
    articles: [
      { id: 'form-builder', title: 'Form Builder Guide', readTime: '8 min', popular: true },
      { id: 'field-types', title: 'Field Types Reference', readTime: '6 min' },
      { id: 'skip-logic', title: 'Skip Logic & Branching', readTime: '5 min' },
      { id: 'calculated-fields', title: 'Calculated Fields', readTime: '5 min' },
      { id: 'form-validation', title: 'Form Validation', readTime: '4 min' },
    ]
  },
  {
    id: 'dataviz', title: 'DataViz Studio', icon: BarChart3,
    description: 'Charts, dashboards, and reports', color: 'violet',
    articles: [
      { id: 'chart-studio', title: 'Chart Studio Guide', readTime: '6 min' },
      { id: 'dashboard-builder', title: 'Building Dashboards', readTime: '8 min', popular: true },
      { id: 'dashboard-templates', title: 'Dashboard Templates', readTime: '4 min' },
      { id: 'report-builder', title: 'Report Builder', readTime: '6 min' },
    ]
  },
  {
    id: 'data', title: 'Data Management', icon: Database,
    description: 'Import, export, and manage data', color: 'amber',
    articles: [
      { id: 'submissions', title: 'Managing Submissions', readTime: '5 min' },
      { id: 'data-export', title: 'Exporting Data', readTime: '4 min', popular: true },
      { id: 'datasets', title: 'Working with Datasets', readTime: '5 min' },
      { id: 'case-management', title: 'Case Management', readTime: '6 min' },
    ]
  },
  {
    id: 'mobile', title: 'Mobile & Offline', icon: Smartphone,
    description: 'Offline collection and mobile features', color: 'cyan',
    articles: [
      { id: 'offline-collection', title: 'Offline Data Collection', readTime: '5 min', popular: true },
      { id: 'sync-guide', title: 'Sync & Connectivity', readTime: '4 min' },
      { id: 'gps-location', title: 'GPS & Location', readTime: '4 min' },
      { id: 'media-capture', title: 'Media Capture', readTime: '5 min' },
    ]
  },
  {
    id: 'team', title: 'Team & Users', icon: Users,
    description: 'Manage your team and permissions', color: 'pink',
    articles: [
      { id: 'user-management', title: 'User Management', readTime: '5 min', popular: true },
      { id: 'roles-permissions', title: 'Roles & Permissions', readTime: '6 min' },
      { id: 'team-collaboration', title: 'Team Collaboration', readTime: '4 min' },
    ]
  },
  {
    id: 'quality', title: 'Quality Control', icon: Shield,
    description: 'Ensure data quality', color: 'rose',
    articles: [
      { id: 'quality-ai', title: 'Quality AI', readTime: '5 min' },
      { id: 'data-validation', title: 'Data Validation', readTime: '4 min' },
      { id: 'backcheck', title: 'Back-check Guide', readTime: '5 min' },
    ]
  },
  {
    id: 'settings', title: 'Account & Settings', icon: Settings,
    description: 'Configure your account', color: 'gray',
    articles: [
      { id: 'profile-settings', title: 'Profile Settings', readTime: '3 min' },
      { id: 'security-settings', title: 'Security Settings', readTime: '4 min' },
      { id: 'api-access', title: 'API Access', readTime: '5 min' },
    ]
  },
];

const FAQ_DATA = [
  {
    category: 'Getting Started',
    questions: [
      { q: 'What is DataPulse?', a: 'DataPulse is an enterprise-grade field data collection platform for research, monitoring & evaluation (M&E), and field surveys. It features offline-first data collection, real-time quality monitoring, and multi-language support.' },
      { q: 'How do I create my first form?', a: 'Go to Projects > Forms, click "New Form", use the drag-and-drop builder to add fields, configure properties, preview, and publish when ready.' },
      { q: 'Is there a free trial?', a: 'Yes! DataPulse offers a free tier with basic features. Contact sales for enterprise plans with advanced features.' },
    ]
  },
  {
    category: 'Forms & Data Collection',
    questions: [
      { q: 'What field types are available?', a: 'DataPulse supports: Text, Number, Select, Multi-Select, Date/Time, GPS, Photo, Audio, Video, Signature, Barcode, Calculated fields, and more.' },
      { q: 'How do I add skip logic?', a: 'In Form Builder, click on a field, go to the "Logic" tab, and add conditions. For example: Show "Other" field when "Other" option is selected.' },
      { q: 'Can I collect data offline?', a: 'Yes! DataPulse is built with offline-first architecture. Forms are cached locally, submissions saved to device storage, and sync automatically when online.' },
    ]
  },
  {
    category: 'DataViz & Reports',
    questions: [
      { q: 'How do I create a dashboard?', a: 'Go to Data > Dashboards, click "New Dashboard", choose a template (10 presets available) or start blank, add widgets, connect your data source, and save.' },
      { q: 'What chart types are available?', a: 'Bar, Line, Pie, Donut, Area, and Scatter charts. Plus widgets like Stats, Tables, Gauges, Funnels, Heatmaps, and more.' },
      { q: 'How do I export reports?', a: 'Use Report Builder to create reports, then export as PDF. For data exports, go to Submissions and export as CSV, Excel, JSON, or SPSS.' },
    ]
  },
  {
    category: 'Account & Team',
    questions: [
      { q: 'How do I add team members?', a: 'Go to Settings > User Management, click "Add User", enter email, select role (Admin, Manager, Enumerator, Viewer), and send invitation.' },
      { q: 'What roles are available?', a: 'Admin (full access), Manager (create forms, view all data), Enumerator (submit data only), Viewer (read-only access).' },
      { q: 'How do I reset my password?', a: 'On the login page, click "Forgot Password", enter your email, and follow the reset link sent to you.' },
    ]
  },
];

const TROUBLESHOOTING_DATA = [
  { 
    id: 'sync-issues', 
    title: 'Data Not Syncing', 
    severity: 'high',
    symptoms: ['Yellow/red sync indicator', 'Submissions pending', 'Changes not appearing'], 
    solutions: ['Check internet connection', 'Verify you are logged in', 'Go to Settings > Sync > Force Sync', 'Clear browser cache', 'Check storage quota', 'Contact support if issue persists'] 
  },
  { 
    id: 'form-errors', 
    title: 'Form Submission Errors', 
    severity: 'high',
    symptoms: ['Validation errors', 'Submit fails', 'Required field errors'], 
    solutions: ['Check all required fields (marked with *)', 'Verify field validation requirements', 'Enable GPS if location required', 'Check media file sizes (photo 10MB, video 50MB max)', 'Save as draft first', 'Try refreshing the form'] 
  },
  { 
    id: 'login-issues', 
    title: 'Cannot Log In', 
    severity: 'medium',
    symptoms: ['Invalid password', 'Account locked', 'Email not found'], 
    solutions: ['Verify email address is correct', 'Check caps lock', 'Use "Forgot Password" to reset', 'Clear browser cookies', 'Try incognito mode', 'Contact admin if locked'] 
  },
  { 
    id: 'gps-issues', 
    title: 'GPS Not Working', 
    severity: 'medium',
    symptoms: ['No location capture', 'Poor accuracy', 'Location timeout'], 
    solutions: ['Enable location services on device', 'Grant browser location permission', 'Move outdoors for better signal', 'Wait 30-60 seconds for GPS fix', 'Try manual coordinate entry'] 
  },
  { 
    id: 'export-issues', 
    title: 'Export Not Working', 
    severity: 'medium',
    symptoms: ['Download fails', 'Empty file', 'Timeout error'], 
    solutions: ['Check export permissions for your role', 'Verify data exists for selected filters', 'Try smaller date range', 'Disable popup blocker', 'Try different format (CSV vs Excel)', 'Wait longer for large exports'] 
  },
];

const KEYBOARD_SHORTCUTS = [
  { category: 'Navigation', shortcuts: [{ keys: ['Ctrl', 'K'], action: 'Open search' }, { keys: ['Ctrl', 'D'], action: 'Go to Dashboard' }, { keys: ['Esc'], action: 'Close modal' }] },
  { category: 'Forms', shortcuts: [{ keys: ['Ctrl', 'S'], action: 'Save form' }, { keys: ['Ctrl', 'Z'], action: 'Undo' }, { keys: ['Ctrl', 'Y'], action: 'Redo' }] },
  { category: 'Data Entry', shortcuts: [{ keys: ['Tab'], action: 'Next field' }, { keys: ['Shift', 'Tab'], action: 'Previous field' }, { keys: ['Enter'], action: 'Submit/Confirm' }] },
  { category: 'General', shortcuts: [{ keys: ['Ctrl', '/'], action: 'Show shortcuts' }, { keys: ['?'], action: 'Open help' }] },
];

const WHATS_NEW = [
  { 
    version: '2.5.0', 
    date: 'February 2026', 
    highlights: [
      { type: 'feature', title: 'Comprehensive Help Center', description: '22 articles, 20 FAQs, 10 troubleshooting guides, AI assistant' },
      { type: 'feature', title: 'Dashboard Templates', description: '10 preset templates for Sales, Marketing, Operations, and more' },
      { type: 'improvement', title: 'Real-time Data Integration', description: 'Connect visualizations directly to form submissions' },
    ] 
  },
  { 
    version: '2.4.0', 
    date: 'January 2026', 
    highlights: [
      { type: 'feature', title: 'User Management Module', description: 'Complete user, role, and permission management' },
      { type: 'feature', title: 'DataViz Studio', description: 'Chart Studio, Dashboard Builder, Report Builder' },
      { type: 'improvement', title: 'Quality AI', description: 'AI-powered data quality checks and anomaly detection' },
    ] 
  },
  { 
    version: '2.3.0', 
    date: 'December 2025', 
    highlights: [
      { type: 'feature', title: 'Offline-First Architecture', description: 'Collect data without internet connection' },
      { type: 'feature', title: 'Multi-language Support', description: 'English and Swahili built-in' },
      { type: 'improvement', title: 'GPS Enhancements', description: 'Improved accuracy and indoor positioning' },
    ] 
  },
];

const ARTICLE_CONTENT = {
  'welcome': { 
    title: 'Welcome to DataPulse', 
    content: `Welcome to DataPulse - your enterprise-grade field data collection platform!

## What is DataPulse?

DataPulse is designed for:
- **Research surveys** and academic studies
- **Monitoring & Evaluation (M&E)** programs
- **Field data collection** in any industry
- **CATI/CAWI surveys** (phone and web)

## Key Features

### Offline-First Collection
Collect data anywhere, even without internet. Data syncs automatically when you're back online.

### Drag-and-Drop Form Builder
Create professional surveys with our intuitive builder. Support for 15+ field types including GPS, media capture, and signatures.

### Real-Time Quality Monitoring
AI-powered quality checks flag anomalies and ensure data integrity.

### DataViz Studio
Build beautiful dashboards and reports with our visualization tools.

## Quick Start

1. **Create a Project** - Organize your forms and data
2. **Build a Form** - Use our drag-and-drop builder
3. **Collect Data** - Share links or use mobile app
4. **Analyze Results** - View dashboards and export data

Need help? Use our [AI Assistant](/help?tab=home) or browse the documentation below!` 
  },
  'dashboard-overview': { 
    title: 'Dashboard Overview', 
    content: `The Dashboard is your command center in DataPulse.

## Main Elements

### Statistics Cards
At a glance view of:
- **Total Projects** - Your active projects
- **Active Forms** - Published forms ready for collection
- **Submissions** - Total responses collected
- **Pending Reviews** - Items awaiting review

### Submission Trends
Visual chart showing data collection activity over the last 14 days.

### Data Quality
Quality score and metrics:
- Average Quality Score (0-100%)
- Approved vs Rejected submissions
- Items flagged for review

### Recent Activity
Latest submissions and actions in your organization.

### Quick Actions
Fast access to common tasks like creating forms and viewing submissions.

## Navigation

Use the left rail to access:
- **Home** - Dashboard
- **Projects** - Forms, Templates, Submissions
- **Data** - Cases, Datasets, Charts, Dashboards
- **Field Ops** - CATI, Back-check, Devices
- **Quality & AI** - Analysis, Quality checks
- **Settings** - Team, Users, Security` 
  },
  'form-builder': { 
    title: 'Form Builder Guide', 
    content: `The Form Builder is DataPulse's powerful tool for creating data collection forms.

## Getting Started

1. Go to **Projects > Forms**
2. Click **"New Form"**
3. Enter form name and description
4. Start adding fields

## Field Types

### Basic Fields
- **Text** - Short or long text input
- **Number** - Integer or decimal values
- **Select** - Single choice dropdown
- **Multi-Select** - Multiple choice checkboxes
- **Date/Time** - Date and time pickers

### Media Fields
- **Photo** - Camera capture (max 10MB)
- **Audio** - Voice recording (max 5 min)
- **Video** - Video capture (max 50MB, 2 min)
- **Signature** - Digital signature

### Location & Special
- **GPS** - Coordinates with accuracy
- **Barcode** - QR and barcode scanner
- **Calculated** - Formula-based fields

## Field Properties

Each field can be configured:
- **Label** - Question text
- **Required** - Make mandatory
- **Hint** - Help text for users
- **Validation** - Rules for acceptable values

## Publishing

1. Click **Preview** to test your form
2. Click **Save** to save as draft
3. Click **Publish** to make available for collection` 
  },
  'skip-logic': { 
    title: 'Skip Logic & Branching', 
    content: `Skip logic controls when questions appear based on previous answers.

## Why Use Skip Logic?

- Show relevant questions only
- Shorter forms for respondents
- Cleaner data collection

## Creating Skip Logic

1. Click on the field you want to conditionally show
2. Go to the **"Logic"** tab
3. Click **"Add Condition"**
4. Configure:
   - **When**: Select triggering field
   - **Operator**: equals, not equals, greater than, etc.
   - **Value**: The comparison value

## Example

**Show "Specify Other" when "Other" is selected:**

1. Add Select field: "Contact Method" with options: Email, Phone, Other
2. Add Text field: "Please Specify"
3. On "Please Specify", add condition:
   - When: "Contact Method"
   - Operator: "equals"
   - Value: "Other"

## Operators

| Operator | Use Case |
|----------|----------|
| equals | Exact match |
| not equals | Exclude value |
| contains | Partial text match |
| greater than | Numeric comparison |
| is empty | Field not answered |

## Tips

- Plan your logic flow before building
- Test all paths in preview
- Keep conditions simple when possible` 
  },
  'dashboard-builder': { 
    title: 'Building Dashboards', 
    content: `Create interactive dashboards to visualize your data.

## Creating a Dashboard

1. Go to **Data > Dashboards**
2. Click **"New Dashboard"** or **"Templates"**
3. Choose a template or start blank
4. Add and configure widgets
5. Connect your data source

## Dashboard Templates

10 preset templates available:
- **Sales Dashboard** - Revenue, orders, products
- **Marketing Analytics** - Traffic, conversions
- **Customer Insights** - Demographics, behavior
- **Operations Monitor** - Inventory, fulfillment
- **Financial Summary** - P&L, expenses
- **Web Analytics** - Page views, sessions
- **Executive Summary** - High-level KPIs
- **Project Tracker** - Tasks, milestones
- **Support Dashboard** - Tickets, response time
- **Blank Canvas** - Start from scratch

## Widget Types

12 widget types:
- **Stat** - KPI cards with numbers
- **Chart** - Bar, line, pie, area charts
- **Table** - Data tables with sorting
- **Gauge** - Circular progress
- **Progress** - Bar progress indicators
- **Map** - Geographic visualization
- **Funnel** - Conversion funnels
- **Heatmap** - Activity patterns
- **Scorecard** - Metric vs target
- **List** - Ranked items
- **Timeline** - Events/milestones
- **Sparkline** - Mini trend lines

## Connecting Data

1. Click on a widget
2. Click **"Edit"** or gear icon
3. Select **"Data Source"**
4. Choose from forms or datasets
5. Configure field mapping` 
  },
  'offline-collection': { 
    title: 'Offline Data Collection', 
    content: `DataPulse is built with offline-first architecture.

## How It Works

### Caching
- Forms are cached locally when online
- No internet needed for data entry
- Media files stored on device

### Storage
- Submissions saved to browser/app storage
- Up to 10,000 submissions offline
- Media stored until sync

### Syncing
- Automatic sync when online
- Background sync enabled
- Conflict resolution built-in

## Connection Status

Look at the header indicator:
- **Green** - Online and synced
- **Yellow** - Pending sync
- **Red** - Offline

## Preparing for Field Work

Before going offline:
1. Log into DataPulse
2. Open each form you'll need
3. Wait for "Cached" indicator
4. Verify forms load offline
5. Test a sample submission

## Force Sync

If data isn't syncing:
1. Go to **Settings > Sync**
2. Click **"Force Sync"**
3. Wait for completion
4. Check sync log for errors

## Best Practices

- Pre-cache forms before field work
- Sync regularly when connection available
- Monitor queue size during collection
- Back up data periodically` 
  },
  'user-management': { 
    title: 'User Management', 
    content: `Manage users and control access to your organization.

## Adding Users

1. Go to **Settings > User Management**
2. Click **"Add User"**
3. Enter email address
4. Select role
5. Assign to projects (optional)
6. Click **"Send Invitation"**

## User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access, manage users |
| **Manager** | Create forms, view all data |
| **Enumerator** | Submit data only |
| **Viewer** | Read-only access |

## Permissions by Role

| Action | Admin | Manager | Enumerator | Viewer |
|--------|-------|---------|------------|--------|
| Create Forms | Yes | Yes | No | No |
| Submit Data | Yes | Yes | Yes | No |
| View All Data | Yes | Yes | No | Yes |
| Manage Users | Yes | No | No | No |
| Export Data | Yes | Yes | No | Yes |

## Editing Users

1. Find user in list
2. Click **"Edit"** (pencil icon)
3. Modify role or assignments
4. Click **"Save"**

## Deactivating Users

Instead of deleting (preserves data history):
1. Find user in list
2. Click **"Deactivate"**
3. Confirm action
4. Reactivate anytime if needed` 
  },
  'data-export': { 
    title: 'Exporting Data', 
    content: `Export your collected data in various formats.

## Export Formats

- **CSV** - Universal format, opens in Excel
- **Excel (.xlsx)** - Native Excel with formatting
- **JSON** - Structured format for developers
- **SPSS (.sav)** - Statistical analysis format

## Quick Export

1. Go to **Data > Submissions**
2. Select a form
3. Click **"Export"**
4. Choose format
5. Download starts

## Advanced Export

1. Go to **Data > Exports**
2. Click **"New Export"**
3. Configure options:
   - Select form(s)
   - Choose format
   - Date range filter
   - Status filter
   - Field selection
4. Click **"Generate Export"**

## Export Options

### Include Options
- **Metadata** - Submission time, GPS, device info
- **Repeat Groups** - Separate sheets or rows
- **Media Files** - Download attachments
- **Audit Trail** - Edit history

### Filters
- Date range
- Status (Draft, Pending, Approved, etc.)
- Enumerator
- Custom field values

## Tips

- Large exports may take time
- Use filters to reduce file size
- Check column headers match expected format
- Keep exports secure - contains sensitive data` 
  },
};

// ========== MAIN COMPONENT ==========
export function HelpCenterPage({ isDark = true }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || null);
  const [activeArticle, setActiveArticle] = useState(searchParams.get('article') || null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'home');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [articleFeedback, setArticleFeedback] = useState({});
  const [expandedCategory, setExpandedCategory] = useState(null);

  const bgPrimary = isDark ? 'bg-[#0a1628]' : 'bg-gray-50';
  const bgSecondary = isDark ? 'bg-[#0f1d32]' : 'bg-white';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const hoverBg = isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100';

  const searchResults = searchQuery.trim() ? HELP_CATEGORIES.flatMap(cat => cat.articles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())).map(a => ({ ...a, category: cat }))) : [];

  const handleArticleClick = (categoryId, articleId) => {
    setActiveCategory(categoryId);
    setActiveArticle(articleId);
    setActiveTab('article');
    setSearchParams({ tab: 'article', category: categoryId, article: articleId });
  };

  const getArticleContent = (articleId) => ARTICLE_CONTENT[articleId] || { title: 'Article Not Found', content: 'This article is not yet available. Please check back later or contact support.' };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      case 'low': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'article':
        const article = getArticleContent(activeArticle);
        return (
          <div className="space-y-6">
            <button onClick={() => { setActiveTab('home'); setSearchParams({}); }} className={cn("flex items-center gap-2 text-sm", textSecondary, hoverBg, "px-3 py-2 rounded-lg")}>
              <ArrowLeft className="w-4 h-4" />Back to Help Center
            </button>
            <div className={cn(bgSecondary, borderColor, "border rounded-xl p-6")}>
              <h1 className={cn("text-2xl font-bold mb-4", textPrimary)}>{article.title}</h1>
              <div className={cn("whitespace-pre-wrap leading-relaxed", textSecondary)}>{article.content}</div>
            </div>
            <div className={cn(bgSecondary, borderColor, "border rounded-xl p-4")}>
              <p className={cn("text-sm font-medium mb-3", textPrimary)}>Was this article helpful?</p>
              <div className="flex gap-2">
                <button onClick={() => setArticleFeedback(p => ({ ...p, [activeArticle]: 'yes' }))} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors", articleFeedback[activeArticle] === 'yes' ? "bg-green-500/20 text-green-400" : cn(hoverBg, textSecondary))}>
                  <ThumbsUp className="w-4 h-4" />Yes, helpful
                </button>
                <button onClick={() => setArticleFeedback(p => ({ ...p, [activeArticle]: 'no' }))} className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors", articleFeedback[activeArticle] === 'no' ? "bg-red-500/20 text-red-400" : cn(hoverBg, textSecondary))}>
                  <ThumbsDown className="w-4 h-4" />Not helpful
                </button>
              </div>
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="space-y-6">
            <h2 className={cn("text-xl font-bold", textPrimary)}>Frequently Asked Questions</h2>
            {FAQ_DATA.map((cat, catIdx) => (
              <div key={catIdx} className="space-y-3">
                <h3 className={cn("font-semibold text-lg", textPrimary)}>{cat.category}</h3>
                {cat.questions.map((faq, qIdx) => {
                  const faqId = `${catIdx}-${qIdx}`;
                  const isExpanded = expandedFaq === faqId;
                  return (
                    <div key={qIdx} className={cn(bgSecondary, borderColor, "border rounded-xl overflow-hidden")}>
                      <button onClick={() => setExpandedFaq(isExpanded ? null : faqId)} className={cn("w-full flex items-center justify-between p-4 text-left", hoverBg)} data-testid={`faq-${faqId}`}>
                        <span className={cn("font-medium", textPrimary)}>{faq.q}</span>
                        <ChevronDown className={cn("w-5 h-5 transition-transform", textSecondary, isExpanded && "rotate-180")} />
                      </button>
                      {isExpanded && <div className={cn("px-4 pb-4", textSecondary)}>{faq.a}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );

      case 'troubleshooting':
        return (
          <div className="space-y-6">
            <h2 className={cn("text-xl font-bold", textPrimary)}>Troubleshooting Guide</h2>
            {TROUBLESHOOTING_DATA.map((issue) => (
              <div key={issue.id} className={cn(bgSecondary, borderColor, "border rounded-xl p-4 cursor-pointer transition-all", selectedIssue === issue.id ? "ring-2 ring-teal-500/50" : hoverBg)} onClick={() => setSelectedIssue(selectedIssue === issue.id ? null : issue.id)} data-testid={`troubleshoot-${issue.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className={cn("font-semibold", textPrimary)}>{issue.title}</h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", getSeverityColor(issue.severity))}>{issue.severity}</span>
                  </div>
                  <ChevronRight className={cn("w-5 h-5 transition-transform", textSecondary, selectedIssue === issue.id && "rotate-90")} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {issue.symptoms.map((s, idx) => <span key={idx} className={cn("text-xs px-2 py-1 rounded-full", isDark ? "bg-white/10" : "bg-gray-100", textSecondary)}>{s}</span>)}
                </div>
                {selectedIssue === issue.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <p className={cn("text-sm font-medium", textPrimary)}>Solutions:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      {issue.solutions.map((sol, idx) => <li key={idx} className={cn("text-sm", textSecondary)}>{sol}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            ))}
            <div className={cn(bgSecondary, borderColor, "border rounded-xl p-4 mt-6")}>
              <p className={cn("text-sm", textSecondary)}>Still having issues? Contact <a href="mailto:support@datapulse.io" className="text-teal-400 hover:underline">support@datapulse.io</a></p>
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-6">
            <h2 className={cn("text-xl font-bold", textPrimary)}>Keyboard Shortcuts</h2>
            {KEYBOARD_SHORTCUTS.map((group, idx) => (
              <div key={idx} className={cn(bgSecondary, borderColor, "border rounded-xl p-4")}>
                <h3 className={cn("font-semibold mb-3", textPrimary)}>{group.category}</h3>
                <div className="space-y-2">
                  {group.shortcuts.map((s, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between">
                      <span className={textSecondary}>{s.action}</span>
                      <div className="flex gap-1">
                        {s.keys.map((key, kIdx) => <kbd key={kIdx} className={cn("px-2 py-1 text-xs rounded font-mono", isDark ? "bg-white/10" : "bg-gray-100", textPrimary)}>{key}</kbd>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      case 'whats-new':
        return (
          <div className="space-y-6">
            <h2 className={cn("text-xl font-bold", textPrimary)}>What's New in DataPulse</h2>
            {WHATS_NEW.map((release, idx) => (
              <div key={idx} className={cn(bgSecondary, borderColor, "border rounded-xl p-4")} data-testid={`release-${release.version}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={cn("font-bold text-lg", textPrimary)}>v{release.version}</span>
                  <span className={textSecondary}>{release.date}</span>
                </div>
                <div className="space-y-3">
                  {release.highlights.map((item, hIdx) => (
                    <div key={hIdx} className="flex items-start gap-3">
                      <span className={cn("px-2 py-0.5 text-xs rounded shrink-0", item.type === 'feature' ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400")}>{item.type}</span>
                      <div>
                        <p className={cn("font-medium", textPrimary)}>{item.title}</p>
                        <p className={cn("text-sm", textSecondary)}>{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            {/* Quick Links */}
            <div className={cn(bgSecondary, borderColor, "border rounded-xl p-5")}>
              <h2 className={cn("font-semibold mb-4", textPrimary)}>Quick Links</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { tab: 'faq', icon: HelpCircle, label: 'FAQ' },
                  { tab: 'troubleshooting', icon: AlertCircle, label: 'Troubleshooting' },
                  { tab: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
                  { tab: 'whats-new', icon: Sparkles, label: "What's New" },
                ].map(({ tab, icon: Icon, label }) => (
                  <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)} 
                    className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all", isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200", borderColor, "border hover:border-teal-500/30")}
                    data-testid={`quick-link-${tab}`}
                  >
                    <Icon className="w-4 h-4 text-teal-500" />
                    <span className={cn("text-sm", textPrimary)}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Popular Articles */}
            <div className={cn(bgSecondary, borderColor, "border rounded-xl p-5")}>
              <h2 className={cn("font-semibold mb-4", textPrimary)}>Popular Articles</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {HELP_CATEGORIES.flatMap(cat => cat.articles.filter(a => a.popular).map(a => ({ ...a, category: cat }))).slice(0, 6).map((article) => {
                  const Icon = article.category.icon;
                  return (
                    <button 
                      key={article.id} 
                      onClick={() => handleArticleClick(article.category.id, article.id)} 
                      className={cn("text-left p-4 rounded-xl transition-all", isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200", borderColor, "border hover:border-teal-500/30")}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-teal-500" />
                        <span className={cn("text-xs", textMuted)}>{article.category.title}</span>
                      </div>
                      <h3 className={cn("font-medium mb-1", textPrimary)}>{article.title}</h3>
                      <p className={cn("text-xs", textMuted)}>{article.readTime} read</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories Preview */}
            {HELP_CATEGORIES.slice(0, 4).map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.id} className={cn(bgSecondary, borderColor, "border rounded-xl p-5")}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="w-5 h-5 text-teal-500" />
                    <h2 className={cn("font-semibold", textPrimary)}>{category.title}</h2>
                  </div>
                  <p className={cn("text-sm mb-4", textSecondary)}>{category.description}</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    {category.articles.slice(0, 2).map((article) => (
                      <button 
                        key={article.id} 
                        onClick={() => handleArticleClick(category.id, article.id)} 
                        className={cn("text-left p-3 rounded-lg transition-all flex items-center justify-between", isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200")}
                      >
                        <span className={cn("text-sm", textPrimary)}>{article.title}</span>
                        <ChevronRight className={cn("w-4 h-4", textMuted)} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className={cn("min-h-screen p-6", bgPrimary)}>
        {/* Header */}
        <div className="mb-8">
          <h1 className={cn("text-3xl font-bold mb-2", textPrimary)}>Help Center</h1>
          <p className={textSecondary}>Find answers, tutorials, and documentation for DataPulse</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", textMuted)} />
          <input 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search articles, guides, and FAQs..." 
            className={cn("w-full pl-12 py-4 rounded-xl text-sm", bgSecondary, borderColor, "border", textPrimary, "placeholder-gray-500 outline-none focus:ring-2 focus:ring-teal-500/50")} 
            data-testid="help-search-input"
          />
          {searchQuery && searchResults.length > 0 && (
            <div className={cn("absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto z-50 rounded-xl shadow-xl", bgSecondary, borderColor, "border")}>
              {searchResults.map((result, idx) => (
                <button 
                  key={idx} 
                  onClick={() => { handleArticleClick(result.category.id, result.id); setSearchQuery(''); }} 
                  className={cn("w-full text-left px-4 py-3 border-b last:border-0", borderColor, hoverBg)}
                >
                  <p className={cn("text-sm font-medium", textPrimary)}>{result.title}</p>
                  <p className={cn("text-xs", textMuted)}>{result.category.title} • {result.readTime}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className={cn("w-72 flex-shrink-0 rounded-xl p-5 h-fit sticky top-6", bgSecondary, borderColor, "border")}>
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 rounded-lg bg-teal-500/10">
                <ClipboardList className="w-4 h-4 text-teal-500" />
              </div>
              <h2 className={cn("font-semibold", textPrimary)}>Categories</h2>
            </div>
            <nav className="space-y-1">
              {HELP_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isExpanded = expandedCategory === category.id;
                return (
                  <div key={category.id}>
                    <button 
                      onClick={() => setExpandedCategory(isExpanded ? null : category.id)} 
                      className={cn("w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors", isExpanded ? cn(isDark ? "bg-white/5" : "bg-gray-100", textPrimary) : cn(textSecondary, hoverBg))}
                      data-testid={`category-${category.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-teal-500/70" />
                        <span>{category.title}</span>
                      </div>
                      <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
                    </button>
                    {isExpanded && (
                      <div className="ml-10 mt-1 space-y-1">
                        {category.articles.map((article) => (
                          <button 
                            key={article.id} 
                            onClick={() => handleArticleClick(category.id, article.id)} 
                            className={cn("w-full text-left px-3 py-1.5 text-sm transition-colors rounded", textMuted, "hover:text-teal-400")}
                          >
                            {article.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            
            {/* Quick Access Links */}
            <div className={cn("mt-6 pt-4 border-t", borderColor)}>
              {[
                { tab: 'faq', icon: HelpCircle, label: 'FAQs' },
                { tab: 'troubleshooting', icon: AlertCircle, label: 'Troubleshooting' },
                { tab: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
                { tab: 'whats-new', icon: Sparkles, label: "What's New" },
              ].map(({ tab, icon: Icon, label }) => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)} 
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors", activeTab === tab ? cn(isDark ? "bg-white/5" : "bg-gray-100", textPrimary) : cn(textSecondary, hoverBg))}
                  data-testid={`sidebar-${tab}`}
                >
                  <Icon className="w-4 h-4 text-teal-500/70" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>

        {/* AI Assistant */}
        <HelpAssistant isDark={isDark} />
      </div>
    </DashboardLayout>
  );
}

export default HelpCenterPage;
