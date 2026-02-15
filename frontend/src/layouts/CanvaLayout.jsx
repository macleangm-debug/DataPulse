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

export function CanvaLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { currentOrg, organizations, setCurrentOrg } = useOrgStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  
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
      <div className="flex h-screen bg-slate-50 font-body">
        {/* Rail - Thin icon sidebar */}
        <aside className="hidden lg:flex flex-col items-center w-[72px] bg-white border-r border-slate-100 py-4">
          {/* Logo */}
          <Link to="/dashboard" className="mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-violet-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </Link>

          {/* Create Button */}
          <Button
            onClick={() => navigate('/forms/new')}
            className="w-12 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 mb-6"
            size="icon"
          >
            <Plus className="w-5 h-5" />
          </Button>

          {/* Navigation Rail Items */}
          <nav className="flex-1 flex flex-col items-center gap-1">
            {NAVIGATION.map((group) => {
              const Icon = group.icon;
              const isActive = activeGroup === group.id;
              
              return (
                <Tooltip key={group.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleRailClick(group)}
                      className={cn(
                        "rail-item",
                        isActive && "active"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-900 text-white">
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Bottom section - Profile */}
          <div className="mt-auto flex flex-col items-center gap-2">
            <OfflineStatusIndicator compact />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rail-item">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-violet-100 text-violet-700 text-xs">
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
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
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
              className="hidden lg:block bg-white border-r border-slate-100 overflow-hidden"
            >
              <div className="w-[260px] h-full flex flex-col">
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">{currentGroup?.label}</h2>
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
                            ? "bg-violet-50 text-violet-700 font-medium" 
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                  <div className="p-3 border-t border-slate-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-medium text-xs">
                            {currentOrg?.name?.charAt(0) || 'O'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {currentOrg?.name || 'Select Org'}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {organizations.map((org) => (
                          <DropdownMenuItem
                            key={org.id}
                            onClick={() => setCurrentOrg(org)}
                            className={cn(
                              currentOrg?.id === org.id && "bg-violet-50"
                            )}
                          >
                            <div className="w-6 h-6 rounded bg-violet-100 flex items-center justify-center text-violet-700 text-xs mr-2">
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
          <header className="h-14 bg-white border-b border-slate-100 flex items-center px-4 lg:px-6 gap-4">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Panel Toggle (Desktop) */}
            {showPanel && (
              <button
                onClick={() => setPanelOpen(!panelOpen)}
                className="hidden lg:flex p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                {panelOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border-0 rounded-lg focus:bg-white focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-600 rounded-full" />
              </button>

              {/* Desktop Profile (redundant but common pattern) */}
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-100">
                <span className="text-sm text-slate-600">{user?.name}</span>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-slate-50">
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
                className="fixed left-0 top-0 bottom-0 w-[280px] bg-white z-50 lg:hidden overflow-y-auto"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-slate-900">DataPulse</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
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
                            isActive ? "bg-violet-50 text-violet-700" : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {group.label}
                        </button>
                        
                        {isActive && group.items?.length > 0 && (
                          <div className="mt-1 ml-4 pl-4 border-l border-slate-200 space-y-1">
                            {group.items.map((item) => (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  "block px-3 py-2 rounded-lg text-sm",
                                  location.pathname === item.path
                                    ? "bg-violet-50 text-violet-700"
                                    : "text-slate-600 hover:bg-slate-50"
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
                <div className="p-4 border-t border-slate-100 mt-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="bg-violet-100 text-violet-700">
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

export { CanvaLayout as DashboardLayout };
export default CanvaLayout;
