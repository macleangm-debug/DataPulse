import React, { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { Pen, Trash2, Check, RotateCcw } from 'lucide-react';

/**
 * SignatureCapture Component
 * Canvas-based signature capture with touch and mouse support
 */
export function SignatureCapture({ 
  value, 
  onChange, 
  label = "Signature",
  width = 400,
  height = 200,
  strokeColor = '#000000',
  strokeWidth = 2,
  backgroundColor = '#ffffff',
  required = false,
  disabled = false
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [showCanvas, setShowCanvas] = useState(!value);

  useEffect(() => {
    if (canvasRef.current && showCanvas) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set up canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Draw signature line
      ctx.beginPath();
      ctx.moveTo(20, height - 40);
      ctx.lineTo(width - 20, height - 40);
      ctx.strokeStyle = '#e5e5e5';
      ctx.stroke();
      ctx.strokeStyle = strokeColor;
      
      // Draw "X" marker
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#999';
      ctx.fillText('X', 25, height - 45);
    }
  }, [showCanvas, width, height, strokeColor, strokeWidth, backgroundColor]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoordinates(e);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    
    e?.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    ctx.closePath();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Redraw signature line
    ctx.beginPath();
    ctx.moveTo(20, height - 40);
    ctx.lineTo(width - 20, height - 40);
    ctx.strokeStyle = '#e5e5e5';
    ctx.stroke();
    ctx.strokeStyle = strokeColor;
    
    // Redraw X marker
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('X', 25, height - 45);
    
    setHasSignature(false);
  };

  const saveSignature = () => {
    if (!hasSignature) {
      toast.error('Please sign before saving');
      return;
    }
    
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
    setShowCanvas(false);
    toast.success('Signature saved');
  };

  const editSignature = () => {
    setShowCanvas(true);
    setHasSignature(false);
  };

  const removeSignature = () => {
    onChange('');
    setShowCanvas(true);
    setHasSignature(false);
  };

  return (
    <div className="space-y-2" data-testid="signature-capture">
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      
      {showCanvas ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="border rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
              <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="w-full cursor-crosshair"
                style={{ maxWidth: '100%', height: 'auto' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Pen className="w-4 h-4" />
                Sign above the line
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearSignature}
                  disabled={disabled || !hasSignature}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Clear
                </Button>
                <Button 
                  size="sm" 
                  onClick={saveSignature}
                  disabled={disabled || !hasSignature}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : value ? (
        <Card>
          <CardContent className="p-4">
            <div className="border rounded-lg overflow-hidden bg-white mb-3">
              <img 
                src={value} 
                alt="Signature" 
                className="w-full"
                style={{ maxHeight: height }}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={editSignature}
                disabled={disabled}
              >
                <Pen className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={removeSignature}
                disabled={disabled}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button 
          variant="outline" 
          onClick={() => setShowCanvas(true)}
          disabled={disabled}
          className="w-full"
        >
          <Pen className="w-4 h-4 mr-2" />
          Add Signature
        </Button>
      )}
    </div>
  );
}

export default SignatureCapture;
