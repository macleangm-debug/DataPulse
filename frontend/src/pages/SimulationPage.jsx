/**
 * DataPulse - AI Field Simulation Page
 * Synthetic path testing for form validation and optimization.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { 
  Play, 
  FileCheck, 
  AlertTriangle, 
  Clock, 
  Route, 
  Brain,
  CheckCircle,
  XCircle,
  BarChart3,
  RefreshCw,
  Download,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function SimulationPage() {
  const { currentOrg } = useAuthStore();
  const navigate = useNavigate();
  
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  
  // Simulation config
  const [config, setConfig] = useState({
    numSimulations: 100,
    mode: 'random',
    includeAiAnalysis: false
  });

  useEffect(() => {
    if (currentOrg?.id) {
      fetchForms();
      fetchReports();
    }
  }, [currentOrg?.id]);

  const fetchForms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/forms/${currentOrg.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setForms(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch forms:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch(`${API_URL}/api/simulation/reports/${currentOrg.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReports(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const runSimulation = async () => {
    if (!selectedForm) {
      toast.error('Please select a form');
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(`${API_URL}/api/simulation/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          form_id: selectedForm,
          org_id: currentOrg.id,
          num_simulations: config.numSimulations,
          mode: config.mode,
          include_ai_analysis: config.includeAiAnalysis
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentReport(data.report);
        toast.success(`Simulation complete! ${data.summary.completed_paths}/${data.summary.total_simulations} paths completed`);
        fetchReports();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Simulation failed');
      }
    } catch (error) {
      toast.error('Failed to run simulation');
    } finally {
      setIsRunning(false);
    }
  };

  const runQuickCheck = async () => {
    if (!selectedForm) {
      toast.error('Please select a form');
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(
        `${API_URL}/api/simulation/quick-check/${selectedForm}?org_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.recommendation);
        setCurrentReport({
          total_simulations: 10,
          completed_paths: data.issues.completed_paths,
          dead_end_paths: data.issues.failed_paths,
          dead_ends: data.issues.dead_ends,
          validation_issues: data.issues.validation_issues
        });
      } else {
        toast.error('Quick check failed');
      }
    } catch (error) {
      toast.error('Failed to run quick check');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="simulation-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Field Simulation</h1>
            <p className="text-muted-foreground">
              Test form paths and detect issues before deployment
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Simulation Config
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Form Selection */}
              <div className="space-y-2">
                <Label>Select Form</Label>
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a form..." />
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

              {/* Number of Simulations */}
              <div className="space-y-2">
                <Label>Number of Simulations</Label>
                <Input
                  type="number"
                  min={10}
                  max={1000}
                  value={config.numSimulations}
                  onChange={(e) => setConfig({...config, numSimulations: parseInt(e.target.value) || 100})}
                />
              </div>

              {/* Simulation Mode */}
              <div className="space-y-2">
                <Label>Simulation Mode</Label>
                <Select value={config.mode} onValueChange={(v) => setConfig({...config, mode: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random Responses</SelectItem>
                    <SelectItem value="edge_cases">Edge Cases</SelectItem>
                    <SelectItem value="realistic">Realistic (AI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI Analysis Toggle */}
              <div className="flex items-center justify-between">
                <Label>Include AI Analysis</Label>
                <Switch
                  checked={config.includeAiAnalysis}
                  onCheckedChange={(v) => setConfig({...config, includeAiAnalysis: v})}
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4">
                <Button 
                  className="w-full" 
                  onClick={runSimulation}
                  disabled={isRunning || !selectedForm}
                  data-testid="run-simulation-btn"
                >
                  {isRunning ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Full Simulation
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={runQuickCheck}
                  disabled={isRunning || !selectedForm}
                  data-testid="quick-check-btn"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Check (10 paths)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Simulation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentReport ? (
                <SimulationResults report={currentReport} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Route className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run a simulation to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Previous Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Previous Reports</CardTitle>
            <CardDescription>History of simulation runs</CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.slice(0, 10).map((report, idx) => (
                  <div 
                    key={report.id || idx}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setCurrentReport(report.report)}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Form: {report.form_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={report.report?.dead_end_paths > 0 ? 'destructive' : 'default'}>
                        {report.report?.completed_paths}/{report.report?.total_simulations} completed
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No previous reports</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

/**
 * Simulation Results Component
 */
function SimulationResults({ report }) {
  const completionRate = report.total_simulations > 0 
    ? (report.completed_paths / report.total_simulations * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-primary">{report.total_simulations}</div>
          <div className="text-xs text-muted-foreground">Total Paths</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{report.completed_paths}</div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{report.dead_end_paths || 0}</div>
          <div className="text-xs text-muted-foreground">Dead Ends</div>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold">{completionRate}%</div>
          <div className="text-xs text-muted-foreground">Success Rate</div>
        </div>
      </div>

      {/* Completion Rate Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Path Completion Rate</span>
          <span>{completionRate}%</span>
        </div>
        <Progress value={parseFloat(completionRate)} className="h-2" />
      </div>

      {/* Duration Stats */}
      {report.avg_duration_seconds && (
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">
                {Math.round(report.avg_duration_seconds / 60)} min
              </div>
              <div className="text-xs text-muted-foreground">Avg Duration</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Clock className="h-4 w-4 text-green-600" />
            <div>
              <div className="text-sm font-medium">
                {Math.round(report.min_duration_seconds / 60)} min
              </div>
              <div className="text-xs text-muted-foreground">Min Duration</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Clock className="h-4 w-4 text-orange-600" />
            <div>
              <div className="text-sm font-medium">
                {Math.round(report.max_duration_seconds / 60)} min
              </div>
              <div className="text-xs text-muted-foreground">Max Duration</div>
            </div>
          </div>
        </div>
      )}

      {/* Issues Found */}
      {(report.dead_ends?.length > 0 || report.validation_issues?.length > 0 || report.unreachable_questions?.length > 0) && (
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Issues Found
          </h4>

          {/* Dead Ends */}
          {report.dead_ends?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-600">Dead Ends ({report.dead_ends.length})</p>
              {report.dead_ends.slice(0, 5).map((de, idx) => (
                <div key={idx} className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                  <span className="font-mono">{de.from_field}</span> → {de.error}
                </div>
              ))}
            </div>
          )}

          {/* Unreachable Questions */}
          {report.unreachable_questions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-yellow-600">
                Unreachable Questions ({report.unreachable_questions.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {report.unreachable_questions.slice(0, 10).map((q, idx) => (
                  <Badge key={idx} variant="outline">{q}</Badge>
                ))}
                {report.unreachable_questions.length > 10 && (
                  <Badge variant="outline">+{report.unreachable_questions.length - 10} more</Badge>
                )}
              </div>
            </div>
          )}

          {/* Validation Issues */}
          {report.validation_issues?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-600">
                Validation Issues ({report.validation_issues.length})
              </p>
              {report.validation_issues.slice(0, 5).map((vi, idx) => (
                <div key={idx} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-sm">
                  <span className="font-mono">{vi.field_id}</span>: {vi.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Insights */}
      {report.ai_insights?.analysis && (
        <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <h4 className="font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600" />
            AI Analysis
          </h4>
          <p className="text-sm whitespace-pre-wrap">{report.ai_insights.analysis}</p>
        </div>
      )}

      {/* All Clear */}
      {!report.dead_ends?.length && !report.validation_issues?.length && !report.unreachable_questions?.length && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-green-700 dark:text-green-400">
          <CheckCircle className="h-5 w-5" />
          <span>No issues detected! Form looks ready for deployment.</span>
        </div>
      )}
    </div>
  );
}

export default SimulationPage;
