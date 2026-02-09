/**
 * Enhanced AI Copilot - Natural language data analysis
 * Features: Auto-execute, suggested queries, conversation history
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  Sparkles,
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Loader2,
  History,
  Lightbulb,
  Play,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  TrendingUp,
  Users,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Suggested queries based on data type
const SUGGESTED_QUERIES = [
  {
    category: 'Descriptive',
    icon: BarChart3,
    queries: [
      'Show summary statistics for all numeric variables',
      'Calculate frequencies for all categorical variables',
      'What is the distribution of responses?'
    ]
  },
  {
    category: 'Comparison',
    icon: Users,
    queries: [
      'Compare satisfaction scores between groups',
      'Is there a significant difference in responses by gender?',
      'Test if means differ across categories'
    ]
  },
  {
    category: 'Relationship',
    icon: TrendingUp,
    queries: [
      'What correlations exist between numeric variables?',
      'Is there a relationship between age and satisfaction?',
      'Run a regression to predict satisfaction'
    ]
  },
  {
    category: 'Trends',
    icon: Calculator,
    queries: [
      'Show the trend over time',
      'Are responses increasing or decreasing?',
      'What patterns exist in the data?'
    ]
  }
];

// Generate evidence-linked narrative from results
const generateNarrative = (results, plan, conversationId) => {
  if (!results) return "Analysis complete.";
  
  const parts = [];
  const evidenceLinks = [];
  let chartCounter = 1;
  let tableCounter = 1;
  
  // Add context from plan
  const analysisType = plan?.analysis_type?.replace(/_/g, ' ') || 'statistical';
  
  // Sample size context
  const n = results.total_n || results.n || results.n_observations;
  if (n) {
    parts.push(`**Sample Overview**: This ${analysisType} analysis examined ${n} observations`);
    evidenceLinks.push({ type: 'data', ref: `N=${n}`, source: 'dataset' });
  }
  
  // ANOVA results
  if (results.anova) {
    const a = results.anova;
    const significance = a.significant ? 'statistically significant' : 'not statistically significant';
    parts.push(`\n\n**ANOVA Results** (see Table ${tableCounter}): The analysis found a ${significance} difference between groups (F(${a.df_between || '?'}, ${a.df_within || '?'}) = ${a.f_statistic}, p ${a.p_value < 0.001 ? '< .001' : `= ${a.p_value}`})`);
    
    if (a.effect_size_eta_sq) {
      const effectLabel = a.effect_size_eta_sq > 0.14 ? 'large' : a.effect_size_eta_sq > 0.06 ? 'medium' : 'small';
      parts.push(`. Effect size (η²) = ${a.effect_size_eta_sq}, indicating a ${effectLabel} effect`);
    }
    
    evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter}`, data: 'ANOVA summary', fValue: a.f_statistic, pValue: a.p_value });
    tableCounter++;
    
    if (a.post_hoc) {
      parts.push(`\n\n**Post-hoc Comparisons** (Table ${tableCounter}): Pairwise comparisons revealed specific group differences`);
      evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter}`, data: 'Post-hoc tests' });
      tableCounter++;
    }
  }
  
  // T-test results
  if (results.ttest) {
    const t = results.ttest;
    const significance = t.significant ? 'statistically significant' : 'not statistically significant';
    parts.push(`\n\n**T-Test Results** (Table ${tableCounter}): There was a ${significance} difference between groups (t(${t.df || '?'}) = ${t.t_statistic}, p ${t.p_value < 0.001 ? '< .001' : `= ${t.p_value}`})`);
    
    if (t.mean_difference) {
      parts.push(`. Mean difference = ${t.mean_difference}`);
    }
    if (t.cohens_d) {
      const effectLabel = Math.abs(t.cohens_d) > 0.8 ? 'large' : Math.abs(t.cohens_d) > 0.5 ? 'medium' : 'small';
      parts.push(`, Cohen's d = ${t.cohens_d} (${effectLabel} effect)`);
    }
    
    evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter}`, data: 'T-test results', tValue: t.t_statistic, pValue: t.p_value });
    tableCounter++;
  }
  
  // Correlation results
  if (results.correlation_matrix) {
    const vars = Object.keys(results.correlation_matrix);
    parts.push(`\n\n**Correlation Analysis** (Table ${tableCounter}): Correlations were computed among ${vars.length} variables`);
    
    // Find strongest correlations
    const correlations = [];
    vars.forEach((v1, i) => {
      vars.slice(i + 1).forEach(v2 => {
        const r = results.correlation_matrix[v1]?.[v2];
        if (r !== undefined && Math.abs(r) > 0.3) {
          correlations.push({ v1, v2, r });
        }
      });
    });
    
    if (correlations.length > 0) {
      const strongest = correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 3);
      const strongDesc = strongest.map(c => `${c.v1}-${c.v2} (r = ${c.r})`).join(', ');
      parts.push(`. Notable correlations: ${strongDesc}`);
    }
    
    evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter}`, data: 'Correlation matrix' });
    tableCounter++;
  }
  
  // Regression results
  if (results.regression || results.model_fit) {
    const r = results.regression || results;
    parts.push(`\n\n**Regression Model** (Table ${tableCounter}): The model explained ${((r.r_squared || r.model_fit?.r_squared || 0) * 100).toFixed(1)}% of variance in the outcome`);
    
    if (r.model_fit?.f_statistic) {
      parts.push(` (F = ${r.model_fit.f_statistic}, p ${r.model_fit.f_pvalue < 0.001 ? '< .001' : `= ${r.model_fit.f_pvalue}`})`);
    }
    
    // Significant predictors
    if (results.coefficients || r.coefficients) {
      const coefs = results.coefficients || r.coefficients;
      const sigPredictors = Object.entries(coefs)
        .filter(([name, c]) => c.significant && name !== 'const' && name !== 'Intercept')
        .map(([name, c]) => `${name} (β = ${c.coefficient}, p = ${c.p_value})`);
      
      if (sigPredictors.length > 0) {
        parts.push(`\n\n**Significant Predictors** (Table ${tableCounter + 1}): ${sigPredictors.join('; ')}`);
        evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter + 1}`, data: 'Coefficient table' });
        tableCounter++;
      }
    }
    
    evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter}`, data: 'Model summary' });
    tableCounter++;
  }
  
  // Descriptive statistics
  if (results.descriptives || results.statistics) {
    const stats = results.descriptives || results.statistics;
    parts.push(`\n\n**Descriptive Statistics** (Table ${tableCounter}): Summary statistics computed for analyzed variables`);
    
    if (stats.mean !== undefined) {
      parts.push(`. Mean = ${stats.mean}, SD = ${stats.std || stats.sd}`);
    }
    
    evidenceLinks.push({ type: 'table', ref: `Table ${tableCounter}`, data: 'Descriptive statistics' });
    tableCounter++;
  }
  
  // Add interpretation if available
  if (results.interpretation) {
    parts.push(`\n\n**Interpretation**: ${results.interpretation}`);
  }
  
  // Add evidence summary
  const evidenceSummary = evidenceLinks.map(e => e.ref).join(', ');
  
  return {
    narrative: parts.join(''),
    evidenceLinks,
    evidenceSummary,
    chartCount: chartCounter - 1,
    tableCount: tableCounter - 1
  };
};

export function EnhancedAICopilot({ formId, snapshotId, orgId, fields, getToken }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [expandedResults, setExpandedResults] = useState({});
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversations]);

  const askCopilot = async (customQuery = null) => {
    const questionText = customQuery || query;
    if (!questionText.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setLoading(true);
    const newConversation = {
      id: Date.now(),
      query: questionText,
      timestamp: new Date().toISOString(),
      status: 'loading',
      analysisPlan: null,
      results: null,
      error: null
    };

    setConversations(prev => [...prev, newConversation]);
    setQuery('');

    try {
      const response = await fetch(`${API_URL}/api/ai-copilot/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          form_id: snapshotId ? null : formId,
          snapshot_id: snapshotId || null,
          org_id: orgId,
          query: questionText,
          context: {
            auto_execute: autoExecute,
            fields: fields.map(f => ({ id: f.id, type: f.type, label: f.label }))
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setConversations(prev => prev.map(c => 
          c.id === newConversation.id 
            ? {
                ...c,
                status: 'complete',
                analysisPlan: data.analysis_plan,
                results: data.results,
                analysisId: data.analysis_id,
                traceability: data.traceability
              }
            : c
        ));

        toast.success('Analysis complete');
      } else {
        const error = await response.json();
        setConversations(prev => prev.map(c => 
          c.id === newConversation.id 
            ? { ...c, status: 'error', error: error.detail || 'Analysis failed' }
            : c
        ));
        toast.error(error.detail || 'Analysis failed');
      }
    } catch (error) {
      setConversations(prev => prev.map(c => 
        c.id === newConversation.id 
          ? { ...c, status: 'error', error: 'Network error' }
          : c
      ));
      toast.error('Failed to connect to AI service');
    } finally {
      setLoading(false);
    }
  };

  const executeAnalysis = async (conversationId, apiEndpoint, apiParams) => {
    setConversations(prev => prev.map(c => 
      c.id === conversationId ? { ...c, status: 'executing' } : c
    ));

    try {
      const response = await fetch(`${API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          form_id: snapshotId ? null : formId,
          snapshot_id: snapshotId || null,
          org_id: orgId,
          ...apiParams
        })
      });

      if (response.ok) {
        const results = await response.json();
        setConversations(prev => prev.map(c => 
          c.id === conversationId ? { ...c, status: 'complete', results } : c
        ));
        toast.success('Analysis executed successfully');
      } else {
        throw new Error('Execution failed');
      }
    } catch (error) {
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, status: 'error', error: 'Execution failed' } : c
      ));
      toast.error('Failed to execute analysis');
    }
  };

  const copyResults = (results) => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    toast.success('Results copied to clipboard');
  };

  const toggleResultExpand = (id) => {
    setExpandedResults(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const clearHistory = () => {
    setConversations([]);
    toast.success('Conversation history cleared');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Chat Panel */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky-500" />
                AI Analysis Copilot
              </CardTitle>
              <CardDescription>
                Ask questions about your data in natural language
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-execute"
                  checked={autoExecute}
                  onCheckedChange={setAutoExecute}
                />
                <Label htmlFor="auto-execute" className="text-sm flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Auto-execute
                </Label>
              </div>
              {conversations.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearHistory}>
                  <History className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Conversation History */}
          <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
            {conversations.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Ask me anything about your data</p>
                <p className="text-sm mt-1">I can help with statistics, comparisons, and insights</p>
              </div>
            ) : (
              <div className="space-y-6">
                {conversations.map((conv) => (
                  <div key={conv.id} className="space-y-3">
                    {/* User Query */}
                    <div className="flex justify-end">
                      <div className="bg-sky-500 text-white rounded-lg rounded-br-none px-4 py-2 max-w-[80%]">
                        <p>{conv.query}</p>
                        <p className="text-xs text-sky-100 mt-1">
                          {new Date(conv.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-lg rounded-bl-none px-4 py-3 max-w-[90%] space-y-3">
                        {conv.status === 'loading' || conv.status === 'executing' ? (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{conv.status === 'executing' ? 'Executing analysis...' : 'Thinking...'}</span>
                          </div>
                        ) : conv.status === 'error' ? (
                          <div className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="h-4 w-4" />
                            <span>{conv.error}</span>
                          </div>
                        ) : (
                          <>
                            {/* Analysis Plan */}
                            {conv.analysisPlan && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                  <span className="font-medium">Analysis Plan</span>
                                </div>
                                <p className="text-sm text-slate-600">
                                  {conv.analysisPlan.understood_query}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Badge>{conv.analysisPlan.analysis_type}</Badge>
                                  <Badge variant="outline">{conv.analysisPlan.statistical_method}</Badge>
                                </div>
                                
                                {/* Execute Button (if not auto-executed) */}
                                {!autoExecute && !conv.results && conv.analysisPlan.api_endpoint && (
                                  <Button
                                    size="sm"
                                    onClick={() => executeAnalysis(
                                      conv.id,
                                      conv.analysisPlan.api_endpoint,
                                      conv.analysisPlan.api_params
                                    )}
                                    className="mt-2"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Execute Analysis
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Results */}
                            {conv.results && (
                              <div className="space-y-2 mt-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-sky-500" />
                                    <span className="font-medium">Results</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyResults(conv.results)}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleResultExpand(conv.id)}
                                    >
                                      {expandedResults[conv.id] ? (
                                        <ChevronUp className="h-3 w-3" />
                                      ) : (
                                        <ChevronDown className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Quick Summary */}
                                <div className="bg-white rounded p-3 text-sm">
                                  {conv.results.total_n && (
                                    <p><strong>N:</strong> {conv.results.total_n}</p>
                                  )}
                                  {conv.results.variables && (
                                    <p><strong>Variables analyzed:</strong> {conv.results.variables.length}</p>
                                  )}
                                  {conv.results.anova && (
                                    <p>
                                      <strong>F:</strong> {conv.results.anova.f_statistic}, 
                                      <strong> p:</strong> {conv.results.anova.p_value}
                                      {conv.results.anova.significant && (
                                        <Badge variant="destructive" className="ml-2 text-xs">Significant</Badge>
                                      )}
                                    </p>
                                  )}
                                  {conv.results.correlation_matrix && (
                                    <p><strong>Correlations computed</strong> for {Object.keys(conv.results.correlation_matrix).length} variables</p>
                                  )}
                                </div>

                                {/* Evidence-Linked Narrative */}
                                {conv.results && (
                                  <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg border border-purple-100 dark:border-purple-800">
                                    <div className="flex items-center gap-2 mb-2">
                                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                      <span className="font-medium text-purple-800 dark:text-purple-300 text-sm">AI Narrative Summary</span>
                                    </div>
                                    {(() => {
                                      const narrativeData = generateNarrative(conv.results, conv.analysisPlan, conv.id);
                                      const narrative = typeof narrativeData === 'string' ? narrativeData : narrativeData.narrative;
                                      const evidenceLinks = typeof narrativeData === 'object' ? narrativeData.evidenceLinks : [];
                                      
                                      return (
                                        <>
                                          <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                            {narrative.split('\n\n').map((para, i) => (
                                              <p key={i} className="mb-2" dangerouslySetInnerHTML={{ 
                                                __html: para
                                                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                  .replace(/\(Table (\d+)\)/g, '<span class="text-purple-600 dark:text-purple-400 font-medium">(Table $1)</span>')
                                                  .replace(/\(Chart (\d+)\)/g, '<span class="text-blue-600 dark:text-blue-400 font-medium">(Chart $1)</span>')
                                              }} />
                                            ))}
                                          </div>
                                          <div className="mt-3 flex flex-wrap gap-1">
                                            {evidenceLinks.length > 0 && (
                                              <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800">
                                                <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                                                {evidenceLinks.length} evidence references
                                              </Badge>
                                            )}
                                            {conv.results.interpretation && (
                                              <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800">
                                                <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                                                Interpretation verified
                                              </Badge>
                                            )}
                                            <Badge variant="outline" className="text-xs bg-white dark:bg-slate-800">
                                              Source: {conv.analysisPlan?.api_endpoint?.split('/').pop() || 'analysis'}
                                            </Badge>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Full Results (expandable) */}
                                {expandedResults[conv.id] && (
                                  <pre className="bg-slate-800 text-slate-100 p-3 rounded text-xs overflow-x-auto max-h-[300px]">
                                    {JSON.stringify(conv.results, null, 2)}
                                  </pre>
                                )}
                              </div>
                            )}

                            {/* Traceability */}
                            {conv.traceability && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-xs text-slate-400">
                                  Analysis ID: {conv.analysisId?.slice(0, 20)}... | 
                                  Source: {conv.traceability.form_id?.slice(0, 8)}...
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* Input Area */}
          <div className="space-y-3">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data..."
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  askCopilot();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Press Enter to send, Shift+Enter for new line
              </p>
              <Button onClick={() => askCopilot()} disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Analyze
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Suggested Queries
          </CardTitle>
          <CardDescription>
            Click to try these analysis ideas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {SUGGESTED_QUERIES.map((category) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <category.icon className="h-4 w-4" />
                    {category.category}
                  </div>
                  <div className="space-y-1">
                    {category.queries.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setQuery(q);
                          if (autoExecute) {
                            askCopilot(q);
                          }
                        }}
                        className="w-full text-left text-sm p-2 rounded hover:bg-slate-100 transition-colors text-slate-600"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Data Context */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Data Context
            </h4>
            <div className="space-y-1 text-xs text-slate-500">
              <p><strong>Form:</strong> {formId ? `${formId.slice(0, 8)}...` : 'None selected'}</p>
              <p><strong>Variables:</strong> {fields.length}</p>
              <p><strong>Numeric:</strong> {fields.filter(f => ['number', 'integer', 'decimal'].includes(f.type)).length}</p>
              <p><strong>Categorical:</strong> {fields.filter(f => ['select', 'radio', 'text'].includes(f.type)).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EnhancedAICopilot;
