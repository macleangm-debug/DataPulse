import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Archive,
  FileText,
  Calendar,
  Users
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
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
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useProjectStore } from '../store';
import { projectAPI } from '../lib/api';
import { formatDate, getStatusVariant } from '../lib/utils';
import { toast } from 'sonner';

const ProjectCard = ({ project, onStatusChange, onSelect }) => {
  const navigate = useNavigate();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
        onClick={() => onSelect(project)}
        data-testid={`project-card-${project.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-barlow text-lg text-foreground group-hover:text-primary transition-colors">
                  {project.name}
                </CardTitle>
                <Badge variant={getStatusVariant(project.status)} className="mt-1">
                  {project.status}
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/edit`); }}>
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {project.status === 'draft' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(project.id, 'active'); }}>
                    <Play className="w-4 h-4 mr-2" />
                    Activate
                  </DropdownMenuItem>
                )}
                {project.status === 'active' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(project.id, 'paused'); }}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </DropdownMenuItem>
                )}
                {project.status === 'paused' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(project.id, 'active'); }}>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onStatusChange(project.id, 'archived'); }}
                  className="text-destructive"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {project.description || 'No description'}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>{project.form_count} forms</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {project.submission_count} submissions
            </div>
          </div>
          {project.start_date && (
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(project.start_date)}
              {project.end_date && ` - ${formatDate(project.end_date)}`}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export function ProjectsPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const { projects, setProjects, setCurrentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      loadProjects();
    }
  }, [currentOrg]);

  const loadProjects = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const response = await projectAPI.list(currentOrg.id, statusFilter === 'all' ? null : statusFilter);
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setCreating(true);
    try {
      const response = await projectAPI.create({
        name: newProject.name,
        description: newProject.description,
        org_id: currentOrg.id
      });
      setProjects([...projects, response.data]);
      setCreateDialogOpen(false);
      setNewProject({ name: '', description: '' });
      toast.success('Project created');
      navigate(`/projects/${response.data.id}`);
    } catch (error) {
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      await projectAPI.updateStatus(projectId, newStatus);
      setProjects(projects.map(p => 
        p.id === projectId ? { ...p, status: newStatus } : p
      ));
      toast.success(`Project ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleSelectProject = (project) => {
    setCurrentProject(project);
    navigate(`/projects/${project.id}`);
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div className="space-y-6" data-testid="projects-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <p className="text-muted-foreground">Manage your data collection projects</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-project-btn">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-barlow">Create Project</DialogTitle>
                <DialogDescription>Add a new data collection project</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="e.g., Baseline Survey 2024"
                    data-testid="project-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Brief description of the project"
                    rows={3}
                    data-testid="project-description-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProject} disabled={creating} data-testid="save-project-btn">
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-projects-input"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-card/50">
                <CardHeader>
                  <Skeleton className="h-10 w-10 rounded-sm" />
                  <Skeleton className="h-5 w-3/4 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onStatusChange={handleStatusChange}
                onSelect={handleSelectProject}
              />
            ))}
          </div>
        ) : (
          <Card className="bg-card border border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FolderKanban className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-barlow text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                {search ? 'Try adjusting your search' : 'Create your first project to start collecting data'}
              </p>
              {!search && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
