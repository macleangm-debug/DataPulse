import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, BarChart3, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DataPulseLogo = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeDasharray="47 16" strokeDashoffset="12" />
    <path d="M12 2v10l7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PublicWidget = ({ widget }) => {
  const renderContent = () => {
    switch (widget.type) {
      case 'stat': return (<div className="text-center"><p className="text-4xl font-bold text-white">{widget.data?.value || '—'}</p><p className="text-sm text-gray-400 mt-1">{widget.data?.label || widget.title}</p></div>);
      case 'chart': return (<div className="h-40 flex items-center justify-center"><BarChart3 className="w-16 h-16 text-gray-600" /><p className="text-gray-500 ml-3">Chart visualization</p></div>);
      default: return (<div className="text-center text-gray-500"><p>{widget.type} widget</p></div>);
    }
  };
  return (<Card className="bg-card/50 border-border/50"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-300">{widget.title}</CardTitle></CardHeader><CardContent>{renderContent()}</CardContent></Card>);
};

export function PublicDashboardPage() {
  const { publicId } = useParams();
  const [dashboardInfo, setDashboardInfo] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchDashboardInfo(); }, [publicId]);

  const fetchDashboardInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/dashboards/public/${publicId}`);
      if (response.ok) {
        const info = await response.json();
        setDashboardInfo(info);
        if (info.expired) setError('This share link has expired');
        else if (info.password_protected) setPasswordRequired(true);
        else await fetchDashboard();
      } else {
        setError('Dashboard not found or no longer public');
      }
    } catch (err) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async (pwd = null) => {
    setAuthenticating(true);
    try {
      const response = await fetch(`${API_URL}/api/dashboards/public/${publicId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      if (response.ok) { setDashboardData(await response.json()); setPasswordRequired(false); setError(null); }
      else if (response.status === 401) toast.error('Invalid password');
      else if (response.status === 410) setError('This share link has expired');
      else setError('Failed to access dashboard');
    } catch (err) {
      toast.error('Failed to access dashboard');
    } finally {
      setAuthenticating(false);
    }
  };

  if (loading) return (<div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><Skeleton className="w-12 h-12 rounded-full mx-auto mb-4" /><Skeleton className="w-48 h-6 mx-auto mb-2" /><Skeleton className="w-32 h-4 mx-auto" /></div></div>);

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card/50 border-border/50">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-8 h-8 text-red-500" /></div>
          <h1 className="text-xl font-bold text-white mb-2">Dashboard Unavailable</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button variant="outline" onClick={() => window.location.href = '/'}>Go to Homepage</Button>
        </CardContent>
      </Card>
    </div>
  );

  if (passwordRequired) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-primary" /></div>
              <h1 className="text-xl font-bold text-white mb-1">{dashboardInfo?.name || 'Protected Dashboard'}</h1>
              <p className="text-gray-400 text-sm">This dashboard is password protected</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (password.trim()) fetchDashboard(password); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="pr-10" data-testid="public-dashboard-password" />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={authenticating || !password.trim()} data-testid="public-dashboard-submit">{authenticating ? 'Verifying...' : 'View Dashboard'}</Button>
            </form>
            {dashboardInfo?.expires_at && <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500"><Clock className="w-3 h-3" />Expires: {new Date(dashboardInfo.expires_at).toLocaleDateString()}</div>}
          </CardContent>
        </Card>
        <div className="mt-6 flex items-center justify-center gap-2 text-gray-500 text-sm"><DataPulseLogo className="w-4 h-4" /><span>Powered by DataPulse</span></div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DataPulseLogo className="w-6 h-6 text-primary" />
            <div><h1 className="font-bold text-white">{dashboardData?.name || 'Dashboard'}</h1>{dashboardData?.description && <p className="text-xs text-gray-400">{dashboardData.description}</p>}</div>
          </div>
          <Badge variant="outline" className="text-xs"><ExternalLink className="w-3 h-3 mr-1" />Shared View</Badge>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {dashboardData?.widgets?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{dashboardData.widgets.map((widget, index) => <PublicWidget key={widget.id || index} widget={widget} />)}</div>
        ) : (
          <div className="text-center py-20"><BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" /><p className="text-gray-400">This dashboard has no widgets yet</p></div>
        )}
      </main>
      <footer className="border-t border-border/50 py-6 mt-auto"><div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 text-gray-500 text-sm"><DataPulseLogo className="w-4 h-4" /><span>Powered by DataPulse</span></div></footer>
    </div>
  );
}

export default PublicDashboardPage;
