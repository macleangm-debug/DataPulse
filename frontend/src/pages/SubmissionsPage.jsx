import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  Clock,
  User
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useProjectStore } from '../store';
import { submissionAPI, formAPI, projectAPI, exportAPI } from '../lib/api';
import { formatDateTime, getStatusVariant, getQualityColor, downloadFile } from '../lib/utils';
import { toast } from 'sonner';

const SubmissionRow = ({ submission, onView, onReview }) => (
  <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => onView(submission)}>
    <TableCell className="font-mono text-xs">{submission.id.slice(0, 8)}...</TableCell>
    <TableCell>
      <Badge variant={getStatusVariant(submission.status)}>
        {submission.status}
      </Badge>
    </TableCell>
    <TableCell>
      <span className={`font-mono ${getQualityColor(submission.quality_score)}`}>
        {submission.quality_score?.toFixed(0) || '-'}%
      </span>
    </TableCell>
    <TableCell>{formatDateTime(submission.submitted_at)}</TableCell>
    <TableCell>
      {submission.gps_location ? (
        <div className="flex items-center gap-1 text-xs">
          <MapPin className="w-3 h-3" />
          {submission.gps_location.lat?.toFixed(4)}, {submission.gps_location.lng?.toFixed(4)}
        </div>
      ) : '-'}
    </TableCell>
    <TableCell>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onView(submission); }}>
          <Eye className="w-4 h-4" />
        </Button>
        {submission.status === 'pending' && (
          <>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onReview(submission, 'approved'); }}>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onReview(submission, 'rejected'); }}>
              <XCircle className="w-4 h-4 text-red-500" />
            </Button>
          </>
        )}
      </div>
    </TableCell>
  </TableRow>
);

const SubmissionDetail = ({ submission, onClose, onReview }) => {
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');

  const handleReview = async () => {
    await onReview(submission.id, reviewStatus, reviewNotes);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-barlow">Submission Details</DialogTitle>
          <DialogDescription>
            ID: {submission.id}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={getStatusVariant(submission.status)}>{submission.status}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Quality Score</p>
                <span className={`font-mono font-medium ${getQualityColor(submission.quality_score)}`}>
                  {submission.quality_score?.toFixed(0) || '-'}%
                </span>
              </div>
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p>{formatDateTime(submission.submitted_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">GPS Location</p>
                <p className="font-mono text-xs">
                  {submission.gps_location 
                    ? `${submission.gps_location.lat?.toFixed(6)}, ${submission.gps_location.lng?.toFixed(6)}`
                    : 'Not captured'
                  }
                </p>
              </div>
            </div>

            {/* Quality Flags */}
            {submission.quality_flags?.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Quality Flags</p>
                <div className="flex flex-wrap gap-2">
                  {submission.quality_flags.map((flag, idx) => (
                    <Badge key={idx} variant="outline" className="text-yellow-500 border-yellow-500/50">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {flag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Data */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Form Data</p>
              <div className="bg-muted/50 rounded-sm p-4 space-y-2">
                {Object.entries(submission.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Section */}
            {submission.status === 'pending' && (
              <div className="space-y-4 pt-4 border-t border-border">
                <p className="font-medium">Review Submission</p>
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Approve
                        </div>
                      </SelectItem>
                      <SelectItem value="rejected">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          Reject
                        </div>
                      </SelectItem>
                      <SelectItem value="flagged">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          Flag for Review
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Optional notes about this review"
                    rows={2}
                  />
                </div>
                <Button onClick={handleReview} disabled={!reviewStatus} className="w-full">
                  Submit Review
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export function SubmissionsPage() {
  const [searchParams] = useSearchParams();
  const { currentOrg } = useOrgStore();
  const { projects } = useProjectStore();
  const [submissions, setSubmissions] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      loadForms();
    }
  }, [currentOrg]);

  useEffect(() => {
    if (selectedForm) {
      loadSubmissions();
    }
  }, [selectedForm, statusFilter]);

  const loadForms = async () => {
    try {
      const projectsRes = await projectAPI.list(currentOrg.id);
      const allForms = [];
      for (const project of projectsRes.data) {
        const formsRes = await formAPI.list(project.id);
        allForms.push(...formsRes.data.map(f => ({ ...f, projectName: project.name })));
      }
      setForms(allForms);
      if (allForms.length > 0 && !selectedForm) {
        setSelectedForm(allForms[0].id);
      }
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const response = await submissionAPI.list(selectedForm, {
        status_filter: statusFilter === 'all' ? null : statusFilter
      });
      setSubmissions(response.data);
    } catch (error) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (submissionId, status, notes) => {
    try {
      await submissionAPI.review(submissionId, status, notes);
      setSubmissions(submissions.map(s => 
        s.id === submissionId ? { ...s, status } : s
      ));
      toast.success(`Submission ${status}`);
    } catch (error) {
      toast.error('Failed to review submission');
    }
  };

  const handleExport = async (format) => {
    if (!selectedForm) return;
    setExporting(true);
    try {
      const exportFn = format === 'csv' ? exportAPI.toCSV : 
                       format === 'xlsx' ? exportAPI.toXLSX : exportAPI.toJSON;
      const response = await exportFn(selectedForm);
      const form = forms.find(f => f.id === selectedForm);
      downloadFile(response.data, `${form?.name || 'export'}.${format}`);
      toast.success('Export downloaded');
    } catch (error) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  if (!currentOrg) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-400">Please select an organization first</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="submissions-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Submissions</h1>
            <p className="text-gray-400">View and review collected data</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedForm} onValueChange={setSelectedForm}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-barlow font-bold">{submissions.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-barlow font-bold text-yellow-500">
                {submissions.filter(s => s.status === 'pending').length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-barlow font-bold text-green-500">
                {submissions.filter(s => s.status === 'approved').length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-barlow font-bold text-red-500">
                {submissions.filter(s => s.status === 'rejected').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Export */}
        {selectedForm && submissions.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('xlsx')} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>
        )}

        {/* Table */}
        <Card className="bg-card border border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : submissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <SubmissionRow
                      key={submission.id}
                      submission={submission}
                      onView={setViewingSubmission}
                      onReview={(sub, status) => handleReview(sub.id, status, '')}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <Database className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {selectedForm ? 'No submissions found' : 'Select a form to view submissions'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        {viewingSubmission && (
          <SubmissionDetail
            submission={viewingSubmission}
            onClose={() => setViewingSubmission(null)}
            onReview={handleReview}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
