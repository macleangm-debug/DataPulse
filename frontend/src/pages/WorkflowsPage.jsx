import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  Zap,
  GitBranch,
  ArrowRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Search,
  Copy,
  MoreVertical,
  FileText,
  Settings2,
  History
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const WorkflowCard = ({ workflow, onEdit, onDelete, onToggle, onDuplicate }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="group"
  >
    <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              workflow.is_active ? 'bg-green-500/10' : 'bg-gray-500/10'
            }`}>
              <Workflow className={`w-5 h-5 ${workflow.is_active ? 'text-green-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-white">{workflow.name}</h3>
              <p className="text-sm text-gray-400">{workflow.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={workflow.is_active}
              onCheckedChange={() => onToggle(workflow)}
              data-testid={`workflow-toggle-${workflow.id}`}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(workflow)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(workflow)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(workflow)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Trigger & Actions Preview */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="outline" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            {workflow.trigger_type?.replace(/_/g, ' ')}
          </Badge>
          <ArrowRight className="w-4 h-4 text-gray-500" />
          {workflow.actions?.slice(0, 2).map((action, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {action.action_type?.replace(/_/g, ' ')}
            </Badge>
          ))}
          {workflow.actions?.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{workflow.actions.length - 2} more
            </Badge>
          )}
        </div>

        {/* Stats */}
        {workflow.stats && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              {workflow.stats.executions || 0} runs
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {workflow.stats.successful || 0}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-500" />
              {workflow.stats.failed || 0}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

const TemplateCard = ({ template, onUse }) => (
  <Card className="bg-card/30 border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
    onClick={() => onUse(template)}
  >
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <GitBranch className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-white">{template.name}</h3>
          <p className="text-sm text-gray-400">{template.description}</p>
          <Badge variant="outline" className="mt-2 text-xs">{template.category}</Badge>
        </div>
      </div>
    </CardContent>
  </Card>
);

export function WorkflowsPage() {
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [actions, setActions] = useState([]);
  const [operators, setOperators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  const [showDialog, setShowDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    description: '',
    trigger_type: 'submission_created',
    trigger_config: {},
    conditions: [],
    condition_logic: 'and',
    actions: [],
    is_active: true
  });
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
      
      const [workflowsRes, templatesRes, triggersRes, actionsRes, operatorsRes] = await Promise.all([
        fetch(`${API_URL}/api/workflows/${currentOrg.id}`, { headers }),
        fetch(`${API_URL}/api/workflows/${currentOrg.id}/templates`, { headers }),
        fetch(`${API_URL}/api/workflows/triggers`, { headers }),
        fetch(`${API_URL}/api/workflows/actions`, { headers }),
        fetch(`${API_URL}/api/workflows/operators`, { headers })
      ]);

      setWorkflows((await workflowsRes.json()).workflows || []);
      setTemplates((await templatesRes.json()).templates || []);
      setTriggers((await triggersRes.json()).triggers || []);
      setActions((await actionsRes.json()).actions || []);
      setOperators((await operatorsRes.json()).operators || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingWorkflow(null);
    setWorkflowForm({
      name: '',
      description: '',
      trigger_type: 'submission_created',
      trigger_config: {},
      conditions: [],
      condition_logic: 'and',
      actions: [{ action_type: 'flag_review', config: {} }],
      is_active: true
    });
    setShowDialog(true);
  };

  const handleEdit = (workflow) => {
    setEditingWorkflow(workflow);
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description || '',
      trigger_type: workflow.trigger_type,
      trigger_config: workflow.trigger_config || {},
      conditions: workflow.conditions || [],
      condition_logic: workflow.condition_logic || 'and',
      actions: workflow.actions || [],
      is_active: workflow.is_active
    });
    setShowDialog(true);
  };

  const handleDuplicate = (workflow) => {
    setEditingWorkflow(null);
    setWorkflowForm({
      name: `${workflow.name} (Copy)`,
      description: workflow.description || '',
      trigger_type: workflow.trigger_type,
      trigger_config: workflow.trigger_config || {},
      conditions: workflow.conditions || [],
      condition_logic: workflow.condition_logic || 'and',
      actions: workflow.actions || [],
      is_active: false
    });
    setShowDialog(true);
  };

  const handleUseTemplate = (template) => {
    setEditingWorkflow(null);
    setWorkflowForm({
      name: template.name,
      description: template.description,
      trigger_type: template.workflow.trigger_type,
      trigger_config: template.workflow.trigger_config || {},
      conditions: template.workflow.conditions || [],
      condition_logic: template.workflow.condition_logic || 'and',
      actions: template.workflow.actions || [],
      is_active: false
    });
    setShowDialog(true);
  };

  const handleDelete = async (workflow) => {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/workflows/${currentOrg.id}/${workflow.id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );
      
      if (!response.ok) throw new Error('Failed to delete');
      toast.success('Workflow deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const handleToggle = async (workflow) => {
    try {
      const response = await fetch(
        `${API_URL}/api/workflows/${currentOrg.id}/${workflow.id}/toggle`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );
      
      if (!response.ok) throw new Error('Failed to toggle');
      const result = await response.json();
      toast.success(result.message);
      loadData();
    } catch (error) {
      toast.error('Failed to toggle workflow');
    }
  };

  const handleSave = async () => {
    if (!workflowForm.name.trim()) {
      toast.error('Workflow name is required');
      return;
    }

    if (workflowForm.actions.length === 0) {
      toast.error('At least one action is required');
      return;
    }

    setSaving(true);
    try {
      const url = editingWorkflow
        ? `${API_URL}/api/workflows/${currentOrg.id}/${editingWorkflow.id}`
        : `${API_URL}/api/workflows/${currentOrg.id}`;
      
      const response = await fetch(url, {
        method: editingWorkflow ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workflowForm)
      });

      if (!response.ok) throw new Error('Failed to save');
      toast.success(editingWorkflow ? 'Workflow updated' : 'Workflow created');
      setShowDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const addAction = () => {
    setWorkflowForm(prev => ({
      ...prev,
      actions: [...prev.actions, { action_type: 'flag_review', config: {} }]
    }));
  };

  const updateAction = (index, field, value) => {
    setWorkflowForm(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => 
        i === index ? { ...a, [field]: value } : a
      )
    }));
  };

  const removeAction = (index) => {
    setWorkflowForm(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const addCondition = () => {
    setWorkflowForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }]
    }));
  };

  const updateCondition = (index, field, value) => {
    setWorkflowForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const removeCondition = (index) => {
    setWorkflowForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch = w.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterActive === 'all' || 
      (filterActive === 'active' && w.is_active) ||
      (filterActive === 'inactive' && !w.is_active);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="workflows-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">
              Workflow Automation
            </h1>
            <p className="text-gray-400">Automate submission processing and team notifications</p>
          </div>
          <Button onClick={handleCreate} data-testid="create-workflow-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Workflow
          </Button>
        </div>

        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows" className="gap-2">
              <Workflow className="w-4 h-4" />
              Workflows
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-4 mt-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Workflows Grid */}
            {filteredWorkflows.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    onDuplicate={handleDuplicate}
                  />
                ))}
              </div>
            ) : (
              <Card className="bg-card/30 border-dashed">
                <CardContent className="py-12 text-center">
                  <Workflow className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-white mb-2">No workflows yet</h3>
                  <p className="text-gray-400 mb-4">
                    Create your first workflow to automate submission processing
                  </p>
                  <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Workflow
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={handleUseTemplate}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Workflow Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
              </DialogTitle>
              <DialogDescription>
                Define when and how submissions should be processed
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Workflow Name</Label>
                  <Input
                    value={workflowForm.name}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                    placeholder="e.g., Auto-approve high quality"
                    data-testid="workflow-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                    placeholder="Brief description of what this workflow does"
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Trigger */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Trigger
                </Label>
                <Select
                  value={workflowForm.trigger_type}
                  onValueChange={(value) => setWorkflowForm({ ...workflowForm, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-gray-400">{t.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Trigger Config for threshold-based triggers */}
                {(workflowForm.trigger_type === 'quality_below' || workflowForm.trigger_type === 'quality_above') && (
                  <div className="flex items-center gap-2 pl-4 mt-2">
                    <Label className="text-sm">Threshold:</Label>
                    <Input
                      type="number"
                      value={workflowForm.trigger_config.threshold || ''}
                      onChange={(e) => setWorkflowForm({
                        ...workflowForm,
                        trigger_config: { ...workflowForm.trigger_config, threshold: parseInt(e.target.value) }
                      })}
                      className="w-20"
                      min={0}
                      max={100}
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Conditions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-500" />
                    Conditions (Optional)
                  </Label>
                  <Button variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>

                {workflowForm.conditions.length > 0 && (
                  <div className="space-y-2">
                    <Select
                      value={workflowForm.condition_logic}
                      onValueChange={(value) => setWorkflowForm({ ...workflowForm, condition_logic: value })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">Match ALL</SelectItem>
                        <SelectItem value="or">Match ANY</SelectItem>
                      </SelectContent>
                    </Select>

                    {workflowForm.conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-card/30 rounded-lg">
                        <Input
                          placeholder="Field name"
                          value={condition.field}
                          onChange={(e) => updateCondition(index, 'field', e.target.value)}
                          className="flex-1"
                        />
                        <Select
                          value={condition.operator}
                          onValueChange={(value) => updateCondition(index, 'operator', value)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Value"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-green-500" />
                    Actions
                  </Label>
                  <Button variant="outline" size="sm" onClick={addAction}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>

                <div className="space-y-2">
                  {workflowForm.actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-card/30 rounded-lg">
                      <span className="text-sm text-gray-400 w-6">{index + 1}.</span>
                      <Select
                        value={action.action_type}
                        onValueChange={(value) => updateAction(index, 'action_type', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {actions.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <div>
                                <div className="font-medium">{a.name}</div>
                                <div className="text-xs text-gray-400">{a.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAction(index)}
                        disabled={workflowForm.actions.length === 1}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-gray-400">Enable this workflow immediately</p>
                </div>
                <Switch
                  checked={workflowForm.is_active}
                  onCheckedChange={(checked) => setWorkflowForm({ ...workflowForm, is_active: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} data-testid="save-workflow-btn">
                {saving ? 'Saving...' : editingWorkflow ? 'Update Workflow' : 'Create Workflow'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
