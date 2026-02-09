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
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { useAuthStore, useOrgStore } from '../store';
import { 
  Phone, PhoneCall, PhoneOff, Clock, User, Play, Pause, SkipForward,
  Calendar, BarChart3, Users, CheckCircle2, XCircle, Plus, Upload,
  Timer, MessageSquare, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const dispositionLabels = {
  complete: 'Complete',
  partial_complete: 'Partial Complete',
  no_answer: 'No Answer',
  busy: 'Busy',
  voicemail: 'Voicemail',
  disconnected: 'Disconnected',
  wrong_number: 'Wrong Number',
  callback_requested: 'Callback Requested',
  respondent_unavailable: 'Respondent Unavailable',
  language_barrier: 'Language Barrier',
  soft_refusal: 'Soft Refusal',
  hard_refusal: 'Hard Refusal',
  refused_gatekeeper: 'Refused (Gatekeeper)',
  ineligible: 'Ineligible',
  system_error: 'System Error'
};

const dispositionColors = {
  complete: 'bg-green-500',
  partial_complete: 'bg-emerald-400',
  callback_requested: 'bg-blue-500',
  no_answer: 'bg-yellow-500',
  busy: 'bg-orange-500',
  voicemail: 'bg-purple-500',
  soft_refusal: 'bg-red-400',
  hard_refusal: 'bg-red-600',
  disconnected: 'bg-gray-500'
};

export function CATIPage() {
  const { token, user } = useAuthStore();
  const { currentOrg } = useOrgStore();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [forms, setForms] = useState([]);

  useEffect(() => {
    if (currentOrg?.id) {
      fetchProjects();
      fetchForms();
    }
  }, [currentOrg?.id]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/cati/projects/${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      toast.error('Failed to load CATI projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/forms?org_id=${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setForms(data.forms || []);
    } catch (err) {
      console.error('Failed to load forms');
    }
  };

  const handleCreateProject = async (formData) => {
    try {
      const res = await fetch(`${API_URL}/api/cati/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...formData,
          org_id: currentOrg.id
        })
      });
      
      if (res.ok) {
        toast.success('CATI project created');
        fetchProjects();
        setShowCreateDialog(false);
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to create project');
      }
    } catch (err) {
      toast.error('Failed to create project');
    }
  };

  const handleActivateProject = async (projectId) => {
    try {
      const res = await fetch(`${API_URL}/api/cati/projects/${projectId}/activate`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Project activated');
        fetchProjects();
      }
    } catch (err) {
      toast.error('Failed to activate project');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="cati-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CATI Center</h1>
            <p className="text-muted-foreground">Computer-Assisted Telephone Interviewing</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveTab('workstation')}>
              <PhoneCall className="w-4 h-4 mr-2" />
              Open Workstation
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button data-testid="create-cati-project-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New CATI Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <CreateCATIProjectForm 
                  forms={forms}
                  onSubmit={handleCreateProject}
                  onClose={() => setShowCreateDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Phone className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projects.length}</p>
                  <p className="text-sm text-muted-foreground">Projects</p>
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
                  <p className="text-2xl font-bold">
                    {projects.reduce((sum, p) => sum + (p.stats?.completed || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {projects.reduce((sum, p) => sum + (p.stats?.pending || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {projects.length > 0 
                      ? Math.round(projects.reduce((sum, p) => sum + (p.stats?.completion_rate || 0), 0) / projects.length)
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Completion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="workstation">Workstation</TabsTrigger>
            <TabsTrigger value="callbacks">Callbacks</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4 mt-4">
            {loading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Loading CATI projects...
                </CardContent>
              </Card>
            ) : projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No CATI projects yet</h3>
                  <p className="text-muted-foreground mb-4">Create a CATI project to start telephone interviewing</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create CATI Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {projects.map((project) => (
                  <CATIProjectCard
                    key={project.id}
                    project={project}
                    onSelect={() => setSelectedProject(project)}
                    onActivate={() => handleActivateProject(project.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="workstation" className="mt-4">
            <InterviewerWorkstation 
              projects={projects.filter(p => p.status === 'active')}
              interviewerId={user?.id}
            />
          </TabsContent>

          <TabsContent value="callbacks" className="mt-4">
            <CallbacksManager projects={projects} />
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <CATIStatistics projects={projects} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function CATIProjectCard({ project, onSelect, onActivate }) {
  const stats = project.stats || {};
  const total = stats.total_cases || 0;
  const completed = stats.completed || 0;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={onSelect}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg">{project.name}</h3>
              <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                {project.status}
              </Badge>
            </div>
            
            {project.description && (
              <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{completed} / {total} ({Math.round(progress)}%)</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="grid grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xl font-bold text-blue-500">{stats.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-500">{stats.in_progress || 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-500">{completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-500">{stats.exhausted || 0}</p>
                <p className="text-xs text-muted-foreground">Exhausted</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {project.status === 'setup' && (
              <Button size="sm" onClick={onActivate}>
                <Play className="w-4 h-4 mr-2" />
                Activate
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Load Queue
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InterviewerWorkstation({ projects, interviewerId }) {
  const { token } = useAuthStore();
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [currentCall, setCurrentCall] = useState(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isOnCall, setIsOnCall] = useState(false);
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState('');

  useEffect(() => {
    let interval;
    if (isOnCall) {
      interval = setInterval(() => setCallTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isOnCall]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getNextCall = async () => {
    if (!selectedProjectId) return;
    
    try {
      const res = await fetch(
        `${API_URL}/api/cati/workstation/${interviewerId}/next-call?project_id=${selectedProjectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      
      if (data.queue_item) {
        setCurrentCall(data.queue_item);
        toast.success(data.already_locked ? 'Resumed existing call' : 'New call loaded');
      } else {
        toast.info('No calls available in queue');
      }
    } catch (err) {
      toast.error('Failed to get next call');
    }
  };

  const startCall = async () => {
    if (!currentCall) return;
    
    try {
      await fetch(`${API_URL}/api/cati/workstation/start/${currentCall.id}?interviewer_id=${interviewerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsOnCall(true);
      setCallTimer(0);
    } catch (err) {
      toast.error('Failed to start call');
    }
  };

  const endCall = async () => {
    if (!currentCall || !disposition) {
      toast.error('Please select a disposition');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/cati/workstation/record-call`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          queue_item_id: currentCall.id,
          interviewer_id: interviewerId,
          start_time: new Date(Date.now() - callTimer * 1000).toISOString(),
          end_time: new Date().toISOString(),
          duration_seconds: callTimer,
          disposition,
          notes,
          callback_datetime: callbackDate || null
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        toast.success(`Call recorded: ${disposition}`);
        setCurrentCall(null);
        setIsOnCall(false);
        setCallTimer(0);
        setDisposition('');
        setNotes('');
        setCallbackDate('');
      }
    } catch (err) {
      toast.error('Failed to record call');
    }
  };

  const releaseCall = async () => {
    if (!currentCall) return;
    
    try {
      await fetch(`${API_URL}/api/cati/workstation/release/${currentCall.id}?interviewer_id=${interviewerId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentCall(null);
      setIsOnCall(false);
      setCallTimer(0);
      toast.success('Call released');
    } catch (err) {
      toast.error('Failed to release call');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Call Panel */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5" />
                Call Panel
              </CardTitle>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {!currentCall ? (
              <div className="text-center py-12">
                <Phone className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Ready to make calls</h3>
                <p className="text-muted-foreground mb-6">Click below to get your next call from the queue</p>
                <Button size="lg" onClick={getNextCall} disabled={!selectedProjectId}>
                  <Phone className="w-5 h-5 mr-2" />
                  Get Next Call
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Respondent Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Respondent Information
                    </h4>
                    <Badge>Attempt #{(currentCall.attempt_count || 0) + 1}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Case ID</Label>
                      <p className="font-mono">{currentCall.case_id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <p>{currentCall.respondent_name || 'Not provided'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Primary Phone</Label>
                      <p className="font-mono text-lg font-bold">{currentCall.phone_primary}</p>
                    </div>
                    {currentCall.phone_secondary && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Secondary Phone</Label>
                        <p className="font-mono">{currentCall.phone_secondary}</p>
                      </div>
                    )}
                  </div>
                  
                  {currentCall.notes && (
                    <div className="mt-4 p-3 bg-yellow-500/10 rounded border border-yellow-500/20">
                      <p className="text-sm"><strong>Notes:</strong> {currentCall.notes}</p>
                    </div>
                  )}
                </div>

                {/* Call Timer */}
                <div className="flex items-center justify-center gap-8 py-6">
                  <div className="text-center">
                    <p className="text-5xl font-mono font-bold">{formatTime(callTimer)}</p>
                    <p className="text-sm text-muted-foreground mt-2">Call Duration</p>
                  </div>
                </div>

                {/* Call Controls */}
                <div className="flex items-center justify-center gap-4">
                  {!isOnCall ? (
                    <>
                      <Button variant="outline" size="lg" onClick={releaseCall}>
                        <SkipForward className="w-5 h-5 mr-2" />
                        Skip
                      </Button>
                      <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={startCall}>
                        <Phone className="w-5 h-5 mr-2" />
                        Start Call
                      </Button>
                    </>
                  ) : (
                    <Button size="lg" variant="destructive" onClick={() => setIsOnCall(false)}>
                      <PhoneOff className="w-5 h-5 mr-2" />
                      End Call
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disposition Panel */}
        {currentCall && !isOnCall && callTimer > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Record Call Outcome</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Disposition</Label>
                <Select value={disposition} onValueChange={setDisposition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="partial_complete">Partial Complete</SelectItem>
                    <SelectItem value="callback_requested">Callback Requested</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number</SelectItem>
                    <SelectItem value="respondent_unavailable">Respondent Unavailable</SelectItem>
                    <SelectItem value="language_barrier">Language Barrier</SelectItem>
                    <SelectItem value="soft_refusal">Soft Refusal</SelectItem>
                    <SelectItem value="hard_refusal">Hard Refusal</SelectItem>
                    <SelectItem value="ineligible">Ineligible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {disposition === 'callback_requested' && (
                <div className="grid gap-2">
                  <Label>Callback Date/Time</Label>
                  <Input 
                    type="datetime-local"
                    value={callbackDate}
                    onChange={(e) => setCallbackDate(e.target.value)}
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this call..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={releaseCall}>Cancel</Button>
                <Button onClick={endCall} disabled={!disposition}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save & Get Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar - Stats & History */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calls Made</span>
                <span className="font-medium">--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-green-500">--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contact Rate</span>
                <span className="font-medium">--%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Duration</span>
                <span className="font-medium">--:--</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Call Script</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-2">Introduction:</p>
              <p className="text-muted-foreground">
                &quot;Hello, my name is [Your Name] calling from [Organization]. 
                We are conducting a survey about [Topic]. This call may be 
                recorded for quality purposes. Do you have a few minutes to 
                participate?&quot;
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CallbacksManager({ projects }) {
  const [callbacks, setCallbacks] = useState([]);
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scheduled Callbacks</CardTitle>
            <CardDescription>Manage callback appointments</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No scheduled callbacks</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CATIStatistics({ projects }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Disposition Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(dispositionLabels).slice(0, 8).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${dispositionColors[key] || 'bg-gray-400'}`} />
                <span className="flex-1 text-sm">{label}</span>
                <span className="font-medium">0</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interviewer Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No performance data yet</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateCATIProjectForm({ forms, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    form_id: '',
    max_call_attempts: 5,
    min_hours_between_attempts: 2,
    working_hours_start: 9,
    working_hours_end: 21
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create CATI Project</DialogTitle>
        <DialogDescription>Set up a new telephone interviewing project</DialogDescription>
      </DialogHeader>
      
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label>Project Name</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Q4 Phone Survey"
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea 
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Optional description..."
          />
        </div>
        
        <div className="grid gap-2">
          <Label>Survey Form</Label>
          <Select 
            value={formData.form_id}
            onValueChange={(v) => setFormData({...formData, form_id: v})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a form" />
            </SelectTrigger>
            <SelectContent>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Max Call Attempts</Label>
            <Input 
              type="number"
              min={1}
              value={formData.max_call_attempts}
              onChange={(e) => setFormData({...formData, max_call_attempts: parseInt(e.target.value)})}
            />
          </div>
          <div className="grid gap-2">
            <Label>Hours Between Attempts</Label>
            <Input 
              type="number"
              min={1}
              value={formData.min_hours_between_attempts}
              onChange={(e) => setFormData({...formData, min_hours_between_attempts: parseInt(e.target.value)})}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Working Hours Start</Label>
            <Select 
              value={formData.working_hours_start.toString()}
              onValueChange={(v) => setFormData({...formData, working_hours_start: parseInt(v)})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 24}, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Working Hours End</Label>
            <Select 
              value={formData.working_hours_end.toString()}
              onValueChange={(v) => setFormData({...formData, working_hours_end: parseInt(v)})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 24}, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} disabled={!formData.name || !formData.form_id}>
          Create Project
        </Button>
      </DialogFooter>
    </>
  );
}

export default CATIPage;
