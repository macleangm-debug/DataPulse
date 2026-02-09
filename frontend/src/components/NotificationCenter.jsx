/**
 * NotificationCenter - Comprehensive notification system for DataPulse
 * Handles push notifications, in-app notifications, quality alerts, and more
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellRing, X, Check, AlertTriangle, Info, CheckCircle, XCircle,
  Cloud, CloudOff, RefreshCw, Users, Shield, FileText, Zap, MapPin,
  Clock, ChevronRight, Settings, Trash2, MarkAsUnread, Filter,
  Database, Brain, Phone, ClipboardCheck, Smartphone, Activity
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// Notification types with their configurations
const NOTIFICATION_TYPES = {
  // Sync notifications
  sync_complete: {
    icon: Cloud,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    title: 'Sync Complete',
    category: 'sync'
  },
  sync_failed: {
    icon: CloudOff,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    title: 'Sync Failed',
    category: 'sync'
  },
  sync_conflict: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    title: 'Sync Conflict',
    category: 'sync'
  },

  // Quality alerts
  quality_issue: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    title: 'Quality Issue Detected',
    category: 'quality'
  },
  speeding_detected: {
    icon: Clock,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    title: 'Interview Speeding',
    category: 'quality'
  },
  straightlining_detected: {
    icon: Activity,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    title: 'Straight-lining Detected',
    category: 'quality'
  },
  gps_anomaly: {
    icon: MapPin,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    title: 'GPS Anomaly',
    category: 'quality'
  },
  duplicate_detected: {
    icon: FileText,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    title: 'Duplicate Entry',
    category: 'quality'
  },

  // Submission notifications
  new_submission: {
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    title: 'New Submission',
    category: 'submissions'
  },
  submission_approved: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    title: 'Submission Approved',
    category: 'submissions'
  },
  submission_rejected: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    title: 'Submission Rejected',
    category: 'submissions'
  },
  revision_required: {
    icon: RefreshCw,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    title: 'Revision Required',
    category: 'submissions'
  },

  // Team notifications
  team_member_joined: {
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    title: 'Team Member Joined',
    category: 'team'
  },
  role_changed: {
    icon: Shield,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    title: 'Role Changed',
    category: 'team'
  },

  // Device notifications
  device_registered: {
    icon: Smartphone,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    title: 'Device Registered',
    category: 'devices'
  },
  device_offline: {
    icon: Smartphone,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    title: 'Device Offline',
    category: 'devices'
  },
  device_wiped: {
    icon: Smartphone,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    title: 'Device Wiped',
    category: 'devices'
  },

  // AI notifications
  ai_analysis_complete: {
    icon: Brain,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    title: 'AI Analysis Complete',
    category: 'ai'
  },
  ai_suggestion: {
    icon: Zap,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    title: 'AI Suggestion',
    category: 'ai'
  },

  // Backcheck notifications
  backcheck_assigned: {
    icon: ClipboardCheck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    title: 'Back-check Assigned',
    category: 'backcheck'
  },
  backcheck_completed: {
    icon: ClipboardCheck,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    title: 'Back-check Completed',
    category: 'backcheck'
  },
  backcheck_discrepancy: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    title: 'Back-check Discrepancy',
    category: 'backcheck'
  },

  // System notifications
  system_update: {
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    title: 'System Update',
    category: 'system'
  },
  maintenance_scheduled: {
    icon: Settings,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    title: 'Maintenance Scheduled',
    category: 'system'
  }
};

// Category configurations
const CATEGORIES = {
  all: { label: 'All', icon: Bell },
  sync: { label: 'Sync', icon: Cloud },
  quality: { label: 'Quality', icon: AlertTriangle },
  submissions: { label: 'Submissions', icon: FileText },
  team: { label: 'Team', icon: Users },
  devices: { label: 'Devices', icon: Smartphone },
  ai: { label: 'AI', icon: Brain },
  backcheck: { label: 'Back-check', icon: ClipboardCheck },
  system: { label: 'System', icon: Settings }
};

// Notification Context
const NotificationContext = createContext(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Notification Provider
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('notification_preferences');
    return saved ? JSON.parse(saved) : {
      enabled: true,
      sound: true,
      desktop: true,
      categories: {
        sync: true,
        quality: true,
        submissions: true,
        team: true,
        devices: true,
        ai: true,
        backcheck: true,
        system: false
      }
    };
  });

  // Load notifications from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications.slice(0, 100)));
  }, [notifications]);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('notification_preferences', JSON.stringify(preferences));
  }, [preferences]);

  // Add notification
  const addNotification = useCallback((type, data = {}) => {
    const typeConfig = NOTIFICATION_TYPES[type];
    if (!typeConfig) return;

    // Check if category is enabled
    if (!preferences.categories[typeConfig.category]) return;

    const notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      ...typeConfig,
      ...data,
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [notification, ...prev].slice(0, 100));

    // Show desktop notification if enabled
    if (preferences.desktop && preferences.enabled && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: data.message || data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: notification.id
      });
    }

    // Play sound if enabled
    if (preferences.sound && preferences.enabled) {
      try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (e) {}
    }

    return notification;
  }, [preferences]);

  // Mark as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Delete notification
  const deleteNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Update preferences
  const updatePreferences = useCallback((newPrefs) => {
    setPreferences(prev => ({ ...prev, ...newPrefs }));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      preferences,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAll,
      updatePreferences
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Notification Item Component
function NotificationItem({ notification, onMarkRead, onDelete }) {
  const Icon = notification.icon;
  const timeAgo = getTimeAgo(notification.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
        notification.read 
          ? 'bg-muted/30 border-border' 
          : 'bg-card border-primary/20 hover:bg-muted/50'
      }`}
      onClick={() => onMarkRead(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full ${notification.bgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${notification.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
              {notification.title}
            </p>
            {!notification.read && (
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          {notification.message && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {notification.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}>
              <Check className="w-4 h-4 mr-2" />
              Mark as read
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

// Main Notification Center Component
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const {
    notifications,
    preferences,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    updatePreferences
  } = useNotifications();

  // Filter notifications by category
  const filteredNotifications = activeCategory === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeCategory);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="notification-center-trigger"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md p-0" data-testid="notification-center-panel">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary">{unreadCount} new</Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  <Check className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="notifications" className="h-full">
          <TabsList className="w-full justify-start px-4 py-2 bg-muted/50 rounded-none border-b">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="m-0 h-[calc(100vh-180px)]">
            {/* Category Filter */}
            <div className="px-4 py-2 border-b overflow-x-auto">
              <div className="flex gap-1">
                {Object.entries(CATEGORIES).map(([key, { label, icon: Icon }]) => (
                  <Button
                    key={key}
                    variant={activeCategory === key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setActiveCategory(key)}
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Notifications List */}
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                <AnimatePresence>
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={markAsRead}
                        onDelete={deleteNotification}
                      />
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-muted-foreground">No notifications</p>
                      <p className="text-sm text-muted-foreground/70">
                        {activeCategory !== 'all' 
                          ? `No ${CATEGORIES[activeCategory].label.toLowerCase()} notifications`
                          : "You're all caught up!"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Clear All Button */}
            {notifications.length > 0 && (
              <div className="p-4 border-t">
                <Button variant="outline" className="w-full" onClick={clearAll}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Notifications
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="m-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="p-4 space-y-6">
                {/* Global Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Global Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Enable Notifications</p>
                        <p className="text-xs text-muted-foreground">Receive all notifications</p>
                      </div>
                      <Switch
                        checked={preferences.enabled}
                        onCheckedChange={(enabled) => updatePreferences({ enabled })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Sound</p>
                        <p className="text-xs text-muted-foreground">Play sound for new notifications</p>
                      </div>
                      <Switch
                        checked={preferences.sound}
                        onCheckedChange={(sound) => updatePreferences({ sound })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Desktop Notifications</p>
                        <p className="text-xs text-muted-foreground">Show browser notifications</p>
                      </div>
                      <Switch
                        checked={preferences.desktop}
                        onCheckedChange={(desktop) => updatePreferences({ desktop })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Category Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Notification Categories</CardTitle>
                    <CardDescription>Choose which notifications to receive</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(CATEGORIES).filter(([key]) => key !== 'all').map(([key, { label, icon: Icon }]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-medium">{label}</p>
                        </div>
                        <Switch
                          checked={preferences.categories[key]}
                          onCheckedChange={(checked) => updatePreferences({
                            categories: { ...preferences.categories, [key]: checked }
                          })}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Request Permission Button */}
                {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                  <Button
                    className="w-full"
                    onClick={() => Notification.requestPermission()}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Enable Desktop Notifications
                  </Button>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Helper function to get time ago string
function getTimeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now - date;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Export hook for triggering notifications from anywhere
export function useQualityAlerts() {
  const { addNotification } = useNotifications();

  return {
    // Quality alerts
    reportSpeeding: (data) => addNotification('speeding_detected', data),
    reportStraightlining: (data) => addNotification('straightlining_detected', data),
    reportGpsAnomaly: (data) => addNotification('gps_anomaly', data),
    reportDuplicate: (data) => addNotification('duplicate_detected', data),
    reportQualityIssue: (data) => addNotification('quality_issue', data),

    // Submission alerts
    notifyNewSubmission: (data) => addNotification('new_submission', data),
    notifySubmissionApproved: (data) => addNotification('submission_approved', data),
    notifySubmissionRejected: (data) => addNotification('submission_rejected', data),
    notifyRevisionRequired: (data) => addNotification('revision_required', data),

    // Backcheck alerts
    notifyBackcheckAssigned: (data) => addNotification('backcheck_assigned', data),
    notifyBackcheckCompleted: (data) => addNotification('backcheck_completed', data),
    notifyBackcheckDiscrepancy: (data) => addNotification('backcheck_discrepancy', data),

    // AI alerts
    notifyAiAnalysisComplete: (data) => addNotification('ai_analysis_complete', data),
    notifyAiSuggestion: (data) => addNotification('ai_suggestion', data),

    // Sync alerts
    notifySyncComplete: (data) => addNotification('sync_complete', data),
    notifySyncFailed: (data) => addNotification('sync_failed', data),
    notifySyncConflict: (data) => addNotification('sync_conflict', data),

    // Device alerts
    notifyDeviceRegistered: (data) => addNotification('device_registered', data),
    notifyDeviceOffline: (data) => addNotification('device_offline', data),
    notifyDeviceWiped: (data) => addNotification('device_wiped', data),

    // Team alerts
    notifyTeamMemberJoined: (data) => addNotification('team_member_joined', data),
    notifyRoleChanged: (data) => addNotification('role_changed', data),

    // System alerts
    notifySystemUpdate: (data) => addNotification('system_update', data),
    notifyMaintenanceScheduled: (data) => addNotification('maintenance_scheduled', data)
  };
}

export default NotificationCenter;
