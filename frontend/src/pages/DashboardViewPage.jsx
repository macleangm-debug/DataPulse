/**
 * Dashboard View Page - Read-only dashboard viewer
 * Features: Full-screen view, auto-refresh, export options
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ChevronLeft,
  Edit3,
  Download,
  Share2,
  RefreshCw,
  Maximize2,
  Clock,
  Filter,
  Calendar
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Chart colors
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

// Sample data
const SAMPLE_DATA = [
  { name: 'Mon', value: 400 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 600 },
  { name: 'Thu', value: 800 },
  { name: 'Fri', value: 500 },
  { name: 'Sat', value: 200 },
  { name: 'Sun', value: 350 },
];

// Chart Component
const ChartWidget = ({ widget }) => {
  const data = widget.data?.length > 0 ? widget.data : SAMPLE_DATA;
  const colors = widget.colors || CHART_COLORS;

  switch (widget.chart_type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} name={widget.title} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={colors[0]} 
              strokeWidth={2} 
              dot={{ fill: colors[0] }}
              name={widget.title}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#f3f4f6' }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={colors[0]} 
              fill={colors[0]} 
              fillOpacity={0.3}
              name={widget.title}
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'stat':
      const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
      const change = 12; // Placeholder for trend
      return (
        <div className="h-full flex flex-col items-center justify-center">
          <p className="text-5xl font-bold text-foreground">{total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-2">{widget.title}</p>
          <Badge variant={change >= 0 ? "default" : "destructive"} className="mt-2">
            {change >= 0 ? '+' : ''}{change}% from last period
          </Badge>
        </div>
      );

    default:
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          Unknown chart type
        </div>
      );
  }
};

// Widget Card
const DashboardWidget = ({ widget }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full"
    >
      <Card className="h-full bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">
              {widget.title}
            </CardTitle>
            {widget.data_source && (
              <Badge variant="outline" className="text-xs">
                {widget.aggregation}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-60px)]">
          <ChartWidget widget={widget} />
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function DashboardViewPage() {
  const { dashboardId } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    if (dashboardId) {
      loadDashboard();
    }
  }, [dashboardId]);

  // Auto-refresh
  useEffect(() => {
    if (dashboard?.refresh_interval && dashboard.refresh_interval > 0) {
      const interval = setInterval(() => {
        loadDashboardData();
      }, dashboard.refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [dashboard?.refresh_interval]);

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
      setLastUpdated(new Date());
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setRefreshing(true);
    // In a real implementation, this would fetch fresh data for each widget
    await loadDashboard();
    setRefreshing(false);
  };

  const handleExport = async (format) => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/dashboards/${dashboardId}/export?format=${format}`,
        { method: 'POST', headers: getAuthHeaders() }
      );
      const data = await res.json();
      toast.success(`Export started: ${format.toUpperCase()}`);
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground">Dashboard not found</h2>
          <Button className="mt-4" onClick={() => navigate('/dataviz')}>
            Go to DataViz Studio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-background",
      isFullscreen && "p-0"
    )}>
      {/* Header */}
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dataviz')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground flex items-center gap-2">
              {dashboard.name}
              {dashboard.is_public && <Badge variant="secondary">Public</Badge>}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Filter */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button variant="outline" size="icon" onClick={loadDashboardData} disabled={refreshing}>
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>

          {/* Fullscreen */}
          <Button variant="outline" size="icon" onClick={toggleFullscreen}>
            <Maximize2 className="w-4 h-4" />
          </Button>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Download className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('png')}>
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit */}
          <Button variant="outline" onClick={() => navigate(`/dataviz/builder/${dashboardId}`)}>
            <Edit3 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="p-6">
        {dashboard.widgets?.length === 0 ? (
          <div className="h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No widgets in this dashboard</h3>
              <p className="text-muted-foreground mb-4">
                Add widgets in the builder to visualize your data
              </p>
              <Button onClick={() => navigate(`/dataviz/builder/${dashboardId}`)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Open Builder
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4 auto-rows-[180px]">
            {dashboard.widgets.map((widget, idx) => (
              <div
                key={widget.id || idx}
                className="col-span-4 row-span-2"
                style={{
                  gridColumn: `span ${widget.position?.w || 4}`,
                  gridRow: `span ${widget.position?.h || 2}`
                }}
              >
                <DashboardWidget widget={widget} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
