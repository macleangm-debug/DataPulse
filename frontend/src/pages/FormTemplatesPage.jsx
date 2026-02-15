import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Home,
  HeartPulse,
  MessageSquare,
  Calendar,
  Leaf,
  Search,
  Plus,
  ArrowRight,
  Layers,
  Check,
  Star
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
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
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useProjectStore } from '../store';
import { projectAPI } from '../lib/api';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Icon mapping
const ICON_MAP = {
  'home': Home,
  'heart-pulse': HeartPulse,
  'message-square': MessageSquare,
  'calendar': Calendar,
  'leaf': Leaf,
  'file-text': FileText,
};

// Category colors
const CATEGORY_COLORS = {
  'Demographics': 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  'Health': 'bg-red-500/10 text-red-500 border-red-500/30',
  'Business': 'bg-green-500/10 text-green-500 border-green-500/30',
  'Events': 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  'Agriculture': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  'default': 'bg-gray-500/10 text-gray-500 border-gray-500/30',
};

const TemplateCard = ({ template, onUse }) => {
  const Icon = ICON_MAP[template.icon] || FileText;
  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="h-full hover:shadow-lg transition-all cursor-pointer group" onClick={() => onUse(template)}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <Badge variant="outline" className={categoryColor}>
              {template.category}
            </Badge>
          </div>
          <CardTitle className="text-lg text-white mt-3">{template.name}</CardTitle>
          <CardDescription className="text-gray-400 line-clamp-2">
            {template.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Layers className="w-4 h-4" />
              <span>{template.field_count} fields</span>
            </div>
            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              Use Template
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export function FormTemplatesPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  const { projects } = useProjectStore();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [formName, setFormName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadCategories();
    if (currentOrg) {
      loadProjects();
    }
  }, [currentOrg]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/templates/`);
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/templates/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const loadProjects = async () => {
    try {
      const response = await projectAPI.list(currentOrg.id);
      useProjectStore.getState().setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects');
    }
  };

  const handleUseTemplate = (template) => {
    setSelectedTemplate(template);
    setFormName(`${template.name} Copy`);
    setSelectedProject(projects[0]?.id || '');
  };

  const handleCreateForm = async () => {
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(
        `${API_URL}/api/templates/${selectedTemplate.id}/create-form?project_id=${selectedProject}&form_name=${encodeURIComponent(formName)}`,
        { method: 'POST' }
      );

      if (response.ok) {
        const form = await response.json();
        toast.success('Form created from template');
        navigate(`/forms/${form.id}/edit`);
      } else {
        toast.error('Failed to create form');
      }
    } catch (error) {
      toast.error('Failed to create form');
    } finally {
      setCreating(false);
      setSelectedTemplate(null);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                         t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!currentOrg) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-400">Please select an organization first</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="templates-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Form Templates</h1>
            <p className="text-gray-400">Start with a pre-built template and customize as needed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Featured Banner */}
        <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">Industry-Standard Templates</h3>
                <p className="text-sm text-gray-400">
                  Pre-built forms with multi-language support (English & Swahili), 
                  validation rules, and best practices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="font-semibold text-white mb-2">No templates found</h3>
            <p className="text-gray-400">Try adjusting your search or filter</p>
          </div>
        )}

        {/* Create from Template Dialog */}
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-white">Create Form from Template</DialogTitle>
              <DialogDescription>
                Create a new form based on "{selectedTemplate?.name}"
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Form Name</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter form name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Project</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
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

              {selectedTemplate && (
                <div className="bg-card/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-white mb-2">Template Details</h4>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p><strong>Category:</strong> {selectedTemplate.category}</p>
                    <p><strong>Fields:</strong> {selectedTemplate.field_count}</p>
                    <p>{selectedTemplate.description}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Cancel
              </Button>
              <Button onClick={handleCreateForm} disabled={creating || !selectedProject}>
                {creating ? 'Creating...' : 'Create Form'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
