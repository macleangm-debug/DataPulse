/**
 * AIDataPrep.jsx
 * AI-Assisted Data Preparation component
 * Analyzes data and provides intelligent suggestions for cleaning and transformation
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Collapsible, CollapsibleContent, CollapsibleTrigger 
} from '../ui/collapsible';
import { 
  Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, 
  ChevronDown, ChevronRight, Wand2, Sparkles, RefreshCw,
  Trash2, ArrowRightLeft, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getToken = () => localStorage.getItem('token');

const PRIORITY_STYLES = {
  high: { bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle, iconColor: 'text-red-600' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-600' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, iconColor: 'text-blue-600' }
};

const TYPE_ICONS = {
  missing_data: Trash2,
  outliers: BarChart3,
  distribution: BarChart3,
  inconsistent_labels: ArrowRightLeft,
  rare_categories: Info,
  high_cardinality: Info,
  sample_size: AlertTriangle,
  duplicates: Trash2,
  multicollinearity: ArrowRightLeft,
  identifier_column: Info,
  zero_variance: AlertCircle
};

export default function AIDataPrep({ formId, snapshotId, orgId, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [summary, setSummary] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [appliedActions, setAppliedActions] = useState([]);

  const fetchSuggestions = async () => {
    if (!formId && !snapshotId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/data-prep-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          snapshot_id: snapshotId || null,
          form_id: snapshotId ? null : formId,
          org_id: orgId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setSummary(data.summary || '');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to analyze data');
      }
    } catch (error) {
      toast.error('Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [formId, snapshotId, orgId]);

  const applyAction = async (suggestion, action) => {
    if (!snapshotId) {
      toast.error('Create a snapshot first to apply transformations');
      return;
    }

    setApplying(`${suggestion.variable}-${action.action}`);
    try {
      const response = await fetch(`${API_URL}/api/analysis/apply-transformation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          action: action.action,
          variable: suggestion.variable,
          snapshot_id: snapshotId,
          org_id: orgId
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success(result.message);
          setAppliedActions([...appliedActions, `${suggestion.variable}-${action.action}`]);
          // Refresh suggestions
          fetchSuggestions();
          if (onRefresh) onRefresh();
        } else {
          toast.error(result.message);
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to apply transformation');
      }
    } catch (error) {
      toast.error('Failed to apply transformation');
    } finally {
      setApplying(null);
    }
  };

  const toggleExpanded = (index) => {
    setExpandedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const groupedSuggestions = suggestions ? {
    high: suggestions.filter(s => s.priority === 'high'),
    medium: suggestions.filter(s => s.priority === 'medium'),
    low: suggestions.filter(s => s.priority === 'low')
  } : { high: [], medium: [], low: [] };

  if (!formId && !snapshotId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wand2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Select a form to get AI-powered data preparation suggestions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <CardTitle>AI Data Preparation Assistant</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSuggestions} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
          <CardDescription>
            Intelligent analysis of your data with actionable suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <span className="ml-3 text-slate-500">Analyzing data...</span>
            </div>
          ) : suggestions && suggestions.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-800">Data looks good!</p>
                <p className="text-sm text-emerald-600">No immediate issues detected. Your data is ready for analysis.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">{summary}</p>
              <div className="flex gap-2 flex-wrap">
                {groupedSuggestions.high.length > 0 && (
                  <Badge variant="destructive">{groupedSuggestions.high.length} High Priority</Badge>
                )}
                {groupedSuggestions.medium.length > 0 && (
                  <Badge className="bg-amber-500">{groupedSuggestions.medium.length} Medium</Badge>
                )}
                {groupedSuggestions.low.length > 0 && (
                  <Badge variant="secondary">{groupedSuggestions.low.length} Low</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggestions List */}
      {suggestions && suggestions.length > 0 && (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {suggestions.map((suggestion, index) => {
              const styles = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.low;
              const TypeIcon = TYPE_ICONS[suggestion.type] || Info;
              const isExpanded = expandedItems[index];
              const isApplied = appliedActions.some(a => 
                a.startsWith(`${suggestion.variable}-`)
              );

              return (
                <Card 
                  key={index} 
                  className={`${styles.bg} ${styles.border} border ${isApplied ? 'opacity-50' : ''}`}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(index)}>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <TypeIcon className={`h-5 w-5 mt-0.5 ${styles.iconColor}`} />
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{suggestion.title}</span>
                              {isApplied && (
                                <Badge variant="outline" className="text-xs">Applied</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{suggestion.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={suggestion.priority === 'high' ? 'destructive' : 'outline'}
                              className="text-xs"
                            >
                              {suggestion.priority}
                            </Badge>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 px-4 pb-4">
                        <Separator className="mb-3" />
                        
                        {/* Stats/Details */}
                        {suggestion.stats && (
                          <div className="mb-3 p-2 bg-white/50 rounded text-sm">
                            <p className="font-medium text-xs text-slate-500 mb-1">Details:</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(suggestion.stats).map(([key, value]) => (
                                <span key={key} className="text-xs bg-slate-100 px-2 py-1 rounded">
                                  {key.replace(/_/g, ' ')}: {
                                    Array.isArray(value) ? value.join(', ') : 
                                    typeof value === 'number' ? value.toLocaleString() : 
                                    String(value)
                                  }
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pairs for multicollinearity */}
                        {suggestion.pairs && (
                          <div className="mb-3 p-2 bg-white/50 rounded text-sm">
                            <p className="font-medium text-xs text-slate-500 mb-1">Correlated pairs:</p>
                            {suggestion.pairs.map((pair, i) => (
                              <div key={i} className="text-xs">
                                {pair.var1} ↔ {pair.var2} (r = {pair.correlation})
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Categories for rare_categories */}
                        {suggestion.categories && (
                          <div className="mb-3 p-2 bg-white/50 rounded text-sm">
                            <p className="font-medium text-xs text-slate-500 mb-1">Rare categories:</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(suggestion.categories).map(([cat, count]) => (
                                <span key={cat} className="text-xs bg-slate-100 px-2 py-1 rounded">
                                  "{cat}": {count}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Examples for inconsistent labels */}
                        {suggestion.examples && (
                          <div className="mb-3 p-2 bg-white/50 rounded text-sm">
                            <p className="font-medium text-xs text-slate-500 mb-1">Examples:</p>
                            {suggestion.examples.map((ex, i) => (
                              <div key={i} className="text-xs">
                                "{ex[0]}" vs "{ex[1]}"
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        {suggestion.actions && suggestion.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {suggestion.actions.map((action, actionIdx) => {
                              const isThisApplying = applying === `${suggestion.variable}-${action.action}`;
                              const wasApplied = appliedActions.includes(`${suggestion.variable}-${action.action}`);
                              
                              return (
                                <Button
                                  key={actionIdx}
                                  variant={action.action === 'ignore' || action.action === 'acknowledge' || action.action === 'review' ? 'ghost' : 'outline'}
                                  size="sm"
                                  disabled={isThisApplying || wasApplied || !snapshotId}
                                  onClick={() => applyAction(suggestion, action)}
                                  className="text-xs"
                                >
                                  {isThisApplying && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                  {wasApplied && <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />}
                                  {action.label}
                                </Button>
                              );
                            })}
                          </div>
                        )}

                        {!snapshotId && (
                          <p className="text-xs text-amber-600 mt-2">
                            ⚠️ Create a snapshot first to apply transformations
                          </p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
