/**
 * Resizable Components - Usage Examples
 * 
 * This file demonstrates different ways to use the resizable components
 * in your DataPulse dashboards and data visualization modules.
 */

import React, { useState } from 'react';
import { useResizable } from '../hooks/useResizable';
import { ResizableContainer, ResizablePanel, ResizableWidget } from '../components/ui/ResizableContainer';
import { BarChart3, PieChart, LineChart, Hash, Table, GripVertical } from 'lucide-react';

// ============================================================================
// EXAMPLE 1: Basic Hook Usage (Most Flexible)
// ============================================================================

export function BasicHookExample() {
  const { width, isDragging, dragHandleProps, previewWidth } = useResizable({
    initialWidth: 50,
    minWidth: 25,
    maxWidth: 100,
    snapPoints: [25, 50, 75, 100],
    onResize: ({ width }) => console.log('Resized to:', width)
  });

  return (
    <div className="flex h-64 bg-muted/20 rounded-lg overflow-hidden">
      {/* Resizable panel */}
      <div
        className="bg-card border-r border-border p-4 transition-all"
        style={{ width: `${width}%` }}
      >
        <h3 className="font-medium mb-2">Resizable Panel</h3>
        <p className="text-sm text-muted-foreground">
          Current width: {isDragging ? previewWidth : width}%
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Drag the handle to resize. Snaps to 25%, 50%, 75%, 100%.
        </p>
      </div>

      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className={`
          w-3 flex items-center justify-center cursor-ew-resize
          bg-transparent hover:bg-primary/10 transition-colors
          ${isDragging ? 'bg-primary/20' : ''}
        `}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Remaining space */}
      <div className="flex-1 p-4 bg-muted/10">
        <p className="text-sm text-muted-foreground">Remaining space</p>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Component-Based (Quick & Easy)
// ============================================================================

export function ComponentExample() {
  const [width, setWidth] = useState(50);

  return (
    <div className="flex h-64 gap-2">
      <ResizableContainer
        initialWidth={width}
        snapPoints={[25, 33, 50, 66, 75, 100]}
        onResize={setWidth}
        className="bg-card rounded-lg shadow-sm"
      >
        <div className="p-4 h-full">
          <h3 className="font-medium mb-2">Widget Content</h3>
          <p className="text-sm text-muted-foreground">
            Width: {Math.round(width)}%
          </p>
        </div>
      </ResizableContainer>

      <div className="flex-1 bg-muted/20 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Other content</p>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Dashboard Grid with Multiple Resizable Widgets
// ============================================================================

export function DashboardGridExample() {
  const [widgetWidths, setWidgetWidths] = useState({
    stats: 25,
    chart: 50,
    table: 25
  });

  const updateWidth = (id, width) => {
    setWidgetWidths(prev => ({ ...prev, [id]: width }));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Dashboard with Resizable Widgets</h2>
      
      <div className="flex gap-2 h-80">
        {/* Stats Widget */}
        <ResizableWidget
          title="Total Submissions"
          subtitle="Last 30 days"
          icon={Hash}
          initialWidth={widgetWidths.stats}
          onResize={(w) => updateWidth('stats', w)}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-4xl font-bold">12,847</span>
            <span className="text-sm text-green-500">+12.5%</span>
          </div>
        </ResizableWidget>

        {/* Chart Widget */}
        <ResizableWidget
          title="Submission Trends"
          subtitle="Weekly overview"
          icon={BarChart3}
          initialWidth={widgetWidths.chart}
          onResize={(w) => updateWidth('chart', w)}
        >
          <div className="h-full flex items-center justify-center bg-muted/20 rounded">
            <BarChart3 className="w-16 h-16 text-muted-foreground/50" />
          </div>
        </ResizableWidget>

        {/* Table Widget */}
        <ResizableWidget
          title="Recent Activity"
          icon={Table}
          initialWidth={widgetWidths.table}
          onResize={(w) => updateWidth('table', w)}
        >
          <div className="space-y-2 text-sm">
            <div className="p-2 bg-muted/30 rounded">Form submitted</div>
            <div className="p-2 bg-muted/30 rounded">User added</div>
            <div className="p-2 bg-muted/30 rounded">Data exported</div>
          </div>
        </ResizableWidget>
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Data Visualization Module Integration
// ============================================================================

export function DataVizExample() {
  const [panels, setPanels] = useState([
    { id: 'chart1', type: 'bar', width: 50, title: 'Sales by Region' },
    { id: 'chart2', type: 'pie', width: 25, title: 'Market Share' },
    { id: 'chart3', type: 'line', width: 25, title: 'Revenue Trend' }
  ]);

  const updatePanelWidth = (id, width) => {
    setPanels(prev => prev.map(p => 
      p.id === id ? { ...p, width } : p
    ));
  };

  const getIcon = (type) => {
    switch (type) {
      case 'bar': return BarChart3;
      case 'pie': return PieChart;
      case 'line': return LineChart;
      default: return BarChart3;
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Data Visualization Module</h2>
      
      <div className="flex gap-2 h-96">
        {panels.map((panel) => (
          <ResizablePanel
            key={panel.id}
            title={panel.title}
            icon={getIcon(panel.type)}
            initialWidth={panel.width}
            onResize={(w) => updatePanelWidth(panel.id, w)}
            actions={
              <button className="text-xs text-primary hover:underline">
                Configure
              </button>
            }
          >
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg">
              {React.createElement(getIcon(panel.type), {
                className: 'w-20 h-20 text-primary/30'
              })}
            </div>
          </ResizablePanel>
        ))}
      </div>

      <div className="text-sm text-muted-foreground">
        Current widths: {panels.map(p => `${p.title}: ${Math.round(p.width)}%`).join(' | ')}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Minimal Copy-Paste Example
// ============================================================================

export function MinimalExample() {
  return (
    <div className="h-48 flex">
      <ResizableContainer initialWidth={50} snapPoints={[25, 50, 75, 100]}>
        <div className="h-full p-4 bg-blue-500/10 rounded-lg">
          Resizable content
        </div>
      </ResizableContainer>
      <div className="flex-1 p-4 bg-gray-100 rounded-lg ml-2">
        Fixed content
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 6: Vertical Resizing
// ============================================================================

export function VerticalResizeExample() {
  const [height, setHeight] = useState(50);

  return (
    <div className="h-96 flex flex-col">
      <ResizableContainer
        initialWidth={height}
        direction="vertical"
        handlePosition="bottom"
        snapPoints={[25, 50, 75]}
        onResize={setHeight}
        className="bg-card rounded-lg shadow-sm"
      >
        <div className="p-4">
          <h3 className="font-medium">Top Panel</h3>
          <p className="text-sm text-muted-foreground">Height: {Math.round(height)}%</p>
        </div>
      </ResizableContainer>

      <div className="flex-1 bg-muted/20 rounded-lg p-4 mt-2">
        <p className="text-sm text-muted-foreground">Bottom panel (auto-fills remaining space)</p>
      </div>
    </div>
  );
}

// ============================================================================
// ALL EXAMPLES COMBINED
// ============================================================================

export default function ResizableExamples() {
  return (
    <div className="space-y-12 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-6">Resizable Components Examples</h1>
        <p className="text-muted-foreground mb-8">
          These examples demonstrate different ways to use the resizable components
          in your DataPulse dashboards.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">1. Basic Hook Usage</h2>
        <BasicHookExample />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">2. Component-Based</h2>
        <ComponentExample />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">3. Dashboard Grid</h2>
        <DashboardGridExample />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">4. Data Visualization Module</h2>
        <DataVizExample />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">5. Minimal Example</h2>
        <MinimalExample />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">6. Vertical Resizing</h2>
        <VerticalResizeExample />
      </section>
    </div>
  );
}
