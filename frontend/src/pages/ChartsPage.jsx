import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import {
  PieChart,
  BarChart3,
  LineChart,
  Plus,
  Trash2,
  Search,
  TrendingUp,
  Sparkles,
  Settings2,
  Maximize2,
  X,
  Save,
  Eye,
  Palette,
  ScatterChart,
  Radar,
  Activity,
  Target,
  Layers,
  ChevronRight,
  Download,
  Copy,
  Check,
  ArrowLeft,
  FileDown,
  ZoomIn,
  Filter,
  RefreshCw,
  MessageSquare,
  Minus,
  Type,
  AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Annotation types for charts
const ANNOTATION_TYPES = [
  { value: 'text', label: 'Text Label', icon: Type, description: 'Add a text note at a specific point' },
  { value: 'line', label: 'Reference Line', icon: Minus, description: 'Draw a horizontal or vertical line' },
  { value: 'region', label: 'Highlight Region', icon: Layers, description: 'Shade an area on the chart' },
];

// Extended chart types with ECharts support
const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3, category: 'Basic' },
  { value: 'line', label: 'Line Chart', icon: LineChart, category: 'Basic' },
  { value: 'pie', label: 'Pie Chart', icon: PieChart, category: 'Basic' },
  { value: 'area', label: 'Area Chart', icon: TrendingUp, category: 'Basic' },
  { value: 'scatter', label: 'Scatter Plot', icon: ScatterChart, category: 'Advanced' },
  { value: 'radar', label: 'Radar Chart', icon: Radar, category: 'Advanced' },
  { value: 'funnel', label: 'Funnel Chart', icon: Target, category: 'Advanced' },
  { value: 'gauge', label: 'Gauge Chart', icon: Activity, category: 'Advanced' },
  { value: 'heatmap', label: 'Heatmap', icon: Layers, category: 'Advanced' },
];

// Color themes for charts
const COLOR_THEMES = {
  violet: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9'],
  ocean: ['#06b6d4', '#22d3ee', '#67e8f9', '#0891b2', '#0e7490'],
  forest: ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857'],
  sunset: ['#f59e0b', '#fbbf24', '#fcd34d', '#d97706', '#b45309'],
  berry: ['#ec4899', '#f472b6', '#f9a8d4', '#db2777', '#be185d'],
  mono: ['#6b7280', '#9ca3af', '#d1d5db', '#4b5563', '#374151'],
};

// Generate annotation config for ECharts markLine and markPoint
const generateAnnotationConfig = (annotations = [], data = []) => {
  const markLine = { data: [], silent: false, symbol: ['none', 'none'] };
  const markPoint = { data: [], symbol: 'pin', symbolSize: 40 };
  const markArea = { data: [] };
  
  annotations.forEach(annotation => {
    if (annotation.type === 'line') {
      if (annotation.axis === 'y') {
        // Horizontal reference line
        markLine.data.push({
          name: annotation.label || '',
          yAxis: annotation.value,
          label: { 
            show: true, 
            formatter: annotation.label || `${annotation.value}`,
            position: 'end',
            color: annotation.color || '#f59e0b'
          },
          lineStyle: { 
            color: annotation.color || '#f59e0b', 
            type: annotation.lineStyle || 'dashed',
            width: 2
          }
        });
      } else {
        // Vertical reference line (at x-axis point)
        markLine.data.push({
          name: annotation.label || '',
          xAxis: annotation.value,
          label: { 
            show: true, 
            formatter: annotation.label || annotation.value,
            position: 'end',
            color: annotation.color || '#f59e0b'
          },
          lineStyle: { 
            color: annotation.color || '#f59e0b', 
            type: annotation.lineStyle || 'dashed',
            width: 2
          }
        });
      }
    } else if (annotation.type === 'text') {
      // Find the data point index for the x value
      const dataIndex = data.findIndex(d => d.name === annotation.xValue);
      if (dataIndex >= 0) {
        markPoint.data.push({
          name: annotation.label,
          coord: [annotation.xValue, annotation.yValue || data[dataIndex]?.value],
          value: annotation.label,
          label: {
            show: true,
            formatter: annotation.label,
            color: '#fff',
            fontSize: 10
          },
          itemStyle: { color: annotation.color || '#8b5cf6' }
        });
      }
    } else if (annotation.type === 'region') {
      markArea.data.push([
        { 
          name: annotation.label || '',
          xAxis: annotation.startX,
          itemStyle: { 
            color: (annotation.color || '#8b5cf6') + '30' // Add transparency
          },
          label: {
            show: true,
            position: 'insideTop',
            formatter: annotation.label || '',
            color: annotation.color || '#8b5cf6'
          }
        },
        { xAxis: annotation.endX }
      ]);
    }
  });
  
  return { markLine, markPoint, markArea };
};

// Generate ECharts options based on chart type and data
const generateChartOptions = (chartType, data, config, theme = 'violet') => {
  const colors = COLOR_THEMES[theme] || COLOR_THEMES.violet;
  const annotations = config?.annotations || [];
  const annotationConfig = generateAnnotationConfig(annotations, data);
  
  const baseOptions = {
    color: colors,
    tooltip: {
      trigger: chartType === 'pie' ? 'item' : 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'transparent',
      textStyle: { color: '#fff' },
    },
    legend: {
      show: config?.showLegend !== false,
      bottom: 0,
      textStyle: { color: '#888' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: config?.showLegend !== false ? '15%' : '8%',
      top: '10%',
      containLabel: true,
    },
  };

  if (!data || data.length === 0) {
    return { ...baseOptions, title: { text: 'No data available', left: 'center', top: 'center', textStyle: { color: '#888' } } };
  }

  switch (chartType) {
    case 'bar':
      return {
        ...baseOptions,
        xAxis: {
          type: 'category',
          data: data.map(d => d.name),
          axisLabel: { color: '#888', rotate: data.length > 8 ? 45 : 0 },
          axisLine: { lineStyle: { color: '#333' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#888' },
          splitLine: { lineStyle: { color: '#222' } },
        },
        series: [{
          type: 'bar',
          data: data.map(d => d.value),
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(139, 92, 246, 0.5)' } },
          markLine: annotationConfig.markLine,
          markPoint: annotationConfig.markPoint,
          markArea: annotationConfig.markArea,
        }],
      };

    case 'line':
      return {
        ...baseOptions,
        xAxis: {
          type: 'category',
          data: data.map(d => d.name),
          axisLabel: { color: '#888' },
          axisLine: { lineStyle: { color: '#333' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#888' },
          splitLine: { lineStyle: { color: '#222' } },
        },
        series: [{
          type: 'line',
          data: data.map(d => d.value),
          smooth: config?.smooth !== false,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3 },
          areaStyle: config?.showArea ? { opacity: 0.3 } : undefined,
          markLine: annotationConfig.markLine,
          markPoint: annotationConfig.markPoint,
          markArea: annotationConfig.markArea,
        }],
      };

    case 'area':
      return {
        ...baseOptions,
        xAxis: {
          type: 'category',
          data: data.map(d => d.name),
          axisLabel: { color: '#888' },
          axisLine: { lineStyle: { color: '#333' } },
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#888' },
          splitLine: { lineStyle: { color: '#222' } },
        },
        series: [{
          type: 'line',
          data: data.map(d => d.value),
          smooth: true,
          areaStyle: { opacity: 0.6 },
          lineStyle: { width: 2 },
          markLine: annotationConfig.markLine,
          markPoint: annotationConfig.markPoint,
          markArea: annotationConfig.markArea,
        }],
      };

    case 'pie':
      return {
        ...baseOptions,
        series: [{
          type: 'pie',
          radius: config?.donut ? ['40%', '70%'] : '70%',
          center: ['50%', '45%'],
          data: data.map((d, i) => ({ 
            name: d.name, 
            value: d.value,
            itemStyle: { borderRadius: 4, borderColor: '#1a1a2e', borderWidth: 2 }
          })),
          label: {
            show: config?.showLabels !== false,
            color: '#888',
            formatter: '{b}: {d}%',
          },
          emphasis: {
            itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 0, 0, 0.5)' },
            label: { show: true, fontWeight: 'bold' },
          },
        }],
      };

    case 'scatter':
      return {
        ...baseOptions,
        xAxis: {
          type: 'value',
          axisLabel: { color: '#888' },
          splitLine: { lineStyle: { color: '#222' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#888' },
          splitLine: { lineStyle: { color: '#222' } },
        },
        series: [{
          type: 'scatter',
          data: data.map((d, i) => [i, d.value]),
          symbolSize: 12,
          itemStyle: { opacity: 0.8 },
        }],
      };

    case 'radar':
      const maxValue = Math.max(...data.map(d => d.value));
      return {
        ...baseOptions,
        radar: {
          indicator: data.map(d => ({ name: d.name, max: maxValue * 1.2 })),
          shape: 'polygon',
          splitNumber: 4,
          axisName: { color: '#888' },
          splitLine: { lineStyle: { color: '#333' } },
          splitArea: { areaStyle: { color: ['rgba(139, 92, 246, 0.1)', 'transparent'] } },
        },
        series: [{
          type: 'radar',
          data: [{ value: data.map(d => d.value), name: 'Values' }],
          areaStyle: { opacity: 0.3 },
          lineStyle: { width: 2 },
        }],
      };

    case 'funnel':
      const sortedData = [...data].sort((a, b) => b.value - a.value);
      return {
        ...baseOptions,
        series: [{
          type: 'funnel',
          left: '10%',
          top: 60,
          bottom: 60,
          width: '80%',
          min: 0,
          max: Math.max(...data.map(d => d.value)),
          minSize: '0%',
          maxSize: '100%',
          sort: 'descending',
          gap: 2,
          label: { show: true, position: 'inside', color: '#fff' },
          emphasis: { label: { fontSize: 14 } },
          data: sortedData.map(d => ({ name: d.name, value: d.value })),
        }],
      };

    case 'gauge':
      const total = data.reduce((sum, d) => sum + d.value, 0);
      const avg = total / data.length;
      return {
        ...baseOptions,
        series: [{
          type: 'gauge',
          center: ['50%', '60%'],
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: Math.max(...data.map(d => d.value)) * 1.2,
          splitNumber: 5,
          itemStyle: { color: colors[0] },
          progress: { show: true, width: 20 },
          pointer: { show: true, length: '60%', width: 6 },
          axisLine: { lineStyle: { width: 20, color: [[1, '#333']] } },
          axisTick: { distance: -30, lineStyle: { color: '#888' } },
          splitLine: { distance: -35, lineStyle: { color: '#888' } },
          axisLabel: { distance: -25, color: '#888', fontSize: 12 },
          detail: { 
            valueAnimation: true, 
            color: colors[0],
            fontSize: 24,
            offsetCenter: [0, '70%'],
          },
          data: [{ value: Math.round(avg), name: 'Average' }],
        }],
      };

    case 'heatmap':
      // Simplified heatmap
      const heatData = data.map((d, i) => [i % 5, Math.floor(i / 5), d.value]);
      return {
        ...baseOptions,
        grid: { ...baseOptions.grid, top: '10%' },
        xAxis: { type: 'category', data: data.slice(0, 5).map(d => d.name), axisLabel: { color: '#888' } },
        yAxis: { type: 'category', data: ['Row 1', 'Row 2'], axisLabel: { color: '#888' } },
        visualMap: {
          min: 0,
          max: Math.max(...data.map(d => d.value)),
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          inRange: { color: ['#1a1a2e', colors[0]] },
          textStyle: { color: '#888' },
        },
        series: [{
          type: 'heatmap',
          data: heatData,
          emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
        }],
      };

    default:
      return baseOptions;
  }
};

// Chart Preview Component
const ChartPreview = ({ chartType, data, config, theme, fullscreen, onClose }) => {
  const options = useMemo(() => 
    generateChartOptions(chartType, data, config, theme),
    [chartType, data, config, theme]
  );

  if (fullscreen) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Chart Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-[500px]">
            <ReactECharts
              option={options}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ReactECharts
      option={options}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
};

// Chart Studio Mode - Full editor
const ChartStudio = ({ 
  datasets, 
  chartData, 
  onSave, 
  onCancel, 
  initialChart = null,
  token,
  orgId 
}) => {
  const [activeTab, setActiveTab] = useState('data');
  const [selectedDataset, setSelectedDataset] = useState(initialChart?.dataset_id || '');
  const [chartName, setChartName] = useState(initialChart?.name || '');
  const [chartType, setChartType] = useState(initialChart?.type || 'bar');
  const [xField, setXField] = useState(initialChart?.config?.x_field || '');
  const [yField, setYField] = useState(initialChart?.config?.y_field || '');
  const [aggregation, setAggregation] = useState(initialChart?.config?.aggregation || 'count');
  const [colorTheme, setColorTheme] = useState(initialChart?.config?.theme || 'violet');
  const [showLegend, setShowLegend] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [isDonut, setIsDonut] = useState(false);
  const [isSmooth, setIsSmooth] = useState(true);
  const [showArea, setShowArea] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  
  // Annotations state
  const [annotations, setAnnotations] = useState(initialChart?.config?.annotations || []);
  const [showAnnotationDialog, setShowAnnotationDialog] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    type: 'line',
    label: '',
    axis: 'y',
    value: '',
    color: '#f59e0b',
    lineStyle: 'dashed',
    xValue: '',
    yValue: '',
    startX: '',
    endX: ''
  });

  const currentDataset = datasets.find(d => d.id === selectedDataset);

  // Fetch preview data when dataset/fields change
  useEffect(() => {
    if (selectedDataset && xField) {
      fetchPreviewData();
    }
  }, [selectedDataset, xField, yField, aggregation]);

  const fetchPreviewData = async () => {
    if (!selectedDataset || !xField) return;
    
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(
        `${API_URL}/api/datasets/${selectedDataset}/data?limit=1000`,
        { headers }
      );
      
      const data = response.data.data || [];
      
      // Group and aggregate data
      const grouped = {};
      data.forEach(row => {
        const key = String(row[xField] || 'Unknown');
        if (!grouped[key]) {
          grouped[key] = { values: [], count: 0 };
        }
        grouped[key].count++;
        if (yField && row[yField] !== undefined) {
          grouped[key].values.push(Number(row[yField]) || 0);
        }
      });
      
      // Calculate aggregated values
      const chartData = Object.entries(grouped).map(([name, group]) => {
        let value;
        if (aggregation === 'count' || !yField) {
          value = group.count;
        } else if (aggregation === 'sum') {
          value = group.values.reduce((a, b) => a + b, 0);
        } else if (aggregation === 'mean') {
          value = group.values.length > 0 
            ? group.values.reduce((a, b) => a + b, 0) / group.values.length 
            : 0;
        } else if (aggregation === 'max') {
          value = Math.max(...group.values);
        } else if (aggregation === 'min') {
          value = Math.min(...group.values);
        } else {
          value = group.count;
        }
        return { name, value: Math.round(value * 100) / 100 };
      });
      
      // Sort and limit
      chartData.sort((a, b) => b.value - a.value);
      setPreviewData(chartData.slice(0, 20));
    } catch (error) {
      console.error('Error fetching preview data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get AI suggestions
  const getAISuggestions = async () => {
    if (!selectedDataset) return;
    
    setAiSuggesting(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(
        `${API_URL}/api/ai/suggest-charts?dataset_id=${selectedDataset}`,
        {},
        { headers }
      );
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      toast.error('Could not get AI suggestions');
    } finally {
      setAiSuggesting(false);
    }
  };

  const applySuggestion = (suggestion) => {
    setChartName(suggestion.title);
    setChartType(suggestion.type);
    setXField(suggestion.x_field);
    setYField(suggestion.y_field || '');
    toast.success('Applied AI suggestion');
  };

  const handleSave = () => {
    if (!chartName.trim()) {
      toast.error('Please enter a chart name');
      return;
    }
    if (!selectedDataset) {
      toast.error('Please select a dataset');
      return;
    }
    if (!xField) {
      toast.error('Please select an X-axis field');
      return;
    }

    onSave({
      name: chartName,
      type: chartType,
      dataset_id: selectedDataset,
      config: {
        x_field: xField,
        y_field: yField,
        aggregation,
        theme: colorTheme,
        showLegend,
        showLabels,
        donut: isDonut,
        smooth: isSmooth,
        showArea,
        annotations,
      }
    });
  };
  
  // Add new annotation
  const handleAddAnnotation = () => {
    if (!newAnnotation.label) {
      toast.error('Please enter a label for the annotation');
      return;
    }
    
    const annotation = { ...newAnnotation, id: Date.now().toString() };
    setAnnotations([...annotations, annotation]);
    setShowAnnotationDialog(false);
    setNewAnnotation({
      type: 'line',
      label: '',
      axis: 'y',
      value: '',
      color: '#f59e0b',
      lineStyle: 'dashed',
      xValue: '',
      yValue: '',
      startX: '',
      endX: ''
    });
    toast.success('Annotation added');
  };
  
  // Delete annotation
  const handleDeleteAnnotation = (id) => {
    setAnnotations(annotations.filter(a => a.id !== id));
    toast.success('Annotation removed');
  };

  const config = {
    showLegend,
    showLabels,
    donut: isDonut,
    smooth: isSmooth,
    showArea,
    annotations,
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6" data-testid="chart-studio">
      {/* Left Panel - Configuration */}
      <div className="w-full lg:w-[380px] flex-shrink-0">
        <Card className="h-full">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Chart Configuration</CardTitle>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <ScrollArea className="h-[calc(100%-140px)]">
            <div className="p-4 space-y-6">
              {/* Chart Name */}
              <div className="space-y-2">
                <Label>Chart Name *</Label>
                <Input
                  value={chartName}
                  onChange={(e) => setChartName(e.target.value)}
                  placeholder="Enter chart name..."
                  data-testid="chart-name-input"
                />
              </div>

              {/* Dataset Selection */}
              <div className="space-y-2">
                <Label>Dataset *</Label>
                <Select value={selectedDataset} onValueChange={(v) => {
                  setSelectedDataset(v);
                  setXField('');
                  setYField('');
                  setSuggestions([]);
                }}>
                  <SelectTrigger data-testid="dataset-select">
                    <SelectValue placeholder="Select a dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name} ({dataset.row_count} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDataset && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={getAISuggestions}
                    disabled={aiSuggesting}
                  >
                    <Sparkles className={`w-4 h-4 mr-2 ${aiSuggesting ? 'animate-pulse' : ''}`} />
                    {aiSuggesting ? 'Analyzing...' : 'Get AI Suggestions'}
                  </Button>
                )}
              </div>

              {/* AI Suggestions */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <Label className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      AI Recommendations
                    </Label>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {suggestions.slice(0, 3).map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => applySuggestion(suggestion)}
                          className="w-full text-left p-3 rounded-lg border border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                        >
                          <p className="font-medium text-sm text-foreground">{suggestion.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{suggestion.description}</p>
                          <Badge variant="secondary" className="mt-2">{suggestion.type}</Badge>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chart Type */}
              <div className="space-y-2">
                <Label>Chart Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CHART_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setChartType(type.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                        chartType === type.value
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-600'
                          : 'border-border hover:border-violet-300 text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`chart-type-${type.value}`}
                    >
                      <type.icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field Selection */}
              {currentDataset && (
                <>
                  <div className="space-y-2">
                    <Label>X-Axis Field (Category) *</Label>
                    <Select value={xField} onValueChange={setXField}>
                      <SelectTrigger data-testid="x-field-select">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentDataset.columns?.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name} <span className="text-muted-foreground">({col.type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Y-Axis Field (Value)</Label>
                    <Select 
                      value={yField || '__count__'} 
                      onValueChange={(v) => setYField(v === '__count__' ? '' : v)}
                    >
                      <SelectTrigger data-testid="y-field-select">
                        <SelectValue placeholder="Count (default)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__count__">Count (default)</SelectItem>
                        {currentDataset.columns
                          ?.filter(c => c.type.includes('int') || c.type.includes('float') || c.type === 'number')
                          .map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {yField && (
                    <div className="space-y-2">
                      <Label>Aggregation</Label>
                      <Select value={aggregation} onValueChange={setAggregation}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="mean">Average</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              {/* Style Options */}
              <div className="space-y-4 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Style Options
                </Label>
                
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Color Theme</Label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(COLOR_THEMES).map(([name, colors]) => (
                      <button
                        key={name}
                        onClick={() => setColorTheme(name)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          colorTheme === name ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Legend</Label>
                  <Switch checked={showLegend} onCheckedChange={setShowLegend} />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-sm">Show Labels</Label>
                  <Switch checked={showLabels} onCheckedChange={setShowLabels} />
                </div>

                {chartType === 'pie' && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Donut Style</Label>
                    <Switch checked={isDonut} onCheckedChange={setIsDonut} />
                  </div>
                )}

                {(chartType === 'line' || chartType === 'area') && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Smooth Curves</Label>
                    <Switch checked={isSmooth} onCheckedChange={setIsSmooth} />
                  </div>
                )}

                {chartType === 'line' && (
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Show Area Fill</Label>
                    <Switch checked={showArea} onCheckedChange={setShowArea} />
                  </div>
                )}
                
                {/* Annotations Section */}
                {(chartType === 'bar' || chartType === 'line' || chartType === 'area') && (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-amber-500" />
                        Annotations
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAnnotationDialog(true)}
                        data-testid="add-annotation-btn"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    
                    {annotations.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No annotations yet. Add reference lines, labels, or highlight regions.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {annotations.map((ann) => (
                          <div
                            key={ann.id}
                            className="flex items-center justify-between p-2 rounded-lg border bg-card"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: ann.color }}
                              />
                              <div>
                                <p className="text-xs font-medium">{ann.label}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">
                                  {ann.type} {ann.type === 'line' && `(${ann.axis === 'y' ? 'horizontal' : 'vertical'})`}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDeleteAnnotation(ann.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Annotation Dialog */}
          <Dialog open={showAnnotationDialog} onOpenChange={setShowAnnotationDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-500" />
                  Add Annotation
                </DialogTitle>
                <DialogDescription>
                  Add reference lines, text labels, or highlight regions to your chart
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Annotation Type */}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ANNOTATION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setNewAnnotation({ ...newAnnotation, type: type.value })}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                          newAnnotation.type === type.value
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-border hover:border-amber-300'
                        }`}
                      >
                        <type.icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Label */}
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={newAnnotation.label}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, label: e.target.value })}
                    placeholder="e.g., Target, Peak Sales, Promotion Period"
                    data-testid="annotation-label-input"
                  />
                </div>
                
                {/* Reference Line Options */}
                {newAnnotation.type === 'line' && (
                  <>
                    <div className="space-y-2">
                      <Label>Orientation</Label>
                      <Select
                        value={newAnnotation.axis}
                        onValueChange={(v) => setNewAnnotation({ ...newAnnotation, axis: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="y">Horizontal (at Y value)</SelectItem>
                          <SelectItem value="x">Vertical (at X category)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{newAnnotation.axis === 'y' ? 'Y Value' : 'X Category'}</Label>
                      <Input
                        value={newAnnotation.value}
                        onChange={(e) => setNewAnnotation({ ...newAnnotation, value: newAnnotation.axis === 'y' ? Number(e.target.value) : e.target.value })}
                        placeholder={newAnnotation.axis === 'y' ? 'e.g., 1000' : 'e.g., Category Name'}
                        type={newAnnotation.axis === 'y' ? 'number' : 'text'}
                        data-testid="annotation-value-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Line Style</Label>
                      <Select
                        value={newAnnotation.lineStyle}
                        onValueChange={(v) => setNewAnnotation({ ...newAnnotation, lineStyle: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="dashed">Dashed</SelectItem>
                          <SelectItem value="dotted">Dotted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* Text Label Options */}
                {newAnnotation.type === 'text' && (
                  <>
                    <div className="space-y-2">
                      <Label>X Category</Label>
                      <Select
                        value={newAnnotation.xValue}
                        onValueChange={(v) => setNewAnnotation({ ...newAnnotation, xValue: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select data point" />
                        </SelectTrigger>
                        <SelectContent>
                          {previewData.map((d) => (
                            <SelectItem key={d.name} value={d.name}>
                              {d.name} ({d.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* Region Options */}
                {newAnnotation.type === 'region' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Start X</Label>
                        <Select
                          value={newAnnotation.startX}
                          onValueChange={(v) => setNewAnnotation({ ...newAnnotation, startX: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Start" />
                          </SelectTrigger>
                          <SelectContent>
                            {previewData.map((d) => (
                              <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>End X</Label>
                        <Select
                          value={newAnnotation.endX}
                          onValueChange={(v) => setNewAnnotation({ ...newAnnotation, endX: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="End" />
                          </SelectTrigger>
                          <SelectContent>
                            {previewData.map((d) => (
                              <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Color Picker */}
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newAnnotation.color}
                      onChange={(e) => setNewAnnotation({ ...newAnnotation, color: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={newAnnotation.color}
                      onChange={(e) => setNewAnnotation({ ...newAnnotation, color: e.target.value })}
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAnnotationDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddAnnotation}
                  className="bg-amber-500 hover:bg-amber-600"
                  data-testid="save-annotation-btn"
                >
                  Add Annotation
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Save Button */}
          <div className="p-4 border-t">
            <Button
              onClick={handleSave}
              className="w-full bg-violet-600 hover:bg-violet-700"
              disabled={!chartName || !selectedDataset || !xField}
              data-testid="save-chart-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Chart
            </Button>
          </div>
        </Card>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 min-h-[400px] lg:min-h-0">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5 text-violet-600" />
                Live Preview
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFullscreen(true)}
                  disabled={previewData.length === 0}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-4 min-h-[300px]">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
              </div>
            ) : previewData.length > 0 ? (
              <ChartPreview
                chartType={chartType}
                data={previewData}
                config={config}
                theme={colorTheme}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground mb-2">No Preview Available</h3>
                <p className="text-sm text-muted-foreground max-w-[300px]">
                  Select a dataset and configure the X-axis field to see a live preview of your chart
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Preview */}
      {fullscreen && (
        <ChartPreview
          chartType={chartType}
          data={previewData}
          config={config}
          theme={colorTheme}
          fullscreen={true}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
};

// Main Charts Page Component
export function ChartsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrg } = useOrgStore();
  const { token } = useAuthStore();
  const [charts, setCharts] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [viewChart, setViewChart] = useState(null);
  const [chartViewData, setChartViewData] = useState([]);
  const [drillDownData, setDrillDownData] = useState(null);
  const [drillBreadcrumb, setDrillBreadcrumb] = useState([]);
  const [drillOptions, setDrillOptions] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Check if we're in studio mode (creating new chart)
  const isStudioMode = location.pathname === '/charts/new';

  useEffect(() => {
    fetchData();
  }, [currentOrg]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const orgParam = currentOrg?.id ? `?org_id=${currentOrg.id}` : '';
      
      const [chartsRes, datasetsRes] = await Promise.all([
        axios.get(`${API_URL}/api/charts${orgParam}`, { headers }),
        axios.get(`${API_URL}/api/datasets${orgParam}`, { headers })
      ]);
      
      setCharts(chartsRes.data.charts || []);
      setDatasets(datasetsRes.data.datasets || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (chartData) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_URL}/api/charts`, {
        ...chartData,
        org_id: currentOrg?.id
      }, { headers });
      
      toast.success('Chart created successfully');
      navigate('/charts');
      fetchData();
    } catch (error) {
      toast.error('Failed to create chart');
    }
  };

  const handleDelete = async (id) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_URL}/api/charts/${id}`, { headers });
      toast.success('Chart deleted');
      setDeleteDialog(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete chart');
    }
  };

  const handleViewChart = async (chart) => {
    setViewChart(chart);
    setDrillDownData(null);
    setDrillBreadcrumb([]);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dataRes, optionsRes] = await Promise.all([
        axios.get(`${API_URL}/api/charts/${chart.id}/data`, { headers }),
        axios.get(`${API_URL}/api/charts/${chart.id}/drill-options`, { headers })
      ]);
      setChartViewData(dataRes.data.data || []);
      setDrillOptions(optionsRes.data.drill_options || []);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartViewData([]);
      setDrillOptions([]);
    }
  };

  const handleDrillDown = async (filterField, filterValue) => {
    if (!viewChart) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API_URL}/api/charts/${viewChart.id}/drill-down`, {
        chart_id: viewChart.id,
        filter_field: filterField,
        filter_value: filterValue
      }, { headers });
      
      setDrillDownData(response.data);
      setChartViewData(response.data.data || []);
      setDrillBreadcrumb(prev => [...prev, { field: filterField, value: filterValue }]);
      setDrillOptions(response.data.drill_options || []);
      toast.success(`Filtered by ${filterField}: ${filterValue}`);
    } catch (error) {
      toast.error('Failed to drill down');
    }
  };

  const resetDrillDown = () => {
    setDrillDownData(null);
    setDrillBreadcrumb([]);
    if (viewChart) {
      handleViewChart(viewChart);
    }
  };

  const handleExportPdf = async (chartIds = null) => {
    setExportingPdf(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API_URL}/api/reports/export/pdf`, {
        chart_ids: chartIds || charts.map(c => c.id),
        include_data_tables: true,
        title: 'DataViz Studio Charts Report'
      }, { headers });
      
      if (response.data.status === 'success') {
        // Download PDF
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${response.data.pdf_base64}`;
        link.download = response.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('PDF exported successfully');
      }
    } catch (error) {
      toast.error('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const getChartIcon = (type) => {
    const chartType = CHART_TYPES.find(t => t.value === type);
    return chartType?.icon || BarChart3;
  };

  const filteredCharts = charts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Studio Mode
  if (isStudioMode) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-140px)]">
          <ChartStudio
            datasets={datasets}
            chartData={null}
            onSave={handleCreate}
            onCancel={() => navigate('/charts')}
            token={token}
            orgId={currentOrg?.id}
          />
        </div>
      </DashboardLayout>
    );
  }

  // List Mode
  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="charts-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chart Studio</h1>
            <p className="text-muted-foreground mt-1">
              Create powerful visualizations with AI-powered suggestions
            </p>
          </div>
          <div className="flex gap-2">
            {charts.length > 0 && (
              <Button
                variant="outline"
                onClick={() => handleExportPdf()}
                disabled={exportingPdf}
                data-testid="export-all-pdf-btn"
              >
                {exportingPdf ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                Export All to PDF
              </Button>
            )}
            <Button
              onClick={() => navigate('/charts/new')}
              className="bg-violet-600 hover:bg-violet-700"
              disabled={datasets.length === 0}
              data-testid="create-chart-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Chart
            </Button>
          </div>
        </div>

        {datasets.length === 0 && !loading && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">No datasets available</p>
                <p className="text-sm text-muted-foreground">
                  <button onClick={() => navigate('/upload')} className="text-violet-600 hover:underline">
                    Upload data
                  </button> first to create charts
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        {charts.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-charts-input"
            />
          </div>
        )}

        {/* Charts Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCharts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCharts.map((chart, index) => {
              const Icon = getChartIcon(chart.type);
              return (
                <motion.div
                  key={chart.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className="overflow-hidden hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-800 transition-all group cursor-pointer"
                    onClick={() => handleViewChart(chart)}
                    data-testid={`chart-card-${chart.id}`}
                  >
                    {/* Chart Preview */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4 relative">
                      <Icon className="w-16 h-16 text-violet-400/30" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <Badge 
                        className="absolute top-3 right-3 bg-violet-600/90"
                      >
                        {chart.type}
                      </Badge>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{chart.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {chart.config?.x_field && `${chart.config.x_field}`}
                            {chart.config?.y_field && ` vs ${chart.config.y_field}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog(chart);
                          }}
                          data-testid={`delete-chart-${chart.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
                <PieChart className="w-8 h-8 text-violet-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">No charts yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create your first chart to visualize your data with our AI-powered Chart Studio
              </p>
              <Button
                onClick={() => navigate('/charts/new')}
                className="bg-violet-600 hover:bg-violet-700"
                disabled={datasets.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Chart
              </Button>
            </CardContent>
          </Card>
        )}

        {/* View Chart Dialog with Drill-Down */}
        <Dialog open={!!viewChart} onOpenChange={() => {
          setViewChart(null);
          setDrillDownData(null);
          setDrillBreadcrumb([]);
        }}>
          <DialogContent className="max-w-5xl h-[85vh]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    {viewChart && React.createElement(getChartIcon(viewChart.type), { className: 'w-5 h-5 text-violet-600' })}
                    {viewChart?.name}
                  </DialogTitle>
                  <DialogDescription>
                    {viewChart?.config?.x_field && `X: ${viewChart.config.x_field}`}
                    {viewChart?.config?.y_field && ` | Y: ${viewChart.config.y_field}`}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportPdf([viewChart?.id])}
                    disabled={exportingPdf}
                  >
                    {exportingPdf ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    <span className="ml-2">Export PDF</span>
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            {/* Drill-down breadcrumb */}
            {drillBreadcrumb.length > 0 && (
              <div className="flex items-center gap-2 py-2 px-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg">
                <button 
                  onClick={resetDrillDown}
                  className="text-sm text-violet-600 hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Reset
                </button>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                {drillBreadcrumb.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    <Badge variant="secondary">
                      {crumb.field}: {crumb.value}
                    </Badge>
                    {idx < drillBreadcrumb.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </React.Fragment>
                ))}
                {drillDownData?.total_rows && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {drillDownData.total_rows} rows
                  </span>
                )}
              </div>
            )}

            <div className="flex-1 min-h-[350px]">
              {viewChart && (
                <ChartPreview
                  chartType={viewChart.type}
                  data={chartViewData}
                  config={viewChart.config || {}}
                  theme={viewChart.config?.theme || 'violet'}
                />
              )}
            </div>

            {/* Drill-down options */}
            {drillOptions.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ZoomIn className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-medium">Click to Drill Down</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {drillOptions.map((option) => (
                    <div key={option.field} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{option.field}</span>
                      <div className="flex flex-wrap gap-1">
                        {option.values?.slice(0, 5).map((value) => (
                          <Button
                            key={value}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleDrillDown(option.field, value)}
                          >
                            <Filter className="w-3 h-3 mr-1" />
                            {String(value).substring(0, 15)}
                          </Button>
                        ))}
                        {option.values?.length > 5 && (
                          <Badge variant="secondary" className="h-7">
                            +{option.values.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Chart</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteDialog?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteDialog?.id)}
                data-testid="confirm-delete-btn"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default ChartsPage;
