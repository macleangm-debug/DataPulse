import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Clock,
  Activity,
  Globe,
  AlertTriangle,
  CheckCircle,
  Search,
  Download,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Progress } from '../components/ui/progress';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const SCOPES = [
  { id: 'read', name: 'Read', description: 'Read access to data' },
  { id: 'write', name: 'Write', description: 'Create and update data' },
  { id: 'delete', name: 'Delete', description: 'Delete data' },
  { id: 'admin', name: 'Admin', description: 'Administrative actions' },
];

const APIKeyRow = ({ apiKey, onEdit, onDelete, onReveal }) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-white">{apiKey.name}</p>
          <p className="text-xs text-gray-400 font-mono">{apiKey.key_prefix}...</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={apiKey.tier === 'enterprise' ? 'default' : apiKey.tier === 'pro' ? 'secondary' : 'outline'}>
          {apiKey.tier}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {apiKey.scopes?.map((scope) => (
            <Badge key={scope} variant="outline" className="text-xs">
              {scope}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        {apiKey.is_active ? (
          <Badge className="bg-green-500/20 text-green-500">Active</Badge>
        ) : (
          <Badge variant="destructive">Disabled</Badge>
        )}
      </TableCell>
      <TableCell className="text-gray-400 text-sm">
        {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString() : 'Never'}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(apiKey)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(apiKey)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const AuditLogRow = ({ log }) => (
  <TableRow>
    <TableCell className="text-gray-400 text-sm">
      {new Date(log.timestamp).toLocaleString()}
    </TableCell>
    <TableCell>
      <Badge variant={
        log.method === 'GET' ? 'outline' :
        log.method === 'POST' ? 'default' :
        log.method === 'PUT' ? 'secondary' :
        'destructive'
      }>
        {log.method}
      </Badge>
    </TableCell>
    <TableCell className="font-mono text-sm text-gray-300 max-w-xs truncate">
      {log.path}
    </TableCell>
    <TableCell>
      <Badge variant={log.response_status < 400 ? 'outline' : 'destructive'}>
        {log.response_status}
      </Badge>
    </TableCell>
    <TableCell className="text-gray-400 text-sm">{log.client_ip}</TableCell>
  </TableRow>
);

export function SecurityPage() {
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [rateLimitStatus, setRateLimitStatus] = useState(null);
  const [securitySettings, setSecuritySettings] = useState({});
  const [ipWhitelist, setIpWhitelist] = useState({ ips: [], enabled: false });

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [keyForm, setKeyForm] = useState({
    name: '',
    tier: 'free',
    scopes: ['read'],
    ip_whitelist: [],
    expires_days: null
  });

  const [logFilter, setLogFilter] = useState({ method: '', path: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      loadData();
    }
  }, [currentOrg?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [keysRes, logsRes, rateRes, settingsRes, whitelistRes] = await Promise.all([
        fetch(`${API_URL}/api/security/api-keys/${currentOrg.id}`, { headers }),
        fetch(`${API_URL}/api/security/audit-logs/${currentOrg.id}?limit=50`, { headers }),
        fetch(`${API_URL}/api/security/rate-limits/${currentOrg.id}/status`, { headers }),
        fetch(`${API_URL}/api/security/settings/${currentOrg.id}`, { headers }),
        fetch(`${API_URL}/api/security/ip-whitelist/${currentOrg.id}`, { headers })
      ]);

      setApiKeys((await keysRes.json()).keys || []);
      setAuditLogs((await logsRes.json()).logs || []);
      setRateLimitStatus(await rateRes.json());
      setSecuritySettings(await settingsRes.json());
      setIpWhitelist(await whitelistRes.json());
    } catch (error) {
      console.error('Failed to load security data:', error);
      toast.error('Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!keyForm.name.trim()) {
      toast.error('Key name is required');
      return;
    }

    setSaving(true);
    try {
      const params = new URLSearchParams({
        name: keyForm.name,
        tier: keyForm.tier,
      });
      if (keyForm.expires_days) {
        params.append('expires_days', keyForm.expires_days);
      }

      const response = await fetch(
        `${API_URL}/api/security/api-keys/${currentOrg.id}?${params}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            scopes: keyForm.scopes,
            ip_whitelist: keyForm.ip_whitelist
          })
        }
      );

      const result = await response.json();
      setNewKeyValue(result.key);
      setShowCreateKey(false);
      setShowNewKey(true);
      loadData();
      toast.success('API key created');
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (apiKey) => {
    if (!confirm(`Are you sure you want to revoke "${apiKey.name}"?`)) return;

    try {
      await fetch(`${API_URL}/api/security/api-keys/${currentOrg.id}/${apiKey.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      toast.success('API key revoked');
      loadData();
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  const handleEditKey = (apiKey) => {
    setEditingKey(apiKey);
    setKeyForm({
      name: apiKey.name,
      tier: apiKey.tier,
      scopes: apiKey.scopes || ['read'],
      ip_whitelist: apiKey.ip_whitelist || [],
      expires_days: null
    });
    setShowCreateKey(true);
  };

  const handleUpdateKey = async () => {
    setSaving(true);
    try {
      await fetch(
        `${API_URL}/api/security/api-keys/${currentOrg.id}/${editingKey.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: keyForm.name,
            scopes: keyForm.scopes,
            ip_whitelist: keyForm.ip_whitelist,
            is_active: true
          })
        }
      );
      toast.success('API key updated');
      setShowCreateKey(false);
      setEditingKey(null);
      loadData();
    } catch (error) {
      toast.error('Failed to update API key');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async (field, value) => {
    const newSettings = { ...securitySettings, [field]: value };
    setSecuritySettings(newSettings);

    try {
      await fetch(`${API_URL}/api/security/settings/${currentOrg.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ [field]: value })
      });
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleScope = (scope) => {
    setKeyForm(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope]
    }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="security-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">
              API Security
            </h1>
            <p className="text-gray-400">Manage API keys, rate limits, and security settings</p>
          </div>
        </div>

        {/* Rate Limit Status */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  rateLimitStatus?.tier === 'enterprise' ? 'bg-primary/10' :
                  rateLimitStatus?.tier === 'pro' ? 'bg-green-500/10' : 'bg-gray-500/10'
                }`}>
                  <Activity className={`w-6 h-6 ${
                    rateLimitStatus?.tier === 'enterprise' ? 'text-primary' :
                    rateLimitStatus?.tier === 'pro' ? 'text-green-500' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Current Rate Limit Tier</p>
                  <p className="text-xl font-bold text-white capitalize">{rateLimitStatus?.tier || 'Free'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Requests This Minute</p>
                <p className="text-2xl font-bold text-white">
                  {rateLimitStatus?.current_usage || 0}
                  <span className="text-sm font-normal text-gray-400">
                    / {rateLimitStatus?.limit_per_minute || 100}
                  </span>
                </p>
                {rateLimitStatus?.limit_per_minute && (
                  <Progress 
                    value={(rateLimitStatus.current_usage / rateLimitStatus.limit_per_minute) * 100} 
                    className="mt-2 h-1.5"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="keys">
          <TabsList>
            <TabsTrigger value="keys" className="gap-2">
              <Key className="w-4 h-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Clock className="w-4 h-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Shield className="w-4 h-4" />
              Security Settings
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">{apiKeys.length} API keys</p>
              <Button onClick={() => {
                setEditingKey(null);
                setKeyForm({ name: '', tier: 'free', scopes: ['read'], ip_whitelist: [], expires_days: null });
                setShowCreateKey(true);
              }} data-testid="create-api-key-btn">
                <Plus className="w-4 h-4 mr-2" />
                Create API Key
              </Button>
            </div>

            <Card className="bg-card/50 border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <APIKeyRow
                      key={key.id}
                      apiKey={key}
                      onEdit={handleEditKey}
                      onDelete={handleDeleteKey}
                    />
                  ))}
                  {apiKeys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                        No API keys yet. Create one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="mt-6 space-y-4">
            <div className="flex gap-4">
              <Select value={logFilter.method} onValueChange={(v) => setLogFilter({ ...logFilter, method: v })}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Filter by path..."
                  value={logFilter.path}
                  onChange={(e) => setLogFilter({ ...logFilter, path: e.target.value })}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <Card className="bg-card/50 border-border/50">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs
                      .filter(log => 
                        (!logFilter.method || logFilter.method === 'all' || log.method === logFilter.method) &&
                        (!logFilter.path || log.path?.includes(logFilter.path))
                      )
                      .map((log, idx) => (
                        <AuditLogRow key={idx} log={log} />
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="settings" className="mt-6 space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-white">Authentication Settings</CardTitle>
                <CardDescription>Configure authentication and session policies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Two-Factor Authentication Required</Label>
                    <p className="text-sm text-gray-400">Require 2FA for all users</p>
                  </div>
                  <Switch
                    checked={securitySettings.two_factor_required || false}
                    onCheckedChange={(v) => handleUpdateSettings('two_factor_required', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Session Timeout (minutes)</Label>
                    <p className="text-sm text-gray-400">Auto-logout after inactivity</p>
                  </div>
                  <Select
                    value={String(securitySettings.session_timeout_minutes || 60)}
                    onValueChange={(v) => handleUpdateSettings('session_timeout_minutes', parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Max Failed Login Attempts</Label>
                    <p className="text-sm text-gray-400">Lock account after failed attempts</p>
                  </div>
                  <Select
                    value={String(securitySettings.max_failed_logins || 5)}
                    onValueChange={(v) => handleUpdateSettings('max_failed_logins', parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 attempts</SelectItem>
                      <SelectItem value="5">5 attempts</SelectItem>
                      <SelectItem value="10">10 attempts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-white">Password Policy</CardTitle>
                <CardDescription>Set password requirements for users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Minimum Password Length</Label>
                  </div>
                  <Select
                    value={String(securitySettings.password_min_length || 8)}
                    onValueChange={(v) => handleUpdateSettings('password_min_length', parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8 characters</SelectItem>
                      <SelectItem value="10">10 characters</SelectItem>
                      <SelectItem value="12">12 characters</SelectItem>
                      <SelectItem value="16">16 characters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Special Characters</Label>
                    <p className="text-sm text-gray-400">e.g., !@#$%</p>
                  </div>
                  <Switch
                    checked={securitySettings.password_require_special || false}
                    onCheckedChange={(v) => handleUpdateSettings('password_require_special', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Numbers</Label>
                    <p className="text-sm text-gray-400">At least one digit</p>
                  </div>
                  <Switch
                    checked={securitySettings.password_require_numbers || false}
                    onCheckedChange={(v) => handleUpdateSettings('password_require_numbers', v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit API Key Dialog */}
        <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingKey ? 'Edit API Key' : 'Create API Key'}</DialogTitle>
              <DialogDescription>
                {editingKey ? 'Update API key settings' : 'Generate a new API key for programmatic access'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input
                  value={keyForm.name}
                  onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })}
                  placeholder="e.g., Production Server"
                  data-testid="api-key-name-input"
                />
              </div>

              {!editingKey && (
                <div className="space-y-2">
                  <Label>Rate Limit Tier</Label>
                  <Select value={keyForm.tier} onValueChange={(v) => setKeyForm({ ...keyForm, tier: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (100/min)</SelectItem>
                      <SelectItem value="pro">Pro (1000/min)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (10000/min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Permissions (Scopes)</Label>
                <div className="space-y-2">
                  {SCOPES.map((scope) => (
                    <label key={scope.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer">
                      <Checkbox
                        checked={keyForm.scopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">{scope.name}</p>
                        <p className="text-xs text-gray-400">{scope.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {!editingKey && (
                <div className="space-y-2">
                  <Label>Expiration (Optional)</Label>
                  <Select
                    value={keyForm.expires_days?.toString() || 'never'}
                    onValueChange={(v) => setKeyForm({ ...keyForm, expires_days: v === 'never' ? null : parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never expires</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateKey(false)}>Cancel</Button>
              <Button
                onClick={editingKey ? handleUpdateKey : handleCreateKey}
                disabled={saving}
                data-testid="save-api-key-btn"
              >
                {saving ? 'Saving...' : editingKey ? 'Update Key' : 'Create Key'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Key Created Dialog */}
        <Dialog open={showNewKey} onOpenChange={setShowNewKey}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                API Key Created
              </DialogTitle>
              <DialogDescription>
                Copy your API key now. You won&apos;t be able to see it again!
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="p-4 rounded-lg bg-card/50 border border-border">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-mono text-white break-all">{newKeyValue}</code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(newKeyValue)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-yellow-500">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm">Store this key securely. It cannot be retrieved later.</p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setShowNewKey(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default SecurityPage;
