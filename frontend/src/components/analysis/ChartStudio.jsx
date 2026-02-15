/**
 * Chart Studio - Publication-quality chart creation
 * Supports multiple chart types with customization options
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { Slider } from '../ui/slider';
import {
  BarChart3,
  PieChart,
  LineChart as LineChartIcon,
  ScatterChart,
  Settings,
  Download,
  Palette,
  Type,
  Maximize2,
  RefreshCw,
  Save,
  Loader2,
  Image,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  ScatterChart as RechartsScatter,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  ReferenceLine
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Color palettes
const COLOR_PALETTES = {
  default: ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'],
  pastel: ['#93c5fd', '#c4b5fd', '#86efac', '#fcd34d', '#fca5a5', '#fbcfe8', '#67e8f9', '#bef264'],
  dark: ['#0369a1', '#6d28d9', '#047857', '#b45309', '#b91c1c', '#be185d', '#0e7490', '#4d7c0f'],
  monochrome: ['#1e3a5f', '#2d5a87', '#3c7ab0', '#4b9ad8', '#5abaff', '#7fcbff', '#a4dcff', '#c9edff'],
  warm: ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a', '#059669', '#0d9488'],
  cool: ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#0284c7', '#0891b2', '#0d9488', '#059669']
};

const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { id: 'horizontal_bar', label: 'Horizontal Bar', icon: BarChart3 },
  { id: 'pie', label: 'Pie Chart', icon: PieChart },
  { id: 'donut', label: 'Donut Chart', icon: PieChart },
  { id: 'line', label: 'Line Chart', icon: LineChartIcon },
  { id: 'area', label: 'Area Chart', icon: TrendingUp },
  { id: 'scatter', label: 'Scatter Plot', icon: ScatterChart },
  { id: 'violin', label: 'Violin Plot', icon: BarChart3 },
  { id: 'coef', label: 'Coefficient Plot', icon: TrendingUp },
  { id: 'heatmap', label: 'Heatmap', icon: PieChart }
];

export function ChartStudio({ formId, orgId, fields, stats, getToken }) {
  const [chartType, setChartType] = useState('bar');
  const [selectedVar, setSelectedVar] = useState('');
  const [secondVar, setSecondVar] = useState('');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Chart customization
  const [config, setConfig] = useState({
    title: '',
    subtitle: '',
    palette: 'default',
    showLegend: true,
    showGrid: true,
    showValues: false,
    labelRotation: 0,
    innerRadius: 0, // For donut chart
    animate: true
  });

  const numericFields = fields.filter(f => f.type === 'number' || f.type === 'integer' || f.type === 'decimal');
  const categoricalFields = fields.filter(f => f.type === 'select' || f.type === 'radio' || f.type === 'text');

  const fetchChartData = useCallback(async () => {
    if (!selectedVar || !formId) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/analysis/stats/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          form_id: formId,
          org_id: orgId,
          variables: secondVar ? [selectedVar, secondVar] : [selectedVar]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const varStats = data.variables?.find(v => v.variable === selectedVar);
        
        if (varStats?.frequencies) {
          setChartData(varStats.frequencies.map((f, i) => ({
            name: f.value || f.label || `Item ${i + 1}`,
            value: f.count,
            percent: f.percent
          })));
        } else if (varStats?.type === 'numeric') {
          // Create distribution data for numeric
          setChartData([
            { name: 'Min', value: varStats.min },
            { name: 'Q1', value: varStats.q1 },
            { name: 'Median', value: varStats.median },
            { name: 'Q3', value: varStats.q3 },
            { name: 'Max', value: varStats.max }
          ]);
        }
      }
    } catch (error) {
      toast.error('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [selectedVar, secondVar, formId, orgId, getToken]);

  useEffect(() => {
    if (selectedVar) {
      fetchChartData();
    }
  }, [selectedVar, fetchChartData]);

  // Auto-set title based on variable
  useEffect(() => {
    if (selectedVar) {
      const field = fields.find(f => f.id === selectedVar);
      if (field && !config.title) {
        setConfig(c => ({ ...c, title: field.label || selectedVar }));
      }
    }
  }, [selectedVar, fields, config.title]);

  const colors = COLOR_PALETTES[config.palette] || COLOR_PALETTES.default;
  const [exportFormat, setExportFormat] = useState('png');
  const chartRef = React.useRef(null);

  const downloadChart = async (format = exportFormat) => {
    const svgElement = document.querySelector('.chart-container svg');
    if (!svgElement) {
      toast.error('No chart to download');
      return;
    }

    const chartTitle = config.title || selectedVar || 'chart';
    const fileName = `${chartTitle.replace(/\s+/g, '_')}_${Date.now()}`;

    if (format === 'svg') {
      // Download as SVG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.download = `${fileName}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Chart downloaded as SVG');
      return;
    }

    if (format === 'png') {
      // Download as PNG (high resolution)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new window.Image();
      
      img.onload = () => {
        // High resolution export (2x)
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        toast.success('Chart downloaded as PNG');
      };
      
      img.onerror = () => {
        toast.error('Failed to export chart');
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      return;
    }

    if (format === 'pdf') {
      // Download as PDF via backend
      try {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new window.Image();
        
        img.onload = async () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Convert to base64 PNG
          const pngData = canvas.toDataURL('image/png', 1.0);
          
          // Send to backend for PDF generation
          const response = await fetch(`${API_URL}/api/analysis/export-chart-pdf`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              image_data: pngData,
              title: config.title || chartTitle,
              subtitle: config.subtitle || '',
              width: canvas.width / 2,
              height: canvas.height / 2
            })
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${fileName}.pdf`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('Chart downloaded as PDF');
          } else {
            // Fallback: download as PNG if PDF fails
            toast.info('PDF export not available, downloading as PNG');
            downloadChart('png');
          }
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      } catch (error) {
        toast.error('Failed to export PDF');
      }
      return;
    }

    if (format === 'pptx') {
      // Download as PowerPoint via backend
      try {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new window.Image();
        
        img.onload = async () => {
          canvas.width = img.width * 2;
          canvas.height = img.height * 2;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const pngData = canvas.toDataURL('image/png', 1.0);
          
          const response = await fetch(`${API_URL}/api/analysis/export-chart-pptx`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
              image_data: pngData,
              title: config.title || chartTitle,
              subtitle: config.subtitle || '',
              width: canvas.width / 2,
              height: canvas.height / 2
            })
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${fileName}.pptx`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('Chart downloaded as PowerPoint');
          } else {
            toast.error('PowerPoint export failed');
          }
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      } catch (error) {
        toast.error('Failed to export PowerPoint');
      }
      return;
    }
  };

  const renderChart = () => {
    if (!chartData.length) {
      return (
        <div className="flex items-center justify-center h-[400px] text-slate-500">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a variable to create a chart</p>
          </div>
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 60 }
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                angle={config.labelRotation}
                textAnchor={config.labelRotation ? 'end' : 'middle'}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              {config.showLegend && <Legend />}
              <Bar 
                dataKey="value" 
                fill={colors[0]} 
                radius={[4, 4, 0, 0]}
                animationDuration={config.animate ? 1000 : 0}
                label={config.showValues ? { position: 'top', fontSize: 11 } : false}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontal_bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps} layout="vertical">
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              {config.showLegend && <Legend />}
              <Bar 
                dataKey="value" 
                fill={colors[0]} 
                radius={[0, 4, 4, 0]}
                animationDuration={config.animate ? 1000 : 0}
                label={config.showValues ? { position: 'right', fontSize: 11 } : false}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsPie>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'donut' ? 60 : 0}
                outerRadius={120}
                paddingAngle={2}
                animationDuration={config.animate ? 1000 : 0}
                label={config.showValues ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              {config.showLegend && <Legend />}
            </RechartsPie>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                angle={config.labelRotation}
                textAnchor={config.labelRotation ? 'end' : 'middle'}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              {config.showLegend && <Legend />}
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={colors[0]} 
                strokeWidth={2}
                dot={{ fill: colors[0], strokeWidth: 2 }}
                animationDuration={config.animate ? 1000 : 0}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                angle={config.labelRotation}
                textAnchor={config.labelRotation ? 'end' : 'middle'}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              {config.showLegend && <Legend />}
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={colors[0]} 
                fill={colors[0]}
                fillOpacity={0.3}
                animationDuration={config.animate ? 1000 : 0}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsScatter {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis dataKey="name" tick={{ fontSize: 12 }} name="Category" />
              <YAxis dataKey="value" tick={{ fontSize: 12 }} name="Value" />
              <ZAxis range={[60, 400]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
              />
              {config.showLegend && <Legend />}
              <Scatter 
                name={config.title || selectedVar}
                data={chartData} 
                fill={colors[0]}
                animationDuration={config.animate ? 1000 : 0}
              />
            </RechartsScatter>
          </ResponsiveContainer>
        );

      case 'violin':
        // Violin plot approximation using box plot style
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart {...commonProps}>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                formatter={(value, name) => [value, name]}
              />
              {config.showLegend && <Legend />}
              {/* Box (IQR) */}
              <Bar dataKey="q3" stackId="box" fill="transparent" />
              <Bar dataKey="median" stackId="box" fill={colors[0]} opacity={0.7} />
              <Bar dataKey="q1" stackId="box" fill={colors[0]} opacity={0.3} />
              {/* Whiskers as lines */}
              <Line type="monotone" dataKey="max" stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="min" stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="mean" stroke={colors[1]} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 6, fill: colors[1] }} />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'coef':
        // Coefficient plot with confidence intervals
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart {...commonProps} layout="vertical">
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: 'white' }}
                formatter={(value, name) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
              />
              <ReferenceLine x={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
              {/* Error bars represented as area */}
              <Bar 
                dataKey="value" 
                fill={colors[0]} 
                barSize={12}
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.significant ? colors[0] : '#94a3b8'}
                    opacity={entry.significant ? 1 : 0.5}
                  />
                ))}
              </Bar>
              {/* CI markers */}
              <Line 
                type="monotone" 
                dataKey="ci_upper" 
                stroke={colors[0]} 
                strokeWidth={0}
                dot={{ r: 2, fill: colors[0] }}
              />
              <Line 
                type="monotone" 
                dataKey="ci_lower" 
                stroke={colors[0]} 
                strokeWidth={0}
                dot={{ r: 2, fill: colors[0] }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'heatmap':
        // Heatmap approximation
        const heatmapColors = ['#ef4444', '#f97316', '#fcd34d', '#86efac', '#22d3ee', '#3b82f6', '#8b5cf6'];
        return (
          <div className="h-[400px] overflow-auto p-4">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(chartData.length))}, minmax(60px, 1fr))` }}>
              {chartData.map((item, idx) => {
                const normalizedValue = (item.value + 1) / 2; // Normalize -1 to 1 => 0 to 1
                const colorIdx = Math.floor(normalizedValue * (heatmapColors.length - 1));
                return (
                  <div 
                    key={idx}
                    className="aspect-square flex items-center justify-center text-xs font-mono rounded"
                    style={{ 
                      backgroundColor: heatmapColors[colorIdx] || '#94a3b8',
                      color: normalizedValue > 0.5 ? 'white' : 'black'
                    }}
                    title={`${item.x} × ${item.y}: ${item.value}`}
                  >
                    {item.value?.toFixed(2)}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center mt-4 gap-1">
              <span className="text-xs text-slate-500">-1</span>
              {heatmapColors.map((color, i) => (
                <div key={i} className="w-6 h-4 rounded" style={{ backgroundColor: color }} />
              ))}
              <span className="text-xs text-slate-500">+1</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Configuration Panel */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Chart Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {/* Chart Type */}
              <div className="space-y-2">
                <Label>Chart Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CHART_TYPES.map(type => (
                    <Button
                      key={type.id}
                      variant={chartType === type.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType(type.id)}
                      className="justify-start"
                    >
                      <type.icon className="h-4 w-4 mr-2" />
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Data Selection */}
              <div className="space-y-3">
                <Label>Primary Variable</Label>
                <Select value={selectedVar} onValueChange={setSelectedVar}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.label || f.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Title & Labels */}
              <div className="space-y-3">
                <div>
                  <Label>Chart Title</Label>
                  <Input
                    value={config.title}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    placeholder="Enter title..."
                  />
                </div>
                <div>
                  <Label>Subtitle</Label>
                  <Input
                    value={config.subtitle}
                    onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                    placeholder="Enter subtitle..."
                  />
                </div>
              </div>

              <Separator />

              {/* Color Palette */}
              <div className="space-y-3">
                <Label>Color Palette</Label>
                <Select value={config.palette} onValueChange={(v) => setConfig({ ...config, palette: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(COLOR_PALETTES).map(palette => (
                      <SelectItem key={palette} value={palette}>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {COLOR_PALETTES[palette].slice(0, 4).map((color, i) => (
                              <div
                                key={i}
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="capitalize">{palette}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Display Options */}
              <div className="space-y-3">
                <Label>Display Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="legend"
                      checked={config.showLegend}
                      onCheckedChange={(c) => setConfig({ ...config, showLegend: c })}
                    />
                    <Label htmlFor="legend" className="text-sm">Show Legend</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="grid"
                      checked={config.showGrid}
                      onCheckedChange={(c) => setConfig({ ...config, showGrid: c })}
                    />
                    <Label htmlFor="grid" className="text-sm">Show Grid Lines</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="values"
                      checked={config.showValues}
                      onCheckedChange={(c) => setConfig({ ...config, showValues: c })}
                    />
                    <Label htmlFor="values" className="text-sm">Show Values</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="animate"
                      checked={config.animate}
                      onCheckedChange={(c) => setConfig({ ...config, animate: c })}
                    />
                    <Label htmlFor="animate" className="text-sm">Animate</Label>
                  </div>
                </div>
              </div>

              {(chartType === 'bar' || chartType === 'line' || chartType === 'area') && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label>Label Rotation: {config.labelRotation}°</Label>
                    <Slider
                      value={[config.labelRotation]}
                      onValueChange={([v]) => setConfig({ ...config, labelRotation: v })}
                      min={-45}
                      max={45}
                      step={5}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chart Preview */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{config.title || 'Chart Preview'}</CardTitle>
              {config.subtitle && <CardDescription>{config.subtitle}</CardDescription>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchChartData} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <div className="flex border rounded-md overflow-hidden">
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger className="w-[80px] border-0 rounded-none h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="svg">SVG</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="pptx">PPTX</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => downloadChart()} 
                  className="rounded-none border-0 border-l h-8"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="chart-container bg-white rounded-lg p-4">
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
              </div>
            ) : (
              renderChart()
            )}
          </div>
          
          {/* Data Table Preview */}
          {chartData.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Data Summary
              </h4>
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-100">
                      <th className="p-2 text-left">Category</th>
                      <th className="p-2 text-right">Value</th>
                      <th className="p-2 text-right">Percent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 text-right font-medium">{row.value}</td>
                        <td className="p-2 text-right text-slate-500">
                          {row.percent ? `${row.percent.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {chartData.length > 10 && (
                  <div className="p-2 text-center text-sm text-slate-500">
                    Showing 10 of {chartData.length} items
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ChartStudio;
