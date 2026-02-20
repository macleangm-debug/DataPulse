import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Settings, Trash2, Users, Edit2, MoreHorizontal, Calendar, Shield, CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuthStore, useOrgStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const TIER_LIMITS = { free: 1, starter: 3, pro: 10, enterprise: Infinity };

const OrganizationCard = ({ org, onEdit, onDelete, onSelect, isSelected }) => {
  const navigate = useNavigate();
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="group">
      <Card className={`bg-card/50 border-border/50 hover:border-primary/50 transition-all cursor-pointer ${isSelected ? 'border-primary ring-2 ring-primary/20' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3" onClick={() => onSelect(org)}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                  {org.name}
                  {isSelected && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Active</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">{org.slug}</CardDescription>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(org)}><Edit2 className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/team')}><Users className="w-4 h-4 mr-2" />Manage Team</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/security')}><Shield className="w-4 h-4 mr-2" />Security</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(org)} className="text-red-500 focus:text-red-500"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0" onClick={() => onSelect(org)}>
          {org.description && <p className="text-sm text-gray-400 mb-3 line-clamp-2">{org.description}</p>}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />Created {new Date(org.created_at).toLocaleDateString()}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { setCurrentOrg, currentOrg } = useOrgStore();
  const { user } = useAuthStore();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const userTier = user?.subscription_tier || 'free';
  const orgLimit = TIER_LIMITS[userTier] || 1;
  const canCreateMore = organizations.length < orgLimit;

  useEffect(() => { loadOrganizations(); }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/organizations`, { headers: getAuthHeaders() });
      if (response.ok) setOrganizations(await response.json() || []);
    } catch (error) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) { toast.error('Organization name is required'); return; }
    if (!canCreateMore && !isEditing) { toast.error(`You've reached your organization limit (${orgLimit}). Upgrade to create more.`); return; }

    setSaving(true);
    try {
      const url = isEditing ? `${API_URL}/api/organizations/${selectedOrg.id}` : `${API_URL}/api/organizations`;
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: formData.name, description: formData.description, slug: formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })
      });

      if (response.ok) {
        const newOrg = await response.json();
        toast.success(isEditing ? 'Organization updated' : 'Organization created');
        setShowCreateDialog(false);
        setFormData({ name: '', description: '' });
        setIsEditing(false);
        loadOrganizations();
        if (!isEditing) setCurrentOrg(newOrg);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save organization');
      }
    } catch (error) {
      toast.error('Failed to save organization');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrg) return;
    try {
      const response = await fetch(`${API_URL}/api/organizations/${selectedOrg.id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (response.ok) {
        toast.success('Organization deleted');
        setShowDeleteDialog(false);
        loadOrganizations();
        if (currentOrg?.id === selectedOrg.id) setCurrentOrg(null);
      }
    } catch (error) {
      toast.error('Failed to delete organization');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="organizations-page">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Organizations</h1>
            <p className="text-gray-400">Manage your organizations ({organizations.length}/{orgLimit === Infinity ? '∞' : orgLimit})</p>
          </div>
          <Button onClick={() => { setIsEditing(false); setFormData({ name: '', description: '' }); setShowCreateDialog(true); }} disabled={!canCreateMore} data-testid="create-org-btn">
            <Plus className="w-4 h-4 mr-2" />Create Organization
          </Button>
        </div>

        {!canCreateMore && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-amber-500" />
                <p className="text-amber-200 text-sm">You've reached your organization limit ({orgLimit}). Upgrade your plan to create more.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/pricing')}>Upgrade</Button>
            </CardContent>
          </Card>
        )}

        {organizations.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Create Your First Organization</h2>
            <p className="text-gray-400 max-w-md mb-8">Organizations help you manage teams, dashboards, and resources. Create one to get started.</p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="create-first-org-btn"><Plus className="w-4 h-4 mr-2" />Create Organization</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <OrganizationCard key={org.id} org={org} onEdit={(org) => { setSelectedOrg(org); setFormData({ name: org.name, description: org.description || '' }); setIsEditing(true); setShowCreateDialog(true); }}
                onDelete={(org) => { setSelectedOrg(org); setShowDeleteDialog(true); }} onSelect={(org) => { setCurrentOrg(org); toast.success(`Switched to ${org.name}`); }} isSelected={currentOrg?.id === org.id} />
            ))}
          </div>
        )}

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
              <DialogDescription>{isEditing ? 'Update your organization details' : 'Create a new organization to collaborate with your team'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Acme Corporation" data-testid="org-name-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of your organization" rows={3} data-testid="org-description-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving} data-testid="save-org-btn">{saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Organization</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete "{selectedOrg?.name}"? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

export default OrganizationsPage;
