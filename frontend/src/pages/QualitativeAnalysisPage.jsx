/**
 * Qualitative Analysis Module - Main Page
 * Projects list and entry point for qualitative research
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Plus,
  FileText,
  Code,
  MessageSquare,
  Lightbulb,
  Search,
  MoreVertical,
  Trash2,
  Settings,
  Calendar,
  Users,
  FolderOpen,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const METHODOLOGIES = [
  { value: 'thematic', label: 'Thematic Analysis' },
  { value: 'framework', label: 'Framework Analysis' },
  { value: 'grounded', label: 'Grounded Theory' },
  { value: 'content', label: 'Content Analysis' },
  { value: 'narrative', label: 'Narrative Analysis' },
  { value: 'phenomenological', label: 'Phenomenological Analysis' },
  { value: 'other', label: 'Other' }
];

export default function QualitativeAnalysisPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // New project form
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    methodology: '',
    research_questions: ''
  });

  useEffect(() => {
    if (currentOrg?.id) {
      loadProjects();
    }
  }, [currentOrg]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/qualitative/projects?org_id=${currentOrg.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/projects?org_id=${currentOrg.id}&user_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newProject.name,
            description: newProject.description,
            methodology: newProject.methodology,
            research_questions: newProject.research_questions
              ? newProject.research_questions.split('\n').filter(q => q.trim())
              : []
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Project created successfully');
        setShowCreateDialog(false);
        setNewProject({ name: '', description: '', methodology: '', research_questions: '' });
        loadProjects();
        // Navigate to the new project
        navigate(`/qualitative/${data.id}`);
      } else {
        throw new Error('Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm('Delete this project and all its data? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/projects/${projectId}?org_id=${currentOrg.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Project deleted');
        loadProjects();
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-primary" />
              Qualitative Analysis
            </h1>
            <p className="text-slate-500 mt-1">
              Analyze transcripts, field notes, and open-ended responses
            </p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Qualitative Project</DialogTitle>
                <DialogDescription>
                  Set up a new project for qualitative analysis
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Community Health Study 2024"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the research project..."
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="methodology">Methodology</Label>
                  <Select
                    value={newProject.methodology}
                    onValueChange={(value) => setNewProject({ ...newProject, methodology: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select methodology" />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODOLOGIES.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rqs">Research Questions</Label>
                  <Textarea
                    id="rqs"
                    placeholder="Enter each research question on a new line..."
                    value={newProject.research_questions}
                    onChange={(e) => setNewProject({ ...newProject, research_questions: e.target.value })}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">One question per line</p>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createProject}>Create Project</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Create your first qualitative analysis project to start coding transcripts
                and analyzing themes.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <Card
                key={project.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/qualitative/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
                      {project.methodology && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {METHODOLOGIES.find(m => m.value === project.methodology)?.label || project.methodology}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2 mt-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>{project.source_count} sources</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Code className="w-4 h-4" />
                      <span>{project.code_count} codes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{project.coding_count} codings</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Features Overview */}
        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-semibold mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
              <FileText className="w-6 h-6 text-blue-600 mb-2" />
              <h3 className="font-medium text-blue-900">Source Management</h3>
              <p className="text-sm text-blue-700 mt-1">
                Import transcripts, field notes, and open-ended responses
              </p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
              <Code className="w-6 h-6 text-emerald-600 mb-2" />
              <h3 className="font-medium text-emerald-900">Coding Studio</h3>
              <p className="text-sm text-emerald-700 mt-1">
                Highlight text and apply codes with keyboard shortcuts
              </p>
            </div>
            <div className="p-4 rounded-lg bg-violet-50 border border-violet-100">
              <Lightbulb className="w-6 h-6 text-violet-600 mb-2" />
              <h3 className="font-medium text-violet-900">Theme Development</h3>
              <p className="text-sm text-violet-700 mt-1">
                Build themes with supporting and counter evidence
              </p>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
              <Sparkles className="w-6 h-6 text-amber-600 mb-2" />
              <h3 className="font-medium text-amber-900">AI Assistance</h3>
              <p className="text-sm text-amber-700 mt-1">
                Get coding suggestions and theme synthesis (coming soon)
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
