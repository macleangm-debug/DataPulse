/**
 * Command Palette / Quick Search
 * ⌘K (Cmd+K / Ctrl+K) to open universal search
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FileText,
  Folder,
  Database,
  Users,
  Settings,
  BarChart3,
  MapPin,
  Brain,
  Sparkles,
  Command,
  ArrowRight,
  Clock,
  Star,
  Zap,
  Plus,
  Home,
  ClipboardList,
  Shield,
  Workflow,
  X,
  BookOpen
} from 'lucide-react';
import { cn } from '../lib/utils';

// Command categories and items
const COMMANDS = [
  {
    category: 'Navigation',
    items: [
      { id: 'dashboard', label: 'Go to Dashboard', icon: Home, path: '/dashboard', keywords: ['home', 'overview'] },
      { id: 'projects', label: 'Go to Projects', icon: Folder, path: '/projects', keywords: ['folders'] },
      { id: 'forms', label: 'Go to Forms', icon: FileText, path: '/forms', keywords: ['surveys', 'questionnaires'] },
      { id: 'submissions', label: 'Go to Submissions', icon: ClipboardList, path: '/submissions', keywords: ['responses', 'data'] },
      { id: 'analysis', label: 'Go to Data Analysis', icon: BarChart3, path: '/analysis', keywords: ['statistics', 'charts'] },
      { id: 'qualitative', label: 'Go to Qualitative Analysis', icon: BookOpen, path: '/qualitative', keywords: ['coding', 'transcripts', 'themes'] },
      { id: 'quality-ai', label: 'Go to Quality AI', icon: Brain, path: '/quality-ai', keywords: ['monitoring', 'alerts'] },
      { id: 'team', label: 'Go to Team', icon: Users, path: '/team', keywords: ['members', 'users'] },
      { id: 'settings', label: 'Go to Settings', icon: Settings, path: '/settings', keywords: ['preferences', 'config'] },
    ]
  },
  {
    category: 'Quick Actions',
    items: [
      { id: 'new-form', label: 'Create New Form', icon: Plus, path: '/forms/new', keywords: ['add', 'create', 'survey'] },
      { id: 'new-project', label: 'Create New Project', icon: Plus, path: '/projects/new', keywords: ['add', 'create'] },
      { id: 'import-data', label: 'Import Data', icon: Database, path: '/cases/import', keywords: ['upload', 'csv'] },
      { id: 'export', label: 'Export Data', icon: Database, path: '/exports', keywords: ['download', 'csv'] },
    ]
  },
  {
    category: 'Features',
    items: [
      { id: 'gps-map', label: 'GPS Map View', icon: MapPin, path: '/map', keywords: ['location', 'tracking'] },
      { id: 'workflows', label: 'Workflows', icon: Workflow, path: '/workflows', keywords: ['automation'] },
      { id: 'rbac', label: 'Roles & Permissions', icon: Shield, path: '/rbac', keywords: ['access', 'security'] },
      { id: 'devices', label: 'Device Management', icon: Sparkles, path: '/devices', keywords: ['mobile', 'tablet'] },
    ]
  }
];

// Keyboard shortcut definitions
const SHORTCUTS = [
  { keys: ['⌘', 'K'], action: 'Open Command Palette', id: 'search' },
  { keys: ['⌘', 'N'], action: 'New Form', id: 'new-form' },
  { keys: ['⌘', 'P'], action: 'Go to Projects', id: 'projects' },
  { keys: ['⌘', 'D'], action: 'Go to Dashboard', id: 'dashboard' },
  { keys: ['⌘', ','], action: 'Open Settings', id: 'settings' },
  { keys: ['⌘', '/'], action: 'Toggle Help', id: 'help' },
  { keys: ['Esc'], action: 'Close Modal', id: 'escape' },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState(() => {
    const saved = localStorage.getItem('datapulse_recent_commands');
    return saved ? JSON.parse(saved) : [];
  });
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Filter commands based on query
  const filteredCommands = query.trim() === '' 
    ? COMMANDS 
    : COMMANDS.map(category => ({
        ...category,
        items: category.items.filter(item => {
          const searchText = `${item.label} ${item.keywords?.join(' ')}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        })
      })).filter(category => category.items.length > 0);

  // Get flat list of all visible items for keyboard navigation
  const flatItems = filteredCommands.flatMap(cat => cat.items);

  // Handle keyboard shortcuts globally
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ⌘K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }

      // ⌘N or Ctrl+N for new form
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !isOpen) {
        e.preventDefault();
        navigate('/forms/new');
      }

      // ⌘P or Ctrl+P for projects
      if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !isOpen) {
        e.preventDefault();
        navigate('/projects');
      }

      // ⌘D or Ctrl+D for dashboard
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && !isOpen) {
        e.preventDefault();
        navigate('/dashboard');
      }

      // ⌘, or Ctrl+, for settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, navigate]);

  // Execute a command - defined before useEffects that depend on it
  const executeCommand = useCallback((item) => {
    // Add to recent commands
    const newRecent = [item.id, ...recentCommands.filter(id => id !== item.id)].slice(0, 5);
    setRecentCommands(newRecent);
    localStorage.setItem('datapulse_recent_commands', JSON.stringify(newRecent));

    // Navigate and close
    navigate(item.path);
    setIsOpen(false);
    setQuery('');
  }, [navigate, recentCommands]);

  // Handle keyboard navigation within palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      const currentFlatItems = filteredCommands.flatMap(cat => cat.items);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, currentFlatItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + currentFlatItems.length) % Math.max(1, currentFlatItems.length));
      } else if (e.key === 'Enter' && currentFlatItems[selectedIndex]) {
        e.preventDefault();
        executeCommand(currentFlatItems[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, executeCommand]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Get recent items
  const recentItems = recentCommands
    .map(id => flatItems.find(item => item.id === id))
    .filter(Boolean)
    .slice(0, 3);


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200]"
          />
          
          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[201]"
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search commands, pages, actions..."
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                />
                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted rounded border border-border">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {/* Recent Commands */}
                {query === '' && recentItems.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Recent
                    </div>
                    {recentItems.map((item, idx) => {
                      const Icon = item.icon;
                      const globalIdx = flatItems.findIndex(i => i.id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => executeCommand(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            selectedIndex === globalIdx
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 text-sm">{item.label}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Command Categories */}
                {filteredCommands.map((category, catIdx) => (
                  <div key={category.category} className="mb-2">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.category}
                    </div>
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const globalIdx = flatItems.findIndex(i => i.id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => executeCommand(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                            selectedIndex === globalIdx
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 text-sm">{item.label}</span>
                          {item.id === 'new-form' && (
                            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground bg-muted rounded border border-border">
                              <Command className="w-2.5 h-2.5" />N
                            </kbd>
                          )}
                          <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* No Results */}
                {flatItems.length === 0 && (
                  <div className="py-8 text-center">
                    <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
                  </div>
                )}
              </div>

              {/* Footer with shortcuts */}
              <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px]">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px]">↵</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[9px]">esc</kbd>
                    Close
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Zap className="w-3 h-3" />
                  Quick Actions
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Keyboard Shortcuts Display Component (for help panel)
export function KeyboardShortcutsDisplay() {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Keyboard Shortcuts</h4>
      <div className="grid gap-2">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.id} className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">{shortcut.action}</span>
            <div className="flex items-center gap-1">
              {shortcut.keys.map((key, idx) => (
                <kbd
                  key={idx}
                  className="px-2 py-0.5 text-xs font-medium bg-muted border border-border rounded min-w-[24px] text-center"
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

export default CommandPalette;
