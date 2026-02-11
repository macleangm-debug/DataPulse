import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from './ui/badge';
import { Battery, Wifi, MapPin, Activity, Smartphone } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Sensor Metadata Collector
 * Automatically collects device sensor data during form submission
 */
export function SensorMetadataCollector({
  formId,
  submissionId,
  enabled = true,
  config = {},
  onMetadataUpdate
}) {
  const [metadata, setMetadata] = useState({
    battery: null,
    network: null,
    location: null,
    accelerometer: null,
    device_info: null
  });
  const [collecting, setCollecting] = useState(false);
  const intervalRef = useRef(null);
  const accelerometerRef = useRef(null);

  const {
    collect_battery = true,
    collect_gps = true,
    collect_accelerometer = false,
    collect_network = true,
    gps_interval_seconds = 30,
    accelerometer_sample_rate = 10
  } = config;

  const getAuthHeaders = useCallback(() => {
    let token = localStorage.getItem('access_token');
    if (!token) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed?.state?.token || null;
        } catch (e) {}
      }
    }
    if (!token) token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  // Collect device info
  const collectDeviceInfo = useCallback(() => {
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      online: navigator.onLine,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        orientation: window.screen.orientation?.type
      }
    };
    setMetadata(prev => ({ ...prev, device_info: info }));
    return info;
  }, []);

  // Collect battery status
  const collectBatteryStatus = useCallback(async () => {
    if (!collect_battery || !navigator.getBattery) return null;
    
    try {
      const battery = await navigator.getBattery();
      const status = {
        level: Math.round(battery.level * 100),
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime
      };
      setMetadata(prev => ({ ...prev, battery: status }));
      return status;
    } catch (e) {
      console.warn('Battery API not available:', e);
      return null;
    }
  }, [collect_battery]);

  // Collect network info
  const collectNetworkInfo = useCallback(() => {
    if (!collect_network) return null;
    
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const info = {
      online: navigator.onLine,
      type: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData
    };
    setMetadata(prev => ({ ...prev, network: info }));
    return info;
  }, [collect_network]);

  // Collect GPS location
  const collectLocation = useCallback(() => {
    if (!collect_gps || !navigator.geolocation) return null;
    
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };
          setMetadata(prev => ({ ...prev, location: loc }));
          resolve(loc);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [collect_gps]);

  // Collect accelerometer data
  const collectAccelerometer = useCallback(() => {
    if (!collect_accelerometer || !window.DeviceMotionEvent) return null;
    
    return new Promise((resolve) => {
      const samples = [];
      const handler = (event) => {
        if (samples.length < accelerometer_sample_rate) {
          samples.push({
            x: event.acceleration?.x || 0,
            y: event.acceleration?.y || 0,
            z: event.acceleration?.z || 0,
            interval: event.interval,
            timestamp: Date.now()
          });
        }
      };
      
      window.addEventListener('devicemotion', handler);
      
      // Collect samples for 1 second
      setTimeout(() => {
        window.removeEventListener('devicemotion', handler);
        
        if (samples.length > 0) {
          // Calculate averages
          const avgX = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
          const avgY = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
          const avgZ = samples.reduce((sum, s) => sum + s.z, 0) / samples.length;
          
          const accelData = {
            samples: samples.length,
            average: { x: avgX, y: avgY, z: avgZ },
            max: {
              x: Math.max(...samples.map(s => Math.abs(s.x))),
              y: Math.max(...samples.map(s => Math.abs(s.y))),
              z: Math.max(...samples.map(s => Math.abs(s.z)))
            }
          };
          
          setMetadata(prev => ({ ...prev, accelerometer: accelData }));
          resolve(accelData);
        } else {
          resolve(null);
        }
      }, 1000);
    });
  }, [collect_accelerometer, accelerometer_sample_rate]);

  // Collect all sensor data and send to server
  const collectAndSend = useCallback(async () => {
    if (!submissionId) return;
    
    setCollecting(true);
    
    try {
      const deviceInfo = collectDeviceInfo();
      const [battery, network, location, accelerometer] = await Promise.all([
        collectBatteryStatus(),
        collectNetworkInfo(),
        collectLocation(),
        collect_accelerometer ? collectAccelerometer() : Promise.resolve(null)
      ]);
      
      const sensorData = {
        submission_id: submissionId,
        form_id: formId,
        timestamp: new Date().toISOString(),
        device_info: deviceInfo,
        battery,
        network,
        location,
        accelerometer
      };
      
      // Send to server
      await fetch(`${API_URL}/api/advanced-fields/sensors/metadata`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(sensorData)
      });
      
      if (onMetadataUpdate) {
        onMetadataUpdate(sensorData);
      }
    } catch (error) {
      console.error('Failed to collect sensor metadata:', error);
    } finally {
      setCollecting(false);
    }
  }, [
    submissionId, formId, collectDeviceInfo, collectBatteryStatus,
    collectNetworkInfo, collectLocation, collectAccelerometer,
    collect_accelerometer, getAuthHeaders, onMetadataUpdate
  ]);

  // Start collection on mount
  useEffect(() => {
    if (!enabled || !submissionId) return;
    
    // Initial collection
    collectAndSend();
    
    // Set up interval for periodic collection
    if (gps_interval_seconds > 0) {
      intervalRef.current = setInterval(collectAndSend, gps_interval_seconds * 1000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, submissionId, gps_interval_seconds, collectAndSend]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 flex gap-2 z-50" data-testid="sensor-metadata-collector">
      {metadata.battery && (
        <Badge variant="outline" className="bg-card/80 backdrop-blur">
          <Battery className="h-3 w-3 mr-1" />
          {metadata.battery.level}%
        </Badge>
      )}
      
      {metadata.network && (
        <Badge variant="outline" className={`bg-card/80 backdrop-blur ${
          metadata.network.online ? 'text-green-400' : 'text-red-400'
        }`}>
          <Wifi className="h-3 w-3 mr-1" />
          {metadata.network.type}
        </Badge>
      )}
      
      {metadata.location && (
        <Badge variant="outline" className="bg-card/80 backdrop-blur text-blue-400">
          <MapPin className="h-3 w-3 mr-1" />
          ±{Math.round(metadata.location.accuracy)}m
        </Badge>
      )}
      
      {collecting && (
        <Badge variant="outline" className="bg-card/80 backdrop-blur animate-pulse">
          <Activity className="h-3 w-3 mr-1" />
          Collecting...
        </Badge>
      )}
    </div>
  );
}

/**
 * Sensor Status Display
 * Shows current sensor readings in a compact format
 */
export function SensorStatusDisplay({ metadata }) {
  if (!metadata) return null;
  
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {metadata.battery && (
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded">
          <Battery className="h-3 w-3" />
          <span>{metadata.battery.level}%</span>
          {metadata.battery.charging && <span className="text-green-400">⚡</span>}
        </div>
      )}
      
      {metadata.network && (
        <div className={`flex items-center gap-1 px-2 py-1 bg-muted/30 rounded ${
          metadata.network.online ? 'text-green-400' : 'text-red-400'
        }`}>
          <Wifi className="h-3 w-3" />
          <span>{metadata.network.type}</span>
        </div>
      )}
      
      {metadata.location && (
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded">
          <MapPin className="h-3 w-3" />
          <span>
            {metadata.location.latitude.toFixed(4)}, {metadata.location.longitude.toFixed(4)}
          </span>
        </div>
      )}
      
      {metadata.device_info && (
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded">
          <Smartphone className="h-3 w-3" />
          <span>{metadata.device_info.platform}</span>
        </div>
      )}
    </div>
  );
}

export default SensorMetadataCollector;
