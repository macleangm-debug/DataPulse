/**
 * ResizableContainer Component - Wrapper for resizable content
 * 
 * A plug-and-play component that wraps any content and makes it resizable.
 * Perfect for dashboard widgets, panels, and sidebars.
 * 
 * Usage:
 * <ResizableContainer
 *   initialWidth={50}
 *   snapPoints={[25, 50, 75, 100]}
 *   onResize={(width) => console.log(width)}
 * >
 *   <YourContent />
 * </ResizableContainer>
 */

import React, { forwardRef } from 'react';
import { useResizable } from '../../hooks/useResizable';
import { GripVertical, Maximize2 } from 'lucide-react';

// Utility function for combining class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const ResizableContainer = forwardRef(({
  children,
  initialWidth = 50,
  minWidth = 20,
  maxWidth = 100,
  snapPoints = [25, 33, 50, 66, 75, 100],
  snapThreshold = 5,
  onResize,
  onResizeStart,
  onResizeEnd,
  direction = 'horizontal',
  showHandle = true,
  showPreview = true,
  handlePosition = 'right', // 'left', 'right', 'top', 'bottom'
  className,
  handleClassName,
  style,
  containerStyle,
  disabled = false,
  ...props
}, ref) => {
  const {
    width,
    height,
    isDragging,
    previewWidth,
    previewHeight,
    dragHandleProps,
    reset
  } = useResizable({
    initialWidth,
    minWidth,
    maxWidth,
    snapPoints,
    snapThreshold,
    onResize: (size) => onResize?.(direction === 'horizontal' ? size.width : size.height),
    onResizeStart,
    onResizeEnd,
    direction
  });

  const currentSize = direction === 'horizontal' ? width : height;
  const previewSize = direction === 'horizontal' ? previewWidth : previewHeight;

  // Determine handle position styles
  const handlePositionStyles = {
    right: 'right-0 top-0 h-full w-3 cursor-ew-resize flex-col',
    left: 'left-0 top-0 h-full w-3 cursor-ew-resize flex-col',
    top: 'top-0 left-0 w-full h-3 cursor-ns-resize flex-row',
    bottom: 'bottom-0 left-0 w-full h-3 cursor-ns-resize flex-row'
  };

  const isVertical = handlePosition === 'top' || handlePosition === 'bottom';

  return (
    <div
      ref={ref}
      className={cn(
        'relative transition-all duration-200',
        isDragging && 'z-50',
        className
      )}
      style={{
        width: direction === 'horizontal' ? `${currentSize}%` : undefined,
        height: direction === 'vertical' ? `${currentSize}%` : undefined,
        ...style
      }}
      {...props}
    >
      {/* Content container */}
      <div
        className={cn(
          'w-full h-full overflow-hidden rounded-lg',
          isDragging && 'ring-2 ring-primary/50'
        )}
        style={containerStyle}
      >
        {children}
      </div>

      {/* Resize handle */}
      {showHandle && !disabled && (
        <div
          {...dragHandleProps}
          className={cn(
            'absolute flex items-center justify-center',
            'bg-transparent hover:bg-primary/10 transition-colors',
            'group',
            handlePositionStyles[handlePosition],
            isDragging && 'bg-primary/20',
            handleClassName
          )}
        >
          {/* Handle grip icon */}
          <div className={cn(
            'flex items-center justify-center',
            'text-muted-foreground/40 group-hover:text-muted-foreground transition-colors',
            isDragging && 'text-primary'
          )}>
            {isVertical ? (
              <GripVertical className="w-4 h-4 rotate-90" />
            ) : (
              <GripVertical className="w-4 h-4" />
            )}
          </div>

          {/* Width preview tooltip */}
          {showPreview && isDragging && previewSize !== null && (
            <div className={cn(
              'absolute px-2 py-1 text-xs font-medium rounded-md',
              'bg-primary text-primary-foreground shadow-lg',
              'whitespace-nowrap z-50',
              isVertical ? 'top-full mt-2' : 'left-full ml-2'
            )}>
              {Math.round(previewSize)}%
            </div>
          )}
        </div>
      )}

      {/* Snap indicator lines (shown during drag) */}
      {isDragging && snapPoints.map((point, idx) => (
        <div
          key={idx}
          className={cn(
            'absolute bg-primary/30 transition-opacity',
            isVertical ? 'w-full h-px' : 'h-full w-px',
            Math.abs((previewSize || currentSize) - point) <= snapThreshold
              ? 'opacity-100 bg-primary'
              : 'opacity-30'
          )}
          style={{
            [isVertical ? 'top' : 'left']: `${point}%`
          }}
        />
      ))}
    </div>
  );
});

ResizableContainer.displayName = 'ResizableContainer';

/**
 * ResizablePanel - A more styled version with header
 */
export const ResizablePanel = forwardRef(({
  children,
  title,
  icon: Icon,
  actions,
  onResize,
  initialWidth = 50,
  className,
  headerClassName,
  contentClassName,
  ...props
}, ref) => {
  return (
    <ResizableContainer
      ref={ref}
      initialWidth={initialWidth}
      onResize={onResize}
      className={cn(
        'bg-card border border-border rounded-xl shadow-sm',
        className
      )}
      {...props}
    >
      {(title || actions) && (
        <div className={cn(
          'flex items-center justify-between px-4 py-3 border-b border-border',
          headerClassName
        )}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            {title && <h3 className="font-medium text-sm">{title}</h3>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-4', contentClassName)}>
        {children}
      </div>
    </ResizableContainer>
  );
});

ResizablePanel.displayName = 'ResizablePanel';

/**
 * ResizableWidget - Specifically for dashboard widgets
 */
export const ResizableWidget = forwardRef(({
  children,
  title,
  subtitle,
  icon: Icon,
  onResize,
  onEdit,
  onDelete,
  onMaximize,
  initialWidth = 50,
  isDraggable = true,
  className,
  ...props
}, ref) => {
  return (
    <ResizableContainer
      ref={ref}
      initialWidth={initialWidth}
      onResize={onResize}
      className={cn(
        'bg-card border border-border rounded-xl shadow-sm overflow-hidden',
        'hover:shadow-md transition-shadow',
        className
      )}
      {...props}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {isDraggable && (
            <div className="cursor-move p-1 hover:bg-muted rounded" data-testid="widget-drag-handle">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <div>
            {title && <h4 className="font-medium text-sm">{title}</h4>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="p-1 hover:bg-muted rounded transition-colors"
              data-testid="widget-maximize-btn"
            >
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="p-4 h-[calc(100%-48px)]">
        {children}
      </div>
    </ResizableContainer>
  );
});

ResizableWidget.displayName = 'ResizableWidget';

export default ResizableContainer;
