import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Play,
  HelpCircle,
  Check,
  X,
  AlertCircle,
  Code,
  Variable
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

// Common calculation functions
const FUNCTIONS = [
  { name: 'round', syntax: 'round(value, decimals)', description: 'Round to decimal places', example: 'round(3.14159, 2) → 3.14' },
  { name: 'abs', syntax: 'abs(value)', description: 'Absolute value', example: 'abs(-5) → 5' },
  { name: 'min', syntax: 'min(a, b, ...)', description: 'Minimum value', example: 'min(5, 3, 8) → 3' },
  { name: 'max', syntax: 'max(a, b, ...)', description: 'Maximum value', example: 'max(5, 3, 8) → 8' },
  { name: 'sum', syntax: 'sum([a, b, ...])', description: 'Sum of values', example: 'sum([1, 2, 3]) → 6' },
  { name: 'sqrt', syntax: 'sqrt(value)', description: 'Square root', example: 'sqrt(16) → 4' },
  { name: 'pow', syntax: 'pow(base, exp)', description: 'Power/exponent', example: 'pow(2, 3) → 8' },
  { name: 'floor', syntax: 'floor(value)', description: 'Round down', example: 'floor(3.9) → 3' },
  { name: 'ceil', syntax: 'ceil(value)', description: 'Round up', example: 'ceil(3.1) → 4' },
  { name: 'today', syntax: 'today()', description: 'Current date', example: 'today() → "2024-01-15"' },
  { name: 'age', syntax: 'age(date_of_birth)', description: 'Calculate age from DOB', example: 'age(dob) → 25' },
  { name: 'iif', syntax: 'iif(cond, true, false)', description: 'Conditional', example: 'iif(gte(score, 50), "Pass", "Fail")' },
  { name: 'gte', syntax: 'gte(a, b)', description: 'Greater or equal', example: 'gte(10, 5) → true' },
  { name: 'gt', syntax: 'gt(a, b)', description: 'Greater than', example: 'gt(10, 5) → true' },
  { name: 'lte', syntax: 'lte(a, b)', description: 'Less or equal', example: 'lte(5, 10) → true' },
  { name: 'lt', syntax: 'lt(a, b)', description: 'Less than', example: 'lt(5, 10) → true' },
  { name: 'coalesce', syntax: 'coalesce(a, b, ...)', description: 'First non-null', example: 'coalesce(null, 5) → 5' },
  { name: 'concat', syntax: 'concat(a, b, ...)', description: 'Join strings', example: 'concat("Hi ", name) → "Hi John"' },
  { name: 'count_selected', syntax: 'count_selected(field)', description: 'Count selections', example: 'count_selected(symptoms) → 3' },
];

// Example formulas
const EXAMPLES = [
  { label: 'BMI Calculator', formula: 'round(weight / ((height/100) * (height/100)), 1)', fields: ['weight', 'height'] },
  { label: 'Total Cost', formula: 'quantity * unit_price', fields: ['quantity', 'unit_price'] },
  { label: 'Average Score', formula: 'round((score1 + score2 + score3) / 3, 1)', fields: ['score1', 'score2', 'score3'] },
  { label: 'Age from DOB', formula: 'age(date_of_birth)', fields: ['date_of_birth'] },
  { label: 'Pass/Fail', formula: "iif(gte(score, 50), 'Pass', 'Fail')", fields: ['score'] },
  { label: 'Percentage', formula: 'round((correct / total) * 100, 0)', fields: ['correct', 'total'] },
];

export function CalculatedFieldEditor({
  value,
  onChange,
  fields = [],
  testValues = {},
  fieldName = ''
}) {
  const [formula, setFormula] = useState(value || '');
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // Filter out calculate fields to avoid circular references
  const availableFields = fields.filter(f => f.type !== 'calculate');

  useEffect(() => {
    setFormula(value || '');
  }, [value]);

  const handleFormulaChange = (newFormula) => {
    setFormula(newFormula);
    onChange(newFormula);
    setTestResult(null);
    setError(null);
  };

  const insertField = (fieldId) => {
    const newFormula = formula + fieldId;
    handleFormulaChange(newFormula);
  };

  const insertFunction = (funcSyntax) => {
    const newFormula = formula + funcSyntax;
    handleFormulaChange(newFormula);
  };

  const applyExample = (example) => {
    handleFormulaChange(example.formula);
  };

  const testFormula = async () => {
    if (!formula) {
      setError('Enter a formula first');
      return;
    }

    try {
      const response = await fetch('/api/logic/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: formula, values: testValues })
      });
      
      if (response.ok) {
        const result = await response.json();
        setTestResult(result.result);
        setError(null);
      } else {
        const err = await response.json();
        setError(err.detail || 'Calculation error');
        setTestResult(null);
      }
    } catch (e) {
      // Fallback: try client-side eval (limited)
      try {
        const result = evaluateFormula(formula, testValues);
        setTestResult(result);
        setError(null);
      } catch {
        setError('Invalid formula');
        setTestResult(null);
      }
    }
  };

  // Simple client-side formula evaluation
  const evaluateFormula = (expr, values) => {
    let evalExpr = expr;
    
    // Replace field names with values
    Object.keys(values).forEach(key => {
      const val = values[key];
      const safeVal = typeof val === 'string' ? `"${val}"` : val;
      evalExpr = evalExpr.replace(new RegExp(`\\b${key}\\b`, 'g'), safeVal);
    });
    
    // Add safe math functions
    const safeFuncs = {
      round: Math.round,
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      sqrt: Math.sqrt,
      pow: Math.pow,
      floor: Math.floor,
      ceil: Math.ceil,
    };
    
    // eslint-disable-next-line no-new-func
    return new Function(...Object.keys(safeFuncs), `return ${evalExpr}`)(...Object.values(safeFuncs));
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Calculation Formula
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowHelp(!showHelp)}>
            <HelpCircle className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Help Panel */}
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card/50 rounded-lg p-3 space-y-3"
          >
            <p className="text-xs text-gray-400">
              Use field names and functions to create calculations. 
              Results update automatically when referenced fields change.
            </p>
            
            {/* Quick Examples */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-300">Quick Examples</Label>
              <div className="flex flex-wrap gap-1">
                {EXAMPLES.map((ex, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 text-xs"
                    onClick={() => applyExample(ex)}
                  >
                    {ex.label}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Formula Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-400">Formula</Label>
            <div className="flex gap-1">
              {/* Field Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-xs">
                    <Variable className="w-3 h-3 mr-1" />
                    Fields
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2">
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {availableFields.map((field) => (
                      <Button
                        key={field.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => insertField(field.name || field.id)}
                      >
                        {field.labels?.en || field.name}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Function Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-xs">
                    <Code className="w-3 h-3 mr-1" />
                    Functions
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {FUNCTIONS.map((func) => (
                      <TooltipProvider key={func.name}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-7 font-mono"
                              onClick={() => insertFunction(func.syntax)}
                            >
                              {func.name}()
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="font-mono text-xs">{func.syntax}</p>
                            <p className="text-xs text-gray-400">{func.description}</p>
                            <p className="text-xs text-green-400 mt-1">{func.example}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Textarea
            value={formula}
            onChange={(e) => handleFormulaChange(e.target.value)}
            placeholder="e.g., round(weight / ((height/100) * (height/100)), 1)"
            className="font-mono text-sm min-h-[80px]"
          />
        </div>

        {/* Test Section */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={testFormula} className="flex-1">
            <Play className="w-4 h-4 mr-2" />
            Test Formula
          </Button>
        </div>

        {/* Result Display */}
        {testResult !== null && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg text-green-500">
            <Check className="w-4 h-4" />
            <span className="text-sm">Result: <span className="font-mono font-bold">{String(testResult)}</span></span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Test Values Display */}
        {Object.keys(testValues).length > 0 && (
          <div className="text-xs text-gray-500">
            Test values: {JSON.stringify(testValues)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Display calculated result (for form preview)
export function CalculatedFieldDisplay({ formula, values, label }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!formula || !values) return;

    const calculate = async () => {
      try {
        const response = await fetch('/api/logic/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expression: formula, values })
        });
        
        if (response.ok) {
          const data = await response.json();
          setResult(data.result);
        }
      } catch {
        setResult(null);
      }
    };

    calculate();
  }, [formula, values]);

  return (
    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <Calculator className="w-3 h-3 mr-1" />
          Auto
        </Badge>
      </div>
      <p className="text-2xl font-mono font-bold text-white mt-1">
        {result !== null ? String(result) : '—'}
      </p>
    </div>
  );
}
