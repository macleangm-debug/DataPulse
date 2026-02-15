/**
 * Survey Statistics Panel - Complex survey design analysis
 * Supports weighted estimates, design effects, and survey regression
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { Slider } from '../ui/slider';
import { Scale, Layers, Users, TrendingUp, Calculator, Loader2, Info, AlertCircle, CheckCircle, Repeat, Shuffle, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function SurveyStatsPanel({ formId, snapshotId, orgId, fields, getToken }) {
  const [activeTest, setActiveTest] = useState('mean');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // Survey Design
  const [design, setDesign] = useState({
    strata_var: '',
    cluster_var: '',
    weight_var: '',
    fpc_var: ''
  });

  // Mean config
  const [meanConfig, setMeanConfig] = useState({ variable: '', by_group: '' });
  
  // Proportion config
  const [propConfig, setPropConfig] = useState({ variable: '' });
  
  // Regression config
  const [regConfig, setRegConfig] = useState({
    dependent_var: '',
    independent_vars: [],
    model_type: 'linear',
    interactions: [],
    include_diagnostics: true
  });

  // Design effects config
  const [deffConfig, setDeffConfig] = useState({ variables: [] });

  // Replicate weights config
  const [repConfig, setRepConfig] = useState({
    variable: '',
    method: 'brr',
    replicate_vars: [],
    psu_var: '',
    fay_coefficient: 0.5,
    n_replicates: 100
  });

  const numericFields = fields.filter(f => ['number', 'integer', 'decimal'].includes(f.type));
  const categoricalFields = fields.filter(f => ['select', 'radio', 'text'].includes(f.type));

  const runSurveyMean = async () => {
    if (!meanConfig.variable) { toast.error('Select a variable'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/survey/mean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          form_id: formId, snapshot_id: snapshotId, org_id: orgId,
          variable: meanConfig.variable,
          by_group: meanConfig.by_group || null,
          design
        })
      });
      if (response.ok) {
        setResults({ type: 'mean', data: await response.json() });
        toast.success('Survey mean calculated');
      } else { toast.error('Calculation failed'); }
    } catch (e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const runSurveyProportion = async () => {
    if (!propConfig.variable) { toast.error('Select a variable'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/survey/proportion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          form_id: formId, snapshot_id: snapshotId, org_id: orgId,
          variable: propConfig.variable,
          design
        })
      });
      if (response.ok) {
        setResults({ type: 'proportion', data: await response.json() });
        toast.success('Proportions calculated');
      } else { toast.error('Calculation failed'); }
    } catch (e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const runSurveyRegression = async () => {
    if (!regConfig.dependent_var || regConfig.independent_vars.length === 0) {
      toast.error('Select dependent and independent variables'); return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/survey/regression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          form_id: formId, snapshot_id: snapshotId, org_id: orgId,
          dependent_var: regConfig.dependent_var,
          independent_vars: regConfig.independent_vars,
          model_type: regConfig.model_type,
          design
        })
      });
      if (response.ok) {
        setResults({ type: 'regression', data: await response.json() });
        toast.success('Regression completed');
      } else { toast.error('Regression failed'); }
    } catch (e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const runDesignEffects = async () => {
    if (deffConfig.variables.length === 0) { toast.error('Select variables'); return; }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/survey/design-effects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          form_id: formId, snapshot_id: snapshotId, org_id: orgId,
          variables: deffConfig.variables,
          design
        })
      });
      if (response.ok) {
        setResults({ type: 'deff', data: await response.json() });
        toast.success('Design effects calculated');
      } else { toast.error('Calculation failed'); }
    } catch (e) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const runReplicateWeights = async () => {
    if (!repConfig.variable) { toast.error('Select a variable'); return; }
    if (repConfig.method === 'brr' && repConfig.replicate_vars.length === 0) {
      toast.error('BRR requires replicate weight columns');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/survey/replicate-weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          form_id: formId,
          snapshot_id: snapshotId,
          org_id: orgId,
          variable: repConfig.variable,
          method: repConfig.method,
          weight_var: design.weight_var || null,
          replicate_vars: repConfig.replicate_vars,
          psu_var: repConfig.psu_var || null,
          fay_coefficient: repConfig.fay_coefficient,
          n_replicates: repConfig.n_replicates
        })
      });
      if (response.ok) {
        setResults({ type: 'replicate', data: await response.json() });
        toast.success('Replicate weights analysis complete');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Analysis failed');
      }
    } catch (e) { toast.error('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Design & Config */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" />Survey Statistics</CardTitle>
          <CardDescription>Complex survey analysis with proper variance estimation</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[550px] pr-4">
            {/* Survey Design Section */}
            <div className="space-y-4 mb-6">
              <h4 className="font-medium flex items-center gap-2"><Layers className="h-4 w-4" />Survey Design</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Strata Variable</Label>
                  <Select value={design.strata_var || "none"} onValueChange={v => setDesign({...design, strata_var: v === "none" ? "" : v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categoricalFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cluster/PSU Variable</Label>
                  <Select value={design.cluster_var || "none"} onValueChange={v => setDesign({...design, cluster_var: v === "none" ? "" : v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Weight Variable</Label>
                  <Select value={design.weight_var || "none"} onValueChange={v => setDesign({...design, weight_var: v === "none" ? "" : v})}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {numericFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Analysis Type */}
            <Tabs value={activeTest} onValueChange={setActiveTest}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="mean">Mean</TabsTrigger>
                <TabsTrigger value="prop">Prop</TabsTrigger>
                <TabsTrigger value="reg">Reg</TabsTrigger>
                <TabsTrigger value="deff">DEFF</TabsTrigger>
                <TabsTrigger value="rep">Rep Wt</TabsTrigger>
              </TabsList>

              <TabsContent value="mean" className="space-y-3 mt-4">
                <div>
                  <Label>Variable</Label>
                  <Select value={meanConfig.variable} onValueChange={v => setMeanConfig({...meanConfig, variable: v})}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Group By (optional)</Label>
                  <Select value={meanConfig.by_group || "none"} onValueChange={v => setMeanConfig({...meanConfig, by_group: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categoricalFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runSurveyMean} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Calculate Mean
                </Button>
              </TabsContent>

              <TabsContent value="prop" className="space-y-3 mt-4">
                <div>
                  <Label>Categorical Variable</Label>
                  <Select value={propConfig.variable} onValueChange={v => setPropConfig({...propConfig, variable: v})}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {categoricalFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runSurveyProportion} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Calculate Proportions
                </Button>
              </TabsContent>

              <TabsContent value="reg" className="space-y-3 mt-4">
                <div>
                  <Label>Dependent Variable (Y)</Label>
                  <Select value={regConfig.dependent_var} onValueChange={v => setRegConfig({...regConfig, dependent_var: v})}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Model Type</Label>
                  <Select value={regConfig.model_type} onValueChange={v => setRegConfig({...regConfig, model_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear (OLS)</SelectItem>
                      <SelectItem value="logistic">Logistic</SelectItem>
                      <SelectItem value="poisson">Poisson</SelectItem>
                      <SelectItem value="negbin">Negative Binomial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Independent Variables</Label>
                  <div className="border rounded p-2 max-h-[100px] overflow-y-auto space-y-1">
                    {fields.filter(f => f.id !== regConfig.dependent_var).map(f => (
                      <div key={f.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={regConfig.independent_vars.includes(f.id)}
                          onCheckedChange={c => {
                            if (c) setRegConfig({...regConfig, independent_vars: [...regConfig.independent_vars, f.id]});
                            else setRegConfig({...regConfig, independent_vars: regConfig.independent_vars.filter(v => v !== f.id)});
                          }}
                        />
                        <span className="text-sm">{f.label || f.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {regConfig.independent_vars.length >= 2 && (
                  <div>
                    <Label>Interaction Terms</Label>
                    <div className="border rounded p-2 max-h-[80px] overflow-y-auto space-y-1">
                      {regConfig.independent_vars.slice(0, -1).map((v1, i) => 
                        regConfig.independent_vars.slice(i + 1).map(v2 => {
                          const interactionKey = `${v1}*${v2}`;
                          return (
                            <div key={interactionKey} className="flex items-center gap-2">
                              <Checkbox
                                checked={regConfig.interactions?.includes(interactionKey)}
                                onCheckedChange={c => {
                                  if (c) setRegConfig({...regConfig, interactions: [...(regConfig.interactions || []), interactionKey]});
                                  else setRegConfig({...regConfig, interactions: (regConfig.interactions || []).filter(v => v !== interactionKey)});
                                }}
                              />
                              <span className="text-xs">{v1} × {v2}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={regConfig.include_diagnostics}
                    onCheckedChange={c => setRegConfig({...regConfig, include_diagnostics: c})}
                  />
                  <Label className="text-sm">Include model diagnostics</Label>
                </div>
                <Button onClick={runSurveyRegression} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Run Regression
                </Button>
              </TabsContent>

              <TabsContent value="deff" className="space-y-3 mt-4">
                <div>
                  <Label>Variables</Label>
                  <div className="border rounded p-2 max-h-[150px] overflow-y-auto space-y-1">
                    {numericFields.map(f => (
                      <div key={f.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={deffConfig.variables.includes(f.id)}
                          onCheckedChange={c => {
                            if (c) setDeffConfig({...deffConfig, variables: [...deffConfig.variables, f.id]});
                            else setDeffConfig({...deffConfig, variables: deffConfig.variables.filter(v => v !== f.id)});
                          }}
                        />
                        <span className="text-sm">{f.label || f.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={runDesignEffects} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Calculate DEFF
                </Button>
              </TabsContent>

              <TabsContent value="rep" className="space-y-3 mt-4">
                <div className="p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <Info className="h-3 w-3 inline mr-1" />
                  Replicate weights provide robust variance estimation for complex surveys
                </div>
                <div>
                  <Label>Analysis Variable</Label>
                  <Select value={repConfig.variable} onValueChange={v => setRepConfig({...repConfig, variable: v})}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={repConfig.method} onValueChange={v => setRepConfig({...repConfig, method: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brr">BRR (Balanced Repeated Replication)</SelectItem>
                      <SelectItem value="jackknife">Jackknife</SelectItem>
                      <SelectItem value="bootstrap">Bootstrap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {repConfig.method === 'brr' && (
                  <>
                    <div>
                      <Label>Replicate Weight Columns</Label>
                      <div className="border rounded p-2 max-h-[100px] overflow-y-auto space-y-1">
                        {numericFields.map(f => (
                          <div key={f.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={repConfig.replicate_vars.includes(f.id)}
                              onCheckedChange={c => {
                                if (c) setRepConfig({...repConfig, replicate_vars: [...repConfig.replicate_vars, f.id]});
                                else setRepConfig({...repConfig, replicate_vars: repConfig.replicate_vars.filter(v => v !== f.id)});
                              }}
                            />
                            <span className="text-xs">{f.label || f.id}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {repConfig.replicate_vars.length} replicate(s) selected
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs">Fay Coefficient: {repConfig.fay_coefficient}</Label>
                      <Slider
                        value={[repConfig.fay_coefficient]}
                        onValueChange={([v]) => setRepConfig({...repConfig, fay_coefficient: v})}
                        min={0}
                        max={1}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground">0 = Standard BRR, 0.5 = Fay's method</p>
                    </div>
                  </>
                )}

                {repConfig.method === 'jackknife' && (
                  <div>
                    <Label>PSU/Cluster Variable</Label>
                    <Select value={repConfig.psu_var || "none"} onValueChange={v => setRepConfig({...repConfig, psu_var: v === "none" ? "" : v})}>
                      <SelectTrigger><SelectValue placeholder="None (delete-1)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (delete-1)</SelectItem>
                        {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty for delete-1 jackknife, or select PSU for delete-a-group
                    </p>
                  </div>
                )}

                {repConfig.method === 'bootstrap' && (
                  <div>
                    <Label>Number of Replicates: {repConfig.n_replicates}</Label>
                    <Slider
                      value={[repConfig.n_replicates]}
                      onValueChange={([v]) => setRepConfig({...repConfig, n_replicates: v})}
                      min={50}
                      max={500}
                      step={50}
                      className="mt-2"
                    />
                  </div>
                )}

                <Button onClick={runReplicateWeights} disabled={loading} className="w-full">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Repeat className="h-4 w-4 mr-2" />
                  Run Replicate Analysis
                </Button>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Survey-weighted estimates with design-based standard errors</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-sky-500" /></div>
          ) : results ? (
            <ScrollArea className="h-[500px]">
              {results.type === 'mean' && <MeanResults data={results.data} />}
              {results.type === 'proportion' && <ProportionResults data={results.data} />}
              {results.type === 'regression' && <RegressionResults data={results.data} />}
              {results.type === 'deff' && <DeffResults data={results.data} />}
              {results.type === 'replicate' && <ReplicateResults data={results.data} />}
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Configure survey design and run analysis</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MeanResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-sky-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-sky-700">{data.estimate}</p>
          <p className="text-sm text-slate-600">Estimate</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-2xl font-bold">{data.std_error}</p>
          <p className="text-sm text-slate-600">Std. Error</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-2xl font-bold">{data.n}</p>
          <p className="text-sm text-slate-600">N</p>
        </div>
      </div>
      <div className="p-3 bg-amber-50 rounded-lg">
        <p className="text-sm"><strong>95% CI:</strong> [{data.confidence_interval?.lower}, {data.confidence_interval?.upper}]</p>
        <p className="text-sm"><strong>Design Effect:</strong> {data.design_effect} | <strong>Effective N:</strong> {data.effective_n}</p>
      </div>
      {data.subgroups && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Subgroup Estimates</h4>
          <div className="space-y-2">
            {Object.entries(data.subgroups).map(([group, stats]) => (
              <div key={group} className="flex justify-between p-2 bg-slate-50 rounded">
                <span>{group}</span>
                <span>M={stats.estimate} (SE={stats.std_error}, N={stats.n})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProportionResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Badge>{data.variable}</Badge>
        <span className="text-sm text-slate-500">N = {data.total_n}</span>
      </div>
      <div className="space-y-2">
        {data.proportions?.map((p, i) => (
          <div key={i} className="p-3 bg-slate-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">{p.value}</span>
              <Badge variant="outline">{p.percent}%</Badge>
            </div>
            <div className="text-sm text-slate-600 mt-1">
              SE: {p.std_error} | 95% CI: [{p.confidence_interval?.lower?.toFixed(3)}, {p.confidence_interval?.upper?.toFixed(3)}]
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${p.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegressionResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge>{data.model_type === 'linear' ? 'OLS' : 'Logistic'} Regression</Badge>
        <Badge variant="outline">{data.se_type}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-slate-50 rounded"><p className="text-sm text-slate-500">R²</p><p className="font-bold">{data.model_fit?.r_squared || '-'}</p></div>
        <div className="p-3 bg-slate-50 rounded"><p className="text-sm text-slate-500">Adj R²</p><p className="font-bold">{data.model_fit?.adj_r_squared || '-'}</p></div>
        <div className="p-3 bg-slate-50 rounded"><p className="text-sm text-slate-500">N</p><p className="font-bold">{data.model_fit?.n}</p></div>
      </div>
      <h4 className="font-medium mt-4">Coefficients</h4>
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Variable</th><th className="p-2 text-right">Coef</th><th className="p-2 text-right">SE</th><th className="p-2 text-right">t</th><th className="p-2 text-right">p</th><th className="p-2">Sig</th></tr></thead>
        <tbody>
          {data.coefficients && Object.entries(data.coefficients).map(([name, c]) => (
            <tr key={name} className="border-b">
              <td className="p-2">{name}</td>
              <td className="p-2 text-right">{c.coefficient}</td>
              <td className="p-2 text-right">{c.std_error}</td>
              <td className="p-2 text-right">{c.t_value}</td>
              <td className="p-2 text-right">{c.p_value < 0.001 ? '<.001' : c.p_value}</td>
              <td className="p-2 text-center">{c.significant ? <CheckCircle className="h-4 w-4 text-green-500 inline" /> : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeffResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-sky-50 dark:bg-sky-950/30 rounded-lg">
        <p className="text-sm"><strong>Average DEFF:</strong> {data.average_deff}</p>
        <p className="text-sm text-muted-foreground">Observations: {data.design_info?.n_obs} | Clusters: {data.design_info?.n_clusters}</p>
      </div>
      <h4 className="font-medium">Variable Design Effects</h4>
      <div className="space-y-2">
        {data.effects?.map((e, i) => (
          <div key={i} className="p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">{e.variable}</span>
              <Badge variant={e.design_effect > 2 ? 'destructive' : 'outline'}>DEFF: {e.design_effect}</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              N: {e.n} | Effective N: {e.effective_n}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{e.interpretation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplicateResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{data.method?.toUpperCase()}</Badge>
        <Badge>{data.variable}</Badge>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-sky-50 dark:bg-sky-950/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{data.estimate}</p>
          <p className="text-sm text-muted-foreground">Point Estimate</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-bold">{data.std_error}</p>
          <p className="text-sm text-muted-foreground">Std. Error</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-bold">{data.n}</p>
          <p className="text-sm text-muted-foreground">N</p>
        </div>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg space-y-2">
        <p className="text-sm"><strong>95% CI:</strong> [{data.ci_95?.[0]}, {data.ci_95?.[1]}]</p>
        <p className="text-sm"><strong>Design Effect:</strong> {data.design_effect}</p>
        <p className="text-sm"><strong>Effective Sample Size:</strong> {data.effective_sample_size}</p>
        {data.cv_percent && <p className="text-sm"><strong>CV:</strong> {data.cv_percent}%</p>}
      </div>

      {data.n_replicates && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="h-4 w-4" />
            <span className="font-medium">Replicate Information</span>
          </div>
          <div className="text-sm space-y-1">
            <p><strong>Number of Replicates:</strong> {data.n_replicates}</p>
            <p><strong>Weighted N:</strong> {data.n_weighted}</p>
            {data.variance && <p><strong>Variance:</strong> {data.variance}</p>}
          </div>
        </div>
      )}

      {data.interpretation && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-800 dark:text-green-400">Interpretation</span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">{data.interpretation}</p>
        </div>
      )}
    </div>
  );
}

export default SurveyStatsPanel;
