import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAuthStore, useOrgStore } from '../store';
import { 
  Link2, Mail, Send, Plus, Users, BarChart3, Clock, CheckCircle2, 
  XCircle, Eye, Play, Pause, Copy, Download, RefreshCw, UserPlus,
  Calendar, Bell, ExternalLink, Trash2, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  closed: 'bg-red-500',
  pending: 'bg-yellow-500',
  sent: 'bg-blue-500',
  opened: 'bg-purple-500',
  started: 'bg-indigo-500',
  partial: 'bg-orange-500',
  complete: 'bg-emerald-500',
  expired: 'bg-gray-400',
};

export function TokenSurveysPage() {
  const { token } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const [distributions, setDistributions] = useState([]);
  const [panels, setPanels] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDist, setSelectedDist] = useState(null);
  const [invites, setInvites] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showPanelDialog, setShowPanelDialog] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchDistributions();
      fetchPanels();
      fetchForms();
    }
  }, [currentOrg?.id]);

  const fetchDistributions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/distributions/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDistributions(data.distributions || []);
    } catch (err) {
      toast.error('Failed to load distributions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPanels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/panels/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPanels(data.panels || []);
    } catch (err) {
      console.error('Failed to load panels');
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/forms?org_id=${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setForms(data.forms || []);
    } catch (err) {
      console.error('Failed to load forms');
    }
  };

  const fetchInvites = async (distId) => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/distributions/${currentOrg.id}/${distId}/invites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setInvites(data.invites || []);
    } catch (err) {
      toast.error('Failed to load invites');
    }
  };

  const handleCreateDistribution = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/distributions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...formData,
          org_id: currentOrg.id
        })
      });
      
      if (res.ok) {
        toast.success('Distribution created successfully');
        fetchDistributions();
        setShowCreateDialog(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create distribution');
      }
    } catch (err) {
      toast.error('Failed to create distribution');
    }
  };

  const handleActivate = async (distId) => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/distributions/${currentOrg.id}/${distId}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Distribution activated');
        fetchDistributions();
      }
    } catch (err) {
      toast.error('Failed to activate distribution');
    }
  };

  const handleClose = async (distId) => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/distributions/${currentOrg.id}/${distId}/close`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Distribution closed');
        fetchDistributions();
      }
    } catch (err) {
      toast.error('Failed to close distribution');
    }
  };

  const handleAddInvites = async (distId, inviteData) => {
    try {
      const res = await fetch(`${API_URL}/api/surveys/distributions/${currentOrg.id}/${distId}/invites`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(inviteData)
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Created ${data.invites?.length || 0} invites`);
        fetchInvites(distId);
        setShowInviteDialog(false);
      }
    } catch (err) {
      toast.error('Failed to create invites');
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(window.location.origin + link);
    toast.success('Link copied to clipboard');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="token-surveys-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Token Surveys</h1>
            <p className="text-muted-foreground">Manage survey distributions with unique access tokens</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showPanelDialog} onOpenChange={setShowPanelDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="create-panel-btn">
                  <Users className="w-4 h-4 mr-2" />
                  Create Panel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <CreatePanelForm onSubmit={async (data) => {
                  try {
                    const res = await fetch(`${API_URL}/api/surveys/panels`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}` 
                      },
                      body: JSON.stringify({ ...data, org_id: currentOrg.id })
                    });
                    if (res.ok) {
                      toast.success('Panel created');
                      fetchPanels();
                      setShowPanelDialog(false);
                    }
                  } catch (err) {
                    toast.error('Failed to create panel');
                  }
                }} />
              </DialogContent>
            </Dialog>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="create-distribution-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Distribution
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <CreateDistributionForm 
                  forms={forms} 
                  onSubmit={handleCreateDistribution}
                  onClose={() => setShowCreateDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Link2 className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{distributions.length}</p>
                  <p className="text-sm text-muted-foreground">Distributions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {distributions.filter(d => d.status === 'active').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{panels.length}</p>
                  <p className="text-sm text-muted-foreground">Panels</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <Mail className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {distributions.reduce((sum, d) => sum + (d.stats?.total_invites || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="distributions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="distributions">Distributions</TabsTrigger>
            <TabsTrigger value="panels">Panels</TabsTrigger>
          </TabsList>

          <TabsContent value="distributions" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Loading distributions...
                </CardContent>
              </Card>
            ) : distributions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Link2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No distributions yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first survey distribution to start collecting responses</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Distribution
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {distributions.map((dist) => (
                  <DistributionCard
                    key={dist.id}
                    distribution={dist}
                    onSelect={() => {
                      setSelectedDist(dist);
                      fetchInvites(dist.id);
                    }}
                    onActivate={() => handleActivate(dist.id)}
                    onClose={() => handleClose(dist.id)}
                    onCopyLink={() => dist.public_link && copyLink(dist.public_link)}
                  />
                ))}
              </div>
            )}

            {/* Selected Distribution Details */}
            {selectedDist && (
              <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedDist.name}</CardTitle>
                    <CardDescription>
                      {invites.length} invites • {selectedDist.stats?.completed || 0} completed
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fetchInvites(selectedDist.id)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Invites
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <AddInvitesForm 
                          onSubmit={(data) => handleAddInvites(selectedDist.id, data)}
                          onClose={() => setShowInviteDialog(false)}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <InvitesTable invites={invites} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="panels" className="space-y-4">
            {panels.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No panels yet</h3>
                  <p className="text-muted-foreground mb-4">Create a panel for longitudinal studies with multiple waves</p>
                  <Button onClick={() => setShowPanelDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Panel
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {panels.map((panel) => (
                  <PanelCard key={panel.id} panel={panel} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function DistributionCard({ distribution, onSelect, onActivate, onClose, onCopyLink }) {
  const stats = distribution.stats || {};
  const responseRate = stats.sent > 0 
    ? Math.round((stats.completed / stats.sent) * 100) 
    : 0;

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSelect}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{distribution.name}</h3>
              <Badge className={statusColors[distribution.status]}>
                {distribution.status}
              </Badge>
              <Badge variant="outline">{distribution.mode}</Badge>
            </div>
            
            {distribution.description && (
              <p className="text-sm text-muted-foreground mb-4">{distribution.description}</p>
            )}

            <div className="grid grid-cols-5 gap-4 mt-4">
              <div>
                <p className="text-2xl font-bold">{stats.total_invites || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-500">{stats.sent || 0}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">{stats.opened || 0}</p>
                <p className="text-xs text-muted-foreground">Opened</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{stats.completed || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{responseRate}%</p>
                <p className="text-xs text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {distribution.public_link && (
              <Button variant="ghost" size="icon" onClick={onCopyLink}>
                <Copy className="w-4 h-4" />
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {distribution.status === 'draft' && (
                  <DropdownMenuItem onClick={onActivate}>
                    <Play className="w-4 h-4 mr-2" />
                    Activate
                  </DropdownMenuItem>
                )}
                {distribution.status === 'active' && (
                  <DropdownMenuItem onClick={onClose}>
                    <Pause className="w-4 h-4 mr-2" />
                    Close
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" />
                  Export Responses
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="w-4 h-4 mr-2" />
                  Send Reminders
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PanelCard({ panel }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{panel.name}</CardTitle>
          <Badge variant="outline">Wave {panel.current_wave || 0}/{panel.total_waves}</Badge>
        </div>
        {panel.description && (
          <CardDescription>{panel.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            {panel.member_count || 0} members
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Manage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InvitesTable({ invites }) {
  if (invites.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No invites yet. Add invites to start distributing your survey.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Recipient</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Token</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invites.map((invite) => (
            <tr key={invite.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium">{invite.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{invite.email || invite.phone}</p>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge className={statusColors[invite.status]}>{invite.status}</Badge>
              </td>
              <td className="px-4 py-3 font-mono text-sm">
                {invite.token_prefix}...
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {new Date(invite.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm">
                  <Send className="w-4 h-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateDistributionForm({ forms, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    form_id: '',
    mode: 'token',
    allow_multiple_submissions: false,
    allow_save_and_continue: true,
    require_token: true,
    enable_reminders: false
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Survey Distribution</DialogTitle>
        <DialogDescription>Set up a new survey distribution with unique access tokens</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Q4 Customer Satisfaction Survey"
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Optional description..."
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Form</Label>
          <Select 
            value={formData.form_id}
            onValueChange={(v) => setFormData({...formData, form_id: v})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid gap-2">
          <Label>Distribution Mode</Label>
          <Select 
            value={formData.mode}
            onValueChange={(v) => setFormData({...formData, mode: v})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="token">Token-based (Unique links)</SelectItem>
              <SelectItem value="cawi">CAWI (Web interviewing)</SelectItem>
              <SelectItem value="panel">Panel Survey</SelectItem>
              <SelectItem value="public">Public Link</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Multiple Submissions</Label>
              <p className="text-sm text-muted-foreground">Same token can submit multiple times</p>
            </div>
            <Switch 
              checked={formData.allow_multiple_submissions}
              onCheckedChange={(v) => setFormData({...formData, allow_multiple_submissions: v})}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Save & Continue</Label>
              <p className="text-sm text-muted-foreground">Allow respondents to save progress</p>
            </div>
            <Switch 
              checked={formData.allow_save_and_continue}
              onCheckedChange={(v) => setFormData({...formData, allow_save_and_continue: v})}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Reminders</Label>
              <p className="text-sm text-muted-foreground">Send automated reminder emails</p>
            </div>
            <Switch 
              checked={formData.enable_reminders}
              onCheckedChange={(v) => setFormData({...formData, enable_reminders: v})}
            />
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} disabled={!formData.name || !formData.form_id}>
          Create Distribution
        </Button>
      </DialogFooter>
    </>
  );
}

function AddInvitesForm({ onSubmit, onClose }) {
  const [mode, setMode] = useState('single');
  const [singleInvite, setSingleInvite] = useState({ email: '', name: '' });
  const [bulkText, setBulkText] = useState('');
  const [sendImmediately, setSendImmediately] = useState(false);

  const handleSubmit = () => {
    let invites = [];
    
    if (mode === 'single') {
      invites = [singleInvite];
    } else {
      // Parse CSV: email,name per line
      invites = bulkText.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [email, name] = line.split(',').map(s => s.trim());
          return { email, name };
        });
    }
    
    onSubmit({ invites, send_immediately: sendImmediately });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Survey Invites</DialogTitle>
        <DialogDescription>Add recipients to receive survey tokens</DialogDescription>
      </DialogHeader>
      
      <Tabs value={mode} onValueChange={setMode} className="py-4">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="single">Single Invite</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single" className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input 
              type="email"
              value={singleInvite.email}
              onChange={(e) => setSingleInvite({...singleInvite, email: e.target.value})}
              placeholder="respondent@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label>Name (optional)</Label>
            <Input 
              value={singleInvite.name}
              onChange={(e) => setSingleInvite({...singleInvite, name: e.target.value})}
              placeholder="John Doe"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="bulk" className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label>Paste CSV (email,name)</Label>
            <Textarea 
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="john@example.com,John Doe&#10;jane@example.com,Jane Smith"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">One recipient per line: email,name</p>
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex items-center justify-between py-4 border-t">
        <div className="flex items-center gap-2">
          <Switch checked={sendImmediately} onCheckedChange={setSendImmediately} />
          <Label>Send invites immediately</Label>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Invites
        </Button>
      </DialogFooter>
    </>
  );
}

function CreatePanelForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    total_waves: 3,
    wave_interval_days: 30
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Survey Panel</DialogTitle>
        <DialogDescription>Set up a panel for longitudinal studies with multiple waves</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Panel Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Customer Experience Panel 2026"
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Track customer satisfaction over time..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Total Waves</Label>
            <Input 
              type="number"
              min={1}
              value={formData.total_waves}
              onChange={(e) => setFormData({...formData, total_waves: parseInt(e.target.value)})}
            />
          </div>
          <div className="grid gap-2">
            <Label>Wave Interval (days)</Label>
            <Input 
              type="number"
              min={1}
              value={formData.wave_interval_days}
              onChange={(e) => setFormData({...formData, wave_interval_days: parseInt(e.target.value)})}
            />
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button onClick={() => onSubmit(formData)} disabled={!formData.name}>
          Create Panel
        </Button>
      </DialogFooter>
    </>
  );
}

export default TokenSurveysPage;
