/**
 * DiagnosticPlots.jsx
 * Component for displaying ROC curves and residual diagnostic plots
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import { 
  Loader2, AlertCircle, CheckCircle, Info, TrendingUp, Activity
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getToken = () => localStorage.getItem('token');

export default function DiagnosticPlots({ formId, snapshotId, orgId, fields = [] }) {
  const [activeTab, setActiveTab] = useState('roc');
  const [loading, setLoading] = useState(false);
  const [rocData, setRocData] = useState(null);
  const [residualData, setResidualData] = useState(null);

  // ROC config
  const [rocConfig, setRocConfig] = useState({
    actualVar: '',
    predictedVar: ''
  });

  // Residual config
  const [residualConfig, setResidualConfig] = useState({
    dependentVar: '',
    independentVars: []
  });

  const numericFields = fields.filter(f => 
    f.type === 'number' || f.type === 'integer' || f.type === 'decimal'
  );

  const runROCAnalysis = async () => {
    if (!rocConfig.actualVar || !rocConfig.predictedVar) {
      toast.error('Please select both variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/diagnostics/roc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          actual_var: rocConfig.actualVar,
          predicted_var: rocConfig.predictedVar
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRocData(data);
        toast.success('ROC analysis completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'ROC analysis failed');
      }
    } catch (error) {
      toast.error('Failed to run ROC analysis');
    } finally {
      setLoading(false);
    }
  };

  const runResidualAnalysis = async () => {
    if (!residualConfig.dependentVar || residualConfig.independentVars.length === 0) {
      toast.error('Please select dependent and at least one independent variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/diagnostics/residuals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          dependent_var: residualConfig.dependentVar,
          independent_vars: residualConfig.independentVars
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResidualData(data);
        toast.success('Residual analysis completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Residual analysis failed');
      }
    } catch (error) {
      toast.error('Failed to run residual analysis');
    } finally {
      setLoading(false);
    }
  };

  // Render ROC Curve
  const renderROCCurve = () => {
    if (!rocData) return null;

    // Add diagonal reference line points
    const diagonalLine = [{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={rocData.auc >= 0.7 ? 'default' : 'secondary'}>
            AUC = {rocData.auc}
          </Badge>
          <Badge variant="outline">
            95% CI: [{rocData.auc_ci_lower}, {rocData.auc_ci_upper}]
          </Badge>
          <Badge variant="outline">N = {rocData.n_observations}</Badge>
        </div>

        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="fpr" 
                type="number" 
                domain={[0, 1]} 
                label={{ value: 'False Positive Rate (1 - Specificity)', position: 'bottom', offset: 0 }}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <YAxis 
                dataKey="tpr" 
                type="number" 
                domain={[0, 1]} 
                label={{ value: 'True Positive Rate (Sensitivity)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <Tooltip 
                formatter={(value) => value.toFixed(4)}
                labelFormatter={(label) => `FPR: ${label.toFixed(4)}`}
              />
              {/* Diagonal reference line */}
              <Line 
                data={diagonalLine} 
                dataKey="tpr" 
                stroke="#94a3b8" 
                strokeDasharray="5 5" 
                dot={false}
                name="Random"
              />
              {/* ROC curve */}
              <Line 
                data={rocData.curve_points} 
                dataKey="tpr" 
                stroke="#0ea5e9" 
                strokeWidth={2}
                dot={false}
                name="ROC Curve"
              />
              {/* Optimal point */}
              <Scatter 
                data={[{ fpr: rocData.optimal_fpr, tpr: rocData.optimal_tpr }]}
                fill="#ef4444"
                name="Optimal"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-sky-50 rounded-lg">
            <p className="text-sm text-slate-500">Optimal Threshold</p>
            <p className="text-lg font-semibold">{rocData.optimal_threshold}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Sensitivity at Optimal</p>
            <p className="text-lg font-semibold">{rocData.optimal_tpr}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Specificity at Optimal</p>
            <p className="text-lg font-semibold">{(1 - rocData.optimal_fpr).toFixed(4)}</p>
          </div>
        </div>

        <div className={`p-3 rounded-lg flex items-start gap-2 ${
          rocData.auc >= 0.7 ? 'bg-emerald-50' : 'bg-amber-50'
        }`}>
          <Info className={`h-4 w-4 mt-0.5 ${rocData.auc >= 0.7 ? 'text-emerald-600' : 'text-amber-600'}`} />
          <p className={`text-sm ${rocData.auc >= 0.7 ? 'text-emerald-800' : 'text-amber-800'}`}>
            {rocData.interpretation}. AUC of {rocData.auc} indicates the model correctly ranks 
            a random positive case higher than a random negative case {(rocData.auc * 100).toFixed(0)}% of the time.
          </p>
        </div>
      </div>
    );
  };

  // Render Residual Plots
  const renderResidualPlots = () => {
    if (!residualData) return null;

    const diag = residualData.diagnostics;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>R² = {residualData.r_squared}</Badge>
          <Badge variant="outline">N = {residualData.n_observations}</Badge>
          {diag.shapiro_wilk.normal && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Normally Distributed
            </Badge>
          )}
          {diag.breusch_pagan?.homoscedastic && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Homoscedastic
            </Badge>
          )}
        </div>

        <Tabs defaultValue="residuals" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="residuals">Residuals vs Fitted</TabsTrigger>
            <TabsTrigger value="qq">Q-Q Plot</TabsTrigger>
            <TabsTrigger value="scale">Scale-Location</TabsTrigger>
          </TabsList>

          <TabsContent value="residuals" className="pt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="fitted" 
                    type="number"
                    label={{ value: 'Fitted Values', position: 'bottom', offset: 0 }}
                  />
                  <YAxis 
                    dataKey="residual" 
                    type="number"
                    label={{ value: 'Residuals', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => value.toFixed(4)} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Scatter 
                    data={residualData.residuals_vs_fitted} 
                    fill="#0ea5e9"
                    opacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Points should be randomly scattered around zero. Patterns suggest model misspecification.
            </p>
          </TabsContent>

          <TabsContent value="qq" className="pt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="theoretical" 
                    type="number"
                    label={{ value: 'Theoretical Quantiles', position: 'bottom', offset: 0 }}
                  />
                  <YAxis 
                    dataKey="sample" 
                    type="number"
                    label={{ value: 'Sample Quantiles', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => value.toFixed(4)} />
                  <ReferenceLine 
                    segment={[
                      { x: -3, y: -3 },
                      { x: 3, y: 3 }
                    ]}
                    stroke="#94a3b8" 
                    strokeDasharray="3 3"
                  />
                  <Scatter 
                    data={residualData.qq_plot} 
                    fill="#10b981"
                    opacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Points should follow the diagonal line for normally distributed residuals.
            </p>
          </TabsContent>

          <TabsContent value="scale" className="pt-4">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="fitted" 
                    type="number"
                    label={{ value: 'Fitted Values', position: 'bottom', offset: 0 }}
                  />
                  <YAxis 
                    dataKey="sqrt_std_resid" 
                    type="number"
                    label={{ value: '√|Standardized Residuals|', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(value) => value.toFixed(4)} />
                  <Scatter 
                    data={residualData.scale_location} 
                    fill="#f59e0b"
                    opacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Horizontal spread should be constant. A funnel shape indicates heteroscedasticity.
            </p>
          </TabsContent>
        </Tabs>

        <Separator />

        <h4 className="font-medium">Diagnostic Tests</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className={`p-3 rounded-lg ${diag.shapiro_wilk.normal ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <p className="text-sm font-medium">Shapiro-Wilk (Normality)</p>
            <p className="text-xs text-slate-500">W = {diag.shapiro_wilk.statistic}</p>
            <p className="text-xs text-slate-500">p = {diag.shapiro_wilk.p_value}</p>
            <p className={`text-xs mt-1 ${diag.shapiro_wilk.normal ? 'text-emerald-600' : 'text-amber-600'}`}>
              {diag.shapiro_wilk.normal ? '✓ Normal' : '⚠ Non-normal'}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            diag.durbin_watson.interpretation === 'No autocorrelation' ? 'bg-emerald-50' : 'bg-amber-50'
          }`}>
            <p className="text-sm font-medium">Durbin-Watson (Autocorr)</p>
            <p className="text-xs text-slate-500">DW = {diag.durbin_watson.statistic}</p>
            <p className={`text-xs mt-1 ${
              diag.durbin_watson.interpretation === 'No autocorrelation' ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {diag.durbin_watson.interpretation === 'No autocorrelation' ? '✓' : '⚠'} {diag.durbin_watson.interpretation}
            </p>
          </div>
          {diag.breusch_pagan && (
            <div className={`p-3 rounded-lg ${diag.breusch_pagan.homoscedastic ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className="text-sm font-medium">Breusch-Pagan (Heterosc)</p>
              <p className="text-xs text-slate-500">χ² = {diag.breusch_pagan.statistic}</p>
              <p className="text-xs text-slate-500">p = {diag.breusch_pagan.p_value}</p>
              <p className={`text-xs mt-1 ${diag.breusch_pagan.homoscedastic ? 'text-emerald-600' : 'text-amber-600'}`}>
                {diag.breusch_pagan.homoscedastic ? '✓ Homoscedastic' : '⚠ Heteroscedastic'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!formId && !snapshotId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Select a form to access diagnostic plots</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Configuration Panel */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Diagnostic Plots
          </CardTitle>
          <CardDescription>Validate model assumptions</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="roc">ROC Curve</TabsTrigger>
              <TabsTrigger value="residual">Residuals</TabsTrigger>
            </TabsList>

            <TabsContent value="roc" className="space-y-4 mt-4">
              <div>
                <Label>Actual Outcome (Binary 0/1)</Label>
                <Select 
                  value={rocConfig.actualVar} 
                  onValueChange={(v) => setRocConfig({...rocConfig, actualVar: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select actual variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {numericFields.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Predicted Score/Probability</Label>
                <Select 
                  value={rocConfig.predictedVar} 
                  onValueChange={(v) => setRocConfig({...rocConfig, predictedVar: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select predicted variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {numericFields.filter(f => f.id !== rocConfig.actualVar).map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                <Info className="h-3 w-3 inline mr-1" />
                ROC curves evaluate binary classification. Actual should be 0/1, predicted should be probabilities or scores.
              </div>

              <Button onClick={runROCAnalysis} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generate ROC Curve
              </Button>
            </TabsContent>

            <TabsContent value="residual" className="space-y-4 mt-4">
              <div>
                <Label>Dependent Variable</Label>
                <Select 
                  value={residualConfig.dependentVar} 
                  onValueChange={(v) => setResidualConfig({...residualConfig, dependentVar: v})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select dependent variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {numericFields.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Independent Variables ({residualConfig.independentVars.length} selected)</Label>
                <ScrollArea className="h-[120px] border rounded-md p-2 mt-1">
                  {numericFields.filter(f => f.id !== residualConfig.dependentVar).map(f => (
                    <div key={f.id} className="flex items-center space-x-2 py-1">
                      <Checkbox 
                        id={`resid-${f.id}`}
                        checked={residualConfig.independentVars.includes(f.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setResidualConfig({
                              ...residualConfig, 
                              independentVars: [...residualConfig.independentVars, f.id]
                            });
                          } else {
                            setResidualConfig({
                              ...residualConfig, 
                              independentVars: residualConfig.independentVars.filter(v => v !== f.id)
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`resid-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                <Info className="h-3 w-3 inline mr-1" />
                Residual diagnostics check regression assumptions: normality, homoscedasticity, and independence.
              </div>

              <Button 
                onClick={runResidualAnalysis} 
                disabled={loading || residualConfig.independentVars.length === 0} 
                className="w-full"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generate Residual Plots
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {activeTab === 'roc' ? 'ROC Curve Analysis' : 'Regression Diagnostics'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === 'roc' ? (
            rocData ? renderROCCurve() : (
              <div className="py-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Configure and run ROC analysis to see results</p>
              </div>
            )
          ) : (
            residualData ? renderResidualPlots() : (
              <div className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">Configure and run residual analysis to see results</p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
