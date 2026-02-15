import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  X,
  Copy,
  Settings2,
  Plus,
  Trash2,
  Eye,
  GitMerge,
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from './ui/alert';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Duplicate Alert Component - shown when submitting
export function DuplicateAlert({ matches, onProceed, onCancel }) {
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  const highestMatch = matches.reduce((max, m) => 
    m.similarity_score > max.similarity_score ? m : max, 
    matches[0]
  );

  const shouldBlock = matches.some(m => m.action === 'block');
  const shouldWarn = matches.some(m => m.action === 'warn');

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="w-5 h-5" />
            Potential Duplicate Detected
          </DialogTitle>
          <DialogDescription>
            This submission appears to match {matches.length} existing {matches.length === 1 ? 'record' : 'records'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Highest Match */}
          <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-yellow-500">
                {Math.round(highestMatch.similarity_score * 100)}% Match
              </span>
              <Badge variant="outline" className="text-xs">
                {highestMatch.rule_name}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">
              Matched on: {highestMatch.matched_fields.join(', ')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Submission ID: {highestMatch.matched_submission_id}
            </p>
          </div>

          {/* Action Warning */}
          {shouldBlock && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Submission Blocked</AlertTitle>
              <AlertDescription>
                This duplicate detection rule blocks new submissions. You cannot proceed without resolving this duplicate.
              </AlertDescription>
            </Alert>
          )}

          {shouldWarn && !shouldBlock && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You can still submit, but this will be flagged for review.
              </AlertDescription>
            </Alert>
          )}

          {/* Other matches */}
          {matches.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Other potential matches:</p>
              {matches.slice(1).map((match, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-card/50 rounded">
                  <span className="text-sm">
                    {Math.round(match.similarity_score * 100)}% - {match.matched_submission_id}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedMatch(match)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Go Back & Edit
          </Button>
          {!shouldBlock && (
            <Button onClick={onProceed} variant={shouldWarn ? "secondary" : "default"}>
              {shouldWarn ? 'Submit Anyway' : 'Submit'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Duplicate Rules Configuration
export function DuplicateRulesConfig({ formId, fields, onClose }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    loadRules();
  }, [formId]);

  const loadRules = async () => {
    try {
      const response = await fetch(`${API_URL}/api/duplicates/rules/${formId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule) => {
    try {
      const isNew = !rule.id || rule.id === 'default';
      const url = isNew 
        ? `${API_URL}/api/duplicates/rules`
        : `${API_URL}/api/duplicates/rules/${rule.id}`;
      
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...rule, form_id: formId })
      });

      if (response.ok) {
        toast.success(isNew ? 'Rule created' : 'Rule updated');
        loadRules();
        setEditingRule(null);
      }
    } catch (error) {
      toast.error('Failed to save rule');
    }
  };

  const deleteRule = async (ruleId) => {
    if (!confirm('Delete this rule?')) return;
    
    try {
      await fetch(`${API_URL}/api/duplicates/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Rule deleted');
      loadRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Duplicate Detection Rules
          </SheetTitle>
          <SheetDescription>
            Configure rules to detect and handle duplicate submissions
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Add Rule Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setEditingRule({
              name: 'New Rule',
              fields: [],
              threshold: 1.0,
              action: 'flag',
              is_active: true
            })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Detection Rule
          </Button>

          <Separator />

          {/* Rules List */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No duplicate detection rules configured
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <Card key={rule.id} className="bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white">{rule.name}</h4>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400">
                          Fields: {rule.fields?.length > 0 ? rule.fields.join(', ') : 'None configured'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Threshold: {Math.round(rule.threshold * 100)}%</span>
                          <span>Action: {rule.action}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRule(rule)}
                        >
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        {rule.id !== 'default' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Edit Rule Dialog */}
        {editingRule && (
          <RuleEditor
            rule={editingRule}
            fields={fields}
            onSave={saveRule}
            onClose={() => setEditingRule(null)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// Rule Editor Component
function RuleEditor({ rule, fields, onSave, onClose }) {
  const [localRule, setLocalRule] = useState(rule);

  const toggleField = (fieldName) => {
    const currentFields = localRule.fields || [];
    if (currentFields.includes(fieldName)) {
      setLocalRule({
        ...localRule,
        fields: currentFields.filter(f => f !== fieldName)
      });
    } else {
      setLocalRule({
        ...localRule,
        fields: [...currentFields, fieldName]
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {rule.id && rule.id !== 'default' ? 'Edit Rule' : 'Create Rule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Rule Name</Label>
            <Input
              value={localRule.name}
              onChange={(e) => setLocalRule({ ...localRule, name: e.target.value })}
              placeholder="e.g., Phone Number Check"
            />
          </div>

          <div className="space-y-2">
            <Label>Fields to Check</Label>
            <div className="max-h-40 overflow-auto border rounded-lg p-2 space-y-1">
              {fields.map((field) => (
                <label
                  key={field.name || field.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={localRule.fields?.includes(field.name) || false}
                    onChange={() => toggleField(field.name)}
                    className="rounded"
                  />
                  <span className="text-sm">{field.label || field.name}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {field.type}
                  </Badge>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Select fields that uniquely identify a submission
            </p>
          </div>

          <div className="space-y-2">
            <Label>Match Threshold</Label>
            <Select
              value={String(localRule.threshold)}
              onValueChange={(v) => setLocalRule({ ...localRule, threshold: parseFloat(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1.0">Exact Match (100%)</SelectItem>
                <SelectItem value="0.9">Very Similar (90%)</SelectItem>
                <SelectItem value="0.8">Similar (80%)</SelectItem>
                <SelectItem value="0.7">Somewhat Similar (70%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Action on Detection</Label>
            <Select
              value={localRule.action}
              onValueChange={(v) => setLocalRule({ ...localRule, action: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flag">Flag for Review</SelectItem>
                <SelectItem value="warn">Warn User</SelectItem>
                <SelectItem value="block">Block Submission</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
            <div>
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-gray-500">Enable this rule</p>
            </div>
            <Switch
              id="active"
              checked={localRule.is_active}
              onCheckedChange={(checked) => setLocalRule({ ...localRule, is_active: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(localRule)} disabled={localRule.fields?.length === 0}>
            Save Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Duplicate Review Panel
export function DuplicateReviewPanel({ formId }) {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadDuplicates();
    loadStats();
  }, [formId]);

  const loadDuplicates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/duplicates/submissions/${formId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setDuplicates(data.duplicates || []);
    } catch (error) {
      console.error('Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/duplicates/stats/${formId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  const resolveMatch = async (matchId, action) => {
    try {
      await fetch(`${API_URL}/api/duplicates/resolve/${matchId}?action=${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success(`Duplicate ${action}ed`);
      loadDuplicates();
      loadStats();
    } catch (error) {
      toast.error('Failed to resolve');
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Copy className="w-5 h-5" />
          Duplicate Detection
        </CardTitle>
        <CardDescription>Review and resolve potential duplicate submissions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 bg-card/30 rounded-lg text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-500">{stats.confirmed}</p>
              <p className="text-xs text-gray-500">Confirmed</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-500">{stats.dismissed}</p>
              <p className="text-xs text-gray-500">Dismissed</p>
            </div>
          </div>
        )}

        <Separator />

        {/* Duplicates List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : duplicates.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-400">No pending duplicates to review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {duplicates.map((dup) => (
              <div key={dup.id} className="p-4 bg-card/30 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-medium text-white">
                      {Math.round(dup.similarity_score * 100)}% Match
                    </span>
                  </div>
                  <Badge variant="outline">{dup.rule_name || 'Auto-detected'}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                  <div className="p-2 bg-card/50 rounded">
                    <p className="text-gray-500 mb-1">Submission 1</p>
                    <p className="text-white">{dup.submission?.id}</p>
                    <p className="text-gray-400">{dup.submission?.submitted_at}</p>
                  </div>
                  <div className="p-2 bg-card/50 rounded">
                    <p className="text-gray-500 mb-1">Submission 2</p>
                    <p className="text-white">{dup.matched_submission?.id}</p>
                    <p className="text-gray-400">{dup.matched_submission?.submitted_at}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => resolveMatch(dup.id, 'dismiss')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Not a Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => resolveMatch(dup.id, 'confirm')}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Confirm Duplicate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
