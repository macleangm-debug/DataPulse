/**
 * Contextual Help System
 * Provides toggleable help tooltips throughout the app
 * to guide users and maximize retention
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  X,
  Lightbulb,
  Info,
  Zap,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Target,
  TrendingUp,
  Shield,
  Clock,
  Users,
  Database,
  BarChart3,
  FileText,
  Settings,
  Bell,
  MapPin,
  WifiOff,
  Brain,
  Workflow,
  CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { cn } from '../lib/utils';

// Help Context
const HelpContext = createContext(null);

export const useHelp = () => {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within HelpProvider');
  }
  return context;
};

// Comprehensive help content for different areas of the app
const HELP_CONTENT = {
  // Dashboard
  'dashboard-overview': {
    title: 'Dashboard Overview',
    description: 'Your command center for monitoring all research activities at a glance.',
    tips: [
      'Click any metric card to drill down into details',
      'Use the date range selector to filter historical data',
      'Pin important metrics to your custom dashboard'
    ],
    icon: BarChart3,
    category: 'navigation'
  },
  'dashboard-submissions': {
    title: 'Submission Tracking',
    description: 'Real-time count of data submissions across all your forms.',
    tips: [
      'Green indicators show submissions within quality thresholds',
      'Click to view recent submissions and their status',
      'Set up alerts for submission milestones'
    ],
    icon: FileText,
    category: 'metrics'
  },
  'dashboard-quality': {
    title: 'Data Quality Score',
    description: 'AI-calculated quality score based on multiple factors.',
    tips: [
      'Score above 85% indicates excellent data quality',
      'Click for detailed breakdown by quality dimension',
      'Common issues: GPS anomalies, speeding, straight-lining'
    ],
    icon: Target,
    category: 'metrics'
  },

  // Navigation
  'nav-projects': {
    title: 'Projects',
    description: 'Organize your research into logical project containers.',
    tips: [
      'Each project can contain multiple forms',
      'Set project-level permissions for team access',
      'Archive completed projects to keep workspace clean'
    ],
    icon: Database,
    category: 'navigation'
  },
  'nav-forms': {
    title: 'Form Builder',
    description: 'Design powerful data collection instruments with drag-and-drop.',
    tips: [
      'Use templates to speed up form creation',
      'Add skip logic for dynamic questionnaires',
      'Preview forms before deployment'
    ],
    icon: FileText,
    category: 'navigation'
  },
  'nav-analysis': {
    title: 'Data Analysis',
    description: 'Professional statistical analysis without leaving the platform.',
    tips: [
      'Create snapshots to preserve data at specific points',
      'Use AI Copilot for natural language queries',
      'Export publication-ready charts and tables'
    ],
    icon: BarChart3,
    category: 'navigation'
  },
  'nav-quality-ai': {
    title: 'Quality AI',
    description: 'AI-powered monitoring that catches issues before they become problems.',
    tips: [
      'Configure sensitivity thresholds per form',
      'Review flagged submissions for false positives',
      'Export quality reports for stakeholders'
    ],
    icon: Brain,
    category: 'navigation'
  },

  // Features
  'feature-offline': {
    title: 'Offline Data Collection',
    description: 'Collect data anywhere, even without internet connectivity.',
    tips: [
      'Data is encrypted locally with AES-256',
      'Automatic sync when connection is restored',
      'Check sync status in the bottom status bar'
    ],
    icon: WifiOff,
    category: 'feature',
    highlight: true
  },
  'feature-gps': {
    title: 'GPS Tracking',
    description: 'Automatic location capture for field data verification.',
    tips: [
      'GPS accuracy shown with each submission',
      'Geo-fencing validates enumerator locations',
      'View all submissions on the GPS map'
    ],
    icon: MapPin,
    category: 'feature'
  },
  'feature-notifications': {
    title: 'Smart Notifications',
    description: 'Stay informed with intelligent, actionable alerts.',
    tips: [
      'Customize notification preferences in Settings',
      'Enable push notifications for mobile alerts',
      'Set quiet hours to avoid after-work notifications'
    ],
    icon: Bell,
    category: 'feature'
  },

  // Form Builder
  'form-question-types': {
    title: 'Question Types',
    description: 'Choose from 20+ field types for comprehensive data collection.',
    tips: [
      'Use cascading selects for hierarchical data',
      'Matrix questions for rating scales',
      'Signature capture for consent forms'
    ],
    icon: FileText,
    category: 'builder'
  },
  'form-skip-logic': {
    title: 'Skip Logic',
    description: 'Create dynamic forms that adapt to respondent answers.',
    tips: [
      'Combine multiple conditions with AND/OR',
      'Test all logic paths before deployment',
      'Use relevance conditions for complex flows'
    ],
    icon: Workflow,
    category: 'builder'
  },
  'form-validation': {
    title: 'Data Validation',
    description: 'Ensure data quality at the point of collection.',
    tips: [
      'Set min/max values for numeric fields',
      'Use regex patterns for custom validation',
      'Add constraint messages to guide respondents'
    ],
    icon: Shield,
    category: 'builder'
  },

  // Analysis
  'analysis-snapshots': {
    title: 'Data Snapshots',
    description: 'Create immutable copies of your data for reproducible analysis.',
    tips: [
      'Snapshots include hash verification',
      'Compare snapshots to track data changes',
      'Required for official reports and publications'
    ],
    icon: Database,
    category: 'analysis'
  },
  'analysis-statistics': {
    title: 'Statistical Analysis',
    description: 'From basic frequencies to advanced regression models.',
    tips: [
      'Start with descriptive statistics for overview',
      'Use cross-tabulations for relationships',
      'Complex survey features handle weighted data'
    ],
    icon: BarChart3,
    category: 'analysis'
  },
  'analysis-ai-copilot': {
    title: 'AI Copilot',
    description: 'Ask questions about your data in plain English.',
    tips: [
      'Try: "Show me response rates by region"',
      'Ask for correlations between variables',
      'Request visualizations directly'
    ],
    icon: Sparkles,
    category: 'analysis',
    highlight: true
  },

  // Team & Collaboration
  'team-roles': {
    title: 'Role-Based Access',
    description: 'Control who can see and do what across your organization.',
    tips: [
      'Create custom roles for specific needs',
      'Assign permissions at project or form level',
      'Audit log tracks all permission changes'
    ],
    icon: Users,
    category: 'team'
  },
  'team-activity': {
    title: 'Team Activity',
    description: 'Monitor your team\'s real-time activity and productivity.',
    tips: [
      'Track submissions per enumerator',
      'Identify bottlenecks in data collection',
      'Celebrate top performers with badges'
    ],
    icon: TrendingUp,
    category: 'team'
  }
};

// Pro tips that rotate
const PRO_TIPS = [
  { tip: 'Press ⌘K anywhere to quickly search forms, projects, and submissions', icon: Zap },
  { tip: 'Right-click any submission to access quick actions', icon: Target },
  { tip: 'Use Ctrl+S to save your form while editing', icon: FileText },
  { tip: 'Enable dark mode in Settings for reduced eye strain', icon: Settings },
  { tip: 'The AI Copilot can generate charts from natural language', icon: Sparkles },
  { tip: 'Export data snapshots for reproducible analysis', icon: Database },
  { tip: 'Set up webhooks to integrate with external systems', icon: Workflow },
  { tip: 'Quality scores update in real-time as data comes in', icon: Target },
  { tip: 'Archive old projects to keep your workspace organized', icon: CheckCircle },
  { tip: 'Use templates to create new forms faster', icon: Clock }
];

// Help Provider Component
export function HelpProvider({ children }) {
  const [helpEnabled, setHelpEnabled] = useState(() => {
    const saved = localStorage.getItem('datapulse_help_enabled');
    return saved === 'true'; // Default to false unless explicitly enabled
  });
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);

  // Save help preference
  useEffect(() => {
    localStorage.setItem('datapulse_help_enabled', helpEnabled.toString());
  }, [helpEnabled]);

  // Rotate pro tips
  useEffect(() => {
    if (!helpEnabled) return;
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % PRO_TIPS.length);
    }, 30000); // Change tip every 30 seconds
    return () => clearInterval(interval);
  }, [helpEnabled]);

  const value = {
    helpEnabled,
    setHelpEnabled,
    showHelpPanel,
    setShowHelpPanel,
    currentTip: PRO_TIPS[currentTip]
  };

  return (
    <HelpContext.Provider value={value}>
      {children}
    </HelpContext.Provider>
  );
}

// Inline Help Tooltip Component
export function HelpTooltip({ helpKey, children, side = 'top', className }) {
  const { helpEnabled } = useHelp();
  const content = HELP_CONTENT[helpKey];

  if (!helpEnabled || !content) {
    return children;
  }

  const Icon = content.icon;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={cn("relative inline-flex items-center", className)}>
            {children}
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
              <HelpCircle className="w-2 h-2 text-primary" />
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs p-0 overflow-hidden">
          <div className={cn(
            "p-3 border-b border-border",
            content.highlight && "bg-gradient-to-r from-primary/10 to-transparent"
          )}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">{content.title}</span>
              {content.highlight && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pro</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{content.description}</p>
          </div>
          {content.tips && content.tips.length > 0 && (
            <div className="p-2 bg-muted/30">
              <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                Quick Tips
              </p>
              <ul className="space-y-0.5">
                {content.tips.slice(0, 2).map((tip, idx) => (
                  <li key={idx} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <ChevronRight className="w-2 h-2 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Help Icon Button (inline with element)
export function HelpIcon({ helpKey, className }) {
  const { helpEnabled, setShowHelpPanel } = useHelp();
  const content = HELP_CONTENT[helpKey];

  if (!helpEnabled || !content) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowHelpPanel(true)}
            className={cn(
              "inline-flex items-center justify-center w-4 h-4 rounded-full",
              "bg-primary/10 hover:bg-primary/20 text-primary transition-colors",
              className
            )}
          >
            <HelpCircle className="w-2.5 h-2.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {content.title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Floating Pro Tip Banner
export function ProTipBanner() {
  const { helpEnabled, currentTip } = useHelp();
  const [dismissed, setDismissed] = useState(false);

  if (!helpEnabled || dismissed) return null;

  const TipIcon = currentTip.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-full shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Pro Tip:</span>
          </div>
          <p className="text-sm text-foreground max-w-md">{currentTip.tip}</p>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Help Toggle Button (for header)
export function HelpToggleButton() {
  const context = useContext(HelpContext);
  
  // If context is not available, render disabled button
  if (!context) {
    return (
      <button className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" disabled>
        <HelpCircle className="w-5 h-5" />
      </button>
    );
  }
  
  const { helpEnabled, setShowHelpPanel } = context;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="help-toggle-btn"
            onClick={() => setShowHelpPanel(true)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              helpEnabled 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Help & Tips {helpEnabled ? '(On)' : '(Off)'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Full Help Panel (slide-out)
export function HelpPanel() {
  const { showHelpPanel, setShowHelpPanel, helpEnabled, setHelpEnabled } = useHelp();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Topics', icon: BookOpen },
    { id: 'navigation', label: 'Navigation', icon: Target },
    { id: 'feature', label: 'Features', icon: Sparkles },
    { id: 'builder', label: 'Form Builder', icon: FileText },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'team', label: 'Team', icon: Users }
  ];

  const filteredContent = Object.entries(HELP_CONTENT).filter(
    ([_, content]) => selectedCategory === 'all' || content.category === selectedCategory
  );

  return (
    <AnimatePresence>
      {showHelpPanel && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHelpPanel(false)}
            className="fixed inset-0 bg-black/50 z-[100]"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-border z-[101] flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Help Center</h2>
                  <p className="text-xs text-muted-foreground">Tips, guides & keyboard shortcuts</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpPanel(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Help Mode Toggle */}
            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lightbulb className={cn(
                    "w-5 h-5 transition-colors",
                    helpEnabled ? "text-amber-500" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Contextual Help</p>
                    <p className="text-xs text-muted-foreground">Show help indicators on UI elements</p>
                  </div>
                </div>
                <Switch
                  checked={helpEnabled}
                  onCheckedChange={setHelpEnabled}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="p-3 border-b border-border">
              <div className="flex gap-1 overflow-x-auto pb-1">
                {categories.map(cat => {
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <CatIcon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredContent.map(([key, content]) => {
                const Icon = content.icon;
                return (
                  <div
                    key={key}
                    className={cn(
                      "p-4 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors cursor-pointer",
                      content.highlight && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        content.highlight ? "bg-primary/20" : "bg-muted"
                      )}>
                        <Icon className={cn(
                          "w-5 h-5",
                          content.highlight ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm text-foreground">{content.title}</h3>
                          {content.highlight && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-0">
                              Featured
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{content.description}</p>
                        {content.tips && (
                          <ul className="space-y-1">
                            {content.tips.map((tip, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <ChevronRight className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Need more help?
                  </span>
                </div>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Documentation
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Keyboard Shortcuts Panel Component
export function KeyboardShortcuts() {
  const shortcuts = [
    { keys: ['⌘', 'K'], action: 'Quick Search' },
    { keys: ['⌘', 'S'], action: 'Save Form' },
    { keys: ['⌘', 'N'], action: 'New Form' },
    { keys: ['⌘', '/'], action: 'Toggle Help' },
    { keys: ['Esc'], action: 'Close Modal' },
    { keys: ['⌘', 'Enter'], action: 'Submit' }
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground mb-3">Keyboard Shortcuts</p>
      <div className="grid gap-2">
        {shortcuts.map((shortcut, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{shortcut.action}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, kidx) => (
                <kbd
                  key={kidx}
                  className="px-2 py-0.5 text-xs font-medium bg-muted border border-border rounded"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default HelpProvider;
