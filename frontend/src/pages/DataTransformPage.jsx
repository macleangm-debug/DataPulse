import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Wand2,
  Filter,
  ArrowUpDown,
  Columns,
  Calculator,
  Trash2,
  Plus,
  Play,
  Save,
  Undo2,
  Eye,
  EyeOff,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Settings2,
  Layers,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuthStore } from '../store';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Transformation types
const TRANSFORM_TYPES = [
  { id: 'filter', name: 'Filter Rows', icon: Filter, description: 'Remove rows based on conditions', color: 'text-blue-500' },
  { id: 'rename', name: 'Rename Column', icon: Type, description: 'Change column names', color: 'text-green-500' },
  { id: 'cast', name: 'Change Type', icon: Hash, description: 'Convert data types', color: 'text-purple-500' },
  { id: 'calculate', name: 'Calculate Field', icon: Calculator, description: 'Create new calculated columns', color: 'text-amber-500' },
  { id: 'fill_missing', name: 'Fill Missing', icon: Layers, description: 'Handle null/empty values', color: 'text-cyan-500' },
  { id: 'drop', name: 'Drop Column', icon: Trash2, description: 'Remove columns', color: 'text-red-500' },
  { id: 'sort', name: 'Sort Data', icon: ArrowUpDown, description: 'Order rows by column', color: 'text-indigo-500' },
];

// Filter operators
const FILTER_OPERATORS = [
  { value: 'eq', label: 'Equals (=)' },
  { value: 'neq', label: 'Not Equals (≠)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'gte', label: 'Greater or Equal (≥)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'lte', label: 'Less or Equal (≤)' },
  { value: 'contains', label: 'Contains' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' },
  { value: 'is_null', label: 'Is Empty/Null' },
  { value: 'not_null', label: 'Is Not Empty' },
];

// Data types for casting
const DATA_TYPES = [
  { value: 'string', label: 'Text (String)' },
  { value: 'int', label: 'Integer' },
  { value: 'float', label: 'Decimal (Float)' },
  { value: 'date', label: 'Date' },
  { value: 'bool', label: 'Boolean' },
];

// Fill methods
const FILL_METHODS = [
  { value: 'value', label: 'Specific Value' },
  { value: 'mean', label: 'Mean (Average)' },
  { value: 'median', label: 'Median' },
  { value: 'mode', label: 'Most Frequent' },
  { value: 'forward', label: 'Forward Fill' },
  { value: 'backward', label: 'Backward Fill' },
  { value: 'drop', label: 'Drop Rows' },
];

// Transformation Step Component
const TransformStep = ({ step, index, onRemove, onToggle }) => {
  const typeInfo = TRANSFORM_TYPES.find(t => t.id === step.type);
  const Icon = typeInfo?.icon || Settings2;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        step.enabled ? 'bg-card border-border' : 'bg-muted/50 border-muted opacity-60'
      }`}
      data-testid={`transform-step-${index}`}
    >
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
        {index + 1}
      </div>
      <Icon className={`w-4 h-4 ${typeInfo?.color || 'text-muted-foreground'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{step.description || typeInfo?.name}</p>
        <p className="text-xs text-muted-foreground truncate">{step.details}</p>
      </div>
      <Switch
        checked={step.enabled}
        onCheckedChange={() => onToggle(index)}
        className="data-[state=checked]:bg-green-500"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </Button>
    </motion.div>
  );
};

// Data Preview Table
const DataPreviewTable = ({ data, columns }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <FileText className="w-12 h-12 mb-3 opacity-50" />
        <p>No data to preview</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center">#</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 10).map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-center text-muted-foreground text-xs">
                  {idx + 1}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col} className="max-w-[200px] truncate">
                    {row[col] === null || row[col] === undefined ? (
                      <span className="text-muted-foreground italic text-xs">null</span>
                    ) : typeof row[col] === 'boolean' ? (
                      row[col] ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      String(row[col])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && (
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground text-center">
          Showing 10 of {data.length} rows
        </div>
      )}
    </div>
  );
};

// Main Component
export function DataTransformPage() {
  const navigate = useNavigate();
  const { datasetId } = useParams();
  const { token } = useAuthStore();
  
  const [dataset, setDataset] = useState(null);
  const [originalData, setOriginalData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnStats, setColumnStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Transformation state
  const [transformSteps, setTransformSteps] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedTransformType, setSelectedTransformType] = useState('filter');
  
  // New transform form state
  const [newTransform, setNewTransform] = useState({
    column: '',
    operator: 'eq',
    value: '',
    newName: '',
    newType: 'string',
    fillMethod: 'value',
    fillValue: '',
    formula: '',
    sortOrder: 'asc',
  });
  
  // Fetch dataset
  useEffect(() => {
    fetchDataset();
  }, [datasetId]);
  
  const fetchDataset = async () => {
    if (!datasetId) return;
    
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [datasetRes, dataRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/datasets/${datasetId}`, { headers }),
        axios.get(`${API_URL}/api/datasets/${datasetId}/data?limit=100`, { headers }),
        axios.get(`${API_URL}/api/datasets/${datasetId}/stats`, { headers }).catch(() => ({ data: { stats: {} } }))
      ]);
      
      setDataset(datasetRes.data);
      setOriginalData(dataRes.data.data || []);
      setPreviewData(dataRes.data.data || []);
      // Normalize columns to be an array of column name strings
      const rawColumns = datasetRes.data.columns || [];
      const normalizedColumns = rawColumns.map(col => typeof col === 'object' ? col.name : col);
      setColumns(normalizedColumns);
      setColumnStats(statsRes.data.stats || {});
    } catch (error) {
      console.error('Error fetching dataset:', error);
      toast.error('Failed to load dataset');
    } finally {
      setLoading(false);
    }
  };
  
  // Apply transformations to preview
  const applyTransformations = async () => {
    if (transformSteps.length === 0) {
      setPreviewData(originalData);
      return;
    }
    
    setProcessing(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const enabledSteps = transformSteps.filter(s => s.enabled);
      
      const response = await axios.post(`${API_URL}/api/datasets/${datasetId}/transform/preview`, {
        transformations: enabledSteps
      }, { headers });
      
      setPreviewData(response.data.data || []);
      if (response.data.columns) {
        setColumns(response.data.columns);
      }
      toast.success('Preview updated');
    } catch (error) {
      console.error('Error applying transformations:', error);
      toast.error('Failed to apply transformations');
    } finally {
      setProcessing(false);
    }
  };
  
  // Add new transformation
  const handleAddTransform = () => {
    let details = '';
    let config = {};
    
    switch (selectedTransformType) {
      case 'filter':
        details = `${newTransform.column} ${newTransform.operator} ${newTransform.value || '(empty)'}`;
        config = { column: newTransform.column, operator: newTransform.operator, value: newTransform.value };
        break;
      case 'rename':
        details = `${newTransform.column} → ${newTransform.newName}`;
        config = { column: newTransform.column, new_name: newTransform.newName };
        break;
      case 'cast':
        details = `${newTransform.column} to ${newTransform.newType}`;
        config = { column: newTransform.column, new_type: newTransform.newType };
        break;
      case 'calculate':
        details = `New column: ${newTransform.newName}`;
        config = { new_column: newTransform.newName, formula: newTransform.formula };
        break;
      case 'fill_missing':
        details = `${newTransform.column}: ${newTransform.fillMethod}${newTransform.fillMethod === 'value' ? ` (${newTransform.fillValue})` : ''}`;
        config = { column: newTransform.column, method: newTransform.fillMethod, value: newTransform.fillValue };
        break;
      case 'drop':
        details = `Remove: ${newTransform.column}`;
        config = { column: newTransform.column };
        break;
      case 'sort':
        details = `${newTransform.column} (${newTransform.sortOrder})`;
        config = { column: newTransform.column, order: newTransform.sortOrder };
        break;
    }
    
    const step = {
      id: Date.now().toString(),
      type: selectedTransformType,
      description: TRANSFORM_TYPES.find(t => t.id === selectedTransformType)?.name,
      details,
      config,
      enabled: true,
    };
    
    setTransformSteps([...transformSteps, step]);
    setShowAddDialog(false);
    setNewTransform({
      column: '',
      operator: 'eq',
      value: '',
      newName: '',
      newType: 'string',
      fillMethod: 'value',
      fillValue: '',
      formula: '',
      sortOrder: 'asc',
    });
    toast.success('Transformation added');
  };
  
  // Remove transformation
  const handleRemoveTransform = (index) => {
    setTransformSteps(transformSteps.filter((_, i) => i !== index));
  };
  
  // Toggle transformation enabled state
  const handleToggleTransform = (index) => {
    const updated = [...transformSteps];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setTransformSteps(updated);
  };
  
  // Save transformations
  const handleSaveTransformations = async () => {
    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const enabledSteps = transformSteps.filter(s => s.enabled);
      
      await axios.post(`${API_URL}/api/datasets/${datasetId}/transform/apply`, {
        transformations: enabledSteps
      }, { headers });
      
      toast.success('Transformations applied and saved!');
      navigate('/datasets');
    } catch (error) {
      console.error('Error saving transformations:', error);
      toast.error('Failed to save transformations');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="data-transform-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/datasets')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Wand2 className="w-6 h-6 text-violet-600" />
                Transform Data
              </h1>
              <p className="text-muted-foreground text-sm">
                {dataset?.name} • {originalData.length} rows • {columns.length} columns
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={applyTransformations}
              disabled={processing}
            >
              {processing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Preview
            </Button>
            <Button
              onClick={handleSaveTransformations}
              disabled={saving || transformSteps.length === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Transformations */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Transformations</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowAddDialog(true)}
                    data-testid="add-transform-btn"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Step
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {transformSteps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No transformations yet</p>
                    <p className="text-xs mt-1">Click "Add Step" to start cleaning your data</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {transformSteps.map((step, index) => (
                        <TransformStep
                          key={step.id}
                          step={step}
                          index={index}
                          onRemove={handleRemoveTransform}
                          onToggle={handleToggleTransform}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Column Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Columns className="w-5 h-5" />
                  Columns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {columns.map((col, idx) => {
                      const stats = columnStats[col] || {};
                      return (
                        <div key={col || idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {stats.dtype || stats.type || 'unknown'}
                            </Badge>
                            <span className="text-sm font-medium">{col}</span>
                          </div>
                          {stats.missing > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {stats.missing} null
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Panel - Data Preview */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Data Preview
                  </CardTitle>
                  <Badge variant="secondary">
                    {previewData.length} rows
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <DataPreviewTable data={previewData} columns={columns} />
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Add Transformation Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Transformation</DialogTitle>
              <DialogDescription>
                Choose a transformation type and configure its settings
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Transform Type Selection */}
              <div className="space-y-2">
                <Label>Transformation Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TRANSFORM_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedTransformType(type.id)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                        selectedTransformType === type.id
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                          : 'border-border hover:border-violet-300'
                      }`}
                      data-testid={`transform-type-${type.id}`}
                    >
                      <type.icon className={`w-4 h-4 ${type.color}`} />
                      <div>
                        <p className="text-sm font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Configuration based on type */}
              {selectedTransformType === 'filter' && (
                <>
                  <div className="space-y-2">
                    <Label>Column</Label>
                    <Select value={newTransform.column} onValueChange={(v) => setNewTransform({ ...newTransform, column: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Operator</Label>
                    <Select value={newTransform.operator} onValueChange={(v) => setNewTransform({ ...newTransform, operator: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!['is_null', 'not_null'].includes(newTransform.operator) && (
                    <div className="space-y-2">
                      <Label>Value</Label>
                      <Input
                        value={newTransform.value}
                        onChange={(e) => setNewTransform({ ...newTransform, value: e.target.value })}
                        placeholder="Enter value to compare"
                      />
                    </div>
                  )}
                </>
              )}
              
              {selectedTransformType === 'rename' && (
                <>
                  <div className="space-y-2">
                    <Label>Column to Rename</Label>
                    <Select value={newTransform.column} onValueChange={(v) => setNewTransform({ ...newTransform, column: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>New Name</Label>
                    <Input
                      value={newTransform.newName}
                      onChange={(e) => setNewTransform({ ...newTransform, newName: e.target.value })}
                      placeholder="Enter new column name"
                    />
                  </div>
                </>
              )}
              
              {selectedTransformType === 'cast' && (
                <>
                  <div className="space-y-2">
                    <Label>Column</Label>
                    <Select value={newTransform.column} onValueChange={(v) => setNewTransform({ ...newTransform, column: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>New Type</Label>
                    <Select value={newTransform.newType} onValueChange={(v) => setNewTransform({ ...newTransform, newType: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              {selectedTransformType === 'calculate' && (
                <>
                  <div className="space-y-2">
                    <Label>New Column Name</Label>
                    <Input
                      value={newTransform.newName}
                      onChange={(e) => setNewTransform({ ...newTransform, newName: e.target.value })}
                      placeholder="e.g., profit_margin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Formula</Label>
                    <Input
                      value={newTransform.formula}
                      onChange={(e) => setNewTransform({ ...newTransform, formula: e.target.value })}
                      placeholder="e.g., revenue - cost"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use column names: {columns.slice(0, 3).join(', ')}...
                    </p>
                  </div>
                </>
              )}
              
              {selectedTransformType === 'fill_missing' && (
                <>
                  <div className="space-y-2">
                    <Label>Column</Label>
                    <Select value={newTransform.column} onValueChange={(v) => setNewTransform({ ...newTransform, column: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fill Method</Label>
                    <Select value={newTransform.fillMethod} onValueChange={(v) => setNewTransform({ ...newTransform, fillMethod: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILL_METHODS.map((method) => (
                          <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newTransform.fillMethod === 'value' && (
                    <div className="space-y-2">
                      <Label>Fill Value</Label>
                      <Input
                        value={newTransform.fillValue}
                        onChange={(e) => setNewTransform({ ...newTransform, fillValue: e.target.value })}
                        placeholder="Enter value"
                      />
                    </div>
                  )}
                </>
              )}
              
              {selectedTransformType === 'drop' && (
                <div className="space-y-2">
                  <Label>Column to Drop</Label>
                  <Select value={newTransform.column} onValueChange={(v) => setNewTransform({ ...newTransform, column: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {selectedTransformType === 'sort' && (
                <>
                  <div className="space-y-2">
                    <Label>Column</Label>
                    <Select value={newTransform.column} onValueChange={(v) => setNewTransform({ ...newTransform, column: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Select value={newTransform.sortOrder} onValueChange={(v) => setNewTransform({ ...newTransform, sortOrder: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending (A-Z, 0-9)</SelectItem>
                        <SelectItem value="desc">Descending (Z-A, 9-0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddTransform}
                className="bg-violet-600 hover:bg-violet-700"
                data-testid="confirm-add-transform-btn"
              >
                Add Transformation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default DataTransformPage;
