import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { Camera, ScanLine, X, Check, Keyboard, RefreshCw } from 'lucide-react';

/**
 * BarcodeCapture Component
 * Supports camera-based barcode scanning and manual entry
 * Uses native BarcodeDetector API where available, falls back to manual entry
 */
export function BarcodeCapture({ 
  value, 
  onChange, 
  label = "Barcode",
  placeholder = "Scan or enter barcode",
  acceptedFormats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'],
  required = false,
  disabled = false
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [hasDetectorSupport, setHasDetectorSupport] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    // Check for BarcodeDetector support
    if ('BarcodeDetector' in window) {
      setHasDetectorSupport(true);
      // Initialize detector with accepted formats
      try {
        const formats = acceptedFormats.filter(f => 
          ['aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'data_matrix', 
           'ean_13', 'ean_8', 'itf', 'pdf417', 'qr_code', 'upc_a', 'upc_e'].includes(f)
        );
        detectorRef.current = new window.BarcodeDetector({ formats });
      } catch (e) {
        console.error('BarcodeDetector initialization failed:', e);
        setHasDetectorSupport(false);
      }
    }
    
    return () => {
      stopScanning();
    };
  }, [acceptedFormats]);

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        
        if (hasDetectorSupport && detectorRef.current) {
          scanFrame();
        }
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Could not access camera. Please use manual entry.');
      setManualEntry(true);
    }
  };

  const scanFrame = async () => {
    if (!videoRef.current || !detectorRef.current || !isScanning) return;
    
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      
      if (barcodes.length > 0) {
        const barcode = barcodes[0];
        handleBarcodeDetected(barcode.rawValue, barcode.format);
        return;
      }
    } catch (error) {
      console.error('Barcode detection error:', error);
    }
    
    // Continue scanning
    animationRef.current = requestAnimationFrame(scanFrame);
  };

  const handleBarcodeDetected = (barcodeValue, format) => {
    setDetectedFormat(format);
    onChange(barcodeValue);
    stopScanning();
    toast.success(`Barcode scanned: ${format}`);
  };

  const stopScanning = () => {
    setIsScanning(false);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onChange(manualValue.trim());
      setDetectedFormat('manual');
      setManualEntry(false);
      setManualValue('');
      toast.success('Barcode entered manually');
    }
  };

  const clearValue = () => {
    onChange('');
    setDetectedFormat(null);
  };

  return (
    <div className="space-y-2" data-testid="barcode-capture">
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      
      {!value ? (
        <div className="space-y-3">
          {/* Scanning View */}
          {isScanning && (
            <Card className="overflow-hidden">
              <CardContent className="p-0 relative">
                <video 
                  ref={videoRef}
                  className="w-full h-48 object-cover bg-black"
                  playsInline
                  muted
                />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-32 border-2 border-primary rounded-lg relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ScanLine className="w-full h-1 text-primary animate-pulse" />
                    </div>
                  </div>
                </div>
                
                {/* Stop button */}
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="absolute top-2 right-2"
                  onClick={stopScanning}
                >
                  <X className="w-4 h-4" />
                </Button>
                
                {!hasDetectorSupport && (
                  <div className="absolute bottom-2 left-2 right-2 bg-yellow-500/90 text-yellow-950 text-xs p-2 rounded">
                    Auto-detection not supported. Please enter barcode manually.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Manual Entry View */}
          {manualEntry && !isScanning && (
            <div className="flex gap-2">
              <Input
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                autoFocus
              />
              <Button onClick={handleManualSubmit} disabled={!manualValue.trim()}>
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => setManualEntry(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          {/* Action Buttons */}
          {!isScanning && !manualEntry && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={startScanning}
                disabled={disabled}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Scan Barcode
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setManualEntry(true)}
                disabled={disabled}
                className="flex-1"
              >
                <Keyboard className="w-4 h-4 mr-2" />
                Manual Entry
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Value Display */
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <ScanLine className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="font-mono text-lg">{value}</p>
            {detectedFormat && (
              <p className="text-xs text-muted-foreground">Format: {detectedFormat}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={clearValue} disabled={disabled}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Rescan
          </Button>
        </div>
      )}
    </div>
  );
}

export default BarcodeCapture;
