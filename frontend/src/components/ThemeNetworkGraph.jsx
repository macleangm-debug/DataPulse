/**
 * D3.js Force-Directed Theme Network Graph
 * Interactive visualization showing relationships between themes and codes
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export function ThemeNetworkGraph({ projectId, orgId, height = 500 }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [linkStrength, setLinkStrength] = useState([50]);
  const [simulation, setSimulation] = useState(null);

  // Fetch network data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/qualitative/visuals/theme-network/${projectId}?org_id=${orgId}`
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch network data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId, orgId]);

  // Initialize D3 visualization
  useEffect(() => {
    if (!data || !svgRef.current || !data.nodes?.length) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container?.clientWidth || 800;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g').attr('class', 'main-group');

    // Setup zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Prepare nodes and links
    const nodes = data.nodes.map(n => ({ ...n }));
    const links = data.edges.map(e => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
      type: e.type
    }));

    // Create force simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(d => 100 + (d.weight || 1) * 10)
        .strength(linkStrength[0] / 100)
      )
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMax(400)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 10));

    setSimulation(sim);

    // Create arrow marker for directed edges
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .join('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#94a3b8');

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.type === 'theme_code' ? '#8B5CF6' : '#94a3b8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.weight || 1) * 1.5)
      .attr('marker-end', d => d.type === 'theme_code' ? 'url(#arrowhead)' : null);

    // Create link labels for co-occurrence
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links.filter(l => l.type === 'co_occurrence' && l.weight > 2))
      .join('text')
      .attr('font-size', 10)
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle')
      .text(d => `${d.weight}×`);

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Add circles to nodes
    node.append('circle')
      .attr('r', d => Math.max(8, d.size || 10))
      .attr('fill', d => d.color || (d.type === 'theme' ? '#8B5CF6' : '#3B82F6'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', Math.max(8, (d.size || 10)) * 1.3)
          .attr('stroke-width', 3);
        
        // Highlight connected links
        link.attr('stroke-opacity', l => 
          l.source.id === d.id || l.target.id === d.id ? 1 : 0.2
        );
        
        setSelectedNode(d);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', Math.max(8, d.size || 10))
          .attr('stroke-width', 2);
        
        link.attr('stroke-opacity', 0.6);
        setSelectedNode(null);
      });

    // Add labels to nodes
    node.append('text')
      .attr('dx', d => Math.max(10, (d.size || 10)) + 5)
      .attr('dy', 4)
      .attr('font-size', 11)
      .attr('font-weight', d => d.type === 'theme' ? 600 : 400)
      .attr('fill', '#1f2937')
      .text(d => d.label.length > 20 ? d.label.substring(0, 20) + '...' : d.label);

    // Add type badges
    node.filter(d => d.type === 'theme')
      .append('text')
      .attr('dx', d => Math.max(10, (d.size || 10)) + 5)
      .attr('dy', -8)
      .attr('font-size', 9)
      .attr('fill', '#8B5CF6')
      .text('THEME');

    // Update positions on tick
    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkLabels
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) sim.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) sim.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Initial zoom to fit
    setTimeout(() => {
      const bounds = g.node().getBBox();
      const fullWidth = width;
      const fullHeight = height;
      const widthScale = fullWidth / bounds.width;
      const heightScale = fullHeight / bounds.height;
      const scale = Math.min(widthScale, heightScale) * 0.8;
      const translate = [
        (fullWidth - bounds.width * scale) / 2 - bounds.x * scale,
        (fullHeight - bounds.height * scale) / 2 - bounds.y * scale
      ];
      
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }, 1000);

    return () => {
      sim.stop();
    };
  }, [data, height, linkStrength]);

  // Zoom controls
  const handleZoom = (direction) => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom().scaleExtent([0.2, 4]);
    
    svg.transition()
      .duration(300)
      .call(zoom.scaleBy, direction === 'in' ? 1.3 : 0.7);
  };

  const handleReset = () => {
    if (simulation) {
      simulation.alpha(1).restart();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height }}>
        <p>No network data available</p>
        <p className="text-sm mt-2">Create themes and code data to visualize relationships</p>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur rounded-lg shadow-sm border p-2 flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleZoom('in')} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleZoom('out')} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} title="Reset Layout">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="bg-white/90 backdrop-blur rounded-lg shadow-sm border p-3 w-48">
          <div className="text-xs font-medium mb-2">Link Strength</div>
          <Slider
            value={linkStrength}
            onValueChange={setLinkStrength}
            max={100}
            min={10}
            step={10}
            className="w-full"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur rounded-lg shadow-sm border p-3">
        <div className="text-xs font-medium mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>Theme ({data.nodes.filter(n => n.type === 'theme').length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Code ({data.nodes.filter(n => n.type === 'code').length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-2">
            <div className="w-6 h-0.5 bg-purple-500" />
            <span>Theme-Code</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5 bg-slate-400" />
            <span>Co-occurrence</span>
          </div>
        </div>
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute bottom-2 left-2 z-10 bg-white/95 backdrop-blur rounded-lg shadow-lg border p-4 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-4 h-4 rounded-full" 
              style={{ backgroundColor: selectedNode.color || (selectedNode.type === 'theme' ? '#8B5CF6' : '#3B82F6') }}
            />
            <span className="font-medium">{selectedNode.label}</span>
            <Badge variant="secondary" className="text-[10px]">
              {selectedNode.type}
            </Badge>
          </div>
          {selectedNode.type === 'code' && (
            <div className="text-sm text-muted-foreground">
              {selectedNode.size - 5} codings
            </div>
          )}
          {selectedNode.type === 'theme' && (
            <div className="text-sm text-muted-foreground">
              {selectedNode.size - 10} evidence items
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-2 right-2 z-10 bg-white/90 backdrop-blur rounded-lg shadow-sm border px-3 py-2">
        <div className="text-xs text-muted-foreground">
          {data.node_count} nodes • {data.edge_count} connections
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border"
        style={{ minHeight: height }}
      />
    </div>
  );
}

export default ThemeNetworkGraph;
