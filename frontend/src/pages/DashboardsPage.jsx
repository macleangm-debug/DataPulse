import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Plus,
  Trash2,
  Edit,
  Eye,
  Search,
  Grid,
  Copy,
  BarChart3,
  PieChart,
  TrendingUp,
  DollarSign,
  Users,
  ShoppingCart,
  Activity,
  Target,
  Layers,
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dashboard Templates
const DASHBOARD_TEMPLATES = [
  {
    id: 'sales_overview',
    name: 'Sales Overview',
    description: 'Track sales performance, revenue, and key metrics',
    icon: DollarSign,
    color: 'from-emerald-500 to-emerald-600',
    widgets: [
      { type: 'stat', title: 'Total Revenue', config: { aggregation: 'sum' }, position: { x: 0, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Orders', config: { aggregation: 'count' }, position: { x: 3, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Avg Order Value', config: { aggregation: 'mean' }, position: { x: 6, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Customers', config: { aggregation: 'count' }, position: { x: 9, y: 0, w: 3, h: 2 } },
      { type: 'chart', title: 'Revenue Trend', config: { chart_type: 'line' }, position: { x: 0, y: 2, w: 8, h: 4 } },
      { type: 'chart', title: 'Sales by Category', config: { chart_type: 'pie' }, position: { x: 8, y: 2, w: 4, h: 4 } },
      { type: 'table', title: 'Top Products', config: { limit: 5 }, position: { x: 0, y: 6, w: 6, h: 4 } },
      { type: 'chart', title: 'Monthly Comparison', config: { chart_type: 'bar' }, position: { x: 6, y: 6, w: 6, h: 4 } },
    ]
  },
  {
    id: 'marketing_analytics',
    name: 'Marketing Analytics',
    description: 'Monitor campaigns, engagement, and conversion rates',
    icon: Target,
    color: 'from-violet-500 to-violet-600',
    widgets: [
      { type: 'stat', title: 'Visitors', config: { aggregation: 'sum' }, position: { x: 0, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Conversion Rate', config: { aggregation: 'mean' }, position: { x: 3, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Leads', config: { aggregation: 'count' }, position: { x: 6, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Cost per Lead', config: { aggregation: 'mean' }, position: { x: 9, y: 0, w: 3, h: 2 } },
      { type: 'chart', title: 'Traffic Sources', config: { chart_type: 'pie' }, position: { x: 0, y: 2, w: 4, h: 4 } },
      { type: 'chart', title: 'Visitor Trend', config: { chart_type: 'area' }, position: { x: 4, y: 2, w: 8, h: 4 } },
      { type: 'chart', title: 'Campaign Performance', config: { chart_type: 'bar' }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ]
  },
  {
    id: 'customer_insights',
    name: 'Customer Insights',
    description: 'Understand customer behavior and demographics',
    icon: Users,
    color: 'from-blue-500 to-blue-600',
    widgets: [
      { type: 'stat', title: 'Total Customers', config: { aggregation: 'count' }, position: { x: 0, y: 0, w: 4, h: 2 } },
      { type: 'stat', title: 'New Customers', config: { aggregation: 'count' }, position: { x: 4, y: 0, w: 4, h: 2 } },
      { type: 'stat', title: 'Retention Rate', config: { aggregation: 'mean' }, position: { x: 8, y: 0, w: 4, h: 2 } },
      { type: 'chart', title: 'Customer Segments', config: { chart_type: 'pie' }, position: { x: 0, y: 2, w: 6, h: 4 } },
      { type: 'chart', title: 'Growth Over Time', config: { chart_type: 'line' }, position: { x: 6, y: 2, w: 6, h: 4 } },
      { type: 'table', title: 'Top Customers', config: { limit: 10 }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ]
  },
  {
    id: 'operations_monitor',
    name: 'Operations Monitor',
    description: 'Track inventory, orders, and operational KPIs',
    icon: Activity,
    color: 'from-amber-500 to-amber-600',
    widgets: [
      { type: 'stat', title: 'Pending Orders', config: { aggregation: 'count' }, position: { x: 0, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'In Stock Items', config: { aggregation: 'count' }, position: { x: 3, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Low Stock Alerts', config: { aggregation: 'count' }, position: { x: 6, y: 0, w: 3, h: 2 } },
      { type: 'stat', title: 'Fulfillment Rate', config: { aggregation: 'mean' }, position: { x: 9, y: 0, w: 3, h: 2 } },
      { type: 'chart', title: 'Order Status', config: { chart_type: 'pie' }, position: { x: 0, y: 2, w: 4, h: 4 } },
      { type: 'chart', title: 'Daily Orders', config: { chart_type: 'bar' }, position: { x: 4, y: 2, w: 8, h: 4 } },
      { type: 'table', title: 'Recent Orders', config: { limit: 8 }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ]
  },
  {
    id: 'financial_summary',
    name: 'Financial Summary',
    description: 'Monitor P&L, expenses, and financial health',
    icon: TrendingUp,
    color: 'from-rose-500 to-rose-600',
    widgets: [
      { type: 'stat', title: 'Total Revenue', config: { aggregation: 'sum' }, position: { x: 0, y: 0, w: 4, h: 2 } },
      { type: 'stat', title: 'Total Expenses', config: { aggregation: 'sum' }, position: { x: 4, y: 0, w: 4, h: 2 } },
      { type: 'stat', title: 'Net Profit', config: { aggregation: 'sum' }, position: { x: 8, y: 0, w: 4, h: 2 } },
      { type: 'chart', title: 'Revenue vs Expenses', config: { chart_type: 'line' }, position: { x: 0, y: 2, w: 8, h: 4 } },
      { type: 'chart', title: 'Expense Breakdown', config: { chart_type: 'pie' }, position: { x: 8, y: 2, w: 4, h: 4 } },
      { type: 'chart', title: 'Monthly P&L', config: { chart_type: 'bar' }, position: { x: 0, y: 6, w: 12, h: 4 } },
    ]
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with an empty dashboard',
    icon: Layers,
    color: 'from-gray-500 to-gray-600',
    widgets: []
  }
];

export function DashboardsPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const { token } = useAuthStore();
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newDashboard, setNewDashboard] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchDashboards();
  }, [currentOrg]);

  const fetchDashboards = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const orgParam = currentOrg?.id ? `?org_id=${currentOrg.id}` : '';
      const response = await axios.get(`${API_URL}/api/dashboards${orgParam}`, { headers });
      setDashboards(response.data.dashboards || []);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (template = null) => {
    const dashboardName = template ? `${template.name} Dashboard` : newDashboard.name;
    const dashboardDesc = template ? template.description : newDashboard.description;
    const dashboardWidgets = template ? template.widgets : [];
    
    if (!dashboardName) {
      toast.error('Please enter a name');
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API_URL}/api/dashboards`, {
        name: dashboardName,
        description: dashboardDesc,
        org_id: currentOrg?.id,
        widgets: dashboardWidgets
      }, { headers });
      
      toast.success(template ? `Created dashboard from "${template.name}" template` : 'Dashboard created');
      setShowCreateDialog(false);
      setShowTemplatesDialog(false);
      setSelectedTemplate(null);
      setNewDashboard({ name: '', description: '' });
      navigate(`/dashboards/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create dashboard');
    }
  };

  const handleCreateFromTemplate = (template) => {
    setSelectedTemplate(template);
    if (template.id === 'blank') {
      setShowTemplatesDialog(false);
      setShowCreateDialog(true);
    } else {
      handleCreate(template);
    }
  };

  const handleDelete = async (id) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/dashboards/${id}`, { headers });
      toast.success('Dashboard deleted');
      setDeleteDialog(null);
      fetchDashboards();
    } catch (error) {
      toast.error('Failed to delete dashboard');
    }
  };

  const filteredDashboards = dashboards.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="dashboards-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboards</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage interactive dashboards
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTemplatesDialog(true)}
              className="border-violet-200 hover:bg-violet-50"
              data-testid="templates-btn"
            >
              <Sparkles className="w-4 h-4 mr-2 text-violet-500" />
              Templates
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="create-dashboard-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Dashboard
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search dashboards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Dashboards Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-video bg-muted" />
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDashboards.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDashboards.map((dashboard, index) => (
              <motion.div
                key={dashboard.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="overflow-hidden cursor-pointer hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-800 transition-all group"
                  data-testid={`dashboard-card-${dashboard.id}`}
                >
                  {/* Dashboard Preview */}
                  <div
                    className="aspect-video bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 flex items-center justify-center relative"
                    onClick={() => navigate(`/dashboards/${dashboard.id}`)}
                  >
                    <Grid className="w-16 h-16 text-violet-300 dark:text-violet-700" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button size="sm" variant="secondary">
                        <Eye className="w-4 h-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div onClick={() => navigate(`/dashboards/${dashboard.id}`)}>
                        <h3 className="font-semibold text-foreground">{dashboard.name}</h3>
                        {dashboard.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {dashboard.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {dashboard.widgets?.length || 0} widgets
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboards/${dashboard.id}`);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog(dashboard);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <LayoutDashboard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No dashboards yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first dashboard to visualize your data
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Dashboard</DialogTitle>
              <DialogDescription>
                Create a new dashboard to visualize your data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newDashboard.name}
                  onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value })}
                  placeholder="Sales Dashboard"
                  data-testid="dashboard-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newDashboard.description}
                  onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value })}
                  placeholder="Overview of sales metrics and trends"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleCreate(null)} className="bg-violet-600 hover:bg-violet-700" data-testid="create-dashboard-submit">
                  Create Dashboard
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Dashboard</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteDialog?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteDialog?.id)}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Templates Dialog */}
        <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                Dashboard Templates
              </DialogTitle>
              <DialogDescription>
                Choose a pre-built template to get started quickly or create from scratch
              </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {DASHBOARD_TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <motion.div
                    key={template.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-lg hover:border-violet-300 transition-all"
                      onClick={() => handleCreateFromTemplate(template)}
                      data-testid={`template-${template.id}`}
                    >
                      <div className={`h-24 bg-gradient-to-br ${template.color} flex items-center justify-center rounded-t-lg`}>
                        <Icon className="w-10 h-10 text-white" />
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground mb-1">{template.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {template.widgets.length === 0 ? 'Empty canvas' : `${template.widgets.length} widgets`}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setShowTemplatesDialog(false)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default DashboardsPage;
