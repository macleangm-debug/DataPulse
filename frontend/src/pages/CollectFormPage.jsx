/**
 * Mobile Form Collection Page
 * Shared by both authenticated and token-based collection
 * Simple, mobile-optimized form filling experience
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  Camera,
  MapPin,
  Mic,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Field Renderer Component
const FieldRenderer = ({ field, value, onChange, error }) => {
  const fieldType = field.type?.toLowerCase() || 'text';

  switch (fieldType) {
    case 'text':
    case 'string':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label}`}
          className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white"
        />
      );

    case 'number':
    case 'integer':
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || '0'}
          className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white"
        />
      );

    case 'textarea':
    case 'note':
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || 'Enter your response...'}
          rows={4}
          className="text-lg bg-slate-700/50 border-slate-600 text-white"
        />
      );

    case 'select':
    case 'select_one':
    case 'dropdown':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            {(field.options || field.choices || []).map((opt, idx) => (
              <SelectItem 
                key={idx} 
                value={typeof opt === 'string' ? opt : opt.value}
                className="text-white"
              >
                {typeof opt === 'string' ? opt : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'radio':
    case 'select_one_radio':
      return (
        <RadioGroup value={value || ''} onValueChange={onChange} className="space-y-3">
          {(field.options || field.choices || []).map((opt, idx) => {
            const optValue = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            return (
              <div key={idx} className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                <RadioGroupItem value={optValue} id={`${field.name}-${idx}`} className="border-slate-500" />
                <Label htmlFor={`${field.name}-${idx}`} className="text-white text-lg cursor-pointer flex-1">
                  {optLabel}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      );

    case 'checkbox':
    case 'select_multiple':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-3">
          {(field.options || field.choices || []).map((opt, idx) => {
            const optValue = typeof opt === 'string' ? opt : opt.value;
            const optLabel = typeof opt === 'string' ? opt : opt.label;
            const isChecked = selectedValues.includes(optValue);
            return (
              <div key={idx} className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                <Checkbox
                  id={`${field.name}-${idx}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, optValue]);
                    } else {
                      onChange(selectedValues.filter(v => v !== optValue));
                    }
                  }}
                  className="border-slate-500"
                />
                <Label htmlFor={`${field.name}-${idx}`} className="text-white text-lg cursor-pointer flex-1">
                  {optLabel}
                </Label>
              </div>
            );
          })}
        </div>
      );

    case 'date':
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white"
        />
      );

    case 'time':
      return (
        <Input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white"
        />
      );

    case 'gps':
    case 'geopoint':
      return (
        <Button
          type="button"
          variant="outline"
          className="w-full h-14 text-lg border-slate-600 text-white"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  onChange({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                  });
                  toast.success('Location captured');
                },
                (err) => toast.error('Could not get location')
              );
            }
          }}
        >
          <MapPin className="w-5 h-5 mr-2" />
          {value ? `${value.lat?.toFixed(4)}, ${value.lng?.toFixed(4)}` : 'Capture Location'}
        </Button>
      );

    default:
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label}`}
          className="h-14 text-lg bg-slate-700/50 border-slate-600 text-white"
        />
      );
  }
};

// Main Form Collection Component
export default function CollectFormPage() {
  const { token, formId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState({});
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [startTime] = useState(new Date().toISOString());

  // Determine if token-based or authenticated
  const isTokenBased = !!token;
  const authToken = !isTokenBased ? localStorage.getItem('collect_token') : null;

  // Online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load form
  useEffect(() => {
    loadForm();
  }, [formId, token]);

  const loadForm = async () => {
    setLoading(true);
    try {
      let url;
      if (isTokenBased) {
        url = `${API_URL}/api/collect/token/${token}/form/${formId}`;
      } else {
        url = `${API_URL}/api/forms/${formId}`;
      }

      const headers = {};
      if (!isTokenBased && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Form not found');

      const data = await res.json();
      setForm(data);
    } catch (err) {
      toast.error('Failed to load form');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  // Get current field
  const fields = form?.fields || [];
  const currentField = fields[currentFieldIndex];
  const progress = fields.length > 0 ? ((currentFieldIndex + 1) / fields.length) * 100 : 0;

  // Handle response change
  const handleChange = (value) => {
    setResponses(prev => ({
      ...prev,
      [currentField.name || currentField.id]: value
    }));
    // Clear error when value changes
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[currentField.name || currentField.id];
      return newErrors;
    });
  };

  // Validate current field
  const validateField = () => {
    const fieldKey = currentField.name || currentField.id;
    const value = responses[fieldKey];
    
    if (currentField.required && !value) {
      setErrors(prev => ({ ...prev, [fieldKey]: 'This field is required' }));
      return false;
    }
    return true;
  };

  // Navigate to next field
  const handleNext = () => {
    if (validateField()) {
      if (currentFieldIndex < fields.length - 1) {
        setCurrentFieldIndex(prev => prev + 1);
      }
    }
  };

  // Navigate to previous field
  const handlePrevious = () => {
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(prev => prev - 1);
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateField()) return;

    setSubmitting(true);
    const submission = {
      form_id: formId,
      responses,
      device_info: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      },
      started_at: startTime,
      completed_at: new Date().toISOString(),
      offline_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Try GPS capture
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        submission.gps_location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      } catch (e) {
        // GPS not available
      }
    }

    if (isOnline) {
      try {
        let url, options;
        if (isTokenBased) {
          url = `${API_URL}/api/collect/token/${token}/submit`;
          options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission)
          };
        } else {
          url = `${API_URL}/api/collect/submit?authorization=Bearer ${authToken}`;
          options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission)
          };
        }

        const res = await fetch(url, options);
        const data = await res.json();

        if (data.success) {
          toast.success('Submission saved!');
          navigate(isTokenBased ? `/collect/${token}` : '/collect');
        } else {
          throw new Error(data.message || 'Submission failed');
        }
      } catch (err) {
        // Save offline
        saveOffline(submission);
      }
    } else {
      saveOffline(submission);
    }

    setSubmitting(false);
  };

  // Save for offline sync
  const saveOffline = (submission) => {
    const storageKey = isTokenBased 
      ? `token_collect_pending_${token}`
      : 'collect_pending';
    
    const pending = JSON.parse(localStorage.getItem(storageKey) || '[]');
    pending.push(submission);
    localStorage.setItem(storageKey, JSON.stringify(pending));
    
    toast.success('Saved offline. Will sync when online.');
    navigate(isTokenBased ? `/collect/${token}` : '/collect');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isLastField = currentFieldIndex === fields.length - 1;
  const fieldKey = currentField?.name || currentField?.id;
  const currentValue = responses[fieldKey];
  const currentError = errors[fieldKey];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-slate-400"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </Button>
            <Badge variant="outline" className={isOnline ? 'border-emerald-500/50 text-emerald-400' : 'border-amber-500/50 text-amber-400'}>
              {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <h1 className="text-lg font-semibold text-white truncate">{form?.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={progress} className="flex-1 h-2" />
            <span className="text-sm text-slate-400">{currentFieldIndex + 1}/{fields.length}</span>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 p-4">
        {currentField && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-xl text-white flex items-start gap-2">
                {currentField.label || currentField.name}
                {currentField.required && <span className="text-red-400">*</span>}
              </CardTitle>
              {currentField.hint && (
                <p className="text-sm text-slate-400 mt-1">{currentField.hint}</p>
              )}
            </CardHeader>
            <CardContent>
              <FieldRenderer
                field={currentField}
                value={currentValue}
                onChange={handleChange}
                error={currentError}
              />
              {currentError && (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {currentError}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Navigation Footer */}
      <footer className="sticky bottom-0 bg-slate-900/90 backdrop-blur-lg border-t border-slate-700 p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-14 text-lg border-slate-600"
            onClick={handlePrevious}
            disabled={currentFieldIndex === 0}
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Previous
          </Button>
          
          {isLastField ? (
            <Button
              className="flex-1 h-14 text-lg bg-gradient-to-r from-emerald-500 to-teal-600"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Send className="w-5 h-5 mr-2" />
              )}
              Submit
            </Button>
          ) : (
            <Button
              className="flex-1 h-14 text-lg bg-gradient-to-r from-blue-500 to-indigo-600"
              onClick={handleNext}
            >
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
