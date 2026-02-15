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
  Database, Upload, Download, ArrowRight, Plus, RefreshCw,
  Settings, FileText, Link2, CheckCircle2, Clock, AlertCircle,
  Trash2, Edit, Eye, Play, History, ArrowLeftRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const sourceTypes = {
  case: { label: 'Case Data', icon: FileText },
  dataset: { label: 'Lookup Dataset', icon: Database },
  previous_submission: { label: 'Previous Submission', icon: History },
  external_api: { label: 'External API', icon: Link2 },
  manual: { label: 'Manual/Token', icon: Settings }
};

const transformTypes = {
  direct: 'Direct Copy',
  format: 'String Format',
  calculate: 'Calculate',
  lookup: 'Value Lookup',
  conditional: 'Conditional'
};

export function PreloadWritebackPage() {
  const { token } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const [preloadConfigs, setPreloadConfigs] = useState([]);
  const [writebackConfigs, setWritebackConfigs] = useState([]);
  const [forms, setForms] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPreloadDialog, setShowPreloadDialog] = useState(false);
  const [showWritebackDialog, setShowWritebackDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('preload');
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchPreloadConfigs();
      fetchWritebackConfigs();
      fetchForms();
      fetchDatasets();
      fetchLogs();
    }
  }, [currentOrg?.id]);

  const fetchPreloadConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/preload/configs/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPreloadConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to load preload configs');
    } finally {
      setLoading(false);
    }
  };

  const fetchWritebackConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/preload/writeback/configs/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWritebackConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to load writeback configs');
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

  const fetchDatasets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/datasets/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDatasets(data.datasets || []);
    } catch (err) {
      console.error('Failed to load datasets');
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/preload/logs/${currentOrg.id}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load logs');
    }
  };

  const handleCreatePreloadConfig = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/preload/configs`, {
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
        toast.success('Preload configuration created');
        fetchPreloadConfigs();
        setShowPreloadDialog(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create configuration');
      }
    } catch (err) {
      toast.error('Failed to create configuration');
    }
  };

  const handleCreateWritebackConfig = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/preload/writeback/configs`, {
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
        toast.success('Write-back configuration created');
        fetchWritebackConfigs();
        setShowWritebackDialog(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create configuration');
      }
    } catch (err) {
      toast.error('Failed to create configuration');
    }
  };

  const handleDeleteConfig = async (configId, type) => {
    try {
      const endpoint = type === 'preload' 
        ? `${API_URL}/api/preload/configs/${configId}`
        : `${API_URL}/api/preload/writeback/configs/${configId}`;
        
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Configuration deleted');
        type === 'preload' ? fetchPreloadConfigs() : fetchWritebackConfigs();
      }
    } catch (err) {
      toast.error('Failed to delete configuration');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="preload-writeback-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Preload & Write-back</h1>
            <p className="text-muted-foreground">Pre-populate forms and sync data back to datasets</p>
          </div>
          <Button variant="outline" onClick={() => { fetchPreloadConfigs(); fetchWritebackConfigs(); fetchLogs(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Download className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{preloadConfigs.length}</p>
                  <p className="text-sm text-muted-foreground">Preload Configs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Upload className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{writebackConfigs.length}</p>
                  <p className="text-sm text-muted-foreground">Write-back Configs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {preloadConfigs.reduce((sum, c) => sum + (c.stats?.successful || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Successful Preloads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <ArrowLeftRight className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {writebackConfigs.reduce((sum, c) => sum + (c.stats?.successful || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Successful Write-backs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="preload">Preload Configurations</TabsTrigger>
            <TabsTrigger value="writeback">Write-back Configurations</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="preload" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={showPreloadDialog} onOpenChange={setShowPreloadDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="create-preload-config-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    New Preload Config
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <CreatePreloadConfigForm 
                    forms={forms}
                    datasets={datasets}
                    onSubmit={handleCreatePreloadConfig}
                    onClose={() => setShowPreloadDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {preloadConfigs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Download className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No preload configurations</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a preload configuration to pre-populate form fields with existing data
                  </p>
                  <Button onClick={() => setShowPreloadDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Preload Config
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {preloadConfigs.map((config) => (
                  <PreloadConfigCard 
                    key={config.id} 
                    config={config}
                    forms={forms}
                    onDelete={() => handleDeleteConfig(config.id, 'preload')}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="writeback" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Dialog open={showWritebackDialog} onOpenChange={setShowWritebackDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="create-writeback-config-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    New Write-back Config
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <CreateWritebackConfigForm 
                    forms={forms}
                    datasets={datasets}
                    onSubmit={handleCreateWritebackConfig}
                    onClose={() => setShowWritebackDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {writebackConfigs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No write-back configurations</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a write-back configuration to sync submission data to datasets or cases
                  </p>
                  <Button onClick={() => setShowWritebackDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Write-back Config
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {writebackConfigs.map((config) => (
                  <WritebackConfigCard 
                    key={config.id} 
                    config={config}
                    forms={forms}
                    datasets={datasets}
                    onDelete={() => handleDeleteConfig(config.id, 'writeback')}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-4">
            <ExecutionLogs logs={logs} onRefresh={fetchLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function PreloadConfigCard({ config, forms, onDelete }) {
  const form = forms.find(f => f.id === config.form_id);
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
            </div>
            
            {config.description && (
              <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <FileText className="w-4 h-4" />
              <span>Form: {form?.name || config.form_id}</span>
              <span className="mx-2">•</span>
              <span>{config.mappings?.length || 0} field mappings</span>
            </div>

            {/* Mapping Preview */}
            {config.mappings && config.mappings.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {config.mappings.slice(0, 5).map((m, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                    <span className="text-muted-foreground">{m.source_field}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-medium">{m.target_field}</span>
                  </div>
                ))}
                {config.mappings.length > 5 && (
                  <span className="px-2 py-1 text-xs text-muted-foreground">
                    +{config.mappings.length - 5} more
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xl font-bold text-blue-500">{stats.total_preloads || 0}</p>
                <p className="text-xs text-muted-foreground">Total Preloads</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-500">{stats.successful || 0}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-500">{stats.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WritebackConfigCard({ config, forms, datasets, onDelete }) {
  const form = forms.find(f => f.id === config.form_id);
  const dataset = datasets.find(d => d.id === config.target_id);
  const stats = config.stats || {};

  const triggerLabels = {
    on_submit: 'On Submit',
    on_approve: 'On Approve',
    on_review: 'On Review',
    manual: 'Manual'
  };

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
              <Badge variant="outline">{triggerLabels[config.trigger] || config.trigger}</Badge>
            </div>
            
            {config.description && (
              <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>From: {form?.name || config.form_id}</span>
              </div>
              <ArrowRight className="w-4 h-4" />
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>To: {config.target_type === 'dataset' ? (dataset?.name || 'Dataset') : config.target_type}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xl font-bold text-blue-500">{stats.total_writebacks || 0}</p>
                <p className="text-xs text-muted-foreground">Total Write-backs</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-500">{stats.successful || 0}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-500">{stats.failed || 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionLogs({ logs, onRefresh }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Execution Logs</CardTitle>
            <CardDescription>Recent preload and write-back executions</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No execution logs yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                    {log.status}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">
                      {log.fields_preloaded?.length || log.results?.length || 0} fields processed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Form: {log.form_id?.slice(0, 12)}... • {log.case_id ? `Case: ${log.case_id.slice(0, 8)}...` : 'No case'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : '--'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreatePreloadConfigForm({ forms, datasets, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    form_id: '',
    is_active: true,
    sources: [],
    mappings: []
  });
  
  const [newMapping, setNewMapping] = useState({
    source_type: 'case',
    source_field: '',
    target_field: '',
    transformation: 'direct',
    required: false,
    default_value: ''
  });

  const addMapping = () => {
    if (newMapping.source_field && newMapping.target_field) {
      setFormData({
        ...formData,
        mappings: [...formData.mappings, {...newMapping}]
      });
      setNewMapping({
        source_type: 'case',
        source_field: '',
        target_field: '',
        transformation: 'direct',
        required: false,
        default_value: ''
      });
    }
  };

  const removeMapping = (index) => {
    setFormData({
      ...formData,
      mappings: formData.mappings.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Preload Configuration</DialogTitle>
        <DialogDescription>Configure how form fields are pre-populated with existing data</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Configuration Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Household Follow-up Preload"
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Pre-populate follow-up forms with baseline data..."
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Target Form</Label>
          <Select 
            value={formData.form_id}
            onValueChange={(v) => setFormData({...formData, form_id: v})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select form to preload" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Field Mappings */}
        <div className="space-y-3">
          <Label>Field Mappings</Label>
          
          {formData.mappings.length > 0 && (
            <div className="space-y-2 mb-4">
              {formData.mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <Badge variant="outline">{m.source_type}</Badge>
                  <span className="text-sm">{m.source_field}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-sm font-medium">{m.target_field}</span>
                  <Badge variant="secondary">{m.transformation}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => removeMapping(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
            <div className="grid gap-2">
              <Label className="text-xs">Source Type</Label>
              <Select 
                value={newMapping.source_type}
                onValueChange={(v) => setNewMapping({...newMapping, source_type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sourceTypes).map(([key, {label}]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">Source Field</Label>
              <Input 
                value={newMapping.source_field}
                onChange={(e) => setNewMapping({...newMapping, source_field: e.target.value})}
                placeholder="respondent_name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">Target Field</Label>
              <Input 
                value={newMapping.target_field}
                onChange={(e) => setNewMapping({...newMapping, target_field: e.target.value})}
                placeholder="name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">Transformation</Label>
              <Select 
                value={newMapping.transformation}
                onValueChange={(v) => setNewMapping({...newMapping, transformation: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(transformTypes).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={addMapping}>
                <Plus className="w-4 h-4 mr-2" />
                Add Mapping
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <Label>Active</Label>
            <p className="text-sm text-muted-foreground">Enable this configuration</p>
          </div>
          <Switch 
            checked={formData.is_active}
            onCheckedChange={(v) => setFormData({...formData, is_active: v})}
          />
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => onSubmit(formData)} 
          disabled={!formData.name || !formData.form_id || formData.mappings.length === 0}
        >
          Create Configuration
        </Button>
      </DialogFooter>
    </>
  );
}

function CreateWritebackConfigForm({ forms, datasets, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    form_id: '',
    is_active: true,
    target_type: 'dataset',
    target_id: '',
    trigger: 'on_approve',
    mappings: [],
    create_if_missing: false,
    match_fields: []
  });
  
  const [newMapping, setNewMapping] = useState({
    source_field: '',
    target_field: '',
    transformation: 'direct'
  });

  const addMapping = () => {
    if (newMapping.source_field && newMapping.target_field) {
      setFormData({
        ...formData,
        mappings: [...formData.mappings, {...newMapping}]
      });
      setNewMapping({ source_field: '', target_field: '', transformation: 'direct' });
    }
  };

  const removeMapping = (index) => {
    setFormData({
      ...formData,
      mappings: formData.mappings.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Write-back Configuration</DialogTitle>
        <DialogDescription>Configure how submission data is synced back to datasets or cases</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Configuration Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Update Household Dataset"
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Write verified data back to household listing..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Source Form</Label>
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
          
          <div className="grid gap-2">
            <Label>Trigger</Label>
            <Select 
              value={formData.trigger}
              onValueChange={(v) => setFormData({...formData, trigger: v})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_submit">On Submit</SelectItem>
                <SelectItem value="on_approve">On Approve</SelectItem>
                <SelectItem value="on_review">On Review</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Target Type</Label>
            <Select 
              value={formData.target_type}
              onValueChange={(v) => setFormData({...formData, target_type: v, target_id: ''})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dataset">Lookup Dataset</SelectItem>
                <SelectItem value="case">Case Management</SelectItem>
                <SelectItem value="external_api">External API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.target_type === 'dataset' && (
            <div className="grid gap-2">
              <Label>Target Dataset</Label>
              <Select 
                value={formData.target_id}
                onValueChange={(v) => setFormData({...formData, target_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Field Mappings */}
        <div className="space-y-3">
          <Label>Field Mappings</Label>
          
          {formData.mappings.length > 0 && (
            <div className="space-y-2 mb-4">
              {formData.mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <span className="text-sm">{m.source_field}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="text-sm font-medium">{m.target_field}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeMapping(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg">
            <div className="grid gap-2">
              <Label className="text-xs">Form Field</Label>
              <Input 
                value={newMapping.source_field}
                onChange={(e) => setNewMapping({...newMapping, source_field: e.target.value})}
                placeholder="current_status"
              />
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">Target Field</Label>
              <Input 
                value={newMapping.target_field}
                onChange={(e) => setNewMapping({...newMapping, target_field: e.target.value})}
                placeholder="status"
              />
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">&nbsp;</Label>
              <Button type="button" variant="outline" onClick={addMapping}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <Label>Create if Missing</Label>
            <p className="text-sm text-muted-foreground">Create new record if no match found</p>
          </div>
          <Switch 
            checked={formData.create_if_missing}
            onCheckedChange={(v) => setFormData({...formData, create_if_missing: v})}
          />
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={() => onSubmit(formData)} 
          disabled={!formData.name || !formData.form_id || formData.mappings.length === 0}
        >
          Create Configuration
        </Button>
      </DialogFooter>
    </>
  );
}

export default PreloadWritebackPage;
