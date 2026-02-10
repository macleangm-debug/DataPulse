/**
 * Signature Capture Component
 * Canvas-based signature drawing with touch/mouse support
 */

import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { PenTool, Eraser, Check, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function SignatureCapture({
  open,
  onClose,
  onCapture,
  fieldId,
  formId,
  config = {}
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointsCount, setPointsCount] = useState(0);
  const [signerName, setSignerName] = useState('');
  const [hasSignature, setHasSignature] = useState(false);

  const {
    penColor = '#000000',
    penWidth = 2,
    backgroundColor = '#ffffff',
    canvasWidth = 400,
    canvasHeight = 200,
    minPoints = 10,
    requireName = false
  } = config;

  useEffect(() => {
    if (open && canvasRef.current) {
      initCanvas();
    }
  }, [open]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    setPointsCount(0);
    setHasSignature(false);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches[0]) {
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
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();

    setPointsCount(prev => prev + 1);
    setHasSignature(true);
  };

  const stopDrawing = (e) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    initCanvas();
  };

  const saveSignature = async () => {
    if (pointsCount < minPoints) {
      toast.error(`Please provide a more complete signature (minimum ${minPoints} points)`);
      return;
    }

    if (requireName && !signerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get base64 image data
    const imageData = canvas.toDataURL('image/png');

    // Send to backend
    try {
      const formData = new FormData();
      formData.append('field_id', fieldId);
      formData.append('form_id', formId);
      formData.append('image_data', imageData);
      formData.append('format', 'png');
      formData.append('points_count', pointsCount.toString());
      if (signerName) formData.append('signer_name', signerName);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/advanced-fields/signature/capture`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Signature saved!');
        onCapture && onCapture(imageData, result.signature_id);
        onClose && onClose();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save signature');
      }
    } catch (e) {
      toast.error('Failed to save signature');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-purple-400" />
            Capture Signature
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Sign in the box below using your mouse or finger
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Signer Name Input */}
          {requireName && (
            <div className="space-y-2">
              <Label className="text-slate-300">Your Name</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full name"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
          )}

          {/* Signature Canvas */}
          <div className="space-y-2">
            <Label className="text-slate-300">Signature</Label>
            <div 
              className="border-2 border-slate-600 rounded-lg overflow-hidden"
              style={{ backgroundColor: backgroundColor }}
            >
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Draw your signature above</span>
              <span>{pointsCount} points</span>
            </div>
          </div>

          {/* Validation Message */}
          {hasSignature && pointsCount < minPoints && (
            <Alert className="bg-yellow-900/30 border-yellow-700">
              <AlertDescription className="text-yellow-300">
                Please provide a more complete signature ({minPoints - pointsCount} more points needed)
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={clearSignature}
            className="border-slate-600 text-slate-300"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={saveSignature}
            disabled={!hasSignature || pointsCount < minPoints}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Check className="h-4 w-4 mr-2" />
            Save Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Signature Display Component
 * Display a captured signature image
 */
export function SignatureDisplay({ imageData, className = '' }) {
  if (!imageData) return null;

  return (
    <div className={`border border-slate-600 rounded-lg overflow-hidden ${className}`}>
      <img
        src={imageData}
        alt="Signature"
        className="w-full h-auto"
      />
    </div>
  );
}

export default SignatureCapture;
