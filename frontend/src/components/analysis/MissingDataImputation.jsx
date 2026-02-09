/**
 * Missing Data Imputation - Handle missing values in datasets
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Switch } from '../ui/switch';
import { 
  Loader2, AlertCircle, CheckCircle, Info, FileQuestion, RefreshCw, Save, Eye, Database, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const IMPUTATION_METHODS = [
  { value: 'mean', label: 'Mean', description: 'Replace with average (numeric only)', numeric: true },
  { value: 'median', label: 'Median', description: 'Replace with middle value (numeric only)', numeric: true },
  { value: 'mode', label: 'Mode', description: 'Replace with most frequent value', numeric: false },
  { value: 'constant', label: 'Constant', description: 'Replace with a specific value', numeric: false },
  { value: 'ffill', label: 'Forward Fill', description: 'Use previous valid value', numeric: false },
  { value: 'bfill', label: 'Backward Fill', description: 'Use next valid value', numeric: false },
  { value: 'interpolate', label: 'Interpolate', description: 'Linear interpolation (numeric only)', numeric: true },
  { value: 'drop', label: 'Drop Rows', description: 'Remove rows with missing values', numeric: false }
];

export function MissingDataImputation({ formId, snapshotId, orgId, fields, getToken }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedVars, setSelectedVars] = useState([]);
  const [method, setMethod] = useState('mean');
  const [constantValue, setConstantValue] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [createSnapshot, setCreateSnapshot] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (formId || snapshotId) {
      fetchMissingSummary();
    }
  }, [formId, snapshotId]);

  const fetchMissingSummary = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/analysis/imputation/missing-summary/${formId}`;
      if (snapshotId) {
        url += `?snapshot_id=${snapshotId}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch missing summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVariable = (varId) => {
    if (selectedVars.includes(varId)) {
      setSelectedVars(selectedVars.filter(v => v !== varId));
    } else {
      setSelectedVars([...selectedVars, varId]);
    }
  };

  const selectAllWithMissing = () => {
    const varsWithMissing = summary?.variables
      .filter(v => v.missing_count > 0)
      .map(v => v.variable) || [];
    setSelectedVars(varsWithMissing);
  };

  const previewImputation = async () => {
    if (selectedVars.length === 0) {
      toast.error('Please select at least one variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/imputation/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          org_id: orgId,
          form_id: snapshotId ? null : formId,
          snapshot_id: snapshotId || null,
          variables: selectedVars,
          method: method,
          constant_value: method === 'constant' ? constantValue : null,
          group_by: groupBy || null,
          create_snapshot: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setPreview(data);
          toast.success('Preview generated');
        }
      } else {
        toast.error('Preview failed');
      }
    } catch (error) {
      toast.error('Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const applyImputation = async () => {
    if (selectedVars.length === 0) {
      toast.error('Please select at least one variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/imputation/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          org_id: orgId,
          form_id: snapshotId ? null : formId,
          snapshot_id: snapshotId || null,
          variables: selectedVars,
          method: method,
          constant_value: method === 'constant' ? constantValue : null,
          group_by: groupBy || null,
          create_snapshot: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Snapshot created: ${data.name}`);
        setPreview(null);
        setSelectedVars([]);
        fetchMissingSummary();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Imputation failed');
      }
    } catch (error) {
      toast.error('Imputation failed');
    } finally {
      setLoading(false);
    }
  };

  const getMissingColor = (percent) => {
    if (percent === 0) return '#10b981';
    if (percent < 5) return '#22d3ee';
    if (percent < 20) return '#eab308';
    if (percent < 50) return '#f97316';
    return '#ef4444';
  };

  // Prepare chart data
  const chartData = summary?.variables
    .filter(v => v.missing_percent > 0)
    .slice(0, 15)
    .map(v => ({
      name: v.label?.substring(0, 15) || v.variable.substring(0, 15),
      missing: v.missing_percent,
      complete: v.complete_percent
    })) || [];

  return (
    <div className="space-y-6" data-testid="missing-data-imputation">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <FileQuestion className="h-5 w-5" />
            Missing Data Handling
          </h2>
          <p className="text-sm text-slate-500">Analyze and impute missing values in your dataset</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMissingSummary} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {summary ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Missing Data Summary</span>
                <Badge variant={summary.overall_missing_percent < 5 ? 'default' : 'destructive'}>
                  {summary.overall_missing_percent}% Missing
                </Badge>
              </CardTitle>
              <CardDescription>
                {summary.total_rows} rows, {summary.total_columns} variables, {summary.complete_cases} complete cases ({summary.complete_cases_percent}%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div className="h-[200px] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="missing" name="Missing %" stackId="a">
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={getMissingColor(entry.missing)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-emerald-600">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                  <p className="font-medium">No missing data detected!</p>
                </div>
              )}

              <Separator className="my-4" />

              {/* Variable List */}
              <div className="flex items-center justify-between mb-2">
                <Label>Variables ({selectedVars.length} selected)</Label>
                <Button variant="ghost" size="sm" onClick={selectAllWithMissing}>
                  Select All with Missing
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-2">
                  {summary.variables.map(v => (
                    <div 
                      key={v.variable} 
                      className={`flex items-center justify-between p-2 rounded hover:bg-slate-50 ${
                        selectedVars.includes(v.variable) ? 'bg-sky-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedVars.includes(v.variable)}
                          onCheckedChange={() => toggleVariable(v.variable)}
                          disabled={v.missing_count === 0}
                        />
                        <div>
                          <p className="text-sm font-medium">{v.label || v.variable}</p>
                          <p className="text-xs text-slate-500">{v.type} {v.is_numeric && '• numeric'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm" style={{ color: getMissingColor(v.missing_percent) }}>
                          {v.missing_count} ({v.missing_percent}%)
                        </p>
                        <Progress value={v.complete_percent} className="w-20 h-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imputation Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPUTATION_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        <div>
                          <p className="font-medium">{m.label}</p>
                          <p className="text-xs text-slate-500">{m.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {method === 'constant' && (
                <div>
                  <Label>Constant Value</Label>
                  <Input
                    value={constantValue}
                    onChange={e => setConstantValue(e.target.value)}
                    placeholder="Enter value..."
                    className="mt-1"
                  />
                </div>
              )}

              {(method === 'mean' || method === 'median') && (
                <div>
                  <Label>Group By (Optional)</Label>
                  <Select value={groupBy || "none"} onValueChange={(val) => setGroupBy(val === "none" ? "" : val)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="No grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping</SelectItem>
                      {fields.filter(f => f.type === 'select' || f.type === 'radio').map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">Calculate statistics within groups</p>
                </div>
              )}

              <Separator />

              <Button 
                onClick={previewImputation} 
                disabled={loading || selectedVars.length === 0}
                variant="outline"
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                Preview Changes
              </Button>

              <Button 
                onClick={applyImputation} 
                disabled={loading || selectedVars.length === 0}
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Apply & Create Snapshot
              </Button>

              <p className="text-xs text-slate-500 text-center">
                Creates a new snapshot with imputed values
              </p>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          {preview && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Imputation Preview
                </CardTitle>
                <CardDescription>
                  {preview.n_original} rows → {preview.n_after} rows
                  {preview.rows_dropped > 0 && ` (${preview.rows_dropped} dropped)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before/After Summary */}
                  <div>
                    <h4 className="font-medium mb-2">Before → After</h4>
                    <div className="space-y-2">
                      {preview.variables.map(v => (
                        <div key={v} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <span className="text-sm font-medium">{v}</span>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-red-500">{preview.missing_before[v]?.percent}%</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="text-emerald-500">{preview.missing_after[v]?.percent}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sample Changes */}
                  <div>
                    <h4 className="font-medium mb-2">Sample Changes</h4>
                    {preview.sample_changes.length > 0 ? (
                      <div className="space-y-1 text-sm">
                        {preview.sample_changes.map((change, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1 bg-amber-50 rounded">
                            <span className="text-slate-500">Row {change.row}:</span>
                            <span className="font-medium">{change.variable}</span>
                            <span className="text-red-400">null</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="text-emerald-600">{String(change.imputed)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No changes in preview sample</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Click "Apply & Create Snapshot" to save these changes to a new immutable dataset snapshot.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-slate-500">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a form to analyze missing data</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MissingDataImputation;
