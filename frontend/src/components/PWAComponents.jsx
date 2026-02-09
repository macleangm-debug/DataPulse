import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, X, Smartphone, Wifi, WifiOff, Cloud, CloudOff, RefreshCw,
  Bell, BellOff, CheckCircle, AlertTriangle, Database, HardDrive,
  Share2, Shield, Zap, Settings, ChevronRight, Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { offlineStorage, syncManager } from '../lib/offlineStorage';

// PWA Install Prompt Component
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show install prompt after a delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
  };

  // Check if dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_prompt_dismissed');
    if (dismissed) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (isInstalled || !showPrompt || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl p-4">
          <button 
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Install DataPulse</h3>
              <p className="text-sm text-gray-400 mb-3">
                Install the app for offline data collection and faster access.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  <Download className="w-4 h-4 mr-1" />
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Not now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Network Status Indicator Component
export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      setShowBanner(!online);
    };

    const updatePendingCount = async () => {
      try {
        const count = await offlineStorage.getPendingCount();
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to get pending count:', error);
      }
    };

    // Initial check
    updateOnlineStatus();
    updatePendingCount();

    // Listen for network changes
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for sync events
    const unsubscribe = syncManager.addListener((event) => {
      if (event.type === 'sync_start') {
        setIsSyncing(true);
      } else if (event.type === 'sync_complete' || event.type === 'sync_error') {
        setIsSyncing(false);
        updatePendingCount();
      } else if (event.type === 'online') {
        setShowBanner(false);
      } else if (event.type === 'offline') {
        setShowBanner(true);
      }
    });

    // Periodic check for pending submissions
    const interval = setInterval(updatePendingCount, 30000);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleSync = () => {
    if (isOnline && pendingCount > 0) {
      syncManager.syncPendingSubmissions();
    }
  };

  return (
    <>
      {/* Offline Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-950 px-4 py-2"
          >
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <WifiOff className="w-4 h-4" />
              <span>You're offline. Changes will be saved locally and synced when back online.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Indicator (for sidebar/header) */}
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <Wifi className="w-3 h-3 mr-1" />
            Online
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
            <WifiOff className="w-3 h-3 mr-1" />
            Offline
          </Badge>
        )}

        {pendingCount > 0 && (
          <Badge 
            variant="outline" 
            className="bg-primary/10 text-primary border-primary/30 cursor-pointer"
            onClick={handleSync}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <CloudOff className="w-3 h-3 mr-1" />
            )}
            {pendingCount} pending
          </Badge>
        )}
      </div>
    </>
  );
}

// Offline Indicator for forms
export function OfflineIndicator({ className = '' }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className={`flex items-center gap-2 text-yellow-500 text-sm ${className}`}>
      <CloudOff className="w-4 h-4" />
      <span>Working offline - data will sync when connected</span>
    </div>
  );
}


/**
 * Push Notifications Manager Component
 * Handles push notification subscription and preferences
 */
export function PushNotificationsManager() {
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    syncComplete: true,
    newSubmissions: true,
    qualityAlerts: true,
    systemUpdates: false
  });

  useEffect(() => {
    checkSubscription();
    loadPreferences();
  }, []);

  const checkSubscription = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    }
  };

  const loadPreferences = () => {
    const saved = localStorage.getItem('push_notification_preferences');
    if (saved) {
      setPreferences(JSON.parse(saved));
    }
  };

  const savePreferences = (newPrefs) => {
    setPreferences(newPrefs);
    localStorage.setItem('push_notification_preferences', JSON.stringify(newPrefs));
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await subscribeToPush();
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPush = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
          )
        });

        console.log('Push subscription:', subscription);
        setIsSubscribed(true);
        showTestNotification();
      } catch (error) {
        console.error('Failed to subscribe to push:', error);
      }
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
    } finally {
      setLoading(false);
    }
  };

  const showTestNotification = () => {
    if (permission === 'granted') {
      new Notification('DataPulse Notifications Enabled', {
        body: 'You will receive updates about sync status and quality alerts.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'test-notification'
      });
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  return (
    <Card data-testid="push-notifications-manager">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about sync status, quality alerts, and more
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {permission === 'granted' ? (
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-green-500" />
              </div>
            ) : permission === 'denied' ? (
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <BellOff className="w-5 h-5 text-red-500" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-yellow-500" />
              </div>
            )}
            <div>
              <p className="font-medium">
                {permission === 'granted' ? 'Notifications Enabled' : 
                 permission === 'denied' ? 'Notifications Blocked' : 
                 'Notifications Not Set Up'}
              </p>
              <p className="text-sm text-muted-foreground">
                {permission === 'granted' ? 'You will receive push notifications' : 
                 permission === 'denied' ? 'Please enable in browser settings' : 
                 'Click to enable notifications'}
              </p>
            </div>
          </div>
          
          {permission !== 'denied' && (
            <Button 
              onClick={isSubscribed ? unsubscribe : requestPermission}
              disabled={loading}
              variant={isSubscribed ? 'outline' : 'default'}
            >
              {loading ? 'Processing...' : isSubscribed ? 'Disable' : 'Enable'}
            </Button>
          )}
        </div>

        {permission === 'granted' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Notification Types</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Sync Complete</p>
                  <p className="text-xs text-muted-foreground">When offline data syncs successfully</p>
                </div>
                <Switch 
                  checked={preferences.syncComplete}
                  onCheckedChange={(checked) => savePreferences({...preferences, syncComplete: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">New Submissions</p>
                  <p className="text-xs text-muted-foreground">When team members submit data</p>
                </div>
                <Switch 
                  checked={preferences.newSubmissions}
                  onCheckedChange={(checked) => savePreferences({...preferences, newSubmissions: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Quality Alerts</p>
                  <p className="text-xs text-muted-foreground">AI-detected quality issues</p>
                </div>
                <Switch 
                  checked={preferences.qualityAlerts}
                  onCheckedChange={(checked) => savePreferences({...preferences, qualityAlerts: checked})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">System Updates</p>
                  <p className="text-xs text-muted-foreground">App updates and maintenance</p>
                </div>
                <Switch 
                  checked={preferences.systemUpdates}
                  onCheckedChange={(checked) => savePreferences({...preferences, systemUpdates: checked})}
                />
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={showTestNotification}>
              <Bell className="w-4 h-4 mr-2" />
              Send Test Notification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Enhanced Offline Mode Page
 */
export function OfflineModePage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [storageInfo, setStorageInfo] = useState(null);
  const [cachedForms, setCachedForms] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    const updateStatus = async () => {
      setIsOnline(navigator.onLine);
      
      try {
        const count = await offlineStorage.getPendingCount();
        setPendingCount(count);
        
        const forms = await offlineStorage.getCachedForms();
        setCachedForms(forms?.length || 0);
        
        const lastSync = localStorage.getItem('last_sync_time');
        if (lastSync) setLastSyncTime(new Date(parseInt(lastSync)));
        
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          setStorageInfo({
            usage: estimate.usage,
            quota: estimate.quota,
            percent: ((estimate.usage / estimate.quota) * 100).toFixed(1)
          });
        }
      } catch (error) {
        console.error('Error updating offline status:', error);
      }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    const interval = setInterval(updateStatus, 10000);
    
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearInterval(interval);
    };
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isOnline) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" data-testid="offline-mode-page">
      <div className="max-w-md w-full space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-yellow-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">You're Offline</h1>
          <p className="text-gray-400 mb-6">
            Don't worry! DataPulse works offline. Your data is safe and will sync automatically when you reconnect.
          </p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-yellow-500 text-sm font-medium">Offline Mode Active</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Cloud className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
              <p className="text-xs text-gray-400">Pending Sync</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <Database className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{cachedForms}</p>
              <p className="text-xs text-gray-400">Cached Forms</p>
            </CardContent>
          </Card>
        </motion.div>

        {storageInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    Local Storage
                  </span>
                  <span className="text-white">{formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}</span>
                </div>
                <Progress value={parseFloat(storageInfo.percent)} className="h-2" />
                <p className="text-xs text-gray-500 text-center">{storageInfo.percent}% used</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {lastSyncTime && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center text-sm text-gray-500">
            Last synced: {lastSyncTime.toLocaleString()}
          </motion.p>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
          <Button className="w-full" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <Button variant="outline" className="w-full border-slate-600 text-gray-300 hover:bg-slate-700" onClick={() => window.history.back()}>
            Continue Working Offline
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="space-y-2 pt-4 border-t border-slate-700">
          <p className="text-xs text-gray-500 text-center mb-3">Available offline:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-gray-300">
              <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
              Data Collection
            </Badge>
            <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-gray-300">
              <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
              GPS Capture
            </Badge>
            <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-gray-300">
              <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
              Photo/Audio
            </Badge>
            <Badge variant="outline" className="bg-slate-800/50 border-slate-600 text-gray-300">
              <Shield className="w-3 h-3 mr-1 text-blue-500" />
              Encrypted
            </Badge>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * PWA Settings Panel
 */
export function PWASettingsPanel() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [swStatus, setSwStatus] = useState('checking');

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setSwStatus('active')).catch(() => setSwStatus('error'));
    } else {
      setSwStatus('unsupported');
    }

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        setStorageInfo({
          usage: estimate.usage,
          quota: estimate.quota,
          percent: ((estimate.usage / estimate.quota) * 100).toFixed(1)
        });
      });
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const handleClearCache = async () => {
    if (confirm('Clear all cached data? Pending submissions will be preserved.')) {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        window.location.reload();
      }
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6" data-testid="pwa-settings-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            App Installation
          </CardTitle>
          <CardDescription>Install DataPulse for offline access and faster performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-medium text-green-500">App Installed</p>
                <p className="text-sm text-muted-foreground">DataPulse is installed and ready for offline use</p>
              </div>
            </div>
          ) : deferredPrompt ? (
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10">
              <div className="flex items-center gap-3">
                <Download className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium">Install Available</p>
                  <p className="text-sm text-muted-foreground">Add DataPulse to your home screen</p>
                </div>
              </div>
              <Button onClick={handleInstall}>
                <Download className="w-4 h-4 mr-2" />
                Install
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Info className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="font-medium">PWA Ready</p>
                <p className="text-sm text-muted-foreground">Use your browser menu to add to home screen</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 text-yellow-500" />
              Instant load
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <WifiOff className="w-4 h-4 text-blue-500" />
              Works offline
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-green-500" />
              Secure & encrypted
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 text-purple-500" />
              Auto sync
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Service Worker
          </CardTitle>
          <CardDescription>Background service for offline functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {swStatus === 'active' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : swStatus === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              ) : (
                <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
              )}
              <div>
                <p className="font-medium capitalize">{swStatus}</p>
                <p className="text-sm text-muted-foreground">
                  {swStatus === 'active' ? 'Offline support enabled' : swStatus === 'error' ? 'Service worker failed' : 'Checking status...'}
                </p>
              </div>
            </div>
            {swStatus === 'active' && (
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Update
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Management
          </CardTitle>
          <CardDescription>Manage offline data storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storageInfo && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used</span>
                <span>{formatBytes(storageInfo.usage)} of {formatBytes(storageInfo.quota)}</span>
              </div>
              <Progress value={parseFloat(storageInfo.percent)} />
              <p className="text-xs text-muted-foreground text-center">{storageInfo.percent}% of available storage</p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleClearCache}>Clear Cache</Button>
            <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>Refresh App</Button>
          </div>
        </CardContent>
      </Card>

      <PushNotificationsManager />
    </div>
  );
}

/**
 * Sync Status Toast Component
 */
export function SyncStatusToast() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', count: 0, total: 0 });

  useEffect(() => {
    const unsubscribe = syncManager.addListener((event) => {
      if (event.type === 'sync_start') {
        setStatus({ type: 'syncing', count: 0, total: event.total || 0 });
        setShow(true);
      } else if (event.type === 'sync_progress') {
        setStatus(prev => ({ ...prev, count: event.current }));
      } else if (event.type === 'sync_complete') {
        setStatus({ type: 'success', count: event.synced || 0, total: event.synced || 0 });
        setTimeout(() => setShow(false), 3000);
        localStorage.setItem('last_sync_time', Date.now().toString());
        
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const prefs = JSON.parse(localStorage.getItem('push_notification_preferences') || '{}');
          if (prefs.syncComplete) {
            new Notification('Sync Complete', {
              body: `${event.synced || 0} submissions synced successfully`,
              icon: '/icons/icon-192x192.png'
            });
          }
        }
      } else if (event.type === 'sync_error') {
        setStatus({ type: 'error', count: 0, total: 0 });
        setTimeout(() => setShow(false), 5000);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: 50, x: '-50%' }}
        className="fixed bottom-4 left-1/2 z-50"
        data-testid="sync-status-toast"
      >
        <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
          status.type === 'syncing' ? 'bg-blue-500' : status.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {status.type === 'syncing' ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Syncing {status.count}/{status.total} submissions...</span>
            </>
          ) : status.type === 'success' ? (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>{status.count} submissions synced</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5" />
              <span>Sync failed - will retry</span>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
