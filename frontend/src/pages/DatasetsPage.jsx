import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  Plus,
  Upload,
  Download,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Table2,
  MapPin,
  Building2,
  Users,
  Package,
  Globe,
  Filter,
  Copy,
  ChevronRight,
  Eye,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const DATASET_TYPES = [
  { id: 'sampling_frame', name: 'Sampling Frame', icon: Users, description: 'Population or household sampling lists' },
  { id: 'facility_list', name: 'Facility List', icon: Building2, description: 'Health facilities, clinics, hospitals' },
  { id: 'school_list', name: 'School List', icon: Building2, description: 'Educational institutions' },
  { id: 'location_hierarchy', name: 'Location Hierarchy', icon: MapPin, description: 'Geographic hierarchy (regions, districts)' },
  { id: 'product_list', name: 'Product List', icon: Package, description: 'Products, items, or inventory' },
  { id: 'custom', name: 'Custom Dataset', icon: Table2, description: 'Custom lookup table' },
];

const DatasetCard = ({ dataset, onView, onEdit, onDelete, onDownload }) => {
  const TypeIcon = DATASET_TYPES.find(t => t.id === dataset.dataset_type)?.icon || Database;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TypeIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{dataset.name}</h3>
                <p className="text-sm text-gray-400">{dataset.description || 'No description'}</p>
              </div>
            </div>
            <Badge variant={dataset.is_active ? 'default' : 'secondary'}>
              v{dataset.version}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <Table2 className="w-4 h-4" />
              {dataset.record_count?.toLocaleString() || 0} records
            </span>
            <span className="flex items-center gap-1">
              {dataset.enable_offline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  Offline enabled
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  Online only
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {dataset.searchable_fields?.slice(0, 3).map((field) => (
              <Badge key={field} variant="outline" className="text-xs">
                {field}
              </Badge>
            ))}
            {dataset.searchable_fields?.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{dataset.searchable_fields.length - 3} more
              </Badge>
            )}
          </div>

          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="outline" size="sm" onClick={() => onView(dataset)}>
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDownload(dataset)}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(dataset)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(dataset)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export function DatasetsPage() {
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [datasetRecords, setDatasetRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    dataset_type: 'custom',
    columns: [{ name: 'id', type: 'string', label: 'ID', searchable: true }],
    searchable_fields: ['id'],
    display_field: 'name',
    value_field: 'id',
    enable_offline: true,
    offline_subset_field: ''
  });

  const [uploadData, setUploadData] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      loadDatasets();
    }
  }, [currentOrg?.id]);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/datasets/${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      const data = await response.json();
      setDatasets(data.datasets || []);
    } catch (error) {
      console.error('Failed to load datasets:', error);
      toast.error('Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDataset = async () => {
    if (!createForm.name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/datasets/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...createForm,
          org_id: currentOrg.id
        })
      });

      if (!response.ok) throw new Error('Failed to create dataset');
      
      const result = await response.json();
      toast.success('Dataset created');
      setShowCreateDialog(false);
      setCreateForm({
        name: '',
        description: '',
        dataset_type: 'custom',
        columns: [{ name: 'id', type: 'string', label: 'ID', searchable: true }],
        searchable_fields: ['id'],
        display_field: 'name',
        value_field: 'id',
        enable_offline: true,
        offline_subset_field: ''
      });
      loadDatasets();
    } catch (error) {
      toast.error('Failed to create dataset');
    } finally {
      setSaving(false);
    }
  };

  const handleViewDataset = async (dataset) => {
    setSelectedDataset(dataset);
    setShowViewDialog(true);
    setRecordsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/datasets/${currentOrg.id}/${dataset.id}/records?limit=100`,
        { headers: getAuthHeaders() }
      );
      const data = await response.json();
      setDatasetRecords(data.records || []);
    } catch (error) {
      toast.error('Failed to load records');
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleUploadRecords = async () => {
    if (!uploadData.trim()) {
      toast.error('Please paste CSV or JSON data');
      return;
    }

    setSaving(true);
    try {
      let records = [];
      
      // Try parsing as JSON first
      try {
        records = JSON.parse(uploadData);
        if (!Array.isArray(records)) {
          records = [records];
        }
      } catch {
        // Parse as CSV
        const lines = uploadData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        records = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const record = {};
          headers.forEach((h, i) => {
            record[h] = values[i] || '';
          });
          return record;
        });
      }

      const response = await fetch(
        `${API_URL}/api/datasets/${currentOrg.id}/${selectedDataset.id}/records/bulk`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ records, replace_existing: false })
        }
      );

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      toast.success(result.message);
      setShowUploadDialog(false);
      setUploadData('');
      loadDatasets();
      handleViewDataset(selectedDataset);
    } catch (error) {
      toast.error('Failed to upload records');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDataset = async (dataset) => {
    if (!confirm(`Delete "${dataset.name}"? This cannot be undone.`)) return;

    try {
      await fetch(
        `${API_URL}/api/datasets/${currentOrg.id}/${dataset.id}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      toast.success('Dataset deleted');
      loadDatasets();
    } catch (error) {
      toast.error('Failed to delete dataset');
    }
  };

  const handleDownloadDataset = async (dataset) => {
    try {
      const response = await fetch(
        `${API_URL}/api/datasets/${currentOrg.id}/${dataset.id}/offline-package`,
        { headers: getAuthHeaders() }
      );
      const data = await response.json();
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.name.replace(/\s+/g, '_')}_v${dataset.version}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Dataset exported');
    } catch (error) {
      toast.error('Failed to export dataset');
    }
  };

  const addColumn = () => {
    setCreateForm(prev => ({
      ...prev,
      columns: [...prev.columns, { name: '', type: 'string', label: '', searchable: false }]
    }));
  };

  const updateColumn = (index, field, value) => {
    setCreateForm(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => 
        i === index ? { ...col, [field]: value } : col
      )
    }));
  };

  const removeColumn = (index) => {
    setCreateForm(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index)
    }));
  };

  const filteredDatasets = datasets.filter(d => {
    const matchesSearch = d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || d.dataset_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="datasets-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">
              Lookup Datasets
            </h1>
            <p className="text-gray-400">Manage reusable lookup tables for data collection</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="create-dataset-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Dataset
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {DATASET_TYPES.map((type) => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Datasets Grid */}
        {filteredDatasets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDatasets.map((dataset) => (
              <DatasetCard
                key={dataset.id}
                dataset={dataset}
                onView={handleViewDataset}
                onEdit={(d) => { setSelectedDataset(d); }}
                onDelete={handleDeleteDataset}
                onDownload={handleDownloadDataset}
              />
            ))}
          </div>
        ) : (
          <Card className="bg-card/30 border-dashed">
            <CardContent className="py-12 text-center">
              <Database className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-2">No datasets yet</h3>
              <p className="text-gray-400 mb-4">
                Create lookup tables for schools, facilities, sampling frames, and more
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Dataset
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create Dataset Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Lookup Dataset</DialogTitle>
              <DialogDescription>
                Define the structure of your lookup table
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dataset Name</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g., Schools List"
                    data-testid="dataset-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={createForm.dataset_type}
                    onValueChange={(v) => setCreateForm({ ...createForm, dataset_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATASET_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Brief description of this dataset"
                  rows={2}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button variant="outline" size="sm" onClick={addColumn}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add Column
                  </Button>
                </div>

                <div className="space-y-2">
                  {createForm.columns.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-card/30 rounded-lg">
                      <Input
                        placeholder="name"
                        value={col.name}
                        onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Label"
                        value={col.label}
                        onChange={(e) => updateColumn(idx, 'label', e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={col.type}
                        onValueChange={(v) => updateColumn(idx, 'type', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={col.searchable}
                          onChange={(e) => updateColumn(idx, 'searchable', e.target.checked)}
                        />
                        Search
                      </label>
                      {idx > 0 && (
                        <Button variant="ghost" size="icon" onClick={() => removeColumn(idx)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Offline</Label>
                  <p className="text-xs text-gray-400">Allow download for offline use</p>
                </div>
                <Switch
                  checked={createForm.enable_offline}
                  onCheckedChange={(v) => setCreateForm({ ...createForm, enable_offline: v })}
                />
              </div>

              {createForm.enable_offline && (
                <div className="space-y-2">
                  <Label>Offline Subset Field</Label>
                  <Input
                    value={createForm.offline_subset_field}
                    onChange={(e) => setCreateForm({ ...createForm, offline_subset_field: e.target.value })}
                    placeholder="e.g., region (to filter by enumerator's region)"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDataset} disabled={saving} data-testid="save-dataset-btn">
                {saving ? 'Creating...' : 'Create Dataset'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dataset Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedDataset?.name}
                <Badge variant="outline">v{selectedDataset?.version}</Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedDataset?.record_count?.toLocaleString()} records
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowUploadDialog(true);
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Records
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadDataset(selectedDataset)}
              >
                <Download className="w-4 h-4 mr-2" />
                Export All
              </Button>
            </div>

            {recordsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedDataset?.columns?.map((col) => (
                        <TableHead key={col.name}>{col.label || col.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasetRecords.map((record, idx) => (
                      <TableRow key={idx}>
                        {selectedDataset?.columns?.map((col) => (
                          <TableCell key={col.name}>
                            {String(record[col.name] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Records Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Records</DialogTitle>
              <DialogDescription>
                Paste CSV or JSON data to add records
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Textarea
                value={uploadData}
                onChange={(e) => setUploadData(e.target.value)}
                placeholder={`Paste CSV data:\nid,name,district,region\nSCH001,School Name,District,Region\n\nOr JSON:\n[{"id": "SCH001", "name": "School Name"}]`}
                rows={10}
                className="font-mono text-sm"
                data-testid="upload-data-input"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUploadRecords} disabled={saving} data-testid="upload-records-btn">
                {saving ? 'Uploading...' : 'Upload Records'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default DatasetsPage;
