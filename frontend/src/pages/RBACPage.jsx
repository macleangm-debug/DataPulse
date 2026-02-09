import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Eye,
  Search,
  UserCheck,
  AlertTriangle
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
import { Checkbox } from '../components/ui/checkbox';
import { Skeleton } from '../components/ui/skeleton';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const PermissionItem = ({ permission, isChecked, onToggle, disabled }) => (
  <label className={`flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <Checkbox
      checked={isChecked}
      onCheckedChange={onToggle}
      disabled={disabled}
    />
    <div className="flex-1">
      <p className="text-sm font-medium">{permission.name}</p>
    </div>
  </label>
);

const RoleCard = ({ role, onEdit, onDelete, isSystem }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="group"
  >
    <Card className={`bg-card/50 border-border/50 ${isSystem ? 'border-l-4 border-l-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{role.name}</h3>
              {isSystem && (
                <Badge variant="outline" className="text-xs">System</Badge>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-3">{role.description}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {role.permissions?.includes('*') ? 'All' : role.permissions?.length || 0} permissions
              </Badge>
            </div>
          </div>
          {!isSystem && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" onClick={() => onEdit(role)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(role)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const UserRoleRow = ({ member, roles, onAssignRole }) => {
  const [selectedRole, setSelectedRole] = useState(member.role_id || 'viewer');

  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    onAssignRole(member.user_id, newRole);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-medium">
            {member.name?.charAt(0)?.toUpperCase() || 'U'}
          </span>
        </div>
        <div>
          <p className="font-medium text-white">{member.name || member.email}</p>
          <p className="text-sm text-gray-400">{member.email}</p>
        </div>
      </div>
      <Select value={selectedRole} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export function RBACPage() {
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [permissionCategories, setPermissionCategories] = useState({});
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] });
  const [expandedCategories, setExpandedCategories] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrg?.id) {
      loadData();
    }
  }, [currentOrg?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [rolesRes, permsRes, membersRes] = await Promise.all([
        fetch(`${API_URL}/api/rbac/roles/${currentOrg.id}`, { headers }),
        fetch(`${API_URL}/api/rbac/permissions`, { headers }),
        fetch(`${API_URL}/api/organizations/${currentOrg.id}/members`, { headers }).catch(() => ({ json: () => ({ members: [] }) }))
      ]);

      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      let membersData;
      try {
        membersData = await membersRes.json();
      } catch {
        membersData = { members: [] };
      }

      setRoles(rolesData.roles || []);
      setPermissions(permsData.permissions || []);
      setPermissionCategories(permsData.categories || {});
      setMembers(membersData.members || []);
      
      // Initialize expanded categories
      const expanded = {};
      Object.keys(permsData.categories || {}).forEach(cat => {
        expanded[cat] = true;
      });
      setExpandedCategories(expanded);
    } catch (error) {
      console.error('Failed to load RBAC data:', error);
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    setShowRoleDialog(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setShowRoleDialog(true);
  };

  const handleDeleteRole = async (role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/rbac/roles/${currentOrg.id}/${role.id}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete role');
      }
      
      toast.success('Role deleted');
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setSaving(true);
    try {
      const url = editingRole
        ? `${API_URL}/api/rbac/roles/${currentOrg.id}/${editingRole.id}`
        : `${API_URL}/api/rbac/roles/${currentOrg.id}`;
      
      const response = await fetch(url, {
        method: editingRole ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(roleForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save role');
      }

      toast.success(editingRole ? 'Role updated' : 'Role created');
      setShowRoleDialog(false);
      loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignRole = async (userId, roleId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/rbac/users/${currentOrg.id}/assign-role`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId, role_id: roleId })
        }
      );

      if (!response.ok) throw new Error('Failed to assign role');
      toast.success('Role assigned');
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const togglePermission = (permKey) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey]
    }));
  };

  const filteredMembers = members.filter(m =>
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const systemRoles = roles.filter(r => r.is_system);
  const customRoles = roles.filter(r => !r.is_system);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="rbac-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">
              Roles & Permissions
            </h1>
            <p className="text-gray-400">Manage access control for your organization</p>
          </div>
          <Button onClick={handleCreateRole} data-testid="create-role-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Custom Role
          </Button>
        </div>

        <Tabs defaultValue="roles">
          <TabsList>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="w-4 h-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              User Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="space-y-6 mt-6">
            {/* System Roles */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                System Roles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemRoles.map((role) => (
                  <RoleCard
                    key={role.id}
                    role={role}
                    isSystem={true}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            </div>

            {/* Custom Roles */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Unlock className="w-5 h-5" />
                Custom Roles
              </h2>
              {customRoles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customRoles.map((role) => (
                    <RoleCard
                      key={role.id}
                      role={role}
                      isSystem={false}
                      onEdit={handleEditRole}
                      onDelete={handleDeleteRole}
                    />
                  ))}
                </div>
              ) : (
                <Card className="bg-card/30 border-dashed">
                  <CardContent className="py-8 text-center">
                    <Shield className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">No custom roles yet</p>
                    <Button variant="outline" className="mt-4" onClick={handleCreateRole}>
                      Create Your First Role
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Team Role Assignments
                </CardTitle>
                <CardDescription>
                  Assign roles to team members to control their access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {filteredMembers.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {filteredMembers.map((member) => (
                      <UserRoleRow
                        key={member.user_id}
                        member={member}
                        roles={roles}
                        onAssignRole={handleAssignRole}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">
                      {searchTerm ? 'No members found' : 'No team members yet'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Role Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? 'Edit Role' : 'Create Custom Role'}
              </DialogTitle>
              <DialogDescription>
                Define the role name and select the permissions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g., Field Coordinator"
                  data-testid="role-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role-desc">Description</Label>
                <Input
                  id="role-desc"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Brief description of this role's purpose"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Permissions</Label>
                <p className="text-sm text-gray-400 mb-3">
                  Select the permissions this role should have
                </p>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {Object.entries(permissionCategories).map(([category, perms]) => (
                    <div key={category} className="border rounded-lg">
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-3 hover:bg-accent/50"
                      >
                        <span className="font-medium">{category}</span>
                        {expandedCategories[category] ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {expandedCategories[category] && (
                        <div className="px-3 pb-3 space-y-1">
                          {perms.map((perm) => (
                            <PermissionItem
                              key={perm.key}
                              permission={perm}
                              isChecked={roleForm.permissions.includes(perm.key)}
                              onToggle={() => togglePermission(perm.key)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRole} disabled={saving} data-testid="save-role-btn">
                {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
