import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, Reorder } from 'framer-motion';
import {
  Save,
  Play,
  Eye,
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Settings2,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  MapPin,
  Camera,
  Mic,
  Video,
  FileText,
  Calculator,
  AlignLeft,
  Circle,
  Repeat,
  GitBranch,
  ChevronDown,
  ChevronRight,
  History,
  Shield,
  Copy,
  Network,
  ScanLine,
  PenTool
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { SkipLogicEditor, SkipLogicDisplay } from '../components/SkipLogicEditor';
import { CalculatedFieldEditor } from '../components/CalculatedFieldEditor';
import { VersionHistory, VersionComparison, SaveVersionDialog, RestoreVersionDialog } from '../components/FormVersioning';
import { DuplicateRulesConfig, DuplicateReviewPanel } from '../components/DuplicateDetection';
import { FormLogicVisualization } from '../components/FormLogicVisualization';
import { useFormBuilderStore } from '../store';
import { formAPI } from '../lib/api';
import { generateId, cn } from '../lib/utils';
import { toast } from 'sonner';

const fieldTypes = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'select', label: 'Dropdown', icon: List },
  { type: 'radio', label: 'Single Choice', icon: Circle },
  { type: 'checkbox', label: 'Multiple Choice', icon: CheckSquare },
  { type: 'gps', label: 'GPS Location', icon: MapPin },
  { type: 'photo', label: 'Photo', icon: Camera },
  { type: 'audio', label: 'Audio', icon: Mic },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'barcode', label: 'Barcode', icon: ScanLine },
  { type: 'signature', label: 'Signature', icon: PenTool },
  { type: 'note', label: 'Note', icon: FileText },
  { type: 'calculate', label: 'Calculate', icon: Calculator },
  { type: 'group', label: 'Group', icon: Settings2 },
  { type: 'repeat', label: 'Repeat Group', icon: Repeat },
];

const FieldTypeButton = ({ type, label, icon: Icon, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 p-3 rounded-sm border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
    data-testid={`add-field-${type}`}
  >
    <Icon className="w-5 h-5 text-muted-foreground" />
    <span className="text-xs">{label}</span>
  </button>
);

const FieldEditor = ({ field, allFields, onChange, onClose }) => {
  const [localField, setLocalField] = useState(field);
  const [options, setOptions] = useState(field.options || []);
  const [activeTab, setActiveTab] = useState('basic');
  const [skipLogicOpen, setSkipLogicOpen] = useState(!!field.skip_logic);
  const [calculationOpen, setCalculationOpen] = useState(!!field.calculation);

  // Get other fields for skip logic references
  const otherFields = allFields.filter(f => f.id !== field.id);

  const handleSave = () => {
    const savedField = { 
      ...localField, 
      options,
    };
    onChange(savedField);
    onClose();
  };

  const addOption = () => {
    setOptions([...options, { value: `option_${options.length + 1}`, label: '', label_sw: '' }]);
  };

  const updateOption = (index, key, value) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    setOptions(newOptions);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const hasOptions = ['select', 'radio', 'checkbox', 'multiselect'].includes(field.type);
  const isCalculate = field.type === 'calculate';

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[600px]">
        <SheetHeader>
          <SheetTitle className="font-barlow text-white">Edit Field</SheetTitle>
          <SheetDescription>Configure field properties and logic</SheetDescription>
        </SheetHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="logic">Logic</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-280px)] mt-4">
            <div className="pr-4 space-y-6">
              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Field Name (ID)</Label>
                  <Input
                    value={localField.name}
                    onChange={(e) => setLocalField({ ...localField, name: e.target.value })}
                    placeholder="field_name"
                    data-testid="field-name-input"
                  />
                  <p className="text-xs text-gray-500">Used in formulas and exports</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Label (English)</Label>
                  <Input
                    value={localField.label}
                    onChange={(e) => setLocalField({ ...localField, label: e.target.value })}
                    placeholder="Question text"
                    data-testid="field-label-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Label (Swahili)</Label>
                  <Input
                    value={localField.label_sw || ''}
                    onChange={(e) => setLocalField({ ...localField, label_sw: e.target.value })}
                    placeholder="Swali kwa Kiswahili"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Hint</Label>
                  <Textarea
                    value={localField.hint || ''}
                    onChange={(e) => setLocalField({ ...localField, hint: e.target.value })}
                    placeholder="Additional instructions for enumerators"
                    rows={2}
                  />
                </div>

                {/* Options for select/radio/checkbox */}
                {hasOptions && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Options</Label>
                        <Button variant="outline" size="sm" onClick={addOption}>
                          <Plus className="w-3 h-3 mr-1" />
                          Add Option
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {options.map((option, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={option.value}
                              onChange={(e) => updateOption(idx, 'value', e.target.value)}
                              placeholder="Value"
                              className="w-24"
                            />
                            <Input
                              value={option.label}
                              onChange={(e) => updateOption(idx, 'label', e.target.value)}
                              placeholder="English"
                              className="flex-1"
                            />
                            <Input
                              value={option.label_sw || ''}
                              onChange={(e) => updateOption(idx, 'label_sw', e.target.value)}
                              placeholder="Swahili"
                              className="flex-1"
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {options.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No options yet. Click &quot;Add Option&quot; to create choices.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Calculation formula for calculate fields */}
                {isCalculate && (
                  <>
                    <Separator />
                    <CalculatedFieldEditor
                      value={localField.calculation || ''}
                      onChange={(formula) => setLocalField({ ...localField, calculation: formula })}
                      fields={otherFields}
                      fieldName={localField.name}
                    />
                  </>
                )}
              </TabsContent>

              {/* Validation Tab */}
              <TabsContent value="validation" className="space-y-4 mt-0">
                <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                  <div>
                    <Label htmlFor="required" className="font-medium">Required</Label>
                    <p className="text-xs text-gray-500">User must answer this question</p>
                  </div>
                  <Switch
                    id="required"
                    checked={localField.validation?.required || false}
                    onCheckedChange={(checked) => 
                      setLocalField({
                        ...localField,
                        validation: { ...localField.validation, required: checked }
                      })
                    }
                  />
                </div>

                {(field.type === 'text' || field.type === 'textarea') && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Min Length</Label>
                        <Input
                          type="number"
                          value={localField.validation?.min_length || ''}
                          onChange={(e) => 
                            setLocalField({
                              ...localField,
                              validation: { ...localField.validation, min_length: parseInt(e.target.value) || null }
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Length</Label>
                        <Input
                          type="number"
                          value={localField.validation?.max_length || ''}
                          onChange={(e) => 
                            setLocalField({
                              ...localField,
                              validation: { ...localField.validation, max_length: parseInt(e.target.value) || null }
                            })
                          }
                          placeholder="No limit"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Pattern (Regex)</Label>
                      <Input
                        value={localField.validation?.pattern || ''}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            validation: { ...localField.validation, pattern: e.target.value }
                          })
                        }
                        placeholder="e.g., ^[A-Z]{2}[0-9]{4}$"
                      />
                      <p className="text-xs text-gray-500">Regular expression for validation</p>
                    </div>
                  </>
                )}

                {field.type === 'number' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input
                        type="number"
                        value={localField.validation?.min_value || ''}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            validation: { ...localField.validation, min_value: parseFloat(e.target.value) || null }
                          })
                        }
                        placeholder="No min"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input
                        type="number"
                        value={localField.validation?.max_value || ''}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            validation: { ...localField.validation, max_value: parseFloat(e.target.value) || null }
                          })
                        }
                        placeholder="No max"
                      />
                    </div>
                  </div>
                )}

                {field.type === 'gps' && (
                  <div className="space-y-2">
                    <Label>Minimum Accuracy (meters)</Label>
                    <Input
                      type="number"
                      value={localField.validation?.min_accuracy || 50}
                      onChange={(e) => 
                        setLocalField({
                          ...localField,
                          validation: { ...localField.validation, min_accuracy: parseFloat(e.target.value) || 50 }
                        })
                      }
                      placeholder="50"
                    />
                    <p className="text-xs text-gray-500">GPS reading must be within this accuracy</p>
                  </div>
                )}

                {(field.type === 'checkbox' || field.type === 'multiselect') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Selections</Label>
                      <Input
                        type="number"
                        value={localField.validation?.min_selections || ''}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            validation: { ...localField.validation, min_selections: parseInt(e.target.value) || null }
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Selections</Label>
                      <Input
                        type="number"
                        value={localField.validation?.max_selections || ''}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            validation: { ...localField.validation, max_selections: parseInt(e.target.value) || null }
                          })
                        }
                        placeholder="No limit"
                      />
                    </div>
                  </div>
                )}

                {field.type === 'barcode' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Accepted Barcode Formats</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'].map((format) => (
                          <div key={format} className="flex items-center space-x-2">
                            <Checkbox
                              id={`format-${format}`}
                              checked={(localField.validation?.accepted_formats || ['ean_13', 'qr_code']).includes(format)}
                              onCheckedChange={(checked) => {
                                const current = localField.validation?.accepted_formats || ['ean_13', 'qr_code'];
                                const newFormats = checked
                                  ? [...current, format]
                                  : current.filter(f => f !== format);
                                setLocalField({
                                  ...localField,
                                  validation: { ...localField.validation, accepted_formats: newFormats }
                                });
                              }}
                            />
                            <Label htmlFor={`format-${format}`} className="text-sm cursor-pointer">
                              {format.replace('_', '-').toUpperCase()}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Barcode Pattern (Regex)</Label>
                      <Input
                        value={localField.validation?.barcode_pattern || ''}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            validation: { ...localField.validation, barcode_pattern: e.target.value }
                          })
                        }
                        placeholder="e.g., ^[0-9]{13}$"
                      />
                      <p className="text-xs text-gray-500">Validate barcode format with regex</p>
                    </div>
                  </div>
                )}

                {field.type === 'signature' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Stroke Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={localField.settings?.stroke_color || '#000000'}
                          onChange={(e) => 
                            setLocalField({
                              ...localField,
                              settings: { ...localField.settings, stroke_color: e.target.value }
                            })
                          }
                          className="w-16 h-10 p-1"
                        />
                        <Input
                          value={localField.settings?.stroke_color || '#000000'}
                          onChange={(e) => 
                            setLocalField({
                              ...localField,
                              settings: { ...localField.settings, stroke_color: e.target.value }
                            })
                          }
                          placeholder="#000000"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Stroke Width (px)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={localField.settings?.stroke_width || 2}
                        onChange={(e) => 
                          setLocalField({
                            ...localField,
                            settings: { ...localField.settings, stroke_width: parseInt(e.target.value) || 2 }
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Logic Tab */}
              <TabsContent value="logic" className="space-y-4 mt-0">
                {/* Skip Logic Section */}
                <Collapsible open={skipLogicOpen} onOpenChange={setSkipLogicOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-primary" />
                        <div className="text-left">
                          <p className="font-medium text-white">Skip Logic</p>
                          <p className="text-xs text-gray-500">Control when this field is shown</p>
                        </div>
                      </div>
                      {skipLogicOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <SkipLogicEditor
                      value={localField.skip_logic}
                      onChange={(logic) => setLocalField({ ...localField, skip_logic: logic })}
                      fields={otherFields}
                      currentFieldId={field.id}
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Quick Reference */}
                <div className="p-4 bg-card/30 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-white">Available Field References</h4>
                  <div className="flex flex-wrap gap-1">
                    {otherFields.slice(0, 10).map((f) => (
                      <Badge key={f.id} variant="outline" className="text-xs">
                        {f.name}
                      </Badge>
                    ))}
                    {otherFields.length > 10 && (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        +{otherFields.length - 10} more
                      </Badge>
                    )}
                  </div>
                  {otherFields.length === 0 && (
                    <p className="text-xs text-gray-500">Add more fields to reference them in logic</p>
                  )}
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        <div className="flex gap-2 pt-4 border-t border-border mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} data-testid="save-field-btn">
            Save Field
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const FieldRow = ({ field, allFields, onEdit, onRemove }) => {
  const Icon = fieldTypes.find(f => f.type === field.type)?.icon || Type;
  const hasSkipLogic = field.skip_logic?.conditions?.length > 0;
  const hasCalculation = field.type === 'calculate' && field.calculation;

  return (
    <motion.div
      className="flex items-center gap-3 p-4 bg-card/50 border border-border/50 rounded-sm hover:border-primary/50 transition-all group"
      layout
    >
      <div className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate text-white">{field.label || field.name}</p>
          {hasSkipLogic && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-500 border-blue-500/30">
              <GitBranch className="w-2 h-2 mr-1" />
              Logic
            </Badge>
          )}
          {hasCalculation && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-500/10 text-purple-500 border-purple-500/30">
              <Calculator className="w-2 h-2 mr-1" />
              Calc
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{field.type} • {field.name}</p>
        {hasSkipLogic && (
          <div className="mt-1">
            <SkipLogicDisplay logic={field.skip_logic} fields={allFields} />
          </div>
        )}
      </div>
      {field.validation?.required && (
        <span className="text-xs text-red-500">Required</span>
      )}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" onClick={() => onEdit(field)} data-testid={`edit-field-${field.id}`}>
          <Settings2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onRemove(field.id)} data-testid={`remove-field-${field.id}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export function FormBuilderPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const {
    currentForm,
    fields,
    isDirty,
    setForm,
    setFields,
    addField,
    updateField,
    removeField,
    markClean
  } = useFormBuilderStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionComparison, setShowVersionComparison] = useState(false);
  const [showSaveVersion, setShowSaveVersion] = useState(false);
  const [showDuplicateRules, setShowDuplicateRules] = useState(false);
  const [showLogicVisualization, setShowLogicVisualization] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const response = await formAPI.get(formId);
      setForm(response.data);
      setFormName(response.data.name);
      setFormDescription(response.data.description || '');
    } catch (error) {
      toast.error('Failed to load form');
      navigate('/forms');
    } finally {
      setLoading(false);
    }
  }, [formId, navigate, setForm]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const handleAddField = (type) => {
    const newField = {
      id: generateId(),
      type,
      name: `field_${fields.length + 1}`,
      label: '',
      label_sw: '',
      hint: '',
      options: [],
      validation: { required: false },
      skip_logic: null,
      calculation: type === 'calculate' ? '' : null,
      order: fields.length
    };
    addField(newField);
    setEditingField(newField);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await formAPI.update(formId, {
        name: formName,
        description: formDescription,
        project_id: currentForm.project_id,
        fields,
        default_language: currentForm.default_language || 'en',
        languages: currentForm.languages || ['en', 'sw']
      });
      markClean();
      toast.success('Form saved');
    } catch (error) {
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (fields.length === 0) {
      toast.error('Add at least one field before publishing');
      return;
    }
    try {
      await handleSave();
      await formAPI.publish(formId);
      toast.success('Form published!');
      navigate('/forms');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to publish');
    }
  };

  const handleFieldUpdate = (updatedField) => {
    updateField(updatedField.id, updatedField);
  };

  const handleReorder = (newOrder) => {
    const reorderedFields = newOrder.map((field, index) => ({
      ...field,
      order: index
    }));
    setFields(reorderedFields);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading form...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="form-builder-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/forms')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="font-barlow text-2xl font-bold border-0 border-b border-transparent hover:border-border focus:border-primary bg-transparent px-0 h-auto text-white"
                placeholder="Form Name"
                data-testid="form-title-input"
              />
              <p className="text-sm text-gray-400 mt-1">
                {currentForm?.status} • v{currentForm?.version}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* More Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowVersionHistory(true)}>
                  <History className="w-4 h-4 mr-2" />
                  Version History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowVersionComparison(true)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Compare Versions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSaveVersion(true)}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Version
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDuplicateRules(true)}>
                  <Shield className="w-4 h-4 mr-2" />
                  Duplicate Detection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowLogicVisualization(true)}>
                  <Network className="w-4 h-4 mr-2" />
                  Logic Visualization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => navigate(`/forms/${formId}/preview`)}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving || !isDirty} data-testid="save-form-btn">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button onClick={handlePublish} data-testid="publish-form-btn">
              <Play className="w-4 h-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Field Types Palette */}
          <Card className="bg-card border border-border">
            <CardHeader>
              <CardTitle className="font-barlow text-lg text-white">Add Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {fieldTypes.map((ft) => (
                  <FieldTypeButton
                    key={ft.type}
                    type={ft.type}
                    label={ft.label}
                    icon={ft.icon}
                    onClick={() => handleAddField(ft.type)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Form Canvas */}
          <div className="lg:col-span-3">
            <Card className="bg-card border border-border min-h-[60vh]">
              <CardHeader className="border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-barlow text-lg text-white">Form Fields</CardTitle>
                  <span className="text-sm text-muted-foreground">{fields.length} fields</span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-barlow text-lg font-semibold mb-2 text-white">No fields yet</h3>
                    <p className="text-muted-foreground max-w-md">
                      Click on field types on the left to add questions to your form
                    </p>
                  </div>
                ) : (
                  <Reorder.Group axis="y" values={fields} onReorder={handleReorder} className="space-y-2">
                    {fields.map((field) => (
                      <Reorder.Item key={field.id} value={field}>
                        <FieldRow
                          field={field}
                          allFields={fields}
                          onEdit={setEditingField}
                          onRemove={removeField}
                        />
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Field Editor Sheet */}
        {editingField && (
          <FieldEditor
            field={editingField}
            allFields={fields}
            onChange={handleFieldUpdate}
            onClose={() => setEditingField(null)}
          />
        )}

        {/* Version History Sheet */}
        {showVersionHistory && (
          <Sheet open={showVersionHistory} onOpenChange={setShowVersionHistory}>
            <SheetContent className="w-[400px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Version History
                </SheetTitle>
                <SheetDescription>View and restore previous versions</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <VersionHistory
                  formId={formId}
                  currentVersion={currentForm?.version}
                  onSelectVersion={(v) => setSelectedVersion(v)}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Version Comparison */}
        {showVersionComparison && (
          <Sheet open={showVersionComparison} onOpenChange={setShowVersionComparison}>
            <SheetContent className="w-[600px] sm:max-w-[600px]">
              <SheetHeader>
                <SheetTitle>Compare Versions</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <VersionComparison formId={formId} />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Save Version Dialog */}
        {showSaveVersion && (
          <SaveVersionDialog
            formId={formId}
            onSave={() => {
              setShowSaveVersion(false);
              loadForm();
            }}
            onClose={() => setShowSaveVersion(false)}
          />
        )}

        {/* Restore Version Dialog */}
        {selectedVersion && (
          <RestoreVersionDialog
            formId={formId}
            version={selectedVersion}
            onRestore={() => {
              setSelectedVersion(null);
              setShowVersionHistory(false);
              loadForm();
            }}
            onClose={() => setSelectedVersion(null)}
          />
        )}

        {/* Duplicate Detection Rules */}
        {showDuplicateRules && (
          <DuplicateRulesConfig
            formId={formId}
            fields={fields}
            onClose={() => setShowDuplicateRules(false)}
          />
        )}

        {/* Form Logic Visualization */}
        <FormLogicVisualization
          form={{ name: formName, fields }}
          open={showLogicVisualization}
          onClose={() => setShowLogicVisualization(false)}
        />
      </div>
    </DashboardLayout>
  );
}
