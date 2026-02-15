/**
 * DataPulse - Device Management Page
 * Enterprise device control with remote wipe capability.
 */

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { 
  Smartphone, 
  Tablet, 
  Monitor, 
  Globe,
  Shield,
  ShieldAlert,
  ShieldOff,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-500', icon: CheckCircle },
  locked: { label: 'Locked', color: 'bg-yellow-500', icon: Lock },
  pending_lock: { label: 'Pending Lock', color: 'bg-yellow-500', icon: Lock },
  pending_wipe: { label: 'Pending Wipe', color: 'bg-red-500', icon: AlertTriangle },
  wiped: { label: 'Wiped', color: 'bg-gray-500', icon: ShieldOff },
  revoked: { label: 'Revoked', color: 'bg-red-700', icon: XCircle }
};

const DEVICE_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  pwa: Globe,
  web: Globe
};

export function DeviceManagementPage() {
  const { currentOrg, user } = useAuthStore();
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (currentOrg?.id) {
      fetchDevices();
      fetchStats();
    }
  }, [currentOrg?.id]);

  const fetchDevices = async () => {
    try {
      const url = filterStatus === 'all' 
        ? `${API_URL}/api/devices/${currentOrg.id}`
        : `${API_URL}/api/devices/${currentOrg.id}?status=${filterStatus}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${currentOrg.id}/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchActivityLogs = async (deviceId) => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${deviceId}/activity`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    }
  };

  const handleWipeDevice = async (deviceId, reason) => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${deviceId}/wipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Admin-Id': user.id
        },
        body: JSON.stringify({ reason, wipe_type: 'full', notify_user: true })
      });

      if (response.ok) {
        toast.success('Remote wipe initiated');
        fetchDevices();
      } else {
        toast.error('Failed to initiate wipe');
      }
    } catch (error) {
      toast.error('Failed to initiate wipe');
    }
  };

  const handleLockDevice = async (deviceId, reason) => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${deviceId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Admin-Id': user.id
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Device locked. Unlock code: ${data.unlock_code}`);
        fetchDevices();
      } else {
        toast.error('Failed to lock device');
      }
    } catch (error) {
      toast.error('Failed to lock device');
    }
  };

  const handleUnlockDevice = async (deviceId) => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${deviceId}/unlock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Admin-Id': user.id
        }
      });

      if (response.ok) {
        toast.success('Device unlocked');
        fetchDevices();
      } else {
        toast.error('Failed to unlock device');
      }
    } catch (error) {
      toast.error('Failed to unlock device');
    }
  };

  const handleRevokeDevice = async (deviceId, reason) => {
    try {
      const response = await fetch(`${API_URL}/api/devices/${deviceId}/revoke?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Admin-Id': user.id
        }
      });

      if (response.ok) {
        toast.success('Device revoked');
        fetchDevices();
      } else {
        toast.error('Failed to revoke device');
      }
    } catch (error) {
      toast.error('Failed to revoke device');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="device-management-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Device Management
            </h1>
            <p className="text-muted-foreground">
              Monitor and control field devices with remote wipe capability
            </p>
          </div>
          <Button onClick={fetchDevices} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.total_devices || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Devices</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.by_status?.active || 0}</div>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.by_status?.locked || 0}</div>
                  <p className="text-xs text-muted-foreground">Locked</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{(stats.by_status?.pending_wipe || 0) + (stats.by_status?.wiped || 0)}</div>
                  <p className="text-xs text-muted-foreground">Wiped</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.active_last_24h || 0}</div>
                  <p className="text-xs text-muted-foreground">Active 24h</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-4">
          <Label>Filter by Status:</Label>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
              <SelectItem value="pending_wipe">Pending Wipe</SelectItem>
              <SelectItem value="wiped">Wiped</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchDevices}>Apply</Button>
        </div>

        {/* Device List */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Devices</CardTitle>
            <CardDescription>All devices registered in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : devices.length > 0 ? (
              <div className="space-y-3">
                {devices.map(device => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onWipe={handleWipeDevice}
                    onLock={handleLockDevice}
                    onUnlock={handleUnlockDevice}
                    onRevoke={handleRevokeDevice}
                    onViewActivity={() => {
                      setSelectedDevice(device);
                      fetchActivityLogs(device.id);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No devices registered</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Dialog */}
        <Dialog open={!!selectedDevice} onOpenChange={() => setSelectedDevice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Device Activity</DialogTitle>
              <DialogDescription>
                {selectedDevice?.device_name} - {selectedDevice?.id}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {activityLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 border rounded">
                  <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                    {log.details && (
                      <p className="text-xs mt-1">{JSON.stringify(log.details)}</p>
                    )}
                  </div>
                </div>
              ))}
              {activityLogs.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No activity logs</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

/**
 * Individual Device Card
 */
function DeviceCard({ device, onWipe, onLock, onUnlock, onRevoke, onViewActivity }) {
  const [wipeReason, setWipeReason] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);

  const statusConfig = STATUS_CONFIG[device.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;
  const DeviceIcon = DEVICE_ICONS[device.device_type] || Smartphone;

  const isOnline = device.last_seen && 
    (new Date() - new Date(device.last_seen)) < 5 * 60 * 1000; // 5 minutes

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-muted rounded-lg">
          <DeviceIcon className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{device.device_name}</span>
            <Badge variant="outline" className="text-xs">
              {device.device_type}
            </Badge>
            <Badge className={`${statusConfig.color} text-white text-xs`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <span>ID: {device.id.slice(0, 12)}...</span>
            {device.os_name && <span className="ml-2">{device.os_name} {device.os_version}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className={`flex items-center gap-1 ${isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {device.last_seen && (
              <span className="text-muted-foreground">
                Last seen: {new Date(device.last_seen).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onViewActivity}>
          <Eye className="h-4 w-4" />
        </Button>

        {device.status === 'active' && (
          <>
            {/* Lock Button */}
            <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Lock className="h-4 w-4 mr-1" />
                  Lock
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Lock Device</DialogTitle>
                  <DialogDescription>
                    This will prevent the device from being used until unlocked.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Reason</Label>
                    <Textarea
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                      placeholder="Enter reason for locking..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowLockDialog(false)}>Cancel</Button>
                  <Button onClick={() => { onLock(device.id, lockReason); setShowLockDialog(false); }}>
                    Lock Device
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Wipe Button */}
            <Dialog open={showWipeDialog} onOpenChange={setShowWipeDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Wipe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Remote Wipe
                  </DialogTitle>
                  <DialogDescription>
                    This will permanently delete all data on the device. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Reason (required)</Label>
                    <Textarea
                      value={wipeReason}
                      onChange={(e) => setWipeReason(e.target.value)}
                      placeholder="Enter reason for wiping..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowWipeDialog(false)}>Cancel</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => { onWipe(device.id, wipeReason); setShowWipeDialog(false); }}
                    disabled={!wipeReason.trim()}
                  >
                    Confirm Wipe
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {(device.status === 'locked' || device.status === 'pending_lock') && (
          <Button variant="outline" size="sm" onClick={() => onUnlock(device.id)}>
            <Unlock className="h-4 w-4 mr-1" />
            Unlock
          </Button>
        )}

        {device.status !== 'revoked' && (
          <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <ShieldOff className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Revoke Device</DialogTitle>
                <DialogDescription>
                  Permanently revoke access for this device. The user will need to re-register.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>Cancel</Button>
                <Button 
                  variant="destructive"
                  onClick={() => { onRevoke(device.id, 'Admin revoked'); setShowRevokeDialog(false); }}
                >
                  Revoke Access
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

export default DeviceManagementPage;
