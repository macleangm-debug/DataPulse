import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudOff,
  Cloud,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  ArrowRight,
  GitMerge,
  Clock,
  Database,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from './ui/alert';
import { syncManager, offlineStorage } from '../lib/offlineStorage';
import { toast } from 'sonner';

// Network Status Banner
export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = async () => {
    try {
      const pending = await offlineStorage.getPendingSubmissions();
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Failed to load pending count');
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load pending count
    loadPendingCount();

    // Listen for sync events
    const unsubscribe = syncManager.addListener((event) => {
      if (event.type === 'sync_complete') {
        loadPendingCount();
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 p-2 ${
        isOnline ? 'bg-yellow-500/90' : 'bg-red-500/90'
      }`}
    >
      <div className="container mx-auto flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              <Cloud className="w-4 h-4" />
              <span className="text-sm font-medium">
                {pendingCount} submission{pendingCount !== 1 ? 's' : ''} pending sync
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">You&apos;re offline</span>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="bg-white/20">
                  {pendingCount} pending
                </Badge>
              )}
            </>
          )}
        </div>
        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/20 hover:bg-white/30"
            onClick={() => syncManager.syncPendingSubmissions()}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Sync Now
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Conflict Resolution Dialog
export function ConflictResolutionDialog({ conflict, onResolve, onClose }) {
  const [strategy, setStrategy] = useState('server_wins');
  const [resolving, setResolving] = useState(false);
  const [expandedField, setExpandedField] = useState(null);

  const localData = conflict.local?.data || {};
  const serverData = conflict.server?.data || {};
  
  // Find conflicting fields
  const allFields = new Set([...Object.keys(localData), ...Object.keys(serverData)]);
  const conflicts = [];
  const matches = [];

  allFields.forEach(field => {
    const localVal = localData[field];
    const serverVal = serverData[field];
    
    if (JSON.stringify(localVal) !== JSON.stringify(serverVal)) {
      conflicts.push({ field, local: localVal, server: serverVal });
    } else {
      matches.push({ field, value: localVal });
    }
  });

  const handleResolve = async () => {
    setResolving(true);
    try {
      let resolvedData;
      
      if (strategy === 'server_wins') {
        resolvedData = serverData;
      } else if (strategy === 'client_wins') {
        resolvedData = localData;
      } else if (strategy === 'merge') {
        // Merge: use newer values
        const localTime = new Date(conflict.local.updated_at || conflict.local.created_at).getTime();
        const serverTime = new Date(conflict.server.updated_at || conflict.server.created_at).getTime();
        
        resolvedData = localTime > serverTime ? { ...serverData, ...localData } : { ...localData, ...serverData };
      }

      await syncManager.resolveConflictManually(conflict.local.local_id, resolvedData);
      toast.success('Conflict resolved');
      onResolve?.(resolvedData);
      onClose();
    } catch (error) {
      toast.error('Failed to resolve conflict');
    } finally {
      setResolving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-yellow-500" />
            Resolve Sync Conflict
          </DialogTitle>
          <DialogDescription>
            This submission was modified both locally and on the server. Choose how to resolve.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-500">Local Version</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(conflict.local?.updated_at || conflict.local?.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">Server Version</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(conflict.server?.updated_at || conflict.server?.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Conflicting Fields */}
              {conflicts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Conflicting Fields ({conflicts.length})
                  </h4>
                  <div className="space-y-2">
                    {conflicts.map((c, i) => (
                      <div
                        key={i}
                        className="border border-yellow-500/30 rounded-lg overflow-hidden"
                      >
                        <div
                          className="flex items-center justify-between p-3 bg-yellow-500/5 cursor-pointer"
                          onClick={() => setExpandedField(expandedField === c.field ? null : c.field)}
                        >
                          <span className="font-mono text-sm text-white">{c.field}</span>
                          {expandedField === c.field ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <AnimatePresence>
                          {expandedField === c.field && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-2 gap-2 p-3 bg-card/30">
                                <div className="p-2 bg-blue-500/10 rounded">
                                  <p className="text-[10px] text-blue-500 mb-1">Local</p>
                                  <pre className="text-xs text-white overflow-auto max-h-20">
                                    {JSON.stringify(c.local, null, 2)}
                                  </pre>
                                </div>
                                <div className="p-2 bg-green-500/10 rounded">
                                  <p className="text-[10px] text-green-500 mb-1">Server</p>
                                  <pre className="text-xs text-white overflow-auto max-h-20">
                                    {JSON.stringify(c.server, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Fields */}
              {matches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Matching Fields ({matches.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {matches.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {m.field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Resolution Strategy */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-white">Resolution Strategy</h4>
                <RadioGroup value={strategy} onValueChange={setStrategy}>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
                      <RadioGroupItem value="server_wins" id="server" className="mt-1" />
                      <div>
                        <p className="font-medium text-white">Keep Server Version</p>
                        <p className="text-xs text-gray-400">Discard local changes and use the server version</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
                      <RadioGroupItem value="client_wins" id="client" className="mt-1" />
                      <div>
                        <p className="font-medium text-white">Keep Local Version</p>
                        <p className="text-xs text-gray-400">Override server with your local changes</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
                      <RadioGroupItem value="merge" id="merge" className="mt-1" />
                      <div>
                        <p className="font-medium text-white">Smart Merge</p>
                        <p className="text-xs text-gray-400">Automatically merge using the most recent value for each field</p>
                      </div>
                    </label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleResolve} disabled={resolving}>
            {resolving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Resolving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Resolve Conflict
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sync Status Panel
export function SyncStatusPanel({ isOpen, onClose }) {
  const [syncState, setSyncState] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingSubmissions: [],
    syncedSubmissions: [],
    failedSubmissions: [],
    conflicts: []
  });
  const [selectedConflict, setSelectedConflict] = useState(null);

  const loadSyncState = async () => {
    try {
      const pending = await offlineStorage.getPendingSubmissions();
      const synced = await offlineStorage.getSyncedSubmissions?.() || [];
      const failed = await offlineStorage.getFailedSubmissions?.() || [];
      const conflicts = syncManager.getConflictQueue();

      setSyncState(prev => ({
        ...prev,
        pendingSubmissions: pending,
        syncedSubmissions: synced,
        failedSubmissions: failed,
        conflicts
      }));
    } catch (error) {
      console.error('Failed to load sync state');
    }
  };

  useEffect(() => {
    loadSyncState();

    const unsubscribe = syncManager.addListener((event) => {
      switch (event.type) {
        case 'online':
        case 'offline':
          setSyncState(prev => ({ ...prev, isOnline: event.type === 'online' }));
          break;
        case 'sync_start':
          setSyncState(prev => ({ ...prev, isSyncing: true }));
          break;
        case 'sync_complete':
          setSyncState(prev => ({ ...prev, isSyncing: false }));
          loadSyncState();
          break;
        case 'conflict_detected':
          loadSyncState();
          break;
        default:
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSync = () => {
    syncManager.syncPendingSubmissions();
  };

  const handleResolveConflict = () => {
    setSelectedConflict(null);
    loadSyncState();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {syncState.isOnline ? (
              <Cloud className="w-5 h-5 text-green-500" />
            ) : (
              <CloudOff className="w-5 h-5 text-red-500" />
            )}
            Sync Status
          </SheetTitle>
          <SheetDescription>
            Manage offline data and sync conflicts
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Connection Status */}
          <div className={`p-4 rounded-lg ${syncState.isOnline ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {syncState.isOnline ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                <span className={`font-medium ${syncState.isOnline ? 'text-green-500' : 'text-red-500'}`}>
                  {syncState.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {syncState.isOnline && syncState.pendingSubmissions.length > 0 && (
                <Button size="sm" onClick={handleSync} disabled={syncState.isSyncing}>
                  {syncState.isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Sync
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Sync Progress */}
          {syncState.isSyncing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Syncing...</span>
              </div>
              <Progress value={30} className="h-2" />
            </div>
          )}

          {/* Conflicts */}
          {syncState.conflicts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-yellow-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Conflicts ({syncState.conflicts.length})
              </h4>
              <div className="space-y-2">
                {syncState.conflicts.map((conflict, i) => (
                  <div key={i} className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                    <p className="text-sm text-white mb-2">
                      Submission: {conflict.local?.local_id || `#${i + 1}`}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedConflict(conflict)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
              <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-yellow-500">
                {syncState.pendingSubmissions.length}
              </p>
              <p className="text-[10px] text-gray-500">Pending</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <Check className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-green-500">
                {syncState.syncedSubmissions.length}
              </p>
              <p className="text-[10px] text-gray-500">Synced</p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg text-center">
              <X className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-red-500">
                {syncState.failedSubmissions.length}
              </p>
              <p className="text-[10px] text-gray-500">Failed</p>
            </div>
          </div>

          {/* Pending List */}
          {syncState.pendingSubmissions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white">Pending Submissions</h4>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {syncState.pendingSubmissions.map((sub, i) => (
                    <div key={i} className="p-3 bg-card/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white">{sub.local_id}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {sub.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(sub.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Conflict Resolution Dialog */}
        {selectedConflict && (
          <ConflictResolutionDialog
            conflict={selectedConflict}
            onResolve={handleResolveConflict}
            onClose={() => setSelectedConflict(null)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
