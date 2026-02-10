import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ReviewWorkflowPage() {
  const { currentOrg } = useOrgStore();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState('');

  useEffect(() => { if (currentOrg?.id) { loadStats(); loadQueue(); } }, [currentOrg?.id]);

  const loadStats = async () => {
    try {
      const r = await fetch(API_URL + '/api/review/queue/stats?org_id=' + currentOrg.id);
      if (r.ok) setStats(await r.json());
    } catch (e) { console.error(e); }
  };

  const loadQueue = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + '/api/review/queue?limit=50');
      if (r.ok) setQueue((await r.json()).submissions || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const claimSubmission = async (id) => {
    const r = await fetch(API_URL + '/api/review/submissions/' + id + '/claim', { method: 'POST' });
    if (r.ok) { toast.success('Claimed'); loadQueue(); loadStats(); }
  };

  const submitReview = async () => {
    if (!reviewDecision) return;
    const r = await fetch(API_URL + '/api/review/submissions/' + selectedSubmission.id + '/decide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: reviewDecision, notes: reviewNotes, quality_flags: [] })
    });
    if (r.ok) { toast.success('Done'); setReviewDialogOpen(false); loadQueue(); loadStats(); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-blue-400" />Review Workflow
        </h1>
        {stats && <div className="grid grid-cols-5 gap-4">
          <Card className="bg-slate-800/50 border-slate-700"><CardContent className="pt-4"><p className="text-slate-400">Pending</p><p className="text-2xl text-yellow-400">{stats.pending||0}</p></CardContent></Card>
          <Card className="bg-slate-800/50 border-slate-700"><CardContent className="pt-4"><p className="text-slate-400">In Review</p><p className="text-2xl text-blue-400">{stats.in_review||0}</p></CardContent></Card>
          <Card className="bg-slate-800/50 border-slate-700"><CardContent className="pt-4"><p className="text-slate-400">Approved</p><p className="text-2xl text-green-400">{stats.approved||0}</p></CardContent></Card>
          <Card className="bg-slate-800/50 border-slate-700"><CardContent className="pt-4"><p className="text-slate-400">Rejected</p><p className="text-2xl text-red-400">{stats.rejected||0}</p></CardContent></Card>
          <Card className="bg-slate-800/50 border-slate-700"><CardContent className="pt-4"><p className="text-slate-400">Corrections</p><p className="text-2xl text-orange-400">{stats.pending_corrections||0}</p></CardContent></Card>
        </div>}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader><CardTitle className="text-white">Review Queue</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" /> : queue.length === 0 ? <p className="text-center text-slate-400 py-8">No submissions pending review</p> : (
              <Table><TableHeader><TableRow className="border-slate-700"><TableHead className="text-slate-400">ID</TableHead><TableHead className="text-slate-400">Status</TableHead><TableHead className="text-slate-400">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{queue.map(s => <TableRow key={s.id} className="border-slate-700"><TableCell className="text-slate-300">{s.id?.slice(0,8)}...</TableCell><TableCell><Badge className="bg-yellow-500/20 text-yellow-400">{s.status}</Badge></TableCell><TableCell>
                  {s.status === 'pending' && <Button size="sm" onClick={() => claimSubmission(s.id)} className="bg-blue-600">Claim</Button>}
                  {s.status === 'in_review' && <Button size="sm" onClick={() => { setSelectedSubmission(s); setReviewDialogOpen(true); }} className="bg-green-600">Review</Button>}
                </TableCell></TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader><DialogTitle>Review Submission</DialogTitle></DialogHeader>
            <Select value={reviewDecision} onValueChange={setReviewDecision}><SelectTrigger className="bg-slate-700"><SelectValue placeholder="Decision" /></SelectTrigger><SelectContent><SelectItem value="approve">Approve</SelectItem><SelectItem value="reject">Reject</SelectItem></SelectContent></Select>
            <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} className="bg-slate-700" placeholder="Notes..." />
            <DialogFooter><Button onClick={() => setReviewDialogOpen(false)} variant="outline">Cancel</Button><Button onClick={submitReview} className="bg-blue-600">Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
