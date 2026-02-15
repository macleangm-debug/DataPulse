import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  GitCompare,
  RotateCcw,
  Plus,
  Minus,
  Edit3,
  ArrowLeft,
  ArrowRight,
  Calendar,
  User,
  Save,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Version History Timeline
export function VersionHistory({ formId, onSelectVersion, currentVersion }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [formId]);

  const loadVersions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/forms/versions/${formId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (error) {
      console.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading versions...</div>;
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-12 h-12 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-400">No version history yet</p>
        <p className="text-xs text-gray-500">Save a version to start tracking changes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {versions.map((version, index) => (
        <motion.div
          key={version.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors
            ${currentVersion === version.version_number 
              ? 'bg-primary/10 border border-primary/30' 
              : 'hover:bg-card/50'
            }`}
          onClick={() => onSelectVersion?.(version)}
          data-testid={`version-${version.version_number}`}
        >
          {/* Timeline line */}
          {index < versions.length - 1 && (
            <div className="absolute left-[22px] top-12 w-0.5 h-[calc(100%-24px)] bg-border" />
          )}
          
          {/* Version dot */}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
            ${currentVersion === version.version_number ? 'bg-primary' : 'bg-border'}`}>
            <span className="text-[10px] text-white font-bold">{version.version_number}</span>
          </div>
          
          {/* Version info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-white">{version.name}</span>
              {version.version_number === versions[0]?.version_number && (
                <Badge variant="default" className="text-[10px]">Latest</Badge>
              )}
            </div>
            {version.description && (
              <p className="text-xs text-gray-400 mb-1 line-clamp-1">{version.description}</p>
            )}
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(version.created_at).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {version.field_count || version.fields?.length || 0} fields
              </span>
              {version.created_by_name && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {version.created_by_name}
                </span>
              )}
            </div>
            
            {/* Changes summary */}
            {version.changes && (
              <div className="flex gap-2 mt-2">
                {version.changes.added > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                    +{version.changes.added}
                  </Badge>
                )}
                {version.changes.removed > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30">
                    -{version.changes.removed}
                  </Badge>
                )}
                {version.changes.modified > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/30">
                    ~{version.changes.modified}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Version Comparison View
export function VersionComparison({ formId }) {
  const [versions, setVersions] = useState([]);
  const [v1, setV1] = useState(null);
  const [v2, setV2] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [formId]);

  const loadVersions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/forms/versions/${formId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setVersions(data.versions || []);
      
      // Auto-select latest two versions
      if (data.versions?.length >= 2) {
        setV2(data.versions[0].version_number);
        setV1(data.versions[1].version_number);
      }
    } catch (error) {
      console.error('Failed to load versions');
    }
  };

  const compareVersions = async () => {
    if (!v1 || !v2) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/forms/versions/${formId}/compare/${v1}/${v2}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setComparison(data);
    } catch (error) {
      toast.error('Failed to compare versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (v1 && v2) {
      compareVersions();
    }
  }, [v1, v2]);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="w-5 h-5" />
          Version Comparison
        </CardTitle>
        <CardDescription>Compare changes between form versions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Version Selectors */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">From Version</Label>
            <Select value={v1?.toString()} onValueChange={(v) => setV1(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version_number} value={v.version_number.toString()}>
                    {v.name} (v{v.version_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <ArrowRight className="w-5 h-5 text-gray-500 mt-5" />
          
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">To Version</Label>
            <Select value={v2?.toString()} onValueChange={(v) => setV2(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version_number} value={v.version_number.toString()}>
                    {v.name} (v{v.version_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8 text-gray-500">Comparing versions...</div>
        )}

        {comparison && !loading && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <Plus className="w-4 h-4 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-500">{comparison.summary.added_count}</p>
                <p className="text-[10px] text-gray-500">Added</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <Minus className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-500">{comparison.summary.removed_count}</p>
                <p className="text-[10px] text-gray-500">Removed</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                <Edit3 className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-500">{comparison.summary.modified_count}</p>
                <p className="text-[10px] text-gray-500">Modified</p>
              </div>
              <div className="p-3 bg-card/30 rounded-lg text-center">
                <Check className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-400">{comparison.summary.unchanged_count}</p>
                <p className="text-[10px] text-gray-500">Unchanged</p>
              </div>
            </div>

            <Separator />

            {/* Detailed Changes */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {/* Added Fields */}
                {comparison.diff.added.length > 0 && (
                  <DiffSection
                    title="Added Fields"
                    items={comparison.diff.added}
                    type="added"
                  />
                )}

                {/* Removed Fields */}
                {comparison.diff.removed.length > 0 && (
                  <DiffSection
                    title="Removed Fields"
                    items={comparison.diff.removed}
                    type="removed"
                  />
                )}

                {/* Modified Fields */}
                {comparison.diff.modified.length > 0 && (
                  <DiffSection
                    title="Modified Fields"
                    items={comparison.diff.modified}
                    type="modified"
                  />
                )}

                {/* No changes */}
                {comparison.diff.added.length === 0 &&
                 comparison.diff.removed.length === 0 &&
                 comparison.diff.modified.length === 0 && (
                  <div className="text-center py-8">
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-gray-400">No differences found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Diff Section Component
function DiffSection({ title, items, type }) {
  const [isOpen, setIsOpen] = useState(true);
  
  const colors = {
    added: 'border-green-500/30 bg-green-500/5',
    removed: 'border-red-500/30 bg-red-500/5',
    modified: 'border-blue-500/30 bg-blue-500/5'
  };

  const icons = {
    added: <Plus className="w-4 h-4 text-green-500" />,
    removed: <Minus className="w-4 h-4 text-red-500" />,
    modified: <Edit3 className="w-4 h-4 text-blue-500" />
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-card/50 rounded">
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {icons[type]}
        <span className="font-medium text-white">{title}</span>
        <Badge variant="outline" className="ml-auto">{items.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pl-6 pt-2">
          {items.map((item, index) => (
            <div
              key={index}
              className={`p-3 rounded border ${colors[type]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-white">
                  {item.field?.name || item.field_name || item.field_id}
                </span>
                {item.field?.type && (
                  <Badge variant="outline" className="text-[10px]">
                    {item.field.type}
                  </Badge>
                )}
              </div>
              
              {item.field?.label && (
                <p className="text-xs text-gray-400">{item.field.label}</p>
              )}

              {/* Show property changes for modified fields */}
              {type === 'modified' && item.changes && (
                <div className="mt-2 space-y-1">
                  {item.changes.map((change, i) => (
                    <div key={i} className="text-xs flex items-start gap-2">
                      <span className="text-gray-500 min-w-20">{change.property}:</span>
                      <span className="text-red-400 line-through">
                        {JSON.stringify(change.old_value)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="text-green-400">
                        {JSON.stringify(change.new_value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Save Version Dialog
export function SaveVersionDialog({ formId, onSave, onClose }) {
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/forms/versions/${formId}?description=${encodeURIComponent(description)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Version ${data.version_number} saved`);
        onSave?.(data);
        onClose();
      }
    } catch (error) {
      toast.error('Failed to save version');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Version
          </DialogTitle>
          <DialogDescription>
            Create a snapshot of the current form state
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label>Version Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Added validation rules, Updated question wording..."
            rows={3}
            className="mt-2"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Restore Version Confirmation
export function RestoreVersionDialog({ formId, version, onRestore, onClose }) {
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const response = await fetch(`${API_URL}/api/forms/versions/${formId}/restore/${version.version_number}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        onRestore?.(data);
        onClose();
      }
    } catch (error) {
      toast.error('Failed to restore version');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Restore Version
          </DialogTitle>
          <DialogDescription>
            Restore the form to version {version.version_number}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-500 font-medium">Current form will be backed up</p>
                <p className="text-xs text-gray-400 mt-1">
                  Your current form state will be automatically saved as a new version before restoring.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-card/50 rounded-lg">
            <p className="text-sm text-gray-400">Restoring to:</p>
            <p className="font-medium text-white">{version.name}</p>
            {version.description && (
              <p className="text-xs text-gray-500 mt-1">{version.description}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Created: {new Date(version.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleRestore} disabled={restoring}>
            {restoring ? 'Restoring...' : 'Restore Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
