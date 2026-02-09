import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { useAuthStore, useOrgStore } from '../store';
import { 
  Brain, Zap, AlertTriangle, Timer, Mic, Eye, CheckCircle2, XCircle,
  RefreshCw, Plus, TrendingUp, Shield, Activity, BarChart3, Bell,
  Clock, FileWarning, Settings, Play
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const severityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
};

const alertTypeIcons = {
  speeding: Timer,
  audio_missing: Mic,
  audio_short: Mic,
  pattern_anomaly: Activity,
  response_anomaly: FileWarning,
  gps_anomaly: Eye,
  duplicate_pattern: AlertTriangle,
  straight_lining: TrendingUp
};

const alertTypeLabels = {
  speeding: 'Interview Speeding',
  audio_missing: 'Missing Audio',
  audio_short: 'Short Audio',
  pattern_anomaly: 'Pattern Anomaly',
  response_anomaly: 'Response Anomaly',
  gps_anomaly: 'GPS Anomaly',
  duplicate_pattern: 'Duplicate Pattern',
  straight_lining: 'Straight-lining'
};

export function QualityAIPage() {
  const { token } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const [alerts, setAlerts] = useState([]);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [speedingConfigs, setSpeedingConfigs] = useState([]);
  const [audioConfigs, setAudioConfigs] = useState([]);
  const [aiConfigs, setAiConfigs] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSpeedingDialog, setShowSpeedingDialog] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchAll();
    }
  }, [currentOrg?.id]);

  const fetchAll = async () => {
    await Promise.all([
      fetchAlerts(),
      fetchAlertsSummary(),
      fetchSpeedingConfigs(),
      fetchAudioConfigs(),
      fetchAIConfigs(),
      fetchForms()
    ]);
    setLoading(false);
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/alerts/${currentOrg.id}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts');
    }
  };

  const fetchAlertsSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/alerts/${currentOrg.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAlertsSummary(data);
    } catch (err) {
      console.error('Failed to load alerts summary');
    }
  };

  const fetchSpeedingConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/speeding/configs/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSpeedingConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to load speeding configs');
    }
  };

  const fetchAudioConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/audio-audit/configs/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAudioConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to load audio configs');
    }
  };

  const fetchAIConfigs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/ai-monitoring/configs/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAiConfigs(data.configs || []);
    } catch (err) {
      console.error('Failed to load AI configs');
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/forms?org_id=${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setForms(data || []);
    } catch (err) {
      console.error('Failed to load forms');
    }
  };

  const handleCreateSpeedingConfig = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/speeding/configs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, org_id: currentOrg.id })
      });
      if (res.ok) {
        toast.success('Speeding detection configured');
        fetchSpeedingConfigs();
        setShowSpeedingDialog(false);
      }
    } catch (err) {
      toast.error('Failed to create configuration');
    }
  };

  const handleCreateAudioConfig = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/audio-audit/configs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, org_id: currentOrg.id })
      });
      if (res.ok) {
        toast.success('Audio audit configured');
        fetchAudioConfigs();
        setShowAudioDialog(false);
      }
    } catch (err) {
      toast.error('Failed to create configuration');
    }
  };

  const handleCreateAIConfig = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/ai-monitoring/configs`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, org_id: currentOrg.id })
      });
      if (res.ok) {
        toast.success('AI monitoring configured');
        fetchAIConfigs();
        setShowAIDialog(false);
      }
    } catch (err) {
      toast.error('Failed to create configuration');
    }
  };

  const handleRunBatchAnalysis = async () => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/batch-analyze/${currentOrg.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ hours: 24 })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
      }
    } catch (err) {
      toast.error('Failed to start batch analysis');
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      const res = await fetch(`${API_URL}/api/quality-ai/alerts/${alertId}/resolve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ resolution: 'Reviewed and resolved' })
      });
      if (res.ok) {
        toast.success('Alert resolved');
        fetchAlerts();
        fetchAlertsSummary();
      }
    } catch (err) {
      toast.error('Failed to resolve alert');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="quality-ai-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quality & AI Monitoring</h1>
            <p className="text-muted-foreground">Automated quality detection with AI-powered analysis</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAll}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleRunBatchAnalysis}>
              <Play className="w-4 h-4 mr-2" />
              Run Batch Analysis
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertsSummary?.total_open || 0}</p>
                  <p className="text-sm text-muted-foreground">Open Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertsSummary?.total_resolved || 0}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Timer className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertsSummary?.by_type?.speeding || 0}</p>
                  <p className="text-sm text-muted-foreground">Speeding</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Brain className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertsSummary?.by_type?.pattern_anomaly || 0}</p>
                  <p className="text-sm text-muted-foreground">AI Detected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Mic className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {(alertsSummary?.by_type?.audio_missing || 0) + (alertsSummary?.by_type?.audio_short || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Audio Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">Quality Alerts</TabsTrigger>
            <TabsTrigger value="speeding">Speeding Detection</TabsTrigger>
            <TabsTrigger value="audio">Audio Audit</TabsTrigger>
            <TabsTrigger value="ai">AI Monitoring</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            <AlertsList alerts={alerts} onResolve={handleResolveAlert} />
          </TabsContent>

          <TabsContent value="speeding" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showSpeedingDialog} onOpenChange={setShowSpeedingDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Configure Speeding Detection
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <SpeedingConfigForm forms={forms} onSubmit={handleCreateSpeedingConfig} />
                </DialogContent>
              </Dialog>
            </div>
            <ConfigList 
              configs={speedingConfigs} 
              type="speeding"
              emptyMessage="No speeding detection configurations yet"
              emptyIcon={Timer}
            />
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAudioDialog} onOpenChange={setShowAudioDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Configure Audio Audit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <AudioConfigForm forms={forms} onSubmit={handleCreateAudioConfig} />
                </DialogContent>
              </Dialog>
            </div>
            <ConfigList 
              configs={audioConfigs} 
              type="audio"
              emptyMessage="No audio audit configurations yet"
              emptyIcon={Mic}
            />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Configure AI Monitoring
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <AIConfigForm onSubmit={handleCreateAIConfig} />
                </DialogContent>
              </Dialog>
            </div>
            <ConfigList 
              configs={aiConfigs} 
              type="ai"
              emptyMessage="No AI monitoring configurations yet"
              emptyIcon={Brain}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function AlertsList({ alerts, onResolve }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No open alerts</h3>
          <p className="text-muted-foreground">All quality checks passed. Great work!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const Icon = alertTypeIcons[alert.alert_type] || AlertTriangle;
        return (
          <Card key={alert.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${severityColors[alert.severity]}/10`}>
                    <Icon className={`w-5 h-5 ${severityColors[alert.severity].replace('bg-', 'text-')}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{alertTypeLabels[alert.alert_type] || alert.alert_type}</h4>
                      <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                      <Badge variant="outline">{alert.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Submission: {alert.submission_id?.slice(0, 12)}...
                    </p>
                    {alert.details && (
                      <div className="text-sm bg-muted p-2 rounded">
                        {alert.alert_type === 'speeding' && alert.details.speed_ratio && (
                          <span>Completed at {Math.round(alert.details.speed_ratio * 100)}% of median time</span>
                        )}
                        {alert.alert_type === 'straight_lining' && alert.details.patterns && (
                          <span>{alert.details.patterns.join(', ')}</span>
                        )}
                        {alert.alert_type === 'audio_short' && alert.details.issues && (
                          <span>{alert.details.issues[0]?.message}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                  {alert.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => onResolve(alert.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ConfigList({ configs, type, emptyMessage, emptyIcon: EmptyIcon }) {
  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <EmptyIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">{emptyMessage}</h3>
          <p className="text-muted-foreground">Configure automated quality detection to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {configs.map((config) => (
        <Card key={config.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={config.is_active ? 'default' : 'secondary'}>
                    {config.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {type === 'speeding' && (
                    <>
                      <span className="text-sm text-muted-foreground">
                        Warning: {config.warning_threshold_percent}% | Critical: {config.critical_threshold_percent}%
                      </span>
                    </>
                  )}
                  {type === 'audio' && (
                    <span className="text-sm text-muted-foreground">
                      Min duration: {config.min_duration_seconds}s | Sample: {config.sample_percentage}%
                    </span>
                  )}
                  {type === 'ai' && (
                    <span className="text-sm text-muted-foreground">
                      AI Analysis: {config.use_ai_analysis ? 'Enabled' : 'Disabled'} ({config.ai_analysis_sample_rate}% sample)
                    </span>
                  )}
                </div>
                
                <p className="text-sm">Form: {config.form_id?.slice(0, 12) || 'All forms'}...</p>
              </div>
              
              <div className="text-right">
                <p className="text-lg font-bold">{config.stats?.total_analyzed || 0}</p>
                <p className="text-xs text-muted-foreground">Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SpeedingConfigForm({ forms, onSubmit }) {
  const [formData, setFormData] = useState({
    form_id: '',
    min_completion_time_seconds: 120,
    warning_threshold_percent: 50,
    critical_threshold_percent: 25,
    auto_flag_critical: true
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configure Speeding Detection</DialogTitle>
        <DialogDescription>Flag submissions completed too quickly</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Form</Label>
          <Select value={formData.form_id} onValueChange={(v) => setFormData({...formData, form_id: v})}>
            <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
            <SelectContent>
              {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Min Expected Time (seconds)</Label>
          <Input 
            type="number" 
            value={formData.min_completion_time_seconds}
            onChange={(e) => setFormData({...formData, min_completion_time_seconds: parseInt(e.target.value)})}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Warning Threshold (%)</Label>
            <Input 
              type="number" 
              value={formData.warning_threshold_percent}
              onChange={(e) => setFormData({...formData, warning_threshold_percent: parseFloat(e.target.value)})}
            />
          </div>
          <div className="grid gap-2">
            <Label>Critical Threshold (%)</Label>
            <Input 
              type="number" 
              value={formData.critical_threshold_percent}
              onChange={(e) => setFormData({...formData, critical_threshold_percent: parseFloat(e.target.value)})}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Auto-flag Critical</Label>
          <Switch 
            checked={formData.auto_flag_critical}
            onCheckedChange={(v) => setFormData({...formData, auto_flag_critical: v})}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(formData)} disabled={!formData.form_id}>Create</Button>
      </DialogFooter>
    </>
  );
}

function AudioConfigForm({ forms, onSubmit }) {
  const [formData, setFormData] = useState({
    form_id: '',
    audio_field_id: '',
    min_duration_seconds: 30,
    sample_percentage: 10
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configure Audio Audit</DialogTitle>
        <DialogDescription>Verify audio recording quality</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Form</Label>
          <Select value={formData.form_id} onValueChange={(v) => setFormData({...formData, form_id: v})}>
            <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
            <SelectContent>
              {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Audio Field ID</Label>
          <Input 
            value={formData.audio_field_id}
            onChange={(e) => setFormData({...formData, audio_field_id: e.target.value})}
            placeholder="consent_audio"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Min Duration (seconds)</Label>
            <Input 
              type="number" 
              value={formData.min_duration_seconds}
              onChange={(e) => setFormData({...formData, min_duration_seconds: parseInt(e.target.value)})}
            />
          </div>
          <div className="grid gap-2">
            <Label>Sample Rate (%)</Label>
            <Input 
              type="number" 
              value={formData.sample_percentage}
              onChange={(e) => setFormData({...formData, sample_percentage: parseFloat(e.target.value)})}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(formData)} disabled={!formData.form_id || !formData.audio_field_id}>Create</Button>
      </DialogFooter>
    </>
  );
}

function AIConfigForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    detect_speeding: true,
    detect_straight_lining: true,
    detect_response_anomalies: true,
    detect_gps_anomalies: true,
    detect_duplicates: true,
    use_ai_analysis: true,
    ai_analysis_sample_rate: 5,
    anomaly_score_threshold: 0.7
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Configure AI Monitoring</DialogTitle>
        <DialogDescription>Enable AI-powered anomaly detection with GPT-5.2</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>Detect Speeding</Label>
              <p className="text-xs text-muted-foreground">Flag fast completions</p>
            </div>
            <Switch checked={formData.detect_speeding} onCheckedChange={(v) => setFormData({...formData, detect_speeding: v})} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>Detect Straight-lining</Label>
              <p className="text-xs text-muted-foreground">Same answers pattern</p>
            </div>
            <Switch checked={formData.detect_straight_lining} onCheckedChange={(v) => setFormData({...formData, detect_straight_lining: v})} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>Response Anomalies</Label>
              <p className="text-xs text-muted-foreground">Inconsistent answers</p>
            </div>
            <Switch checked={formData.detect_response_anomalies} onCheckedChange={(v) => setFormData({...formData, detect_response_anomalies: v})} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>GPS Anomalies</Label>
              <p className="text-xs text-muted-foreground">Location issues</p>
            </div>
            <Switch checked={formData.detect_gps_anomalies} onCheckedChange={(v) => setFormData({...formData, detect_gps_anomalies: v})} />
          </div>
        </div>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              AI Deep Analysis (GPT-5.2)
            </Label>
            <p className="text-xs text-muted-foreground">Advanced pattern detection using AI</p>
          </div>
          <Switch checked={formData.use_ai_analysis} onCheckedChange={(v) => setFormData({...formData, use_ai_analysis: v})} />
        </div>
        
        {formData.use_ai_analysis && (
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>AI Sample Rate (%)</Label>
              <Input 
                type="number" 
                value={formData.ai_analysis_sample_rate}
                onChange={(e) => setFormData({...formData, ai_analysis_sample_rate: parseFloat(e.target.value)})}
              />
              <p className="text-xs text-muted-foreground">% of submissions for deep AI analysis</p>
            </div>
            <div className="grid gap-2">
              <Label>Anomaly Threshold</Label>
              <Input 
                type="number" 
                step="0.1"
                min="0"
                max="1"
                value={formData.anomaly_score_threshold}
                onChange={(e) => setFormData({...formData, anomaly_score_threshold: parseFloat(e.target.value)})}
              />
              <p className="text-xs text-muted-foreground">Score above this triggers alert (0-1)</p>
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(formData)}>Enable Monitoring</Button>
      </DialogFooter>
    </>
  );
}

export default QualityAIPage;
