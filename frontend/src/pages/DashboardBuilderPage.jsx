/**
 * Dashboard Builder - Drag-and-drop dashboard editor
 * Features: Widget library, chart configuration, real-time preview
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  PieChart,
  LineChart,
  TrendingUp,
  Table,
  Map,
  Plus,
  Save,
  Eye,
  Settings,
  Trash2,
  GripVertical,
  ChevronLeft,
  Palette,
  Database,
  Filter,
  RefreshCw,
  Download,
  Share2,
  Maximize2,
  X,
  Check,
  Layers
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Chart color palettes
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

// Widget types
const WIDGET_TYPES = [
  { id: 'bar', name: 'Bar Chart', icon: BarChart3, category: 'chart' },
  { id: 'line', name: 'Line Chart', icon: LineChart, category: 'chart' },
  { id: 'pie', name: 'Pie Chart', icon: PieChart, category: 'chart' },
  { id: 'area', name: 'Area Chart', icon: TrendingUp, category: 'chart' },
  { id: 'stat', name: 'Stat Card', icon: TrendingUp, category: 'stat' },
  { id: 'table', name: 'Data Table', icon: Table, category: 'table' },
];

// Sample data for preview
const SAMPLE_DATA = [
  { name: 'Mon', value: 400 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 600 },
  { name: 'Thu', value: 800 },
  { name: 'Fri', value: 500 },
  { name: 'Sat', value: 200 },
  { name: 'Sun', value: 350 },
];

// Chart Preview Component
const ChartPreview = ({ type, data, title, colors = CHART_COLORS }) => {
  const chartData = data?.length > 0 ? data : SAMPLE_DATA;

  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ fill: colors[0] }} />
          </RechartsLineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Area type="monotone" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      );

    case 'stat':
      const total = chartData.reduce((sum, item) => sum + item.value, 0);
      return (
        <div className="h-full flex flex-col items-center justify-center">
          <p className="text-4xl font-bold text-foreground">{total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">{title || 'Total'}</p>
        </div>
      );

    default:
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Select a chart type
        </div>
      );
  }
};

// Widget Card Component
const WidgetCard = ({ widget, onEdit, onDelete, onResize }) => {
  return (
    <Card className="h-full bg-card border-border hover:border-primary/30 transition-colors group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-move opacity-0 group-hover:opacity-100" />
          <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(widget)}>
            <Settings className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(widget.id)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ChartPreview type={widget.chart_type} data={widget.data} title={widget.title} />
      </CardContent>
    </Card>
  );
};

// Widget Library Panel
const WidgetLibrary = ({ onAddWidget }) => {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Add Widget</h3>
      <div className="grid grid-cols-2 gap-2">
        {WIDGET_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => onAddWidget(type)}
              className="p-3 rounded-lg border border-border bg-card hover:bg-muted hover:border-primary/50 transition-all text-left"
            >
              <Icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm font-medium text-foreground">{type.name}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Widget Config Panel
const WidgetConfigPanel = ({ widget, forms, fields, onUpdate, onClose }) => {
  const [config, setConfig] = useState(widget);

  const handleSave = () => {
    onUpdate(config);
    onClose();
  };

  return (
    <Sheet open={!!widget} onOpenChange={() => onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Configure Widget</SheetTitle>
          <SheetDescription>Customize your chart settings</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Title */}
          <div className="space-y-2">
            <Label>Widget Title</Label>
            <Input
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder="Enter title"
            />
          </div>

          {/* Chart Type */}
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <Select
              value={config.chart_type}
              onValueChange={(value) => setConfig({ ...config, chart_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select chart type" />
              </SelectTrigger>
              <SelectContent>
                {WIDGET_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Source */}
          <div className="space-y-2">
            <Label>Data Source (Form)</Label>
            <Select
              value={config.data_source}
              onValueChange={(value) => setConfig({ ...config, data_source: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Selection */}
          {config.data_source && config.data_source !== 'all' && (
            <div className="space-y-2">
              <Label>Field to Visualize</Label>
              <Select
                value={config.field}
                onValueChange={(value) => setConfig({ ...config, field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.name} value={field.name}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aggregation */}
          <div className="space-y-2">
            <Label>Aggregation</Label>
            <Select
              value={config.aggregation}
              onValueChange={(value) => setConfig({ ...config, aggregation: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select aggregation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="sum">Sum</SelectItem>
                <SelectItem value="avg">Average</SelectItem>
                <SelectItem value="min">Minimum</SelectItem>
                <SelectItem value="max">Maximum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="h-48 rounded-lg border border-border bg-muted/30 p-4">
              <ChartPreview type={config.chart_type} data={SAMPLE_DATA} title={config.title} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>
            <Check className="w-4 h-4 mr-2" />
            Apply
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Main Dashboard Builder
export default function DashboardBuilderPage() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();

  const [dashboard, setDashboard] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forms, setForms] = useState([]);
  const [fields, setFields] = useState([]);
  const [editingWidget, setEditingWidget] = useState(null);
  const [showLibrary, setShowLibrary] = useState(true);

  useEffect(() => {
    if (dashboardId && currentOrg) {
      loadDashboard();
      loadForms();
    }
  }, [dashboardId, currentOrg]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/dashboards/${dashboardId}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setDashboard(data);
      setWidgets(data.widgets || []);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadForms = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/forms/list?org_id=${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setForms(data.forms || []);
    } catch (err) {
      console.error('Failed to load forms:', err);
    }
  };

  const loadFormFields = async (formId) => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/forms/${formId}/fields`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setFields(data.fields || []);
    } catch (err) {
      console.error('Failed to load fields:', err);
    }
  };

  const handleAddWidget = (type) => {
    const newWidget = {
      id: `widget_${Date.now()}`,
      type: type.category,
      chart_type: type.id,
      title: `New ${type.name}`,
      data_source: '',
      field: '',
      aggregation: 'count',
      position: { x: 0, y: 0, w: 4, h: 3 },
      data: []
    };
    setWidgets([...widgets, newWidget]);
    setEditingWidget(newWidget);
  };

  const handleUpdateWidget = (updatedWidget) => {
    setWidgets(widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w));
  };

  const handleDeleteWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/api/dataviz/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ widgets })
      });
      toast.success('Dashboard saved');
    } catch (err) {
      toast.error('Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dataviz')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground">{dashboard?.name || 'Dashboard Builder'}</h1>
            <p className="text-xs text-muted-foreground">Edit Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dataviz/view/${dashboardId}`)}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <aside className={cn(
          "w-64 border-r border-border bg-card p-4 transition-all",
          !showLibrary && "w-0 p-0 overflow-hidden"
        )}>
          <WidgetLibrary onAddWidget={handleAddWidget} />
        </aside>

        {/* Canvas */}
        <main className="flex-1 p-6 overflow-auto">
          {widgets.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No widgets yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add widgets from the library to build your dashboard
                </p>
                <Button onClick={() => setShowLibrary(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Widget
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4 auto-rows-[150px]">
              {widgets.map((widget) => (
                <div
                  key={widget.id}
                  className="col-span-4 row-span-2"
                  style={{
                    gridColumn: `span ${widget.position?.w || 4}`,
                    gridRow: `span ${widget.position?.h || 2}`
                  }}
                >
                  <WidgetCard
                    widget={widget}
                    onEdit={setEditingWidget}
                    onDelete={handleDeleteWidget}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Widget Config Panel */}
      {editingWidget && (
        <WidgetConfigPanel
          widget={editingWidget}
          forms={forms}
          fields={fields}
          onUpdate={handleUpdateWidget}
          onClose={() => setEditingWidget(null)}
        />
      )}
    </div>
  );
}
