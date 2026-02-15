import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  Check,
  X,
  AlertCircle,
  Download,
  ArrowRight,
  Settings2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Field mapping options
const TARGET_FIELDS = [
  { value: 'case_id', label: 'Case ID' },
  { value: 'subject_id', label: 'Subject ID' },
  { value: 'subject_name', label: 'Subject Name' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'category', label: 'Category' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'description', label: 'Description' },
  { value: 'location', label: 'Location' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'created_date', label: 'Created Date' },
];

export function CaseImportPage() {
  const { currentOrg } = useOrgStore();
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Review, 4: Complete
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({});
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    updateExisting: false
  });
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const handleFileSelect = useCallback(async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);

    // Get preview from API
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/api/cases/import/preview`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to parse CSV');
      }

      const data = await response.json();
      setPreview(data);
      setFieldMapping(data.field_suggestions || {});
      setStep(2);
    } catch (error) {
      toast.error('Failed to parse CSV file');
      console.error(error);
    }
  }, []);

  const handleImport = async () => {
    if (!file || !currentOrg) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('org_id', currentOrg.id);
    formData.append('field_mapping', JSON.stringify(fieldMapping));
    formData.append('skip_duplicates', importOptions.skipDuplicates);
    formData.append('update_existing', importOptions.updateExisting);

    try {
      const response = await fetch(`${API_URL}/api/cases/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const data = await response.json();
      setImportResults(data.results);
      setStep(4);
      toast.success(`Successfully imported ${data.results.imported} cases`);
    } catch (error) {
      toast.error('Import failed');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `case_id,subject_id,subject_name,status,priority,category,description,location,phone,email
CASE-001,SUBJ-001,John Doe,open,high,Support,Initial case description,New York,+1234567890,john@example.com
CASE-002,SUBJ-002,Jane Smith,in_progress,medium,Inquiry,Follow-up required,Los Angeles,+1987654321,jane@example.com`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'case_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setFieldMapping({});
    setImportResults(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="case-import-page">
        {/* Header */}
        <div>
          <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Import Cases</h1>
          <p className="text-gray-400">Batch import cases from CSV files</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= s ? 'bg-primary text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && (
                <div className={`flex-1 h-1 rounded ${step > s ? 'bg-primary' : 'bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-barlow">Upload CSV File</CardTitle>
              <CardDescription>Select a CSV file containing case data to import</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('csv-upload').click()}
              >
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg text-white mb-2">Drop your CSV file here</p>
                <p className="text-sm text-gray-400 mb-4">or click to browse</p>
                <Button variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Select File
                </Button>
              </div>

              <Separator />

              {/* Template Download */}
              <div className="flex items-center justify-between p-4 bg-card/30 rounded-lg">
                <div>
                  <p className="font-medium text-white">Need a template?</p>
                  <p className="text-sm text-gray-400">Download our CSV template to get started</p>
                </div>
                <Button variant="outline" onClick={downloadTemplate} data-testid="download-template-btn">
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Map Fields */}
        {step === 2 && preview && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-barlow">Map Fields</CardTitle>
              <CardDescription>Match your CSV columns to case fields</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Info */}
              <div className="flex items-center gap-4 p-4 bg-card/30 rounded-lg">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-white">{preview.filename}</p>
                  <p className="text-sm text-gray-400">{preview.total_rows} rows detected</p>
                </div>
              </div>

              {/* Field Mapping */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-white">Field Mapping</h4>
                <div className="grid grid-cols-2 gap-4">
                  {preview.headers.map((header) => (
                    <div key={header} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-400">CSV Column</Label>
                        <p className="font-mono text-sm text-white">{header}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                      <div className="flex-1">
                        <Label className="text-xs text-gray-400">Map To</Label>
                        <Select
                          value={Object.entries(fieldMapping).find(([k, v]) => v === header)?.[0] || ''}
                          onValueChange={(value) => {
                            const newMapping = { ...fieldMapping };
                            // Remove any existing mapping for this target
                            Object.keys(newMapping).forEach(k => {
                              if (newMapping[k] === header) delete newMapping[k];
                            });
                            if (value) newMapping[value] = header;
                            setFieldMapping(newMapping);
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Skip this column</SelectItem>
                            {TARGET_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Data */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-white">Data Preview</h4>
                <div className="overflow-auto max-h-64 rounded border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.headers.map((header) => (
                          <TableHead key={header} className="text-xs">{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample_data.map((row, i) => (
                        <TableRow key={i}>
                          {preview.headers.map((header) => (
                            <TableCell key={header} className="text-xs">{row[header]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Import */}
        {step === 3 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-barlow">Review & Import</CardTitle>
              <CardDescription>Confirm import settings before proceeding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-card/30 rounded-lg">
                  <p className="text-sm text-gray-400">Total Rows</p>
                  <p className="text-2xl font-bold text-white">{preview?.total_rows}</p>
                </div>
                <div className="p-4 bg-card/30 rounded-lg">
                  <p className="text-sm text-gray-400">Mapped Fields</p>
                  <p className="text-2xl font-bold text-white">{Object.keys(fieldMapping).length}</p>
                </div>
                <div className="p-4 bg-card/30 rounded-lg">
                  <p className="text-sm text-gray-400">Organization</p>
                  <p className="text-lg font-bold text-white">{currentOrg?.name}</p>
                </div>
              </div>

              {/* Import Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-white">Import Options</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg">
                    <div>
                      <p className="font-medium text-white">Skip Duplicates</p>
                      <p className="text-xs text-gray-400">Skip cases with existing subject IDs</p>
                    </div>
                    <Switch
                      checked={importOptions.skipDuplicates}
                      onCheckedChange={(checked) => 
                        setImportOptions({ ...importOptions, skipDuplicates: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg">
                    <div>
                      <p className="font-medium text-white">Update Existing</p>
                      <p className="text-xs text-gray-400">Update cases if subject ID exists</p>
                    </div>
                    <Switch
                      checked={importOptions.updateExisting}
                      onCheckedChange={(checked) => 
                        setImportOptions({ ...importOptions, updateExisting: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Field Mapping Summary */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-white">Field Mappings</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(fieldMapping).map(([target, source]) => (
                    <Badge key={target} variant="outline">
                      {source} → {TARGET_FIELDS.find(f => f.value === target)?.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handleImport} disabled={importing} data-testid="start-import-btn">
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Start Import
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === 4 && importResults && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="font-barlow">Import Complete</CardTitle>
              <CardDescription>Your cases have been imported</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Results Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-sm text-green-400">Imported</p>
                  <p className="text-2xl font-bold text-green-500">{importResults.imported}</p>
                </div>
                <div className="p-4 bg-blue-500/10 rounded-lg">
                  <p className="text-sm text-blue-400">Updated</p>
                  <p className="text-2xl font-bold text-blue-500">{importResults.updated}</p>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-sm text-yellow-400">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-500">{importResults.skipped}</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg">
                  <p className="text-sm text-red-400">Errors</p>
                  <p className="text-2xl font-bold text-red-500">{importResults.errors?.length || 0}</p>
                </div>
              </div>

              {/* Success Message */}
              <div className="flex items-center gap-4 p-4 bg-green-500/10 rounded-lg">
                <Check className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-medium text-green-500">Import Successful!</p>
                  <p className="text-sm text-gray-400">
                    {importResults.imported} cases have been added to your organization
                  </p>
                </div>
              </div>

              {/* Errors */}
              {importResults.errors?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Errors</h4>
                  <div className="max-h-32 overflow-auto space-y-1">
                    {importResults.errors.map((err, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-red-500/10 rounded text-sm">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-red-400">Row {err.row}: {err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={resetImport}>
                  Import More Cases
                </Button>
                <Button onClick={() => window.location.href = '/cases'}>
                  View Cases
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
