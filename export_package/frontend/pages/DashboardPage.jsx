import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Database,
  PieChart,
  TrendingUp,
  Upload,
  Plus,
  ArrowRight,
  BarChart3,
  Table2,
  Brain,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuthStore, useOrgStore } from '../store';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const [stats, setStats] = useState({
    datasets: 0,
    dashboards: 0,
    charts: 0,
    dataSources: 0
  });
  const [recentDatasets, setRecentDatasets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [currentOrg]);

  const fetchDashboardData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const orgParam = currentOrg?.id ? `?org_id=${currentOrg.id}` : '';
      
      const [datasetsRes, dashboardsRes, chartsRes, sourcesRes] = await Promise.all([
        axios.get(`${API_URL}/api/datasets${orgParam}`, { headers }),
        axios.get(`${API_URL}/api/dashboards${orgParam}`, { headers }),
        axios.get(`${API_URL}/api/charts${orgParam}`, { headers }),
        axios.get(`${API_URL}/api/data-sources${orgParam}`, { headers })
      ]);

      setStats({
        datasets: datasetsRes.data.datasets?.length || 0,
        dashboards: dashboardsRes.data.dashboards?.length || 0,
        charts: chartsRes.data.charts?.length || 0,
        dataSources: sourcesRes.data.sources?.length || 0
      });

      setRecentDatasets(datasetsRes.data.datasets?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Datasets', value: stats.datasets, icon: Database, color: 'violet', path: '/datasets' },
    { label: 'Dashboards', value: stats.dashboards, icon: LayoutDashboard, color: 'blue', path: '/dashboards' },
    { label: 'Charts', value: stats.charts, icon: PieChart, color: 'emerald', path: '/charts' },
    { label: 'Data Sources', value: stats.dataSources, icon: Table2, color: 'amber', path: '/data-sources' },
  ];

  const quickActions = [
    { label: 'Upload Data', icon: Upload, path: '/upload', description: 'Import CSV, Excel, or JSON' },
    { label: 'Create Dashboard', icon: LayoutDashboard, path: '/dashboards/new', description: 'Build interactive dashboards' },
    { label: 'New Chart', icon: PieChart, path: '/charts/new', description: 'Visualize your data' },
    { label: 'AI Insights', icon: Brain, path: '/ai-insights', description: 'Get AI-powered analysis' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's an overview of your data visualization workspace
            </p>
          </div>
          <Button
            onClick={() => navigate('/upload')}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="upload-data-btn"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(stat.path)}
                data-testid={`stat-card-${stat.label.toLowerCase()}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-800 transition-all group"
                  onClick={() => navigate(action.path)}
                  data-testid={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
                >
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/50 transition-colors">
                      <action.icon className="w-5 h-5 text-violet-600" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{action.label}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Datasets */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Datasets</h2>
            <Button variant="ghost" onClick={() => navigate('/datasets')} data-testid="view-all-datasets-btn">
              View all
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentDatasets.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentDatasets.map((dataset, index) => (
                <motion.div
                  key={dataset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/datasets/${dataset.id}`)}
                    data-testid={`dataset-card-${dataset.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                            <h3 className="font-semibold text-foreground truncate">{dataset.name}</h3>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{dataset.row_count || 0} rows</span>
                            <span>{dataset.columns?.length || 0} columns</span>
                          </div>
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
                <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No datasets yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first dataset to start visualizing
                </p>
                <Button onClick={() => navigate('/upload')} className="bg-violet-600 hover:bg-violet-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Data
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default DashboardPage;
