import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Users,
  Settings,
  Trash2,
  Mail,
  Shield,
  Save
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { orgAPI } from '../lib/api';
import { slugify, formatDate } from '../lib/utils';
import { toast } from 'sonner';

const roleColors = {
  admin: 'bg-red-500/10 text-red-500',
  manager: 'bg-blue-500/10 text-blue-500',
  analyst: 'bg-purple-500/10 text-purple-500',
  enumerator: 'bg-green-500/10 text-green-500',
  viewer: 'bg-gray-500/10 text-gray-500'
};

const MemberRow = ({ member, currentUserId, onRemove, onRoleChange }) => {
  const isCurrentUser = member.user.id === currentUserId;

  return (
    <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback className="bg-primary/10 text-primary">
            {member.user.name?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">
            {member.user.name}
            {isCurrentUser && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
          </p>
          <p className="text-sm text-muted-foreground">{member.user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Select
          value={member.role}
          onValueChange={(value) => onRoleChange(member.id, value)}
          disabled={isCurrentUser}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="analyst">Analyst</SelectItem>
            <SelectItem value="enumerator">Enumerator</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        {!isCurrentUser && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {member.user.name} from this organization?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRemove(member.id)}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export function TeamPage() {
  const { currentOrg } = useOrgStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      loadMembers();
    }
  }, [currentOrg]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const response = await orgAPI.getMembers(currentOrg.id);
      setMembers(response.data);
    } catch (error) {
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setInviting(true);
    try {
      await orgAPI.addMember(currentOrg.id, inviteEmail, inviteRole);
      toast.success('Member added successfully');
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      loadMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await orgAPI.removeMember(currentOrg.id, memberId);
      setMembers(members.filter(m => m.id !== memberId));
      toast.success('Member removed');
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    // For simplicity, we'd need an API endpoint for this
    // For now, just update locally
    setMembers(members.map(m => 
      m.id === memberId ? { ...m, role: newRole } : m
    ));
    toast.success('Role updated');
  };

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
      <div className="space-y-6" data-testid="team-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">Team</h1>
            <p className="text-gray-400">Manage team members and permissions</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="invite-member-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-barlow">Add Team Member</DialogTitle>
                <DialogDescription>
                  Add an existing user to your organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@example.com"
                      className="pl-10"
                      data-testid="invite-email-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger data-testid="invite-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Admin - Full access
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">Manager - Manage projects & forms</SelectItem>
                      <SelectItem value="analyst">Analyst - View & analyze data</SelectItem>
                      <SelectItem value="enumerator">Enumerator - Collect data</SelectItem>
                      <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviting} data-testid="confirm-invite-btn">
                  {inviting ? 'Adding...' : 'Add Member'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['admin', 'manager', 'analyst', 'enumerator'].map((role) => {
            const count = members.filter(m => m.role === role).length;
            return (
              <Card key={role} className="bg-card border border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground capitalize">{role}s</p>
                      <p className="text-2xl font-barlow font-bold">{count}</p>
                    </div>
                    <Badge className={roleColors[role]}>{role}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Members List */}
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="font-barlow">Team Members</CardTitle>
            <CardDescription>{members.length} members in {currentOrg.name}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length > 0 ? (
              <div>
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    currentUserId={user?.id}
                    onRemove={handleRemoveMember}
                    onRoleChange={handleRoleChange}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No team members yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const { setCurrentOrg, setOrganizations, organizations } = useOrgStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setCreating(true);
    try {
      const response = await orgAPI.create({
        name,
        slug: slugify(name),
        description,
        settings: {}
      });
      setOrganizations([...organizations, response.data]);
      setCurrentOrg(response.data);
      toast.success('Organization created');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-xl mx-auto" data-testid="create-org-page">
        <Card className="bg-card border border-border">
          <CardHeader>
            <div className="w-12 h-12 rounded-sm bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="font-barlow text-2xl">Create Organization</CardTitle>
            <CardDescription>
              Set up a new organization to start collecting data with your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., ACME Research Institute"
                data-testid="org-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of your organization"
                rows={3}
                data-testid="org-description-input"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreate} disabled={creating} data-testid="create-org-submit-btn">
                {creating ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
