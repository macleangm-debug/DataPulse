import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '../components/ui/dialog';
import { 
  LayoutDashboard, 
  Plus, 
  RefreshCw, 
  Settings,
  BarChart3,
  LineChart,
  PieChart,
  Map,
  Table2,
  Gauge,
  Clock,
  Loader2,
  Trash2,
  Edit3
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const WIDGET_TYPES = [
  { id: 'counter', label: 'Counter', icon: Gauge, description: 'Show a single metric' },
  { id: 'line_chart', label: 'Line Chart', icon: LineChart, description: 'Trend over time' },
  { id: 'bar_chart', label: 'Bar Chart', icon: BarChart3, description: 'Compare categories' },
  { id: 'pie_chart', label: 'Pie Chart', icon: PieChart, description: 'Distribution breakdown' },
  { id: 'map', label: 'Map', icon: Map, description: 'Geographic visualization' },
  { id: 'table', label: 'Data Table', icon: Table2, description: 'Tabular data' },
];

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Widget Renderer Component
const WidgetRenderer = ({ widget, data }) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  switch (widget.type) {
    case 'counter':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-4xl font-bold text-primary">{data.total || 0}</span>
          <span className="text-sm text-muted-foreground mt-1">{widget.title}</span>
        </div>
      );

    case 'line_chart':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLine data={data.trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </RechartsLine>
        </ResponsiveContainer>
      );

    case 'bar_chart':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.trend || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie_chart':
      const pieData = data.distribution || [
        { name: 'Completed', value: data.total || 0 },
        { name: 'Pending', value: Math.max(0, 100 - (data.total || 0)) }
      ];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPie>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            />
          </RechartsPie>
        </ResponsiveContainer>
      );

    case 'map':
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <Map className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{data.points?.length || 0} locations</p>
          </div>
        </div>
      );

    case 'table':
      return (
        <div className="overflow-auto h-full text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground">Date</th>
                <th className="text-right p-2 text-muted-foreground">Count</th>
              </tr>
            </thead>
            <tbody>
              {(data.trend || []).slice(-5).map((row, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="p-2">{row.date}</td>
                  <td className="text-right p-2">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Unknown widget type
        </div>
      );
  }
};

export default function RealtimeDashboardPage() {
  const { currentOrg } = useOrgStore();
  const [dashboards, setDashboards] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [dashboardData, setDashboardData] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addWidgetDialogOpen, setAddWidgetDialogOpen] = useState(false);
  
  // Form states
  const [newDashboard, setNewDashboard] = useState({ name: '', description: '', refresh_interval: 30 });
  const [newWidget, setNewWidget] = useState({ 
    type: 'counter', 
    title: '', 
    data_source: 'submissions',
    filters: {},
    position: { x: 0, y: 0, w: 4, h: 3 }
  });

  const getAuthHeaders = useCallback(() => {
    let token = localStorage.getItem('access_token');
    if (!token) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token || null;
        } catch (e) {}
      }
    }
    if (!token) token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const loadDashboards = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/realtime/dashboards?org_id=${currentOrg.id}`, {
        headers: getAuthHeaders()
      });
      if (r.ok) {
        const data = await r.json();
        setDashboards(data.dashboards || []);
        if (data.dashboards?.length > 0 && !selectedDashboard) {
          setSelectedDashboard(data.dashboards[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load dashboards:', e);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, selectedDashboard, getAuthHeaders]);

  const loadDashboardData = useCallback(async () => {
    if (!selectedDashboard?.id) return;
    try {
      const r = await fetch(`${API_URL}/api/realtime/dashboards/${selectedDashboard.id}/data`, {
        headers: getAuthHeaders()
      });
      if (r.ok) {
        const data = await r.json();
        setDashboardData(data.data || {});
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  }, [selectedDashboard?.id, getAuthHeaders]);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  useEffect(() => {
    loadDashboardData();
    
    // Set up auto-refresh
    if (selectedDashboard?.refresh_interval) {
      const interval = setInterval(loadDashboardData, selectedDashboard.refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [selectedDashboard, loadDashboardData]);

  const createDashboard = async () => {
    if (!newDashboard.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }
    
    try {
      const r = await fetch(`${API_URL}/api/realtime/dashboards?org_id=${currentOrg.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...newDashboard, widgets: [] })
      });
      
      if (r.ok) {
        toast.success('Dashboard created');
        setCreateDialogOpen(false);
        setNewDashboard({ name: '', description: '', refresh_interval: 30 });
        loadDashboards();
      } else {
        toast.error('Failed to create dashboard');
      }
    } catch (e) {
      toast.error('Failed to create dashboard');
    }
  };

  const addWidget = async () => {
    if (!newWidget.title.trim()) {
      toast.error('Widget title is required');
      return;
    }
    
    try {
      const updatedWidgets = [
        ...(selectedDashboard.widgets || []),
        { ...newWidget, id: `widget-${Date.now()}` }
      ];
      
      const r = await fetch(`${API_URL}/api/realtime/dashboards/${selectedDashboard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ ...selectedDashboard, widgets: updatedWidgets })
      });
      
      if (r.ok) {
        toast.success('Widget added');
        setAddWidgetDialogOpen(false);
        setNewWidget({ type: 'counter', title: '', data_source: 'submissions', filters: {}, position: { x: 0, y: 0, w: 4, h: 3 } });
        setSelectedDashboard({ ...selectedDashboard, widgets: updatedWidgets });
        loadDashboardData();
      } else {
        toast.error('Failed to add widget');
      }
    } catch (e) {
      toast.error('Failed to add widget');
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="realtime-dashboard-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="h-6 w-6 text-blue-400" />
              Real-time Dashboards
            </h1>
            <p className="text-muted-foreground mt-1">
              Live data visualization with custom widgets
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="create-dashboard-btn">
              <Plus className="h-4 w-4 mr-2" />
              New Dashboard
            </Button>
          </div>
        </div>

        {/* Dashboard Selector */}
        <div className="flex items-center gap-4">
          <Select 
            value={selectedDashboard?.id || ''} 
            onValueChange={(id) => {
              const dash = dashboards.find(d => d.id === id);
              setSelectedDashboard(dash);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a dashboard" />
            </SelectTrigger>
            <SelectContent>
              {dashboards.map((dash) => (
                <SelectItem key={dash.id} value={dash.id}>
                  {dash.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedDashboard && (
            <>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Refreshes every {selectedDashboard.refresh_interval}s
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAddWidgetDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Widget
              </Button>
            </>
          )}
        </div>

        {/* Dashboard Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : !selectedDashboard ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12">
              <div className="text-center">
                <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No dashboards yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first dashboard to start visualizing data
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => setCreateDialogOpen(true)}
                >
                  Create Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : selectedDashboard.widgets?.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No widgets yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add widgets to visualize your data
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => setAddWidgetDialogOpen(true)}
                >
                  Add Widget
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedDashboard.widgets.map((widget) => (
              <Card key={widget.id} className="bg-card border-border">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {widget.type.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="h-48 px-4 pb-4">
                  <WidgetRenderer 
                    widget={widget} 
                    data={dashboardData[widget.id]} 
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dashboard Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Dashboard</DialogTitle>
              <DialogDescription>Create a new real-time dashboard</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Dashboard Name</Label>
                <Input
                  value={newDashboard.name}
                  onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value })}
                  placeholder="e.g., Survey Progress"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newDashboard.description}
                  onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value })}
                  placeholder="Brief description"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Refresh Interval (seconds)</Label>
                <Input
                  type="number"
                  value={newDashboard.refresh_interval}
                  onChange={(e) => setNewDashboard({ ...newDashboard, refresh_interval: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={300}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={createDashboard}>Create Dashboard</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Widget Dialog */}
        <Dialog open={addWidgetDialogOpen} onOpenChange={setAddWidgetDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Widget</DialogTitle>
              <DialogDescription>Add a new widget to your dashboard</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Widget Title</Label>
                <Input
                  value={newWidget.title}
                  onChange={(e) => setNewWidget({ ...newWidget, title: e.target.value })}
                  placeholder="e.g., Total Submissions"
                />
              </div>
              <div className="space-y-2">
                <Label>Widget Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {WIDGET_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setNewWidget({ ...newWidget, type: type.id })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                        newWidget.type === type.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <type.icon className="h-5 w-5" />
                      <span className="text-xs">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data Source</Label>
                <Select
                  value={newWidget.data_source}
                  onValueChange={(v) => setNewWidget({ ...newWidget, data_source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submissions">Submissions</SelectItem>
                    <SelectItem value="quality">Quality Scores</SelectItem>
                    <SelectItem value="locations">Locations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddWidgetDialogOpen(false)}>Cancel</Button>
              <Button onClick={addWidget}>Add Widget</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
