/**
 * Advanced Statistics Panel
 * Provides T-tests, ANOVA, Correlation, and Regression analysis
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
import {
  Calculator,
  TrendingUp,
  BarChart3,
  GitCompare,
  Percent,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function AdvancedStatsPanel({ 
  formId, 
  snapshotId, 
  orgId, 
  fields, 
  getToken 
}) {
  const [activeTest, setActiveTest] = useState('ttest');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // T-Test state
  const [ttestConfig, setTtestConfig] = useState({
    testType: 'independent',
    variable: '',
    groupVar: '',
    mu: 0
  });

  // ANOVA state
  const [anovaConfig, setAnovaConfig] = useState({
    dependentVar: '',
    factorVar: '',
    postHoc: true
  });

  // ANCOVA state
  const [ancovaConfig, setAncovaConfig] = useState({
    dependentVar: '',
    groupVar: '',
    covariates: []
  });

  // Correlation state
  const [corrConfig, setCorrConfig] = useState({
    variables: [],
    method: 'pearson'
  });

  // Regression state
  const [regConfig, setRegConfig] = useState({
    dependentVar: '',
    independentVars: [],
    modelType: 'ols',
    robustSE: false
  });

  // GLM state
  const [glmConfig, setGlmConfig] = useState({
    dependentVar: '',
    independentVars: [],
    family: 'gaussian',
    link: ''
  });

  // Mixed Models state
  const [mixedConfig, setMixedConfig] = useState({
    dependentVar: '',
    fixedEffects: [],
    randomEffects: [],
    groupVar: ''
  });

  // Factor Analysis state
  const [faConfig, setFaConfig] = useState({
    variables: [],
    nFactors: '',
    rotation: 'varimax'
  });

  // Nonparametric Tests state
  const [npConfig, setNpConfig] = useState({
    testType: 'mann_whitney',
    dependentVar: '',
    groupVar: '',
    pairedVar: ''
  });

  // Clustering state
  const [clusterConfig, setClusterConfig] = useState({
    variables: [],
    method: 'kmeans',
    nClusters: '',
    linkage: 'ward'
  });

  // Proportions test state
  const [propConfig, setPropConfig] = useState({
    testType: 'one_sample',
    variable: '',
    successValue: '',
    hypothesizedProp: '0.5',
    groupVar: ''
  });

  const numericFields = fields.filter(f => f.type === 'number' || f.type === 'integer' || f.type === 'decimal');
  const categoricalFields = fields.filter(f => f.type === 'select' || f.type === 'radio' || f.type === 'text');
  const allFields = fields;

  const runTTest = async () => {
    if (!ttestConfig.variable) {
      toast.error('Please select a variable');
      return;
    }
    if (ttestConfig.testType === 'independent' && !ttestConfig.groupVar) {
      toast.error('Please select a grouping variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/ttest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          test_type: ttestConfig.testType,
          variable: ttestConfig.variable,
          group_var: ttestConfig.groupVar || null,
          mu: ttestConfig.testType === 'one_sample' ? parseFloat(ttestConfig.mu) : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults({ type: 'ttest', data });
        toast.success('T-test completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'T-test failed');
      }
    } catch (error) {
      toast.error('T-test failed');
    } finally {
      setLoading(false);
    }
  };

  const runANOVA = async () => {
    if (!anovaConfig.dependentVar || !anovaConfig.factorVar) {
      toast.error('Please select both variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/anova`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          dependent_var: anovaConfig.dependentVar,
          factor_var: anovaConfig.factorVar,
          post_hoc: anovaConfig.postHoc
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults({ type: 'anova', data });
        toast.success('ANOVA completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'ANOVA failed');
      }
    } catch (error) {
      toast.error('ANOVA failed');
    } finally {
      setLoading(false);
    }
  };

  const runANCOVA = async () => {
    if (!ancovaConfig.dependentVar || !ancovaConfig.groupVar) {
      toast.error('Please select dependent and grouping variables');
      return;
    }
    if (ancovaConfig.covariates.length === 0) {
      toast.error('Please select at least one covariate');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/ancova`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          dependent_var: ancovaConfig.dependentVar,
          group_var: ancovaConfig.groupVar,
          covariates: ancovaConfig.covariates
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setResults({ type: 'ancova', data });
          toast.success('ANCOVA completed');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'ANCOVA failed');
      }
    } catch (error) {
      toast.error('ANCOVA failed');
    } finally {
      setLoading(false);
    }
  };

  const runCorrelation = async () => {
    if (corrConfig.variables.length < 2) {
      toast.error('Select at least 2 variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/correlation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          variables: corrConfig.variables,
          method: corrConfig.method
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults({ type: 'correlation', data });
        toast.success('Correlation analysis completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Correlation failed');
      }
    } catch (error) {
      toast.error('Correlation failed');
    } finally {
      setLoading(false);
    }
  };

  const runRegression = async () => {
    if (!regConfig.dependentVar || regConfig.independentVars.length === 0) {
      toast.error('Select dependent and independent variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/regression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          dependent_var: regConfig.dependentVar,
          independent_vars: regConfig.independentVars,
          model_type: regConfig.modelType,
          robust_se: regConfig.robustSE
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults({ type: 'regression', data });
        toast.success('Regression completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Regression failed');
      }
    } catch (error) {
      toast.error('Regression failed');
    } finally {
      setLoading(false);
    }
  };

  const runGLM = async () => {
    if (!glmConfig.dependentVar || glmConfig.independentVars.length === 0) {
      toast.error('Please select dependent and independent variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/models/glm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          dependent_var: glmConfig.dependentVar,
          independent_vars: glmConfig.independentVars,
          family: glmConfig.family,
          link: glmConfig.link && glmConfig.link !== 'default' ? glmConfig.link : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults({ type: 'glm', data });
        toast.success('GLM completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'GLM failed');
      }
    } catch (error) {
      toast.error('GLM failed');
    } finally {
      setLoading(false);
    }
  };

  const runMixedModel = async () => {
    if (!mixedConfig.dependentVar || mixedConfig.fixedEffects.length === 0 || !mixedConfig.groupVar) {
      toast.error('Please select dependent variable, fixed effects, and grouping variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/models/mixed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          dependent_var: mixedConfig.dependentVar,
          fixed_effects: mixedConfig.fixedEffects,
          random_effects: mixedConfig.randomEffects.length > 0 ? mixedConfig.randomEffects : ['1'],
          group_var: mixedConfig.groupVar
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults({ type: 'mixed', data });
        toast.success('Mixed Model completed');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Mixed Model failed');
      }
    } catch (error) {
      toast.error('Mixed Model failed');
    } finally {
      setLoading(false);
    }
  };

  const runFactorAnalysis = async () => {
    if (faConfig.variables.length < 3) {
      toast.error('Please select at least 3 variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/factor-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          variables: faConfig.variables,
          n_factors: faConfig.nFactors ? parseInt(faConfig.nFactors) : null,
          rotation: faConfig.rotation
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setResults({ type: 'factor', data });
          toast.success('Factor analysis completed');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Factor analysis failed');
      }
    } catch (error) {
      toast.error('Factor analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const runNonparametricTest = async () => {
    if (!npConfig.dependentVar) {
      toast.error('Please select a dependent variable');
      return;
    }
    if ((npConfig.testType === 'mann_whitney' || npConfig.testType === 'kruskal_wallis') && !npConfig.groupVar) {
      toast.error('Please select a grouping variable');
      return;
    }
    if (npConfig.testType === 'wilcoxon' && !npConfig.pairedVar) {
      toast.error('Please select a paired variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/nonparametric`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          test_type: npConfig.testType,
          dependent_var: npConfig.dependentVar,
          group_var: npConfig.groupVar || null,
          paired_var: npConfig.pairedVar || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setResults({ type: 'nonparametric', data });
          toast.success('Test completed');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Test failed');
      }
    } catch (error) {
      toast.error('Nonparametric test failed');
    } finally {
      setLoading(false);
    }
  };

  const runClustering = async () => {
    if (clusterConfig.variables.length < 2) {
      toast.error('Please select at least 2 variables');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/clustering`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          variables: clusterConfig.variables,
          method: clusterConfig.method,
          n_clusters: clusterConfig.nClusters ? parseInt(clusterConfig.nClusters) : null,
          linkage: clusterConfig.linkage
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setResults({ type: 'clustering', data });
          toast.success('Clustering completed');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Clustering failed');
      }
    } catch (error) {
      toast.error('Clustering failed');
    } finally {
      setLoading(false);
    }
  };

  const runProportionsTest = async () => {
    if (!propConfig.variable) {
      toast.error('Please select a variable');
      return;
    }
    if (!propConfig.successValue) {
      toast.error('Please specify a success value');
      return;
    }
    if (propConfig.testType === 'two_sample' && !propConfig.groupVar) {
      toast.error('Please select a grouping variable');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/statistics/proportions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId,
          test_type: propConfig.testType,
          variable: propConfig.variable,
          success_value: propConfig.successValue,
          hypothesized_proportion: propConfig.testType === 'one_sample' ? parseFloat(propConfig.hypothesizedProp) : null,
          group_var: propConfig.testType === 'two_sample' ? propConfig.groupVar : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setResults({ type: 'proportions', data });
          toast.success('Proportions test completed');
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Proportions test failed');
      }
    } catch (error) {
      toast.error('Proportions test failed');
    } finally {
      setLoading(false);
    }
  };

  const renderResults = () => {
    if (!results) return null;

    switch (results.type) {
      case 'ttest':
        return <TTestResults data={results.data} />;
      case 'anova':
        return <ANOVAResults data={results.data} />;
      case 'ancova':
        return <ANCOVAResults data={results.data} />;
      case 'correlation':
        return <CorrelationResults data={results.data} />;
      case 'regression':
        return <RegressionResults data={results.data} />;
      case 'glm':
        return <GLMResults data={results.data} />;
      case 'mixed':
        return <MixedModelResults data={results.data} />;
      case 'factor':
        return <FactorAnalysisResults data={results.data} />;
      case 'nonparametric':
        return <NonparametricResults data={results.data} />;
      case 'clustering':
        return <ClusteringResults data={results.data} />;
      case 'proportions':
        return <ProportionsResults data={results.data} />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Advanced Statistics
          </CardTitle>
          <CardDescription>Configure and run statistical tests</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTest} onValueChange={setActiveTest}>
            <TabsList className="grid grid-cols-11 w-full">
              <TabsTrigger value="ttest">T-Test</TabsTrigger>
              <TabsTrigger value="anova">ANOVA</TabsTrigger>
              <TabsTrigger value="ancova">ANCOVA</TabsTrigger>
              <TabsTrigger value="props">Props</TabsTrigger>
              <TabsTrigger value="correlation">Corr</TabsTrigger>
              <TabsTrigger value="regression">Reg</TabsTrigger>
              <TabsTrigger value="glm">GLM</TabsTrigger>
              <TabsTrigger value="mixed">Mixed</TabsTrigger>
              <TabsTrigger value="factor">EFA</TabsTrigger>
              <TabsTrigger value="nonparam">NonP</TabsTrigger>
              <TabsTrigger value="cluster">Cluster</TabsTrigger>
            </TabsList>

            {/* T-Test Configuration */}
            <TabsContent value="ttest" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Test Type</Label>
                  <Select 
                    value={ttestConfig.testType} 
                    onValueChange={(v) => setTtestConfig({...ttestConfig, testType: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="independent">Independent Samples</SelectItem>
                      <SelectItem value="one_sample">One Sample</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Test Variable (Numeric)</Label>
                  <Select 
                    value={ttestConfig.variable} 
                    onValueChange={(v) => setTtestConfig({...ttestConfig, variable: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ttestConfig.testType === 'independent' && (
                  <div>
                    <Label>Grouping Variable</Label>
                    <Select 
                      value={ttestConfig.groupVar} 
                      onValueChange={(v) => setTtestConfig({...ttestConfig, groupVar: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grouping variable..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categoricalFields.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {ttestConfig.testType === 'one_sample' && (
                  <div>
                    <Label>Population Mean (μ₀)</Label>
                    <Input 
                      type="number" 
                      value={ttestConfig.mu}
                      onChange={(e) => setTtestConfig({...ttestConfig, mu: e.target.value})}
                      placeholder="Enter hypothesized mean"
                    />
                  </div>
                )}

                <Button onClick={runTTest} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run T-Test
                </Button>
              </div>
            </TabsContent>

            {/* ANOVA Configuration */}
            <TabsContent value="anova" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Dependent Variable (Numeric)</Label>
                  <Select 
                    value={anovaConfig.dependentVar} 
                    onValueChange={(v) => setAnovaConfig({...anovaConfig, dependentVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Factor Variable (Categorical)</Label>
                  <Select 
                    value={anovaConfig.factorVar} 
                    onValueChange={(v) => setAnovaConfig({...anovaConfig, factorVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select factor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoricalFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="posthoc"
                    checked={anovaConfig.postHoc}
                    onCheckedChange={(c) => setAnovaConfig({...anovaConfig, postHoc: c})}
                  />
                  <Label htmlFor="posthoc">Include Post-hoc Tests (Tukey HSD)</Label>
                </div>

                <Button onClick={runANOVA} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run One-Way ANOVA
                </Button>
              </div>
            </TabsContent>

            {/* ANCOVA Configuration */}
            <TabsContent value="ancova" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Dependent Variable (Numeric)</Label>
                  <Select 
                    value={ancovaConfig.dependentVar} 
                    onValueChange={(v) => setAncovaConfig({...ancovaConfig, dependentVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Grouping Variable (Factor)</Label>
                  <Select 
                    value={ancovaConfig.groupVar} 
                    onValueChange={(v) => setAncovaConfig({...ancovaConfig, groupVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grouping variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoricalFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Covariates ({ancovaConfig.covariates.length} selected)</Label>
                  <ScrollArea className="h-[100px] border rounded-md p-2 mt-1">
                    {numericFields.filter(f => f.id !== ancovaConfig.dependentVar).map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`ancova-cov-${f.id}`}
                          checked={ancovaConfig.covariates.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setAncovaConfig({...ancovaConfig, covariates: [...ancovaConfig.covariates, f.id]});
                            } else {
                              setAncovaConfig({...ancovaConfig, covariates: ancovaConfig.covariates.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`ancova-cov-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  <Info className="h-3 w-3 inline mr-1" />
                  ANCOVA compares group means while controlling for covariates. Useful for pre/post designs or removing confounding effects.
                </div>

                <Button onClick={runANCOVA} disabled={loading || ancovaConfig.covariates.length === 0} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run ANCOVA
                </Button>
              </div>
            </TabsContent>

            {/* Proportions Test Configuration */}
            <TabsContent value="props" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Test Type</Label>
                  <Select 
                    value={propConfig.testType} 
                    onValueChange={(v) => setPropConfig({...propConfig, testType: v, groupVar: ''})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_sample">One-Sample (vs hypothesized)</SelectItem>
                      <SelectItem value="two_sample">Two-Sample (compare groups)</SelectItem>
                      <SelectItem value="chi_square_gof">Chi-Square Goodness of Fit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Variable</Label>
                  <Select 
                    value={propConfig.variable} 
                    onValueChange={(v) => setPropConfig({...propConfig, variable: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {propConfig.testType !== 'chi_square_gof' && (
                  <div>
                    <Label>Success Value (what counts as "success")</Label>
                    <Input
                      value={propConfig.successValue}
                      onChange={e => setPropConfig({...propConfig, successValue: e.target.value})}
                      placeholder="e.g., Yes, 1, Agree"
                    />
                  </div>
                )}

                {propConfig.testType === 'one_sample' && (
                  <div>
                    <Label>Hypothesized Proportion</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={propConfig.hypothesizedProp}
                      onChange={e => setPropConfig({...propConfig, hypothesizedProp: e.target.value})}
                      placeholder="0.5"
                    />
                  </div>
                )}

                {propConfig.testType === 'two_sample' && (
                  <div>
                    <Label>Grouping Variable (2 groups)</Label>
                    <Select 
                      value={propConfig.groupVar} 
                      onValueChange={(v) => setPropConfig({...propConfig, groupVar: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grouping variable..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categoricalFields.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  <Info className="h-3 w-3 inline mr-1" />
                  {propConfig.testType === 'one_sample' && 'Tests if observed proportion differs from a hypothesized value.'}
                  {propConfig.testType === 'two_sample' && 'Compares proportions between two groups (Z-test).'}
                  {propConfig.testType === 'chi_square_gof' && 'Tests if observed distribution matches expected proportions.'}
                </div>

                <Button onClick={runProportionsTest} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run Proportions Test
                </Button>
              </div>
            </TabsContent>

            {/* Correlation Configuration */}
            <TabsContent value="correlation" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Correlation Method</Label>
                  <Select 
                    value={corrConfig.method} 
                    onValueChange={(v) => setCorrConfig({...corrConfig, method: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pearson">Pearson (Linear)</SelectItem>
                      <SelectItem value="spearman">Spearman (Rank)</SelectItem>
                      <SelectItem value="kendall">Kendall Tau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Variables (select 2+)</Label>
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    {numericFields.map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`corr-${f.id}`}
                          checked={corrConfig.variables.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCorrConfig({...corrConfig, variables: [...corrConfig.variables, f.id]});
                            } else {
                              setCorrConfig({...corrConfig, variables: corrConfig.variables.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`corr-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <Button onClick={runCorrelation} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Calculate Correlations
                </Button>
              </div>
            </TabsContent>

            {/* Regression Configuration */}
            <TabsContent value="regression" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Model Type</Label>
                  <Select 
                    value={regConfig.modelType} 
                    onValueChange={(v) => setRegConfig({...regConfig, modelType: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ols">OLS (Linear)</SelectItem>
                      <SelectItem value="logistic">Logistic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dependent Variable (Y)</Label>
                  <Select 
                    value={regConfig.dependentVar} 
                    onValueChange={(v) => setRegConfig({...regConfig, dependentVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Independent Variables (X)</Label>
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    {fields.filter(f => f.id !== regConfig.dependentVar).map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`reg-${f.id}`}
                          checked={regConfig.independentVars.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setRegConfig({...regConfig, independentVars: [...regConfig.independentVars, f.id]});
                            } else {
                              setRegConfig({...regConfig, independentVars: regConfig.independentVars.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`reg-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="robust"
                    checked={regConfig.robustSE}
                    onCheckedChange={(c) => setRegConfig({...regConfig, robustSE: c})}
                  />
                  <Label htmlFor="robust">Use Robust Standard Errors</Label>
                </div>

                <Button onClick={runRegression} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run Regression
                </Button>
              </div>
            </TabsContent>

            {/* GLM Configuration */}
            <TabsContent value="glm" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Family (Distribution)</Label>
                  <Select 
                    value={glmConfig.family} 
                    onValueChange={(v) => setGlmConfig({...glmConfig, family: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gaussian">Gaussian (Normal)</SelectItem>
                      <SelectItem value="binomial">Binomial (Logistic)</SelectItem>
                      <SelectItem value="poisson">Poisson (Count)</SelectItem>
                      <SelectItem value="gamma">Gamma</SelectItem>
                      <SelectItem value="inverse_gaussian">Inverse Gaussian</SelectItem>
                      <SelectItem value="negative_binomial">Negative Binomial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Link Function (Optional)</Label>
                  <Select 
                    value={glmConfig.link} 
                    onValueChange={(v) => setGlmConfig({...glmConfig, link: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Default for family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="identity">Identity</SelectItem>
                      <SelectItem value="log">Log</SelectItem>
                      <SelectItem value="logit">Logit</SelectItem>
                      <SelectItem value="probit">Probit</SelectItem>
                      <SelectItem value="inverse">Inverse</SelectItem>
                      <SelectItem value="sqrt">Square Root</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dependent Variable (Y)</Label>
                  <Select 
                    value={glmConfig.dependentVar} 
                    onValueChange={(v) => setGlmConfig({...glmConfig, dependentVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Independent Variables (X)</Label>
                  <ScrollArea className="h-[120px] border rounded-md p-2">
                    {fields.filter(f => f.id !== glmConfig.dependentVar).map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`glm-${f.id}`}
                          checked={glmConfig.independentVars.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGlmConfig({...glmConfig, independentVars: [...glmConfig.independentVars, f.id]});
                            } else {
                              setGlmConfig({...glmConfig, independentVars: glmConfig.independentVars.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`glm-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <Button onClick={runGLM} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run GLM
                </Button>
              </div>
            </TabsContent>

            {/* Mixed Models Configuration */}
            <TabsContent value="mixed" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Dependent Variable (Y)</Label>
                  <Select 
                    value={mixedConfig.dependentVar} 
                    onValueChange={(v) => setMixedConfig({...mixedConfig, dependentVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Grouping Variable (Clusters)</Label>
                  <Select 
                    value={mixedConfig.groupVar} 
                    onValueChange={(v) => setMixedConfig({...mixedConfig, groupVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cluster variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoricalFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fixed Effects</Label>
                  <ScrollArea className="h-[100px] border rounded-md p-2">
                    {fields.filter(f => f.id !== mixedConfig.dependentVar && f.id !== mixedConfig.groupVar).map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`fixed-${f.id}`}
                          checked={mixedConfig.fixedEffects.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setMixedConfig({...mixedConfig, fixedEffects: [...mixedConfig.fixedEffects, f.id]});
                            } else {
                              setMixedConfig({...mixedConfig, fixedEffects: mixedConfig.fixedEffects.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`fixed-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  <Info className="h-3 w-3 inline mr-1" />
                  Mixed models estimate random intercepts for each group. The ICC (Intraclass Correlation) shows variance attributed to grouping.
                </div>

                <Button onClick={runMixedModel} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run Mixed Model
                </Button>
              </div>
            </TabsContent>

            {/* Factor Analysis Configuration */}
            <TabsContent value="factor" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Variables ({faConfig.variables.length} selected)</Label>
                  <ScrollArea className="h-[150px] border rounded-md p-2 mt-1">
                    {numericFields.map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`fa-${f.id}`}
                          checked={faConfig.variables.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFaConfig({...faConfig, variables: [...faConfig.variables, f.id]});
                            } else {
                              setFaConfig({...faConfig, variables: faConfig.variables.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`fa-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <div>
                  <Label>Number of Factors</Label>
                  <Input
                    type="number"
                    min="1"
                    max={faConfig.variables.length}
                    value={faConfig.nFactors}
                    onChange={e => setFaConfig({...faConfig, nFactors: e.target.value})}
                    placeholder="Auto (Kaiser criterion)"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Rotation Method</Label>
                  <Select value={faConfig.rotation} onValueChange={v => setFaConfig({...faConfig, rotation: v})}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="varimax">Varimax (orthogonal)</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  <Info className="h-3 w-3 inline mr-1" />
                  Factor analysis identifies latent constructs underlying your variables. Requires at least 3 numeric variables and 50+ observations.
                </div>

                <Button onClick={runFactorAnalysis} disabled={loading || faConfig.variables.length < 3} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run Factor Analysis
                </Button>
              </div>
            </TabsContent>

            {/* Nonparametric Tests Configuration */}
            <TabsContent value="nonparam" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Test Type</Label>
                  <Select 
                    value={npConfig.testType} 
                    onValueChange={(v) => setNpConfig({...npConfig, testType: v, groupVar: '', pairedVar: ''})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mann_whitney">Mann-Whitney U (2 groups)</SelectItem>
                      <SelectItem value="wilcoxon">Wilcoxon Signed-Rank (paired)</SelectItem>
                      <SelectItem value="kruskal_wallis">Kruskal-Wallis H (3+ groups)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dependent Variable (Numeric)</Label>
                  <Select 
                    value={npConfig.dependentVar} 
                    onValueChange={(v) => setNpConfig({...npConfig, dependentVar: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select variable..." />
                    </SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(npConfig.testType === 'mann_whitney' || npConfig.testType === 'kruskal_wallis') && (
                  <div>
                    <Label>Grouping Variable</Label>
                    <Select 
                      value={npConfig.groupVar} 
                      onValueChange={(v) => setNpConfig({...npConfig, groupVar: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select grouping variable..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categoricalFields.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {npConfig.testType === 'wilcoxon' && (
                  <div>
                    <Label>Paired Variable (Numeric)</Label>
                    <Select 
                      value={npConfig.pairedVar} 
                      onValueChange={(v) => setNpConfig({...npConfig, pairedVar: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select paired variable..." />
                      </SelectTrigger>
                      <SelectContent>
                        {numericFields.filter(f => f.id !== npConfig.dependentVar).map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  <Info className="h-3 w-3 inline mr-1" />
                  {npConfig.testType === 'mann_whitney' && 'Mann-Whitney U: Non-parametric alternative to independent t-test for 2 groups.'}
                  {npConfig.testType === 'wilcoxon' && 'Wilcoxon: Non-parametric alternative to paired t-test for related samples.'}
                  {npConfig.testType === 'kruskal_wallis' && 'Kruskal-Wallis H: Non-parametric alternative to one-way ANOVA for 3+ groups.'}
                </div>

                <Button onClick={runNonparametricTest} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run Test
                </Button>
              </div>
            </TabsContent>

            {/* Clustering Configuration */}
            <TabsContent value="cluster" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label>Clustering Method</Label>
                  <Select 
                    value={clusterConfig.method} 
                    onValueChange={(v) => setClusterConfig({...clusterConfig, method: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kmeans">K-Means</SelectItem>
                      <SelectItem value="hierarchical">Hierarchical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Variables ({clusterConfig.variables.length} selected)</Label>
                  <ScrollArea className="h-[120px] border rounded-md p-2 mt-1">
                    {numericFields.map(f => (
                      <div key={f.id} className="flex items-center space-x-2 py-1">
                        <Checkbox 
                          id={`cluster-${f.id}`}
                          checked={clusterConfig.variables.includes(f.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setClusterConfig({...clusterConfig, variables: [...clusterConfig.variables, f.id]});
                            } else {
                              setClusterConfig({...clusterConfig, variables: clusterConfig.variables.filter(v => v !== f.id)});
                            }
                          }}
                        />
                        <Label htmlFor={`cluster-${f.id}`} className="text-sm">{f.label || f.id}</Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                <div>
                  <Label>Number of Clusters</Label>
                  <Input
                    type="number"
                    min="2"
                    max="20"
                    value={clusterConfig.nClusters}
                    onChange={e => setClusterConfig({...clusterConfig, nClusters: e.target.value})}
                    placeholder="Auto (elbow method)"
                    className="mt-1"
                  />
                </div>

                {clusterConfig.method === 'hierarchical' && (
                  <div>
                    <Label>Linkage Method</Label>
                    <Select 
                      value={clusterConfig.linkage} 
                      onValueChange={(v) => setClusterConfig({...clusterConfig, linkage: v})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ward">Ward (minimize variance)</SelectItem>
                        <SelectItem value="complete">Complete (max distance)</SelectItem>
                        <SelectItem value="average">Average (UPGMA)</SelectItem>
                        <SelectItem value="single">Single (min distance)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="bg-slate-50 p-2 rounded text-xs text-slate-600">
                  <Info className="h-3 w-3 inline mr-1" />
                  {clusterConfig.method === 'kmeans' && 'K-Means partitions data into K clusters by minimizing within-cluster variance. Auto-detects optimal K using elbow method.'}
                  {clusterConfig.method === 'hierarchical' && 'Hierarchical clustering builds a tree of clusters. Ward linkage typically produces compact, well-separated clusters.'}
                </div>

                <Button onClick={runClustering} disabled={loading || clusterConfig.variables.length < 2} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run Clustering
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Results
          </CardTitle>
          <CardDescription>Statistical test output</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            </div>
          ) : results ? (
            <ScrollArea className="h-[500px]">
              {renderResults()}
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Run a test to see results</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// T-Test Results Component
function TTestResults({ data }) {
  const isSignificant = data.significant;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isSignificant ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Significant
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Not Significant
          </Badge>
        )}
        <span className="text-sm text-slate-500">
          {data.test_type === 'independent' ? 'Independent Samples T-Test' : 'One Sample T-Test'}
        </span>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-slate-500">T-Statistic</p>
          <p className="text-lg font-semibold">{data.t_statistic}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">P-Value</p>
          <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
            {data.p_value < 0.001 ? '< 0.001' : data.p_value}
          </p>
        </div>
      </div>

      {data.groups && (
        <>
          <Separator />
          <h4 className="font-medium">Group Statistics</h4>
          <div className="space-y-2">
            {Object.entries(data.groups).map(([group, stats]) => (
              <div key={group} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span className="font-medium">{group}</span>
                <span className="text-sm text-slate-600">
                  N={stats.n}, M={stats.mean}, SD={stats.std}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {data.effect_size && (
        <>
          <Separator />
          <div>
            <p className="text-sm text-slate-500">Effect Size (Cohen's d)</p>
            <p className="text-lg font-semibold">
              {data.effect_size.cohens_d} 
              <span className="text-sm text-slate-500 ml-2">
                ({data.effect_size.interpretation})
              </span>
            </p>
          </div>
        </>
      )}

      {data.confidence_interval && (
        <div className="p-3 bg-sky-50 rounded-lg">
          <p className="text-sm text-slate-600">95% Confidence Interval</p>
          <p className="font-medium">
            [{data.confidence_interval.lower}, {data.confidence_interval.upper}]
          </p>
        </div>
      )}
    </div>
  );
}

// ANOVA Results Component
function ANOVAResults({ data }) {
  const isSignificant = data.anova?.significant;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isSignificant ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Significant
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Not Significant
          </Badge>
        )}
        <span className="text-sm text-slate-500">One-Way ANOVA</span>
      </div>

      <Separator />

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-slate-500">F-Statistic</p>
          <p className="text-lg font-semibold">{data.anova?.f_statistic}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">P-Value</p>
          <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
            {data.anova?.p_value < 0.001 ? '< 0.001' : data.anova?.p_value}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Groups</p>
          <p className="text-lg font-semibold">{data.n_groups}</p>
        </div>
      </div>

      {data.group_statistics && (
        <>
          <Separator />
          <h4 className="font-medium">Group Statistics</h4>
          <div className="space-y-2">
            {Object.entries(data.group_statistics).map(([group, stats]) => (
              <div key={group} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span className="font-medium">{group}</span>
                <span className="text-sm text-slate-600">
                  N={stats.n}, M={stats.mean?.toFixed(2)}, SD={stats.std?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {data.effect_size && (
        <div className="p-3 bg-amber-50 rounded-lg">
          <p className="text-sm text-slate-600">Effect Size (η²)</p>
          <p className="font-medium">
            {data.effect_size.eta_squared} 
            <span className="text-sm text-slate-500 ml-2">
              ({data.effect_size.interpretation})
            </span>
          </p>
        </div>
      )}

      {data.post_hoc_tukey && data.post_hoc_tukey.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Post-hoc Comparisons (Tukey HSD)</h4>
          <div className="space-y-2">
            {data.post_hoc_tukey.map((comparison, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-center p-2 rounded ${
                  comparison.significant ? 'bg-red-50' : 'bg-slate-50'
                }`}
              >
                <span className="text-sm">
                  {comparison.group_a} vs {comparison.group_b}
                </span>
                <span className="text-sm">
                  Δ = {comparison.mean_diff}, p = {comparison.p_value}
                  {comparison.significant && <span className="text-red-600 ml-1">*</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ANCOVA Results Component
function ANCOVAResults({ data }) {
  const isSignificant = data.group_effect?.significant;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isSignificant ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Significant
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Not Significant
          </Badge>
        )}
        <Badge variant="outline">ANCOVA</Badge>
        <Badge variant="outline">N = {data.n_observations}</Badge>
      </div>

      <Separator />

      {/* Group Effect */}
      <h4 className="font-medium">Group Effect (controlling for covariates)</h4>
      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">F-Statistic</p>
          <p className="text-lg font-semibold">{data.group_effect?.F}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">P-Value</p>
          <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
            {data.group_effect?.p_value < 0.001 ? '< 0.001' : data.group_effect?.p_value}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">df</p>
          <p className="text-lg font-semibold">{data.group_effect?.df}</p>
        </div>
        <div className="p-3 bg-sky-50 rounded">
          <p className="text-sm text-slate-500">Partial η²</p>
          <p className="text-lg font-semibold">{data.group_effect?.partial_eta_squared}</p>
        </div>
      </div>

      {/* Adjusted Means */}
      {data.adjusted_means && (
        <>
          <Separator />
          <h4 className="font-medium">Adjusted Group Means</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2 text-left">Group</th>
                  <th className="p-2 text-right">N</th>
                  <th className="p-2 text-right">Raw Mean</th>
                  <th className="p-2 text-right">Adjusted Mean</th>
                </tr>
              </thead>
              <tbody>
                {data.adjusted_means.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-medium">{row.group}</td>
                    <td className="p-2 text-right">{row.n}</td>
                    <td className="p-2 text-right">{row.raw_mean}</td>
                    <td className="p-2 text-right font-medium text-sky-600">{row.adjusted_mean}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Adjusted means estimated at covariate mean values</p>
        </>
      )}

      {/* Covariate Effects */}
      {data.covariate_effects && data.covariate_effects.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Covariate Effects</h4>
          <div className="space-y-2">
            {data.covariate_effects.map((cov, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-center p-2 rounded ${
                  cov.significant ? 'bg-amber-50' : 'bg-slate-50'
                }`}
              >
                <span className="font-medium">{cov.variable}</span>
                <span className="text-sm text-slate-600">
                  β = {cov.coefficient}, t = {cov.t_value}, p = {cov.p_value}
                  {cov.significant && <span className="text-amber-600 ml-1">*</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pairwise Comparisons */}
      {data.pairwise_comparisons && data.pairwise_comparisons.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Pairwise Comparisons (Adjusted Means)</h4>
          <div className="space-y-2">
            {data.pairwise_comparisons.map((comp, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-center p-2 rounded ${
                  comp.significant ? 'bg-red-50' : 'bg-slate-50'
                }`}
              >
                <span className="text-sm">
                  {comp.group1} vs {comp.group2}
                </span>
                <span className="text-sm">
                  Δ = {comp.diff_adjusted}, t = {comp.t_statistic}, p_adj = {comp.p_adjusted}
                  {comp.significant && <span className="text-red-600 ml-1">*</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">{data.pairwise_note}</p>
        </>
      )}

      {/* Model Fit */}
      {data.model_fit && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-emerald-50 rounded">
            <p className="text-sm text-slate-500">R²</p>
            <p className="text-lg font-semibold">{data.model_fit.r_squared}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded">
            <p className="text-sm text-slate-500">Adjusted R²</p>
            <p className="text-lg font-semibold">{data.model_fit.adj_r_squared}</p>
          </div>
        </div>
      )}

      {/* Interpretation */}
      {data.interpretation && (
        <div className={`p-3 rounded-lg flex items-start gap-2 ${isSignificant ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <Info className={`h-4 w-4 mt-0.5 ${isSignificant ? 'text-red-600' : 'text-emerald-600'}`} />
          <p className={`text-sm ${isSignificant ? 'text-red-800' : 'text-emerald-800'}`}>
            {data.interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

// Correlation Results Component
function CorrelationResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{data.method} Correlation</Badge>
        <span className="text-sm text-slate-500">N = {data.n}</span>
      </div>

      <Separator />

      <h4 className="font-medium">Correlation Matrix</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left"></th>
              {data.variables.map(v => (
                <th key={v} className="p-2 text-center font-medium">{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.variables.map(v1 => (
              <tr key={v1} className="border-b">
                <td className="p-2 font-medium">{v1}</td>
                {data.variables.map(v2 => {
                  const r = data.correlation_matrix?.[v1]?.[v2];
                  const p = data.p_value_matrix?.[v1]?.[v2];
                  const isSignificant = p !== null && p < 0.05;
                  return (
                    <td 
                      key={v2} 
                      className={`p-2 text-center ${
                        v1 === v2 ? 'bg-slate-100' : 
                        isSignificant ? 'bg-sky-50' : ''
                      }`}
                    >
                      {r !== null ? r.toFixed(3) : '-'}
                      {isSignificant && v1 !== v2 && <span className="text-sky-600">*</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pairwise_correlations && data.pairwise_correlations.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Significant Correlations</h4>
          <div className="space-y-2">
            {data.pairwise_correlations
              .filter(c => c.significant)
              .map((corr, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-sky-50 rounded">
                  <span className="text-sm">{corr.var1} ↔ {corr.var2}</span>
                  <span className="text-sm font-medium">
                    r = {corr.correlation}, p = {corr.p_value < 0.001 ? '< .001' : corr.p_value}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// Regression Results Component
function RegressionResults({ data }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {data.model_type === 'ols' ? 'OLS Regression' : 'Logistic Regression'}
        </Badge>
        <span className="text-sm text-slate-500">N = {data.n}</span>
      </div>

      <Separator />

      {/* Model Fit */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">R²</p>
          <p className="text-lg font-semibold">{data.model_fit?.r_squared?.toFixed(4)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">Adj. R²</p>
          <p className="text-lg font-semibold">{data.model_fit?.adj_r_squared?.toFixed(4)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">F-Statistic</p>
          <p className="text-lg font-semibold">{data.model_fit?.f_statistic?.toFixed(2)}</p>
          <p className="text-xs text-slate-500">p = {data.model_fit?.f_pvalue?.toFixed(4)}</p>
        </div>
      </div>

      <Separator />

      {/* Coefficients Table */}
      <h4 className="font-medium">Coefficients</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-2 text-left">Variable</th>
              <th className="p-2 text-right">Coef</th>
              <th className="p-2 text-right">SE</th>
              <th className="p-2 text-right">t</th>
              <th className="p-2 text-right">p-value</th>
              <th className="p-2 text-center">Sig</th>
            </tr>
          </thead>
          <tbody>
            {data.coefficients && Object.entries(data.coefficients).map(([varName, coef]) => (
              <tr key={varName} className="border-b">
                <td className="p-2 font-medium">{varName}</td>
                <td className="p-2 text-right">{coef.coefficient?.toFixed(4)}</td>
                <td className="p-2 text-right">{coef.std_error?.toFixed(4)}</td>
                <td className="p-2 text-right">{coef.t_value?.toFixed(2)}</td>
                <td className="p-2 text-right">
                  {coef.p_value < 0.001 ? '< .001' : coef.p_value?.toFixed(4)}
                </td>
                <td className="p-2 text-center">
                  {coef.significant ? (
                    <span className="text-red-600 font-bold">*</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Model Diagnostics */}
      {data.diagnostics && (
        <>
          <Separator />
          <h4 className="font-medium">Model Diagnostics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">AIC</p>
              <p className="font-medium">{data.diagnostics.aic?.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">BIC</p>
              <p className="font-medium">{data.diagnostics.bic?.toFixed(2)}</p>
            </div>
          </div>
        </>
      )}

      <div className="p-3 bg-amber-50 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-amber-600 mt-0.5" />
        <p className="text-sm text-amber-800">
          * indicates significance at p &lt; 0.05 level
        </p>
      </div>
    </div>
  );
}

// GLM Results Component
function GLMResults({ data }) {
  if (data.error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-700">{data.error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge>{data.model_type}</Badge>
        <Badge variant="outline">Family: {data.family}</Badge>
        <Badge variant="outline">Link: {data.link}</Badge>
      </div>

      <Separator />

      {/* Model Fit */}
      <h4 className="font-medium">Model Fit</h4>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">N</p>
          <p className="text-lg font-semibold">{data.model_fit?.n}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">Deviance</p>
          <p className="text-lg font-semibold">{data.model_fit?.deviance?.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">AIC</p>
          <p className="text-lg font-semibold">{data.model_fit?.aic?.toFixed(2)}</p>
        </div>
        {data.model_fit?.pseudo_r_squared !== undefined && (
          <div className="p-3 bg-sky-50 rounded">
            <p className="text-sm text-slate-500">Pseudo R²</p>
            <p className="text-lg font-semibold">{data.model_fit.pseudo_r_squared?.toFixed(4)}</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Coefficients */}
      <h4 className="font-medium">Coefficients</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-2 text-left">Variable</th>
              <th className="p-2 text-right">Coef</th>
              <th className="p-2 text-right">SE</th>
              <th className="p-2 text-right">z</th>
              <th className="p-2 text-right">p-value</th>
              <th className="p-2 text-center">95% CI</th>
            </tr>
          </thead>
          <tbody>
            {data.coefficients && Object.entries(data.coefficients).map(([varName, coef]) => (
              <tr key={varName} className={`border-b ${coef.significant ? 'bg-sky-50/50' : ''}`}>
                <td className="p-2 font-medium">{varName}</td>
                <td className="p-2 text-right">{coef.coefficient?.toFixed(4)}</td>
                <td className="p-2 text-right">{coef.std_error?.toFixed(4)}</td>
                <td className="p-2 text-right">{coef.z_value?.toFixed(3)}</td>
                <td className="p-2 text-right">
                  {coef.p_value < 0.001 ? '< .001' : coef.p_value?.toFixed(4)}
                </td>
                <td className="p-2 text-center text-xs">
                  [{coef.conf_int?.lower?.toFixed(3)}, {coef.conf_int?.upper?.toFixed(3)}]
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 mt-0.5" />
        <p className="text-sm text-blue-800">
          GLM extends linear regression to non-normal distributions. Highlighted rows are significant at p &lt; 0.05.
        </p>
      </div>
    </div>
  );
}

// Mixed Model Results Component
function MixedModelResults({ data }) {
  if (data.error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-700">{data.error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge>{data.model_type}</Badge>
        <Badge variant="outline">Groups: {data.random_effects?.n_groups}</Badge>
        {data.model_fit?.converged && (
          <Badge className="bg-emerald-100 text-emerald-700">Converged</Badge>
        )}
      </div>

      <Separator />

      {/* Model Fit */}
      <h4 className="font-medium">Model Fit</h4>
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">N</p>
          <p className="text-lg font-semibold">{data.model_fit?.n}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">Groups</p>
          <p className="text-lg font-semibold">{data.model_fit?.n_groups}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">AIC</p>
          <p className="text-lg font-semibold">{data.model_fit?.aic?.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">BIC</p>
          <p className="text-lg font-semibold">{data.model_fit?.bic?.toFixed(2)}</p>
        </div>
      </div>

      {/* ICC */}
      {data.random_effects?.icc !== null && (
        <div className="p-4 bg-sky-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sky-900">Intraclass Correlation (ICC)</p>
              <p className="text-sm text-sky-700">Variance explained by grouping</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-sky-600">{(data.random_effects.icc * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Fixed Effects */}
      <h4 className="font-medium">Fixed Effects</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-2 text-left">Variable</th>
              <th className="p-2 text-right">Coef</th>
              <th className="p-2 text-right">SE</th>
              <th className="p-2 text-right">z</th>
              <th className="p-2 text-right">p-value</th>
              <th className="p-2 text-center">Sig</th>
            </tr>
          </thead>
          <tbody>
            {data.fixed_effects && Object.entries(data.fixed_effects).map(([varName, coef]) => (
              <tr key={varName} className={`border-b ${coef.significant ? 'bg-sky-50/50' : ''}`}>
                <td className="p-2 font-medium">{varName}</td>
                <td className="p-2 text-right">{coef.coefficient?.toFixed(4)}</td>
                <td className="p-2 text-right">{coef.std_error?.toFixed(4)}</td>
                <td className="p-2 text-right">{coef.z_value?.toFixed(3)}</td>
                <td className="p-2 text-right">
                  {coef.p_value < 0.001 ? '< .001' : coef.p_value?.toFixed(4)}
                </td>
                <td className="p-2 text-center">
                  {coef.significant ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto" />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Random Effects Variance */}
      {data.random_effects?.variance_components && Object.keys(data.random_effects.variance_components).length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Random Effects Variance</h4>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.random_effects.variance_components).map(([name, value]) => (
              <div key={name} className="p-3 bg-slate-50 rounded">
                <p className="text-sm text-slate-500">{name}</p>
                <p className="font-semibold">{value?.toFixed(4)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="p-3 bg-purple-50 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-purple-600 mt-0.5" />
        <p className="text-sm text-purple-800">
          Mixed models account for clustering/nesting in data. ICC indicates what proportion of variance is between groups vs within groups.
        </p>
      </div>
    </div>
  );
}

// Factor Analysis Results Component
function FactorAnalysisResults({ data }) {
  if (data.error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-700">{data.error}</span>
      </div>
    );
  }

  const getLoadingColor = (loading) => {
    const absLoading = Math.abs(loading);
    if (absLoading >= 0.7) return loading > 0 ? '#10b981' : '#ef4444';
    if (absLoading >= 0.4) return loading > 0 ? '#22d3ee' : '#f97316';
    return '#94a3b8';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge>Factor Analysis</Badge>
        <Badge variant="outline">{data.n_factors} Factors</Badge>
        <Badge variant="outline">{data.rotation} rotation</Badge>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-xs text-slate-500">N</p>
          <p className="text-lg font-semibold">{data.n_observations}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-xs text-slate-500">Variables</p>
          <p className="text-lg font-semibold">{data.n_variables}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-xs text-slate-500">Factors</p>
          <p className="text-lg font-semibold">{data.n_factors}</p>
        </div>
        <div className="p-3 bg-sky-50 rounded">
          <p className="text-xs text-slate-500">Variance</p>
          <p className="text-lg font-semibold text-sky-600">{data.variance_explained?.total}%</p>
        </div>
      </div>

      {/* KMO & Bartlett */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg ${data.kmo?.value >= 0.6 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">KMO</p>
              <p className="text-xs text-slate-500">{data.kmo?.interpretation}</p>
            </div>
            <p className="text-xl font-bold">{data.kmo?.value}</p>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${data.bartlett_test?.significant ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Bartlett's Test</p>
              <p className="text-xs text-slate-500">χ² = {data.bartlett_test?.chi_square}</p>
            </div>
            <Badge className={data.bartlett_test?.significant ? 'bg-emerald-100 text-emerald-700' : ''}>
              p {data.bartlett_test?.p_value < 0.001 ? '< .001' : `= ${data.bartlett_test?.p_value}`}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Loading Matrix */}
      <h4 className="font-medium">Factor Loadings</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-2 text-left">Variable</th>
              {Array.from({ length: data.n_factors }, (_, i) => (
                <th key={i} className="p-2 text-center">F{i + 1}</th>
              ))}
              <th className="p-2 text-center">h²</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.loading_matrix || {}).map(([varName, loadings]) => (
              <tr key={varName} className="border-b hover:bg-slate-50">
                <td className="p-2 font-medium text-xs">{varName}</td>
                {Array.from({ length: data.n_factors }, (_, i) => {
                  const loading = loadings[`Factor_${i + 1}`];
                  return (
                    <td key={i} className="p-2 text-center">
                      <span 
                        className="px-1 py-0.5 rounded text-xs font-mono"
                        style={{ 
                          backgroundColor: Math.abs(loading) >= 0.4 ? getLoadingColor(loading) + '20' : 'transparent',
                          color: getLoadingColor(loading),
                          fontWeight: Math.abs(loading) >= 0.4 ? 'bold' : 'normal'
                        }}
                      >
                        {loading?.toFixed(2)}
                      </span>
                    </td>
                  );
                })}
                <td className="p-2 text-center text-xs text-slate-500">{loadings.communality?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Factor Interpretation */}
      {data.factor_interpretation && data.factor_interpretation.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Factor Summary</h4>
          <div className="grid grid-cols-2 gap-2">
            {data.factor_interpretation.map((factor, idx) => (
              <div key={idx} className="p-2 border rounded text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-xs">{factor.factor}</Badge>
                  <span className="text-xs text-slate-500">
                    {data.variance_explained?.by_factor[idx]}%
                  </span>
                </div>
                {factor.high_loading_variables.length > 0 ? (
                  <p className="text-xs text-slate-600">
                    {factor.high_loading_variables.map(v => v.variable).join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">No loadings ≥ 0.4</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 mt-0.5" />
        <p className="text-sm text-blue-800">
          h² = communality. Loadings ≥ 0.4 indicate meaningful relationship. KMO ≥ 0.6 suggests adequate sampling.
        </p>
      </div>
    </div>
  );
}

// Nonparametric Results Component
function NonparametricResults({ data }) {
  if (data.error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-700">{data.error}</span>
      </div>
    );
  }

  const isSignificant = data.significant;
  
  const getTestName = (type) => {
    switch(type) {
      case 'mann_whitney': return 'Mann-Whitney U Test';
      case 'wilcoxon': return 'Wilcoxon Signed-Rank Test';
      case 'kruskal_wallis': return 'Kruskal-Wallis H Test';
      default: return 'Nonparametric Test';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isSignificant ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Significant
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Not Significant
          </Badge>
        )}
        <Badge variant="outline">{getTestName(data.test_type)}</Badge>
      </div>

      <Separator />

      {/* Test Statistics */}
      <div className="grid grid-cols-3 gap-4">
        {data.U_statistic !== undefined && (
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-500">U Statistic</p>
            <p className="text-lg font-semibold">{data.U_statistic}</p>
          </div>
        )}
        {data.W_statistic !== undefined && (
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-500">W Statistic</p>
            <p className="text-lg font-semibold">{data.W_statistic}</p>
          </div>
        )}
        {data.H_statistic !== undefined && (
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-500">H Statistic</p>
            <p className="text-lg font-semibold">{data.H_statistic}</p>
          </div>
        )}
        <div className="p-3 bg-slate-50 rounded">
          <p className="text-sm text-slate-500">P-Value</p>
          <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
            {data.p_value < 0.001 ? '< 0.001' : data.p_value}
          </p>
        </div>
        {data.effect_size_r !== undefined && (
          <div className="p-3 bg-sky-50 rounded">
            <p className="text-sm text-slate-500">Effect Size (r)</p>
            <p className="text-lg font-semibold">{data.effect_size_r}</p>
          </div>
        )}
        {data.eta_squared !== undefined && (
          <div className="p-3 bg-sky-50 rounded">
            <p className="text-sm text-slate-500">Effect Size (η²)</p>
            <p className="text-lg font-semibold">{data.eta_squared}</p>
          </div>
        )}
      </div>

      {/* Group Statistics */}
      {data.groups && data.groups.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Group Statistics</h4>
          <div className="space-y-2">
            {data.groups.map((group, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded">
                <span className="font-medium">{group.name}</span>
                <span className="text-sm text-slate-600">
                  N = {group.n}, Median = {group.median}
                  {group.mean_rank && `, Mean Rank = ${group.mean_rank}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Paired Data Stats */}
      {data.var1_median !== undefined && (
        <>
          <Separator />
          <h4 className="font-medium">Paired Data Statistics</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">Variable 1 Median</p>
              <p className="text-lg font-semibold">{data.var1_median}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">Variable 2 Median</p>
              <p className="text-lg font-semibold">{data.var2_median}</p>
            </div>
            <div className="p-3 bg-sky-50 rounded">
              <p className="text-sm text-slate-500">Median Difference</p>
              <p className="text-lg font-semibold">{data.median_diff}</p>
            </div>
          </div>
        </>
      )}

      {/* Post-hoc Comparisons */}
      {data.posthoc && data.posthoc.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Post-hoc Pairwise Comparisons</h4>
          <div className="space-y-2">
            {data.posthoc.map((comp, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-center p-2 rounded ${
                  comp.significant ? 'bg-red-50' : 'bg-slate-50'
                }`}
              >
                <span className="text-sm">
                  {comp.group1} vs {comp.group2}
                </span>
                <span className="text-sm">
                  U = {comp.U_statistic}, p = {comp.p_value} (adj: {comp.adj_p_value})
                  {comp.significant && <span className="text-red-600 ml-1">*</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">* p-values adjusted using Bonferroni correction</p>
        </>
      )}

      {/* Interpretation */}
      {data.interpretation && (
        <div className={`p-3 rounded-lg flex items-start gap-2 ${isSignificant ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <Info className={`h-4 w-4 mt-0.5 ${isSignificant ? 'text-red-600' : 'text-emerald-600'}`} />
          <p className={`text-sm ${isSignificant ? 'text-red-800' : 'text-emerald-800'}`}>
            {data.interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

// Clustering Results Component
function ClusteringResults({ data }) {
  if (data.error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-700">{data.error}</span>
      </div>
    );
  }

  const CLUSTER_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge>{data.method === 'kmeans' ? 'K-Means Clustering' : 'Hierarchical Clustering'}</Badge>
        <Badge variant="outline">{data.n_clusters} Clusters</Badge>
        <Badge variant="outline">N = {data.n_observations}</Badge>
      </div>

      <Separator />

      {/* Model Quality Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-sky-50 rounded">
          <p className="text-sm text-slate-500">Silhouette Score</p>
          <p className="text-lg font-semibold">{data.silhouette_score}</p>
          <p className="text-xs text-slate-500">
            {data.silhouette_score > 0.5 ? 'Good separation' : data.silhouette_score > 0.25 ? 'Moderate' : 'Weak'}
          </p>
        </div>
        {data.calinski_harabasz && (
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-500">Calinski-Harabasz</p>
            <p className="text-lg font-semibold">{data.calinski_harabasz}</p>
          </div>
        )}
        {data.inertia && (
          <div className="p-3 bg-slate-50 rounded">
            <p className="text-sm text-slate-500">Inertia</p>
            <p className="text-lg font-semibold">{data.inertia}</p>
          </div>
        )}
      </div>

      {/* Elbow Data */}
      {data.elbow_data && data.elbow_data.length > 0 && (
        <>
          <Separator />
          <h4 className="font-medium">Elbow Method Analysis</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2 text-center">K</th>
                  <th className="p-2 text-right">Inertia</th>
                  <th className="p-2 text-right">Silhouette</th>
                </tr>
              </thead>
              <tbody>
                {data.elbow_data.map((row) => (
                  <tr 
                    key={row.k} 
                    className={`border-b ${row.k === data.n_clusters ? 'bg-sky-50' : ''}`}
                  >
                    <td className="p-2 text-center font-medium">
                      {row.k}
                      {row.k === data.n_clusters && <span className="ml-1 text-sky-600">←</span>}
                    </td>
                    <td className="p-2 text-right">{row.inertia}</td>
                    <td className="p-2 text-right">{row.silhouette}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Separator />

      {/* Cluster Profiles */}
      <h4 className="font-medium">Cluster Profiles</h4>
      <div className="space-y-3">
        {data.cluster_profiles && data.cluster_profiles.map((cluster, idx) => (
          <div key={idx} className="p-3 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: CLUSTER_COLORS[idx % CLUSTER_COLORS.length] }}
                />
                <span className="font-medium">Cluster {cluster.cluster}</span>
              </div>
              <Badge variant="outline">
                {cluster.n} observations ({cluster.percent}%)
              </Badge>
            </div>
            
            {/* Variable Means */}
            <div className="mt-2">
              <p className="text-xs text-slate-500 mb-1">Variable Means:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(cluster.means || cluster.center || {}).map(([varName, value]) => (
                  <div key={varName} className="text-xs bg-slate-100 px-2 py-1 rounded">
                    <span className="text-slate-500">{varName}:</span> {value?.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Variables Used */}
      {data.variables && (
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500 mb-1">Variables used for clustering:</p>
          <div className="flex flex-wrap gap-1">
            {data.variables.map(v => (
              <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 mt-0.5" />
        <p className="text-sm text-blue-800">
          Silhouette Score ranges from -1 to 1. Higher values indicate better-defined clusters. 
          Values above 0.5 suggest strong clustering structure.
        </p>
      </div>
    </div>
  );
}

// Proportions Results Component
function ProportionsResults({ data }) {
  const isSignificant = data.significant;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {isSignificant ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Significant
          </Badge>
        ) : (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Not Significant
          </Badge>
        )}
        <Badge variant="outline">
          {data.test_type === 'one_sample' ? 'One-Sample Z-Test' : 
           data.test_type === 'two_sample' ? 'Two-Sample Z-Test' : 
           'Chi-Square Goodness of Fit'}
        </Badge>
        <Badge variant="outline">N = {data.n}</Badge>
      </div>

      <Separator />

      {/* One-Sample Results */}
      {data.test_type === 'one_sample' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-sky-50 rounded">
              <p className="text-sm text-slate-500">Observed Proportion</p>
              <p className="text-lg font-semibold">{(data.observed_proportion * 100).toFixed(1)}%</p>
              <p className="text-xs text-slate-500">{data.successes} successes</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">Hypothesized</p>
              <p className="text-lg font-semibold">{(data.hypothesized_proportion * 100).toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">Z-Statistic</p>
              <p className="text-lg font-semibold">{data.z_statistic}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">P-Value</p>
              <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
                {data.p_value < 0.001 ? '< 0.001' : data.p_value}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 rounded">
              <p className="text-sm text-slate-500">95% CI</p>
              <p className="text-lg font-semibold">
                [{(data.ci_95[0] * 100).toFixed(1)}%, {(data.ci_95[1] * 100).toFixed(1)}%]
              </p>
            </div>
          </div>
        </>
      )}

      {/* Two-Sample Results */}
      {data.test_type === 'two_sample' && data.groups && (
        <>
          <h4 className="font-medium">Group Proportions</h4>
          <div className="grid grid-cols-2 gap-4">
            {data.groups.map((grp, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded">
                <p className="font-medium">{grp.name}</p>
                <p className="text-2xl font-bold text-sky-600">{(grp.proportion * 100).toFixed(1)}%</p>
                <p className="text-xs text-slate-500">{grp.successes} / {grp.n}</p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-sky-50 rounded">
              <p className="text-sm text-slate-500">Difference</p>
              <p className="text-lg font-semibold">{(data.difference * 100).toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">Z-Statistic</p>
              <p className="text-lg font-semibold">{data.z_statistic}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">P-Value</p>
              <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
                {data.p_value < 0.001 ? '< 0.001' : data.p_value}
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded">
              <p className="text-sm text-slate-500">Cohen's h</p>
              <p className="text-lg font-semibold">{data.cohens_h}</p>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 rounded">
            <p className="text-sm text-slate-500">95% CI for Difference</p>
            <p className="text-lg font-semibold">
              [{(data.ci_95_difference[0] * 100).toFixed(1)}%, {(data.ci_95_difference[1] * 100).toFixed(1)}%]
            </p>
          </div>
        </>
      )}

      {/* Chi-Square Goodness of Fit Results */}
      {data.test_type === 'chi_square_gof' && data.categories && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">Chi-Square</p>
              <p className="text-lg font-semibold">{data.chi_square}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">df</p>
              <p className="text-lg font-semibold">{data.df}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <p className="text-sm text-slate-500">P-Value</p>
              <p className={`text-lg font-semibold ${isSignificant ? 'text-red-600' : ''}`}>
                {data.p_value < 0.001 ? '< 0.001' : data.p_value}
              </p>
            </div>
          </div>
          <Separator />
          <h4 className="font-medium">Category Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-right">Observed</th>
                  <th className="p-2 text-right">Expected</th>
                  <th className="p-2 text-right">Obs %</th>
                  <th className="p-2 text-right">Exp %</th>
                  <th className="p-2 text-right">Std Residual</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((cat, idx) => (
                  <tr key={idx} className={`border-b ${Math.abs(cat.residual) > 2 ? 'bg-red-50' : ''}`}>
                    <td className="p-2 font-medium">{cat.value}</td>
                    <td className="p-2 text-right">{cat.observed}</td>
                    <td className="p-2 text-right">{cat.expected}</td>
                    <td className="p-2 text-right">{cat.observed_pct}%</td>
                    <td className="p-2 text-right">{cat.expected_pct}%</td>
                    <td className={`p-2 text-right ${Math.abs(cat.residual) > 2 ? 'text-red-600 font-medium' : ''}`}>
                      {cat.residual}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Standardized residuals greater than |2| indicate categories contributing most to chi-square</p>
        </>
      )}

      {/* Interpretation */}
      {data.interpretation && (
        <div className={`p-3 rounded-lg flex items-start gap-2 ${isSignificant ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <Info className={`h-4 w-4 mt-0.5 ${isSignificant ? 'text-red-600' : 'text-emerald-600'}`} />
          <p className={`text-sm ${isSignificant ? 'text-red-800' : 'text-emerald-800'}`}>
            {data.interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

export default AdvancedStatsPanel;
