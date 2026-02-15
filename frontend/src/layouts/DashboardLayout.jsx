/**
 * DataPulse - Canva-inspired Layout
 * Rail + Expandable Panel navigation system
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  House,
  Folder,
  Database,
  MapPin,
  Sparkles,
  LayoutGrid,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronRight,
  FileText,
  Layout,
  ClipboardList,
  Briefcase,
  Table2,
  Download,
  Phone,
  ClipboardCheck,
  Link2,
  ArrowLeftRight,
  Smartphone,
  Brain,
  Route,
  BarChart3,
  Puzzle,
  Workflow,
  Users,
  Shield,
  Languages,
  Key,
  Crown,
  Plus
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { useAuthStore, useOrgStore, useUIStore } from '../store';
import { cn } from '../lib/utils';
import { OfflineStatusIndicator } from '../components/OfflineStatus';

// Navigation structure - grouped for Canva-style rail
const NAVIGATION = [
  {
    id: 'home',
    label: 'Home',
    icon: House,
    path: '/dashboard',
    items: []
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: Folder,
    items: [
      { label: 'All Projects', path: '/projects', icon: Folder },
      { label: 'Forms', path: '/forms', icon: FileText },
      { label: 'Templates', path: '/templates', icon: Layout },
      { label: 'Submissions', path: '/submissions', icon: ClipboardList }
    ]
  },
  {
    id: 'data',
    label: 'Data',
    icon: Database,
    items: [
      { label: 'Cases', path: '/cases', icon: Briefcase },
      { label: 'Import Cases', path: '/cases/import', icon: Plus },
      { label: 'Datasets', path: '/datasets', icon: Table2 },
      { label: 'Exports', path: '/exports', icon: Download }
    ]
  },
  {
    id: 'field_ops',
    label: 'Field Ops',
    icon: MapPin,
    items: [
      { label: 'CATI Center', path: '/cati', icon: Phone },
      { label: 'Back-check', path: '/backcheck', icon: ClipboardCheck },
      { label: 'Token Surveys', path: '/token-surveys', icon: Link2 },
      { label: 'Preload/Writeback', path: '/preload', icon: ArrowLeftRight },
      { label: 'Devices', path: '/devices', icon: Smartphone }
    ]
  },
  {
    id: 'quality',
    label: 'Quality & AI',
    icon: Sparkles,
    items: [
      { label: 'Data Analysis', path: '/analysis', icon: BarChart3 },
      { label: 'Quality AI', path: '/quality-ai', icon: Brain },
      { label: 'Simulation', path: '/simulation', icon: Route },
      { label: 'Analytics', path: '/analytics', icon: BarChart3 },
      { label: 'Quality', path: '/quality', icon: Sparkles },
      { label: 'GPS Map', path: '/map', icon: MapPin }
    ]
  },
  {
    id: 'apps',
    label: 'Apps',
    icon: LayoutGrid,
    items: [
      { label: 'Plugins', path: '/plugins', icon: Puzzle },
      { label: 'Workflows', path: '/workflows', icon: Workflow }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { label: 'Team', path: '/team', icon: Users },
      { label: 'Roles', path: '/rbac', icon: Shield },
      { label: 'Translations', path: '/translations', icon: Languages },
      { label: 'API Security', path: '/security', icon: Key },
      { label: 'Settings', path: '/settings', icon: Settings },
      { label: 'Super Admin', path: '/admin', icon: Crown }
    ]
  }
];

// Find active group based on current path
function findActiveGroup(pathname) {
  for (const group of NAVIGATION) {
    if (group.path === pathname) return group.id;
    for (const item of group.items || []) {
      if (pathname.startsWith(item.path)) return group.id;
    }
  }
  return 'home';
}

export function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentOrg, organizations, setCurrentOrg } = useOrgStore();
  
  const [activeGroup, setActiveGroup] = useState('home');
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Update active group based on route
  useEffect(() => {
    const group = findActiveGroup(location.pathname);
    setActiveGroup(group);
  }, [location.pathname]);

  // Get current group data
  const currentGroup = NAVIGATION.find(g => g.id === activeGroup);
  const showPanel = currentGroup?.items?.length > 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRailClick = (group) => {
    setActiveGroup(group.id);
    if (group.path) {
      navigate(group.path);
    } else if (group.items?.length > 0) {
      setPanelOpen(true);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Rail - Thin icon sidebar with labels */}
        <aside className="hidden lg:flex flex-col items-center w-[80px] bg-card border-r border-border py-4">
          {/* Logo */}
          <Link to="/dashboard" className="mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </Link>

          {/* Online Status with Quick Links Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="cursor-pointer mb-2">
                <OfflineStatusIndicator compact />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-56">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground">Quick Links</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                <House className="w-4 h-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/projects')}>
                <Folder className="w-4 h-4 mr-2" />
                Recent Projects
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/forms')}>
                <FileText className="w-4 h-4 mr-2" />
                Recent Forms
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/forms/new')}>
                <Plus className="w-4 h-4 mr-2" />
                New Form
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/analysis')}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Data Analysis
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/submissions')}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Submissions
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Create Button */}
          <button
            onClick={() => navigate('/forms/new')}
            className="w-14 h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 mb-4 flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[9px] font-medium">Create</span>
          </button>

          {/* Navigation Rail Items with Labels */}
          <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto">
            {NAVIGATION.map((group) => {
              const Icon = group.icon;
              const isActive = activeGroup === group.id;
              
              return (
                <Tooltip key={group.id} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleRailClick(group)}
                      className={cn(
                        "w-16 py-2 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium leading-tight text-center">
                        {group.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover text-popover-foreground border border-border">
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Bottom section - Profile */}
          <div className="mt-auto flex flex-col items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-muted">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="font-medium text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Expandable Panel */}
        <AnimatePresence mode="wait">
          {showPanel && panelOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:block bg-card border-r border-border overflow-hidden"
            >
              <div className="w-[260px] h-full flex flex-col">
                {/* Panel Header */}
                <div className="p-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">{currentGroup?.label}</h2>
                </div>

                {/* Panel Items */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                  {currentGroup?.items?.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path || 
                                    location.pathname.startsWith(item.path + '/');
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                        {isActive && (
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Organization Selector */}
                {organizations?.length > 0 && (
                  <div className="p-3 border-t border-border">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                            {currentOrg?.name?.charAt(0) || 'O'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {currentOrg?.name || 'Select Org'}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {organizations.map((org) => (
                          <DropdownMenuItem
                            key={org.id}
                            onClick={() => setCurrentOrg(org)}
                            className={cn(
                              currentOrg?.id === org.id && "bg-primary/10"
                            )}
                          >
                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs mr-2">
                              {org.name?.charAt(0)}
                            </div>
                            {org.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/organizations/new')}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Organization
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="h-14 bg-card border-b border-border flex items-center px-4 lg:px-6 gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Panel Toggle (Desktop) */}
            {showPanel && (
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                className="hidden lg:flex p-2 rounded-lg hover:bg-muted text-muted-foreground"
              >
                {panelOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-muted border-0 rounded-lg focus:bg-background focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
              </button>

              {/* Desktop Profile */}
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-border">
                <span className="text-sm text-muted-foreground">{user?.name}</span>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed left-0 top-0 bottom-0 w-[280px] bg-card z-50 lg:hidden overflow-y-auto"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="font-semibold text-foreground">DataPulse</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-muted">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="p-3">
                  {NAVIGATION.map((group) => {
                    const Icon = group.icon;
                    const isActive = activeGroup === group.id;
                    
                    return (
                      <div key={group.id} className="mb-4">
                        <button
                          onClick={() => {
                            if (group.path) {
                              navigate(group.path);
                              setMobileMenuOpen(false);
                            } else {
                              setActiveGroup(isActive ? '' : group.id);
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
                            isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {group.label}
                        </button>
                        
                        {isActive && group.items?.length > 0 && (
                          <div className="mt-1 ml-4 pl-4 border-l border-border space-y-1">
                            {group.items.map((item) => (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  "block px-3 py-2 rounded-lg text-sm",
                                  location.pathname === item.path
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>

                {/* Mobile User */}
                <div className="p-4 border-t border-border mt-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user?.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </Button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}

// Named exports for backward compatibility
export const Sidebar = () => null; // Deprecated - use DashboardLayout
export const TopBar = () => null; // Deprecated - integrated into DashboardLayout

export default DashboardLayout;
