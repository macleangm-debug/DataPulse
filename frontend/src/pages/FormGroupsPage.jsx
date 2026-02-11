import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { 
  Folder, 
  FolderPlus, 
  FolderOpen,
  FileText,
  MoreVertical,
  Loader2, 
  ChevronRight,
  ChevronDown,
  Edit3,
  Trash2,
  Archive,
  Move,
  Plus,
  Search,
  RefreshCw
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Color palette for folders
const FOLDER_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
];

// Folder Tree Item Component
const FolderTreeItem = ({ 
  folder, 
  level = 0, 
  selectedFolder, 
  onSelect, 
  onEdit, 
  onDelete, 
  onArchive,
  expandedFolders,
  onToggleExpand 
}) => {
  const isExpanded = expandedFolders.includes(folder.id);
  const isSelected = selectedFolder?.id === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;
  
  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-primary/20 text-primary' 
            : 'hover:bg-muted/50 text-foreground'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder)}
        data-testid={`folder-item-${folder.id}`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(folder.id); }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        
        {isExpanded ? (
          <FolderOpen className="h-4 w-4" style={{ color: folder.color || '#3b82f6' }} />
        ) : (
          <Folder className="h-4 w-4" style={{ color: folder.color || '#3b82f6' }} />
        )}
        
        <span className="flex-1 truncate text-sm">{folder.name}</span>
        
        <Badge variant="outline" className="text-xs">
          {folder.form_count || 0}
        </Badge>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(folder); }}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(folder); }}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolder={selectedFolder}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FormGroupsPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Tree state
  const [tree, setTree] = useState([]);
  const [ungroupedForms, setUngroupedForms] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  
  // Folder contents
  const [folderForms, setFolderForms] = useState([]);
  const [folderChildren, setFolderChildren] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]);
  
  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  
  // Form state
  const [newFolder, setNewFolder] = useState({ name: '', description: '', color: '#3b82f6', parent_id: null });
  const [selectedFormsToMove, setSelectedFormsToMove] = useState([]);
  const [moveTargetFolder, setMoveTargetFolder] = useState(null);
  
  const getAuthHeaders = useCallback(() => {
    let token = localStorage.getItem('access_token');
    if (!token) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token || null;
        } catch (e) {}
      }
    }
    if (!token) token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  const loadTree = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${API_URL}/api/form-groups/tree?org_id=${currentOrg.id}&include_forms=true`,
        { headers: getAuthHeaders() }
      );
      if (r.ok) {
        const data = await r.json();
        setTree(data.tree || []);
        setUngroupedForms(data.ungrouped_forms || []);
      }
    } catch (e) {
      console.error('Failed to load tree:', e);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, getAuthHeaders]);

  const loadFolderContents = useCallback(async (folderId) => {
    try {
      const r = await fetch(
        `${API_URL}/api/form-groups/${folderId}?include_forms=true`,
        { headers: getAuthHeaders() }
      );
      if (r.ok) {
        const data = await r.json();
        setFolderForms(data.forms || []);
        setFolderChildren(data.children || []);
        setBreadcrumb(data.breadcrumb || []);
      }
    } catch (e) {
      console.error('Failed to load folder contents:', e);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (selectedFolder) {
      loadFolderContents(selectedFolder.id);
    } else {
      setFolderForms([]);
      setFolderChildren([]);
      setBreadcrumb([]);
    }
  }, [selectedFolder, loadFolderContents]);

  const refreshData = async () => {
    setRefreshing(true);
    await loadTree();
    if (selectedFolder) {
      await loadFolderContents(selectedFolder.id);
    }
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const toggleExpand = (folderId) => {
    setExpandedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  const createFolder = async () => {
    if (!newFolder.name.trim()) {
      toast.error('Folder name is required');
      return;
    }
    
    try {
      const r = await fetch(`${API_URL}/api/form-groups?org_id=${currentOrg.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newFolder)
      });
      
      if (r.ok) {
        toast.success('Folder created');
        setCreateDialogOpen(false);
        setNewFolder({ name: '', description: '', color: '#3b82f6', parent_id: null });
        loadTree();
      } else {
        const error = await r.json();
        toast.error(error.detail || 'Failed to create folder');
      }
    } catch (e) {
      toast.error('Failed to create folder');
    }
  };

  const updateFolder = async () => {
    if (!folderToEdit?.name.trim()) {
      toast.error('Folder name is required');
      return;
    }
    
    try {
      const r = await fetch(`${API_URL}/api/form-groups/${folderToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: folderToEdit.name,
          description: folderToEdit.description,
          color: folderToEdit.color
        })
      });
      
      if (r.ok) {
        toast.success('Folder updated');
        setEditDialogOpen(false);
        setFolderToEdit(null);
        loadTree();
      } else {
        toast.error('Failed to update folder');
      }
    } catch (e) {
      toast.error('Failed to update folder');
    }
  };

  const deleteFolder = async () => {
    try {
      const r = await fetch(`${API_URL}/api/form-groups/${folderToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      if (r.ok) {
        toast.success('Folder deleted');
        setDeleteDialogOpen(false);
        setFolderToDelete(null);
        if (selectedFolder?.id === folderToDelete.id) {
          setSelectedFolder(null);
        }
        loadTree();
      } else {
        toast.error('Failed to delete folder');
      }
    } catch (e) {
      toast.error('Failed to delete folder');
    }
  };

  const archiveFolder = async (folder) => {
    try {
      const r = await fetch(`${API_URL}/api/form-groups/${folder.id}/archive`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (r.ok) {
        toast.success('Folder archived');
        loadTree();
      } else {
        toast.error('Failed to archive folder');
      }
    } catch (e) {
      toast.error('Failed to archive folder');
    }
  };

  const moveForms = async () => {
    if (selectedFormsToMove.length === 0) {
      toast.error('Please select forms to move');
      return;
    }
    
    try {
      const r = await fetch(`${API_URL}/api/form-groups/move-forms-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          form_ids: selectedFormsToMove,
          target_group_id: moveTargetFolder?.id || null
        })
      });
      
      if (r.ok) {
        const data = await r.json();
        toast.success(`Moved ${data.moved_count} forms`);
        setMoveDialogOpen(false);
        setSelectedFormsToMove([]);
        setMoveTargetFolder(null);
        loadTree();
        if (selectedFolder) {
          loadFolderContents(selectedFolder.id);
        }
      } else {
        toast.error('Failed to move forms');
      }
    } catch (e) {
      toast.error('Failed to move forms');
    }
  };

  const openEditDialog = (folder) => {
    setFolderToEdit({ ...folder });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (folder) => {
    setFolderToDelete(folder);
    setDeleteDialogOpen(true);
  };

  // Flatten tree for move target selection
  const flattenTree = (nodes, level = 0) => {
    let result = [];
    for (const node of nodes) {
      result.push({ ...node, level });
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenTree(node.children, level + 1));
      }
    }
    return result;
  };

  const flatFolders = flattenTree(tree);

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="form-groups-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FolderPlus className="h-6 w-6 text-blue-400" />
              Form Folders
            </h1>
            <p className="text-muted-foreground mt-1">
              Organize your forms into folders for better management
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="create-folder-btn">
              <Plus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Folder Tree */}
          <Card className="bg-card border-border lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-white text-lg">Folders</CardTitle>
              <CardDescription>Click to view folder contents</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : tree.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No folders yet</p>
                    <p className="text-sm mt-1">Create your first folder to organize forms</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* All Forms (ungrouped) */}
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        !selectedFolder 
                          ? 'bg-primary/20 text-primary' 
                          : 'hover:bg-muted/50 text-foreground'
                      }`}
                      onClick={() => setSelectedFolder(null)}
                    >
                      <span className="w-5" />
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">Ungrouped Forms</span>
                      <Badge variant="outline" className="text-xs">
                        {ungroupedForms.length}
                      </Badge>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    {/* Folder Tree */}
                    {tree.map((folder) => (
                      <FolderTreeItem
                        key={folder.id}
                        folder={folder}
                        level={0}
                        selectedFolder={selectedFolder}
                        onSelect={setSelectedFolder}
                        onEdit={openEditDialog}
                        onDelete={openDeleteDialog}
                        onArchive={archiveFolder}
                        expandedFolders={expandedFolders}
                        onToggleExpand={toggleExpand}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Folder Contents */}
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg">
                    {selectedFolder ? selectedFolder.name : 'Ungrouped Forms'}
                  </CardTitle>
                  {breadcrumb.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      {breadcrumb.map((item, idx) => (
                        <React.Fragment key={item.id}>
                          {idx > 0 && <ChevronRight className="h-3 w-3" />}
                          <span 
                            className="cursor-pointer hover:text-primary"
                            onClick={() => {
                              const folder = tree.find(f => f.id === item.id) || 
                                flatFolders.find(f => f.id === item.id);
                              if (folder) setSelectedFolder(folder);
                            }}
                          >
                            {item.name}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                {(selectedFolder ? folderForms : ungroupedForms).length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setMoveDialogOpen(true)}
                  >
                    <Move className="h-4 w-4 mr-2" />
                    Move Forms
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Subfolders */}
              {selectedFolder && folderChildren.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Subfolders</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {folderChildren.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedFolder(child)}
                      >
                        <Folder className="h-5 w-5" style={{ color: child.color || '#3b82f6' }} />
                        <span className="flex-1 truncate text-sm">{child.name}</span>
                        <Badge variant="outline" className="text-xs">{child.form_count || 0}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forms */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Forms</h4>
                {(selectedFolder ? folderForms : ungroupedForms).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No forms in this folder</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(selectedFolder ? folderForms : ungroupedForms).map((form) => (
                      <div
                        key={form.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/forms/${form.id}`)}
                        data-testid={`form-item-${form.id}`}
                      >
                        <FileText className="h-5 w-5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {form.name}
                          </p>
                          <Badge 
                            variant="outline" 
                            className={`text-xs mt-1 ${
                              form.status === 'published' ? 'bg-green-500/20 text-green-400' :
                              form.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-500/20 text-slate-400'
                            }`}
                          >
                            {form.status}
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Folder Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Folder</DialogTitle>
              <DialogDescription>Create a new folder to organize your forms</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Folder Name</Label>
                <Input
                  value={newFolder.name}
                  onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                  placeholder="e.g., Health Surveys"
                  data-testid="folder-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={newFolder.description}
                  onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })}
                  placeholder="Brief description of this folder"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-8 h-8 rounded-full transition-all ${
                        newFolder.color === color.value 
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' 
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewFolder({ ...newFolder, color: color.value })}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Parent Folder (optional)</Label>
                <Select 
                  value={newFolder.parent_id || '__root__'} 
                  onValueChange={(v) => setNewFolder({ ...newFolder, parent_id: v === '__root__' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (root level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">None (root level)</SelectItem>
                    {flatFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {'  '.repeat(folder.level)}{folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={createFolder} data-testid="save-folder-btn">Create Folder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Folder Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Folder</DialogTitle>
            </DialogHeader>
            {folderToEdit && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Folder Name</Label>
                  <Input
                    value={folderToEdit.name}
                    onChange={(e) => setFolderToEdit({ ...folderToEdit, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={folderToEdit.description || ''}
                    onChange={(e) => setFolderToEdit({ ...folderToEdit, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {FOLDER_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-8 h-8 rounded-full transition-all ${
                          folderToEdit.color === color.value 
                            ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' 
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setFolderToEdit({ ...folderToEdit, color: color.value })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={updateFolder}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Folder Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Folder</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{folderToDelete?.name}"? 
                Forms in this folder will be moved to ungrouped.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={deleteFolder}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Forms Dialog */}
        <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Move Forms</DialogTitle>
              <DialogDescription>
                Select forms and choose a destination folder
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Forms</Label>
                <ScrollArea className="h-40 border rounded-lg p-2">
                  {(selectedFolder ? folderForms : ungroupedForms).map((form) => (
                    <div 
                      key={form.id}
                      className="flex items-center gap-2 py-1"
                    >
                      <Checkbox
                        checked={selectedFormsToMove.includes(form.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFormsToMove([...selectedFormsToMove, form.id]);
                          } else {
                            setSelectedFormsToMove(selectedFormsToMove.filter(id => id !== form.id));
                          }
                        }}
                      />
                      <span className="text-sm">{form.name}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
              <div className="space-y-2">
                <Label>Destination Folder</Label>
                <Select 
                  value={moveTargetFolder?.id || '__ungrouped__'} 
                  onValueChange={(v) => {
                    if (v === '__ungrouped__') {
                      setMoveTargetFolder(null);
                    } else {
                      const folder = flatFolders.find(f => f.id === v);
                      setMoveTargetFolder(folder);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select folder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ungrouped__">Ungrouped (no folder)</SelectItem>
                    {flatFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {'  '.repeat(folder.level)}{folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancel</Button>
              <Button onClick={moveForms} disabled={selectedFormsToMove.length === 0}>
                Move {selectedFormsToMove.length} Form(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
