import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Wand2,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Sparkles,
  Target,
  GitCompare,
  TrendingUp,
  BarChart3,
  PieChart,
  Lightbulb,
  Play,
  Info,
  Zap,
  Award,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Research goal options
const RESEARCH_GOALS = [
  {
    id: 'compare_groups',
    label: 'Compare Groups',
    description: 'Test if there are differences between groups',
    icon: GitCompare,
    examples: ['Is income different across regions?', 'Do treatment groups differ?']
  },
  {
    id: 'explore_relationships',
    label: 'Explore Relationships',
    description: 'Examine associations between variables',
    icon: TrendingUp,
    examples: ['Is age related to income?', 'Do education and salary correlate?']
  },
  {
    id: 'predict_outcomes',
    label: 'Predict Outcomes',
    description: 'Build models to predict a variable',
    icon: Target,
    examples: ['What factors predict satisfaction?', 'Can we forecast sales?']
  },
  {
    id: 'describe_data',
    label: 'Describe Data',
    description: 'Summarize and characterize your data',
    icon: BarChart3,
    examples: ['What is the average income?', 'How is data distributed?']
  },
  {
    id: 'test_proportions',
    label: 'Test Proportions',
    description: 'Compare percentages or frequencies',
    icon: PieChart,
    examples: ['Is gender distribution equal?', 'Did response rates differ?']
  }
];

// Statistical test recommendations
const TEST_RECOMMENDATIONS = {
  compare_groups: {
    continuous_2groups: {
      normal: { test: 'ttest', name: 'Independent T-Test', confidence: 95, description: 'Compare means between two groups when data is normally distributed' },
      non_normal: { test: 'mann_whitney', name: 'Mann-Whitney U Test', confidence: 90, description: 'Non-parametric alternative when normality assumption is violated' }
    },
    continuous_3plus: {
      normal: { test: 'anova', name: 'One-Way ANOVA', confidence: 95, description: 'Compare means across three or more groups' },
      non_normal: { test: 'kruskal_wallis', name: 'Kruskal-Wallis Test', confidence: 90, description: 'Non-parametric alternative for comparing multiple groups' }
    },
    continuous_paired: {
      normal: { test: 'paired_ttest', name: 'Paired T-Test', confidence: 95, description: 'Compare means from the same subjects at different times' },
      non_normal: { test: 'wilcoxon', name: 'Wilcoxon Signed-Rank', confidence: 90, description: 'Non-parametric paired comparison' }
    }
  },
  explore_relationships: {
    continuous_continuous: {
      normal: { test: 'pearson', name: 'Pearson Correlation', confidence: 95, description: 'Measure linear relationship between two continuous variables' },
      non_normal: { test: 'spearman', name: 'Spearman Correlation', confidence: 90, description: 'Non-parametric correlation for ordinal or non-normal data' }
    },
    categorical_categorical: {
      any: { test: 'chi_square', name: 'Chi-Square Test', confidence: 95, description: 'Test association between categorical variables' }
    }
  },
  predict_outcomes: {
    continuous_outcome: {
      linear: { test: 'regression', name: 'Linear Regression', confidence: 95, description: 'Predict continuous outcome from one or more predictors' },
      count: { test: 'poisson', name: 'Poisson Regression', confidence: 85, description: 'For count data outcomes' }
    },
    binary_outcome: {
      any: { test: 'logistic', name: 'Logistic Regression', confidence: 95, description: 'Predict binary outcome (yes/no, success/failure)' }
    }
  },
  describe_data: {
    any: { test: 'descriptives', name: 'Descriptive Statistics', confidence: 100, description: 'Calculate mean, median, SD, and distribution metrics' }
  },
  test_proportions: {
    two_groups: { test: 'proportions_z', name: 'Two-Proportion Z-Test', confidence: 95, description: 'Compare proportions between two groups' },
    multiple_groups: { test: 'chi_square', name: 'Chi-Square Goodness of Fit', confidence: 95, description: 'Test if proportions differ from expected values' }
  }
};

function QuickAnalysis({ formId, snapshotId, orgId, fields = [], onRunAnalysis, getToken }) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [outcomeVar, setOutcomeVar] = useState('');
  const [groupVar, setGroupVar] = useState('');
  const [predictorVars, setPredictorVars] = useState([]);
  const [assumeNormal, setAssumeNormal] = useState(true);
  const [isPaired, setIsPaired] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Categorize fields
  const numericFields = useMemo(() => 
    fields.filter(f => ['number', 'integer', 'decimal'].includes(f.type)),
    [fields]
  );
  
  const categoricalFields = useMemo(() => 
    fields.filter(f => ['select', 'radio', 'text', 'checkbox'].includes(f.type)),
    [fields]
  );

  // Get group count for selected group variable
  const getGroupCount = (fieldId) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.options) return field.options.length;
    return 2; // default assumption
  };

  // Generate recommendations based on selections
  const generateRecommendations = () => {
    const recs = [];
    const outcomeField = fields.find(f => f.id === outcomeVar);
    const isOutcomeNumeric = outcomeField && ['number', 'integer', 'decimal'].includes(outcomeField.type);
    const groupCount = groupVar ? getGroupCount(groupVar) : 0;

    if (goal === 'compare_groups') {
      if (isOutcomeNumeric) {
        if (isPaired) {
          const rec = assumeNormal 
            ? TEST_RECOMMENDATIONS.compare_groups.continuous_paired.normal
            : TEST_RECOMMENDATIONS.compare_groups.continuous_paired.non_normal;
          recs.push({ ...rec, primary: true });
          recs.push(assumeNormal 
            ? { ...TEST_RECOMMENDATIONS.compare_groups.continuous_paired.non_normal, primary: false }
            : { ...TEST_RECOMMENDATIONS.compare_groups.continuous_paired.normal, primary: false });
        } else if (groupCount === 2) {
          const rec = assumeNormal 
            ? TEST_RECOMMENDATIONS.compare_groups.continuous_2groups.normal
            : TEST_RECOMMENDATIONS.compare_groups.continuous_2groups.non_normal;
          recs.push({ ...rec, primary: true });
          recs.push(assumeNormal 
            ? { ...TEST_RECOMMENDATIONS.compare_groups.continuous_2groups.non_normal, primary: false }
            : { ...TEST_RECOMMENDATIONS.compare_groups.continuous_2groups.normal, primary: false });
        } else {
          const rec = assumeNormal 
            ? TEST_RECOMMENDATIONS.compare_groups.continuous_3plus.normal
            : TEST_RECOMMENDATIONS.compare_groups.continuous_3plus.non_normal;
          recs.push({ ...rec, primary: true });
          recs.push(assumeNormal 
            ? { ...TEST_RECOMMENDATIONS.compare_groups.continuous_3plus.non_normal, primary: false }
            : { ...TEST_RECOMMENDATIONS.compare_groups.continuous_3plus.normal, primary: false });
        }
      } else {
        recs.push({ ...TEST_RECOMMENDATIONS.explore_relationships.categorical_categorical.any, primary: true });
      }
    } else if (goal === 'explore_relationships') {
      if (isOutcomeNumeric && predictorVars.length > 0) {
        const predictorField = fields.find(f => f.id === predictorVars[0]);
        const isPredictorNumeric = predictorField && ['number', 'integer', 'decimal'].includes(predictorField.type);
        
        if (isPredictorNumeric) {
          const rec = assumeNormal 
            ? TEST_RECOMMENDATIONS.explore_relationships.continuous_continuous.normal
            : TEST_RECOMMENDATIONS.explore_relationships.continuous_continuous.non_normal;
          recs.push({ ...rec, primary: true });
          recs.push(assumeNormal 
            ? { ...TEST_RECOMMENDATIONS.explore_relationships.continuous_continuous.non_normal, primary: false }
            : { ...TEST_RECOMMENDATIONS.explore_relationships.continuous_continuous.normal, primary: false });
        } else {
          recs.push({ ...TEST_RECOMMENDATIONS.explore_relationships.categorical_categorical.any, primary: true });
        }
      }
    } else if (goal === 'predict_outcomes') {
      if (isOutcomeNumeric) {
        recs.push({ ...TEST_RECOMMENDATIONS.predict_outcomes.continuous_outcome.linear, primary: true });
        recs.push({ ...TEST_RECOMMENDATIONS.predict_outcomes.continuous_outcome.count, primary: false });
      } else {
        recs.push({ ...TEST_RECOMMENDATIONS.predict_outcomes.binary_outcome.any, primary: true });
      }
    } else if (goal === 'describe_data') {
      recs.push({ ...TEST_RECOMMENDATIONS.describe_data.any, primary: true });
    } else if (goal === 'test_proportions') {
      if (groupCount === 2) {
        recs.push({ ...TEST_RECOMMENDATIONS.test_proportions.two_groups, primary: true });
      } else {
        recs.push({ ...TEST_RECOMMENDATIONS.test_proportions.multiple_groups, primary: true });
      }
    }

    setRecommendations(recs);
  };

  // Run selected analysis
  const runAnalysis = async (testType) => {
    setLoading(true);
    
    try {
      let endpoint = '';
      let payload = {
        form_id: formId,
        snapshot_id: snapshotId,
        org_id: orgId
      };

      switch (testType) {
        case 'ttest':
          endpoint = '/api/statistics/ttest';
          payload = { ...payload, variable: outcomeVar, group_var: groupVar, test_type: 'independent' };
          break;
        case 'paired_ttest':
          endpoint = '/api/statistics/ttest';
          payload = { ...payload, variable: outcomeVar, paired_var: predictorVars[0], test_type: 'paired' };
          break;
        case 'mann_whitney':
        case 'wilcoxon':
          endpoint = '/api/statistics/nonparametric';
          payload = { ...payload, variable: outcomeVar, group_var: groupVar, test_type: testType === 'mann_whitney' ? 'mann_whitney' : 'wilcoxon' };
          break;
        case 'anova':
          endpoint = '/api/statistics/anova';
          payload = { ...payload, dependent_var: outcomeVar, group_var: groupVar };
          break;
        case 'kruskal_wallis':
          endpoint = '/api/statistics/nonparametric';
          payload = { ...payload, variable: outcomeVar, group_var: groupVar, test_type: 'kruskal_wallis' };
          break;
        case 'pearson':
        case 'spearman':
          endpoint = '/api/statistics/correlation';
          payload = { ...payload, variables: [outcomeVar, ...predictorVars], method: testType };
          break;
        case 'chi_square':
          endpoint = '/api/statistics/chi-square';
          payload = { ...payload, variable1: outcomeVar, variable2: groupVar || predictorVars[0] };
          break;
        case 'regression':
        case 'logistic':
        case 'poisson':
          endpoint = '/api/statistics/regression';
          payload = { ...payload, dependent_var: outcomeVar, independent_vars: predictorVars.length > 0 ? predictorVars : [groupVar], model_type: testType === 'regression' ? 'ols' : testType };
          break;
        case 'descriptives':
          endpoint = '/api/statistics/descriptives';
          payload = { ...payload, variables: outcomeVar ? [outcomeVar] : numericFields.map(f => f.id).slice(0, 5) };
          break;
        case 'proportions_z':
          endpoint = '/api/statistics/proportions';
          payload = { ...payload, variable: outcomeVar, group_var: groupVar };
          break;
        default:
          toast.error('Unknown test type');
          setLoading(false);
          return;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const results = await response.json();
        toast.success('Analysis complete!');
        if (onRunAnalysis) {
          onRunAnalysis(testType, results);
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Analysis failed');
      }
    } catch (e) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Step navigation
  const nextStep = () => {
    if (step === 2) {
      generateRecommendations();
    }
    setStep(s => Math.min(s + 1, 3));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const canProceed = () => {
    if (step === 1) return !!goal;
    if (step === 2) {
      if (goal === 'describe_data') return true;
      if (goal === 'compare_groups') return !!outcomeVar && !!groupVar;
      if (goal === 'explore_relationships') return !!outcomeVar && predictorVars.length > 0;
      if (goal === 'predict_outcomes') return !!outcomeVar && (predictorVars.length > 0 || !!groupVar);
      if (goal === 'test_proportions') return !!outcomeVar;
      return false;
    }
    return true;
  };

  const resetWizard = () => {
    setStep(1);
    setGoal('');
    setOutcomeVar('');
    setGroupVar('');
    setPredictorVars([]);
    setAssumeNormal(true);
    setIsPaired(false);
    setRecommendations([]);
  };

  return (
    <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-barlow text-lg">Quick Analysis Wizard</CardTitle>
              <CardDescription>Get smart test recommendations based on your research question</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI-Powered
          </Badge>
        </div>
        
        {/* Progress indicator */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {step} of 3</span>
            <span>{step === 1 ? 'Select Goal' : step === 2 ? 'Configure Variables' : 'Review & Run'}</span>
          </div>
          <Progress value={(step / 3) * 100} className="h-1" />
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {/* Step 1: Research Goal */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-medium text-foreground mb-3">
                What would you like to do with your data?
              </div>
              <RadioGroup value={goal} onValueChange={setGoal} className="space-y-2">
                {RESEARCH_GOALS.map((g) => {
                  const Icon = g.icon;
                  return (
                    <label
                      key={g.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        goal === g.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={g.id} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium">{g.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{g.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {g.examples.map((ex, i) => (
                            <Badge key={i} variant="secondary" className="text-xs font-normal">
                              {ex}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </motion.div>
          )}

          {/* Step 2: Variable Configuration */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Lightbulb className="h-4 w-4" />
                  {RESEARCH_GOALS.find(g => g.id === goal)?.label}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {RESEARCH_GOALS.find(g => g.id === goal)?.description}
                </p>
              </div>

              {goal !== 'describe_data' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">
                      {goal === 'predict_outcomes' ? 'Outcome Variable (what to predict)' : 'Main Variable'}
                    </Label>
                    <Select value={outcomeVar} onValueChange={setOutcomeVar}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select variable..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1 text-xs text-muted-foreground">Numeric Variables</div>
                        {numericFields.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label || f.id}
                            <Badge variant="outline" className="ml-2 text-xs">{f.type}</Badge>
                          </SelectItem>
                        ))}
                        <Separator className="my-1" />
                        <div className="px-2 py-1 text-xs text-muted-foreground">Categorical Variables</div>
                        {categoricalFields.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label || f.id}
                            <Badge variant="outline" className="ml-2 text-xs">{f.type}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(goal === 'compare_groups' || goal === 'test_proportions') && (
                    <div>
                      <Label className="text-sm">Grouping Variable</Label>
                      <Select value={groupVar} onValueChange={setGroupVar}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select grouping variable..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categoricalFields.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.label || f.id}
                              {f.options && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {f.options.length} groups
                                </Badge>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(goal === 'explore_relationships' || goal === 'predict_outcomes') && (
                    <div>
                      <Label className="text-sm">
                        {goal === 'predict_outcomes' ? 'Predictor Variables' : 'Related Variable(s)'}
                      </Label>
                      <div className="border rounded-lg p-2 mt-1 max-h-[150px] overflow-y-auto space-y-1">
                        {fields.filter(f => f.id !== outcomeVar).map(f => (
                          <div key={f.id} className="flex items-center gap-2">
                            <Checkbox
                              checked={predictorVars.includes(f.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPredictorVars([...predictorVars, f.id]);
                                } else {
                                  setPredictorVars(predictorVars.filter(v => v !== f.id));
                                }
                              }}
                            />
                            <span className="text-sm">{f.label || f.id}</span>
                            <Badge variant="outline" className="text-xs ml-auto">{f.type}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {goal === 'compare_groups' && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <Checkbox
                        checked={isPaired}
                        onCheckedChange={setIsPaired}
                      />
                      <Label className="text-sm cursor-pointer">
                        Paired/Repeated measures (same subjects measured twice)
                      </Label>
                    </div>
                  )}
                </div>
              )}

              {goal === 'describe_data' && (
                <div className="p-4 bg-muted/30 rounded-lg text-center">
                  <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Descriptive statistics will be calculated for all numeric variables in your data
                  </p>
                </div>
              )}

              <Separator />

              <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <Label className="text-sm">Data distribution assumption</Label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={assumeNormal}
                      onChange={() => setAssumeNormal(true)}
                      className="accent-primary"
                    />
                    <span className="text-xs">Normal</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!assumeNormal}
                      onChange={() => setAssumeNormal(false)}
                      className="accent-primary"
                    />
                    <span className="text-xs">Non-normal</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Recommendations */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Award className="h-4 w-4 text-primary" />
                Recommended Statistical Tests
              </div>

              {recommendations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Unable to generate recommendations. Please check your variable selections.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        rec.primary 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {rec.primary && (
                              <Badge className="bg-primary text-primary-foreground">
                                <Zap className="h-3 w-3 mr-1" />
                                Best Match
                              </Badge>
                            )}
                            <span className="font-semibold">{rec.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={rec.confidence} className="h-1.5 w-20" />
                            <span className="text-xs text-muted-foreground">{rec.confidence}% confidence</span>
                          </div>
                        </div>
                        <Button 
                          onClick={() => runAnalysis(rec.test)}
                          disabled={loading}
                          size="sm"
                          variant={rec.primary ? 'default' : 'outline'}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs font-medium text-muted-foreground mb-2">Analysis Summary</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Goal:</span> {RESEARCH_GOALS.find(g => g.id === goal)?.label}</div>
                  {outcomeVar && <div><span className="text-muted-foreground">Outcome:</span> {fields.find(f => f.id === outcomeVar)?.label || outcomeVar}</div>}
                  {groupVar && <div><span className="text-muted-foreground">Groups:</span> {fields.find(f => f.id === groupVar)?.label || groupVar}</div>}
                  {predictorVars.length > 0 && <div><span className="text-muted-foreground">Predictors:</span> {predictorVars.length} selected</div>}
                  <div><span className="text-muted-foreground">Distribution:</span> {assumeNormal ? 'Normal' : 'Non-normal'}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={step === 1 ? resetWizard : prevStep}
            disabled={loading}
          >
            {step === 1 ? 'Reset' : (
              <>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>
          
          {step < 3 ? (
            <Button onClick={nextStep} disabled={!canProceed() || loading}>
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button variant="outline" onClick={resetWizard} disabled={loading}>
              Start Over
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickAnalysis;
