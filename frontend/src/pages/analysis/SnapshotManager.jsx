import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../../components/ui/dialog';
import { Database, Plus, Calendar, FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function SnapshotManager({
  snapshots = [],
  selectedSnapshotId,
  loading = false,
  onSelectSnapshot,
  onCreateSnapshot
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSnapshot, setNewSnapshot] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newSnapshot.name.trim()) return;
    
    setCreating(true);
    await onCreateSnapshot?.(newSnapshot.name, newSnapshot.description);
    setCreating(false);
    setIsCreateOpen(false);
    setNewSnapshot({ name: '', description: '' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="font-barlow text-lg">Dataset Snapshots</CardTitle>
              <CardDescription>Immutable analysis-ready datasets</CardDescription>
            </div>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create Snapshot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Dataset Snapshot</DialogTitle>
                <DialogDescription>
                  Create an immutable copy of the current data for analysis
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="snapshot-name">Name</Label>
                  <Input
                    id="snapshot-name"
                    placeholder="e.g., Baseline Survey Q1 2026"
                    value={newSnapshot.name}
                    onChange={(e) => setNewSnapshot({ ...newSnapshot, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snapshot-desc">Description (optional)</Label>
                  <Textarea
                    id="snapshot-desc"
                    placeholder="Brief description of this dataset version..."
                    value={newSnapshot.description}
                    onChange={(e) => setNewSnapshot({ ...newSnapshot, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newSnapshot.name.trim() || creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Snapshot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : snapshots.length > 0 ? (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedSnapshotId === snapshot.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onClick={() => onSelectSnapshot?.(snapshot.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{snapshot.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {snapshot.record_count || '?'} records
                    </Badge>
                  </div>
                  {snapshot.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {snapshot.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {snapshot.created_at 
                        ? formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true })
                        : 'Unknown date'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-center text-muted-foreground py-4">No snapshots yet</p>
        )}
      </CardContent>
    </Card>
  );
}

export default SnapshotManager;
