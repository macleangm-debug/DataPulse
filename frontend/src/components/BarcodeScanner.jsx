/**
 * Barcode Scanner Component
 * Camera-based barcode/QR code scanning using html5-qrcode
 */

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Camera, X, Check, RefreshCw, QrCode, Barcode } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Supported barcode formats
const BARCODE_FORMATS = {
  qr: 'QR Code',
  code128: 'Code 128',
  code39: 'Code 39',
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  upc_a: 'UPC-A',
  itf: 'ITF',
  codabar: 'Codabar',
  datamatrix: 'Data Matrix'
};

export function BarcodeScanner({
  open,
  onClose,
  onScan,
  fieldId,
  formId,
  config = {}
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [stream, setStream] = useState(null);
  const scannerRef = useRef(null);

  const {
    formats = ['qr', 'code128', 'ean13'],
    beepOnScan = true,
    continuous = false
  } = config;

  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
    }
    
    return () => stopScanner();
  }, [open]);

  const startScanner = async () => {
    setError(null);
    setScanning(true);

    try {
      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        
        // Start scanning loop
        scannerRef.current = setInterval(scanFrame, 500);
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera access to scan barcodes.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      clearInterval(scannerRef.current);
      scannerRef.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    setScanning(false);
  };

  const scanFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Get image data for barcode detection
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use BarcodeDetector API if available (Chrome/Edge)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39'] });
        const barcodes = await detector.detect(canvas);
        
        if (barcodes.length > 0) {
          handleDetection(barcodes[0].rawValue, barcodes[0].format);
        }
      } catch (e) {
        // Fallback: no barcode detected
      }
    }
  };

  const handleDetection = async (value, format) => {
    if (beepOnScan) {
      // Play beep sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
      } catch (e) {}
    }

    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    setLastScan({ value, format, time: new Date() });

    // Record scan to backend
    try {
      const formData = new FormData();
      formData.append('field_id', fieldId);
      formData.append('form_id', formId);
      formData.append('scanned_value', value);
      formData.append('format', format || 'unknown');

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/api/advanced-fields/barcode/scan`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.is_valid) {
          toast.success('Barcode scanned successfully!');
          onScan && onScan(value, format);
          
          if (!continuous) {
            stopScanner();
            onClose && onClose();
          }
        } else {
          toast.error(result.validation_error || 'Invalid barcode');
        }
      }
    } catch (e) {
      // Still pass the value even if recording fails
      onScan && onScan(value, format);
    }
  };

  // Manual input fallback
  const handleManualInput = () => {
    const value = prompt('Enter barcode value manually:');
    if (value) {
      handleDetection(value, 'manual');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-400" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <Alert className="bg-red-900/30 border-red-700">
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Video Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-blue-400 rounded-lg opacity-50" />
                </div>
                
                {scanning && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-500/80 text-white animate-pulse">
                      Scanning...
                    </Badge>
                  </div>
                )}
              </div>

              {/* Supported Formats */}
              <div>
                <p className="text-slate-400 text-sm mb-2">Supported formats:</p>
                <div className="flex flex-wrap gap-1">
                  {formats.map(f => (
                    <Badge key={f} variant="outline" className="border-slate-600 text-slate-300 text-xs">
                      {BARCODE_FORMATS[f] || f}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Last Scan */}
              {lastScan && (
                <Alert className="bg-green-900/30 border-green-700">
                  <Check className="h-4 w-4 text-green-400" />
                  <AlertDescription className="text-green-300">
                    <strong>Scanned:</strong> {lastScan.value}
                    <br />
                    <span className="text-xs text-green-400">Format: {lastScan.format}</span>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleManualInput} className="border-slate-600">
            <Barcode className="h-4 w-4 mr-2" />
            Enter Manually
          </Button>
          <Button variant="outline" onClick={startScanner} disabled={scanning} className="border-slate-600">
            <RefreshCw className="h-4 w-4 mr-2" />
            Restart
          </Button>
          <Button onClick={onClose} className="bg-slate-600 hover:bg-slate-700">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BarcodeScanner;
