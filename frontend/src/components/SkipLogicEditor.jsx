import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  GitBranch,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  HelpCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

// Available operators for skip logic
const OPERATORS = [
  { id: '==', label: 'Equals', description: 'Field value equals expected value' },
  { id: '!=', label: 'Not Equals', description: 'Field value does not equal expected value' },
  { id: '>', label: 'Greater Than', description: 'Field value is greater than (numeric)' },
  { id: '>=', label: 'Greater or Equal', description: 'Field value is greater than or equal' },
  { id: '<', label: 'Less Than', description: 'Field value is less than (numeric)' },
  { id: '<=', label: 'Less or Equal', description: 'Field value is less than or equal' },
  { id: 'contains', label: 'Contains', description: 'Text contains substring' },
  { id: 'not_contains', label: 'Does Not Contain', description: 'Text does not contain substring' },
  { id: 'is_empty', label: 'Is Empty', description: 'Field has no value' },
  { id: 'is_not_empty', label: 'Is Not Empty', description: 'Field has a value' },
  { id: 'selected', label: 'Option Selected', description: 'Multi-select includes option' },
  { id: 'not_selected', label: 'Option Not Selected', description: 'Multi-select excludes option' },
];

// Single condition row
const ConditionRow = ({ 
  condition, 
  index, 
  fields, 
  onChange, 
  onRemove,
  canRemove = true 
}) => {
  const selectedField = fields.find(f => f.id === condition.field || f.name === condition.field);
  const fieldOptions = selectedField?.options || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-2 p-3 bg-card/50 rounded-lg"
    >
      {/* Field selector */}
      <Select 
        value={condition.field || ''} 
        onValueChange={(value) => onChange(index, { ...condition, field: value })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.id || field.name}>
              {field.labels?.en || field.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select 
        value={condition.operator || '=='} 
        onValueChange={(value) => onChange(index, { ...condition, operator: value })}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.id} value={op.id}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
        fieldOptions.length > 0 ? (
          <Select 
            value={condition.value || ''} 
            onValueChange={(value) => onChange(index, { ...condition, value })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {fieldOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.labels?.en || opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={condition.value || ''}
            onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
            placeholder="Value"
            className="w-40"
          />
        )
      )}

      {/* Remove button */}
      {canRemove && (
        <Button variant="ghost" size="icon" onClick={() => onRemove(index)}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      )}
    </motion.div>
  );
};

// Main Skip Logic Editor component
export function SkipLogicEditor({
  value,
  onChange,
  fields = [],
  currentFieldId,
  testValues = {}
}) {
  const [isExpanded, setIsExpanded] = useState(!!value);
  const [testResult, setTestResult] = useState(null);

  // Filter out current field from available fields
  const availableFields = fields.filter(f => f.id !== currentFieldId && f.name !== currentFieldId);

  // Initialize with default structure if empty
  const logic = value || { type: 'and', conditions: [] };

  const handleTypeChange = (type) => {
    onChange({ ...logic, type });
  };

  const handleConditionChange = (index, updatedCondition) => {
    const newConditions = [...logic.conditions];
    newConditions[index] = updatedCondition;
    onChange({ ...logic, conditions: newConditions });
  };

  const handleAddCondition = () => {
    onChange({
      ...logic,
      conditions: [...logic.conditions, { field: '', operator: '==', value: '' }]
    });
  };

  const handleRemoveCondition = (index) => {
    const newConditions = logic.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onChange(null);
      setIsExpanded(false);
    } else {
      onChange({ ...logic, conditions: newConditions });
    }
  };

  const handleClearAll = () => {
    onChange(null);
    setIsExpanded(false);
  };

  // Test the logic with current test values
  const testLogic = async () => {
    if (!logic.conditions.length) {
      setTestResult({ visible: true, message: 'No conditions defined' });
      return;
    }

    try {
      const response = await fetch('/api/logic/validate-skip-logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logic, values: testValues })
      });
      const result = await response.json();
      setTestResult({ visible: result.is_visible, message: result.is_visible ? 'Field will be shown' : 'Field will be hidden' });
    } catch {
      // Fallback to client-side evaluation
      const visible = evaluateLogicClient(logic, testValues);
      setTestResult({ visible, message: visible ? 'Field will be shown' : 'Field will be hidden' });
    }
  };

  // Client-side logic evaluation
  const evaluateLogicClient = (logic, values) => {
    if (!logic?.conditions?.length) return true;

    const results = logic.conditions.map(c => {
      const actual = values[c.field];
      const expected = c.value;

      switch (c.operator) {
        case '==': return actual == expected;
        case '!=': return actual != expected;
        case '>': return Number(actual) > Number(expected);
        case '>=': return Number(actual) >= Number(expected);
        case '<': return Number(actual) < Number(expected);
        case '<=': return Number(actual) <= Number(expected);
        case 'is_empty': return !actual || actual === '' || (Array.isArray(actual) && actual.length === 0);
        case 'is_not_empty': return !!actual && actual !== '' && (!Array.isArray(actual) || actual.length > 0);
        case 'selected': return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
        case 'not_selected': return Array.isArray(actual) ? !actual.includes(expected) : actual !== expected;
        case 'contains': return String(actual || '').includes(expected);
        case 'not_contains': return !String(actual || '').includes(expected);
        default: return true;
      }
    });

    return logic.type === 'or' ? results.some(Boolean) : results.every(Boolean);
  };

  if (!isExpanded && !value) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => { setIsExpanded(true); handleAddCondition(); }}
        className="w-full justify-start"
      >
        <GitBranch className="w-4 h-4 mr-2" />
        Add Skip Logic
      </Button>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
            <GitBranch className="w-4 h-4 text-primary" />
            Skip Logic
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Define when this field should be shown or hidden<br/>based on other field values</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Logic Type Toggle */}
        {logic.conditions.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Show field when</span>
            <Select value={logic.type} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">ALL</SelectItem>
                <SelectItem value="or">ANY</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-gray-400">conditions are met:</span>
          </div>
        )}

        {/* Conditions */}
        <AnimatePresence>
          {logic.conditions.map((condition, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {logic.type.toUpperCase()}
                  </Badge>
                </div>
              )}
              <ConditionRow
                condition={condition}
                index={index}
                fields={availableFields}
                onChange={handleConditionChange}
                onRemove={handleRemoveCondition}
                canRemove={logic.conditions.length > 1}
              />
            </React.Fragment>
          ))}
        </AnimatePresence>

        {/* Add condition button */}
        <Button variant="outline" size="sm" onClick={handleAddCondition} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Condition
        </Button>

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            testResult.visible ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
          }`}>
            {testResult.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm">{testResult.message}</span>
          </div>
        )}

        {/* Test button */}
        {Object.keys(testValues).length > 0 && (
          <Button variant="ghost" size="sm" onClick={testLogic} className="w-full">
            <Check className="w-4 h-4 mr-2" />
            Test with Current Values
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Simple display of skip logic (read-only)
export function SkipLogicDisplay({ logic, fields = [] }) {
  if (!logic?.conditions?.length) return null;

  const getFieldLabel = (fieldId) => {
    const field = fields.find(f => f.id === fieldId || f.name === fieldId);
    return field?.labels?.en || field?.name || fieldId;
  };

  const getOperatorLabel = (opId) => {
    return OPERATORS.find(o => o.id === opId)?.label || opId;
  };

  return (
    <div className="text-xs text-gray-400 flex flex-wrap items-center gap-1">
      <GitBranch className="w-3 h-3" />
      <span>Show when</span>
      {logic.conditions.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0">{logic.type}</Badge>}
          <span className="text-gray-300">
            {getFieldLabel(c.field)} {getOperatorLabel(c.operator)} {c.value || ''}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
