/**
 * Token-Based Collection Page (Option B)
 * No login required - token provides access
 * Features: Pre-loaded forms, simple UI, offline-first
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronRight,
  Download,
  Cloud,
  CloudOff,
  CheckCircle2,
  Clock,
  FileText,
  User,
  Loader2,
  Database,
  AlertCircle,
  XCircle,
  ChevronLeft,
  Send
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Local storage keys for token-based collection
const TOKEN_STORAGE = {
  PREFIX: 'token_collect_',
  getPendingKey: (token) => `token_collect_pending_${token}`,
  getFormsKey: (token) => `token_collect_forms_${token}`,
  getInfoKey: (token) => `token_collect_info_${token}`
};

// Generate device ID
const getDeviceId = () => {
  let deviceId = localStorage.getItem('collect_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('collect_device_id', deviceId);
  }
  return deviceId;
};

// PWA Install Banner
const PWAInstallBanner = () => {
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
      toast.success('App installed!');
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-2xl mb-6 shadow-lg">
      <div className="flex items-center gap-3">
        <Download className="w-8 h-8" />
        <div className="flex-1">
          <h3 className="font-semibold">Install App</h3>
          <p className="text-sm text-emerald-100">Work offline anytime</p>
        </div>
        <Button onClick={handleInstall} className="bg-white text-emerald-600 hover:bg-emerald-50">
          Install
        </Button>
      </div>
    </div>
  );
};

// Invalid Token Page
const InvalidTokenPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
    <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
      <CardContent className="p-8 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Invalid or Expired Link</h2>
        <p className="text-slate-400 mb-6">
          This collection link is no longer valid. Please contact your supervisor for a new link.
        </p>
        <Button variant="outline" className="border-slate-600 text-slate-300">
          Contact Supervisor
        </Button>
      </CardContent>
    </Card>
  </div>
);

// Loading State
const LoadingState = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
      <p className="text-slate-400">Loading your forms...</p>
    </div>
  </div>
);

// Form Card
const FormCard = ({ form, onSelect, pendingCount }) => {
  const formPending = pendingCount || 0;
  
  return (
    <Card
      className="bg-slate-800/50 border-slate-700 hover:border-emerald-500/50 transition-all cursor-pointer active:scale-[0.98]"
      onClick={() => onSelect(form)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-lg truncate">{form.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-400">{form.field_count} questions</span>
              {formPending > 0 && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {formPending} pending
                </Badge>
              )}
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-slate-500" />
        </div>
      </CardContent>
    </Card>
  );
};

// Main Token Collection Page
export default function TokenCollectPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [forms, setForms] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);

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

  // Load token info and forms
  useEffect(() => {
    loadTokenInfo();
  }, [token]);

  const loadTokenInfo = async () => {
    setLoading(true);
    setError(null);

    // Try to load from cache first
    const cachedInfo = localStorage.getItem(TOKEN_STORAGE.getInfoKey(token));
    const cachedForms = localStorage.getItem(TOKEN_STORAGE.getFormsKey(token));
    const cachedPending = localStorage.getItem(TOKEN_STORAGE.getPendingKey(token));

    if (cachedInfo && cachedForms) {
      setTokenInfo(JSON.parse(cachedInfo));
      setForms(JSON.parse(cachedForms));
      setPendingSubmissions(cachedPending ? JSON.parse(cachedPending) : []);
    }

    // Fetch fresh data if online
    if (navigator.onLine) {
      try {
        const res = await fetch(`${API_URL}/api/collect/token/${token}`);
        
        if (!res.ok) {
          if (res.status === 404) {
            setError('invalid');
            setLoading(false);
            return;
          }
          throw new Error('Failed to load');
        }

        const data = await res.json();
        
        setTokenInfo({
          enumerator_name: data.enumerator_name,
          enumerator_id: data.enumerator_id,
          org_id: data.org_id,
          expires_at: data.expires_at
        });
        setForms(data.assigned_forms);

        // Cache for offline use
        localStorage.setItem(TOKEN_STORAGE.getInfoKey(token), JSON.stringify({
          enumerator_name: data.enumerator_name,
          enumerator_id: data.enumerator_id,
          org_id: data.org_id,
          expires_at: data.expires_at
        }));
        localStorage.setItem(TOKEN_STORAGE.getFormsKey(token), JSON.stringify(data.assigned_forms));

      } catch (err) {
        if (!cachedInfo) {
          setError('failed');
        }
      }
    } else if (!cachedInfo) {
      setError('offline');
    }

    setLoading(false);
  };

  // Handle form selection
  const handleSelectForm = (form) => {
    setSelectedForm(form);
    // In a full implementation, this would navigate to a form filling page
    navigate(`/collect/${token}/form/${form.id}`);
  };

  // Handle sync
  const handleSync = async () => {
    if (pendingSubmissions.length === 0) {
      toast.info('Nothing to sync');
      return;
    }

    setSyncing(true);

    try {
      const res = await fetch(`${API_URL}/api/collect/token/${token}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissions: pendingSubmissions,
          device_id: getDeviceId()
        })
      });

      const data = await res.json();

      if (data.synced > 0) {
        const syncedIds = data.synced_items.map(s => s.offline_id);
        const remaining = pendingSubmissions.filter(s => !syncedIds.includes(s.offline_id));
        setPendingSubmissions(remaining);
        localStorage.setItem(TOKEN_STORAGE.getPendingKey(token), JSON.stringify(remaining));
        toast.success(`Synced ${data.synced} submissions`);
      }

      if (data.failed > 0) {
        toast.error(`${data.failed} failed to sync`);
      }
    } catch (err) {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Render states
  if (loading) return <LoadingState />;
  if (error === 'invalid') return <InvalidTokenPage />;
  if (error === 'offline') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <WifiOff className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">You're Offline</h2>
            <p className="text-slate-400">
              Connect to the internet to load your forms for the first time.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-white">DataPulse</h1>
                <p className="text-xs text-slate-400">
                  <User className="w-3 h-3 inline mr-1" />
                  {tokenInfo?.enumerator_name || 'Field Worker'}
                </p>
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-6">
        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Welcome Card */}
        <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/30 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Welcome, {tokenInfo?.enumerator_name || 'Field Worker'}!
                </h2>
                <p className="text-sm text-emerald-300/70">
                  {forms.length} form{forms.length !== 1 ? 's' : ''} ready for collection
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        {pendingSubmissions.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CloudOff className="w-6 h-6 text-amber-400" />
                  <div>
                    <p className="font-medium text-white">
                      {pendingSubmissions.length} submission{pendingSubmissions.length !== 1 ? 's' : ''} pending
                    </p>
                    <p className="text-sm text-slate-400">
                      {isOnline ? 'Ready to sync' : 'Will sync when online'}
                    </p>
                  </div>
                </div>
                {isOnline && (
                  <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    {syncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    <span className="ml-2">Sync Now</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Forms List */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Your Forms
          </h3>
          
          <div className="space-y-3">
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onSelect={handleSelectForm}
                pendingCount={pendingSubmissions.filter(s => s.form_id === form.id).length}
              />
            ))}
          </div>

          {forms.length === 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No forms assigned to this link</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Token Expiry Notice */}
        {tokenInfo?.expires_at && (
          <div className="text-center text-sm text-slate-500">
            <Clock className="w-4 h-4 inline mr-1" />
            Link expires: {new Date(tokenInfo.expires_at).toLocaleDateString()}
          </div>
        )}
      </main>
    </div>
  );
}
