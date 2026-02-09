/**
 * DashboardBuilder - Interactive dashboard creation with drag-and-drop widgets
 */

import React, { useState, useEffect, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { Switch } from '../../components/ui/switch';
import {
  LayoutDashboard,
  Plus,
  Trash2,
  Settings,
  BarChart3,
  Hash,
  Table,
  Type,
  Save,
  Share2,
  Eye,
  RefreshCw,
  Filter,
  GripVertical,
  Maximize2,
  X,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CHART_COLORS = ['#0ea5e9', '#22d3ee', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f97316'];

const WIDGET_TYPES = [
  { id: 'stat', label: 'Statistic', icon: Hash, description: 'Single value metric' },
  { id: 'chart', label: 'Chart', icon: BarChart3, description: 'Bar, pie, or line chart' },
  { id: 'table', label: 'Table', icon: Table, description: 'Data table view' },
  { id: 'text', label: 'Text', icon: Type, description: 'Rich text content' }
];

const STAT_TYPES = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'mean', label: 'Mean' },
  { value: 'median', label: 'Median' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'std', label: 'Std Deviation' }
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'line', label: 'Line Chart' }
];

export function DashboardBuilder({ formId, snapshotId, orgId, fields, getToken }) {
  const [dashboards, setDashboards] = useState([]);
  const [currentDashboard, setCurrentDashboard] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [widgetData, setWidgetData] = useState({});
  const [filters, setFilters] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Drill-down state
  const [drillDownFilters, setDrillDownFilters] = useState({});
  const [drillDownSource, setDrillDownSource] = useState(null);

  // Sharing state
  const [shareSettings, setShareSettings] = useState({
    public: false,
    passwordProtected: false,
    password: '',
    users: []
  });
  const [newShareEmail, setNewShareEmail] = useState('');
  const [newShareRole, setNewShareRole] = useState('viewer');

  // New dashboard form
  const [newDashboard, setNewDashboard] = useState({
    name: '',
    description: '',
    theme: 'light'
  });

  // New widget form
  const [newWidget, setNewWidget] = useState({
    type: 'stat',
    title: '',
    config: {}
  });

  const saveShareSettings = async () => {
    if (!currentDashboard) return;
    
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${currentDashboard.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          public: shareSettings.public,
          password: shareSettings.passwordProtected ? shareSettings.password : null,
          user_ids: shareSettings.users.map(u => u.email),
          role: 'viewer'
        })
      });
      
      if (response.ok) {
        toast.success('Sharing settings saved');
        setShowShareDialog(false);
      } else {
        toast.error('Failed to save sharing settings');
      }
    } catch (error) {
      toast.error('Failed to save sharing settings');
    }
  };

  useEffect(() => {
    if (orgId) {
      fetchDashboards();
    }
  }, [orgId]);

  useEffect(() => {
    if (currentDashboard?.id) {
      fetchDashboardData();
      fetchFilterOptions();
    }
  }, [currentDashboard?.id, appliedFilters, drillDownFilters]);

  const fetchDashboards = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${orgId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboards(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboards:', error);
    }
  };

  const fetchDashboardData = async () => {
    if (!currentDashboard?.id) return;
    
    setLoading(true);
    try {
      // Combine regular filters with drill-down filters
      const combinedFilters = { ...appliedFilters, ...drillDownFilters };
      
      const response = await fetch(`${API_URL}/api/dashboards/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          dashboard_id: currentDashboard.id,
          filters: combinedFilters
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWidgetData(data.widgets || {});
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle drill-down click on chart elements
  const handleDrillDown = (widget, dataPoint) => {
    if (!dataPoint || !widget.config?.variable) return;
    
    const variable = widget.config.variable;
    const value = dataPoint.name || dataPoint.payload?.name;
    
    if (value) {
      setDrillDownFilters({ [variable]: value });
      setDrillDownSource({ widgetId: widget.id, variable, value });
      toast.info(`Filtered by ${variable}: ${value}`);
    }
  };

  // Clear drill-down filters
  const clearDrillDown = () => {
    setDrillDownFilters({});
    setDrillDownSource(null);
    toast.info('Drill-down filter cleared');
  };

  const fetchFilterOptions = async () => {
    if (!currentDashboard?.id) return;
    
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${currentDashboard.id}/filter-options`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data.filters || {});
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const createDashboard = async () => {
    if (!newDashboard.name.trim()) {
      toast.error('Please enter a dashboard name');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/dashboards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          org_id: orgId,
          name: newDashboard.name,
          description: newDashboard.description,
          form_id: formId,
          snapshot_id: snapshotId,
          theme: newDashboard.theme,
          widgets: [],
          filters: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Dashboard created');
        setShowCreateDashboard(false);
        setNewDashboard({ name: '', description: '', theme: 'light' });
        fetchDashboards();
      } else {
        toast.error('Failed to create dashboard');
      }
    } catch (error) {
      toast.error('Failed to create dashboard');
    } finally {
      setLoading(false);
    }
  };

  const selectDashboard = async (dashboardId) => {
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${orgId}/${dashboardId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentDashboard(data);
        setWidgets(data.widgets || []);
        setFilters(data.filters || []);
        setAppliedFilters({});
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  };

  const addWidget = () => {
    if (!newWidget.title.trim()) {
      toast.error('Please enter a widget title');
      return;
    }

    const widget = {
      id: `widget-${Date.now()}`,
      type: newWidget.type,
      title: newWidget.title,
      config: { ...newWidget.config },
      position: { x: 0, y: Infinity, w: 4, h: 3 }
    };

    setWidgets([...widgets, widget]);
    setShowAddWidget(false);
    setNewWidget({ type: 'stat', title: '', config: {} });
    toast.success('Widget added');
  };

  const removeWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    toast.success('Widget removed');
  };

  const onLayoutChange = (layout) => {
    const updatedWidgets = widgets.map(widget => {
      const layoutItem = layout.find(l => l.i === widget.id);
      if (layoutItem) {
        return {
          ...widget,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h
          }
        };
      }
      return widget;
    });
    setWidgets(updatedWidgets);
  };

  const saveDashboard = async () => {
    if (!currentDashboard?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${orgId}/${currentDashboard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          ...currentDashboard,
          widgets: widgets,
          filters: filters
        })
      });

      if (response.ok) {
        toast.success('Dashboard saved');
        fetchDashboardData();
      } else {
        toast.error('Failed to save dashboard');
      }
    } catch (error) {
      toast.error('Failed to save dashboard');
    } finally {
      setLoading(false);
    }
  };

  const deleteDashboard = async () => {
    if (!currentDashboard?.id) return;

    if (!confirm('Are you sure you want to delete this dashboard?')) return;

    try {
      const response = await fetch(`${API_URL}/api/dashboards/${orgId}/${currentDashboard.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (response.ok) {
        toast.success('Dashboard deleted');
        setCurrentDashboard(null);
        setWidgets([]);
        fetchDashboards();
      } else {
        toast.error('Failed to delete dashboard');
      }
    } catch (error) {
      toast.error('Failed to delete dashboard');
    }
  };

  const addFilter = () => {
    if (fields.length === 0) return;
    
    const newFilter = {
      id: `filter-${Date.now()}`,
      variable: fields[0]?.id || '',
      label: fields[0]?.label || 'Filter',
      type: 'select'
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (filterId, updates) => {
    setFilters(filters.map(f => f.id === filterId ? { ...f, ...updates } : f));
  };

  const removeFilter = (filterId) => {
    setFilters(filters.filter(f => f.id !== filterId));
    const newApplied = { ...appliedFilters };
    delete newApplied[filterId];
    setAppliedFilters(newApplied);
  };

  const renderWidgetContent = (widget) => {
    const data = widgetData[widget.id];
    
    if (!data && widget.type !== 'text') {
      return (
        <div className="flex items-center justify-center h-full text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          Loading...
        </div>
      );
    }

    if (data?.error) {
      return (
        <div className="flex items-center justify-center h-full text-red-400 text-sm">
          {data.error}
        </div>
      );
    }

    switch (widget.type) {
      case 'stat':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-4xl font-bold text-slate-900">{data?.value ?? '-'}</span>
            <span className="text-sm text-slate-500 mt-1">{data?.label || widget.config.stat_type}</span>
          </div>
        );

      case 'chart':
        const chartData = data?.data || [];
        const chartType = widget.config.chart_type || 'bar';
        const isClickable = !previewMode && widget.config?.variable;

        if (chartType === 'pie' || chartType === 'donut') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={chartType === 'donut' ? '40%' : 0}
                  outerRadius="70%"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  onClick={isClickable ? (entry) => handleDrillDown(widget, entry) : undefined}
                  cursor={isClickable ? 'pointer' : 'default'}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      style={isClickable ? { cursor: 'pointer' } : {}}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          );
        }

        if (chartType === 'line') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} onClick={isClickable ? (e) => e?.activePayload && handleDrillDown(widget, e.activePayload[0]) : undefined}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#0ea5e9" 
                  strokeWidth={2}
                  activeDot={isClickable ? { r: 8, cursor: 'pointer' } : { r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          );
        }

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} onClick={isClickable ? (e) => e?.activePayload && handleDrillDown(widget, e.activePayload[0]) : undefined}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar 
                dataKey="value" 
                fill="#0ea5e9" 
                radius={[4, 4, 0, 0]}
                cursor={isClickable ? 'pointer' : 'default'}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'table':
        const columns = data?.columns || [];
        const rows = data?.rows || [];
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-2 py-1 text-left font-medium text-slate-600">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-t">
                    {columns.map(col => (
                      <td key={col} className="px-2 py-1 text-slate-700">{String(row[col] ?? '-')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.total > 10 && (
              <p className="text-xs text-slate-400 p-2">Showing 10 of {data.total} rows</p>
            )}
          </div>
        );

      case 'text':
        return (
          <div className="p-2 text-sm text-slate-700">
            {widget.config.content || 'Enter text content...'}
          </div>
        );

      default:
        return null;
    }
  };

  const layout = widgets.map(widget => ({
    i: widget.id,
    x: widget.position?.x || 0,
    y: widget.position?.y || 0,
    w: widget.position?.w || 4,
    h: widget.position?.h || 3,
    minW: 2,
    minH: 2
  }));

  // Dashboard list view
  if (!currentDashboard) {
    return (
      <div className="space-y-6" data-testid="dashboard-builder">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              Dashboard Builder
            </h2>
            <p className="text-sm text-slate-500">Create interactive dashboards with widgets</p>
          </div>
          <Dialog open={showCreateDashboard} onOpenChange={setShowCreateDashboard}>
            <DialogTrigger asChild>
              <Button data-testid="create-dashboard-btn">
                <Plus className="h-4 w-4 mr-2" />
                New Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Dashboard</DialogTitle>
                <DialogDescription>Create a new interactive dashboard</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Dashboard Name</Label>
                  <Input
                    value={newDashboard.name}
                    onChange={e => setNewDashboard({ ...newDashboard, name: e.target.value })}
                    placeholder="My Dashboard"
                    data-testid="dashboard-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newDashboard.description}
                    onChange={e => setNewDashboard({ ...newDashboard, description: e.target.value })}
                    placeholder="Optional description..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={newDashboard.theme} onValueChange={v => setNewDashboard({ ...newDashboard, theme: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDashboard(false)}>Cancel</Button>
                <Button onClick={createDashboard} disabled={loading} data-testid="create-dashboard-submit">
                  {loading ? 'Creating...' : 'Create Dashboard'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {dashboards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map(dashboard => (
              <Card 
                key={dashboard.id} 
                className="bg-card border border-border cursor-pointer hover:border-sky-400 hover:shadow-md transition-all"
                onClick={() => selectDashboard(dashboard.id)}
                data-testid={`dashboard-card-${dashboard.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-foreground">{dashboard.name}</CardTitle>
                    <Badge variant="outline">{dashboard.theme}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {dashboard.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{dashboard.widgets?.length || 0} widgets</span>
                    <span>{new Date(dashboard.updated_at || dashboard.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-slate-500">
                <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No dashboards yet</p>
                <p className="text-sm">Create your first dashboard to get started</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Dashboard editor view
  return (
    <div className="space-y-4" data-testid="dashboard-editor">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border rounded-lg p-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentDashboard(null)}>
            <X className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h3 className="font-medium">{currentDashboard.name}</h3>
          {currentDashboard.description && (
            <span className="text-sm text-slate-500">- {currentDashboard.description}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={previewMode ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-1" />
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Dialog open={showAddWidget} onOpenChange={setShowAddWidget}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-widget-btn">
                <Plus className="h-4 w-4 mr-1" />
                Add Widget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Widget</DialogTitle>
                <DialogDescription>Choose a widget type and configure it</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Widget Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {WIDGET_TYPES.map(type => (
                      <div
                        key={type.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          newWidget.type === type.id ? 'border-sky-500 bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setNewWidget({ ...newWidget, type: type.id, config: {} })}
                      >
                        <type.icon className="h-5 w-5 mb-1 text-slate-600" />
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-xs text-slate-500">{type.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={newWidget.title}
                    onChange={e => setNewWidget({ ...newWidget, title: e.target.value })}
                    placeholder="Widget title..."
                    data-testid="widget-title-input"
                  />
                </div>

                {newWidget.type === 'stat' && (
                  <>
                    <div className="space-y-2">
                      <Label>Variable</Label>
                      <Select
                        value={newWidget.config.variable || ''}
                        onValueChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, variable: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select variable..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.filter(f => f.type === 'number').map(field => (
                            <SelectItem key={field.id} value={field.id}>{field.label || field.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Statistic</Label>
                      <Select
                        value={newWidget.config.stat_type || 'count'}
                        onValueChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, stat_type: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAT_TYPES.map(stat => (
                            <SelectItem key={stat.value} value={stat.value}>{stat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {newWidget.type === 'chart' && (
                  <>
                    <div className="space-y-2">
                      <Label>Chart Type</Label>
                      <Select
                        value={newWidget.config.chart_type || 'bar'}
                        onValueChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, chart_type: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHART_TYPES.map(ct => (
                            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Variable</Label>
                      <Select
                        value={newWidget.config.variable || ''}
                        onValueChange={v => setNewWidget({ ...newWidget, config: { ...newWidget.config, variable: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select variable..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map(field => (
                            <SelectItem key={field.id} value={field.id}>{field.label || field.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {newWidget.type === 'table' && (
                  <div className="space-y-2">
                    <Label>Columns (comma-separated)</Label>
                    <Input
                      value={newWidget.config.columns?.join(', ') || ''}
                      onChange={e => setNewWidget({ 
                        ...newWidget, 
                        config: { ...newWidget.config, columns: e.target.value.split(',').map(c => c.trim()).filter(Boolean) } 
                      })}
                      placeholder="age, gender, satisfaction..."
                    />
                  </div>
                )}

                {newWidget.type === 'text' && (
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <textarea
                      className="w-full border rounded-md p-2 text-sm min-h-[100px]"
                      value={newWidget.config.content || ''}
                      onChange={e => setNewWidget({ ...newWidget, config: { ...newWidget.config, content: e.target.value } })}
                      placeholder="Enter text content..."
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddWidget(false)}>Cancel</Button>
                <Button onClick={addWidget} data-testid="add-widget-submit">Add Widget</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={saveDashboard} disabled={loading}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
          <Button variant="destructive" size="sm" onClick={deleteDashboard}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      {filters.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-slate-600 flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filters:
            </span>
            {filters.map(filter => (
              <div key={filter.id} className="flex items-center gap-2">
                <Select
                  value={appliedFilters[filter.variable] || ''}
                  onValueChange={v => setAppliedFilters({ ...appliedFilters, [filter.variable]: v })}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {(filterOptions[filter.variable]?.options || []).map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!previewMode && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFilter(filter.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {!previewMode && (
              <Button variant="outline" size="sm" className="h-8" onClick={addFilter}>
                <Plus className="h-3 w-3 mr-1" />
                Add Filter
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Drill-Down Indicator */}
      {drillDownSource && (
        <Card className="p-3 bg-sky-50 border-sky-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-sky-600" />
              <span className="text-sm font-medium text-sky-800">Drill-down active:</span>
              <Badge className="bg-sky-100 text-sky-700">
                {drillDownSource.variable} = "{drillDownSource.value}"
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={clearDrillDown} className="text-sky-600 hover:text-sky-800">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          <p className="text-xs text-sky-600 mt-1">Click on another chart element to change filter, or click Clear to remove</p>
        </Card>
      )}

      {/* Widget Grid */}
      <div className="bg-slate-50 border rounded-lg p-4 min-h-[500px]">
        {widgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={1200}
            onLayoutChange={onLayoutChange}
            isDraggable={!previewMode}
            isResizable={!previewMode}
            draggableHandle=".drag-handle"
          >
            {widgets.map(widget => (
              <div key={widget.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
                  {!previewMode && (
                    <GripVertical className="h-4 w-4 text-slate-400 drag-handle cursor-move" />
                  )}
                  <span className="text-sm font-medium text-slate-700 flex-1 px-2 truncate">{widget.title}</span>
                  {!previewMode && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeWidget(widget.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="p-2 h-[calc(100%-40px)]">
                  {renderWidgetContent(widget)}
                </div>
              </div>
            ))}
          </GridLayout>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
            <LayoutDashboard className="h-12 w-12 mb-4 opacity-50" />
            <p>No widgets yet</p>
            <p className="text-sm">Click "Add Widget" to get started</p>
          </div>
        )}
      </div>

      {/* Share Dialog - Enhanced */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Dashboard</DialogTitle>
            <DialogDescription>Configure sharing and permission settings</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="link" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="link">Link Sharing</TabsTrigger>
              <TabsTrigger value="users">User Access</TabsTrigger>
              <TabsTrigger value="embed">Embed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="link" className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Public Access</p>
                  <p className="text-sm text-slate-500">Anyone with the link can view</p>
                </div>
                <Switch 
                  checked={shareSettings.public}
                  onCheckedChange={(checked) => setShareSettings({...shareSettings, public: checked})}
                />
              </div>
              
              {shareSettings.public && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-medium">Password Protection</p>
                      <p className="text-sm text-amber-600">Require password to view</p>
                    </div>
                    <Switch 
                      checked={shareSettings.passwordProtected}
                      onCheckedChange={(checked) => setShareSettings({...shareSettings, passwordProtected: checked})}
                    />
                  </div>
                  
                  {shareSettings.passwordProtected && (
                    <div>
                      <Label>Password</Label>
                      <Input 
                        type="password" 
                        value={shareSettings.password}
                        onChange={(e) => setShareSettings({...shareSettings, password: e.target.value})}
                        placeholder="Enter password"
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={`${window.location.origin}/dashboard/view/${currentDashboard?.id}`} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/dashboard/view/${currentDashboard?.id}`);
                      toast.success('Link copied!');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="users" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Add Users</Label>
                <div className="flex gap-2">
                  <Input 
                    value={newShareEmail}
                    onChange={(e) => setNewShareEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1"
                  />
                  <Select value={newShareRole} onValueChange={setNewShareRole}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (newShareEmail) {
                        setShareSettings({
                          ...shareSettings,
                          users: [...shareSettings.users, { email: newShareEmail, role: newShareRole }]
                        });
                        setNewShareEmail('');
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Shared With ({shareSettings.users.length})</Label>
                <ScrollArea className="h-[150px] border rounded-lg p-2">
                  {shareSettings.users.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No users added yet</p>
                  ) : (
                    shareSettings.users.map((user, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{user.email}</p>
                          <Badge variant="outline" className="text-xs">{user.role}</Badge>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setShareSettings({
                              ...shareSettings,
                              users: shareSettings.users.filter((_, i) => i !== idx)
                            });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
              
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <p><strong>Viewer:</strong> Can view dashboard and apply filters</p>
                <p><strong>Editor:</strong> Can modify widgets and settings</p>
              </div>
            </TabsContent>
            
            <TabsContent value="embed" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Embed Code</Label>
                <textarea
                  className="w-full h-24 p-2 font-mono text-xs border rounded-lg bg-slate-50"
                  readOnly
                  value={`<iframe src="${window.location.origin}/embed/dashboard/${currentDashboard?.id}" width="100%" height="600" frameborder="0"></iframe>`}
                />
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(`<iframe src="${window.location.origin}/embed/dashboard/${currentDashboard?.id}" width="100%" height="600" frameborder="0"></iframe>`);
                    toast.success('Embed code copied!');
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Embed Code
                </Button>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                Embed this dashboard in your website or application. The embedded view will respect the sharing permissions set above.
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Cancel</Button>
            <Button onClick={saveShareSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardBuilder;
