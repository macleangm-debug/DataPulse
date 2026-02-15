import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GridLayout from 'react-grid-layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Plus,
  Save,
  ArrowLeft,
  Trash2,
  Settings,
  BarChart3,
  PieChart,
  LineChart,
  Hash,
  Table2,
  Type,
  GripVertical,
  X,
  Database
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { Badge } from '../components/ui/badge';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart as ReLineChart,
  Line
} from 'recharts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const WIDGET_TYPES = [
  { type: 'stat', label: 'Stat Card', icon: Hash, desc: 'Show a single metric' },
  { type: 'chart', label: 'Chart', icon: BarChart3, desc: 'Visualize data' },
  { type: 'table', label: 'Data Table', icon: Table2, desc: 'Show data rows' },
  { type: 'text', label: 'Text Block', icon: Type, desc: 'Add rich text' },
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Chart', icon: LineChart },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
];

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

// Widget Component
function DashboardWidget({ widget, data, onEdit, onDelete }) {
  const renderContent = () => {
    if (!data) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <Database className="w-8 h-8 opacity-50" />
        </div>
      );
    }

    switch (widget.type) {
      case 'stat':
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <p className="text-4xl font-bold text-foreground">
              {typeof data.value === 'number' ? data.value.toLocaleString() : data.value}
            </p>
            <p className="text-sm text-muted-foreground capitalize">{data.aggregation}</p>
          </div>
        );

      case 'chart':
        const chartType = widget.config?.chart_type || 'bar';
        if (!Array.isArray(data) || data.length === 0) {
          return <div className="h-full flex items-center justify-center text-muted-foreground">No data</div>;
        }
        
        if (chartType === 'pie') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          );
        } else if (chartType === 'line') {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </ReLineChart>
            </ResponsiveContainer>
          );
        } else {
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          );
        }

      case 'table':
        if (!Array.isArray(data) || data.length === 0) {
          return <div className="h-full flex items-center justify-center text-muted-foreground">No data</div>;
        }
        const columns = Object.keys(data[0] || {});
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {columns.map(col => (
                    <th key={col} className="text-left p-2 font-medium text-muted-foreground">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    {columns.map(col => (
                      <td key={col} className="p-2 text-foreground">{String(row[col] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'text':
        return (
          <div className="h-full p-2 prose prose-sm dark:prose-invert">
            <p>{widget.config?.content || 'Add some text...'}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden group">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-move drag-handle" />
          <span className="font-medium text-sm text-foreground truncate">{widget.title}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(widget)}>
            <Settings className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(widget.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-hidden">
        {renderContent()}
      </div>
    </Card>
  );
}

export function DashboardBuilderPage() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const { token } = useAuthStore();
  
  const [dashboard, setDashboard] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [widgetData, setWidgetData] = useState({});
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [newWidget, setNewWidget] = useState({
    type: 'stat',
    title: '',
    dataset_id: '',
    config: {}
  });

  useEffect(() => {
    if (dashboardId) {
      fetchDashboardData();
    }
  }, [dashboardId]);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [dashboardRes, widgetsRes, datasetsRes] = await Promise.all([
        axios.get(`${API_URL}/api/dashboards/${dashboardId}`, { headers }),
        axios.get(`${API_URL}/api/dashboards/${dashboardId}/widgets`, { headers }),
        axios.get(`${API_URL}/api/datasets`, { headers })
      ]);
      
      setDashboard(dashboardRes.data);
      setWidgets(widgetsRes.data.widgets || []);
      setDatasets(datasetsRes.data.datasets || []);
      
      // Fetch data for each widget
      const widgetDataPromises = (widgetsRes.data.widgets || []).map(async (w) => {
        try {
          const res = await axios.get(`${API_URL}/api/widgets/${w.id}/data`, { headers });
          return { id: w.id, data: res.data.data };
        } catch {
          return { id: w.id, data: null };
        }
      });
      
      const dataResults = await Promise.all(widgetDataPromises);
      const dataMap = {};
      dataResults.forEach(r => { dataMap[r.id] = r.data; });
      setWidgetData(dataMap);
      
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLayoutChange = async (newLayout) => {
    // Update widget positions
    const updatedWidgets = widgets.map(widget => {
      const layoutItem = newLayout.find(l => l.i === widget.id);
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

  const saveLayout = async () => {
    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const layoutData = widgets.map(w => ({
        id: w.id,
        x: w.position?.x || 0,
        y: w.position?.y || 0,
        w: w.position?.w || 4,
        h: w.position?.h || 3
      }));
      
      await axios.put(`${API_URL}/api/dashboards/${dashboardId}/layout`, {
        widgets: layoutData
      }, { headers });
      
      toast.success('Dashboard saved');
    } catch (error) {
      toast.error('Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  };

  const addWidget = async () => {
    if (!newWidget.title) {
      toast.error('Please enter a widget title');
      return;
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Calculate position for new widget
      const maxY = widgets.reduce((max, w) => 
        Math.max(max, (w.position?.y || 0) + (w.position?.h || 3)), 0);
      
      const widgetData = {
        dashboard_id: dashboardId,
        type: newWidget.type,
        title: newWidget.title,
        dataset_id: newWidget.dataset_id || null,
        config: newWidget.config,
        position: { x: 0, y: maxY, w: 4, h: 3 }
      };
      
      const response = await axios.post(`${API_URL}/api/widgets`, widgetData, { headers });
      
      const createdWidget = {
        id: response.data.id,
        ...widgetData,
        position: response.data.position
      };
      
      setWidgets([...widgets, createdWidget]);
      
      // Fetch data for new widget
      if (newWidget.dataset_id) {
        const dataRes = await axios.get(`${API_URL}/api/widgets/${response.data.id}/data`, { headers });
        setWidgetData(prev => ({ ...prev, [response.data.id]: dataRes.data.data }));
      }
      
      setShowAddWidget(false);
      setNewWidget({ type: 'stat', title: '', dataset_id: '', config: {} });
      toast.success('Widget added');
    } catch (error) {
      toast.error('Failed to add widget');
    }
  };

  const updateWidget = async () => {
    if (!editingWidget) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.put(`${API_URL}/api/widgets/${editingWidget.id}`, {
        dashboard_id: dashboardId,
        type: editingWidget.type,
        title: editingWidget.title,
        dataset_id: editingWidget.dataset_id,
        config: editingWidget.config,
        position: editingWidget.position
      }, { headers });
      
      setWidgets(widgets.map(w => w.id === editingWidget.id ? editingWidget : w));
      
      // Refresh widget data
      if (editingWidget.dataset_id) {
        const dataRes = await axios.get(`${API_URL}/api/widgets/${editingWidget.id}/data`, { headers });
        setWidgetData(prev => ({ ...prev, [editingWidget.id]: dataRes.data.data }));
      }
      
      setEditingWidget(null);
      toast.success('Widget updated');
    } catch (error) {
      toast.error('Failed to update widget');
    }
  };

  const deleteWidget = async (widgetId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/widgets/${widgetId}`, { headers });
      setWidgets(widgets.filter(w => w.id !== widgetId));
      toast.success('Widget deleted');
    } catch (error) {
      toast.error('Failed to delete widget');
    }
  };

  const getSelectedDataset = (datasetId) => {
    return datasets.find(d => d.id === datasetId);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Dashboard not found</p>
          <Button onClick={() => navigate('/dashboards')} className="mt-4">
            Back to Dashboards
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const layout = widgets.map(w => ({
    i: w.id,
    x: w.position?.x || 0,
    y: w.position?.y || 0,
    w: w.position?.w || 4,
    h: w.position?.h || 3,
    minW: 2,
    minH: 2
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="dashboard-builder-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/dashboards')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{dashboard.name}</h1>
              <p className="text-sm text-muted-foreground">{widgets.length} widgets</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowAddWidget(true)} data-testid="add-widget-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Widget
            </Button>
            <Button onClick={saveLayout} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="bg-muted/30 rounded-xl p-4 min-h-[600px]">
          {widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <LayoutDashboard className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No widgets yet</h3>
              <p className="text-muted-foreground mb-4">Add your first widget to start building</p>
              <Button onClick={() => setShowAddWidget(true)} className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Widget
              </Button>
            </div>
          ) : (
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={80}
              width={1200}
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              compactType="vertical"
              preventCollision={false}
            >
              {widgets.map(widget => (
                <div key={widget.id} data-testid={`widget-${widget.id}`}>
                  <DashboardWidget
                    widget={widget}
                    data={widgetData[widget.id]}
                    onEdit={setEditingWidget}
                    onDelete={deleteWidget}
                  />
                </div>
              ))}
            </GridLayout>
          )}
        </div>

        {/* Add Widget Dialog */}
        <Sheet open={showAddWidget} onOpenChange={setShowAddWidget}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Widget</SheetTitle>
            </SheetHeader>
            <div className="space-y-6 mt-6">
              {/* Widget Type Selection */}
              <div className="space-y-3">
                <Label>Widget Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {WIDGET_TYPES.map((wt) => (
                    <button
                      key={wt.type}
                      onClick={() => setNewWidget({ ...newWidget, type: wt.type, config: {} })}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        newWidget.type === wt.type
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                          : 'border-border hover:border-violet-300'
                      }`}
                    >
                      <wt.icon className={`w-5 h-5 mb-2 ${
                        newWidget.type === wt.type ? 'text-violet-600' : 'text-muted-foreground'
                      }`} />
                      <p className="font-medium text-sm text-foreground">{wt.label}</p>
                      <p className="text-xs text-muted-foreground">{wt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Widget Title</Label>
                <Input
                  value={newWidget.title}
                  onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                  placeholder="Enter widget title"
                  data-testid="widget-title-input"
                />
              </div>

              {newWidget.type !== 'text' && (
                <div className="space-y-2">
                  <Label>Data Source</Label>
                  <Select
                    value={newWidget.dataset_id}
                    onValueChange={(v) => setNewWidget({ ...newWidget, dataset_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          {ds.name} ({ds.row_count} rows)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Type-specific config */}
              {newWidget.type === 'stat' && newWidget.dataset_id && (
                <>
                  <div className="space-y-2">
                    <Label>Field</Label>
                    <Select
                      value={newWidget.config.field || ''}
                      onValueChange={(v) => setNewWidget({
                        ...newWidget,
                        config: { ...newWidget.config, field: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSelectedDataset(newWidget.dataset_id)?.columns?.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Aggregation</Label>
                    <Select
                      value={newWidget.config.aggregation || 'count'}
                      onValueChange={(v) => setNewWidget({
                        ...newWidget,
                        config: { ...newWidget.config, aggregation: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                        <SelectItem value="mean">Average</SelectItem>
                        <SelectItem value="max">Maximum</SelectItem>
                        <SelectItem value="min">Minimum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {newWidget.type === 'chart' && newWidget.dataset_id && (
                <>
                  <div className="space-y-2">
                    <Label>Chart Type</Label>
                    <Select
                      value={newWidget.config.chart_type || 'bar'}
                      onValueChange={(v) => setNewWidget({
                        ...newWidget,
                        config: { ...newWidget.config, chart_type: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHART_TYPES.map((ct) => (
                          <SelectItem key={ct.value} value={ct.value}>
                            {ct.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>X-Axis Field</Label>
                    <Select
                      value={newWidget.config.x_field || ''}
                      onValueChange={(v) => setNewWidget({
                        ...newWidget,
                        config: { ...newWidget.config, x_field: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSelectedDataset(newWidget.dataset_id)?.columns?.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Y-Axis Field (optional)</Label>
                    <Select
                      value={newWidget.config.y_field || ''}
                      onValueChange={(v) => setNewWidget({
                        ...newWidget,
                        config: { ...newWidget.config, y_field: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Count" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Count</SelectItem>
                        {getSelectedDataset(newWidget.dataset_id)?.columns
                          ?.filter(c => c.type.includes('int') || c.type.includes('float'))
                          .map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {newWidget.type === 'text' && (
                <div className="space-y-2">
                  <Label>Content</Label>
                  <textarea
                    value={newWidget.config.content || ''}
                    onChange={(e) => setNewWidget({
                      ...newWidget,
                      config: { ...newWidget.config, content: e.target.value }
                    })}
                    placeholder="Enter text content..."
                    className="w-full min-h-[100px] p-3 rounded-lg border bg-background resize-none"
                  />
                </div>
              )}

              <Button onClick={addWidget} className="w-full bg-violet-600 hover:bg-violet-700">
                Add Widget
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Edit Widget Dialog */}
        <Sheet open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Edit Widget</SheetTitle>
            </SheetHeader>
            {editingWidget && (
              <div className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Widget Title</Label>
                  <Input
                    value={editingWidget.title}
                    onChange={(e) => setEditingWidget({ ...editingWidget, title: e.target.value })}
                  />
                </div>

                {editingWidget.type !== 'text' && (
                  <div className="space-y-2">
                    <Label>Data Source</Label>
                    <Select
                      value={editingWidget.dataset_id || ''}
                      onValueChange={(v) => setEditingWidget({ ...editingWidget, dataset_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select dataset" />
                      </SelectTrigger>
                      <SelectContent>
                        {datasets.map((ds) => (
                          <SelectItem key={ds.id} value={ds.id}>
                            {ds.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editingWidget.type === 'stat' && (
                  <>
                    <div className="space-y-2">
                      <Label>Field</Label>
                      <Select
                        value={editingWidget.config?.field || ''}
                        onValueChange={(v) => setEditingWidget({
                          ...editingWidget,
                          config: { ...editingWidget.config, field: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {getSelectedDataset(editingWidget.dataset_id)?.columns?.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Aggregation</Label>
                      <Select
                        value={editingWidget.config?.aggregation || 'count'}
                        onValueChange={(v) => setEditingWidget({
                          ...editingWidget,
                          config: { ...editingWidget.config, aggregation: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="count">Count</SelectItem>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="mean">Average</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {editingWidget.type === 'chart' && (
                  <>
                    <div className="space-y-2">
                      <Label>Chart Type</Label>
                      <Select
                        value={editingWidget.config?.chart_type || 'bar'}
                        onValueChange={(v) => setEditingWidget({
                          ...editingWidget,
                          config: { ...editingWidget.config, chart_type: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHART_TYPES.map((ct) => (
                            <SelectItem key={ct.value} value={ct.value}>
                              {ct.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>X-Axis Field</Label>
                      <Select
                        value={editingWidget.config?.x_field || ''}
                        onValueChange={(v) => setEditingWidget({
                          ...editingWidget,
                          config: { ...editingWidget.config, x_field: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {getSelectedDataset(editingWidget.dataset_id)?.columns?.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {editingWidget.type === 'text' && (
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <textarea
                      value={editingWidget.config?.content || ''}
                      onChange={(e) => setEditingWidget({
                        ...editingWidget,
                        config: { ...editingWidget.config, content: e.target.value }
                      })}
                      className="w-full min-h-[100px] p-3 rounded-lg border bg-background resize-none"
                    />
                  </div>
                )}

                <Button onClick={updateWidget} className="w-full bg-violet-600 hover:bg-violet-700">
                  Save Changes
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
}

export default DashboardBuilderPage;
