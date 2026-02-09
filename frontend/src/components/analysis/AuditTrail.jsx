/**
 * Audit Trail - View and filter audit logs for data exports and transformations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { 
  Loader2, FileText, Download, Database, Users, BarChart3, Settings, Shield, Clock, Search, RefreshCw,
  ChevronLeft, ChevronRight, Eye, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ACTION_ICONS = {
  export_csv: Download,
  export_excel: Download,
  export_spss: Download,
  export_stata: Download,
  export_parquet: Download,
  export_codebook: FileText,
  transform_recode: Settings,
  transform_compute: Settings,
  transform_impute: Settings,
  snapshot_create: Database,
  snapshot_delete: Database,
  dashboard_create: BarChart3,
  dashboard_update: BarChart3,
  dashboard_share: Users,
  report_create: FileText,
  report_generate: FileText,
  analysis_run: BarChart3,
  data_view: Eye,
  pii_access: Shield
};

const ACTION_COLORS = {
  export_csv: 'bg-blue-100 text-blue-700',
  export_excel: 'bg-green-100 text-green-700',
  export_spss: 'bg-purple-100 text-purple-700',
  export_stata: 'bg-orange-100 text-orange-700',
  transform_recode: 'bg-amber-100 text-amber-700',
  transform_impute: 'bg-cyan-100 text-cyan-700',
  snapshot_create: 'bg-sky-100 text-sky-700',
  dashboard_create: 'bg-pink-100 text-pink-700',
  pii_access: 'bg-red-100 text-red-700'
};

export function AuditTrail({ orgId, getToken }) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    user_id: ''
  });

  useEffect(() => {
    if (orgId) {
      fetchLogs();
      fetchSummary();
    }
  }, [orgId, page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/audit/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          org_id: orgId,
          action: filters.action || null,
          resource_type: filters.resource_type || null,
          user_id: filters.user_id || null,
          page: page,
          page_size: 20
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalPages(data.total_pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_URL}/api/audit/summary/${orgId}?days=30`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit summary:', error);
    }
  };

  const getActionIcon = (action) => {
    const Icon = ACTION_ICONS[action] || FileText;
    return Icon;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6" data-testid="audit-trail">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Trail
          </h2>
          <p className="text-sm text-slate-500">Track data exports, transformations, and sensitive access</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchLogs(); fetchSummary(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Actions</p>
                  <p className="text-2xl font-bold">{summary.total_actions}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Last {summary.period_days} days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Data Exports</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.export_count}</p>
                </div>
                <Download className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">PII Access</p>
                  <p className="text-2xl font-bold text-red-600">{summary.pii_access_count}</p>
                </div>
                <Shield className="h-8 w-8 text-red-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Users</p>
                  <p className="text-2xl font-bold">{summary.by_user?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Action Type</Label>
              <Select value={filters.action || "all"} onValueChange={v => { setFilters({...filters, action: v === "all" ? '' : v}); setPage(1); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="export_csv">Export CSV</SelectItem>
                  <SelectItem value="export_excel">Export Excel</SelectItem>
                  <SelectItem value="export_spss">Export SPSS</SelectItem>
                  <SelectItem value="export_stata">Export Stata</SelectItem>
                  <SelectItem value="transform_recode">Recode</SelectItem>
                  <SelectItem value="transform_impute">Imputation</SelectItem>
                  <SelectItem value="snapshot_create">Create Snapshot</SelectItem>
                  <SelectItem value="dashboard_create">Create Dashboard</SelectItem>
                  <SelectItem value="pii_access">PII Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resource Type</Label>
              <Select value={filters.resource_type || "all"} onValueChange={v => { setFilters({...filters, resource_type: v === "all" ? '' : v}); setPage(1); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="snapshot">Snapshot</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <Button variant="outline" size="sm" className="w-full" onClick={() => { setFilters({ action: '', resource_type: '', user_id: '' }); setPage(1); }}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activity Log</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map(log => {
                  const ActionIcon = getActionIcon(log.action);
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={`p-2 rounded-lg ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                        <ActionIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-sm font-medium truncate">{log.resource_name || log.resource_id}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {log.user_email || log.user_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(log.created_at)}
                          </span>
                          {log.details?.format && (
                            <Badge variant="secondary" className="text-xs">{log.details.format}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found</p>
                <p className="text-sm">Activity will appear here once users perform trackable actions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity by Action Type */}
      {summary?.by_action && summary.by_action.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activity by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {summary.by_action.slice(0, 12).map(item => {
                const ActionIcon = getActionIcon(item.action);
                return (
                  <div key={item.action} className="p-3 border rounded-lg text-center">
                    <ActionIcon className="h-5 w-5 mx-auto mb-1 text-slate-400" />
                    <p className="text-lg font-semibold">{item.count}</p>
                    <p className="text-xs text-slate-500 truncate">{item.action.replace(/_/g, ' ')}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AuditTrail;
