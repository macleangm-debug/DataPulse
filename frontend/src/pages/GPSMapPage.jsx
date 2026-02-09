import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Map,
  MapPin,
  Layers,
  Filter,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Users,
  Calendar,
  Target,
  Navigation
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useProjectStore } from '../store';
import { projectAPI } from '../lib/api';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Simple map visualization using OpenStreetMap tiles
const SimpleMap = ({ points, clusters, center, zoom, onPointClick }) => {
  const mapRef = useRef(null);
  const [mapZoom, setMapZoom] = useState(zoom || 10);
  const [mapCenter, setMapCenter] = useState(center || { latitude: 0, longitude: 0 });

  // Calculate pixel position from lat/lng (simple mercator)
  const latLngToPixel = (lat, lng, zoom, centerLat, centerLng, width, height) => {
    const scale = Math.pow(2, zoom);
    const worldSize = 256 * scale;
    
    const x = ((lng + 180) / 360) * worldSize;
    const y = ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * worldSize;
    
    const centerX = ((centerLng + 180) / 360) * worldSize;
    const centerY = ((1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2) * worldSize;
    
    return {
      x: x - centerX + width / 2,
      y: y - centerY + height / 2
    };
  };

  const handleZoomIn = () => setMapZoom(Math.min(mapZoom + 1, 18));
  const handleZoomOut = () => setMapZoom(Math.max(mapZoom - 1, 2));

  // Update center when points change
  useEffect(() => {
    if (center) {
      setMapCenter(center);
    } else if (points?.length > 0) {
      const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
      const avgLng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
      setMapCenter({ latitude: avgLat, longitude: avgLng });
    }
  }, [center, points]);

  const mapWidth = 800;
  const mapHeight = 500;

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: mapHeight }}>
      {/* Map Background - Using a placeholder since we can't load external tiles */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"
        style={{
          backgroundImage: `url('https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/${mapCenter.longitude},${mapCenter.latitude},${mapZoom}/800x500?access_token=placeholder')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Grid overlay for visualization */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      {/* Points */}
      <div className="absolute inset-0">
        {clusters?.map((cluster, i) => {
          const pos = latLngToPixel(
            cluster.latitude,
            cluster.longitude,
            mapZoom,
            mapCenter.latitude,
            mapCenter.longitude,
            mapWidth,
            mapHeight
          );

          if (pos.x < 0 || pos.x > mapWidth || pos.y < 0 || pos.y > mapHeight) return null;

          const size = Math.min(50, Math.max(20, cluster.count * 3));

          return (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute cursor-pointer"
              style={{
                left: pos.x - size / 2,
                top: pos.y - size / 2,
              }}
              onClick={() => onPointClick?.(cluster)}
            >
              <div
                className="rounded-full bg-primary/80 border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-lg"
                style={{ width: size, height: size }}
              >
                {cluster.count}
              </div>
            </motion.div>
          );
        })}

        {/* Individual points (when not clustered) */}
        {!clusters && points?.map((point, i) => {
          const pos = latLngToPixel(
            point.latitude,
            point.longitude,
            mapZoom,
            mapCenter.latitude,
            mapCenter.longitude,
            mapWidth,
            mapHeight
          );

          if (pos.x < 0 || pos.x > mapWidth || pos.y < 0 || pos.y > mapHeight) return null;

          return (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.01 }}
              className="absolute cursor-pointer"
              style={{
                left: pos.x - 6,
                top: pos.y - 6,
              }}
              onClick={() => onPointClick?.(point)}
            >
              <div className="w-3 h-3 rounded-full bg-primary border border-white shadow-lg" />
            </motion.div>
          );
        })}
      </div>

      {/* Zoom Controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <Button variant="secondary" size="icon" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Center Info */}
      <div className="absolute left-4 bottom-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white">
        <div className="flex items-center gap-2">
          <Navigation className="w-3 h-3" />
          <span>{mapCenter.latitude.toFixed(4)}, {mapCenter.longitude.toFixed(4)}</span>
          <span className="text-gray-400">Zoom: {mapZoom}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute right-4 bottom-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Collection Point</span>
        </div>
      </div>
    </div>
  );
};

export function GPSMapPage() {
  const { currentOrg } = useOrgStore();
  const { projects } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [selectedProject, setSelectedProject] = useState('all');
  const [days, setDays] = useState(7);
  const [viewMode, setViewMode] = useState('clusters'); // 'points' | 'clusters'
  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    if (currentOrg) {
      loadProjects();
      loadMapData();
    }
  }, [currentOrg]);

  useEffect(() => {
    if (currentOrg) {
      loadMapData();
    }
  }, [selectedProject, days, viewMode]);

  const loadProjects = async () => {
    try {
      const response = await projectAPI.list(currentOrg.id);
      useProjectStore.getState().setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects');
    }
  };

  const loadMapData = async () => {
    setLoading(true);
    try {
      const projectId = selectedProject === 'all' ? '' : selectedProject;
      
      if (viewMode === 'clusters') {
        const response = await fetch(
          `${API_URL}/api/gps/clusters?org_id=${currentOrg.id}&project_id=${projectId}&days=${days}`
        );
        const data = await response.json();
        setClusters(data.clusters);
        setPoints([]);
      } else {
        const response = await fetch(
          `${API_URL}/api/gps/points?org_id=${currentOrg.id}&project_id=${projectId}&days=${days}&limit=500`
        );
        const data = await response.json();
        setPoints(data.points);
        setBounds(data.bounds);
        setClusters([]);
      }

      // Load coverage stats
      const coverageRes = await fetch(
        `${API_URL}/api/gps/coverage?org_id=${currentOrg.id}&project_id=${projectId}&days=${days}`
      );
      const coverageData = await coverageRes.json();
      setCoverage(coverageData);
    } catch (error) {
      toast.error('Failed to load GPS data');
    } finally {
      setLoading(false);
    }
  };

  const handlePointClick = (point) => {
    setSelectedPoint(point);
  };

  if (!currentOrg) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-400">Please select an organization first</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalPoints = coverage?.total_points || clusters?.reduce((sum, c) => sum + c.count, 0) || points?.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="gps-map-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">GPS Map</h1>
            <p className="text-gray-400">Visualize data collection locations</p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadMapData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Points</p>
                  <p className="text-2xl font-bold text-white">{totalPoints}</p>
                </div>
                <MapPin className="w-8 h-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Enumerators</p>
                  <p className="text-2xl font-bold text-white">{coverage?.enumerator_coverage?.length || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">High Accuracy</p>
                  <p className="text-2xl font-bold text-green-500">
                    {coverage?.accuracy_distribution?.find(a => a._id === 10)?.count || 0}
                  </p>
                </div>
                <Target className="w-8 h-8 text-green-500/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Period</p>
                  <p className="text-2xl font-bold text-white">{days} days</p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'clusters' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('clusters')}
          >
            <Layers className="w-4 h-4 mr-2" />
            Clusters
          </Button>
          <Button
            variant={viewMode === 'points' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('points')}
          >
            <MapPin className="w-4 h-4 mr-2" />
            Points
          </Button>
        </div>

        {/* Map */}
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="w-full h-[500px]" />
            ) : (
              <SimpleMap
                points={points}
                clusters={clusters}
                center={bounds?.center}
                zoom={10}
                onPointClick={handlePointClick}
              />
            )}
          </CardContent>
        </Card>

        {/* Selected Point Info */}
        {selectedPoint && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white">Selected Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Latitude</p>
                  <p className="font-mono text-white">{selectedPoint.latitude?.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Longitude</p>
                  <p className="font-mono text-white">{selectedPoint.longitude?.toFixed(6)}</p>
                </div>
                {selectedPoint.accuracy && (
                  <div>
                    <p className="text-gray-400">Accuracy</p>
                    <p className="font-mono text-white">{selectedPoint.accuracy.toFixed(1)}m</p>
                  </div>
                )}
                {selectedPoint.count && (
                  <div>
                    <p className="text-gray-400">Submissions</p>
                    <p className="font-mono text-white">{selectedPoint.count}</p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <a
                  href={`https://www.google.com/maps?q=${selectedPoint.latitude},${selectedPoint.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open in Google Maps →
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enumerator Coverage */}
        {coverage?.enumerator_coverage?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-white">Enumerator Coverage</CardTitle>
              <CardDescription className="text-gray-400">GPS points by enumerator</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {coverage.enumerator_coverage.slice(0, 10).map((enum_item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {enum_item.name?.charAt(0)?.toUpperCase() || 'E'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-white">{enum_item.name || 'Unknown'}</span>
                        <span className="text-sm text-gray-400">{enum_item.point_count} points</span>
                      </div>
                      <Progress value={(enum_item.point_count / totalPoints) * 100} className="h-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
