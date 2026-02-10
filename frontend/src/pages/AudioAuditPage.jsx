/**
 * Audio Audit Management Page
 * Configure and review audio recordings from field data collection
 */

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Mic,
  Play,
  Pause,
  Download,
  Flag,
  CheckCircle,
  Clock,
  Settings,
  BarChart3,
  User,
  Calendar,
  Filter,
  Search,
  Loader2,
  Volume2
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export default function AudioAuditPage() {
  const { currentOrg } = useOrgStore();
  const [activeTab, setActiveTab] = useState('recordings');
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [recordings, setRecordings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [audioRef, setAudioRef] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    if (currentOrg?.id) {
      loadForms();
      loadStats();
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    if (selectedForm) {
      loadRecordings();
      loadConfig();
    }
  }, [selectedForm, statusFilter, typeFilter]);

  const loadForms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/forms?org_id=${currentOrg.id}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setForms(data);
      }
    } catch (error) {
      console.error('Failed to load forms:', error);
    }
  };

  const loadRecordings = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/audio-audit/recordings?form_id=${selectedForm}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (typeFilter) url += `&recording_type=${typeFilter}`;

      const response = await fetch(url, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/audio-audit/stats?org_id=${currentOrg.id}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await fetch(`${API_URL}/api/audio-audit/config/${selectedForm}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      const response = await fetch(`${API_URL}/api/audio-audit/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          form_id: selectedForm,
          config: newConfig
        })
      });

      if (response.ok) {
        toast.success('Audio audit configuration saved');
        setConfig(newConfig);
        setConfigDialogOpen(false);
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const reviewRecording = async (status, notes, flags = []) => {
    try {
      const response = await fetch(`${API_URL}/api/audio-audit/recordings/${selectedRecording.id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ status, notes, quality_flags: flags })
      });

      if (response.ok) {
        toast.success('Recording reviewed');
        setReviewDialogOpen(false);
        loadRecordings();
        loadStats();
      } else {
        toast.error('Failed to review recording');
      }
    } catch (error) {
      toast.error('Failed to review recording');
    }
  };

  const playRecording = async (recording) => {
    if (playingId === recording.id) {
      if (audioRef) {
        audioRef.pause();
        audioRef.currentTime = 0;
      }
      setPlayingId(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/audio-audit/recordings/${recording.id}/download`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to load audio');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
      
      setAudioRef(audio);
      setPlayingId(recording.id);
    } catch (error) {
      toast.error('Failed to play recording');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      uploaded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      reviewed: 'bg-green-500/20 text-green-400 border-green-500/30',
      flagged: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return <Badge className={styles[status] || styles.pending}>{status}</Badge>;
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Mic className="h-6 w-6 text-purple-400" />
              Audio Audit
            </h1>
            <p className="text-slate-400 mt-1">
              Review audio recordings from field data collection
            </p>
          </div>
          {selectedForm && (
            <Button
              onClick={() => setConfigDialogOpen(true)}
              variant="outline"
              className="border-slate-600 text-slate-300"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Recordings</p>
                    <p className="text-2xl font-bold text-white">{stats.total_recordings}</p>
                  </div>
                  <Volume2 className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Duration</p>
                    <p className="text-2xl font-bold text-white">{stats.total_duration_hours?.toFixed(1)}h</p>
                  </div>
                  <Clock className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Pending Review</p>
                    <p className="text-2xl font-bold text-white">{stats.pending_count}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Flagged</p>
                    <p className="text-2xl font-bold text-white">{stats.flagged_count}</p>
                  </div>
                  <Flag className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Form Selection */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-slate-300 mb-2 block">Select Form</Label>
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select a form to view recordings" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="uploaded">Uploaded</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 mb-2 block">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value="full">Full Recording</SelectItem>
                    <SelectItem value="random_spot">Random Spot Check</SelectItem>
                    <SelectItem value="segment">Segment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recordings Table */}
        {selectedForm && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Recordings</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                </div>
              ) : recordings.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recordings found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-400">Submission</TableHead>
                      <TableHead className="text-slate-400">Enumerator</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Duration</TableHead>
                      <TableHead className="text-slate-400">Recorded</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordings.map((recording) => (
                      <TableRow key={recording.id} className="border-slate-700">
                        <TableCell className="text-slate-300 font-mono text-sm">
                          {recording.submission_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-slate-300">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-500" />
                            {recording.enumerator_id?.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            {recording.recording_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {formatDuration(recording.duration_seconds)}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {recording.recorded_at && formatDistanceToNow(new Date(recording.recorded_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>{getStatusBadge(recording.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => playRecording(recording)}
                              className="text-slate-400 hover:text-white"
                            >
                              {playingId === recording.id ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRecording(recording);
                                setReviewDialogOpen(true);
                              }}
                              className="text-slate-400 hover:text-white"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Config Dialog */}
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Audio Audit Configuration</DialogTitle>
              <DialogDescription className="text-slate-400">
                Configure audio recording settings for this form
              </DialogDescription>
            </DialogHeader>
            {config && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">Enable Audio Audit</Label>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Recording Mode</Label>
                  <Select
                    value={config.mode}
                    onValueChange={(value) => setConfig({ ...config, mode: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Recording</SelectItem>
                      <SelectItem value="random">Random Spot Checks</SelectItem>
                      <SelectItem value="segments">Segments</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.mode === 'random' && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">
                      Random Recording Percentage: {config.random_percentage}%
                    </Label>
                    <Slider
                      value={[config.random_percentage]}
                      onValueChange={([value]) => setConfig({ ...config, random_percentage: value })}
                      max={100}
                      step={5}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-slate-300">Audio Quality</Label>
                  <Select
                    value={config.quality}
                    onValueChange={(value) => setConfig({ ...config, quality: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (smaller files)</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High (larger files)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">Show Recording Indicator</Label>
                  <Switch
                    checked={config.notify_enumerator}
                    onCheckedChange={(checked) => setConfig({ ...config, notify_enumerator: checked })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveConfig(config)} className="bg-blue-600 hover:bg-blue-700">
                Save Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Review Recording</DialogTitle>
              <DialogDescription className="text-slate-400">
                Listen to the recording and provide your review
              </DialogDescription>
            </DialogHeader>
            {selectedRecording && (
              <div className="space-y-4">
                <div className="bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Duration</span>
                    <span className="text-white">{formatDuration(selectedRecording.duration_seconds)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Type</span>
                    <span className="text-white">{selectedRecording.recording_type}</span>
                  </div>
                </div>
                <Button
                  onClick={() => playRecording(selectedRecording)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {playingId === selectedRecording.id ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop Playback
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Play Recording
                    </>
                  )}
                </Button>
              </div>
            )}
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => reviewRecording('flagged', '', ['quality_issue'])}
                className="border-red-600 text-red-400 hover:bg-red-900/20"
              >
                <Flag className="h-4 w-4 mr-2" />
                Flag Issue
              </Button>
              <Button
                onClick={() => reviewRecording('reviewed', '')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Reviewed
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
