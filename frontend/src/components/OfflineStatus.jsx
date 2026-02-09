import React, { useState } from 'react';
import { useOfflineSync, SYNC_STATUS } from '../lib/useOfflineSync';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertTriangle, 
  Database, HardDrive, Upload, Clock, AlertCircle
} from 'lucide-react';

/**
 * Offline Status Indicator
 * Shows connection status and pending sync count
 */
export function OfflineStatusIndicator({ showDetails = false }) {
  const { 
    isOnline, 
    syncStatus, 
    pendingCount, 
    lastSyncTime,
    triggerSync 
  } = useOfflineSync();

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4 text-red-500" />;
    if (syncStatus === SYNC_STATUS.SYNCING) return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    if (syncStatus === SYNC_STATUS.SUCCESS) return <Check className="w-4 h-4 text-green-500" />;
    if (syncStatus === SYNC_STATUS.ERROR) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (pendingCount > 0) return <Cloud className="w-4 h-4 text-yellow-500" />;
    return <Wifi className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus === SYNC_STATUS.SYNCING) return 'Syncing...';
    if (syncStatus === SYNC_STATUS.SUCCESS) return 'Synced';
    if (syncStatus === SYNC_STATUS.ERROR) return 'Sync Error';
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Online';
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500/10 text-red-500 border-red-500/30';
    if (syncStatus === SYNC_STATUS.SYNCING) return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    if (syncStatus === SYNC_STATUS.ERROR) return 'bg-red-500/10 text-red-500 border-red-500/30';
    if (pendingCount > 0) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    return 'bg-green-500/10 text-green-500 border-green-500/30';
  };

  if (!showDetails) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor()}`}
        data-testid="offline-status"
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
        {pendingCount > 0 && isOnline && syncStatus !== SYNC_STATUS.SYNCING && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 ml-1"
            onClick={() => triggerSync()}
          >
            <Upload className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="w-72">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Sync Status</CardTitle>
          <Badge className={getStatusColor()}>{getStatusText()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Connection</span>
          <span className="flex items-center gap-1">
            {isOnline ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pending</span>
          <span className="font-medium">{pendingCount} submissions</span>
        </div>
        
        {lastSyncTime && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Sync</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastSyncTime.toLocaleTimeString()}
            </span>
          </div>
        )}
        
        {pendingCount > 0 && isOnline && (
          <Button 
            className="w-full" 
            size="sm"
            onClick={() => triggerSync()}
            disabled={syncStatus === SYNC_STATUS.SYNCING}
          >
            {syncStatus === SYNC_STATUS.SYNCING ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Offline Banner
 * Shows when user is offline with pending submissions
 */
export function OfflineBanner() {
  const { isOnline, pendingCount, triggerSync, syncStatus } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 rounded-lg shadow-lg z-50 ${
        isOnline ? 'bg-yellow-500/90 text-yellow-950' : 'bg-red-500/90 text-white'
      }`}
      data-testid="offline-banner"
    >
      <div className="flex items-start gap-3">
        {isOnline ? (
          <Cloud className="w-5 h-5 mt-0.5" />
        ) : (
          <WifiOff className="w-5 h-5 mt-0.5" />
        )}
        
        <div className="flex-1">
          <p className="font-medium">
            {isOnline 
              ? `${pendingCount} submission${pendingCount > 1 ? 's' : ''} pending sync`
              : 'You are offline'
            }
          </p>
          <p className="text-sm opacity-90">
            {isOnline 
              ? 'Your data will be synced to the server'
              : `${pendingCount > 0 ? `${pendingCount} submission${pendingCount > 1 ? 's' : ''} saved locally. ` : ''}Data will sync when you reconnect.`
            }
          </p>
        </div>
        
        {isOnline && pendingCount > 0 && (
          <Button 
            size="sm" 
            variant="secondary"
            onClick={() => triggerSync()}
            disabled={syncStatus === SYNC_STATUS.SYNCING}
          >
            {syncStatus === SYNC_STATUS.SYNCING ? 'Syncing...' : 'Sync'}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Sync Progress Dialog
 * Shows detailed sync progress with conflict resolution
 */
export function SyncProgressDialog({ open, onOpenChange }) {
  const { 
    syncStatus, 
    syncProgress, 
    conflicts, 
    triggerSync, 
    resolveConflict 
  } = useOfflineSync();
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [conflictResolution, setConflictResolution] = useState('server');

  const handleResolveConflict = async () => {
    if (!selectedConflict) return;
    
    const resolvedData = conflictResolution === 'server' 
      ? selectedConflict.server.data 
      : selectedConflict.local.data;
    
    await resolveConflict(selectedConflict.local.local_id, resolvedData);
    setSelectedConflict(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync Progress</DialogTitle>
          <DialogDescription>
            Syncing your offline data to the server
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Progress */}
          {syncStatus === SYNC_STATUS.SYNCING && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Syncing submissions...</span>
                <span>{syncProgress.current} / {syncProgress.total}</span>
              </div>
              <Progress 
                value={syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0} 
              />
            </div>
          )}
          
          {/* Success */}
          {syncStatus === SYNC_STATUS.SUCCESS && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg">
              <Check className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-500">Sync Complete</p>
                <p className="text-sm text-muted-foreground">
                  {syncProgress.current} submissions synced successfully
                </p>
              </div>
            </div>
          )}
          
          {/* Error */}
          {syncStatus === SYNC_STATUS.ERROR && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-500">Sync Failed</p>
                <p className="text-sm text-muted-foreground">
                  Some submissions could not be synced. They will retry automatically.
                </p>
              </div>
            </div>
          )}
          
          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected</span>
              </div>
              
              <div className="space-y-2">
                {conflicts.map((conflict, index) => (
                  <div 
                    key={index}
                    className="p-3 border rounded-lg cursor-pointer hover:border-primary"
                    onClick={() => setSelectedConflict(conflict)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Submission #{conflict.local.local_id}
                      </span>
                      <Badge variant="outline">Needs Resolution</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Local: {new Date(conflict.local.created_at).toLocaleString()}
                      {' | '}
                      Server: {new Date(conflict.server.updated_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Conflict Resolution */}
          {selectedConflict && (
            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-medium">Resolve Conflict</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={conflictResolution === 'server' ? 'default' : 'outline'}
                  onClick={() => setConflictResolution('server')}
                  className="h-auto py-3"
                >
                  <div className="text-left">
                    <p className="font-medium">Use Server Version</p>
                    <p className="text-xs opacity-70">Keep the server's data</p>
                  </div>
                </Button>
                <Button
                  variant={conflictResolution === 'local' ? 'default' : 'outline'}
                  onClick={() => setConflictResolution('local')}
                  className="h-auto py-3"
                >
                  <div className="text-left">
                    <p className="font-medium">Use Local Version</p>
                    <p className="text-xs opacity-70">Keep your local data</p>
                  </div>
                </Button>
              </div>
              <Button className="w-full" onClick={handleResolveConflict}>
                Apply Resolution
              </Button>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {syncStatus !== SYNC_STATUS.SYNCING && (
            <Button onClick={() => triggerSync()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry Sync
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Storage Manager Component
 * Shows storage usage and allows clearing cached data
 */
export function StorageManager() {
  const { storageInfo, updateStorageInfo } = useOfflineSync();
  const [clearing, setClearing] = useState(false);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClearCache = async () => {
    if (!confirm('This will delete all cached forms and synced submissions. Pending submissions will be kept. Continue?')) {
      return;
    }

    setClearing(true);
    try {
      // Clear only cached forms, not pending submissions
      const { offlineStorage } = await import('../lib/offlineStorage');
      // Implementation would selectively clear caches
      await updateStorageInfo();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Offline Storage
        </CardTitle>
        <CardDescription>
          Manage cached data for offline use
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {storageInfo ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage Used</span>
                <span>{formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}</span>
              </div>
              <Progress value={parseFloat(storageInfo.usagePercent)} />
              <p className="text-xs text-muted-foreground">
                {storageInfo.usagePercent}% of available storage
              </p>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleClearCache}
              disabled={clearing}
            >
              {clearing ? 'Clearing...' : 'Clear Cached Data'}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Storage information not available
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default OfflineStatusIndicator;
