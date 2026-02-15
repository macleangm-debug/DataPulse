import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  FileText,
  Users,
  Map,
  Award,
  AlertTriangle
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
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { useAuthStore } from '../store';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`
});

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

// Stat Card with trend
const StatCard = ({ title, value, trend, icon: Icon, color = "primary" }) => {
  const isPositive = trend >= 0;
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value?.toLocaleString()}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}{trend}%
                </span>
                <span className="text-xs text-gray-500">vs last period</span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg bg-${color}/10 flex items-center justify-center`}>
            <Icon className={`w-6 h-6 text-${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function AnalyticsDashboard({ orgId }) {
  const [period, setPeriod] = useState('30_days');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [quality, setQuality] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalytics();
  }, [orgId, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [overviewRes, submissionsRes, qualityRes, performanceRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/overview/${orgId}?period=${period}`, { headers }),
        fetch(`${API_URL}/api/analytics/submissions/${orgId}?period=${period}`, { headers }),
        fetch(`${API_URL}/api/analytics/quality/${orgId}?period=${period}`, { headers }),
        fetch(`${API_URL}/api/analytics/performance/${orgId}?period=${period}`, { headers })
      ]);

      setOverview(await overviewRes.json());
      setSubmissions(await submissionsRes.json());
      setQuality(await qualityRes.json());
      setPerformance(await performanceRes.json());
    } catch (error) {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format) => {
    try {
      const response = await fetch(
        `${API_URL}/api/analytics/export/${orgId}?period=${period}&format=${format}`,
        { headers: getAuthHeaders() }
      );
      
      if (format === 'csv') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${period}.csv`;
        a.click();
      }
      
      toast.success('Export started');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Analytics</h1>
          <p className="text-gray-400">Data insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7_days">Last 7 Days</SelectItem>
              <SelectItem value="30_days">Last 30 Days</SelectItem>
              <SelectItem value="90_days">Last 90 Days</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportData('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Submissions"
          value={overview?.summary?.submissions?.total || 0}
          trend={overview?.summary?.submissions?.trend}
          icon={FileText}
        />
        <StatCard
          title="Active Forms"
          value={overview?.summary?.forms?.active || 0}
          icon={BarChart3}
        />
        <StatCard
          title="Quality Score"
          value={`${overview?.summary?.quality?.average || 0}%`}
          trend={overview?.summary?.quality?.trend}
          icon={Award}
        />
        <StatCard
          title="Team Members"
          value={overview?.summary?.users?.total || 0}
          icon={Users}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submission Trends */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg text-white">Submission Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={submissions?.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                      <Area type="monotone" dataKey="submissions" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg text-white">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={[
                          { name: 'Approved', value: overview?.status_distribution?.approved || 65 },
                          { name: 'Pending', value: overview?.status_distribution?.pending || 25 },
                          { name: 'Rejected', value: overview?.status_distribution?.rejected || 10 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius="40%"
                        outerRadius="70%"
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {COLORS.slice(0, 3).map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Forms */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Top Forms by Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={submissions?.top_forms || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#9CA3AF', fontSize: 10 }} width={150} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                    <Bar dataKey="submissions" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Factors Radar */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg text-white">Quality Factors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={quality?.quality_factors || []}>
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis dataKey="factor" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                      <PolarRadiusAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                      <Radar dataKey="score" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Quality Distribution */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-lg text-white">Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quality?.score_distribution || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="range" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                      <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Common Issues */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Common Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(quality?.common_issues || []).map((issue, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-card/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${
                        issue.severity === 'high' ? 'text-red-500' : 
                        issue.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                      }`} />
                      <span className="text-white">{issue.issue}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        issue.severity === 'high' ? 'destructive' : 
                        issue.severity === 'medium' ? 'secondary' : 'default'
                      }>
                        {issue.severity}
                      </Badge>
                      <span className="text-gray-400">{issue.count} occurrences</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-6">
          {/* Team Performance Table */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Team Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-gray-400">Name</th>
                      <th className="text-left p-3 text-gray-400">Role</th>
                      <th className="text-right p-3 text-gray-400">Submissions</th>
                      <th className="text-right p-3 text-gray-400">Quality</th>
                      <th className="text-right p-3 text-gray-400">Completion</th>
                      <th className="text-right p-3 text-gray-400">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(performance?.user_performance || []).map((user, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="p-3 text-white">{user.name}</td>
                        <td className="p-3">
                          <Badge variant="outline">{user.role}</Badge>
                        </td>
                        <td className="p-3 text-right text-white">{user.submissions}</td>
                        <td className="p-3 text-right">
                          <span className={user.quality_avg >= 85 ? 'text-green-500' : 'text-yellow-500'}>
                            {user.quality_avg}%
                          </span>
                        </td>
                        <td className="p-3 text-right text-white">{user.completion_rate}%</td>
                        <td className="p-3 text-right">
                          <span className={user.trend >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {user.trend >= 0 ? '+' : ''}{user.trend}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Regional Performance */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Regional Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performance?.regional_performance || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="region" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                    <Legend />
                    <Bar dataKey="submissions" fill="#3B82F6" name="Submissions" />
                    <Bar dataKey="quality_avg" fill="#22c55e" name="Quality %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6 mt-6">
          {/* Detailed submission analytics */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Submission Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={submissions?.time_series || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                    <Legend />
                    <Area type="monotone" dataKey="approved" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Approved" />
                    <Area type="monotone" dataKey="pending" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Pending" />
                    <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Rejected" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
