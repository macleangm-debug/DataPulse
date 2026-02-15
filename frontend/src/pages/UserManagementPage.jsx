import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  MoreVertical,
  Shield,
  UserX,
  UserCheck,
  History,
  Key,
  Monitor,
  AlertTriangle,
  Clock,
  MapPin,
  Mail,
  Phone,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronRight,
  X,
  RefreshCw,
  Download,
  Trash2,
  Edit2,
  Eye,
  Lock,
  Unlock,
  LogOut,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Smartphone,
  Laptop,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Skeleton } from '../components/ui/skeleton';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

// Status badge colors
const statusColors = {
  active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  suspended: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  deactivated: 'bg-red-500/10 text-red-500 border-red-500/20',
  pending: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  locked: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
};

// Role badge colors
const roleColors = {
  admin: 'bg-red-500/10 text-red-500',
  manager: 'bg-blue-500/10 text-blue-500',
  analyst: 'bg-purple-500/10 text-purple-500',
  enumerator: 'bg-green-500/10 text-green-500',
  viewer: 'bg-gray-500/10 text-gray-400'
};

// Activity type icons
const activityIcons = {
  login: <LogOut className="w-4 h-4 text-emerald-500 rotate-180" />,
  logout: <LogOut className="w-4 h-4 text-gray-400" />,
  password_change: <Key className="w-4 h-4 text-blue-500" />,
  profile_update: <Edit2 className="w-4 h-4 text-cyan-500" />,
  role_change: <Shield className="w-4 h-4 text-purple-500" />,
  suspension: <UserX className="w-4 h-4 text-amber-500" />,
  reactivation: <UserCheck className="w-4 h-4 text-emerald-500" />,
  failed_login: <XCircle className="w-4 h-4 text-red-500" />,
  session_created: <Monitor className="w-4 h-4 text-blue-500" />,
  session_revoked: <Lock className="w-4 h-4 text-red-500" />
};

// Stats Card Component
const StatCard = ({ icon: Icon, title, value, subValue, trend, color }) => (
  <Card className="bg-card/50 border-border/50">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <Badge variant="outline" className={trend > 0 ? 'text-emerald-500' : 'text-red-500'}>
            {trend > 0 ? '+' : ''}{trend}%
          </Badge>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
      </div>
    </CardContent>
  </Card>
);

// User Row Component
const UserRow = ({ user, isSelected, onSelect, onViewDetails, onEdit, onAction }) => (
  <TableRow className="hover:bg-accent/50 cursor-pointer group">
    <TableCell className="w-12">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelect}
        data-testid={`user-checkbox-${user.user_id}`}
      />
    </TableCell>
    <TableCell onClick={() => onViewDetails(user)}>
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {user.name?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-white">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
    </TableCell>
    <TableCell>
      <Badge variant="outline" className={roleColors[user.role] || roleColors.viewer}>
        {user.role || 'viewer'}
      </Badge>
    </TableCell>
    <TableCell>
      <Badge variant="outline" className={statusColors[user.status] || statusColors.active}>
        {user.status || 'active'}
      </Badge>
    </TableCell>
    <TableCell className="text-muted-foreground text-sm">
      {user.department || '-'}
    </TableCell>
    <TableCell className="text-muted-foreground text-sm">
      {user.last_active ? formatDistanceToNow(new Date(user.last_active), { addSuffix: true }) : 'Never'}
    </TableCell>
    <TableCell className="text-center">
      <Badge variant="secondary" className="text-xs">
        {user.active_sessions || 0}
      </Badge>
    </TableCell>
    <TableCell>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" data-testid={`user-actions-${user.user_id}`}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onViewDetails(user)}>
            <Eye className="w-4 h-4 mr-2" /> View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(user)}>
            <Edit2 className="w-4 h-4 mr-2" /> Edit User
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.status !== 'suspended' ? (
            <DropdownMenuItem onClick={() => onAction(user, 'suspend')} className="text-amber-500">
              <UserX className="w-4 h-4 mr-2" /> Suspend
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onAction(user, 'activate')} className="text-emerald-500">
              <UserCheck className="w-4 h-4 mr-2" /> Reactivate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onAction(user, 'reset-password')}>
            <Key className="w-4 h-4 mr-2" /> Reset Password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction(user, 'revoke-sessions')} className="text-red-500">
            <Lock className="w-4 h-4 mr-2" /> Revoke Sessions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  </TableRow>
);

// Activity Item Component
const ActivityItem = ({ activity }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/30 transition-colors">
    <div className="p-2 rounded-full bg-accent/50">
      {activityIcons[activity.activity_type] || <Activity className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="font-medium text-sm text-white capitalize">
          {activity.activity_type?.replace(/_/g, ' ')}
        </p>
        {activity.user_name && (
          <span className="text-xs text-muted-foreground">by {activity.user_name}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {activity.timestamp && formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
      </p>
      {activity.ip_address && (
        <div className="flex items-center gap-2 mt-1">
          <Globe className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{activity.ip_address}</span>
        </div>
      )}
    </div>
  </div>
);

// Session Item Component
const SessionItem = ({ session, onRevoke }) => {
  const isExpired = session.status === 'expired' || (session.expires_at && new Date(session.expires_at) < new Date());
  const isRevoked = session.status === 'revoked';
  
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      isExpired || isRevoked ? 'border-border/30 bg-accent/20' : 'border-border/50 bg-card/50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isExpired || isRevoked ? 'bg-muted' : 'bg-primary/10'}`}>
          {session.device_type === 'mobile' ? (
            <Smartphone className="w-4 h-4" />
          ) : (
            <Laptop className="w-4 h-4" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{session.device_name || 'Unknown Device'}</p>
            <Badge variant="outline" className={
              isRevoked ? 'text-red-500' : isExpired ? 'text-amber-500' : 'text-emerald-500'
            }>
              {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {session.ip_address && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" /> {session.ip_address}
              </span>
            )}
            {session.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {session.location}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last active: {session.last_activity ? formatDistanceToNow(new Date(session.last_activity), { addSuffix: true }) : 'Unknown'}
          </p>
        </div>
      </div>
      {!isExpired && !isRevoked && onRevoke && (
        <Button variant="ghost" size="sm" onClick={() => onRevoke(session)} className="text-red-500 hover:text-red-400">
          <Lock className="w-4 h-4 mr-1" /> Revoke
        </Button>
      )}
    </div>
  );
};

// User Details Drawer Component
const UserDetailsDrawer = ({ user, isOpen, onClose, onRefresh }) => {
  const [detailsData, setDetailsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { currentOrg } = useOrgStore();

  useEffect(() => {
    if (isOpen && user) {
      fetchUserDetails();
    }
  }, [isOpen, user]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/users/${user.user_id}?org_id=${currentOrg?.id}`,
        { headers: getAuthHeaders() }
      );
      if (response.ok) {
        const data = await response.json();
        setDetailsData(data);
      }
    } catch (error) {
      console.error('Failed to fetch user details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (session) => {
    try {
      const response = await fetch(
        `${API_URL}/api/users/${user.user_id}/sessions/revoke?org_id=${currentOrg?.id}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ session_ids: [session.id] })
        }
      );
      if (response.ok) {
        toast.success('Session revoked successfully');
        fetchUserDetails();
      }
    } catch (error) {
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/users/${user.user_id}/sessions/revoke-all?org_id=${currentOrg?.id}`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );
      if (response.ok) {
        toast.success('All sessions revoked');
        fetchUserDetails();
      }
    } catch (error) {
      toast.error('Failed to revoke sessions');
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-lg">{user?.name}</span>
              <p className="text-sm font-normal text-muted-foreground">{user?.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview" data-testid="user-details-overview-tab">Overview</TabsTrigger>
            <TabsTrigger value="activity" data-testid="user-details-activity-tab">Activity</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="user-details-sessions-tab">Sessions</TabsTrigger>
            <TabsTrigger value="security" data-testid="user-details-security-tab">Security</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <TabsContent value="overview" className="h-full overflow-auto space-y-4 m-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Role</Label>
                      <Badge variant="outline" className={roleColors[detailsData?.membership?.role] || roleColors.viewer}>
                        {detailsData?.membership?.role || 'viewer'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Status</Label>
                      <Badge variant="outline" className={statusColors[detailsData?.membership?.status] || statusColors.active}>
                        {detailsData?.membership?.status || 'active'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Department</Label>
                      <p className="text-sm">{detailsData?.membership?.department || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Job Title</Label>
                      <p className="text-sm">{detailsData?.membership?.job_title || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Phone</Label>
                      <p className="text-sm">{detailsData?.membership?.phone || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">Joined</Label>
                      <p className="text-sm">
                        {detailsData?.membership?.joined_at 
                          ? format(new Date(detailsData.membership.joined_at), 'MMM d, yyyy')
                          : '-'}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="h-full overflow-auto m-0">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {detailsData?.recent_activity?.length > 0 ? (
                        detailsData.recent_activity.map((activity, idx) => (
                          <ActivityItem key={idx} activity={activity} />
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No recent activity</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="sessions" className="h-full overflow-auto m-0">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">
                      {detailsData?.active_sessions?.length || 0} active session(s)
                    </p>
                    {detailsData?.active_sessions?.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleRevokeAllSessions} className="text-red-500">
                        <Lock className="w-4 h-4 mr-1" /> Revoke All
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-3">
                      {detailsData?.active_sessions?.length > 0 ? (
                        detailsData.active_sessions.map((session, idx) => (
                          <SessionItem key={idx} session={session} onRevoke={handleRevokeSession} />
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No active sessions</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="security" className="h-full overflow-auto space-y-4 m-0">
                  <Card className="bg-accent/30 border-border/50">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Last Password Change</p>
                          <p className="text-sm text-muted-foreground">
                            {detailsData?.membership?.last_password_change 
                              ? formatDistanceToNow(new Date(detailsData.membership.last_password_change), { addSuffix: true })
                              : 'Never changed'}
                          </p>
                        </div>
                        <Key className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Failed Login Attempts</p>
                          <p className="text-sm text-muted-foreground">
                            {detailsData?.membership?.failed_login_attempts || 0} attempts
                          </p>
                        </div>
                        <AlertTriangle className={`w-5 h-5 ${
                          (detailsData?.membership?.failed_login_attempts || 0) > 3 ? 'text-amber-500' : 'text-muted-foreground'
                        }`} />
                      </div>
                      {detailsData?.membership?.locked_until && (
                        <>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-red-500">Account Locked</p>
                              <p className="text-sm text-muted-foreground">
                                Until {format(new Date(detailsData.membership.locked_until), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            <Lock className="w-5 h-5 text-red-500" />
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <h4 className="font-medium">Login History</h4>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {detailsData?.login_history?.slice(0, 10).map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
                            <div className="flex items-center gap-2">
                              {entry.activity_type === 'login' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className="text-sm capitalize">{entry.activity_type?.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {entry.ip_address && <span>{entry.ip_address}</span>}
                              <span>{entry.timestamp && formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Edit User Dialog Component
const EditUserDialog = ({ user, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    role: 'viewer',
    status: 'active',
    phone: '',
    department: '',
    job_title: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        role: user.role || 'viewer',
        status: user.status || 'active',
        phone: user.phone || '',
        department: user.department || '',
        job_title: user.job_title || ''
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(user.user_id, formData);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user information and settings</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              data-testid="edit-user-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger data-testid="edit-user-role-select">
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
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="edit-user-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              data-testid="edit-user-phone-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g., Research"
                data-testid="edit-user-department-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="e.g., Senior Analyst"
                data-testid="edit-user-job-input"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="edit-user-save-btn">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Password Policy Dialog
const PasswordPolicyDialog = ({ isOpen, onClose, policy, onSave }) => {
  const [formData, setFormData] = useState({
    min_length: 8,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_special: true,
    max_age_days: 90,
    history_count: 5,
    max_failed_attempts: 5,
    lockout_duration_minutes: 30
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policy) {
      setFormData({
        min_length: policy.min_length || 8,
        require_uppercase: policy.require_uppercase ?? true,
        require_lowercase: policy.require_lowercase ?? true,
        require_numbers: policy.require_numbers ?? true,
        require_special: policy.require_special ?? true,
        max_age_days: policy.max_age_days || 90,
        history_count: policy.history_count || 5,
        max_failed_attempts: policy.max_failed_attempts || 5,
        lockout_duration_minutes: policy.lockout_duration_minutes || 30
      });
    }
  }, [policy]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Password Policy Settings</DialogTitle>
          <DialogDescription>Configure password requirements for your organization</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Key className="w-4 h-4" /> Password Requirements
            </h4>
            
            <div className="space-y-2">
              <Label>Minimum Length</Label>
              <Input
                type="number"
                min={6}
                max={32}
                value={formData.min_length}
                onChange={(e) => setFormData({ ...formData, min_length: parseInt(e.target.value) })}
                data-testid="policy-min-length"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label>Require Uppercase</Label>
                <Switch
                  checked={formData.require_uppercase}
                  onCheckedChange={(v) => setFormData({ ...formData, require_uppercase: v })}
                  data-testid="policy-uppercase-switch"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Lowercase</Label>
                <Switch
                  checked={formData.require_lowercase}
                  onCheckedChange={(v) => setFormData({ ...formData, require_lowercase: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Numbers</Label>
                <Switch
                  checked={formData.require_numbers}
                  onCheckedChange={(v) => setFormData({ ...formData, require_numbers: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Special Chars</Label>
                <Switch
                  checked={formData.require_special}
                  onCheckedChange={(v) => setFormData({ ...formData, require_special: v })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="w-4 h-4" /> Security Settings
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Password Age (days)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={formData.max_age_days}
                  onChange={(e) => setFormData({ ...formData, max_age_days: parseInt(e.target.value) })}
                  data-testid="policy-max-age"
                />
              </div>
              <div className="space-y-2">
                <Label>Password History</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={formData.history_count}
                  onChange={(e) => setFormData({ ...formData, history_count: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Lock className="w-4 h-4" /> Account Lockout
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Failed Attempts</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={formData.max_failed_attempts}
                  onChange={(e) => setFormData({ ...formData, max_failed_attempts: parseInt(e.target.value) })}
                  data-testid="policy-max-attempts"
                />
              </div>
              <div className="space-y-2">
                <Label>Lockout Duration (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={formData.lockout_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, lockout_duration_minutes: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="policy-save-btn">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main User Management Page
export const UserManagementPage = () => {
  const { currentOrg } = useOrgStore();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('users');
  
  // Dialogs
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showPasswordPolicy, setShowPasswordPolicy] = useState(false);
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  
  // Activity
  const [allActivity, setAllActivity] = useState([]);
  const [suspiciousActivity, setSuspiciousActivity] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);

  const fetchUsers = useCallback(async () => {
    if (!currentOrg?.id) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        org_id: currentOrg.id,
        page: currentPage.toString(),
        page_size: '20'
      });
      
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (roleFilter && roleFilter !== 'all') params.append('role', roleFilter);

      const response = await fetch(
        `${API_URL}/api/users?${params}`,
        { headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotalPages(data.total_pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, currentPage, searchQuery, statusFilter, roleFilter]);

  const fetchStats = useCallback(async () => {
    if (!currentOrg?.id) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/users/stats?org_id=${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [currentOrg?.id]);

  const fetchActivity = useCallback(async () => {
    if (!currentOrg?.id) return;
    
    try {
      const [activityRes, suspiciousRes, sessionsRes] = await Promise.all([
        fetch(`${API_URL}/api/users/activity/all?org_id=${currentOrg.id}&page_size=50`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/users/login-history/suspicious?org_id=${currentOrg.id}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/users/sessions/active?org_id=${currentOrg.id}`, { headers: getAuthHeaders() })
      ]);
      
      if (activityRes.ok) {
        const data = await activityRes.json();
        setAllActivity(data.activities || []);
      }
      
      if (suspiciousRes.ok) {
        const data = await suspiciousRes.json();
        setSuspiciousActivity(data.suspicious_activity || []);
      }
      
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  }, [currentOrg?.id]);

  const fetchPasswordPolicy = useCallback(async () => {
    if (!currentOrg?.id) return;
    
    try {
      const response = await fetch(
        `${API_URL}/api/users/config/password-policy?org_id=${currentOrg.id}`,
        { headers: getAuthHeaders() }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPasswordPolicy(data);
      }
    } catch (error) {
      console.error('Failed to fetch password policy:', error);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchActivity();
    fetchPasswordPolicy();
  }, [fetchUsers, fetchStats, fetchActivity, fetchPasswordPolicy]);

  const handleUserAction = async (user, action) => {
    try {
      let endpoint = '';
      let method = 'POST';
      let body = null;

      switch (action) {
        case 'suspend':
        case 'activate':
        case 'deactivate':
          endpoint = `${API_URL}/api/users/bulk-action?org_id=${currentOrg.id}`;
          body = JSON.stringify({ user_ids: [user.user_id], action });
          break;
        case 'reset-password':
          endpoint = `${API_URL}/api/users/${user.user_id}/force-password-reset?org_id=${currentOrg.id}`;
          break;
        case 'revoke-sessions':
          endpoint = `${API_URL}/api/users/${user.user_id}/sessions/revoke-all?org_id=${currentOrg.id}`;
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body
      });

      if (response.ok) {
        toast.success(`User ${action} successful`);
        fetchUsers();
        fetchStats();
      } else {
        toast.error(`Failed to ${action} user`);
      }
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) return;

    try {
      const response = await fetch(
        `${API_URL}/api/users/bulk-action?org_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ user_ids: selectedUsers, action })
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.success?.length || 0} users updated`);
        setSelectedUsers([]);
        fetchUsers();
        fetchStats();
      }
    } catch (error) {
      toast.error('Bulk action failed');
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      const response = await fetch(
        `${API_URL}/api/users/${userId}?org_id=${currentOrg.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data)
        }
      );

      if (response.ok) {
        toast.success('User updated successfully');
        fetchUsers();
      } else {
        toast.error('Failed to update user');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleSavePasswordPolicy = async (policy) => {
    try {
      const response = await fetch(
        `${API_URL}/api/users/config/password-policy?org_id=${currentOrg.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(policy)
        }
      );

      if (response.ok) {
        toast.success('Password policy updated');
        setPasswordPolicy(policy);
      } else {
        toast.error('Failed to update policy');
      }
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.user_id));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="user-management-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage users, sessions, and security policies
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowPasswordPolicy(true)} data-testid="password-policy-btn">
              <Shield className="w-4 h-4 mr-2" /> Password Policy
            </Button>
            <Button onClick={() => {fetchUsers(); fetchStats(); fetchActivity();}} data-testid="refresh-users-btn">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            title="Total Users"
            value={stats?.total_users || 0}
            color="bg-primary/10 text-primary"
          />
          <StatCard
            icon={UserCheck}
            title="Active Users"
            value={stats?.active_users || 0}
            subValue={`${stats?.suspended_users || 0} suspended`}
            color="bg-emerald-500/10 text-emerald-500"
          />
          <StatCard
            icon={Monitor}
            title="Active Sessions"
            value={stats?.active_sessions || 0}
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard
            icon={AlertTriangle}
            title="Failed Logins (24h)"
            value={stats?.failed_logins_24h || 0}
            color="bg-amber-500/10 text-amber-500"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="users" data-testid="users-tab">
              <Users className="w-4 h-4 mr-2" /> Users
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="activity-tab">
              <History className="w-4 h-4 mr-2" /> Activity
            </TabsTrigger>
            <TabsTrigger value="sessions" data-testid="sessions-tab">
              <Monitor className="w-4 h-4 mr-2" /> Sessions
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Search & Filters */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="search-users-input"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36" data-testid="status-filter">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="deactivated">Deactivated</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-36" data-testid="role-filter">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="enumerator">Enumerator</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Actions */}
                  {selectedUsers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedUsers.length} selected</Badge>
                      <Button size="sm" variant="outline" onClick={() => handleBulkAction('suspend')} data-testid="bulk-suspend-btn">
                        <UserX className="w-4 h-4 mr-1" /> Suspend
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleBulkAction('activate')} data-testid="bulk-activate-btn">
                        <UserCheck className="w-4 h-4 mr-1" /> Activate
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.length === users.length && users.length > 0}
                            onCheckedChange={toggleAllUsers}
                            data-testid="select-all-users"
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead className="text-center">Sessions</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(user => (
                        <UserRow
                          key={user.user_id}
                          user={user}
                          isSelected={selectedUsers.includes(user.user_id)}
                          onSelect={() => toggleUserSelection(user.user_id)}
                          onViewDetails={(u) => { setSelectedUser(u); setShowUserDetails(true); }}
                          onEdit={(u) => { setSelectedUser(u); setShowEditUser(true); }}
                          onAction={handleUserAction}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <Card className="lg:col-span-2 bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-2">
                      {allActivity.length > 0 ? (
                        allActivity.map((activity, idx) => (
                          <ActivityItem key={idx} activity={activity} />
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No activity recorded</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Suspicious Activity */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle className="w-5 h-5" /> Suspicious Activity
                  </CardTitle>
                  <CardDescription>Users with multiple failed logins (24h)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {suspiciousActivity.length > 0 ? (
                        suspiciousActivity.map((item, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-amber-500/10 text-amber-500 text-xs">
                                    {item.user_name?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{item.user_name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">{item.user_email}</p>
                                </div>
                              </div>
                              <Badge variant="destructive">{item.failed_count} failed</Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No suspicious activity</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="w-5 h-5" /> Active Sessions
                    </CardTitle>
                    <CardDescription>{activeSessions.length} active sessions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {activeSessions.length > 0 ? (
                      activeSessions.map((session, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-accent/30">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {session.user_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{session.user_name}</p>
                              <p className="text-sm text-muted-foreground">{session.user_email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Globe className="w-3 h-3" />
                                {session.ip_address || 'Unknown IP'}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Last active: {session.last_activity ? formatDistanceToNow(new Date(session.last_activity), { addSuffix: true }) : 'Unknown'}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-emerald-500">Active</Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-12">No active sessions</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <UserDetailsDrawer
          user={selectedUser}
          isOpen={showUserDetails}
          onClose={() => { setShowUserDetails(false); setSelectedUser(null); }}
          onRefresh={fetchUsers}
        />

        <EditUserDialog
          user={selectedUser}
          isOpen={showEditUser}
          onClose={() => { setShowEditUser(false); setSelectedUser(null); }}
          onSave={handleUpdateUser}
        />

        <PasswordPolicyDialog
          isOpen={showPasswordPolicy}
          onClose={() => setShowPasswordPolicy(false)}
          policy={passwordPolicy}
          onSave={handleSavePasswordPolicy}
        />
      </div>
    </DashboardLayout>
  );
};

export default UserManagementPage;
