import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Check,
  AlertCircle,
  Crosshair,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

// Accuracy thresholds (in meters)
const ACCURACY_THRESHOLDS = {
  excellent: 10,
  good: 25,
  fair: 50,
  poor: 100
};

const getAccuracyLevel = (accuracy) => {
  if (!accuracy) return 'unknown';
  if (accuracy <= ACCURACY_THRESHOLDS.excellent) return 'excellent';
  if (accuracy <= ACCURACY_THRESHOLDS.good) return 'good';
  if (accuracy <= ACCURACY_THRESHOLDS.fair) return 'fair';
  return 'poor';
};

const getAccuracyColor = (level) => {
  switch (level) {
    case 'excellent': return 'text-green-500';
    case 'good': return 'text-blue-500';
    case 'fair': return 'text-yellow-500';
    case 'poor': return 'text-red-500';
    default: return 'text-gray-400';
  }
};

const getAccuracyBadge = (level) => {
  switch (level) {
    case 'excellent': return 'bg-green-500/10 text-green-500 border-green-500/30';
    case 'good': return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    case 'fair': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
    case 'poor': return 'bg-red-500/10 text-red-500 border-red-500/30';
    default: return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
  }
};

const AccuracyIcon = ({ level }) => {
  switch (level) {
    case 'excellent': return <SignalHigh className="w-4 h-4" />;
    case 'good': return <SignalMedium className="w-4 h-4" />;
    case 'fair': return <SignalLow className="w-4 h-4" />;
    case 'poor': return <Signal className="w-4 h-4" />;
    default: return <Signal className="w-4 h-4" />;
  }
};

export function GPSCapture({
  value,
  onChange,
  required = false,
  autoCapture = false,
  minAccuracy = 50,
  showMap = false,
  fieldId
}) {
  const [capturing, setCapturing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(null);
  const bestPositionRef = useRef(null);

  useEffect(() => {
    if (autoCapture && !value) {
      startCapture();
    }
    
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [autoCapture]);

  const startCapture = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      toast.error('GPS not supported');
      return;
    }

    setCapturing(true);
    setError(null);
    setAttempts(0);
    bestPositionRef.current = null;

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    };

    // Use watchPosition for continuous updates
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const pos = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: new Date().toISOString()
        };

        setCurrentPosition(pos);
        setAttempts(prev => prev + 1);

        // Keep track of best position
        if (!bestPositionRef.current || pos.accuracy < bestPositionRef.current.accuracy) {
          bestPositionRef.current = pos;
        }

        // Auto-accept if accuracy is good enough
        if (pos.accuracy <= minAccuracy) {
          acceptPosition(pos);
          navigator.geolocation.clearWatch(id);
        }
      },
      (err) => {
        console.error('GPS Error:', err);
        setError(getErrorMessage(err));
        setCapturing(false);
        toast.error(getErrorMessage(err));
      },
      options
    );

    setWatchId(id);

    // Auto-timeout after 30 seconds
    setTimeout(() => {
      if (capturing && watchId !== null) {
        navigator.geolocation.clearWatch(id);
        if (bestPositionRef.current) {
          acceptPosition(bestPositionRef.current);
        } else {
          setError('Could not get accurate location. Try again in an open area.');
          setCapturing(false);
        }
      }
    }, 30000);
  };

  const stopCapture = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setCapturing(false);
  };

  const acceptPosition = (pos) => {
    stopCapture();
    onChange(pos);
    toast.success(`Location captured (${pos.accuracy.toFixed(0)}m accuracy)`);
  };

  const acceptCurrentPosition = () => {
    if (currentPosition) {
      acceptPosition(currentPosition);
    }
  };

  const clearPosition = () => {
    onChange(null);
    setCurrentPosition(null);
    bestPositionRef.current = null;
  };

  const getErrorMessage = (error) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied. Please enable GPS access.';
      case error.POSITION_UNAVAILABLE:
        return 'Location unavailable. Please try again.';
      case error.TIMEOUT:
        return 'Location request timed out. Try moving to an open area.';
      default:
        return 'Failed to get location.';
    }
  };

  const displayPosition = value || currentPosition;
  const accuracyLevel = displayPosition ? getAccuracyLevel(displayPosition.accuracy) : 'unknown';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="font-medium text-white">GPS Location</span>
            {required && <span className="text-red-500">*</span>}
          </div>
          {displayPosition && (
            <Badge variant="outline" className={getAccuracyBadge(accuracyLevel)}>
              <AccuracyIcon level={accuracyLevel} />
              <span className="ml-1 capitalize">{accuracyLevel}</span>
            </Badge>
          )}
        </div>

        {/* Capture UI */}
        {capturing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center py-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-primary/30 flex items-center justify-center">
                  <Crosshair className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-300">Acquiring GPS signal...</p>
              <p className="text-xs text-gray-500">Attempt {attempts} • Min accuracy: {minAccuracy}m</p>
            </div>

            {currentPosition && (
              <div className="bg-card/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Current Accuracy:</span>
                  <span className={getAccuracyColor(accuracyLevel)}>
                    {currentPosition.accuracy.toFixed(1)}m
                  </span>
                </div>
                <Progress 
                  value={Math.min(100, (minAccuracy / currentPosition.accuracy) * 100)} 
                  className="h-2"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={acceptCurrentPosition}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept Current ({currentPosition.accuracy.toFixed(0)}m)
                </Button>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={stopCapture}>
              Cancel
            </Button>
          </div>
        ) : displayPosition ? (
          <div className="space-y-3">
            {/* Coordinates Display */}
            <div className="bg-card/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Latitude</p>
                  <p className="font-mono text-white">{displayPosition.latitude.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Longitude</p>
                  <p className="font-mono text-white">{displayPosition.longitude.toFixed(6)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Accuracy</p>
                  <p className={`font-mono ${getAccuracyColor(accuracyLevel)}`}>
                    ±{displayPosition.accuracy.toFixed(1)}m
                  </p>
                </div>
                {displayPosition.altitude && (
                  <div>
                    <p className="text-gray-400 text-xs">Altitude</p>
                    <p className="font-mono text-white">{displayPosition.altitude.toFixed(1)}m</p>
                  </div>
                )}
              </div>

              {displayPosition.timestamp && (
                <div className="text-xs text-gray-500">
                  Captured: {new Date(displayPosition.timestamp).toLocaleString()}
                </div>
              )}
            </div>

            {/* Mini Map Preview */}
            {showMap && (
              <div className="h-32 rounded-lg bg-gray-800 flex items-center justify-center">
                <a
                  href={`https://www.google.com/maps?q=${displayPosition.latitude},${displayPosition.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Navigation className="w-4 h-4" />
                  View on Google Maps
                </a>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={startCapture}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Recapture
              </Button>
              <Button variant="ghost" onClick={clearPosition}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button className="w-full" onClick={startCapture}>
              <MapPin className="w-4 h-4 mr-2" />
              Capture Location
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Ensure GPS is enabled and you're in an open area for best accuracy
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// GPS accuracy indicator for tables/lists
export function GPSAccuracyBadge({ accuracy }) {
  const level = getAccuracyLevel(accuracy);
  
  return (
    <Badge variant="outline" className={getAccuracyBadge(level)}>
      <AccuracyIcon level={level} />
      <span className="ml-1">{accuracy?.toFixed(0)}m</span>
    </Badge>
  );
}
