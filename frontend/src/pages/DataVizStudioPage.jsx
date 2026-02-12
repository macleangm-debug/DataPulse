/**
 * DataViz Studio - Analytics & Visualization Platform
 * Main hub for creating and managing dashboards
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  PieChart,
  LineChart,
  Plus,
  Search,
  MoreVertical,
  Edit3,
  Trash2,
  Copy,
  Share2,
  Eye,
  Layout,
  TrendingUp,
  Users,
  FileText,
  Clock,
  Star,
  Sparkles,
  ArrowRight,
  Grid3X3,
  Table,
  Map
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dashboard templates
const TEMPLATES = [
  {
    id: 'submission-overview',
    name: 'Submission Overview',
    description: 'Track submission volume and trends',
    icon: BarChart3,
    color: 'from-blue-500 to-indigo-600'
  },
  {
    id: 'data-quality',
    name: 'Data Quality Monitor',
    description: 'Monitor data quality metrics',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-600'
  },
  {
    id: 'field-team',
    name: 'Field Team Performance',
    description: 'Track enumerator productivity',
    icon: Users,
    color: 'from-purple-500 to-pink-600'
  },
  {
    id: 'geographic',
    name: 'Geographic Analysis',
    description: 'Visualize data on maps',
    icon: Map,
    color: 'from-orange-500 to-red-600'
  }
];

// Stats Card Component
const StatCard = ({ title, value, icon: Icon, trend, color }) => (
  <Card className="bg-card border-border hover:border-primary/30 transition-colors">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last week
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Dashboard Card Component
const DashboardCard = ({ dashboard, onView, onEdit, onDuplicate, onDelete }) => {
  const widgetIcons = {
    chart: BarChart3,
    stat: TrendingUp,
    table: Table,
    map: Map
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Layout className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground group-hover:text-primary transition-colors">
                  {dashboard.name}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {dashboard.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView(dashboard.id)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(dashboard.id)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(dashboard)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(dashboard.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent onClick={() => onView(dashboard.id)}>
          <div className="flex items-center gap-2 mb-3">
            {dashboard.widgets?.slice(0, 4).map((widget, idx) => {
              const Icon = widgetIcons[widget.type] || BarChart3;
              return (
                <div key={idx} className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
              );
            })}
            {dashboard.widgets?.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{dashboard.widgets.length - 4} more
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Grid3X3 className="w-3.5 h-3.5" />
              {dashboard.widgets?.length || 0} widgets
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(dashboard.updated_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Template Card Component
const TemplateCard = ({ template, onSelect }) => {
  const Icon = template.icon;
  
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Card 
        className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
        onClick={() => onSelect(template)}
      >
        <div className={`h-24 bg-gradient-to-br ${template.color} flex items-center justify-center`}>
          <Icon className="w-10 h-10 text-white" />
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground">{template.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function DataVizStudioPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDashboard, setNewDashboard] = useState({ name: '', description: '' });

  useEffect(() => {
    if (currentOrg) {
      loadDashboards();
      loadStats();
    }
  }, [currentOrg]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadDashboards = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/dashboards?org_id=${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setDashboards(data.dashboards || []);
    } catch (err) {
      console.error('Failed to load dashboards:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/charts/summary-stats?org_id=${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboard.name.trim()) {
      toast.error('Please enter a dashboard name');
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/dashboards?org_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: newDashboard.name,
            description: newDashboard.description,
            widgets: [],
            layout: 'grid'
          })
        }
      );
      const data = await res.json();
      
      toast.success('Dashboard created');
      setCreateDialogOpen(false);
      setNewDashboard({ name: '', description: '' });
      navigate(`/dataviz/builder/${data.id}`);
    } catch (err) {
      toast.error('Failed to create dashboard');
    }
  };

  const handleSelectTemplate = async (template) => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/dashboards?org_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            widgets: [],
            layout: 'grid'
          })
        }
      );
      const data = await res.json();
      
      toast.success('Dashboard created from template');
      navigate(`/dataviz/builder/${data.id}`);
    } catch (err) {
      toast.error('Failed to create dashboard');
    }
  };

  const handleDeleteDashboard = async (id) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) return;

    try {
      await fetch(`${API_URL}/api/dataviz/dashboards/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      toast.success('Dashboard deleted');
      loadDashboards();
    } catch (err) {
      toast.error('Failed to delete dashboard');
    }
  };

  const handleDuplicateDashboard = async (dashboard) => {
    try {
      const res = await fetch(
        `${API_URL}/api/dataviz/dashboards?org_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            name: `${dashboard.name} (Copy)`,
            description: dashboard.description,
            widgets: dashboard.widgets || [],
            layout: dashboard.layout
          })
        }
      );
      toast.success('Dashboard duplicated');
      loadDashboards();
    } catch (err) {
      toast.error('Failed to duplicate dashboard');
    }
  };

  const filteredDashboards = dashboards.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary-foreground" />
              </div>
              DataViz Studio
            </h1>
            <p className="text-muted-foreground mt-1">
              Transform your data into compelling visual stories
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Dashboard
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Submissions"
            value={stats.total_submissions?.toLocaleString() || '0'}
            icon={FileText}
            color="from-blue-500 to-indigo-600"
          />
          <StatCard
            title="Submissions Today"
            value={stats.submissions_today?.toLocaleString() || '0'}
            icon={TrendingUp}
            trend={12}
            color="from-emerald-500 to-teal-600"
          />
          <StatCard
            title="Active Forms"
            value={stats.total_forms?.toLocaleString() || '0'}
            icon={Layout}
            color="from-purple-500 to-pink-600"
          />
          <StatCard
            title="Active Enumerators"
            value={stats.active_enumerators?.toLocaleString() || '0'}
            icon={Users}
            color="from-orange-500 to-red-600"
          />
        </div>

        {/* Quick Start Templates */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Quick Start Templates</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleSelectTemplate}
              />
            ))}
          </div>
        </div>

        {/* My Dashboards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">My Dashboards</h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search dashboards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-6 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDashboards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDashboards.map((dashboard) => (
                <DashboardCard
                  key={dashboard.id}
                  dashboard={dashboard}
                  onView={(id) => navigate(`/dataviz/view/${id}`)}
                  onEdit={(id) => navigate(`/dataviz/builder/${id}`)}
                  onDuplicate={handleDuplicateDashboard}
                  onDelete={handleDeleteDashboard}
                />
              ))}
            </div>
          ) : (
            <Card className="bg-card border-dashed border-2">
              <CardContent className="py-12 text-center">
                <Layout className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No dashboards yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first dashboard to start visualizing your data
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Dashboard
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Dashboard Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>
              Start with a blank canvas or choose a template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dashboard Name</Label>
              <Input
                placeholder="e.g., Weekly Performance Report"
                value={newDashboard.name}
                onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What insights will this dashboard show?"
                value={newDashboard.description}
                onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDashboard}>
              Create Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
