/**
 * useResizable Hook - Custom hook for resizable widget functionality
 * 
 * Features:
 * - Drag-to-resize with mouse and touch support
 * - Snap to preset width points
 * - Configurable min/max constraints
 * - Callback for resize events
 * 
 * Usage:
 * const { width, isDragging, dragHandleProps } = useResizable({
 *   initialWidth: 50,
 *   minWidth: 25,
 *   maxWidth: 100,
 *   snapPoints: [25, 50, 75, 100],
 *   onResize: (newWidth) => console.log('Resized to', newWidth)
 * });
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export function useResizable({
  initialWidth = 50,
  minWidth = 20,
  maxWidth = 100,
  snapPoints = [25, 33, 50, 66, 75, 100],
  snapThreshold = 5,
  onResize,
  onResizeStart,
  onResizeEnd,
  direction = 'horizontal' // 'horizontal' or 'vertical' or 'both'
}) {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(null);
  const [previewHeight, setPreviewHeight] = useState(null);
  
  const containerRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });

  // Find nearest snap point
  const findSnapPoint = useCallback((value, points) => {
    for (const point of points) {
      if (Math.abs(value - point) <= snapThreshold) {
        return point;
      }
    }
    return value;
  }, [snapThreshold]);

  // Clamp value within constraints
  const clamp = useCallback((value, min, max) => {
    return Math.min(Math.max(value, min), max);
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    
    startPosRef.current = { x: clientX, y: clientY };
    startSizeRef.current = { width, height };
    setIsDragging(true);
    setPreviewWidth(width);
    setPreviewHeight(height);
    
    onResizeStart?.({ width, height });
  }, [width, height, onResizeStart]);

  // Handle drag move
  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
    
    const container = containerRef.current?.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    if (direction === 'horizontal' || direction === 'both') {
      const deltaX = clientX - startPosRef.current.x;
      const containerWidth = containerRect.width;
      const deltaPercent = (deltaX / containerWidth) * 100;
      
      let newWidth = startSizeRef.current.width + deltaPercent;
      newWidth = clamp(newWidth, minWidth, maxWidth);
      newWidth = findSnapPoint(newWidth, snapPoints);
      
      setPreviewWidth(Math.round(newWidth));
    }
    
    if (direction === 'vertical' || direction === 'both') {
      const deltaY = clientY - startPosRef.current.y;
      const containerHeight = containerRect.height;
      const deltaPercent = (deltaY / containerHeight) * 100;
      
      let newHeight = startSizeRef.current.height + deltaPercent;
      newHeight = clamp(newHeight, minWidth, maxWidth);
      newHeight = findSnapPoint(newHeight, snapPoints);
      
      setPreviewHeight(Math.round(newHeight));
    }
  }, [isDragging, direction, minWidth, maxWidth, snapPoints, clamp, findSnapPoint]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (previewWidth !== null && (direction === 'horizontal' || direction === 'both')) {
      setWidth(previewWidth);
      onResize?.({ width: previewWidth, height: previewHeight || height });
    }
    
    if (previewHeight !== null && (direction === 'vertical' || direction === 'both')) {
      setHeight(previewHeight);
      onResize?.({ width: previewWidth || width, height: previewHeight });
    }
    
    onResizeEnd?.({ width: previewWidth || width, height: previewHeight || height });
    setPreviewWidth(null);
    setPreviewHeight(null);
  }, [isDragging, previewWidth, previewHeight, width, height, direction, onResize, onResizeEnd]);

  // Add/remove global event listeners
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e) => handleDragMove(e);
      const handleEnd = () => handleDragEnd();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
      
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'both' ? 'nwse-resize' : 
                                   direction === 'vertical' ? 'ns-resize' : 'ew-resize';
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd, direction]);

  // Props for the drag handle element
  const dragHandleProps = {
    ref: containerRef,
    onMouseDown: handleDragStart,
    onTouchStart: handleDragStart,
    role: 'slider',
    'aria-valuenow': width,
    'aria-valuemin': minWidth,
    'aria-valuemax': maxWidth,
    'aria-label': 'Resize handle',
    tabIndex: 0,
    style: {
      cursor: isDragging ? 
        (direction === 'both' ? 'nwse-resize' : direction === 'vertical' ? 'ns-resize' : 'ew-resize') :
        (direction === 'both' ? 'nwse-resize' : direction === 'vertical' ? 'ns-resize' : 'ew-resize'),
      touchAction: 'none'
    }
  };

  // Set width programmatically
  const setWidthValue = useCallback((newWidth) => {
    const clampedWidth = clamp(newWidth, minWidth, maxWidth);
    setWidth(clampedWidth);
    onResize?.({ width: clampedWidth, height });
  }, [minWidth, maxWidth, height, clamp, onResize]);

  // Set height programmatically
  const setHeightValue = useCallback((newHeight) => {
    const clampedHeight = clamp(newHeight, minWidth, maxWidth);
    setHeight(clampedHeight);
    onResize?.({ width, height: clampedHeight });
  }, [minWidth, maxWidth, width, clamp, onResize]);

  // Reset to initial size
  const reset = useCallback(() => {
    setWidth(initialWidth);
    setHeight(initialWidth);
    onResize?.({ width: initialWidth, height: initialWidth });
  }, [initialWidth, onResize]);

  return {
    width,
    height,
    setWidth: setWidthValue,
    setHeight: setHeightValue,
    isDragging,
    previewWidth,
    previewHeight,
    dragHandleProps,
    reset,
    containerRef
  };
}

export default useResizable;
