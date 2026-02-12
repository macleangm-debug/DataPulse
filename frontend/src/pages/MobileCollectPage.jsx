/**
 * Mobile Collection Page (Option A)
 * Simple, mobile-optimized data collection for enumerators
 * Features: Simple login, assigned forms only, offline-first, quick sync
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  ChevronRight,
  Download,
  Cloud,
  CloudOff,
  CheckCircle2,
  Clock,
  FileText,
  User,
  Lock,
  Loader2,
  Database,
  AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Local storage keys
const STORAGE_KEYS = {
  TOKEN: 'collect_token',
  ENUMERATOR: 'collect_enumerator',
  FORMS: 'collect_forms',
  PENDING_SUBMISSIONS: 'collect_pending',
  DEVICE_ID: 'collect_device_id'
};

// Generate device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
};

// PWA Install Banner Component
const PWAInstallBanner = ({ onInstall, onDismiss }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('App installed! You can now collect data offline.');
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-2xl mb-6 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
          <Download className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg">Install DataPulse</h3>
          <p className="text-sm text-blue-100">Collect data offline, anytime</p>
        </div>
        <Button 
          onClick={handleInstall}
          className="bg-white text-blue-600 hover:bg-blue-50"
          size="lg"
        >
          Install
        </Button>
      </div>
    </div>
  );
};

// Login Component
const EnumeratorLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/collect/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          device_id: getDeviceId()
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await res.json();
      
      // Store credentials
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.access_token);
      localStorage.setItem(STORAGE_KEYS.ENUMERATOR, JSON.stringify(data.enumerator));
      localStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(data.assigned_forms));

      toast.success(`Welcome, ${data.enumerator.name}!`);
      onLogin(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-lg">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">DataPulse Collect</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to start collecting data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-14 text-lg bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-14 text-lg bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Smartphone className="w-5 h-5 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Form List Component
const FormList = ({ forms, onSelectForm, pendingCount }) => {
  return (
    <div className="space-y-3">
      {forms.map((form) => (
        <Card
          key={form.id}
          className="bg-slate-800/50 border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer active:scale-[0.98]"
          onClick={() => onSelectForm(form)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{form.name}</h3>
                <p className="text-sm text-slate-400">
                  {form.field_count} questions
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Sync Status Component
const SyncStatus = ({ pendingCount, isOnline, onSync, syncing }) => {
  return (
    <Card className={`border ${pendingCount > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-emerald-500/50 bg-emerald-500/10'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {pendingCount > 0 ? (
              <CloudOff className="w-6 h-6 text-amber-400" />
            ) : (
              <Cloud className="w-6 h-6 text-emerald-400" />
            )}
            <div>
              <p className="font-medium text-white">
                {pendingCount > 0 ? `${pendingCount} pending` : 'All synced'}
              </p>
              <p className="text-sm text-slate-400">
                {isOnline ? 'Connected' : 'Offline mode'}
              </p>
            </div>
          </div>
          {pendingCount > 0 && isOnline && (
            <Button
              onClick={onSync}
              disabled={syncing}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2">Sync</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Mobile Collect Page
export default function MobileCollectPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [enumerator, setEnumerator] = useState(null);
  const [forms, setForms] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check online status
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

  // Load saved session
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedEnumerator = localStorage.getItem(STORAGE_KEYS.ENUMERATOR);
    const savedForms = localStorage.getItem(STORAGE_KEYS.FORMS);
    const savedPending = localStorage.getItem(STORAGE_KEYS.PENDING_SUBMISSIONS);

    if (token && savedEnumerator) {
      setIsAuthenticated(true);
      setEnumerator(JSON.parse(savedEnumerator));
      setForms(savedForms ? JSON.parse(savedForms) : []);
      setPendingSubmissions(savedPending ? JSON.parse(savedPending) : []);
    }
    setLoading(false);
  }, []);

  // Handle login
  const handleLogin = (data) => {
    setIsAuthenticated(true);
    setEnumerator(data.enumerator);
    setForms(data.assigned_forms);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ENUMERATOR);
    localStorage.removeItem(STORAGE_KEYS.FORMS);
    setIsAuthenticated(false);
    setEnumerator(null);
    setForms([]);
    toast.success('Logged out');
  };

  // Handle form selection
  const handleSelectForm = (form) => {
    // Navigate to form collection page
    navigate(`/collect/form/${form.id}`);
  };

  // Handle sync
  const handleSync = async () => {
    if (pendingSubmissions.length === 0) {
      toast.info('Nothing to sync');
      return;
    }

    setSyncing(true);
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    try {
      const res = await fetch(`${API_URL}/api/collect/sync?authorization=Bearer ${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissions: pendingSubmissions,
          device_id: getDeviceId()
        })
      });

      const data = await res.json();

      if (data.synced > 0) {
        // Remove synced submissions from pending
        const syncedIds = data.synced_items.map(s => s.offline_id);
        const remaining = pendingSubmissions.filter(s => !syncedIds.includes(s.offline_id));
        setPendingSubmissions(remaining);
        localStorage.setItem(STORAGE_KEYS.PENDING_SUBMISSIONS, JSON.stringify(remaining));
        
        toast.success(`Synced ${data.synced} submissions`);
      }

      if (data.failed > 0) {
        toast.error(`${data.failed} submissions failed to sync`);
      }
    } catch (err) {
      toast.error('Sync failed. Will retry when online.');
    } finally {
      setSyncing(false);
    }
  };

  // Refresh forms
  const refreshForms = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!token || !isOnline) return;

    try {
      const res = await fetch(`${API_URL}/api/collect/forms?authorization=Bearer ${token}`);
      const data = await res.json();
      setForms(data.forms || []);
      localStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(data.forms || []));
      toast.success('Forms updated');
    } catch (err) {
      toast.error('Failed to refresh forms');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <EnumeratorLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-white">DataPulse</h1>
                <p className="text-xs text-slate-400">{enumerator?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                  <Wifi className="w-3 h-3 mr-1" />
                  Online
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Offline
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6">
        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Sync Status */}
        <SyncStatus
          pendingCount={pendingSubmissions.length}
          isOnline={isOnline}
          onSync={handleSync}
          syncing={syncing}
        />

        {/* Forms Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Forms</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshForms}
              disabled={!isOnline}
              className="text-slate-400"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>

          {forms.length > 0 ? (
            <FormList
              forms={forms}
              onSelectForm={handleSelectForm}
              pendingCount={pendingSubmissions.length}
            />
          ) : (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No forms assigned yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Contact your supervisor to get forms assigned
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{forms.length}</p>
              <p className="text-sm text-slate-400">Forms Available</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-emerald-400">{pendingSubmissions.length}</p>
              <p className="text-sm text-slate-400">Pending Sync</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
