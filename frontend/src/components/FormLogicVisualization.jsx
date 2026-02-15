import React, { useMemo, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import {
  X,
  Maximize2,
  Minimize2,
  Download,
  ZoomIn,
  ZoomOut,
  GitBranch,
  Calculator,
  Eye,
  EyeOff,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { cn } from '../lib/utils';

// Custom Node Components
const FieldNode = ({ data, selected }) => {
  const getTypeColor = (type) => {
    const colors = {
      text: 'bg-blue-500/20 border-blue-500',
      number: 'bg-purple-500/20 border-purple-500',
      select: 'bg-green-500/20 border-green-500',
      radio: 'bg-green-500/20 border-green-500',
      checkbox: 'bg-yellow-500/20 border-yellow-500',
      date: 'bg-orange-500/20 border-orange-500',
      gps: 'bg-red-500/20 border-red-500',
      photo: 'bg-pink-500/20 border-pink-500',
      calculate: 'bg-cyan-500/20 border-cyan-500',
      note: 'bg-gray-500/20 border-gray-500',
      group: 'bg-indigo-500/20 border-indigo-500',
    };
    return colors[type] || 'bg-gray-500/20 border-gray-500';
  };

  return (
    <div className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[180px] transition-all',
      getTypeColor(data.type),
      selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
    )}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {data.type}
        </Badge>
        {data.hasSkipLogic && (
          <GitBranch className="w-3 h-3 text-yellow-500" />
        )}
        {data.hasCalculation && (
          <Calculator className="w-3 h-3 text-cyan-500" />
        )}
      </div>
      
      <p className="text-sm font-medium text-white truncate">{data.label}</p>
      <p className="text-xs text-gray-400 truncate">{data.name}</p>
      
      {data.required && (
        <Badge variant="destructive" className="text-[10px] mt-1">Required</Badge>
      )}
      
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
};

const ConditionNode = ({ data, selected }) => (
  <div className={cn(
    'px-4 py-3 rounded-xl border-2 bg-yellow-500/10 border-yellow-500 min-w-[200px]',
    selected && 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-background'
  )}>
    <Handle type="target" position={Position.Top} className="!bg-yellow-500 !w-3 !h-3" />
    
    <div className="flex items-center gap-2 mb-2">
      <Filter className="w-4 h-4 text-yellow-500" />
      <span className="text-xs font-medium text-yellow-500">CONDITION</span>
    </div>
    
    <p className="text-sm text-white">{data.condition}</p>
    
    <div className="flex gap-2 mt-2">
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!bg-green-500 !w-3 !h-3 !left-1/4"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!bg-red-500 !w-3 !h-3 !left-3/4"
      />
    </div>
    
    <div className="flex justify-between text-[10px] mt-1">
      <span className="text-green-500">True</span>
      <span className="text-red-500">False</span>
    </div>
  </div>
);

const CalculationNode = ({ data, selected }) => (
  <div className={cn(
    'px-4 py-3 rounded-lg border-2 bg-cyan-500/10 border-cyan-500 min-w-[200px]',
    selected && 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-background'
  )}>
    <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-3 !h-3" />
    
    <div className="flex items-center gap-2 mb-2">
      <Calculator className="w-4 h-4 text-cyan-500" />
      <span className="text-xs font-medium text-cyan-500">CALCULATION</span>
    </div>
    
    <p className="text-sm font-medium text-white">{data.targetField}</p>
    <p className="text-xs text-gray-400 font-mono mt-1 break-all">{data.formula}</p>
    
    <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-3 !h-3" />
  </div>
);

const StartNode = ({ data }) => (
  <div className="px-6 py-3 rounded-full bg-green-500/20 border-2 border-green-500">
    <p className="text-sm font-medium text-green-500">START</p>
    <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
  </div>
);

const EndNode = ({ data }) => (
  <div className="px-6 py-3 rounded-full bg-red-500/20 border-2 border-red-500">
    <Handle type="target" position={Position.Top} className="!bg-red-500 !w-3 !h-3" />
    <p className="text-sm font-medium text-red-500">END</p>
  </div>
);

const nodeTypes = {
  field: FieldNode,
  condition: ConditionNode,
  calculation: CalculationNode,
  start: StartNode,
  end: EndNode,
};

const edgeStyles = {
  default: {
    stroke: '#6b7280',
    strokeWidth: 2,
  },
  skipLogic: {
    stroke: '#eab308',
    strokeWidth: 2,
    strokeDasharray: '5,5',
  },
  calculation: {
    stroke: '#06b6d4',
    strokeWidth: 2,
  },
  true: {
    stroke: '#22c55e',
    strokeWidth: 2,
  },
  false: {
    stroke: '#ef4444',
    strokeWidth: 2,
  },
};

export function FormLogicVisualization({ form, open, onClose }) {
  const [showSkipLogic, setShowSkipLogic] = useState(true);
  const [showCalculations, setShowCalculations] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate nodes and edges from form fields
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!form?.fields?.length) {
      return { initialNodes: [], initialEdges: [] };
    }

    const nodes = [];
    const edges = [];
    let yOffset = 0;
    const xCenter = 400;
    const ySpacing = 120;
    const conditionXOffset = 300;

    // Start node
    nodes.push({
      id: 'start',
      type: 'start',
      position: { x: xCenter - 40, y: yOffset },
      data: {},
    });
    yOffset += ySpacing;

    // Track fields with skip logic conditions
    const skipLogicFields = new Map();
    const calculationFields = new Map();

    // First pass: identify all skip logic and calculations
    form.fields.forEach((field) => {
      if (field.skipLogic?.conditions?.length > 0) {
        field.skipLogic.conditions.forEach((cond) => {
          if (!skipLogicFields.has(cond.field)) {
            skipLogicFields.set(cond.field, []);
          }
          skipLogicFields.get(cond.field).push({
            targetField: field.name,
            condition: cond,
          });
        });
      }
      if (field.calculation) {
        // Extract referenced fields from calculation
        const refs = field.calculation.match(/\{([^}]+)\}/g) || [];
        refs.forEach((ref) => {
          const fieldName = ref.replace(/[{}]/g, '');
          if (!calculationFields.has(fieldName)) {
            calculationFields.set(fieldName, []);
          }
          calculationFields.get(fieldName).push({
            targetField: field.name,
            formula: field.calculation,
          });
        });
      }
    });

    // Second pass: create nodes
    form.fields.forEach((field, index) => {
      const fieldId = `field-${field.name}`;
      const hasSkipLogic = skipLogicFields.has(field.name);
      const hasCalculation = calculationFields.has(field.name);
      const isCalculatedField = !!field.calculation;

      nodes.push({
        id: fieldId,
        type: 'field',
        position: { x: xCenter - 90, y: yOffset },
        data: {
          label: field.label || field.name,
          name: field.name,
          type: field.type,
          required: field.required,
          hasSkipLogic,
          hasCalculation: hasCalculation || isCalculatedField,
        },
      });

      // Add edge from previous field or start
      const prevId = index === 0 ? 'start' : `field-${form.fields[index - 1].name}`;
      edges.push({
        id: `edge-${prevId}-${fieldId}`,
        source: prevId,
        target: fieldId,
        type: 'smoothstep',
        style: edgeStyles.default,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      });

      // Add skip logic condition nodes
      if (showSkipLogic && hasSkipLogic) {
        const conditions = skipLogicFields.get(field.name);
        conditions.forEach((cond, condIndex) => {
          const conditionId = `condition-${field.name}-${condIndex}`;
          const condText = `${cond.condition.field} ${cond.condition.operator} ${cond.condition.value}`;
          
          nodes.push({
            id: conditionId,
            type: 'condition',
            position: { x: xCenter + conditionXOffset, y: yOffset + (condIndex * 100) },
            data: {
              condition: condText,
              sourceField: field.name,
              targetField: cond.targetField,
            },
          });

          // Edge from field to condition
          edges.push({
            id: `edge-${fieldId}-${conditionId}`,
            source: fieldId,
            target: conditionId,
            type: 'smoothstep',
            style: edgeStyles.skipLogic,
            label: 'triggers',
            labelStyle: { fill: '#eab308', fontSize: 10 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#eab308' },
          });
        });
      }

      // Add calculation nodes
      if (showCalculations && isCalculatedField) {
        const calcId = `calc-${field.name}`;
        nodes.push({
          id: calcId,
          type: 'calculation',
          position: { x: xCenter - conditionXOffset - 100, y: yOffset },
          data: {
            targetField: field.name,
            formula: field.calculation,
          },
        });

        edges.push({
          id: `edge-${calcId}-${fieldId}`,
          source: calcId,
          target: fieldId,
          type: 'smoothstep',
          style: edgeStyles.calculation,
          label: 'calculates',
          labelStyle: { fill: '#06b6d4', fontSize: 10 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#06b6d4' },
        });
      }

      yOffset += ySpacing;
    });

    // End node
    nodes.push({
      id: 'end',
      type: 'end',
      position: { x: xCenter - 30, y: yOffset },
      data: {},
    });

    // Edge to end
    if (form.fields.length > 0) {
      const lastFieldId = `field-${form.fields[form.fields.length - 1].name}`;
      edges.push({
        id: `edge-${lastFieldId}-end`,
        source: lastFieldId,
        target: 'end',
        type: 'smoothstep',
        style: edgeStyles.default,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7280' },
      });
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [form, showSkipLogic, showCalculations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when toggles change
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleExport = useCallback(() => {
    // Export as PNG using canvas
    const flowElement = document.querySelector('.react-flow');
    if (flowElement) {
      // For now, just copy the structure to clipboard
      const structure = {
        fields: form?.fields?.length || 0,
        skipLogicRules: form?.fields?.filter(f => f.skipLogic?.conditions?.length > 0).length || 0,
        calculations: form?.fields?.filter(f => f.calculation).length || 0,
      };
      navigator.clipboard.writeText(JSON.stringify(structure, null, 2));
      alert('Form structure copied to clipboard');
    }
  }, [form]);

  if (!form) return null;

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-white">Form Logic Visualization</h2>
          <p className="text-sm text-gray-400">{form.name || 'Untitled Form'}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Toggle controls */}
          <div className="flex items-center gap-2">
            <Switch
              id="show-skip"
              checked={showSkipLogic}
              onCheckedChange={setShowSkipLogic}
            />
            <Label htmlFor="show-skip" className="text-sm flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-yellow-500" />
              Skip Logic
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-calc"
              checked={showCalculations}
              onCheckedChange={setShowCalculations}
            />
            <Label htmlFor="show-calc" className="text-sm flex items-center gap-1">
              <Calculator className="w-3 h-3 text-cyan-500" />
              Calculations
            </Label>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleExport}>
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-4 py-2 border-b border-border bg-card/50">
        <Badge variant="outline">
          {form.fields?.length || 0} Fields
        </Badge>
        <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">
          {form.fields?.filter(f => f.skipLogic?.conditions?.length > 0).length || 0} Skip Rules
        </Badge>
        <Badge variant="outline" className="border-cyan-500/50 text-cyan-500">
          {form.fields?.filter(f => f.calculation).length || 0} Calculations
        </Badge>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1 bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
        >
          <Background color="#374151" gap={20} />
          <Controls className="!bg-card !border-border" />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'start') return '#22c55e';
              if (node.type === 'end') return '#ef4444';
              if (node.type === 'condition') return '#eab308';
              if (node.type === 'calculation') return '#06b6d4';
              return '#6b7280';
            }}
            className="!bg-card !border-border"
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-border bg-card/50 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Start</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>Field</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Condition</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-cyan-500" />
          <span>Calculation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>End</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="w-8 h-0.5 bg-gray-500" />
          <span>Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-yellow-500 border-dashed border-t-2 border-yellow-500" />
          <span>Skip Logic</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-cyan-500" />
          <span>Calculation</span>
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[80vh] p-0 overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  );
}

export default FormLogicVisualization;
