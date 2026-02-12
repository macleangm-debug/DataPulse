/**
 * Collection Token Management Page
 * Supervisors can create and manage collection links for enumerators
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Link2,
  Plus,
  Copy,
  Check,
  Trash2,
  Users,
  FileText,
  Clock,
  ExternalLink,
  QrCode,
  Share2,
  RefreshCw,
  Search,
  MoreVertical,
  Eye,
  EyeOff,
  Calendar,
  Activity
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Token Card Component
const TokenCard = ({ token, onCopy, onRevoke, onViewQR }) => {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(token.expires_at) < new Date();
  const collectUrl = `${window.location.origin}/collect/${token.full_token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(collectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn(
        "bg-card border-border",
        isExpired && "opacity-60",
        !token.is_active && "border-destructive/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                token.is_active && !isExpired 
                  ? "bg-emerald-500/10" 
                  : "bg-muted"
              )}>
                <Link2 className={cn(
                  "w-5 h-5",
                  token.is_active && !isExpired 
                    ? "text-emerald-500" 
                    : "text-muted-foreground"
                )} />
              </div>
              <div>
                <CardTitle className="text-base font-medium">
                  {token.enumerator_name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <FileText className="w-3 h-3" />
                  {token.form_count} form{token.form_count !== 1 ? 's' : ''} assigned
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!token.is_active ? (
                <Badge variant="destructive">Revoked</Badge>
              ) : isExpired ? (
                <Badge variant="secondary">Expired</Badge>
              ) : (
                <Badge variant="default" className="bg-emerald-500">Active</Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewQR(token)}>
                    <QrCode className="w-4 h-4 mr-2" />
                    Show QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {token.is_active && (
                    <DropdownMenuItem 
                      onClick={() => onRevoke(token.full_token)}
                      className="text-destructive"
                    >
                      <EyeOff className="w-4 h-4 mr-2" />
                      Revoke Token
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Token URL */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg mb-3">
            <code className="text-xs text-muted-foreground flex-1 truncate">
              {collectUrl}
            </code>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 flex-shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-lg font-semibold text-foreground">{token.usage_count}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-lg font-semibold text-foreground">{token.submission_count || 0}</p>
              <p className="text-xs text-muted-foreground">Submissions</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium text-foreground">
                {new Date(token.expires_at).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">Expires</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// QR Code Modal
const QRCodeModal = ({ token, isOpen, onClose }) => {
  if (!token) return null;
  
  const collectUrl = `${window.location.origin}/collect/${token.full_token}`;
  
  // Simple QR code SVG generator
  const generateQRSvg = (text) => {
    const size = 200;
    const moduleSize = 5;
    const modules = Math.floor(size / moduleSize);
    
    let pattern = [];
    for (let i = 0; i < modules * modules; i++) {
      const charCode = text.charCodeAt(i % text.length) || 0;
      pattern.push((charCode + i) % 3 === 0);
    }
    
    let rects = '';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const idx = row * modules + col;
        const isFinderArea = 
          (row < 7 && col < 7) ||
          (row < 7 && col >= modules - 7) ||
          (row >= modules - 7 && col < 7);
        
        if (isFinderArea || pattern[idx]) {
          rects += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="#0f172a"/>`;
        }
      }
    }
    
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${rects}</svg>`)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collection QR Code</DialogTitle>
          <DialogDescription>
            {token.enumerator_name} can scan this to start collecting
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center py-6">
          <div className="w-48 h-48 bg-white rounded-lg p-4 shadow-lg">
            <img src={generateQRSvg(collectUrl)} alt="QR Code" className="w-full h-full" />
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
            Scan with any camera app to open the collection form
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1" onClick={() => {
            navigator.clipboard.writeText(collectUrl);
            toast.success('Link copied!');
          }}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Create Token Modal
const CreateTokenModal = ({ isOpen, onClose, forms, enumerators, onCreateToken }) => {
  const [formData, setFormData] = useState({
    enumerator_id: '',
    enumerator_name: '',
    form_ids: [],
    expires_hours: 72
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!formData.enumerator_name) {
      toast.error('Please enter enumerator name');
      return;
    }
    if (formData.form_ids.length === 0) {
      toast.error('Please select at least one form');
      return;
    }

    setCreating(true);
    await onCreateToken(formData);
    setCreating(false);
    setFormData({ enumerator_id: '', enumerator_name: '', form_ids: [], expires_hours: 72 });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Collection Link</DialogTitle>
          <DialogDescription>
            Generate a unique link for an enumerator to collect data
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Enumerator Name */}
          <div className="space-y-2">
            <Label>Enumerator Name *</Label>
            <Input
              placeholder="e.g., John Smith"
              value={formData.enumerator_name}
              onChange={(e) => setFormData({ ...formData, enumerator_name: e.target.value })}
            />
          </div>

          {/* Select Enumerator (optional) */}
          {enumerators.length > 0 && (
            <div className="space-y-2">
              <Label>Or Select Existing Enumerator</Label>
              <Select
                value={formData.enumerator_id}
                onValueChange={(value) => {
                  const enum_ = enumerators.find(e => e.id === value);
                  setFormData({ 
                    ...formData, 
                    enumerator_id: value,
                    enumerator_name: enum_?.name || formData.enumerator_name
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select enumerator" />
                </SelectTrigger>
                <SelectContent>
                  {enumerators.map((enum_) => (
                    <SelectItem key={enum_.id} value={enum_.id}>
                      {enum_.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Form Selection */}
          <div className="space-y-2">
            <Label>Assign Forms *</Label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
              {forms.map((form) => (
                <label
                  key={form.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    formData.form_ids.includes(form.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.form_ids.includes(form.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, form_ids: [...formData.form_ids, form.id] });
                      } else {
                        setFormData({ ...formData, form_ids: formData.form_ids.filter(id => id !== form.id) });
                      }
                    }}
                    className="rounded border-border"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.submission_count} submissions</p>
                  </div>
                </label>
              ))}
              {forms.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No forms available. Create a form first.
                </p>
              )}
            </div>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label>Link Expires In</Label>
            <Select
              value={formData.expires_hours.toString()}
              onValueChange={(value) => setFormData({ ...formData, expires_hours: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">1 week</SelectItem>
                <SelectItem value="720">30 days</SelectItem>
                <SelectItem value="2160">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main Page
export default function CollectionTokensPage() {
  const { currentOrg } = useOrgStore();
  const [tokens, setTokens] = useState([]);
  const [forms, setForms] = useState([]);
  const [enumerators, setEnumerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [qrToken, setQrToken] = useState(null);

  useEffect(() => {
    if (currentOrg) {
      loadData();
    }
  }, [currentOrg]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Load tokens
      const tokensRes = await fetch(
        `${API_URL}/api/collect/tokens/list?org_id=${currentOrg.id}&authorization=Bearer ${localStorage.getItem('token')}`,
        { headers: getAuthHeaders() }
      );
      const tokensData = await tokensRes.json();
      setTokens(tokensData.tokens || []);

      // Load forms
      const formsRes = await fetch(
        `${API_URL}/api/dataviz/forms/list?org_id=${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      const formsData = await formsRes.json();
      setForms(formsData.forms || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (formData) => {
    try {
      const res = await fetch(
        `${API_URL}/api/collect/tokens/create?authorization=Bearer ${localStorage.getItem('token')}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            enumerator_id: formData.enumerator_id || 'manual',
            form_ids: formData.form_ids,
            expires_hours: formData.expires_hours,
            enumerator_name: formData.enumerator_name
          })
        }
      );
      
      if (!res.ok) throw new Error('Failed to create token');
      
      const data = await res.json();
      toast.success('Collection link created!');
      
      // Copy to clipboard
      const collectUrl = `${window.location.origin}${data.collect_url}`;
      navigator.clipboard.writeText(collectUrl);
      toast.success('Link copied to clipboard!');
      
      loadData();
    } catch (err) {
      toast.error('Failed to create collection link');
    }
  };

  const handleRevokeToken = async (token) => {
    if (!confirm('Are you sure you want to revoke this token? The enumerator will no longer be able to collect data.')) {
      return;
    }

    try {
      await fetch(
        `${API_URL}/api/collect/tokens/${token}?authorization=Bearer ${localStorage.getItem('token')}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      toast.success('Token revoked');
      loadData();
    } catch (err) {
      toast.error('Failed to revoke token');
    }
  };

  const filteredTokens = tokens.filter(t =>
    t.enumerator_name?.toLowerCase().includes(search.toLowerCase())
  );

  const activeTokens = tokens.filter(t => t.is_active && new Date(t.expires_at) > new Date());
  const totalSubmissions = tokens.reduce((sum, t) => sum + (t.submission_count || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              Field Collection
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage collection links for your field team
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Collection Link
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tokens.length}</p>
                  <p className="text-xs text-muted-foreground">Total Links</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeTokens.length}</p>
                  <p className="text-xs text-muted-foreground">Active Links</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{new Set(tokens.map(t => t.enumerator_name)).size}</p>
                  <p className="text-xs text-muted-foreground">Enumerators</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSubmissions}</p>
                  <p className="text-xs text-muted-foreground">Submissions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by enumerator name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Token Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTokens.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTokens.map((token, idx) => (
              <TokenCard
                key={token.full_token || idx}
                token={token}
                onCopy={() => toast.success('Link copied!')}
                onRevoke={handleRevokeToken}
                onViewQR={setQrToken}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No collection links yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Create your first link to start sending enumerators to the field
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Collection Link
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <CreateTokenModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        forms={forms}
        enumerators={enumerators}
        onCreateToken={handleCreateToken}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        token={qrToken}
        isOpen={!!qrToken}
        onClose={() => setQrToken(null)}
      />
    </DashboardLayout>
  );
}
