import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Check,
  AlertCircle,
  Crosshair,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

// Accuracy level indicator
const AccuracyIndicator = ({ accuracy }) => {
  if (!accuracy) return null;

  let color = 'text-red-500';
  let Icon = SignalLow;
  let label = 'Poor';

  if (accuracy <= 10) {
    color = 'text-green-500';
    Icon = SignalHigh;
    label = 'Excellent';
  } else if (accuracy <= 25) {
    color = 'text-blue-500';
    Icon = SignalMedium;
    label = 'Good';
  } else if (accuracy <= 50) {
    color = 'text-yellow-500';
    Icon = Signal;
    label = 'Fair';
  }

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-xs">{label} ({accuracy.toFixed(0)}m)</span>
    </div>
  );
};

export function GpsCapture({
  value,
  onChange,
  required = false,
  minAccuracy = 50,
  showMap = true,
  label = 'GPS Location'
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  // Parse existing value
  const gpsData = value ? (typeof value === 'string' ? JSON.parse(value) : value) : null;

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: new Date().toISOString()
        };
        onChange(locationData);
        setLoading(false);
      },
      (err) => {
        setError(getErrorMessage(err));
        setLoading(false);
      },
      options
    );
  }, [onChange]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }

    setIsTracking(true);
    setError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 1000
    };

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: new Date().toISOString()
        };
        
        // Only update if accuracy meets minimum requirement or is better than current
        if (!gpsData || position.coords.accuracy < (gpsData.accuracy || Infinity)) {
          onChange(locationData);
        }
        
        // Stop tracking if we get good enough accuracy
        if (position.coords.accuracy <= minAccuracy) {
          navigator.geolocation.clearWatch(id);
          setWatchId(null);
          setIsTracking(false);
        }
      },
      (err) => {
        setError(getErrorMessage(err));
      },
      options
    );

    setWatchId(id);
  }, [onChange, gpsData, minAccuracy]);

  const clearLocation = () => {
    onChange(null);
    setError(null);
  };

  const getErrorMessage = (error) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied. Please enable location access.';
      case error.POSITION_UNAVAILABLE:
        return 'Location information unavailable.';
      case error.TIMEOUT:
        return 'Location request timed out. Please try again.';
      default:
        return 'An unknown error occurred.';
    }
  };

  const openInMaps = () => {
    if (gpsData) {
      window.open(
        `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`,
        '_blank'
      );
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium text-white">{label}</span>
            {required && <span className="text-red-500 text-xs">*</span>}
          </div>
          {gpsData && <AccuracyIndicator accuracy={gpsData.accuracy} />}
        </div>

        {/* Location Display */}
        {gpsData ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-card/50 rounded-lg">
              <div>
                <p className="text-xs text-gray-400">Latitude</p>
                <p className="font-mono text-sm text-white">{gpsData.latitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Longitude</p>
                <p className="font-mono text-sm text-white">{gpsData.longitude.toFixed(6)}</p>
              </div>
              {gpsData.altitude && (
                <div>
                  <p className="text-xs text-gray-400">Altitude</p>
                  <p className="font-mono text-sm text-white">{gpsData.altitude.toFixed(1)}m</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400">Captured</p>
                <p className="text-xs text-gray-300">
                  {new Date(gpsData.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Mini Map Preview */}
            {showMap && (
              <div 
                className="relative h-32 rounded-lg overflow-hidden bg-gray-800 cursor-pointer group"
                onClick={openInMaps}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 text-primary mx-auto mb-1" />
                    <p className="text-xs text-gray-400">Click to view in Google Maps</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={captureLocation}
                disabled={loading || isTracking}
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Recapture
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearLocation}
              >
                Clear
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {/* Capture Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={captureLocation}
                disabled={loading || isTracking}
                className="flex-1"
                data-testid="capture-gps-btn"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <Crosshair className="w-4 h-4 mr-2" />
                    Capture Location
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={isTracking ? stopTracking : startTracking}
                disabled={loading}
              >
                {isTracking ? (
                  <>
                    <Navigation className="w-4 h-4 mr-2 animate-pulse" />
                    Stop
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 mr-2" />
                    Track
                  </>
                )}
              </Button>
            </div>

            {/* Tracking indicator */}
            {isTracking && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm text-primary">Tracking location...</span>
                </div>
                <p className="text-xs text-gray-400">
                  Waiting for accuracy better than {minAccuracy}m
                </p>
                <Progress value={30} className="mt-2 h-1" />
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg text-red-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Accuracy requirement hint */}
        {!gpsData && !error && (
          <p className="text-xs text-gray-500">
            Minimum accuracy required: {minAccuracy}m
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Compact display version for form submissions
export function GpsDisplay({ value, label }) {
  const gpsData = value ? (typeof value === 'string' ? JSON.parse(value) : value) : null;

  if (!gpsData) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <MapPin className="w-4 h-4" />
        <span className="text-sm">No location captured</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
        <MapPin className="w-3 h-3 mr-1" />
        GPS
      </Badge>
      <span className="font-mono text-sm text-white">
        {gpsData.latitude.toFixed(4)}, {gpsData.longitude.toFixed(4)}
      </span>
      <AccuracyIndicator accuracy={gpsData.accuracy} />
    </div>
  );
}
