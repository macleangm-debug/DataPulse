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
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { useAuthStore, useOrgStore } from '../store';
import { 
  Shield, CheckCircle2, AlertTriangle, XCircle, Plus, RefreshCw,
  User, FileCheck, BarChart3, Calendar, Search, Filter, Eye,
  ClipboardCheck, AlertCircle, TrendingDown, Users, Percent
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  pending: 'bg-yellow-500',
  assigned: 'bg-blue-500',
  in_progress: 'bg-indigo-500',
  completed: 'bg-gray-500',
  discrepancy_found: 'bg-orange-500',
  verified: 'bg-green-500',
  flagged: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

const severityColors = {
  minor: 'bg-yellow-400',
  moderate: 'bg-orange-400',
  major: 'bg-red-400',
  critical: 'bg-red-600'
};

export function BackcheckPage() {
  const { token, user } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const [configs, setConfigs] = useState([]);
  const [backchecks, setBackchecks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    if (currentOrg?.id) {
      fetchConfigs();
      fetchBackchecks();
      fetchProjects();
      fetchForms();
    }
  }, [currentOrg?.id]);

  const fetchConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/backcheck/configs/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to load configs');
    }
  };

  const fetchBackchecks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/backcheck/queue/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBackchecks(data.backchecks || []);
    } catch (err) {
      console.error('Failed to load backchecks');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects?org_id=${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to load projects');
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

  const handleCreateConfig = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/backcheck/configs`, {
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
        toast.success('Back-check configuration created');
        fetchConfigs();
        setShowCreateDialog(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create configuration');
      }
    } catch (err) {
      toast.error('Failed to create configuration');
    }
  };

  const handleGenerateSample = async (configId) => {
    try {
      const res = await fetch(`${API_URL}/api/backcheck/configs/${configId}/generate-sample`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Generated ${data.selected} back-checks`);
        fetchBackchecks();
        fetchConfigs();
      }
    } catch (err) {
      toast.error('Failed to generate sample');
    }
  };

  const stats = {
    total: backchecks.length,
    pending: backchecks.filter(b => b.status === 'pending').length,
    completed: backchecks.filter(b => ['completed', 'verified', 'discrepancy_found', 'flagged'].includes(b.status)).length,
    verified: backchecks.filter(b => b.status === 'verified').length,
    flagged: backchecks.filter(b => b.status === 'flagged').length
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="backcheck-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Back-check Center</h1>
            <p className="text-muted-foreground">Quality verification through field spot-checks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchBackchecks(); fetchConfigs(); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="create-backcheck-config-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Configuration
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <CreateBackcheckConfigForm 
                  projects={projects}
                  forms={forms}
                  onSubmit={handleCreateConfig}
                  onClose={() => setShowCreateDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <ClipboardCheck className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-500/10 rounded-lg">
                  <FileCheck className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
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
                  <p className="text-2xl font-bold">{stats.verified}</p>
                  <p className="text-sm text-muted-foreground">Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.flagged}</p>
                  <p className="text-sm text-muted-foreground">Flagged</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="queue">Back-check Queue</TabsTrigger>
            <TabsTrigger value="configs">Configurations</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4 mt-4">
            <BackcheckQueue 
              backchecks={backchecks} 
              onRefresh={fetchBackchecks}
              userId={user?.id}
            />
          </TabsContent>

          <TabsContent value="configs" className="space-y-4 mt-4">
            {configs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No configurations yet</h3>
                  <p className="text-muted-foreground mb-4">Create a back-check configuration to start quality verification</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Configuration
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {configs.map((config) => (
                  <ConfigCard 
                    key={config.id} 
                    config={config}
                    onGenerateSample={() => handleGenerateSample(config.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 mt-4">
            <BackcheckReports orgId={currentOrg?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function BackcheckQueue({ backchecks, onRefresh, userId }) {
  const { token } = useAuthStore();
  const [filter, setFilter] = useState('all');
  const [selectedBackcheck, setSelectedBackcheck] = useState(null);

  const filtered = backchecks.filter(bc => {
    if (filter === 'all') return true;
    if (filter === 'my') return bc.assigned_to === userId;
    return bc.status === filter;
  });

  const handleAssign = async (backcheckId, verifierId) => {
    try {
      const res = await fetch(`${API_URL}/api/backcheck/assign/${backcheckId}?verifier_id=${verifierId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Back-check assigned');
        onRefresh();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to assign');
      }
    } catch (err) {
      toast.error('Failed to assign back-check');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Back-checks</SelectItem>
            <SelectItem value="my">Assigned to Me</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex-1" />
        
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Queue Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No back-checks found</h3>
            <p className="text-muted-foreground">Generate samples from a configuration to populate the queue</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Submission</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Enumerator</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Match Rate</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Due Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((bc) => (
                    <tr key={bc.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm">{bc.submission_id?.slice(0, 12)}...</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{bc.original_enumerator_id?.slice(0, 8) || 'Unknown'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusColors[bc.status]}>{bc.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {bc.match_rate !== undefined ? (
                          <div className="flex items-center gap-2">
                            <Progress value={bc.match_rate * 100} className="w-16 h-2" />
                            <span className="text-sm">{Math.round(bc.match_rate * 100)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {bc.due_date ? new Date(bc.due_date).toLocaleDateString() : '--'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {bc.status === 'pending' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleAssign(bc.id, userId)}
                            >
                              Assign to Me
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSelectedBackcheck(bc)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedBackcheck} onOpenChange={() => setSelectedBackcheck(null)}>
        <DialogContent className="max-w-2xl">
          {selectedBackcheck && (
            <BackcheckDetailView 
              backcheck={selectedBackcheck}
              onClose={() => setSelectedBackcheck(null)}
              onRefresh={onRefresh}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackcheckDetailView({ backcheck, onClose, onRefresh }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Back-check Details</DialogTitle>
        <DialogDescription>Review and verify submission data</DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Submission ID</Label>
            <p className="font-mono text-sm">{backcheck.submission_id}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge className={statusColors[backcheck.status]}>{backcheck.status}</Badge>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Original Enumerator</Label>
            <p>{backcheck.original_enumerator_id || 'Unknown'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Match Rate</Label>
            <p>{backcheck.match_rate ? `${Math.round(backcheck.match_rate * 100)}%` : 'Not verified'}</p>
          </div>
        </div>

        {backcheck.discrepancies && backcheck.discrepancies.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Discrepancies Found</Label>
            <div className="space-y-2">
              {backcheck.discrepancies.map((disc, i) => (
                <div key={i} className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{disc.field_id}</span>
                    <Badge className={severityColors[disc.severity]}>{disc.severity}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Original</p>
                      <p>{String(disc.original_value)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Verified</p>
                      <p>{String(disc.verified_value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {backcheck.notes && (
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <p className="text-sm">{backcheck.notes}</p>
          </div>
        )}
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </>
  );
}

function ConfigCard({ config, onGenerateSample }) {
  const stats = config.stats || {};
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{config.name}</h3>
              <Badge variant={config.is_active ? 'default' : 'secondary'}>
                {config.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline">{config.sampling_method}</Badge>
            </div>
            
            {config.description && (
              <p className="text-sm text-muted-foreground mb-4">{config.description}</p>
            )}

            <div className="grid grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xl font-bold">{config.sample_percentage}%</p>
                <p className="text-xs text-muted-foreground">Sample Rate</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-500">{stats.total_selected || 0}</p>
                <p className="text-xs text-muted-foreground">Selected</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-500">{stats.completed || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-xl font-bold text-orange-500">{stats.discrepancies_found || 0}</p>
                <p className="text-xs text-muted-foreground">Discrepancies</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={onGenerateSample}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Sample
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BackcheckReports({ orgId }) {
  const { token } = useAuthStore();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [orgId]);

  const fetchReport = async () => {
    if (!orgId) return;
    
    try {
      const res = await fetch(`${API_URL}/api/backcheck/reports/${orgId}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Loading reports...</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Quality Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {report?.summary?.match_stats ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Average Match Rate</span>
                <span className="text-2xl font-bold">
                  {Math.round((report.summary.match_stats.avg_match_rate || 0) * 100)}%
                </span>
              </div>
              <Progress value={(report.summary.match_stats.avg_match_rate || 0) * 100} />
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Min Match</p>
                  <p className="font-medium">{Math.round((report.summary.match_stats.min_match_rate || 0) * 100)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Match</p>
                  <p className="font-medium">{Math.round((report.summary.match_stats.max_match_rate || 0) * 100)}%</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Percent className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enumerator Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {report?.by_enumerator && report.by_enumerator.length > 0 ? (
            <div className="space-y-3">
              {report.by_enumerator.slice(0, 5).map((enum_stat, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{enum_stat._id?.slice(0, 8) || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {enum_stat.total} checks
                    </span>
                    <Badge className={enum_stat.flagged > 0 ? 'bg-red-500' : 'bg-green-500'}>
                      {Math.round((enum_stat.avg_match_rate || 0) * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No enumerator data yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateBackcheckConfigForm({ projects, forms, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    project_id: '',
    form_id: '',
    sampling_method: 'random',
    sample_percentage: 10,
    min_per_enumerator: 2,
    verification_fields: [],
    auto_flag_on_critical: true,
    require_supervisor_review: true
  });

  const selectedForm = forms.find(f => f.id === formData.form_id);
  const availableFields = selectedForm?.fields || [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Back-check Configuration</DialogTitle>
        <DialogDescription>Set up automated quality verification for submissions</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="grid gap-2">
          <Label>Configuration Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Health Survey Back-checks"
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
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Project</Label>
            <Select 
              value={formData.project_id}
              onValueChange={(v) => setFormData({...formData, project_id: v})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label>Form</Label>
            <Select 
              value={formData.form_id}
              onValueChange={(v) => setFormData({...formData, form_id: v})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Sampling Method</Label>
            <Select 
              value={formData.sampling_method}
              onValueChange={(v) => setFormData({...formData, sampling_method: v})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="stratified">Stratified (by enumerator)</SelectItem>
                <SelectItem value="systematic">Systematic</SelectItem>
                <SelectItem value="targeted">Targeted (manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label>Sample Percentage (%)</Label>
            <Input 
              type="number"
              min={1}
              max={100}
              value={formData.sample_percentage}
              onChange={(e) => setFormData({...formData, sample_percentage: parseFloat(e.target.value)})}
            />
          </div>
        </div>
        
        <div className="grid gap-2">
          <Label>Min Checks Per Enumerator</Label>
          <Input 
            type="number"
            min={1}
            value={formData.min_per_enumerator}
            onChange={(e) => setFormData({...formData, min_per_enumerator: parseInt(e.target.value)})}
          />
        </div>
        
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-flag Critical Discrepancies</Label>
              <p className="text-sm text-muted-foreground">Automatically flag submissions with critical issues</p>
            </div>
            <Switch 
              checked={formData.auto_flag_on_critical}
              onCheckedChange={(v) => setFormData({...formData, auto_flag_on_critical: v})}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Supervisor Review</Label>
              <p className="text-sm text-muted-foreground">All discrepancies need supervisor approval</p>
            </div>
            <Switch 
              checked={formData.require_supervisor_review}
              onCheckedChange={(v) => setFormData({...formData, require_supervisor_review: v})}
            />
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => onSubmit(formData)} 
          disabled={!formData.name || !formData.project_id || !formData.form_id}
        >
          Create Configuration
        </Button>
      </DialogFooter>
    </>
  );
}

export default BackcheckPage;
