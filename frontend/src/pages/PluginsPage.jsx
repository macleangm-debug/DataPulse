import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { pluginManager, widgetRegistry, defineWidget } from '../lib/pluginSDK';
import { 
  Puzzle, Plus, Code, Box, Settings, Power, PowerOff, Trash2,
  Upload, Download, RefreshCw, CheckCircle2, AlertCircle, Package
} from 'lucide-react';

export function PluginsPage() {
  const [plugins, setPlugins] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pluginUrl, setPluginUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshPlugins();
    registerExamplePlugins();
  }, []);

  const refreshPlugins = () => {
    setPlugins(pluginManager.getAll());
    setWidgets(widgetRegistry.getAll());
  };

  const registerExamplePlugins = () => {
    // Register example plugins if not already registered
    if (!pluginManager.plugins.has('rating-widget')) {
      pluginManager.register({
        id: 'rating-widget',
        name: 'Star Rating Widget',
        version: '1.0.0',
        description: 'Add star rating questions to your forms',
        author: 'DataPulse',
        widgets: [
          defineWidget({
            type: 'star_rating',
            label: 'Star Rating',
            icon: 'Star',
            category: 'rating',
            description: 'Let respondents rate using stars',
            defaults: {
              maxStars: 5,
              allowHalf: false
            },
            validate: (value, config) => {
              if (config.required && !value) {
                return 'Please provide a rating';
              }
              return null;
            }
          })
        ]
      });
    }

    if (!pluginManager.plugins.has('nps-widget')) {
      pluginManager.register({
        id: 'nps-widget',
        name: 'NPS Score Widget',
        version: '1.0.0',
        description: 'Net Promoter Score question type',
        author: 'DataPulse',
        widgets: [
          defineWidget({
            type: 'nps',
            label: 'NPS Score',
            icon: 'Gauge',
            category: 'rating',
            description: 'How likely are you to recommend...',
            defaults: {
              minLabel: 'Not likely',
              maxLabel: 'Very likely'
            }
          })
        ]
      });
    }

    if (!pluginManager.plugins.has('matrix-widget')) {
      pluginManager.register({
        id: 'matrix-widget',
        name: 'Matrix Question Widget',
        version: '1.0.0',
        description: 'Grid-style questions with rows and columns',
        author: 'DataPulse',
        widgets: [
          defineWidget({
            type: 'matrix',
            label: 'Matrix Question',
            icon: 'Grid3x3',
            category: 'advanced',
            description: 'Multiple questions with same answer options',
            defaults: {
              rows: [],
              columns: []
            }
          })
        ]
      });
    }

    refreshPlugins();
  };

  const handleEnablePlugin = async (pluginId) => {
    try {
      await pluginManager.enable(pluginId);
      toast.success('Plugin enabled');
      refreshPlugins();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDisablePlugin = async (pluginId) => {
    try {
      await pluginManager.disable(pluginId);
      toast.success('Plugin disabled');
      refreshPlugins();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleLoadFromUrl = async () => {
    if (!pluginUrl) return;
    
    setLoading(true);
    try {
      await pluginManager.loadFromUrl(pluginUrl);
      toast.success('Plugin loaded');
      setPluginUrl('');
      setShowAddDialog(false);
      refreshPlugins();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const enabledCount = plugins.filter(p => p.enabled).length;
  const widgetCount = widgets.filter(w => w.category === 'custom').length;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="plugins-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plugins & Widgets</h1>
            <p className="text-muted-foreground">Extend DataPulse with custom question types and widgets</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshPlugins}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Plugin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Plugin</DialogTitle>
                  <DialogDescription>Load a plugin from a URL or upload a plugin file</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Plugin URL</Label>
                    <Input
                      value={pluginUrl}
                      onChange={(e) => setPluginUrl(e.target.value)}
                      placeholder="https://example.com/plugin.js"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the URL of a DataPulse-compatible plugin script
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                  <Button onClick={handleLoadFromUrl} disabled={!pluginUrl || loading}>
                    {loading ? 'Loading...' : 'Load Plugin'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Puzzle className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{plugins.length}</p>
                  <p className="text-sm text-muted-foreground">Total Plugins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <Power className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{enabledCount}</p>
                  <p className="text-sm text-muted-foreground">Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Box className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{widgets.length}</p>
                  <p className="text-sm text-muted-foreground">Widget Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Package className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{widgetCount}</p>
                  <p className="text-sm text-muted-foreground">Custom Widgets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="plugins" className="space-y-4">
          <TabsList>
            <TabsTrigger value="plugins">Installed Plugins</TabsTrigger>
            <TabsTrigger value="widgets">Widget Registry</TabsTrigger>
            <TabsTrigger value="develop">Developer</TabsTrigger>
          </TabsList>

          <TabsContent value="plugins" className="space-y-4">
            {plugins.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Puzzle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No plugins installed</h3>
                  <p className="text-muted-foreground mb-4">Add plugins to extend DataPulse functionality</p>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Plugin
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {plugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    onEnable={() => handleEnablePlugin(plugin.id)}
                    onDisable={() => handleDisablePlugin(plugin.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="widgets" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {widgets.map((widget) => (
                <WidgetCard key={widget.type} widget={widget} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="develop" className="space-y-4">
            <DeveloperDocs />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function PluginCard({ plugin, onEnable, onDisable }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${plugin.enabled ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
              <Puzzle className={`w-6 h-6 ${plugin.enabled ? 'text-green-500' : 'text-gray-500'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{plugin.name}</h3>
                <Badge variant="outline">v{plugin.version}</Badge>
                <Badge variant={plugin.enabled ? 'default' : 'secondary'}>
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{plugin.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>By {plugin.author}</span>
                <span>{plugin.widgets.length} widget{plugin.widgets.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={plugin.enabled}
              onCheckedChange={(checked) => checked ? onEnable() : onDisable()}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetCard({ widget }) {
  const categoryColors = {
    basic: 'bg-blue-500/10 text-blue-500',
    advanced: 'bg-purple-500/10 text-purple-500',
    media: 'bg-green-500/10 text-green-500',
    rating: 'bg-yellow-500/10 text-yellow-500',
    custom: 'bg-orange-500/10 text-orange-500'
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${categoryColors[widget.category] || 'bg-gray-500/10'}`}>
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium">{widget.label}</h4>
            <p className="text-xs text-muted-foreground">{widget.type}</p>
          </div>
        </div>
        
        {widget.description && (
          <p className="text-sm text-muted-foreground mb-3">{widget.description}</p>
        )}
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">{widget.category}</Badge>
          <Badge variant="outline">v{widget.version}</Badge>
          {widget.features?.supportsOffline && (
            <Badge variant="secondary">Offline</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeveloperDocs() {
  const exampleCode = `// Example: Create a custom rating widget
import { defineWidget, pluginManager } from '@datapulse/sdk';

const ratingWidget = defineWidget({
  type: 'emoji_rating',
  label: 'Emoji Rating',
  icon: 'Smile',
  category: 'rating',
  description: 'Rate using emoji faces',
  
  defaults: {
    emojis: ['😞', '😐', '🙂', '😊', '😍'],
    required: false
  },
  
  validate: (value, config) => {
    if (config.required && !value) {
      return 'Please select a rating';
    }
    return null;
  },
  
  component: EmojiRatingComponent,
  editor: EmojiRatingEditor
});

// Register as a plugin
pluginManager.register({
  id: 'emoji-rating',
  name: 'Emoji Rating Plugin',
  version: '1.0.0',
  author: 'Your Name',
  widgets: [ratingWidget]
});

// Enable the plugin
await pluginManager.enable('emoji-rating');`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Plugin Development Guide
          </CardTitle>
          <CardDescription>
            Learn how to create custom widgets and plugins for DataPulse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Getting Started</h4>
            <p className="text-sm text-muted-foreground">
              DataPulse plugins allow you to extend the form builder with custom question types,
              validation rules, and rendering components. Plugins are written in JavaScript and
              can be loaded from external URLs or bundled with your application.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Plugin Structure</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><strong>id</strong> - Unique identifier for the plugin</li>
              <li><strong>name</strong> - Human-readable name</li>
              <li><strong>version</strong> - Semantic version number</li>
              <li><strong>widgets</strong> - Array of widget definitions</li>
              <li><strong>hooks</strong> - Lifecycle and event hooks</li>
              <li><strong>dependencies</strong> - Other plugins this depends on</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Example Code</h4>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              <code>{exampleCode}</code>
            </pre>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Widget Features</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-muted rounded">
                <strong>supportsMedia</strong> - Can capture photos/audio/video
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>supportsGPS</strong> - Can capture location
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>supportsOffline</strong> - Works without internet
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>supportsLogic</strong> - Can be used in skip logic
              </div>
              <div className="p-2 bg-muted rounded">
                <strong>supportsTranslation</strong> - Labels can be translated
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PluginsPage;
