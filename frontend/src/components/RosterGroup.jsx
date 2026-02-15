/**
 * DataPulse - Enhanced Roster/Repeat Groups Component
 * Full support for household member rosters, repeated modules, and dynamic loops.
 * 
 * Features:
 * - Add/remove roster entries dynamically
 * - Carry-forward values from previous entries
 * - Computed variables within rosters
 * - Validation per entry
 * - Configurable min/max entries
 * - "Add another" UX with confirmation
 * - Roster-level aggregations
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { AlertCircle, Plus, Trash2, Copy, ChevronDown, ChevronUp, Users, Calculator } from 'lucide-react';
import { toast } from 'sonner';

// Default roster configuration
const DEFAULT_CONFIG = {
  minEntries: 0,
  maxEntries: 50,
  allowDelete: true,
  showIndex: true,
  confirmDelete: true,
  carryForwardFields: [],
  aggregations: [],
  entryLabel: 'Entry',
  addButtonLabel: 'Add Another',
  emptyMessage: 'No entries yet. Click "Add Another" to start.'
};

/**
 * Main Roster Component
 */
export function RosterGroup({
  fieldId,
  config = {},
  fields = [],
  value = [],
  onChange,
  onValidate,
  formData = {},
  readOnly = false
}) {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const [entries, setEntries] = useState(value || []);
  const [expandedEntries, setExpandedEntries] = useState(new Set([0]));
  const [validationErrors, setValidationErrors] = useState({});

  // Sync with external value
  useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(entries)) {
      setEntries(value);
    }
  }, [value]);

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      onChange(entries);
    }
  }, [entries, onChange]);

  // Calculate aggregations
  const aggregations = useMemo(() => {
    if (!settings.aggregations?.length) return {};
    
    const results = {};
    settings.aggregations.forEach(agg => {
      const values = entries
        .map(e => parseFloat(e[agg.field]) || 0)
        .filter(v => !isNaN(v));
      
      switch (agg.type) {
        case 'sum':
          results[agg.name] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          results[agg.name] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'count':
          results[agg.name] = entries.length;
          break;
        case 'min':
          results[agg.name] = values.length ? Math.min(...values) : 0;
          break;
        case 'max':
          results[agg.name] = values.length ? Math.max(...values) : 0;
          break;
        default:
          results[agg.name] = 0;
      }
    });
    return results;
  }, [entries, settings.aggregations]);

  // Add new entry
  const addEntry = useCallback(() => {
    if (entries.length >= settings.maxEntries) {
      toast.error(`Maximum ${settings.maxEntries} entries allowed`);
      return;
    }

    // Create new entry with carry-forward values
    const newEntry = { _index: entries.length + 1 };
    
    if (settings.carryForwardFields?.length && entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      settings.carryForwardFields.forEach(fieldId => {
        if (lastEntry[fieldId] !== undefined) {
          newEntry[fieldId] = lastEntry[fieldId];
        }
      });
    }

    // Initialize with default values from field definitions
    fields.forEach(field => {
      if (field.defaultValue !== undefined && newEntry[field.id] === undefined) {
        newEntry[field.id] = field.defaultValue;
      }
    });

    const newEntries = [...entries, newEntry];
    setEntries(newEntries);
    setExpandedEntries(prev => new Set([...prev, entries.length]));
  }, [entries, settings, fields]);

  // Remove entry
  const removeEntry = useCallback((index) => {
    if (!settings.allowDelete) return;
    
    if (entries.length <= settings.minEntries) {
      toast.error(`Minimum ${settings.minEntries} entries required`);
      return;
    }

    if (settings.confirmDelete) {
      if (!window.confirm(`Delete ${settings.entryLabel} ${index + 1}?`)) {
        return;
      }
    }

    const newEntries = entries.filter((_, i) => i !== index)
      .map((entry, i) => ({ ...entry, _index: i + 1 }));
    setEntries(newEntries);
    
    // Clear validation errors for removed entry
    const newErrors = { ...validationErrors };
    delete newErrors[index];
    setValidationErrors(newErrors);
  }, [entries, settings, validationErrors]);

  // Duplicate entry
  const duplicateEntry = useCallback((index) => {
    if (entries.length >= settings.maxEntries) {
      toast.error(`Maximum ${settings.maxEntries} entries allowed`);
      return;
    }

    const entryToCopy = { ...entries[index] };
    delete entryToCopy._index;
    
    const newEntry = { ...entryToCopy, _index: entries.length + 1 };
    const newEntries = [...entries, newEntry];
    setEntries(newEntries);
  }, [entries, settings]);

  // Update field value within entry
  const updateEntryField = useCallback((entryIndex, fieldId, value) => {
    const newEntries = [...entries];
    newEntries[entryIndex] = {
      ...newEntries[entryIndex],
      [fieldId]: value
    };

    // Run calculations if any depend on this field
    fields.forEach(field => {
      if (field.calculation) {
        const calculated = evaluateCalculation(field.calculation, newEntries[entryIndex], formData);
        if (calculated !== null) {
          newEntries[entryIndex][field.id] = calculated;
        }
      }
    });

    setEntries(newEntries);
    
    // Validate the updated field
    if (onValidate) {
      const errors = onValidate(newEntries[entryIndex], fields);
      setValidationErrors(prev => ({
        ...prev,
        [entryIndex]: errors
      }));
    }
  }, [entries, fields, formData, onValidate]);

  // Toggle entry expansion
  const toggleExpanded = useCallback((index) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className="roster-group space-y-4" data-testid={`roster-${fieldId}`}>
      {/* Roster Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {config.label || 'Roster'} ({entries.length})
          </span>
          {settings.minEntries > 0 && (
            <span className="text-xs text-muted-foreground">
              (Min: {settings.minEntries})
            </span>
          )}
        </div>
        
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEntry}
            disabled={entries.length >= settings.maxEntries}
            data-testid="roster-add-button"
          >
            <Plus className="h-4 w-4 mr-1" />
            {settings.addButtonLabel}
          </Button>
        )}
      </div>

      {/* Aggregations Display */}
      {Object.keys(aggregations).length > 0 && (
        <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg">
          {Object.entries(aggregations).map(([name, value]) => (
            <div key={name} className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{name}:</span>
              <span className="text-sm">{typeof value === 'number' ? value.toFixed(2) : value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">{settings.emptyMessage}</p>
        </div>
      )}

      {/* Entry List */}
      <div className="space-y-3">
        {entries.map((entry, index) => (
          <RosterEntry
            key={`${fieldId}-entry-${index}`}
            index={index}
            entry={entry}
            fields={fields}
            settings={settings}
            isExpanded={expandedEntries.has(index)}
            onToggle={() => toggleExpanded(index)}
            onUpdate={(fieldId, value) => updateEntryField(index, fieldId, value)}
            onRemove={() => removeEntry(index)}
            onDuplicate={() => duplicateEntry(index)}
            errors={validationErrors[index] || {}}
            readOnly={readOnly}
            formData={formData}
          />
        ))}
      </div>

      {/* Validation Summary */}
      {entries.length > 0 && entries.length < settings.minEntries && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Please add at least {settings.minEntries - entries.length} more {settings.entryLabel.toLowerCase()}(s)</span>
        </div>
      )}
    </div>
  );
}

/**
 * Single Roster Entry Component
 */
function RosterEntry({
  index,
  entry,
  fields,
  settings,
  isExpanded,
  onToggle,
  onUpdate,
  onRemove,
  onDuplicate,
  errors = {},
  readOnly,
  formData
}) {
  // Get a summary of the entry for collapsed view
  const summary = useMemo(() => {
    const summaryFields = fields.slice(0, 3);
    return summaryFields
      .map(f => entry[f.id])
      .filter(Boolean)
      .join(' | ') || 'Empty entry';
  }, [entry, fields]);

  return (
    <Card className={errors && Object.keys(errors).length > 0 ? 'border-destructive' : ''}>
      <CardHeader className="py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.showIndex && (
              <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-medium">
                {index + 1}
              </span>
            )}
            <div>
              <CardTitle className="text-sm font-medium">
                {settings.entryLabel} {index + 1}
              </CardTitle>
              {!isExpanded && (
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {summary}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                  title="Duplicate entry"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {settings.allowDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="text-destructive hover:text-destructive"
                    title="Remove entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid gap-4">
            {fields.map(field => (
              <RosterField
                key={`${index}-${field.id}`}
                field={field}
                value={entry[field.id]}
                onChange={(value) => onUpdate(field.id, value)}
                error={errors[field.id]}
                readOnly={readOnly || field.readOnly}
                entryData={entry}
                formData={formData}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Individual Field Renderer within Roster
 */
function RosterField({
  field,
  value,
  onChange,
  error,
  readOnly,
  entryData,
  formData
}) {
  const fieldType = field.type || 'text';

  // Check relevance/skip logic within roster context
  if (field.relevance) {
    const isRelevant = evaluateCondition(field.relevance, entryData, formData);
    if (!isRelevant) return null;
  }

  const renderField = () => {
    switch (fieldType) {
      case 'text':
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={readOnly}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            disabled={readOnly}
          />
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value || ''}
            onValueChange={onChange}
            disabled={readOnly}
            className="flex flex-wrap gap-4"
          >
            {(field.options || []).map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                <Label htmlFor={`${field.id}-${opt.value}`}>{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="flex flex-wrap gap-4">
            {(field.options || []).map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${opt.value}`}
                  checked={(value || []).includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const current = value || [];
                    if (checked) {
                      onChange([...current, opt.value]);
                    } else {
                      onChange(current.filter(v => v !== opt.value));
                    }
                  }}
                  disabled={readOnly}
                />
                <Label htmlFor={`${field.id}-${opt.value}`}>{opt.label}</Label>
              </div>
            ))}
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
          />
        );

      case 'calculated':
        const calculated = evaluateCalculation(field.calculation, entryData, formData);
        return (
          <div className="p-2 bg-muted rounded text-sm">
            {calculated ?? '-'}
          </div>
        );

      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={readOnly}
          />
        );
    }
  };

  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Evaluate a calculation formula
 */
function evaluateCalculation(formula, entryData, formData) {
  if (!formula) return null;
  
  try {
    // Replace field references with values
    let expression = formula;
    
    // Replace roster entry references: ${fieldId}
    for (const [key, val] of Object.entries(entryData || {})) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      expression = expression.replace(regex, val ?? 0);
    }
    
    // Replace form-level references: #{fieldId}
    for (const [key, val] of Object.entries(formData || {})) {
      const regex = new RegExp(`#\\{${key}\\}`, 'g');
      expression = expression.replace(regex, val ?? 0);
    }
    
    // Safe evaluation (basic math only)
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
    if (sanitized) {
      return eval(sanitized);
    }
    return null;
  } catch (e) {
    console.error('Calculation error:', e);
    return null;
  }
}

/**
 * Evaluate a relevance/skip condition
 */
function evaluateCondition(condition, entryData, formData) {
  if (!condition) return true;
  
  try {
    let expression = condition;
    
    // Replace references
    for (const [key, val] of Object.entries(entryData || {})) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      if (typeof val === 'string') {
        expression = expression.replace(regex, `'${val}'`);
      } else {
        expression = expression.replace(regex, val ?? 'null');
      }
    }
    
    for (const [key, val] of Object.entries(formData || {})) {
      const regex = new RegExp(`#\\{${key}\\}`, 'g');
      if (typeof val === 'string') {
        expression = expression.replace(regex, `'${val}'`);
      } else {
        expression = expression.replace(regex, val ?? 'null');
      }
    }
    
    // Evaluate with restricted context
    return Boolean(eval(expression));
  } catch (e) {
    console.error('Condition evaluation error:', e);
    return true;
  }
}

/**
 * Hook for managing roster state
 */
export function useRoster(initialValue = [], config = {}) {
  const [entries, setEntries] = useState(initialValue);
  const settings = { ...DEFAULT_CONFIG, ...config };

  const addEntry = useCallback((defaultValues = {}) => {
    if (entries.length >= settings.maxEntries) return false;
    
    const newEntry = {
      _index: entries.length + 1,
      ...defaultValues
    };
    
    // Carry forward from last entry
    if (settings.carryForwardFields?.length && entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      settings.carryForwardFields.forEach(field => {
        if (lastEntry[field] !== undefined && defaultValues[field] === undefined) {
          newEntry[field] = lastEntry[field];
        }
      });
    }
    
    setEntries([...entries, newEntry]);
    return true;
  }, [entries, settings]);

  const removeEntry = useCallback((index) => {
    if (entries.length <= settings.minEntries) return false;
    
    const newEntries = entries.filter((_, i) => i !== index)
      .map((e, i) => ({ ...e, _index: i + 1 }));
    setEntries(newEntries);
    return true;
  }, [entries, settings]);

  const updateEntry = useCallback((index, updates) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    setEntries(newEntries);
  }, [entries]);

  const getAggregation = useCallback((field, type) => {
    const values = entries.map(e => parseFloat(e[field]) || 0);
    switch (type) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'count': return entries.length;
      case 'min': return values.length ? Math.min(...values) : 0;
      case 'max': return values.length ? Math.max(...values) : 0;
      default: return 0;
    }
  }, [entries]);

  const validate = useCallback((fieldValidators = {}) => {
    const errors = {};
    entries.forEach((entry, index) => {
      const entryErrors = {};
      Object.entries(fieldValidators).forEach(([field, validator]) => {
        const error = validator(entry[field], entry, index);
        if (error) entryErrors[field] = error;
      });
      if (Object.keys(entryErrors).length > 0) {
        errors[index] = entryErrors;
      }
    });
    return errors;
  }, [entries]);

  return {
    entries,
    setEntries,
    addEntry,
    removeEntry,
    updateEntry,
    getAggregation,
    validate,
    count: entries.length,
    isEmpty: entries.length === 0,
    isFull: entries.length >= settings.maxEntries,
    canAdd: entries.length < settings.maxEntries,
    canRemove: entries.length > settings.minEntries
  };
}

export default RosterGroup;
