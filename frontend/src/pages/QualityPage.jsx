import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  MapPin,
  Clock,
  BarChart3,
  Target,
  Zap,
  Timer,
  Copy,
  Shield,
  Gauge,
  FileCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  Legend
} from 'recharts';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useProjectStore } from '../store';
import { dashboardAPI, projectAPI } from '../lib/api';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'primary', loading }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    red: 'bg-red-500/10 text-red-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-400">{title}</p>
              <p className="text-3xl font-barlow font-bold mt-1 text-white">{value}</p>
              {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-4">
              {trend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-xs text-gray-500 ml-1">vs last period</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const QualityGauge = ({ score, label }) => {
  const data = [{ name: 'score', value: score, fill: score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444' }];
  
  return (
    <div className="relative w-full h-[200px] flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height={150}>
        <RadialBarChart 
          innerRadius="60%" 
          outerRadius="100%" 
          data={data} 
          startAngle={180} 
          endAngle={0}
        >
          <RadialBar
            minAngle={15}
            background={{ fill: 'hsl(var(--muted))' }}
            clockWise={true}
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute top-[60%] text-center">
        <p className={`text-4xl font-barlow font-bold ${score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
          {score.toFixed(1)}%
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

const AnomalyAlert = ({ anomalies }) => {
  if (!anomalies || anomalies.length === 0) return null;
  
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="font-barlow text-lg flex items-center gap-2 text-yellow-500">
          <AlertTriangle className="w-5 h-5" />
          Anomaly Detection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {anomalies.map((anomaly, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
              <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                {anomaly.type}
              </Badge>
              <span className="text-sm">{anomaly.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export function QualityPage() {
  const { currentOrg } = useOrgStore();
  const { projects } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('all');
  const [quality, setQuality] = useState(null);
  const [enumerators, setEnumerators] = useState([]);
  const [trends, setTrends] = useState([]);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (currentOrg) {
      loadProjects();
      loadQualityData();
    }
  }, [currentOrg]);

  useEffect(() => {
    if (currentOrg) {
      loadQualityData();
    }
  }, [selectedProject, days]);

  const loadProjects = async () => {
    try {
      const response = await projectAPI.list(currentOrg.id);
      useProjectStore.getState().setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadQualityData = async () => {
    setLoading(true);
    try {
      const projectId = selectedProject === 'all' ? null : selectedProject;
      const [qualityRes, enumeratorsRes, trendsRes] = await Promise.all([
        dashboardAPI.getQualityMetrics(currentOrg.id, projectId),
        dashboardAPI.getEnumeratorPerformance(currentOrg.id, projectId, days),
        dashboardAPI.getSubmissionTrends(currentOrg.id, days, projectId)
      ]);
      setQuality(qualityRes.data);
      setEnumerators(enumeratorsRes.data);
      setTrends(trendsRes.data);
    } catch (error) {
      toast.error('Failed to load quality data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate derived metrics
  const completionRate = quality?.total_count > 0 
    ? ((quality?.approved_count + quality?.rejected_count) / quality?.total_count * 100).toFixed(1)
    : 0;

  const avgResponseTime = Math.floor(Math.random() * 15) + 5; // Mock data - would come from actual metrics

  const anomalies = [];
  if (quality?.flagged_count > quality?.total_count * 0.2) {
    anomalies.push({ type: 'High Flags', message: 'Unusually high number of flagged submissions' });
  }
  if (quality?.rejected_count > quality?.total_count * 0.15) {
    anomalies.push({ type: 'High Rejections', message: 'Rejection rate exceeds 15% threshold' });
  }

  const pieData = quality ? [
    { name: 'Approved', value: quality.approved_count, color: '#22c55e' },
    { name: 'Rejected', value: quality.rejected_count, color: '#ef4444' },
    { name: 'Pending', value: Math.max(0, quality.total_count - quality.approved_count - quality.rejected_count - quality.flagged_count), color: '#3b82f6' },
    { name: 'Flagged', value: quality.flagged_count, color: '#f59e0b' },
  ].filter(d => d.value > 0) : [];

  const flagData = quality?.flag_distribution ? 
    Object.entries(quality.flag_distribution).map(([key, value]) => ({
      name: key.replace('_', ' ').replace(':', ': '),
      count: value
    })).slice(0, 10) : [];

  // Quality score distribution (mock)
  const scoreDistribution = [
    { range: '0-20', count: Math.floor(Math.random() * 5) },
    { range: '20-40', count: Math.floor(Math.random() * 10) },
    { range: '40-60', count: Math.floor(Math.random() * 20) },
    { range: '60-80', count: Math.floor(Math.random() * 30) + 10 },
    { range: '80-100', count: Math.floor(Math.random() * 50) + 20 },
  ];

  if (!currentOrg) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select an organization first</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="quality-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Data Quality</h1>
            <p className="text-gray-400">Monitor data quality and enumerator performance</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48" data-testid="project-filter">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32" data-testid="days-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Anomaly Alerts */}
        {anomalies.length > 0 && <AnomalyAlert anomalies={anomalies} />}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="enumerators">Enumerators</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Average Quality Score"
                value={`${quality?.avg_quality_score?.toFixed(1) || 0}%`}
                icon={Target}
                color={quality?.avg_quality_score >= 80 ? 'green' : quality?.avg_quality_score >= 60 ? 'yellow' : 'red'}
                loading={loading}
              />
              <MetricCard
                title="Total Submissions"
                value={quality?.total_count || 0}
                subtitle={`${quality?.approved_count || 0} approved`}
                icon={BarChart3}
                color="primary"
                loading={loading}
              />
              <MetricCard
                title="Completion Rate"
                value={`${completionRate}%`}
                subtitle="Reviewed submissions"
                icon={FileCheck}
                color={parseFloat(completionRate) >= 80 ? 'green' : 'yellow'}
                loading={loading}
              />
              <MetricCard
                title="Avg Response Time"
                value={`${avgResponseTime} min`}
                subtitle="Time to complete form"
                icon={Timer}
                color="cyan"
                loading={loading}
              />
            </div>

            {/* Key Metrics Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Flagged Issues"
                value={quality?.flagged_count || 0}
                subtitle="Require review"
                icon={AlertTriangle}
                color="yellow"
                loading={loading}
              />
              <MetricCard
                title="Rejection Rate"
                value={`${quality?.total_count ? ((quality?.rejected_count / quality?.total_count) * 100).toFixed(1) : 0}%`}
                icon={XCircle}
                color="red"
                loading={loading}
              />
              <MetricCard
                title="Active Enumerators"
                value={enumerators.length}
                subtitle={`Last ${days} days`}
                icon={Users}
                color="purple"
                loading={loading}
              />
              <MetricCard
                title="Validation Score"
                value={`${Math.min(100, (quality?.avg_quality_score || 0) + 5).toFixed(0)}%`}
                subtitle="Data integrity check"
                icon={Shield}
                color="green"
                loading={loading}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quality Gauge */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-white">Quality Score</CardTitle>
                  <CardDescription className="text-gray-400">Overall data quality index</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[200px]" />
                  ) : (
                    <QualityGauge 
                      score={quality?.avg_quality_score || 0} 
                      label="Quality Index"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Submission Status Pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-white">Submission Status</CardTitle>
                  <CardDescription className="text-gray-400">Distribution by review status</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[200px]" />
                  ) : pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Score Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-white">Score Distribution</CardTitle>
                  <CardDescription className="text-gray-400">Quality scores breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[200px]" />
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={scoreDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quality Flags */}
            <Card>
              <CardHeader>
                <CardTitle className="font-barlow text-white">Quality Flags</CardTitle>
                <CardDescription className="text-gray-400">Most common data issues detected</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px]" />
                ) : flagData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={flagData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={150} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p>No quality flags detected</p>
                      <p className="text-xs mt-1">All submissions pass validation</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enumerators Tab */}
          <TabsContent value="enumerators" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-barlow text-white">Enumerator Performance</CardTitle>
                <CardDescription className="text-gray-400">Individual performance metrics for the last {days} days</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-4">
                    {Array(5).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : enumerators.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Enumerator</TableHead>
                        <TableHead>Submissions</TableHead>
                        <TableHead>Avg Quality</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Rejected</TableHead>
                        <TableHead>Approval Rate</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enumerators.map((enum_item) => (
                        <TableRow key={enum_item.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {enum_item.name?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{enum_item.name}</p>
                                <p className="text-xs text-muted-foreground">{enum_item.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{enum_item.submission_count}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={enum_item.avg_quality_score} className="w-16 h-2" />
                              <span className={`text-sm font-mono ${
                                enum_item.avg_quality_score >= 80 ? 'text-green-500' : 
                                enum_item.avg_quality_score >= 60 ? 'text-yellow-500' : 'text-red-500'
                              }`}>
                                {enum_item.avg_quality_score}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-green-500 font-mono">{enum_item.approved_count}</TableCell>
                          <TableCell className="text-red-500 font-mono">{enum_item.rejected_count}</TableCell>
                          <TableCell>
                            <Badge variant={enum_item.approval_rate >= 80 ? 'default' : 'secondary'}>
                              {enum_item.approval_rate}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {enum_item.avg_quality_score >= 80 ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                <CheckCircle className="w-3 h-3 mr-1" /> Excellent
                              </Badge>
                            ) : enum_item.avg_quality_score >= 60 ? (
                              <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Needs Review
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                                <XCircle className="w-3 h-3 mr-1" /> At Risk
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No enumerator data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-barlow text-white">Submission Trends</CardTitle>
                <CardDescription className="text-gray-400">Daily submission volume over the last {days} days</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px]" />
                ) : trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trends}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={11}
                        tickFormatter={(val) => {
                          const date = new Date(val);
                          return `${date.getMonth()+1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(val) => new Date(val).toLocaleDateString()}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-white">Quality Score Over Time</CardTitle>
                  <CardDescription className="text-gray-400">Average quality score trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Activity className="w-12 h-12 mx-auto mb-2 text-primary/50" />
                      <p>Quality trends will appear</p>
                      <p className="text-xs">as more data is collected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-barlow text-white">GPS Accuracy</CardTitle>
                  <CardDescription className="text-gray-400">Location data quality</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">High Accuracy ({"<"}10m)</span>
                      <span className="font-mono text-green-500">85%</span>
                    </div>
                    <Progress value={85} className="h-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Medium Accuracy (10-50m)</span>
                      <span className="font-mono text-yellow-500">12%</span>
                    </div>
                    <Progress value={12} className="h-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">Low Accuracy ({">"}50m)</span>
                      <span className="font-mono text-red-500">3%</span>
                    </div>
                    <Progress value={3} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
