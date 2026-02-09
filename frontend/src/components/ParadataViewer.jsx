import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  MousePointer,
  Edit3,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  MapPin,
  Camera,
  Mic,
  Video,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Activity,
  TrendingUp,
  User,
  Smartphone
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Progress } from './ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { useAuthStore } from '../store';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const EventIcon = ({ type }) => {
  const iconMap = {
    form_start: Play,
    form_end: Play,
    page_enter: ArrowRight,
    page_exit: ArrowLeft,
    question_focus: MousePointer,
    question_blur: MousePointer,
    nav_forward: ArrowRight,
    nav_backward: ArrowLeft,
    value_change: Edit3,
    session_pause: Pause,
    session_resume: Play,
    gps_capture: MapPin,
    photo_capture_start: Camera,
    photo_capture_end: Camera,
    audio_record_start: Mic,
    audio_record_end: Mic,
    video_record_start: Video,
    video_record_end: Video,
    validation_fail: AlertTriangle,
  };
  
  const Icon = iconMap[type] || Activity;
  return <Icon className="w-4 h-4" />;
};

const EventTypeColors = {
  form_start: 'bg-green-500/20 text-green-500 border-green-500/30',
  form_end: 'bg-red-500/20 text-red-500 border-red-500/30',
  page_enter: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  page_exit: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  question_focus: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  question_blur: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  nav_forward: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
  nav_backward: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  value_change: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  session_pause: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  session_resume: 'bg-green-500/20 text-green-500 border-green-500/30',
  validation_fail: 'bg-red-500/20 text-red-500 border-red-500/30',
};

const TimelineEvent = ({ event, isLast }) => {
  const colorClass = EventTypeColors[event.event_type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${colorClass}`}>
          <EventIcon type={event.event_type} />
        </div>
        {!isLast && <div className="w-0.5 h-full bg-border/50 my-1" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {event.event_type?.replace(/_/g, ' ')}
          </Badge>
          <span className="text-xs text-gray-400">{timestamp}</span>
        </div>
        {event.question_name && (
          <p className="text-sm text-white mt-1">{event.question_name}</p>
        )}
        {event.event_type === 'value_change' && (
          <div className="mt-1 text-xs">
            <span className="text-gray-400">Changed: </span>
            <span className="text-red-400 line-through">{String(event.old_value || 'empty')}</span>
            <span className="text-gray-400"> → </span>
            <span className="text-green-400">{String(event.new_value || 'empty')}</span>
          </div>
        )}
        {event.latitude && event.longitude && (
          <p className="text-xs text-gray-400 mt-1">
            📍 {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
          </p>
        )}
      </div>
    </div>
  );
};

const QuestionTimingBar = ({ timing, maxTime }) => {
  const percentage = maxTime > 0 ? (timing.total_time_seconds / maxTime) * 100 : 0;
  
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-32 truncate">
        <p className="text-sm text-white truncate">{timing.question_name}</p>
        <p className="text-xs text-gray-400">{timing.question_type}</p>
      </div>
      <div className="flex-1">
        <div className="h-4 bg-card rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </div>
      <div className="w-20 text-right">
        <span className="text-sm text-white">{timing.total_time_seconds.toFixed(1)}s</span>
        {timing.edit_count > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">{timing.edit_count} edits</Badge>
        )}
      </div>
    </div>
  );
};

export function ParadataViewer({ submissionId }) {
  const [loading, setLoading] = useState(true);
  const [paradata, setParadata] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [expandedSessions, setExpandedSessions] = useState({});

  useEffect(() => {
    if (submissionId) {
      loadParadata();
    }
  }, [submissionId]);

  const loadParadata = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [paradataRes, timelineRes] = await Promise.all([
        fetch(`${API_URL}/api/paradata/submissions/${submissionId}`, { headers }),
        fetch(`${API_URL}/api/paradata/submissions/${submissionId}/timeline`, { headers })
      ]);

      setParadata(await paradataRes.json());
      setTimeline((await timelineRes.json()).timeline || []);
    } catch (error) {
      console.error('Failed to load paradata:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 text-center">
          <Activity className="w-8 h-8 animate-pulse mx-auto text-primary" />
          <p className="text-gray-400 mt-2">Loading paradata...</p>
        </CardContent>
      </Card>
    );
  }

  if (!paradata || !paradata.sessions?.length) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 text-center">
          <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No paradata available for this submission</p>
        </CardContent>
      </Card>
    );
  }

  const summary = paradata.summary || {};
  const questionTimings = paradata.question_timings || [];
  const maxQuestionTime = Math.max(...questionTimings.map(q => q.total_time_seconds), 1);

  return (
    <div className="space-y-4" data-testid="paradata-viewer">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-gray-400">Total Duration</p>
                <p className="text-lg font-bold text-white">
                  {Math.floor(summary.total_duration_seconds / 60)}m {Math.floor(summary.total_duration_seconds % 60)}s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-xs text-gray-400">Total Edits</p>
                <p className="text-lg font-bold text-white">{summary.total_edits || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-xs text-gray-400">Backtracks</p>
                <p className="text-lg font-bold text-white">{summary.total_backtracks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-xs text-gray-400">Pause Time</p>
                <p className="text-lg font-bold text-white">
                  {Math.floor((summary.total_pause_seconds || 0) / 60)}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="questions">Question Timing</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-white">Event Timeline</CardTitle>
              <CardDescription>{timeline.length} events recorded</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {timeline.map((event, idx) => (
                  <TimelineEvent
                    key={idx}
                    event={event}
                    isLast={idx === timeline.length - 1}
                  />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-white">Time per Question</CardTitle>
              <CardDescription>
                Sorted by time spent (longest first)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {questionTimings
                  .sort((a, b) => b.total_time_seconds - a.total_time_seconds)
                  .map((timing, idx) => (
                    <QuestionTimingBar
                      key={idx}
                      timing={timing}
                      maxTime={maxQuestionTime}
                    />
                  ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-white">Interview Sessions</CardTitle>
              <CardDescription>
                {paradata.sessions.length} session(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {paradata.sessions.map((session) => (
                  <Collapsible
                    key={session.id}
                    open={expandedSessions[session.id]}
                    onOpenChange={() => toggleSession(session.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-gray-400" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-white">
                              {session.device_model || 'Unknown Device'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {session.device_os} • {session.app_version}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {Math.floor((session.total_duration_seconds || 0) / 60)}m
                          </Badge>
                          {expandedSessions[session.id] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-2">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Active Time</p>
                            <p className="text-white">{session.active_duration_seconds?.toFixed(0)}s</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Edits</p>
                            <p className="text-white">{session.total_edits || 0}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Backtracks</p>
                            <p className="text-white">{session.total_backtracking || 0}</p>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ParadataViewer;
