/**
 * Qualitative Project Workspace
 * Main workspace for coding and analysis
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../components/ui/resizable';
import {
  ArrowLeft,
  Plus,
  FileText,
  Code,
  MessageSquare,
  Lightbulb,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Upload,
  ChevronRight,
  ChevronDown,
  Highlighter,
  Tag,
  X,
  Check,
  BookOpen,
  Palette,
  GripVertical,
  Eye,
  Sparkles,
  Mic,
  Wand2,
  Shield,
  FileBarChart,
  Users,
  Brain,
  Loader2,
  AlertTriangle,
  Download,
  Archive,
  Table,
  Quote,
  BarChart3,
  Network,
  Grid3X3
} from 'lucide-react';
import { useOrgStore } from '../store';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Code colors for selection
const CODE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

export default function QualitativeWorkspacePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentOrg } = useOrgStore();
  
  // State
  const [project, setProject] = useState(null);
  const [sources, setSources] = useState([]);
  const [codes, setCodes] = useState([]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [activeTab, setActiveTab] = useState('sources');
  const [loading, setLoading] = useState(true);
  
  // Coding state
  const [selection, setSelection] = useState(null);
  const [showCodeSelector, setShowCodeSelector] = useState(false);
  const [codeSelectorPosition, setCodeSelectorPosition] = useState({ x: 0, y: 0 });
  const [recentCodes, setRecentCodes] = useState([]);
  
  // AI Features state
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [piiFindings, setPiiFindings] = useState([]);
  const [themes, setThemes] = useState([]);
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportContent, setReportContent] = useState(null);
  
  // Dialogs
  const [showAddSource, setShowAddSource] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', content: '', source_type: 'transcript' });
  const [newCode, setNewCode] = useState({ name: '', definition: '', color: '#3B82F6', parent_id: null });
  
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load project data
  useEffect(() => {
    if (currentOrg?.id && projectId) {
      loadProject();
      loadSources();
      loadCodes();
    }
  }, [currentOrg, projectId]);

  const loadProject = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/projects/${projectId}?org_id=${currentOrg.id}`
      );
      if (response.ok) {
        setProject(await response.json());
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadSources = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/sources?project_id=${projectId}&org_id=${currentOrg.id}`
      );
      if (response.ok) {
        setSources(await response.json());
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCodes = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/codes?project_id=${projectId}&org_id=${currentOrg.id}&flat=true`
      );
      if (response.ok) {
        setCodes(await response.json());
      }
    } catch (error) {
      console.error('Failed to load codes:', error);
    }
  };

  const loadSourceContent = async (sourceId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/sources/${sourceId}?org_id=${currentOrg.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setSelectedSource(data);
      }
    } catch (error) {
      console.error('Failed to load source:', error);
      toast.error('Failed to load source content');
    }
  };

  // Create source
  const createSource = async () => {
    if (!newSource.name.trim() || !newSource.content.trim()) {
      toast.error('Name and content are required');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/sources?org_id=${currentOrg.id}&user_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            name: newSource.name,
            content: newSource.content,
            source_type: newSource.source_type
          })
        }
      );

      if (response.ok) {
        toast.success('Source added');
        setShowAddSource(false);
        setNewSource({ name: '', content: '', source_type: 'transcript' });
        loadSources();
      }
    } catch (error) {
      console.error('Failed to create source:', error);
      toast.error('Failed to add source');
    }
  };

  // Create code
  const createCode = async () => {
    if (!newCode.name.trim()) {
      toast.error('Code name is required');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/codes?org_id=${currentOrg.id}&user_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            name: newCode.name,
            definition: newCode.definition,
            color: newCode.color,
            parent_id: newCode.parent_id
          })
        }
      );

      if (response.ok) {
        toast.success('Code created');
        setShowAddCode(false);
        setNewCode({ name: '', definition: '', color: '#3B82F6', parent_id: null });
        loadCodes();
      }
    } catch (error) {
      console.error('Failed to create code:', error);
      toast.error('Failed to create code');
    }
  };

  // ==================== AI FEATURES ====================
  
  // Get AI coding suggestions for selected text
  const getAiSuggestions = async () => {
    if (!selection || !selectedSource) return;
    
    setAiLoading(true);
    setAiSuggestions([]);
    
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/suggest-codes?project_id=${projectId}&org_id=${currentOrg.id}&source_id=${selectedSource.id}&excerpt_text=${encodeURIComponent(selection.text)}&start_char=${selection.startChar}&end_char=${selection.endChar}&max_suggestions=5`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions || []);
        if (data.suggestions?.length === 0) {
          toast.info('No matching codes found for this excerpt');
        }
      }
    } catch (error) {
      console.error('AI suggestions error:', error);
      toast.error('Failed to get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-code the entire source
  const autoCodeSource = async () => {
    if (!selectedSource) {
      toast.error('Select a source first');
      return;
    }
    
    setAiLoading(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/auto-code-source/${selectedSource.id}?org_id=${currentOrg.id}&user_id=${currentOrg.id}&confidence_threshold=medium`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Auto-coded ${data.codings_created} segments`);
        loadSourceContent(selectedSource.id);
      }
    } catch (error) {
      console.error('Auto-code error:', error);
      toast.error('Failed to auto-code source');
    } finally {
      setAiLoading(false);
    }
  };

  // Detect PII in source
  const detectPii = async () => {
    if (!selectedSource) {
      toast.error('Select a source first');
      return;
    }
    
    setAiLoading(true);
    setPiiFindings([]);
    
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/detect-pii/${selectedSource.id}?org_id=${currentOrg.id}&use_ai=true`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPiiFindings(data.findings || []);
        if (data.pii_count > 0) {
          toast.warning(`Found ${data.pii_count} PII instances`);
        } else {
          toast.success('No PII detected');
        }
      }
    } catch (error) {
      console.error('PII detection error:', error);
      toast.error('Failed to detect PII');
    } finally {
      setAiLoading(false);
    }
  };

  // Anonymize source
  const anonymizeSource = async () => {
    if (!selectedSource) return;
    
    setAiLoading(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/anonymize/${selectedSource.id}?org_id=${currentOrg.id}&user_id=${currentOrg.id}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.anonymized) {
          toast.success(`Anonymized ${data.pii_replaced} PII instances`);
          loadSourceContent(selectedSource.id);
          setPiiFindings([]);
        } else {
          toast.info(data.message);
        }
      }
    } catch (error) {
      console.error('Anonymize error:', error);
      toast.error('Failed to anonymize source');
    } finally {
      setAiLoading(false);
    }
  };

  // Synthesize themes from coded data
  const synthesizeThemes = async () => {
    setAiLoading(true);
    setThemes([]);
    
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/synthesize-themes?project_id=${projectId}&org_id=${currentOrg.id}&user_id=${currentOrg.id}&min_codings=2`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);
        if (data.themes_created > 0) {
          toast.success(`Synthesized ${data.themes_created} draft themes`);
        } else {
          toast.info(data.message);
        }
      }
    } catch (error) {
      console.error('Theme synthesis error:', error);
      toast.error('Failed to synthesize themes');
    } finally {
      setAiLoading(false);
    }
  };

  // Transcribe audio file
  const handleTranscribe = async (file) => {
    if (!file) return;
    
    setTranscribing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/transcribe?project_id=${projectId}&org_id=${currentOrg.id}&user_id=${currentOrg.id}&language=en`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Transcribed: ${data.source_name} (${data.word_count} words)`);
        setShowTranscribe(false);
        loadSources();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to transcribe audio');
    } finally {
      setTranscribing(false);
    }
  };

  // Generate report
  const generateReport = async (format = 'markdown') => {
    setAiLoading(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/ai/generate-report/${projectId}?org_id=${currentOrg.id}&user_id=${currentOrg.id}&format=${format}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setReportContent(data.content);
        setShowReport(true);
        toast.success('Report generated');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error('Failed to generate report');
    } finally {
      setAiLoading(false);
    }
  };

  // Handle text selection for coding
  const handleTextSelection = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed || !selectedSource) return;

    const range = windowSelection.getRangeAt(0);
    const container = contentRef.current;
    
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const selectedText = windowSelection.toString().trim();
    if (!selectedText) return;

    // Calculate character positions
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startChar = preSelectionRange.toString().length;
    const endChar = startChar + selectedText.length;

    // Get position for code selector popup
    const rect = range.getBoundingClientRect();
    
    setSelection({
      text: selectedText,
      startChar,
      endChar
    });

    setCodeSelectorPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10
    });

    setShowCodeSelector(true);
  }, [selectedSource]);

  // Apply code to selection
  const applyCode = async (code) => {
    if (!selection || !selectedSource) return;

    try {
      const response = await fetch(
        `${API_URL}/api/qualitative/codings?org_id=${currentOrg.id}&user_id=${currentOrg.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            source_id: selectedSource.id,
            code_id: code.id,
            start_char: selection.startChar,
            end_char: selection.endChar,
            excerpt_text: selection.text
          })
        }
      );

      if (response.ok) {
        toast.success(`Applied code: ${code.name}`);
        
        // Update recent codes
        setRecentCodes(prev => {
          const filtered = prev.filter(c => c.id !== code.id);
          return [code, ...filtered].slice(0, 5);
        });

        // Reload source to show new coding
        loadSourceContent(selectedSource.id);
        loadCodes(); // Update counts
      }
    } catch (error) {
      console.error('Failed to apply code:', error);
      toast.error('Failed to apply code');
    } finally {
      setShowCodeSelector(false);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  // Render content with highlighted codings
  const renderHighlightedContent = () => {
    if (!selectedSource) return null;

    const content = selectedSource.content;
    const codings = selectedSource.codings || [];

    if (codings.length === 0) {
      return <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>;
    }

    // Sort codings by start position
    const sortedCodings = [...codings].sort((a, b) => a.start_char - b.start_char);

    // Build highlighted content
    const parts = [];
    let lastEnd = 0;

    sortedCodings.forEach((coding, idx) => {
      // Add text before this coding
      if (coding.start_char > lastEnd) {
        parts.push(
          <span key={`text-${idx}`}>
            {content.slice(lastEnd, coding.start_char)}
          </span>
        );
      }

      // Add highlighted coding
      parts.push(
        <mark
          key={`coding-${idx}`}
          className="rounded px-0.5 cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: `${coding.code_color}30`, borderBottom: `2px solid ${coding.code_color}` }}
          title={codes.find(c => c.id === coding.code_id)?.name || 'Code'}
        >
          {content.slice(coding.start_char, coding.end_char)}
        </mark>
      );

      lastEnd = coding.end_char;
    });

    // Add remaining text
    if (lastEnd < content.length) {
      parts.push(<span key="text-end">{content.slice(lastEnd)}</span>);
    }

    return <div className="whitespace-pre-wrap text-sm leading-relaxed">{parts}</div>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/qualitative')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{project?.name}</h1>
              <p className="text-sm text-muted-foreground">
                {sources.length} sources • {codes.length} codes
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowTranscribe(true)}>
                  <Mic className="w-4 h-4 mr-2" />
                  Transcribe Audio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={autoCodeSource} disabled={!selectedSource || aiLoading}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Auto-Code Source
                </DropdownMenuItem>
                <DropdownMenuItem onClick={detectPii} disabled={!selectedSource || aiLoading}>
                  <Shield className="w-4 h-4 mr-2" />
                  Detect PII
                </DropdownMenuItem>
                <DropdownMenuItem onClick={synthesizeThemes} disabled={aiLoading}>
                  <Brain className="w-4 h-4 mr-2" />
                  Synthesize Themes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateReport('markdown')} disabled={aiLoading}>
                  <FileBarChart className="w-4 h-4 mr-2" />
                  Generate Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => window.open(`${API_URL}/api/qualitative/export/refi-qda/${projectId}?org_id=${currentOrg?.id}`, '_blank')}>
                  <FileText className="w-4 h-4 mr-2" />
                  REFI-QDA (NVivo/ATLAS.ti)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`${API_URL}/api/qualitative/export/qdpx/${projectId}?org_id=${currentOrg?.id}`, '_blank')}>
                  <Archive className="w-4 h-4 mr-2" />
                  QDPX Package
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`${API_URL}/api/qualitative/export/codebook/${projectId}?org_id=${currentOrg?.id}&format=json`, '_blank')}>
                  <Code className="w-4 h-4 mr-2" />
                  Codebook (JSON)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`${API_URL}/api/qualitative/export/codings/${projectId}?org_id=${currentOrg?.id}&format=csv`, '_blank')}>
                  <Table className="w-4 h-4 mr-2" />
                  Codings (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`${API_URL}/api/qualitative/visuals/quote-cards/${projectId}/export?org_id=${currentOrg?.id}`, '_blank')}>
                  <Quote className="w-4 h-4 mr-2" />
                  Quote Cards (HTML)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Visualizations Button */}
            <Button variant="outline" size="sm" onClick={() => setShowVisuals(true)} className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Visuals
            </Button>
            
            <Button variant="outline" size="sm" onClick={() => setShowAddSource(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Add Source
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddCode(true)}>
              <Tag className="w-4 h-4 mr-2" />
              Add Code
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border">
          {/* Left Panel - Sources/Codes List */}
          <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="sources" className="flex-1 gap-1">
                  <FileText className="w-4 h-4" />
                  Sources
                </TabsTrigger>
                <TabsTrigger value="codes" className="flex-1 gap-1">
                  <Tag className="w-4 h-4" />
                  Codes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sources" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {sources.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No sources yet</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setShowAddSource(true)}
                        >
                          Add your first source
                        </Button>
                      </div>
                    ) : (
                      sources.map(source => (
                        <button
                          key={source.id}
                          onClick={() => loadSourceContent(source.id)}
                          className={cn(
                            "w-full text-left p-2 rounded-lg hover:bg-muted transition-colors",
                            selectedSource?.id === source.id && "bg-primary/10 border border-primary/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{source.name}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {source.coding_count}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {source.word_count} words • {source.source_type}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="codes" className="flex-1 m-0">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {codes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No codes yet</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setShowAddCode(true)}
                        >
                          Create your first code
                        </Button>
                      </div>
                    ) : (
                      codes.map(code => (
                        <div
                          key={code.id}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => {
                            // Quick apply if text is selected
                            if (selection) {
                              applyCode(code);
                            }
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: code.color }}
                          />
                          <span className="flex-1 text-sm truncate">{code.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {code.usage_count}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Content/Coding Studio */}
          <ResizablePanel defaultSize={75}>
            <div className="h-full flex flex-col">
              {selectedSource ? (
                <>
                  {/* Source Header */}
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-semibold">{selectedSource.name}</h2>
                        <p className="text-xs text-muted-foreground">
                          {selectedSource.word_count} words • 
                          {selectedSource.codings?.length || 0} codings
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {selectedSource.source_type}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Coding Instructions */}
                    <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                      <Highlighter className="w-4 h-4" />
                      <span>Select text to apply codes. Recently used codes appear first.</span>
                    </div>
                  </div>

                  {/* Content Area */}
                  <ScrollArea className="flex-1">
                    <div
                      ref={contentRef}
                      className="p-6 select-text"
                      onMouseUp={handleTextSelection}
                    >
                      {renderHighlightedContent()}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Select a source to start coding</p>
                    <p className="text-sm mt-1">Click on a source from the left panel</p>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Code Selector Popup */}
        {showCodeSelector && selection && (
          <div
            className="fixed z-50 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[200px]"
            style={{
              left: codeSelectorPosition.x,
              top: codeSelectorPosition.y,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
              Apply code to: "{selection.text.slice(0, 30)}..."
            </div>
            <Separator className="my-1" />
            
            {/* Recent codes */}
            {recentCodes.length > 0 && (
              <>
                <div className="text-[10px] text-muted-foreground px-2 py-1">Recent</div>
                {recentCodes.map(code => (
                  <button
                    key={code.id}
                    onClick={() => applyCode(code)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm text-left"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: code.color }}
                    />
                    {code.name}
                  </button>
                ))}
                <Separator className="my-1" />
              </>
            )}
            
            {/* All codes */}
            <div className="text-[10px] text-muted-foreground px-2 py-1">All Codes</div>
            <ScrollArea className="max-h-[200px]">
              {codes
                .filter(c => !recentCodes.find(r => r.id === c.id))
                .map(code => (
                  <button
                    key={code.id}
                    onClick={() => applyCode(code)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm text-left"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: code.color }}
                    />
                    {code.name}
                  </button>
                ))}
            </ScrollArea>
            
            <Separator className="my-1" />
            <button
              onClick={() => {
                setShowCodeSelector(false);
                setShowAddCode(true);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-sm text-primary"
            >
              <Plus className="w-3 h-3" />
              Create new code
            </button>
            
            <button
              onClick={getAiSuggestions}
              disabled={aiLoading}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-purple-50 text-sm text-purple-600"
            >
              {aiLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Get AI suggestions
            </button>
            
            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <>
                <Separator className="my-1" />
                <div className="text-[10px] text-purple-600 px-2 py-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Suggestions
                </div>
                {aiSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const code = codes.find(c => c.id === sug.code_id);
                      if (code) applyCode(code);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-purple-50 text-sm text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sug.code_color }}
                      />
                      <span>{sug.code_name}</span>
                    </div>
                    <Badge variant={sug.confidence === 'high' ? 'default' : 'secondary'} className="text-[9px]">
                      {sug.confidence}
                    </Badge>
                  </button>
                ))}
              </>
            )}
            
            <button
              onClick={() => {
                setShowCodeSelector(false);
                setSelection(null);
              }}
              className="absolute -top-2 -right-2 p-1 bg-muted rounded-full hover:bg-muted-foreground/20"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Add Source Dialog */}
        <Dialog open={showAddSource} onOpenChange={setShowAddSource}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Source</DialogTitle>
              <DialogDescription>
                Add a transcript, field notes, or other qualitative data
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Name *</Label>
                  <Input
                    placeholder="e.g., Interview_001_Participant_A"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <select
                    value={newSource.source_type}
                    onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="transcript">Transcript</option>
                    <option value="field_notes">Field Notes</option>
                    <option value="observation">Observation</option>
                    <option value="open_ended">Open-ended Responses</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Content *</Label>
                <Textarea
                  placeholder="Paste your transcript or notes here..."
                  value={newSource.content}
                  onChange={(e) => setNewSource({ ...newSource, content: e.target.value })}
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: Use "Speaker: text" format for transcripts. Timestamps like [00:00] will be detected.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSource(false)}>
                Cancel
              </Button>
              <Button onClick={createSource}>Add Source</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Code Dialog */}
        <Dialog open={showAddCode} onOpenChange={setShowAddCode}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Code</DialogTitle>
              <DialogDescription>
                Add a new code to your codebook
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Code Name *</Label>
                <Input
                  placeholder="e.g., Access Barriers"
                  value={newCode.name}
                  onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Definition</Label>
                <Textarea
                  placeholder="Define when this code should be applied..."
                  value={newCode.definition}
                  onChange={(e) => setNewCode({ ...newCode, definition: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {CODE_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCode({ ...newCode, color })}
                      className={cn(
                        "w-8 h-8 rounded-full transition-transform",
                        newCode.color === color && "ring-2 ring-offset-2 ring-primary scale-110"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              {codes.length > 0 && (
                <div className="space-y-2">
                  <Label>Parent Code (optional)</Label>
                  <select
                    value={newCode.parent_id || ''}
                    onChange={(e) => setNewCode({ ...newCode, parent_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">No parent (root level)</option>
                    {codes.map(code => (
                      <option key={code.id} value={code.id}>{code.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddCode(false)}>
                Cancel
              </Button>
              <Button onClick={createCode}>Create Code</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transcribe Audio Dialog */}
        <Dialog open={showTranscribe} onOpenChange={setShowTranscribe}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-purple-500" />
                Transcribe Audio
              </DialogTitle>
              <DialogDescription>
                Upload an audio file to transcribe using AI (OpenAI Whisper)
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleTranscribe(e.target.files[0]);
                  }
                }}
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  transcribing ? "border-purple-300 bg-purple-50" : "border-slate-200 hover:border-purple-300 hover:bg-purple-50/50"
                )}
              >
                {transcribing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                    <p className="text-purple-600 font-medium">Transcribing...</p>
                    <p className="text-sm text-muted-foreground">This may take a few moments</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Mic className="w-10 h-10 text-slate-400" />
                    <p className="font-medium">Click to upload audio file</p>
                    <p className="text-sm text-muted-foreground">
                      Supports: MP3, WAV, M4A, WebM (max 25MB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Preview Dialog */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5" />
                Analysis Report
              </DialogTitle>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh]">
              {typeof reportContent === 'string' ? (
                <div className="prose prose-sm max-w-none p-4 whitespace-pre-wrap font-mono text-xs bg-slate-50 rounded-lg">
                  {reportContent}
                </div>
              ) : (
                <pre className="p-4 bg-slate-50 rounded-lg text-xs overflow-auto">
                  {JSON.stringify(reportContent, null, 2)}
                </pre>
              )}
            </ScrollArea>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReport(false)}>
                Close
              </Button>
              <Button onClick={() => {
                const blob = new Blob([typeof reportContent === 'string' ? reportContent : JSON.stringify(reportContent, null, 2)], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project?.name || 'report'}_analysis.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PII Findings Panel */}
        {piiFindings.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-xl shadow-xl p-4 w-80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">PII Detected ({piiFindings.length})</span>
              </div>
              <button onClick={() => setPiiFindings([])} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <ScrollArea className="max-h-40 mb-3">
              <div className="space-y-1">
                {piiFindings.slice(0, 10).map((f, idx) => (
                  <div key={idx} className="text-xs p-2 bg-amber-50 rounded border border-amber-100">
                    <span className="font-medium text-amber-700">{f.type}:</span>{' '}
                    <span className="text-slate-600">{f.value}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <Button size="sm" className="w-full" onClick={anonymizeSource} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Anonymize All
            </Button>
          </div>
        )}

        {/* AI Themes Panel */}
        {themes.length > 0 && (
          <div className="fixed bottom-4 left-4 z-50 bg-card border rounded-xl shadow-xl p-4 w-96">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-purple-600">
                <Brain className="w-4 h-4" />
                <span className="font-medium text-sm">AI-Generated Themes ({themes.length})</span>
              </div>
              <button onClick={() => setThemes([])} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <ScrollArea className="max-h-60">
              <div className="space-y-2">
                {themes.map((theme, idx) => (
                  <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="font-medium text-sm text-purple-800">{theme.title}</div>
                    <p className="text-xs text-slate-600 mt-1">{theme.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {theme.related_codes?.map((code, cIdx) => (
                        <Badge key={cIdx} variant="secondary" className="text-[9px]">{code}</Badge>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {theme.evidence_count} supporting excerpts
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
