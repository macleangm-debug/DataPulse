/**
 * DataPulse - Data Analysis Page
 * Comprehensive analytics module with AI-powered analysis
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Database,
  FileSpreadsheet,
  BarChart3,
  Brain,
  Download,
  Filter,
  Play,
  RefreshCw,
  Search,
  Camera,
  Table,
  ChevronRight,
  Sparkles,
  FileText,
  Calculator,
  TrendingUp,
  PieChart,
  CheckCircle,
  AlertCircle,
  Clock,
  HelpCircle,
  Send,
  Settings2,
  Columns,
  ArrowRightLeft,
  Scale,
  LayoutDashboard,
  FileQuestion,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore, useOrgStore, useAnalysisStore } from '../store';
import { AdvancedStatsPanel } from '../components/analysis/AdvancedStatsPanel';
import { ChartStudio } from '../components/analysis/ChartStudio';
import { EnhancedAICopilot } from '../components/analysis/EnhancedAICopilot';
import { ReportBuilder } from '../components/analysis/ReportBuilder';
import { SurveyStatsPanel } from '../components/analysis/SurveyStatsPanel';
import { DashboardBuilder } from '../components/analysis/DashboardBuilder';
import { FactorAnalysis } from '../components/analysis/FactorAnalysis';
import { MissingDataImputation } from '../components/analysis/MissingDataImputation';
import { AuditTrail } from '../components/analysis/AuditTrail';
import DiagnosticPlots from '../components/analysis/DiagnosticPlots';
import AIDataPrep from '../components/analysis/AIDataPrep';
import QuickAnalysis from '../components/analysis/QuickAnalysis';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CHART_COLORS = ['#0ea5e9', '#22d3ee', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308'];

export function DataAnalysisPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentOrg } = useOrgStore();
  
  // Use analysis store for persisted state
  const {
    selectedFormId,
    selectedSnapshotId,
    activeTab,
    selectedVariables,
    setSelectedForm,
    setSelectedSnapshot,
    setActiveTab,
    setSelectedVariables,
    toggleVariable
  } = useAnalysisStore();
  
  const [forms, setForms] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Browse state
  const [responses, setResponses] = useState([]);
  const [responsePage, setResponsePage] = useState(1);
  const [totalResponses, setTotalResponses] = useState(0);
  const [filters, setFilters] = useState({});
  
  // Stats state (selectedVariables now comes from store)
  const [statsResults, setStatsResults] = useState(null);
  
  // AI Copilot state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchForms();
      fetchSnapshots();
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (selectedFormId) {
      fetchResponses();
    }
  }, [selectedFormId, responsePage, filters]);

  const getToken = () => {
    // Get token from auth store (persisted in localStorage under 'auth-storage')
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        return parsed?.state?.token || null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const fetchForms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/forms?org_id=${currentOrg.id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setForms(data || []);
      } else {
        console.error('Failed to fetch forms:', await response.text());
      }
    } catch (error) {
      console.error('Failed to fetch forms:', error);
    }
  };

  const fetchSnapshots = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analysis/snapshots/${currentOrg.id}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSnapshots(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    }
  };

  const fetchResponses = async () => {
    if (!selectedFormId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/responses/browse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          form_id: selectedFormId,
          page: responsePage,
          page_size: 20,
          ...filters
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setResponses(data.responses || []);
        setTotalResponses(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSnapshot = async () => {
    if (!selectedFormId) {
      toast.error('Please select a form');
      return;
    }
    
    const name = prompt('Enter snapshot name:');
    if (!name) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/snapshots/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          form_id: selectedFormId,
          org_id: currentOrg.id,
          name: name,
          include_statuses: ['approved'],
          include_metadata: true
        })
      });
      
      if (response.ok) {
        toast.success('Snapshot creation started');
        setTimeout(fetchSnapshots, 2000);
      } else {
        toast.error('Failed to create snapshot');
      }
    } catch (error) {
      toast.error('Failed to create snapshot');
    } finally {
      setLoading(false);
    }
  };

  const runQuickStats = async () => {
    if (selectedVariables.length === 0) {
      toast.error('Please select at least one variable');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/stats/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: selectedSnapshotId || null,
          form_id: selectedSnapshotId ? null : selectedFormId,
          org_id: currentOrg.id,
          variables: selectedVariables
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatsResults(data);
        toast.success('Statistics calculated');
      } else {
        toast.error('Failed to calculate statistics');
      }
    } catch (error) {
      toast.error('Failed to calculate statistics');
    } finally {
      setLoading(false);
    }
  };

  const askAICopilot = async () => {
    if (!aiQuery.trim()) {
      toast.error('Please enter a question');
      return;
    }
    
    setAiLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/ai-copilot/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: selectedSnapshotId || null,
          form_id: selectedSnapshotId ? null : selectedFormId,
          org_id: currentOrg.id,
          query: aiQuery
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiResult(data);
        toast.success('Analysis complete');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'AI analysis failed');
      }
    } catch (error) {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const exportData = async (format) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/export/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: selectedSnapshotId || null,
          form_id: selectedSnapshotId ? null : selectedFormId,
          org_id: currentOrg.id,
          format: format,
          include_labels: true,
          include_codebook: true
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${format}`;
        a.click();
        toast.success('Export downloaded');
      } else {
        toast.error('Export failed');
      }
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  };

  // Get current form schema
  const currentForm = forms.find(f => f.id === selectedFormId);
  const formFields = currentForm?.fields || [];

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="data-analysis-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Data Analysis</h1>
            <p className="text-slate-500">Browse, analyze, and export your survey data</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedFormId} onValueChange={setSelectedForm}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a form..." />
              </SelectTrigger>
              <SelectContent>
                {forms.map(form => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="browse" className="flex items-center gap-2 text-xs">
              <Database className="h-4 w-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="variables" className="flex items-center gap-2 text-xs">
              <Columns className="h-4 w-4" />
              Variables
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2 text-xs">
              <BarChart3 className="h-4 w-4" />
              Stats
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2 text-xs">
              <Calculator className="h-4 w-4" />
              Advanced
            </TabsTrigger>
            <TabsTrigger value="survey" className="flex items-center gap-2 text-xs">
              <Scale className="h-4 w-4" />
              Survey
            </TabsTrigger>
            <TabsTrigger value="charts" className="flex items-center gap-2 text-xs">
              <PieChart className="h-4 w-4" />
              Charts
            </TabsTrigger>
            <TabsTrigger value="dashboards" className="flex items-center gap-2 text-xs">
              <LayoutDashboard className="h-4 w-4" />
              Dashboards
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2 text-xs">
              <Sparkles className="h-4 w-4" />
              AI
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 text-xs">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-4 w-4" />
              Diag
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2 text-xs">
              <Download className="h-4 w-4" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Response Browser</CardTitle>
                    <CardDescription>View and filter individual responses</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{totalResponses} responses</Badge>
                    <Button variant="outline" size="sm" onClick={createSnapshot}>
                      <Camera className="h-4 w-4 mr-2" />
                      Create Snapshot
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : responses.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-600">ID</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-600">Submitted</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-600">Preview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((response, idx) => (
                          <tr key={response.id || idx} className="border-t">
                            <td className="px-4 py-3 font-mono text-xs">{response.id?.slice(0, 12)}...</td>
                            <td className="px-4 py-3">
                              <Badge variant={response.status === 'approved' ? 'default' : 'secondary'}>
                                {response.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {response.submitted_at ? new Date(response.submitted_at).toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 truncate max-w-xs">
                              {JSON.stringify(response.data || {}).slice(0, 50)}...
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                      <span className="text-sm text-slate-500">
                        Page {responsePage} of {Math.ceil(totalResponses / 20)}
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setResponsePage(p => Math.max(1, p - 1))}
                          disabled={responsePage === 1}
                        >
                          Previous
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setResponsePage(p => p + 1)}
                          disabled={responsePage >= Math.ceil(totalResponses / 20)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a form to browse responses</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Snapshots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Dataset Snapshots
                </CardTitle>
                <CardDescription>Immutable analysis-ready datasets</CardDescription>
              </CardHeader>
              <CardContent>
                {snapshots.length > 0 ? (
                  <div className="space-y-2">
                    {snapshots.map(snap => (
                      <div 
                        key={snap.id}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSnapshotId === snap.id ? 'border-sky-500 bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedSnapshot(snap.id === selectedSnapshotId ? '' : snap.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            snap.status === 'ready' ? 'bg-emerald-500' : 
                            snap.status === 'creating' ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <p className="font-medium">{snap.name}</p>
                            <p className="text-xs text-slate-500">
                              {snap.row_count} rows • Created {new Date(snap.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{snap.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No snapshots yet</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Analysis Wizard */}
            {selectedFormId && formFields.length > 0 && (
              <QuickAnalysis
                formId={selectedFormId}
                snapshotId={selectedSnapshotId}
                orgId={currentOrg?.id}
                fields={formFields}
                getToken={getToken}
                onRunAnalysis={(testType, results) => {
                  toast.success(`${testType} analysis complete`);
                  // Could navigate to results or update state here
                }}
              />
            )}
          </TabsContent>

          {/* Variables Tab - with sub-tabs */}
          <TabsContent value="variables" className="space-y-4">
            <Tabs defaultValue="view" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="view" className="flex items-center gap-2">
                  <Columns className="h-4 w-4" />
                  Variable View
                </TabsTrigger>
                <TabsTrigger value="missing" className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4" />
                  Missing Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="view">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Columns className="h-5 w-5" />
                          Variable View
                        </CardTitle>
                        <CardDescription>Manage variable metadata and properties</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {formFields.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className="p-3 text-left font-medium">Variable ID</th>
                              <th className="p-3 text-left font-medium">Label</th>
                              <th className="p-3 text-left font-medium">Type</th>
                              <th className="p-3 text-left font-medium">Values</th>
                              <th className="p-3 text-center font-medium">Required</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formFields.map((field, idx) => (
                              <tr key={field.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <td className="p-3 font-mono text-xs">{field.id}</td>
                                <td className="p-3">{field.label || '-'}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="text-xs">
                                    {field.type}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  {field.options ? (
                                    <div className="flex flex-wrap gap-1">
                                      {field.options.slice(0, 3).map((opt, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          {opt.label || opt.value}
                                        </Badge>
                                      ))}
                                      {field.options.length > 3 && (
                                        <Badge variant="secondary" className="text-xs">
                                          +{field.options.length - 3} more
                                        </Badge>
                                      )}
                                    </div>
                                  ) : field.type === 'number' ? (
                                    <span className="text-slate-500">Numeric</span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {field.required ? (
                                    <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <Columns className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a form to view variables</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="missing">
                <MissingDataImputation
                  formId={selectedFormId}
                  snapshotId={selectedSnapshotId}
                  orgId={currentOrg?.id}
                  fields={formFields}
                  getToken={getToken}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Variable Selection */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Select Variables</CardTitle>
                  <CardDescription>Choose variables to analyze</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {formFields.map(field => (
                        <div key={field.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={field.id}
                            checked={selectedVariables.includes(field.id)}
                            onCheckedChange={() => toggleVariable(field.id)}
                          />
                          <Label htmlFor={field.id} className="text-sm cursor-pointer">
                            {field.label || field.id}
                            <span className="text-xs text-slate-400 ml-1">({field.type})</span>
                          </Label>
                        </div>
                      ))}
                      {formFields.length === 0 && (
                        <p className="text-sm text-slate-500">Select a form to see variables</p>
                      )}
                    </div>
                  </ScrollArea>
                  <Separator className="my-4" />
                  <Button onClick={runQuickStats} className="w-full" disabled={loading || selectedVariables.length === 0}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Statistics
                  </Button>
                </CardContent>
              </Card>

              {/* Results */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Statistics Results</CardTitle>
                  <CardDescription>
                    {statsResults ? `${statsResults.total_n} observations analyzed` : 'Run analysis to see results'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsResults ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-6">
                        {statsResults.variables?.map(varStats => (
                          <div key={varStats.variable} className="border rounded-lg p-4">
                            <h4 className="font-medium mb-2">{varStats.label}</h4>
                            {varStats.type === 'numeric' ? (
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500">Mean</p>
                                  <p className="font-mono">{varStats.mean?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Median</p>
                                  <p className="font-mono">{varStats.median?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Std Dev</p>
                                  <p className="font-mono">{varStats.std?.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Min</p>
                                  <p className="font-mono">{varStats.min}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">Max</p>
                                  <p className="font-mono">{varStats.max}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">N / Missing</p>
                                  <p className="font-mono">{varStats.n} / {varStats.missing}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-sm text-slate-500">
                                  {varStats.unique_values} unique values • Mode: {varStats.mode}
                                </p>
                                <div className="space-y-1">
                                  {varStats.frequencies?.slice(0, 5).map(freq => (
                                    <div key={freq.value} className="flex items-center gap-2">
                                      <div className="w-24 truncate text-sm">{freq.value}</div>
                                      <div className="flex-1">
                                        <Progress value={freq.percent} className="h-2" />
                                      </div>
                                      <div className="w-20 text-right text-sm text-slate-500">
                                        {freq.count} ({freq.percent}%)
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select variables and click Calculate</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Advanced Statistics Tab */}
          <TabsContent value="advanced" className="space-y-4">
            {selectedFormId ? (
              <AdvancedStatsPanel
                formId={selectedFormId}
                snapshotId={selectedSnapshotId}
                orgId={currentOrg?.id}
                fields={formFields}
                getToken={getToken}
              />
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-slate-500">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a form to access advanced statistics</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Charts Tab - Chart Studio */}
          <TabsContent value="charts" className="space-y-4">
            {selectedFormId ? (
              <ChartStudio
                formId={selectedFormId}
                orgId={currentOrg?.id}
                fields={formFields}
                stats={statsResults}
                getToken={getToken}
              />
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-slate-500">
                    <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a form to create charts</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Dashboards Tab */}
          <TabsContent value="dashboards" className="space-y-4">
            <DashboardBuilder
              formId={selectedFormId}
              snapshotId={selectedSnapshotId}
              orgId={currentOrg?.id}
              fields={formFields}
              getToken={getToken}
            />
          </TabsContent>

          {/* AI Copilot Tab - Enhanced with Data Prep */}
          <TabsContent value="ai" className="space-y-4">
            {selectedFormId ? (
              <Tabs defaultValue="copilot" className="w-full">
                <TabsList className="grid grid-cols-2 w-[300px]">
                  <TabsTrigger value="copilot">AI Copilot</TabsTrigger>
                  <TabsTrigger value="dataprep">Data Prep</TabsTrigger>
                </TabsList>
                
                <TabsContent value="copilot" className="mt-4">
                  <EnhancedAICopilot
                    formId={selectedFormId}
                    snapshotId={selectedSnapshotId}
                    orgId={currentOrg?.id}
                    fields={formFields}
                    getToken={getToken}
                  />
                </TabsContent>
                
                <TabsContent value="dataprep" className="mt-4">
                  <AIDataPrep
                    formId={selectedFormId}
                    snapshotId={selectedSnapshotId}
                    orgId={currentOrg?.id}
                    onRefresh={fetchResponses}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-slate-500">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a form to use AI features</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Survey Stats Tab */}
          <TabsContent value="survey" className="space-y-4">
            {selectedFormId ? (
              <SurveyStatsPanel
                formId={selectedFormId}
                snapshotId={selectedSnapshotId}
                orgId={currentOrg?.id}
                fields={formFields}
                getToken={getToken}
              />
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-slate-500">
                    <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a form to use Survey Statistics</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            {selectedFormId ? (
              <ReportBuilder
                formId={selectedFormId}
                snapshotId={selectedSnapshotId}
                orgId={currentOrg?.id}
                getToken={getToken}
              />
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a form to create reports</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Diagnostics Tab */}
          <TabsContent value="diagnostics" className="space-y-4">
            <DiagnosticPlots
              formId={selectedFormId}
              snapshotId={selectedSnapshotId}
              orgId={currentOrg?.id}
              fields={formFields}
            />
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { format: 'csv', label: 'CSV', desc: 'Comma-separated values', icon: FileText },
                { format: 'xlsx', label: 'Excel', desc: 'Microsoft Excel with labels', icon: FileSpreadsheet },
                { format: 'spss', label: 'SPSS', desc: 'IBM SPSS (.sav) with labels', icon: Table },
                { format: 'stata', label: 'Stata', desc: 'Stata (.dta) with labels', icon: Table },
                { format: 'parquet', label: 'Parquet', desc: 'Efficient columnar format', icon: Database },
              ].map(exp => (
                <Card key={exp.format} className="cursor-pointer hover:border-sky-300 transition-colors" onClick={() => exportData(exp.format)}>
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="w-12 h-12 rounded-lg bg-sky-50 flex items-center justify-center">
                      <exp.icon className="h-6 w-6 text-sky-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{exp.label}</h4>
                      <p className="text-sm text-slate-500">{exp.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Generate Codebook</CardTitle>
                <CardDescription>Export variable documentation</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button variant="outline" onClick={() => exportData('xlsx')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Codebook (Excel)
                </Button>
                <Button variant="outline" onClick={() => exportData('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Codebook (CSV)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

export default DataAnalysisPage;
