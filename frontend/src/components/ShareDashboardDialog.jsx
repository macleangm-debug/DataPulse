import React, { useState, useEffect } from 'react';
import { Share2, Link as LinkIcon, Copy, Check, Lock, Globe, Calendar, Mail, Send, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const getAuthHeaders = () => ({ 'Authorization': `Bearer ${useAuthStore.getState().token}`, 'Content-Type': 'application/json' });

export function ShareDashboardDialog({ dashboardId, dashboardName, open, onOpenChange }) {
  const [shareSettings, setShareSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiresIn, setExpiresIn] = useState('never');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => { if (open && dashboardId) loadShareSettings(); }, [open, dashboardId]);

  const loadShareSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${dashboardId}/share`, { headers: getAuthHeaders() });
      if (response.ok) { const data = await response.json(); setShareSettings(data); setIsPublic(data.is_public || false); setPasswordProtected(data.password_protected || false); }
    } catch (error) { console.error('Failed to load share settings:', error); }
    finally { setLoading(false); }
  };

  const handleSaveShare = async () => {
    setSaving(true);
    try {
      let expiresAt = null;
      if (expiresIn !== 'never') { const date = new Date(); date.setDate(date.getDate() + parseInt(expiresIn)); expiresAt = date.toISOString(); }
      const response = await fetch(`${API_URL}/api/dashboards/${dashboardId}/share`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ is_public: isPublic, password_protected: passwordProtected, password: passwordProtected ? password : null, expires_at: expiresAt })
      });
      if (response.ok) { setShareSettings(await response.json()); toast.success(isPublic ? 'Public link created' : 'Share settings updated'); }
      else toast.error('Failed to update share settings');
    } catch (error) { toast.error('Failed to update share settings'); }
    finally { setSaving(false); }
  };

  const handleRevokeShare = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboards/${dashboardId}/share`, { method: 'DELETE', headers: getAuthHeaders() });
      if (response.ok) { setShareSettings(null); setIsPublic(false); setPasswordProtected(false); setPassword(''); toast.success('Public link revoked'); }
    } catch (error) { toast.error('Failed to revoke share'); }
  };

  const handleCopyLink = () => {
    if (shareSettings?.public_url) {
      const publicUrl = shareSettings.public_url.replace('/api/dashboards/public/', '/public/dashboard/').replace('/public/dashboard/', '/public/dashboard/');
      navigator.clipboard.writeText(publicUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Link copied to clipboard');
    }
  };

  const handleSendEmail = async () => {
    const recipients = emailRecipients.split(',').map(e => e.trim()).filter(e => e);
    if (recipients.length === 0) { toast.error('Please enter at least one email address'); return; }
    setSendingEmail(true);
    try {
      const response = await fetch(`${API_URL}/api/reports/send`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ dashboard_id: dashboardId, recipients, subject: `Dashboard: ${dashboardName}`, message: emailMessage || `Check out this dashboard: ${dashboardName}` })
      });
      if (response.ok) { toast.success(`Dashboard sent to ${recipients.length} recipient(s)`); setEmailRecipients(''); setEmailMessage(''); }
      else { const error = await response.json(); toast.error(error.detail || 'Failed to send email'); }
    } catch (error) { toast.error('Failed to send email'); }
    finally { setSendingEmail(false); }
  };

  const getPublicUrl = () => {
    if (!shareSettings?.public_url) return '';
    // Ensure we're getting the frontend URL, not API URL
    const baseUrl = window.location.origin;
    const publicId = shareSettings.public_id;
    return `${baseUrl}/public/dashboard/${publicId}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="w-5 h-5" />Share Dashboard</DialogTitle>
          <DialogDescription>Share "{dashboardName}" with others via link or email</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2"><LinkIcon className="w-4 h-4" />Public Link</TabsTrigger>
            <TabsTrigger value="email" className="gap-2"><Mail className="w-4 h-4" />Email</TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-3"><Globe className="w-5 h-5 text-primary" /><div><p className="font-medium text-white">Public Access</p><p className="text-xs text-gray-400">Anyone with the link can view</p></div></div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} data-testid="public-access-toggle" />
            </div>
            {isPublic && (<>
              <div className="space-y-3 p-4 bg-card/50 rounded-lg border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><Lock className="w-5 h-5 text-amber-500" /><div><p className="font-medium text-white">Password Protection</p><p className="text-xs text-gray-400">Require password to view</p></div></div>
                  <Switch checked={passwordProtected} onCheckedChange={setPasswordProtected} data-testid="password-protection-toggle" />
                </div>
                {passwordProtected && (
                  <div className="relative mt-3">
                    <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" className="pr-10" data-testid="share-password-input" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />Link Expiration</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger data-testid="expiration-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never expires</SelectItem>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveShare} disabled={saving || (passwordProtected && !password)} className="w-full" data-testid="save-share-settings">{saving ? 'Saving...' : shareSettings?.public_id ? 'Update Settings' : 'Create Public Link'}</Button>
              {shareSettings?.public_id && (
                <div className="space-y-3 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-green-500/20 text-green-400"><Check className="w-3 h-3 mr-1" />Link Active</Badge>
                    <Button variant="ghost" size="sm" onClick={handleRevokeShare} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4 mr-1" />Revoke</Button>
                  </div>
                  <div className="flex gap-2">
                    <Input value={getPublicUrl()} readOnly className="text-xs font-mono" />
                    <Button variant="outline" size="icon" onClick={handleCopyLink} data-testid="copy-link-btn">{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</Button>
                  </div>
                  {shareSettings.password_protected && <div className="flex items-center gap-2 text-xs text-amber-400"><Lock className="w-3 h-3" />Password protected</div>}
                </div>
              )}
            </>)}
          </TabsContent>
          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Recipients</Label><Input value={emailRecipients} onChange={(e) => setEmailRecipients(e.target.value)} placeholder="email@example.com, another@example.com" data-testid="email-recipients-input" /><p className="text-xs text-gray-400">Separate multiple emails with commas</p></div>
            <div className="space-y-2"><Label>Message (optional)</Label><Input value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Check out this dashboard..." data-testid="email-message-input" /></div>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !emailRecipients.trim()} className="w-full" data-testid="send-email-btn">{sendingEmail ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Dashboard</>}</Button>
            <p className="text-xs text-gray-400 text-center">Recipients will receive an email with a link to view the dashboard</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default ShareDashboardDialog;
