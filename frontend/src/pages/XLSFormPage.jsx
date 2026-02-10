/**
 * XLSForm Import/Export Page
 * Enables migration from SurveyCTO and other ODK-compatible platforms
 */

import React, { useState, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FileDown,
  ArrowRight,
  Info
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function XLSFormPage() {
  const { currentOrg } = useOrgStore();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedForm, setSelectedForm] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load projects on mount
  React.useEffect(() => {
    if (currentOrg?.id) {
      loadProjects();
      loadForms();
    }
  }, [currentOrg?.id]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch(`${API_URL}/api/projects?org_id=${currentOrg.id}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadForms = async () => {
    setLoadingForms(true);
    try {
      const response = await fetch(`${API_URL}/api/forms?org_id=${currentOrg.id}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setForms(data);
      }
    } catch (error) {
      console.error('Failed to load forms:', error);
    } finally {
      setLoadingForms(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Please select an Excel file (.xlsx or .xls)');
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedProject && selectedProject !== '__none__') {
        formData.append('project_id', selectedProject);
      }

      const response = await fetch(`${API_URL}/api/xlsform/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        toast.success(`Form "${result.form_name}" imported successfully!`);
        loadForms(); // Refresh forms list
      } else {
        toast.error('Import failed: ' + (result.errors?.[0] || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Import failed: ' + error.message);
      setImportResult({ success: false, errors: [error.message] });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (formId) => {
    setExporting(true);
    try {
      const response = await fetch(`${API_URL}/api/xlsform/export/${formId}`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form_xlsform.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Form exported as XLSForm!');
    } catch (error) {
      toast.error('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/api/xlsform/template`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'xlsform_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Template downloaded!');
    } catch (error) {
      toast.error('Download failed: ' + error.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">XLSForm Import/Export</h1>
          <p className="text-slate-400 mt-1">
            Import forms from SurveyCTO, ODK, or other XLSForm-compatible platforms
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Import Card */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-400" />
                Import XLSForm
              </CardTitle>
              <CardDescription>
                Upload an Excel file (.xlsx) with survey, choices, and settings sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="text-slate-300">XLSForm File</Label>
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="xlsform-upload"
                  />
                  <label htmlFor="xlsform-upload" className="cursor-pointer">
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-500 mb-2" />
                    {selectedFile ? (
                      <p className="text-blue-400 font-medium">{selectedFile.name}</p>
                    ) : (
                      <p className="text-slate-400">Click to select XLSForm file</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">Supports .xlsx and .xls files</p>
                  </label>
                </div>
              </div>

              {/* Project Selection */}
              <div className="space-y-2">
                <Label className="text-slate-300">Target Project (Optional)</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select project or leave blank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project (create standalone)</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Import Result */}
              {importResult && (
                <Alert className={importResult.success ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}>
                  {importResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  )}
                  <AlertDescription className={importResult.success ? 'text-green-300' : 'text-red-300'}>
                    {importResult.success ? (
                      <>
                        <strong>{importResult.form_name}</strong> imported with {importResult.field_count} fields
                        {importResult.warnings?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-yellow-400 text-sm">Warnings:</p>
                            <ul className="text-xs list-disc ml-4">
                              {importResult.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p>Import failed:</p>
                        <ul className="text-xs list-disc ml-4 mt-1">
                          {importResult.errors?.map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedFile || importing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Form
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Export Card */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="h-5 w-5 text-green-400" />
                Export to XLSForm
              </CardTitle>
              <CardDescription>
                Export a DataPulse form to XLSForm format for use in other platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Form Selection */}
              <div className="space-y-2">
                <Label className="text-slate-300">Select Form to Export</Label>
                <Select value={selectedForm} onValueChange={setSelectedForm}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select a form" />
                  </SelectTrigger>
                  <SelectContent>
                    {forms.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info Box */}
              <Alert className="bg-slate-700/50 border-slate-600">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-slate-300">
                  <p className="font-medium">Export includes:</p>
                  <ul className="text-sm mt-1 list-disc ml-4">
                    <li>Survey sheet with all questions</li>
                    <li>Choices sheet with select options</li>
                    <li>Settings sheet with form metadata</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Compatible Platforms */}
              <div className="space-y-2">
                <Label className="text-slate-400 text-sm">Compatible with:</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-600 text-slate-300">SurveyCTO</Badge>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">ODK Collect</Badge>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">KoboToolbox</Badge>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">Ona</Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => handleExport(selectedForm)}
                disabled={!selectedForm || exporting}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export as XLSForm
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Migration Guide */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Migration Guide</CardTitle>
            <CardDescription>
              Step-by-step guide to migrate from SurveyCTO or other platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: 1, title: 'Export from Source', desc: 'Download your form as XLSForm (.xlsx) from SurveyCTO or ODK' },
                { step: 2, title: 'Upload to DataPulse', desc: 'Use the import function above to upload your XLSForm' },
                { step: 3, title: 'Review & Adjust', desc: 'Check the imported form and make any necessary adjustments' },
                { step: 4, title: 'Publish & Collect', desc: 'Publish your form and start collecting data' },
              ].map((item, idx) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-white font-medium">{item.title}</p>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                  {idx < 3 && (
                    <ArrowRight className="h-5 w-5 text-slate-500 hidden md:block mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
