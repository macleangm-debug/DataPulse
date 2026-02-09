import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Smartphone,
  Monitor,
  Globe,
  Check,
  X,
  MapPin,
  Camera,
  Mic,
  Video,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ScanLine,
  PenTool
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { GpsCapture } from '../components/GpsCapture';
import { AudioRecorder } from '../components/AudioRecorder';
import { VideoRecorder } from '../components/VideoRecorder';
import { BarcodeCapture } from '../components/BarcodeCapture';
import { SignatureCapture } from '../components/SignatureCapture';
import { formAPI } from '../lib/api';
import { toast } from 'sonner';

// Field renderers for different field types
const FieldRenderer = ({ field, value, onChange, language, errors }) => {
  const label = field.labels?.[language] || field.labels?.en || field.name;
  const hint = field.hints?.[language] || field.hints?.en || '';
  const hasError = errors?.[field.id];

  const commonProps = {
    id: field.id,
    disabled: field.readonly,
    className: hasError ? 'border-red-500' : ''
  };

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            {...commonProps}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || ''}
          />
        );

      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      case 'date':
        return (
          <div className="relative">
            <Input
              {...commonProps}
              type="date"
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
            rows={4}
            placeholder={field.placeholder || ''}
          />
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={(v) => onChange(field.id, v)}>
            <SelectTrigger {...commonProps}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.labels?.[language] || opt.labels?.en || opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup value={value || ''} onValueChange={(v) => onChange(field.id, v)}>
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                <Label htmlFor={`${field.id}-${opt.value}`} className="text-gray-300 cursor-pointer">
                  {opt.labels?.[language] || opt.labels?.en || opt.value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        const checkboxValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${opt.value}`}
                  checked={checkboxValues.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const newValue = checked
                      ? [...checkboxValues, opt.value]
                      : checkboxValues.filter((v) => v !== opt.value);
                    onChange(field.id, newValue);
                  }}
                />
                <Label htmlFor={`${field.id}-${opt.value}`} className="text-gray-300 cursor-pointer">
                  {opt.labels?.[language] || opt.labels?.en || opt.value}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'gps':
        return (
          <GpsCapture
            value={value}
            onChange={(gpsData) => onChange(field.id, gpsData)}
            required={field.required}
            minAccuracy={field.validation?.min_accuracy || 50}
            label={label}
          />
        );

      case 'photo':
        return (
          <div className="space-y-2">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Camera className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-400 mb-2">Take or upload a photo</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                id={`photo-${field.id}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onChange(field.id, { file, preview: URL.createObjectURL(file) });
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(`photo-${field.id}`).click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Capture
              </Button>
            </div>
            {value?.preview && (
              <img src={value.preview} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
            )}
          </div>
        );

      case 'audio':
        return (
          <AudioRecorder
            value={value}
            onChange={(audioData) => onChange(field.id, audioData)}
            required={field.required}
            maxDuration={field.validation?.max_duration || 300}
            label={label}
          />
        );

      case 'video':
        return (
          <VideoRecorder
            value={value}
            onChange={(videoData) => onChange(field.id, videoData)}
            required={field.required}
            maxDuration={field.validation?.max_duration || 120}
            label={label}
          />
        );

      case 'note':
        return (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-blue-400">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            {field.content || hint}
          </div>
        );

      case 'barcode':
        return (
          <BarcodeCapture
            value={value}
            onChange={(barcodeValue) => onChange(field.id, barcodeValue)}
            label={label}
            required={field.required}
            disabled={field.readonly}
            acceptedFormats={field.validation?.accepted_formats || ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']}
          />
        );

      case 'signature':
        return (
          <SignatureCapture
            value={value}
            onChange={(signatureData) => onChange(field.id, signatureData)}
            label={label}
            required={field.required}
            disabled={field.readonly}
            strokeColor={field.settings?.stroke_color || '#000000'}
            strokeWidth={field.settings?.stroke_width || 2}
          />
        );

      default:
        return (
          <Input
            {...commonProps}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
        );
    }
  };

  // Skip rendering for hidden fields
  if (field.type === 'calculate' || field.type === 'hidden') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {field.type !== 'note' && (
        <Label htmlFor={field.id} className="text-white flex items-center gap-2">
          {label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      {hint && field.type !== 'note' && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
      
      {renderField()}
      
      {hasError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X className="w-3 h-3" />
          {hasError}
        </p>
      )}
    </motion.div>
  );
};

// Group renderer for nested fields
const GroupRenderer = ({ field, values, onChange, language, errors }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const label = field.labels?.[language] || field.labels?.en || field.name;

  return (
    <Card className="border-border/50">
      <CardHeader 
        className="cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white">{label}</CardTitle>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {field.children?.map((childField) => (
            <FieldRenderer
              key={childField.id}
              field={childField}
              value={values[childField.id]}
              onChange={onChange}
              language={language}
              errors={errors}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
};

export function FormPreviewPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('en');
  const [deviceMode, setDeviceMode] = useState('mobile'); // 'mobile' | 'desktop'
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    setLoading(true);
    try {
      const response = await formAPI.get(formId);
      setForm(response.data);
    } catch (error) {
      toast.error('Failed to load form');
      navigate('/forms');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error when field is changed
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    const validateField = (field) => {
      const value = values[field.id];
      
      if (field.required && !value) {
        newErrors[field.id] = 'This field is required';
      }
      
      if (field.validation) {
        if (field.validation.min !== undefined && Number(value) < field.validation.min) {
          newErrors[field.id] = `Minimum value is ${field.validation.min}`;
        }
        if (field.validation.max !== undefined && Number(value) > field.validation.max) {
          newErrors[field.id] = `Maximum value is ${field.validation.max}`;
        }
        if (field.validation.pattern && value && !new RegExp(field.validation.pattern).test(value)) {
          newErrors[field.id] = field.validation.message || 'Invalid format';
        }
      }
      
      // Validate children for groups
      if (field.children) {
        field.children.forEach(validateField);
      }
    };
    
    form?.fields?.forEach(validateField);
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    setIsSubmitting(true);
    // Simulate submission
    setTimeout(() => {
      toast.success('Form preview submitted successfully! (Test mode - not saved)');
      setIsSubmitting(false);
    }, 1000);
  };

  const handleReset = () => {
    setValues({});
    setErrors({});
    toast.info('Form reset');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="form-preview-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/forms/${formId}/edit`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-barlow text-2xl font-bold tracking-tight text-white">
                Preview: {form?.name}
              </h1>
              <p className="text-sm text-gray-400">
                Test your form before publishing • v{form?.version}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1">
              <Button
                size="sm"
                variant={language === 'en' ? 'default' : 'ghost'}
                onClick={() => setLanguage('en')}
              >
                <Globe className="w-4 h-4 mr-1" />
                EN
              </Button>
              <Button
                size="sm"
                variant={language === 'sw' ? 'default' : 'ghost'}
                onClick={() => setLanguage('sw')}
              >
                SW
              </Button>
            </div>
            
            {/* Device Toggle */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1">
              <Button
                size="sm"
                variant={deviceMode === 'mobile' ? 'default' : 'ghost'}
                onClick={() => setDeviceMode('mobile')}
              >
                <Smartphone className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={deviceMode === 'desktop' ? 'default' : 'ghost'}
                onClick={() => setDeviceMode('desktop')}
              >
                <Monitor className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Container */}
        <div className={`mx-auto transition-all duration-300 ${
          deviceMode === 'mobile' ? 'max-w-md' : 'max-w-3xl'
        }`}>
          {/* Device Frame (Mobile) */}
          <div className={deviceMode === 'mobile' ? 'border-4 border-gray-700 rounded-[2rem] p-2 bg-gray-900' : ''}>
            {deviceMode === 'mobile' && (
              <div className="h-6 flex items-center justify-center">
                <div className="w-20 h-1 bg-gray-700 rounded-full" />
              </div>
            )}
            
            <Card className={deviceMode === 'mobile' ? 'rounded-2xl' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">{form?.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {form?.description || 'Complete all required fields'}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                    Preview Mode
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {form?.fields?.map((field) => {
                  if (field.type === 'group') {
                    return (
                      <GroupRenderer
                        key={field.id}
                        field={field}
                        values={values}
                        onChange={handleFieldChange}
                        language={language}
                        errors={errors}
                      />
                    );
                  }
                  return (
                    <FieldRenderer
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      onChange={handleFieldChange}
                      language={language}
                      errors={errors}
                    />
                  );
                })}
                
                {(!form?.fields || form.fields.length === 0) && (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No fields added to this form yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigate(`/forms/${formId}/edit`)}
                    >
                      Add Fields
                    </Button>
                  </div>
                )}
                
                <Separator />
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>Submitting...</>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Test Submit
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
                
                {Object.keys(errors).length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">
                      <X className="w-4 h-4 inline mr-1" />
                      {Object.keys(errors).length} error(s) found. Please review the form.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Debug Panel */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-white text-sm">Form Data (Debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-gray-400 overflow-auto max-h-40 bg-black/50 p-3 rounded">
              {JSON.stringify(values, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
