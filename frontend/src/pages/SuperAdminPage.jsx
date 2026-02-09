import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  ChevronRight,
  CreditCard,
  Receipt,
  Settings2,
  Shield,
  Activity,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json',
  'X-Super-Admin': 'true'
});

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const StatCard = ({ title, value, icon: Icon, trend, color = 'primary' }) => (
  <Card className="bg-card/50 border-border/50">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend > 0 ? '+' : ''}{trend}% from last month
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${color}/10`}>
          <Icon className={`w-6 h-6 text-${color}`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const OrgRow = ({ org, onView, onChangeTier }) => (
  <TableRow className="hover:bg-card/50">
    <TableCell>
      <div>
        <p className="font-medium text-white">{org.name}</p>
        <p className="text-xs text-gray-400">{org.slug}</p>
      </div>
    </TableCell>
    <TableCell>
      <Badge variant={
        org.billing_tier === 'enterprise' ? 'default' :
        org.billing_tier === 'pro' ? 'secondary' : 'outline'
      }>
        {org.billing_tier || 'free'}
      </Badge>
    </TableCell>
    <TableCell className="text-gray-400">{org.usage?.users || 0}</TableCell>
    <TableCell className="text-gray-400">{org.usage?.projects || 0}</TableCell>
    <TableCell className="text-gray-400">{org.usage?.submissions_this_month?.toLocaleString() || 0}</TableCell>
    <TableCell>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => onView(org)}>
          <Eye className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChangeTier(org)}>
          <CreditCard className="w-4 h-4" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
);

const AlertRow = ({ alert }) => (
  <div className={`flex items-center justify-between p-3 rounded-lg ${
    alert.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
  }`}>
    <div className="flex items-center gap-3">
      <AlertTriangle className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
      <div>
        <p className="text-sm font-medium text-white">{alert.org_name}</p>
        <p className="text-xs text-gray-400">
          {alert.type === 'submissions_limit' ? 'Submission limit' : 'User limit'}: {alert.current}/{alert.limit}
        </p>
      </div>
    </div>
    <div className="text-right">
      <p className={`text-lg font-bold ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`}>
        {alert.usage_percentage}%
      </p>
      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
        {alert.severity}
      </Badge>
    </div>
  </div>
);

export function SuperAdminPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [plans, setPlans] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showOrgDetails, setShowOrgDetails] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [orgDetails, setOrgDetails] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [dashRes, orgsRes, alertsRes, invoicesRes, statsRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`, { headers }),
        fetch(`${API_URL}/api/admin/organizations?limit=100`, { headers }),
        fetch(`${API_URL}/api/admin/alerts`, { headers }),
        fetch(`${API_URL}/api/admin/invoices?limit=20`, { headers }),
        fetch(`${API_URL}/api/admin/system/stats`, { headers }),
        fetch(`${API_URL}/api/admin/billing/plans`, { headers })
      ]);

      setDashboard(await dashRes.json());
      setOrganizations((await orgsRes.json()).organizations || []);
      setAlerts((await alertsRes.json()).alerts || []);
      setInvoices((await invoicesRes.json()).invoices || []);
      setSystemStats(await statsRes.json());
      setPlans((await plansRes.json()).plans || []);
    } catch (error) {
      console.error('Failed to load admin data:', error);
      toast.error('Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrg = async (org) => {
    setSelectedOrg(org);
    setShowOrgDetails(true);
    
    try {
      const res = await fetch(`${API_URL}/api/admin/organizations/${org.id}`, {
        headers: getAuthHeaders()
      });
      setOrgDetails(await res.json());
    } catch (error) {
      toast.error('Failed to load organization details');
    }
  };

  const handleChangeTier = (org) => {
    setSelectedOrg(org);
    setShowTierDialog(true);
  };

  const handleUpdateTier = async (newTier) => {
    try {
      await fetch(`${API_URL}/api/admin/organizations/${selectedOrg.id}/tier`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ tier: newTier })
      });
      toast.success(`Organization tier updated to ${newTier}`);
      setShowTierDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to update tier');
    }
  };

  const handleGenerateInvoice = async (orgId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/invoices/${orgId}/generate`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const invoice = await res.json();
      toast.success(`Invoice ${invoice.id} generated`);
      loadData();
    } catch (error) {
      toast.error('Failed to generate invoice');
    }
  };

  const filteredOrgs = organizations.filter(org => {
    const matchesSearch = org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          org.slug?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || (org.billing_tier || 'free') === tierFilter;
    return matchesSearch && matchesTier;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="super-admin-page">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Super Admin Dashboard</h1>
                <p className="text-sm text-gray-400">Software Galaxy SSO Management</p>
              </div>
            </div>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Organizations"
            value={dashboard?.stats?.total_organizations || 0}
            icon={Building2}
            color="blue-500"
          />
          <StatCard
            title="Total Users"
            value={dashboard?.stats?.total_users || 0}
            icon={Users}
            color="green-500"
          />
          <StatCard
            title="Total Submissions"
            value={dashboard?.stats?.total_submissions?.toLocaleString() || 0}
            icon={FileText}
            color="purple-500"
          />
          <StatCard
            title="Monthly Revenue"
            value={`$${(dashboard?.stats?.monthly_revenue || 0).toLocaleString()}`}
            icon={DollarSign}
            color="yellow-500"
          />
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Usage Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alerts.slice(0, 5).map((alert, idx) => (
                  <AlertRow key={idx} alert={alert} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="organizations">
          <TabsList>
            <TabsTrigger value="organizations" className="gap-2">
              <Building2 className="w-4 h-4" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="mt-6 space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Organizations Table */}
            <Card className="bg-card/50 border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Submissions (Month)</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrgs.map((org) => (
                    <OrgRow
                      key={org.id}
                      org={org}
                      onView={handleViewOrg}
                      onChangeTier={handleChangeTier}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Tier Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-white">Tier Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(dashboard?.billing_distribution || {}).map(([name, value]) => ({
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            value
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {Object.keys(dashboard?.billing_distribution || {}).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-white">Recent Signups</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {dashboard?.recent_organizations?.map((org) => (
                        <div key={org.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                          <div>
                            <p className="font-medium text-white">{org.name}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(org.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline">{org.billing_tier || 'free'}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="mt-6 space-y-4">
            {/* Plans */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <Card key={plan.id} className={`bg-card/50 border-border/50 ${plan.id === 'pro' ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader>
                    <CardTitle className="text-white">{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-2xl font-bold text-white">${plan.price_monthly}</span>
                      <span className="text-gray-400">/month</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{plan.features?.max_users === -1 ? 'Unlimited' : plan.features?.max_users} users</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{plan.features?.max_submissions_per_month === -1 ? 'Unlimited' : plan.features?.max_submissions_per_month?.toLocaleString()} submissions/mo</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{plan.features?.max_storage_gb}GB storage</span>
                      </li>
                      <li className="flex items-center gap-2">
                        {plan.features?.sso_enabled ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-500" />
                        )}
                        <span className={!plan.features?.sso_enabled ? 'text-gray-500' : ''}>SSO Integration</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent Invoices */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Recent Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono">{invoice.id}</TableCell>
                        <TableCell>{invoice.org_name}</TableCell>
                        <TableCell>${invoice.amount}</TableCell>
                        <TableCell>
                          <Badge variant={
                            invoice.status === 'paid' ? 'default' :
                            invoice.status === 'overdue' ? 'destructive' : 'secondary'
                          }>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-white">Daily Submissions (30 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={systemStats?.daily_submissions || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#9ca3af' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-white">New Users (30 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={systemStats?.daily_new_users || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#9ca3af' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">API Calls Today</p>
                    <p className="text-3xl font-bold text-white">{systemStats?.api_calls_today?.toLocaleString() || 0}</p>
                  </div>
                  <Activity className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Organization Details Dialog */}
      <Dialog open={showOrgDetails} onOpenChange={setShowOrgDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedOrg?.name}</DialogTitle>
            <DialogDescription>Organization Details and Usage</DialogDescription>
          </DialogHeader>

          {orgDetails ? (
            <div className="space-y-6 py-4">
              {/* Usage Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-card/50">
                  <p className="text-sm text-gray-400">Users</p>
                  <p className="text-2xl font-bold text-white">{orgDetails.usage?.users || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-card/50">
                  <p className="text-sm text-gray-400">Projects</p>
                  <p className="text-2xl font-bold text-white">{orgDetails.usage?.projects || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-card/50">
                  <p className="text-sm text-gray-400">Forms</p>
                  <p className="text-2xl font-bold text-white">{orgDetails.usage?.forms || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-card/50">
                  <p className="text-sm text-gray-400">Total Submissions</p>
                  <p className="text-2xl font-bold text-white">{orgDetails.usage?.total_submissions?.toLocaleString() || 0}</p>
                </div>
              </div>

              {/* Monthly Trend */}
              <div>
                <h3 className="text-sm font-medium text-white mb-3">Monthly Submissions</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={orgDetails.monthly_submissions || []}>
                      <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af' }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Current Plan */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Current Plan</p>
                    <p className="text-xl font-bold text-white">{orgDetails.current_plan?.name}</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    ${orgDetails.current_plan?.price_monthly}/mo
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrgDetails(false)}>
              Close
            </Button>
            {selectedOrg && (orgDetails?.current_plan?.id !== 'free') && (
              <Button onClick={() => handleGenerateInvoice(selectedOrg.id)}>
                Generate Invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Tier Dialog */}
      <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Billing Tier</DialogTitle>
            <DialogDescription>
              Update the billing tier for {selectedOrg?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handleUpdateTier(plan.id)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  (selectedOrg?.billing_tier || 'free') === plan.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{plan.name}</p>
                    <p className="text-sm text-gray-400">${plan.price_monthly}/month</p>
                  </div>
                  {(selectedOrg?.billing_tier || 'free') === plan.id && (
                    <Badge>Current</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTierDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SuperAdminPage;
