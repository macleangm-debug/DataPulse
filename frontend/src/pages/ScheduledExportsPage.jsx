import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Calendar, Clock, Mail, Cloud, Play, Pause, Settings, Plus, Trash2, Loader2, Download } from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ScheduledExportsPage() {
  const { currentOrg } = useOrgStore();
  const [exports, setExports] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', form_id: '', frequency: 'daily', schedule_time: '08:00',
    format: 'csv', destination: 'email', destination_config: { recipients: [] }
  });
  const [recipientInput, setRecipientInput] = useState('');

  useEffect(() => { if (currentOrg?.id) { loadExports(); loadForms(); } }, [currentOrg?.id]);

  const loadExports = async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + '/api/scheduled-exports');
      if (r.ok) setExports((await r.json()).exports || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadForms = async () => {
    try {
      const r = await fetch(API_URL + '/api/forms?org_id=' + currentOrg.id);
      if (r.ok) setForms(await r.json());
    } catch (e) { console.error(e); }
  };

  const createExport = async () => {
    try {
      const r = await fetch(API_URL + '/api/scheduled-exports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (r.ok) { toast.success('Created'); setCreateDialogOpen(false); loadExports(); }
      else toast.error('Failed');
    } catch (e) { toast.error('Failed'); }
  };

  const toggleExport = async (id) => {
    const r = await fetch(API_URL + '/api/scheduled-exports/' + id + '/toggle', { method: 'POST' });
    if (r.ok) { toast.success('Toggled'); loadExports(); }
  };

  const runNow = async (id) => {
    toast.info('Running export...');
    const r = await fetch(API_URL + '/api/scheduled-exports/' + id + '/run', { method: 'POST' });
    if (r.ok) { toast.success('Export completed'); loadExports(); }
    else toast.error('Export failed');
  };

  const deleteExport = async (id) => {
    if (!window.confirm('Delete this scheduled export?')) return;
    const r = await fetch(API_URL + '/api/scheduled-exports/' + id, { method: 'DELETE' });
    if (r.ok) { toast.success('Deleted'); loadExports(); }
  };

  const addRecipient = () => {
    if (recipientInput && recipientInput.includes('@')) {
      setFormData({
        ...formData,
        destination_config: {
          ...formData.destination_config,
          recipients: [...(formData.destination_config.recipients || []), recipientInput]
        }
      });
      setRecipientInput('');
    }
  };

  const getDestinationIcon = (dest) => {
    if (dest === 'email') return <Mail className="h-4 w-4" />;
    if (dest === 's3' || dest === 'google_drive') return <Cloud className="h-4 w-4" />;
    return <Download className="h-4 w-4" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="h-6 w-6 text-green-400" />Scheduled Exports
            </h1>
            <p className="text-slate-400 mt-1">Automate data exports to email, cloud storage, or webhooks</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />New Export Schedule
          </Button>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader><CardTitle className="text-white">Scheduled Exports</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-green-400" /> : exports.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No scheduled exports yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Frequency</TableHead>
                    <TableHead className="text-slate-400">Format</TableHead>
                    <TableHead className="text-slate-400">Destination</TableHead>
                    <TableHead className="text-slate-400">Last Run</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map(exp => (
                    <TableRow key={exp.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{exp.name}</TableCell>
                      <TableCell className="text-slate-300 capitalize">{exp.frequency}</TableCell>
                      <TableCell><Badge variant="outline" className="border-slate-600 text-slate-300">{exp.format?.toUpperCase()}</Badge></TableCell>
                      <TableCell className="text-slate-300 flex items-center gap-1">{getDestinationIcon(exp.destination)} {exp.destination}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{exp.last_run_at ? formatDistanceToNow(new Date(exp.last_run_at), { addSuffix: true }) : 'Never'}</TableCell>
                      <TableCell><Badge className={exp.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}>{exp.is_active ? 'Active' : 'Paused'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleExport(exp.id)} className="text-slate-400 hover:text-white">
                            {exp.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => runNow(exp.id)} className="text-slate-400 hover:text-green-400">
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteExport(exp.id)} className="text-slate-400 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
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

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Scheduled Export</DialogTitle>
              <DialogDescription className="text-slate-400">Set up automatic data exports</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-slate-300">Name</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-700 border-slate-600" placeholder="Daily submissions export" /></div>
              <div><Label className="text-slate-300">Form</Label>
                <Select value={formData.form_id} onValueChange={v => setFormData({...formData, form_id: v})}>
                  <SelectTrigger className="bg-slate-700 border-slate-600"><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>{forms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-slate-300">Frequency</Label>
                  <Select value={formData.frequency} onValueChange={v => setFormData({...formData, frequency: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-slate-300">Time</Label><Input type="time" value={formData.schedule_time} onChange={e => setFormData({...formData, schedule_time: e.target.value})} className="bg-slate-700 border-slate-600" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-slate-300">Format</Label>
                  <Select value={formData.format} onValueChange={v => setFormData({...formData, format: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-slate-300">Destination</Label>
                  <Select value={formData.destination} onValueChange={v => setFormData({...formData, destination: v})}>
                    <SelectTrigger className="bg-slate-700 border-slate-600"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="s3">Amazon S3</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.destination === 'email' && (
                <div><Label className="text-slate-300">Recipients</Label>
                  <div className="flex gap-2">
                    <Input value={recipientInput} onChange={e => setRecipientInput(e.target.value)} className="bg-slate-700 border-slate-600" placeholder="email@example.com" />
                    <Button onClick={addRecipient} variant="outline">Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(formData.destination_config.recipients || []).map((r, i) => <Badge key={i} variant="outline" className="border-slate-600">{r}</Badge>)}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={createExport} className="bg-green-600 hover:bg-green-700">Create Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
