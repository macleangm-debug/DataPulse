/**
 * Factor Analysis - Exploratory Factor Analysis with visualizations
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { 
  Loader2, TrendingUp, AlertCircle, CheckCircle, Info, BarChart3, Grid3X3
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Legend
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LOADING_COLORS = ['#0ea5e9', '#22d3ee', '#06b6d4', '#14b8a6', '#10b981'];

export function FactorAnalysis({ formId, snapshotId, orgId, fields, getToken }) {
  const [loading, setLoading] = useState(false);
  const [selectedVars, setSelectedVars] = useState([]);
  const [nFactors, setNFactors] = useState('');
  const [rotation, setRotation] = useState('varimax');
  const [results, setResults] = useState(null);

  const numericFields = fields.filter(f => f.type === 'number' || f.type === 'scale' || f.type === 'rating');

  const toggleVariable = (varId) => {
    if (selectedVars.includes(varId)) {
      setSelectedVars(selectedVars.filter(v => v !== varId));
    } else {
      setSelectedVars([...selectedVars, varId]);
    }
  };

  const runAnalysis = async () => {
    if (selectedVars.length < 3) {
      toast.error('Please select at least 3 variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/stats/factor-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          variables: selectedVars,
          n_factors: nFactors ? parseInt(nFactors) : null,
          rotation: rotation
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setResults(data);
          toast.success('Factor analysis completed');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Analysis failed');
      }
    } catch (error) {
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const getLoadingColor = (loading) => {
    const absLoading = Math.abs(loading);
    if (absLoading >= 0.7) return loading > 0 ? '#10b981' : '#ef4444';
    if (absLoading >= 0.4) return loading > 0 ? '#22d3ee' : '#f97316';
    return '#94a3b8';
  };

  return (
    <div className="space-y-6" data-testid="factor-analysis">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Factor Analysis
          </h2>
          <p className="text-sm text-slate-500">Exploratory factor analysis to identify latent constructs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Select variables and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Variables ({selectedVars.length} selected)</Label>
              <ScrollArea className="h-[200px] border rounded-md p-2 mt-2">
                {numericFields.length > 0 ? (
                  numericFields.map(field => (
                    <div key={field.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`fa-${field.id}`}
                        checked={selectedVars.includes(field.id)}
                        onCheckedChange={() => toggleVariable(field.id)}
                      />
                      <Label htmlFor={`fa-${field.id}`} className="text-sm cursor-pointer">
                        {field.label || field.id}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 p-2">No numeric variables available</p>
                )}
              </ScrollArea>
            </div>

            <Separator />

            <div>
              <Label>Number of Factors</Label>
              <Input
                type="number"
                min="1"
                max={selectedVars.length}
                value={nFactors}
                onChange={e => setNFactors(e.target.value)}
                placeholder="Auto (Kaiser criterion)"
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">Leave blank for automatic detection</p>
            </div>

            <div>
              <Label>Rotation Method</Label>
              <Select value={rotation} onValueChange={setRotation}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="varimax">Varimax (orthogonal)</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={runAnalysis} 
              disabled={loading || selectedVars.length < 3}
              className="w-full"
              data-testid="run-factor-analysis-btn"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              Run Factor Analysis
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">Observations</p>
                    <p className="text-lg font-semibold">{results.n_observations}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">Variables</p>
                    <p className="text-lg font-semibold">{results.n_variables}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">Factors</p>
                    <p className="text-lg font-semibold">{results.n_factors}</p>
                  </div>
                  <div className="p-3 bg-sky-50 rounded-lg">
                    <p className="text-xs text-slate-500">Variance Explained</p>
                    <p className="text-lg font-semibold text-sky-600">{results.variance_explained?.total}%</p>
                  </div>
                </div>

                {/* KMO & Bartlett */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${results.kmo?.value >= 0.6 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">KMO Measure</p>
                        <p className="text-xs text-slate-500">Sampling Adequacy</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{results.kmo?.value}</p>
                        <Badge variant={results.kmo?.value >= 0.6 ? 'default' : 'secondary'}>
                          {results.kmo?.interpretation}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${results.bartlett_test?.significant ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Bartlett's Test</p>
                        <p className="text-xs text-slate-500">χ² = {results.bartlett_test?.chi_square}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">p {results.bartlett_test?.p_value < 0.001 ? '< .001' : `= ${results.bartlett_test?.p_value}`}</p>
                        {results.bartlett_test?.significant ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Significant</Badge>
                        ) : (
                          <Badge variant="destructive">Not Significant</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Scree Plot */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Scree Plot
                  </h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={results.scree_plot}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="component" tick={{ fontSize: 11 }} label={{ value: 'Component', position: 'bottom', fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: 'Eigenvalue', angle: -90, position: 'left', fontSize: 11 }} />
                        <Tooltip />
                        <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Kaiser = 1', fontSize: 10 }} />
                        <Line type="monotone" dataKey="eigenvalue" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <Separator />

                {/* Factor Loadings */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    Factor Loadings
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="p-2 text-left">Variable</th>
                          {Array.from({ length: results.n_factors }, (_, i) => (
                            <th key={i} className="p-2 text-center">Factor {i + 1}</th>
                          ))}
                          <th className="p-2 text-center">h²</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(results.loading_matrix || {}).map(([varName, loadings]) => (
                          <tr key={varName} className="border-b hover:bg-slate-50">
                            <td className="p-2 font-medium">{varName}</td>
                            {Array.from({ length: results.n_factors }, (_, i) => {
                              const loading = loadings[`Factor_${i + 1}`];
                              return (
                                <td key={i} className="p-2 text-center">
                                  <span 
                                    className="px-2 py-1 rounded text-xs font-mono"
                                    style={{ 
                                      backgroundColor: Math.abs(loading) >= 0.4 ? getLoadingColor(loading) + '20' : 'transparent',
                                      color: getLoadingColor(loading),
                                      fontWeight: Math.abs(loading) >= 0.4 ? 'bold' : 'normal'
                                    }}
                                  >
                                    {loading?.toFixed(3)}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="p-2 text-center text-slate-500">{loadings.communality?.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    h² = communality (proportion of variance explained by extracted factors). Loadings ≥ 0.4 are highlighted.
                  </p>
                </div>

                {/* Factor Interpretation */}
                {results.factor_interpretation && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-3">Factor Interpretation</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {results.factor_interpretation.map((factor, idx) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge style={{ backgroundColor: LOADING_COLORS[idx % LOADING_COLORS.length] }}>
                                {factor.factor}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {results.variance_explained?.by_factor[idx]}% variance
                              </span>
                            </div>
                            {factor.high_loading_variables.length > 0 ? (
                              <div className="space-y-1">
                                {factor.high_loading_variables.map(v => (
                                  <div key={v.variable} className="flex justify-between text-sm">
                                    <span>{v.variable}</span>
                                    <span className="font-mono text-slate-600">{v.loading.toFixed(3)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400">No strong loadings (≥0.4)</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Factor analysis identifies latent constructs underlying your variables. KMO ≥ 0.6 and significant Bartlett's test indicate suitable data for factoring.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select variables and run factor analysis</p>
                <p className="text-sm">Minimum 3 numeric variables required</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default FactorAnalysis;
