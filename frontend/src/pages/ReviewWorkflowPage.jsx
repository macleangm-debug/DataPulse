import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '../components/ui/dialog';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { 
  ClipboardCheck, 
  Loader2, 
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  FileText,
  MessageSquare,
  ChevronRight,
  RefreshCw,
  Eye,
  Edit3,
  Send,
  History,
  Flag,
  ArrowUpRight,
  Calendar,
  MapPin,
  BarChart3
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Status badge component
const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    in_review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    correction_requested: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    corrected: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  
  const labels = {
    pending: 'Pending',
    in_review: 'In Review',
    approved: 'Approved',
    rejected: 'Rejected',
    correction_requested: 'Correction Requested',
    corrected: 'Corrected',
  };
  
  return (
    <Badge className={`${styles[status] || styles.pending} border`}>
      {labels[status] || status}
    </Badge>
  );
};

// Priority badge component
const PriorityBadge = ({ priority }) => {
  const styles = {
    low: 'bg-slate-500/20 text-slate-400',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <Badge className={styles[priority] || styles.medium}>
      {priority?.toUpperCase() || 'MEDIUM'}
    </Badge>
  );
};

// Stats card component
const StatCard = ({ label, value, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    purple: 'text-purple-400',
  };
  
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${colorClasses[color]} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  );
};

export default function ReviewWorkflowPage() {
  const { currentOrg } = useOrgStore();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [submissionDetails, setSubmissionDetails] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [qualityFlags, setQualityFlags] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Correction request state
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctionPriority, setCorrectionPriority] = useState('medium');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [fieldCorrections, setFieldCorrections] = useState([]);
  
  // Detail sheet state
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  
  // Corrections list
  const [corrections, setCorrections] = useState([]);
  
  const getAuthHeaders = useCallback(() => {
    // Try multiple sources for the auth token
    let token = localStorage.getItem('access_token');
    
    // Fallback: Check auth-storage (Zustand persisted store)
    if (!token) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token || null;
        } catch (e) {
          console.error('Failed to parse auth-storage:', e);
        }
      }
    }
    
    // Fallback: Check 'token' key
    if (!token) {
      token = localStorage.getItem('token');
    }
    
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (currentOrg?.id) params.append('org_id', currentOrg.id);
      
      const r = await fetch(`${API_URL}/api/review/queue/stats?${params}`, {
        headers: getAuthHeaders()
      });
      if (r.ok) setStats(await r.json());
    } catch (e) { 
      console.error('Failed to load stats:', e); 
    }
  }, [currentOrg?.id, getAuthHeaders]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      const r = await fetch(`${API_URL}/api/review/queue?${params}`, {
        headers: getAuthHeaders()
      });
      if (r.ok) {
        const data = await r.json();
        setQueue(data.submissions || []);
      }
    } catch (e) { 
      console.error('Failed to load queue:', e); 
    } finally { 
      setLoading(false); 
    }
  }, [statusFilter, getAuthHeaders]);
  
  const loadCorrections = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/review/corrections?limit=50`, {
        headers: getAuthHeaders()
      });
      if (r.ok) {
        const data = await r.json();
        setCorrections(data.corrections || []);
      }
    } catch (e) { 
      console.error('Failed to load corrections:', e); 
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadStats();
    loadQueue();
    loadCorrections();
  }, [loadStats, loadQueue, loadCorrections]);
  
  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadQueue(), loadCorrections()]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const claimSubmission = async (id) => {
    try {
      const r = await fetch(`${API_URL}/api/review/submissions/${id}/claim`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (r.ok) { 
        toast.success('Submission claimed for review'); 
        loadQueue(); 
        loadStats(); 
      } else {
        const error = await r.json();
        toast.error(error.detail || 'Failed to claim submission');
      }
    } catch (e) {
      toast.error('Failed to claim submission');
    }
  };
  
  const releaseSubmission = async (id) => {
    try {
      const r = await fetch(`${API_URL}/api/review/submissions/${id}/release`, { 
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (r.ok) { 
        toast.success('Submission released'); 
        loadQueue(); 
        loadStats(); 
      } else {
        const error = await r.json();
        toast.error(error.detail || 'Failed to release submission');
      }
    } catch (e) {
      toast.error('Failed to release submission');
    }
  };
  
  const loadSubmissionDetails = async (submission) => {
    setSelectedSubmission(submission);
    setSubmissionDetails(null);
    setDetailSheetOpen(true);
    
    // In a real implementation, you'd fetch full submission data here
    // For now, we'll use what we have
    setSubmissionDetails({
      ...submission,
      data: submission.data || {},
      review_history: submission.review_history || []
    });
  };
  
  const openReviewDialog = (submission) => {
    setSelectedSubmission(submission);
    setReviewDecision('');
    setReviewNotes('');
    setQualityFlags([]);
    setReviewDialogOpen(true);
  };
  
  const openCorrectionDialog = () => {
    setCorrectionPriority('medium');
    setCorrectionNotes('');
    setFieldCorrections([]);
    setCorrectionDialogOpen(true);
  };

  const submitReview = async () => {
    if (!reviewDecision) {
      toast.error('Please select a decision');
      return;
    }
    
    setSubmittingReview(true);
    try {
      const r = await fetch(`${API_URL}/api/review/submissions/${selectedSubmission.id}/decide`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ 
          decision: reviewDecision, 
          notes: reviewNotes, 
          quality_flags: qualityFlags 
        })
      });
      
      if (r.ok) { 
        toast.success(`Submission ${reviewDecision === 'approve' ? 'approved' : reviewDecision === 'reject' ? 'rejected' : 'sent for correction'}`);
        setReviewDialogOpen(false);
        setDetailSheetOpen(false);
        loadQueue(); 
        loadStats(); 
      } else {
        const error = await r.json();
        toast.error(error.detail || 'Failed to submit review');
      }
    } catch (e) {
      toast.error('Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };
  
  const submitCorrectionRequest = async () => {
    if (fieldCorrections.length === 0 && !correctionNotes) {
      toast.error('Please specify corrections needed');
      return;
    }
    
    try {
      const r = await fetch(`${API_URL}/api/review/corrections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          submission_id: selectedSubmission.id,
          priority: correctionPriority,
          field_corrections: fieldCorrections,
          general_notes: correctionNotes
        })
      });
      
      if (r.ok) {
        toast.success('Correction request sent');
        setCorrectionDialogOpen(false);
        setReviewDialogOpen(false);
        setDetailSheetOpen(false);
        loadQueue();
        loadStats();
        loadCorrections();
      } else {
        const error = await r.json();
        toast.error(error.detail || 'Failed to create correction request');
      }
    } catch (e) {
      toast.error('Failed to create correction request');
    }
  };
  
  const addFieldCorrection = () => {
    setFieldCorrections([
      ...fieldCorrections,
      { field_id: '', field_name: '', current_value: '', issue_description: '', is_required: true }
    ]);
  };
  
  const updateFieldCorrection = (index, field, value) => {
    const updated = [...fieldCorrections];
    updated[index] = { ...updated[index], [field]: value };
    setFieldCorrections(updated);
  };
  
  const removeFieldCorrection = (index) => {
    setFieldCorrections(fieldCorrections.filter((_, i) => i !== index));
  };
  
  const toggleQualityFlag = (flag) => {
    if (qualityFlags.includes(flag)) {
      setQualityFlags(qualityFlags.filter(f => f !== flag));
    } else {
      setQualityFlags([...qualityFlags, flag]);
    }
  };
  
  // Filter queue based on search
  const filteredQueue = queue.filter(s => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      s.id?.toLowerCase().includes(search) ||
      s.form_id?.toLowerCase().includes(search) ||
      s.submitted_by?.toLowerCase().includes(search)
    );
  });

  const qualityFlagOptions = [
    { id: 'speeding', label: 'Speeding', description: 'Completed too quickly' },
    { id: 'straightlining', label: 'Straight-lining', description: 'Same answers throughout' },
    { id: 'gps_anomaly', label: 'GPS Anomaly', description: 'Location issues detected' },
    { id: 'incomplete', label: 'Incomplete', description: 'Missing required data' },
    { id: 'duplicate', label: 'Possible Duplicate', description: 'Similar to another submission' },
    { id: 'outlier', label: 'Outlier Values', description: 'Unusual data values' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="review-workflow-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-blue-400" />
              Review Workflow
            </h1>
            <p className="text-muted-foreground mt-1">
              Review, approve, or request corrections on submissions
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={refreshing}
            data-testid="refresh-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="stats-cards">
            <StatCard label="Pending" value={stats.pending || 0} icon={Clock} color="yellow" />
            <StatCard label="In Review" value={stats.in_review || 0} icon={Eye} color="blue" />
            <StatCard label="Approved" value={stats.approved || 0} icon={CheckCircle2} color="green" />
            <StatCard label="Rejected" value={stats.rejected || 0} icon={XCircle} color="red" />
            <StatCard label="Corrections" value={stats.correction_requested || 0} icon={Edit3} color="orange" />
            <StatCard label="Total" value={stats.total || 0} icon={BarChart3} color="purple" />
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="queue" className="data-[state=active]:bg-primary">
              Review Queue
            </TabsTrigger>
            <TabsTrigger value="corrections" className="data-[state=active]:bg-primary">
              Correction Requests
            </TabsTrigger>
          </TabsList>

          {/* Review Queue Tab */}
          <TabsContent value="queue" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-white">Submissions Queue</CardTitle>
                    <CardDescription>
                      {filteredQueue.length} submissions to review
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search submissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64"
                        data-testid="search-input"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40" data-testid="status-filter">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="correction_requested">Correction Requested</SelectItem>
                        <SelectItem value="corrected">Corrected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  </div>
                ) : filteredQueue.length === 0 ? (
                  <div className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No submissions pending review</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      New submissions will appear here for review
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Submission ID</TableHead>
                          <TableHead className="text-muted-foreground">Form</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">Quality Score</TableHead>
                          <TableHead className="text-muted-foreground">Submitted</TableHead>
                          <TableHead className="text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQueue.map(submission => (
                          <TableRow 
                            key={submission.id} 
                            className="border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => loadSubmissionDetails(submission)}
                            data-testid={`submission-row-${submission.id}`}
                          >
                            <TableCell className="font-mono text-sm">
                              {submission.id?.slice(0, 8)}...
                              {submission.pending_corrections > 0 && (
                                <Badge className="ml-2 bg-orange-500/20 text-orange-400">
                                  {submission.pending_corrections} corrections
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {submission.form_id?.slice(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={submission.status} />
                            </TableCell>
                            <TableCell>
                              {submission.quality_score !== undefined ? (
                                <span className={`font-medium ${
                                  submission.quality_score >= 80 ? 'text-green-400' :
                                  submission.quality_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {submission.quality_score}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {submission.submitted_at ? (
                                formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })
                              ) : '-'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-2">
                                {submission.status === 'pending' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => claimSubmission(submission.id)}
                                    data-testid={`claim-btn-${submission.id}`}
                                  >
                                    Claim
                                  </Button>
                                )}
                                {submission.status === 'in_review' && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      onClick={() => openReviewDialog(submission)}
                                      data-testid={`review-btn-${submission.id}`}
                                    >
                                      Review
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => releaseSubmission(submission.id)}
                                    >
                                      Release
                                    </Button>
                                  </>
                                )}
                                {submission.status === 'corrected' && (
                                  <Button 
                                    size="sm"
                                    onClick={() => claimSubmission(submission.id)}
                                  >
                                    Re-review
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => loadSubmissionDetails(submission)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Corrections Tab */}
          <TabsContent value="corrections" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-white">Correction Requests</CardTitle>
                <CardDescription>
                  Track field-level corrections sent to enumerators
                </CardDescription>
              </CardHeader>
              <CardContent>
                {corrections.length === 0 ? (
                  <div className="text-center py-12">
                    <Edit3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No correction requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {corrections.map(correction => (
                      <Card key={correction.id} className="bg-muted/30 border-border">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{correction.submission_id?.slice(0, 8)}...</span>
                                <PriorityBadge priority={correction.priority} />
                                <Badge className={
                                  correction.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                  correction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }>
                                  {correction.status}
                                </Badge>
                              </div>
                              {correction.general_notes && (
                                <p className="text-sm text-muted-foreground">{correction.general_notes}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  Assigned to: {correction.assigned_to?.slice(0, 8)}...
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(correction.created_at), { addSuffix: true })}
                                </span>
                                {correction.field_corrections?.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {correction.field_corrections.length} field(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Submission Detail Sheet */}
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Submission Details
              </SheetTitle>
              <SheetDescription>
                {selectedSubmission?.id?.slice(0, 8)}...
              </SheetDescription>
            </SheetHeader>
            
            {submissionDetails && (
              <ScrollArea className="h-[calc(100vh-200px)] mt-4 pr-4">
                <div className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <StatusBadge status={submissionDetails.status} />
                    {submissionDetails.quality_score !== undefined && (
                      <span className={`font-medium ${
                        submissionDetails.quality_score >= 80 ? 'text-green-400' :
                        submissionDetails.quality_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        Quality: {submissionDetails.quality_score}%
                      </span>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Metadata */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white">Metadata</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Form ID:</div>
                      <div className="font-mono">{submissionDetails.form_id?.slice(0, 12)}...</div>
                      
                      <div className="text-muted-foreground">Submitted By:</div>
                      <div className="font-mono">{submissionDetails.submitted_by?.slice(0, 12)}...</div>
                      
                      <div className="text-muted-foreground">Submitted At:</div>
                      <div>
                        {submissionDetails.submitted_at 
                          ? format(new Date(submissionDetails.submitted_at), 'PPp')
                          : '-'}
                      </div>
                      
                      {submissionDetails.reviewer_id && (
                        <>
                          <div className="text-muted-foreground">Reviewer:</div>
                          <div className="font-mono">{submissionDetails.reviewer_id?.slice(0, 12)}...</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Form Data */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-white">Form Data</h4>
                    {submissionDetails.data && Object.keys(submissionDetails.data).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(submissionDetails.data).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                            <span className="text-muted-foreground">{key}</span>
                            <span className="text-white font-medium">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data available</p>
                    )}
                  </div>
                  
                  {/* Review History */}
                  {submissionDetails.review_history?.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Review History
                        </h4>
                        <div className="space-y-2">
                          {submissionDetails.review_history.map((entry, idx) => (
                            <div key={idx} className="p-3 bg-muted/30 rounded-lg text-sm">
                              <div className="flex items-center justify-between">
                                <Badge className={
                                  entry.decision === 'approve' ? 'bg-green-500/20 text-green-400' :
                                  entry.decision === 'reject' ? 'bg-red-500/20 text-red-400' :
                                  'bg-orange-500/20 text-orange-400'
                                }>
                                  {entry.decision}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                              {entry.notes && (
                                <p className="mt-2 text-muted-foreground">{entry.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Actions */}
                  {submissionDetails.status === 'in_review' && (
                    <div className="pt-4">
                      <Button 
                        className="w-full" 
                        onClick={() => openReviewDialog(submissionDetails)}
                      >
                        Submit Review Decision
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>

        {/* Review Decision Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Review Submission</DialogTitle>
              <DialogDescription>
                Choose a decision and provide notes for submission {selectedSubmission?.id?.slice(0, 8)}...
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Decision Selection */}
              <div className="space-y-2">
                <Label>Decision</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={reviewDecision === 'approve' ? 'default' : 'outline'}
                    className={reviewDecision === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setReviewDecision('approve')}
                    data-testid="approve-btn"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant={reviewDecision === 'reject' ? 'default' : 'outline'}
                    className={reviewDecision === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
                    onClick={() => setReviewDecision('reject')}
                    data-testid="reject-btn"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant={reviewDecision === 'request_correction' ? 'default' : 'outline'}
                    className={reviewDecision === 'request_correction' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    onClick={() => {
                      setReviewDecision('request_correction');
                      openCorrectionDialog();
                    }}
                    data-testid="correction-btn"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Correct
                  </Button>
                </div>
              </div>
              
              {/* Quality Flags */}
              <div className="space-y-2">
                <Label>Quality Flags (Optional)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {qualityFlagOptions.map(flag => (
                    <div 
                      key={flag.id}
                      className={`flex items-start space-x-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        qualityFlags.includes(flag.id) ? 'bg-primary/20' : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => toggleQualityFlag(flag.id)}
                    >
                      <Checkbox 
                        checked={qualityFlags.includes(flag.id)}
                        onCheckedChange={() => toggleQualityFlag(flag.id)}
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{flag.label}</p>
                        <p className="text-xs text-muted-foreground">{flag.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Notes */}
              <div className="space-y-2">
                <Label>Review Notes</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your review decision..."
                  rows={3}
                  data-testid="review-notes"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={submitReview} 
                disabled={!reviewDecision || submittingReview}
                data-testid="submit-review-btn"
              >
                {submittingReview ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Correction Request Dialog */}
        <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Request Corrections</DialogTitle>
              <DialogDescription>
                Specify field-level corrections needed for this submission
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 py-4 pr-4">
                {/* Priority */}
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={correctionPriority} onValueChange={setCorrectionPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Field Corrections */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Field Corrections</Label>
                    <Button size="sm" variant="outline" onClick={addFieldCorrection}>
                      Add Field
                    </Button>
                  </div>
                  
                  {fieldCorrections.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No specific field corrections. Add fields or use general notes.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {fieldCorrections.map((fc, idx) => (
                        <Card key={idx} className="bg-muted/30">
                          <CardContent className="pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Input
                                placeholder="Field name"
                                value={fc.field_name}
                                onChange={(e) => updateFieldCorrection(idx, 'field_name', e.target.value)}
                                className="w-40"
                              />
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeFieldCorrection(idx)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                            <Textarea
                              placeholder="Describe what needs to be corrected..."
                              value={fc.issue_description}
                              onChange={(e) => updateFieldCorrection(idx, 'issue_description', e.target.value)}
                              rows={2}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* General Notes */}
                <div className="space-y-2">
                  <Label>General Notes</Label>
                  <Textarea
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    placeholder="General instructions for the enumerator..."
                    rows={3}
                  />
                </div>
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitCorrectionRequest}>
                <Send className="h-4 w-4 mr-2" />
                Send Correction Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
