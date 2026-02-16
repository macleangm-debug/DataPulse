# Resizable Widget Components - Documentation

## Overview

The resizable widget system provides flexible, customizable resize functionality for DataPulse dashboards and data visualization modules. It includes:

1. **`useResizable` Hook** - Low-level hook for full control
2. **`ResizableContainer` Component** - Wrapper component for quick integration
3. **`ResizablePanel` Component** - Styled panel with header
4. **`ResizableWidget` Component** - Dashboard-optimized widget
5. **Size Presets** - Quick resize buttons (S/M/L/XL)

## Installation

The components are already installed in the DataPulse frontend. No additional dependencies required.

## File Locations

```
/app/frontend/src/
├── hooks/
│   └── useResizable.js          # Core resize hook
├── components/ui/
│   └── ResizableContainer.jsx   # Component wrappers
├── examples/
│   └── ResizableExamples.jsx    # Usage examples
└── pages/
    └── DashboardBuilderPage.jsx # Integration example
```

---

## useResizable Hook

### Basic Usage

```jsx
import { useResizable } from '../hooks/useResizable';

function MyComponent() {
  const { width, isDragging, dragHandleProps, previewWidth } = useResizable({
    initialWidth: 50,
    minWidth: 25,
    maxWidth: 100,
    snapPoints: [25, 50, 75, 100],
    onResize: ({ width }) => console.log('Resized to:', width)
  });

  return (
    <div style={{ width: `${width}%` }}>
      <div {...dragHandleProps}>⋮</div>
      Content
    </div>
  );
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialWidth` | number | 50 | Starting width (percentage) |
| `minWidth` | number | 20 | Minimum width (percentage) |
| `maxWidth` | number | 100 | Maximum width (percentage) |
| `snapPoints` | number[] | [25, 33, 50, 66, 75, 100] | Width values to snap to |
| `snapThreshold` | number | 5 | Distance to trigger snap |
| `direction` | string | 'horizontal' | 'horizontal', 'vertical', or 'both' |
| `onResize` | function | - | Callback when resize completes |
| `onResizeStart` | function | - | Callback when resize starts |
| `onResizeEnd` | function | - | Callback when resize ends |

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `width` | number | Current width percentage |
| `height` | number | Current height percentage |
| `isDragging` | boolean | Whether user is currently dragging |
| `previewWidth` | number | Width during drag (before commit) |
| `previewHeight` | number | Height during drag (before commit) |
| `dragHandleProps` | object | Props to spread on drag handle element |
| `setWidth` | function | Programmatically set width |
| `setHeight` | function | Programmatically set height |
| `reset` | function | Reset to initial size |

---

## ResizableContainer Component

### Basic Usage

```jsx
import { ResizableContainer } from '../components/ui/ResizableContainer';

function MyComponent() {
  return (
    <ResizableContainer
      initialWidth={50}
      snapPoints={[25, 50, 75, 100]}
      onResize={(width) => console.log(width)}
    >
      <div className="p-4">
        Your content here
      </div>
    </ResizableContainer>
  );
}
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialWidth` | number | 50 | Starting width |
| `minWidth` | number | 20 | Minimum width |
| `maxWidth` | number | 100 | Maximum width |
| `snapPoints` | number[] | [25, 33, 50, 66, 75, 100] | Snap points |
| `snapThreshold` | number | 5 | Snap threshold |
| `direction` | string | 'horizontal' | Resize direction |
| `showHandle` | boolean | true | Show resize handle |
| `showPreview` | boolean | true | Show size preview tooltip |
| `handlePosition` | string | 'right' | Handle position: 'left', 'right', 'top', 'bottom' |
| `disabled` | boolean | false | Disable resizing |
| `onResize` | function | - | Resize callback |
| `className` | string | - | Container class |
| `handleClassName` | string | - | Handle class |

---

## ResizableWidget Component

Specifically designed for dashboard widgets with header, drag handle, and action buttons.

### Usage

```jsx
import { ResizableWidget } from '../components/ui/ResizableContainer';
import { BarChart3 } from 'lucide-react';

function DashboardWidget() {
  return (
    <ResizableWidget
      title="Sales Overview"
      subtitle="Last 30 days"
      icon={BarChart3}
      initialWidth={50}
      onResize={(width) => console.log(width)}
      onMaximize={() => console.log('Maximize clicked')}
    >
      <div className="h-full">
        {/* Chart or content */}
      </div>
    </ResizableWidget>
  );
}
```

---

## Dashboard Integration

### Size Presets

The Dashboard Builder includes quick resize presets:

| Preset | Width | Height | Grid Columns |
|--------|-------|--------|--------------|
| S (Small) | 25% | 2 rows | 3 |
| M (Medium) | 50% | 3 rows | 6 |
| L (Large) | 75% | 4 rows | 9 |
| XL (Full) | 100% | 5 rows | 12 |

### Using in DashboardBuilderPage

```jsx
// The DashboardWidget component includes resize presets
<DashboardWidget
  widget={widget}
  data={widgetData[widget.id]}
  onEdit={setEditingWidget}
  onDelete={deleteWidget}
  onResize={handleWidgetResize}  // Pass resize handler
/>

// Resize handler
const handleWidgetResize = (widgetId, newSize) => {
  const updatedWidgets = widgets.map(widget => {
    if (widget.id === widgetId) {
      return {
        ...widget,
        position: {
          ...widget.position,
          w: newSize.w,
          h: newSize.h
        }
      };
    }
    return widget;
  });
  setWidgets(updatedWidgets);
};
```

---

## Accessibility

The components include:

- `role="slider"` for screen readers
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes
- `aria-label="Resize handle"`
- Keyboard support (Tab to focus)
- Touch support for mobile devices

---

## Styling

### CSS Classes

The components use Tailwind CSS. Key classes:

```css
/* Container during drag */
.dragging {
  @apply ring-2 ring-primary/50 z-50;
}

/* Handle hover state */
.handle:hover {
  @apply bg-primary/10;
}

/* Preview tooltip */
.preview-tooltip {
  @apply px-2 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground shadow-lg;
}
```

### Customization

```jsx
<ResizableContainer
  className="my-custom-container"
  handleClassName="my-custom-handle"
  style={{ backgroundColor: '#f0f0f0' }}
  containerStyle={{ padding: '1rem' }}
>
  Content
</ResizableContainer>
```

---

## Examples

### 1. Sidebar with Resizable Width

```jsx
function Layout() {
  const [sidebarWidth, setSidebarWidth] = useState(25);

  return (
    <div className="flex h-screen">
      <ResizableContainer
        initialWidth={sidebarWidth}
        minWidth={15}
        maxWidth={40}
        snapPoints={[20, 25, 30, 35]}
        onResize={setSidebarWidth}
        className="bg-sidebar border-r"
      >
        <Sidebar />
      </ResizableContainer>
      
      <main className="flex-1">
        <MainContent />
      </main>
    </div>
  );
}
```

### 2. Split View Panels

```jsx
function SplitView() {
  const [leftWidth, setLeftWidth] = useState(50);

  return (
    <div className="flex h-full">
      <ResizableContainer
        initialWidth={leftWidth}
        snapPoints={[33, 50, 66]}
        onResize={setLeftWidth}
      >
        <LeftPanel />
      </ResizableContainer>
      
      <div style={{ width: `${100 - leftWidth}%` }}>
        <RightPanel />
      </div>
    </div>
  );
}
```

### 3. Dashboard Grid

```jsx
function Dashboard() {
  const [widgets, setWidgets] = useState([
    { id: '1', title: 'Chart 1', width: 50 },
    { id: '2', title: 'Chart 2', width: 50 },
  ]);

  const updateWidth = (id, width) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, width } : w
    ));
  };

  return (
    <div className="flex flex-wrap gap-4">
      {widgets.map(widget => (
        <ResizableWidget
          key={widget.id}
          title={widget.title}
          initialWidth={widget.width}
          onResize={(width) => updateWidth(widget.id, width)}
        >
          <ChartContent />
        </ResizableWidget>
      ))}
    </div>
  );
}
```

---

## Best Practices

1. **Use snap points** - Makes resizing more predictable
2. **Set reasonable min/max** - Prevent content from becoming unusable
3. **Save state** - Persist user's resize preferences
4. **Test on mobile** - Ensure touch events work properly
5. **Consider performance** - Don't trigger expensive operations during drag

---

## Troubleshooting

### Widget not resizing
- Ensure `dragHandleProps` is spread on the handle element
- Check that `isDragging` event listeners are properly attached

### Snap not working
- Verify `snapPoints` array contains valid numbers
- Adjust `snapThreshold` if snap seems too sensitive/insensitive

### Layout issues
- Ensure parent container has proper width/height
- Use `flex` or `grid` layouts for predictable behavior

---

## Migration Guide

If upgrading from a previous version:

1. Import from new locations
2. Update prop names (`onWidthChange` → `onResize`)
3. The hook now returns an object instead of array

```jsx
// Old
const [width, isDragging, handlers] = useResizable(...);

// New
const { width, isDragging, dragHandleProps } = useResizable(...);
```
