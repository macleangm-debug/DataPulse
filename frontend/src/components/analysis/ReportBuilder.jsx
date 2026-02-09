/**
 * Report Builder - Create professional analysis reports
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { 
  FileText, Plus, Trash2, MoveUp, MoveDown, Download, Save, FileType, Table, BarChart3, Type, Minus, Loader2, File, FileSpreadsheet,
  Package, Archive, RefreshCw, CheckCircle, Clock, Hash, Database, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { AuditTrail } from './AuditTrail';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function ReportBuilder({ formId, snapshotId, orgId, getToken }) {
  const [activeTab, setActiveTab] = useState('reports');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState({ title: 'Analysis Report', subtitle: '', author: '', sections: [] });
  
  // Reproducibility Pack state
  const [packs, setPacks] = useState([]);
  const [packLoading, setPackLoading] = useState(false);
  const [newPack, setNewPack] = useState({
    name: '',
    description: '',
    include_raw_data: true,
    include_scripts: true,
    anonymize: false
  });

  useEffect(() => {
    fetchTemplates();
    fetchPacks();
  }, [orgId]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/reports/templates/${orgId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) setTemplates(await response.json());
    } catch (error) { console.error(error); }
  };

  const fetchPacks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/reproducibility/packs/${orgId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (response.ok) setPacks(await response.json());
    } catch (error) { console.error(error); }
  };

  const addSection = (type) => {
    setReport(prev => ({
      ...prev,
      sections: [...prev.sections, { id: `s_${Date.now()}`, type, title: '', content: '' }]
    }));
  };

  const generateReport = async (format) => {
    setLoading(true);
    try {
      const saveResp = await fetch(`${API_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ org_id: orgId, ...report, form_id: formId, snapshot_id: snapshotId })
      });
      if (!saveResp.ok) throw new Error('Save failed');
      const { id } = await saveResp.json();

      const genResp = await fetch(`${API_URL}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ report_id: id, format, include_appendix: true, include_methodology: true })
      });
      if (genResp.ok) {
        const blob = await genResp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `report.${format}`; a.click();
        toast.success(`Downloaded ${format.toUpperCase()}`);
      }
    } catch (e) { toast.error('Export failed'); }
    finally { setLoading(false); }
  };

  const createPack = async () => {
    if (!newPack.name.trim()) {
      toast.error('Please enter a pack name');
      return;
    }

    setPackLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/reproducibility/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          org_id: orgId,
          name: newPack.name,
          description: newPack.description,
          form_id: formId,
          snapshot_id: snapshotId,
          include_raw_data: newPack.include_raw_data,
          include_scripts: newPack.include_scripts,
          anonymize: newPack.anonymize
        })
      });
      
      if (response.ok) {
        toast.success('Reproducibility pack created');
        setNewPack({ name: '', description: '', include_raw_data: true, include_scripts: true, anonymize: false });
        fetchPacks();
      } else {
        toast.error('Failed to create pack');
      }
    } catch (e) {
      toast.error('Failed to create pack');
    } finally {
      setPackLoading(false);
    }
  };

  const downloadPack = async (packId) => {
    try {
      const response = await fetch(`${API_URL}/api/reproducibility/pack/${packId}/download`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reproducibility_pack_${packId.substring(0, 8)}.zip`;
        a.click();
        toast.success('Pack downloaded');
      } else {
        toast.error('Download failed');
      }
    } catch (e) {
      toast.error('Download failed');
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-4">
        <TabsTrigger value="reports" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Reports
        </TabsTrigger>
        <TabsTrigger value="reproducibility" className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Reproducibility
        </TabsTrigger>
        <TabsTrigger value="audit" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Audit Trail
        </TabsTrigger>
      </TabsList>

      {/* Reports Tab */}
      <TabsContent value="reports">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Report Builder</CardTitle>
              <CardDescription>Create professional analysis reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Title</Label><Input value={report.title} onChange={e => setReport({...report, title: e.target.value})} /></div>
                <div><Label>Author</Label><Input value={report.author} onChange={e => setReport({...report, author: e.target.value})} /></div>
              </div>
              <Separator />
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={() => addSection('text')}><Type className="h-4 w-4 mr-1" />Text</Button>
                <Button size="sm" variant="outline" onClick={() => addSection('table')}><Table className="h-4 w-4 mr-1" />Table</Button>
                <Button size="sm" variant="outline" onClick={() => addSection('page_break')}><Minus className="h-4 w-4 mr-1" />Break</Button>
              </div>
              <ScrollArea className="h-[300px]">
                {report.sections.map((s, i) => (
                  <div key={s.id} className="border rounded p-3 mb-2 bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <Badge>{s.type}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setReport(p => ({...p, sections: p.sections.filter((_,j) => j !== i)}))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    {s.type === 'text' && <Textarea value={s.content} onChange={e => { const secs = [...report.sections]; secs[i].content = e.target.value; setReport({...report, sections: secs}); }} placeholder="Enter content..." />}
                    {s.type === 'table' && <p className="text-sm text-slate-500">Table from analysis</p>}
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Export Report</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" onClick={() => generateReport('pdf')} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <File className="h-4 w-4 mr-2" />}
                PDF
              </Button>
              <Button className="w-full" variant="outline" onClick={() => generateReport('docx')} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Word
              </Button>
              <Button className="w-full" variant="outline" onClick={() => generateReport('html')} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileType className="h-4 w-4 mr-2" />}
                HTML
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Reproducibility Tab */}
      <TabsContent value="reproducibility">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Reproducibility Packs</CardTitle>
              <CardDescription>Download complete analysis bundles for reproducibility</CardDescription>
            </CardHeader>
            <CardContent>
              {packs.length > 0 ? (
                <div className="space-y-3">
                  {packs.map(pack => (
                    <div key={pack.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-100 rounded-lg">
                          <Archive className="h-5 w-5 text-sky-600" />
                        </div>
                        <div>
                          <p className="font-medium">{pack.name}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><Database className="h-3 w-3" />{pack.record_count || 0} records</span>
                            <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{pack.hash?.substring(0, 8)}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(pack.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => downloadPack(pack.id)} data-testid={`download-pack-${pack.id}`}>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No reproducibility packs yet</p>
                  <p className="text-sm">Create your first pack to enable reproducible research</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle className="text-base">Create New Pack</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Pack Name</Label>
                <Input 
                  value={newPack.name} 
                  onChange={e => setNewPack({...newPack, name: e.target.value})}
                  placeholder="Q1 2026 Analysis Pack"
                  data-testid="pack-name-input"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={newPack.description} 
                  onChange={e => setNewPack({...newPack, description: e.target.value})}
                  placeholder="Optional description..."
                  className="h-20"
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-data" className="text-sm">Include Raw Data</Label>
                  <Switch 
                    id="include-data"
                    checked={newPack.include_raw_data}
                    onCheckedChange={v => setNewPack({...newPack, include_raw_data: v})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-scripts" className="text-sm">Include Scripts</Label>
                  <Switch 
                    id="include-scripts"
                    checked={newPack.include_scripts}
                    onCheckedChange={v => setNewPack({...newPack, include_scripts: v})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="anonymize" className="text-sm">Anonymize PII</Label>
                  <Switch 
                    id="anonymize"
                    checked={newPack.anonymize}
                    onCheckedChange={v => setNewPack({...newPack, anonymize: v})}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={createPack} disabled={packLoading} data-testid="create-pack-btn">
                {packLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Pack
              </Button>
              <p className="text-xs text-slate-500 text-center">
                Packs include: dataset, codebook, scripts, and analysis logs
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Audit Trail Tab */}
      <TabsContent value="audit">
        <AuditTrail orgId={orgId} getToken={getToken} />
      </TabsContent>
    </Tabs>
  );
}

export default ReportBuilder;
