import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  Plus,
  Settings2,
  Trash2,
  Save,
  RotateCcw,
  GripVertical,
  BarChart3,
  LineChart,
  PieChart,
  Table,
  Activity,
  Target,
  MapPin,
  X,
  Check
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { toast } from 'sonner';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

// Widget type configurations
const WIDGET_TYPES = {
  stat_card: {
    name: 'Stat Card',
    icon: LayoutGrid,
    defaultSize: { w: 3, h: 2 }
  },
  line_chart: {
    name: 'Line Chart',
    icon: LineChart,
    defaultSize: { w: 6, h: 4 }
  },
  bar_chart: {
    name: 'Bar Chart',
    icon: BarChart3,
    defaultSize: { w: 6, h: 4 }
  },
  pie_chart: {
    name: 'Pie Chart',
    icon: PieChart,
    defaultSize: { w: 4, h: 4 }
  },
  activity_feed: {
    name: 'Activity Feed',
    icon: Activity,
    defaultSize: { w: 4, h: 4 }
  },
  progress: {
    name: 'Progress',
    icon: Target,
    defaultSize: { w: 4, h: 2 }
  },
  table: {
    name: 'Data Table',
    icon: Table,
    defaultSize: { w: 6, h: 4 }
  },
  map: {
    name: 'Map',
    icon: MapPin,
    defaultSize: { w: 6, h: 4 }
  }
};

// Sample data generators
const generateStatData = (metric) => ({
  value: Math.floor(Math.random() * 1000) + 100,
  trend: Math.floor(Math.random() * 30) - 10,
  previousValue: Math.floor(Math.random() * 900) + 100
});

const generateLineData = (days = 14) => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - i - 1) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: Math.floor(Math.random() * 100) + 20
  }));
};

const generateBarData = () => [
  { name: 'Household Survey', value: 234 },
  { name: 'Health Screening', value: 189 },
  { name: 'Customer Feedback', value: 156 },
  { name: 'Event Registration', value: 98 },
  { name: 'Agriculture Survey', value: 67 }
];

const generatePieData = () => [
  { name: 'Approved', value: 65, color: '#22c55e' },
  { name: 'Pending', value: 25, color: '#f59e0b' },
  { name: 'Rejected', value: 10, color: '#ef4444' }
];

const generateActivityData = () => [
  { user: 'John Doe', action: 'submitted', form: 'Household Survey', time: '5 min ago' },
  { user: 'Jane Smith', action: 'approved', form: 'Health Screening', time: '12 min ago' },
  { user: 'Mike Johnson', action: 'submitted', form: 'Customer Feedback', time: '28 min ago' },
  { user: 'Sarah Williams', action: 'rejected', form: 'Event Registration', time: '45 min ago' },
  { user: 'Tom Brown', action: 'submitted', form: 'Agriculture Survey', time: '1 hour ago' }
];

// Widget renderers
const StatCardWidget = ({ title, config }) => {
  const data = generateStatData(config?.metric);
  return (
    <div className="h-full flex flex-col justify-center">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-3xl font-bold text-white">{data.value.toLocaleString()}</p>
      {config?.show_trend && (
        <div className="flex items-center gap-1 mt-2">
          <span className={`text-sm ${data.trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {data.trend >= 0 ? '+' : ''}{data.trend}%
          </span>
          <span className="text-xs text-gray-500">vs last week</span>
        </div>
      )}
    </div>
  );
};

const LineChartWidget = ({ title, config }) => {
  const data = generateLineData(config?.period === '7_days' ? 7 : 14);
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLine data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
            <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </RechartsLine>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const BarChartWidget = ({ title, config }) => {
  const data = generateBarData().slice(0, config?.limit || 5);
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#9CA3AF', fontSize: 10 }} width={100} />
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
            <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const PieChartWidget = ({ title, config }) => {
  const data = generatePieData();
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPie>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
            <Legend />
          </RechartsPie>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const ActivityFeedWidget = ({ title, config }) => {
  const activities = generateActivityData().slice(0, config?.limit || 5);
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex-1 overflow-auto space-y-2">
        {activities.map((activity, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded bg-card/50">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Activity className="w-3 h-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">
                <span className="font-medium">{activity.user}</span>
                {' '}{activity.action}{' '}
                <span className="text-gray-400">{activity.form}</span>
              </p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProgressWidget = ({ title, config }) => {
  const current = Math.floor(Math.random() * 800) + 200;
  const target = config?.target || 1000;
  const percentage = Math.round((current / target) * 100);
  
  return (
    <div className="h-full flex flex-col justify-center">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-bold text-white">{current}</span>
        <span className="text-sm text-gray-500">/ {target}</span>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-gray-500 mt-1">{percentage}% complete</p>
    </div>
  );
};

const TableWidget = ({ title, config }) => {
  const data = [
    ['SUB-001', 'Household Survey', 'Approved', '2024-01-15'],
    ['SUB-002', 'Health Screening', 'Pending', '2024-01-15'],
    ['SUB-003', 'Customer Feedback', 'Approved', '2024-01-14'],
    ['SUB-004', 'Event Registration', 'Rejected', '2024-01-14'],
    ['SUB-005', 'Agriculture Survey', 'Approved', '2024-01-13']
  ].slice(0, config?.limit || 5);
  
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-1 text-gray-500">ID</th>
              <th className="text-left p-1 text-gray-500">Form</th>
              <th className="text-left p-1 text-gray-500">Status</th>
              <th className="text-left p-1 text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="p-1 text-white">{row[0]}</td>
                <td className="p-1 text-white">{row[1]}</td>
                <td className="p-1">
                  <Badge variant={row[2] === 'Approved' ? 'default' : row[2] === 'Pending' ? 'secondary' : 'destructive'} className="text-[10px]">
                    {row[2]}
                  </Badge>
                </td>
                <td className="p-1 text-gray-400">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MapWidget = ({ title, config }) => {
  return (
    <div className="h-full flex flex-col">
      <p className="text-sm text-gray-400 mb-2">{title}</p>
      <div className="flex-1 bg-gray-800 rounded flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm text-gray-400">Map visualization</p>
          <p className="text-xs text-gray-500">Connect to GPS data to populate</p>
        </div>
      </div>
    </div>
  );
};

// Widget renderer component
const WidgetRenderer = ({ widget, onEdit, onDelete, isEditing }) => {
  const renderContent = () => {
    switch (widget.widget_type) {
      case 'stat_card':
        return <StatCardWidget title={widget.title} config={widget.config} />;
      case 'line_chart':
        return <LineChartWidget title={widget.title} config={widget.config} />;
      case 'bar_chart':
        return <BarChartWidget title={widget.title} config={widget.config} />;
      case 'pie_chart':
        return <PieChartWidget title={widget.title} config={widget.config} />;
      case 'activity_feed':
        return <ActivityFeedWidget title={widget.title} config={widget.config} />;
      case 'progress':
        return <ProgressWidget title={widget.title} config={widget.config} />;
      case 'table':
        return <TableWidget title={widget.title} config={widget.config} />;
      case 'map':
        return <MapWidget title={widget.title} config={widget.config} />;
      default:
        return <div className="text-gray-500">Unknown widget type</div>;
    }
  };

  return (
    <Card className="h-full bg-card/50 border-border/50 relative group">
      {isEditing && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(widget)}>
            <Settings2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(widget.id)}>
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      )}
      {isEditing && (
        <div className="absolute top-2 left-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-500" />
        </div>
      )}
      <CardContent className="p-4 h-full">
        {renderContent()}
      </CardContent>
    </Card>
  );
};

// Main CustomDashboard component
export function CustomDashboard({ orgId }) {
  const [widgets, setWidgets] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [orgId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Load default widgets
      setWidgets([
        { id: 'w1', widget_type: 'stat_card', title: 'Total Submissions', config: { metric: 'submissions', show_trend: true }, position: { x: 0, y: 0, w: 3, h: 2 } },
        { id: 'w2', widget_type: 'stat_card', title: 'Active Forms', config: { metric: 'forms', show_trend: true }, position: { x: 3, y: 0, w: 3, h: 2 } },
        { id: 'w3', widget_type: 'stat_card', title: 'Quality Score', config: { metric: 'quality_score', show_trend: true }, position: { x: 6, y: 0, w: 3, h: 2 } },
        { id: 'w4', widget_type: 'stat_card', title: 'Team Members', config: { metric: 'users', show_trend: false }, position: { x: 9, y: 0, w: 3, h: 2 } },
        { id: 'w5', widget_type: 'line_chart', title: 'Submission Trends', config: { metric: 'submissions', period: '14_days' }, position: { x: 0, y: 2, w: 8, h: 4 } },
        { id: 'w6', widget_type: 'activity_feed', title: 'Recent Activity', config: { limit: 5 }, position: { x: 8, y: 2, w: 4, h: 4 } },
        { id: 'w7', widget_type: 'bar_chart', title: 'Submissions by Form', config: { metric: 'submissions_by_form', limit: 5 }, position: { x: 0, y: 6, w: 6, h: 4 } },
        { id: 'w8', widget_type: 'pie_chart', title: 'Status Distribution', config: { metric: 'status_distribution' }, position: { x: 6, y: 6, w: 6, h: 4 } }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWidget = (widgetType) => {
    const typeConfig = WIDGET_TYPES[widgetType];
    const newWidget = {
      id: `w${Date.now()}`,
      widget_type: widgetType,
      title: typeConfig.name,
      config: {},
      position: { x: 0, y: 0, ...typeConfig.defaultSize }
    };
    setWidgets([...widgets, newWidget]);
    setAddWidgetOpen(false);
    toast.success('Widget added');
  };

  const handleUpdateWidget = (updatedWidget) => {
    setWidgets(widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w));
    setEditingWidget(null);
    toast.success('Widget updated');
  };

  const handleDeleteWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    toast.success('Widget removed');
  };

  const handleSaveLayout = async () => {
    try {
      // Save to API
      toast.success('Dashboard layout saved');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to save layout');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="custom-dashboard">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="font-barlow text-lg font-semibold text-white">Dashboard Widgets</h2>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setAddWidgetOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Widget
              </Button>
              <Button variant="outline" size="sm" onClick={loadDashboard}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSaveLayout}>
                <Save className="w-4 h-4 mr-1" />
                Save Layout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="customize-dashboard-btn">
              <Settings2 className="w-4 h-4 mr-1" />
              Customize
            </Button>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-12 gap-4 auto-rows-[100px]">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            className="col-span-12 md:col-span-6 lg:col-span-3"
            style={{
              gridColumn: `span ${Math.min(widget.position.w, 12)}`,
              gridRow: `span ${widget.position.h}`
            }}
          >
            <WidgetRenderer
              widget={widget}
              onEdit={setEditingWidget}
              onDelete={handleDeleteWidget}
              isEditing={isEditing}
            />
          </div>
        ))}
      </div>

      {/* Add Widget Dialog */}
      <Dialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Widget</DialogTitle>
            <DialogDescription>Choose a widget type to add to your dashboard</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {Object.entries(WIDGET_TYPES).map(([type, config]) => (
              <Button
                key={type}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleAddWidget(type)}
              >
                <config.icon className="w-6 h-6" />
                <span className="text-sm">{config.name}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Widget Sheet */}
      {editingWidget && (
        <Sheet open={!!editingWidget} onOpenChange={() => setEditingWidget(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Edit Widget</SheetTitle>
              <SheetDescription>Configure widget settings</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingWidget.title}
                  onChange={(e) => setEditingWidget({ ...editingWidget, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Widget Type</Label>
                <p className="text-sm text-gray-400">{WIDGET_TYPES[editingWidget.widget_type]?.name}</p>
              </div>
              <Button className="w-full" onClick={() => handleUpdateWidget(editingWidget)}>
                <Check className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
