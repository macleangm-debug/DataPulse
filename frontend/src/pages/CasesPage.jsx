import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Plus,
  Search,
  User,
  MapPin,
  Calendar,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  X,
  History,
  MessageSquare,
  UserCheck,
  Phone,
  Mail,
  ChevronRight,
  Tag
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Separator } from '../components/ui/separator';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useProjectStore } from '../store';
import { caseAPI, projectAPI } from '../lib/api';
import { formatDate, cn } from '../lib/utils';
import { toast } from 'sonner';

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-500 border-green-500/30', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-500/10 text-gray-500 border-gray-500/30', icon: XCircle },
};

const CaseRow = ({ caseItem, onStatusChange, onView, isSelected }) => {
  const status = statusConfig[caseItem.status] || statusConfig.open;
  const StatusIcon = status.icon;

  return (
    <TableRow 
      className={cn(
        "cursor-pointer hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )} 
      onClick={() => onView(caseItem)}
      data-testid={`case-row-${caseItem.id}`}
    >
      <TableCell className="font-mono text-sm font-medium">{caseItem.respondent_id}</TableCell>
      <TableCell>{caseItem.name || '-'}</TableCell>
      <TableCell>
        <Badge className={status.color} variant="outline">
          <StatusIcon className="w-3 h-3 mr-1" />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <History className="w-3 h-3 text-muted-foreground" />
          <span>{caseItem.visit_count}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {caseItem.last_visit ? formatDate(caseItem.last_visit) : 'Never'}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{formatDate(caseItem.created_at)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(caseItem); }}>
              <FileText className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(caseItem.id, 'in_progress'); }}>
              <Clock className="w-4 h-4 mr-2 text-yellow-500" />
              Mark In Progress
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(caseItem.id, 'completed'); }}>
              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
              Mark Completed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(caseItem.id, 'closed'); }}>
              <XCircle className="w-4 h-4 mr-2 text-gray-500" />
              Close Case
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

const CaseDetailPanel = ({ caseItem, onClose, onStatusChange }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(() => [
    { id: 1, text: 'Initial contact made via phone', date: new Date(Date.now() - 86400000 * 3), author: 'John Doe' },
    { id: 2, text: 'Scheduled follow-up visit for next week', date: new Date(Date.now() - 86400000), author: 'Jane Smith' },
  ]);

  const status = statusConfig[caseItem?.status] || statusConfig.open;
  const StatusIcon = status.icon;

  const handleAddNote = () => {
    if (!note.trim()) return;
    setNotes([
      { id: Date.now(), text: note, date: new Date(), author: 'Current User' },
      ...notes
    ]);
    setNote('');
    toast.success('Note added');
  };

  // Mock visit history (using useMemo would be better but for demo purposes)
  const visitHistory = React.useMemo(() => [
    { id: 1, date: new Date(Date.now() - 86400000 * 7), form: 'Baseline Survey', status: 'completed', quality: 92 },
    { id: 2, date: new Date(Date.now() - 86400000 * 14), form: 'Screening Form', status: 'completed', quality: 88 },
  ], []);

  if (!caseItem) return null;

  return (
    <Sheet open={!!caseItem} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-barlow text-xl">
              Case Details
            </SheetTitle>
          </div>
          <SheetDescription>
            Respondent ID: <span className="font-mono font-medium text-foreground">{caseItem.respondent_id}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Quick Info */}
          <div className="flex flex-wrap gap-2">
            <Badge className={status.color} variant="outline">
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
            <Badge variant="outline">
              <History className="w-3 h-3 mr-1" />
              {caseItem.visit_count} visits
            </Badge>
          </div>

          {/* Respondent Info Card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{caseItem.name || 'Unnamed Respondent'}</p>
                  <p className="text-sm text-muted-foreground">ID: {caseItem.respondent_id}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(caseItem.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Visit</p>
                  <p className="font-medium">{caseItem.last_visit ? formatDate(caseItem.last_visit) : 'Never'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Actions */}
          <div className="space-y-2">
            <Label>Update Status</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusConfig).map(([key, config]) => (
                <Button
                  key={key}
                  variant={caseItem.status === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    onStatusChange(caseItem.id, key);
                    toast.success(`Status updated to ${config.label}`);
                  }}
                  className={caseItem.status === key ? '' : 'opacity-70'}
                >
                  <config.icon className="w-3 h-3 mr-1" />
                  {config.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <span>Not provided</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span>Not provided</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Location:</span>
                    <span>Not provided</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Tag className="w-3 h-3 mr-1" />
                      Priority
                    </Badge>
                    <Badge variant="secondary">
                      <Tag className="w-3 h-3 mr-1" />
                      Follow-up
                    </Badge>
                    <Button variant="outline" size="sm" className="h-6">
                      <Plus className="w-3 h-3 mr-1" />
                      Add Tag
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Visit History</CardTitle>
                  <CardDescription>{visitHistory.length} visits recorded</CardDescription>
                </CardHeader>
                <CardContent>
                  {visitHistory.length > 0 ? (
                    <div className="space-y-3">
                      {visitHistory.map((visit, index) => (
                        <div key={visit.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{visit.form}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(visit.date)}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {visit.quality}% quality
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No visits recorded yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note about this case..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddNote} disabled={!note.trim()} className="w-full">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </div>

              <div className="space-y-3">
                {notes.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="p-3">
                      <p className="text-sm">{n.text}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{n.author}</span>
                        <span>•</span>
                        <span>{formatDate(n.date)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export function CasesPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const { projects } = useProjectStore();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCase, setNewCase] = useState({ respondent_id: '', name: '', project_id: '' });
  const [creating, setCreating] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    if (currentOrg) {
      loadProjects();
    }
  }, [currentOrg]);

  useEffect(() => {
    if (selectedProject) {
      loadCases();
    }
  }, [selectedProject, statusFilter]);

  const loadProjects = async () => {
    try {
      const response = await projectAPI.list(currentOrg.id);
      useProjectStore.getState().setProjects(response.data);
      if (response.data.length > 0 && !selectedProject) {
        setSelectedProject(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadCases = async () => {
    setLoading(true);
    try {
      const response = await caseAPI.list(selectedProject, {
        status_filter: statusFilter === 'all' ? null : statusFilter,
        search: search || null
      });
      setCases(response.data);
    } catch (error) {
      toast.error('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async () => {
    if (!newCase.respondent_id.trim()) {
      toast.error('Respondent ID is required');
      return;
    }
    if (!newCase.project_id) {
      toast.error('Please select a project');
      return;
    }
    setCreating(true);
    try {
      const response = await caseAPI.create({
        respondent_id: newCase.respondent_id,
        name: newCase.name,
        project_id: newCase.project_id,
        metadata: {}
      });
      setCases([response.data, ...cases]);
      setCreateDialogOpen(false);
      setNewCase({ respondent_id: '', name: '', project_id: '' });
      toast.success('Case created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create case');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (caseId, newStatus) => {
    try {
      await caseAPI.updateStatus(caseId, newStatus);
      setCases(cases.map(c => c.id === caseId ? { ...c, status: newStatus } : c));
      if (selectedCase?.id === caseId) {
        setSelectedCase({ ...selectedCase, status: newStatus });
      }
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleViewCase = (caseItem) => {
    setSelectedCase(caseItem);
  };

  const stats = {
    total: cases.length,
    open: cases.filter(c => c.status === 'open').length,
    in_progress: cases.filter(c => c.status === 'in_progress').length,
    completed: cases.filter(c => c.status === 'completed').length,
  };

  if (!currentOrg) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select an organization first</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="cases-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Cases</h1>
            <p className="text-gray-400">Track respondents and longitudinal data</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-case-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Case
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-barlow">Create Case</DialogTitle>
                <DialogDescription>Add a new respondent to track</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={newCase.project_id}
                    onValueChange={(value) => setNewCase({ ...newCase, project_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Respondent ID</Label>
                  <Input
                    value={newCase.respondent_id}
                    onChange={(e) => setNewCase({ ...newCase, respondent_id: e.target.value })}
                    placeholder="e.g., HH-001"
                    data-testid="case-respondent-id-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name (Optional)</Label>
                  <Input
                    value={newCase.name}
                    onChange={(e) => setNewCase({ ...newCase, name: e.target.value })}
                    placeholder="Respondent name"
                    data-testid="case-name-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCase} disabled={creating} data-testid="save-case-btn">
                  {creating ? 'Creating...' : 'Create Case'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Cases</p>
                    <p className="text-2xl font-barlow font-bold text-white">{stats.total}</p>
                  </div>
                  <Briefcase className="w-8 h-8 text-gray-600" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Open</p>
                    <p className="text-2xl font-barlow font-bold text-blue-500">{stats.open}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500/30" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">In Progress</p>
                    <p className="text-2xl font-barlow font-bold text-yellow-500">{stats.in_progress}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-500/30" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Completed</p>
                    <p className="text-2xl font-barlow font-bold text-green-500">{stats.completed}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500/30" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCases()}
              className="pl-10"
              data-testid="case-search-input"
            />
          </div>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48" data-testid="project-filter">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cases Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : cases.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Respondent ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((caseItem) => (
                    <CaseRow
                      key={caseItem.id}
                      caseItem={caseItem}
                      onStatusChange={handleStatusChange}
                      onView={handleViewCase}
                      isSelected={selectedCase?.id === caseItem.id}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <Briefcase className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-barlow text-lg font-semibold mb-2">No cases found</h3>
                <p className="text-muted-foreground mb-6">
                  {selectedProject ? 'Create your first case to start tracking respondents' : 'Select a project first'}
                </p>
                {selectedProject && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Case
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Case Detail Panel */}
        <CaseDetailPanel
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
          onStatusChange={handleStatusChange}
        />
      </div>
    </DashboardLayout>
  );
}
