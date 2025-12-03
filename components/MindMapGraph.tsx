import React, { useMemo, useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import { MindMapNode, MindMapData, MindMapOptions, EdgeType, FontSize } from '../types';
import { BookOpen, Settings, Type, GitBranch } from 'lucide-react';

interface MindMapGraphProps {
  data: MindMapData | null;
  onNodeClick: (pageNumber: number, quote?: string) => void;
}

// --- Layout Engine (Left-to-Right Block Layout) ---
const NODE_WIDTH = 280; // Slightly wider for better text fit
const NODE_HEIGHT = 140; 
const RANK_SPACING = 140; // Horizontal spacing between ranks
const NODE_SPACING = 24;  // Vertical spacing between siblings

// Calculate the vertical height required for each subtree
const calculateSubtreeHeight = (node: MindMapNode): number => {
  if (!node.children || node.children.length === 0) {
    node.height = NODE_HEIGHT;
    return NODE_HEIGHT;
  }

  let totalHeight = 0;
  node.children.forEach((child, index) => {
    totalHeight += calculateSubtreeHeight(child);
    if (index < (node.children?.length || 0) - 1) {
      totalHeight += NODE_SPACING;
    }
  });

  // The node's subtree height is at least the node's own height
  node.height = Math.max(NODE_HEIGHT, totalHeight);
  return node.height;
};

// Assign positions based on subtree heights (Left-to-Right)
const assignPositions = (
  node: MindMapNode, 
  x: number, 
  y: number, 
  nodes: Node[], 
  edges: Edge[], 
  options: MindMapOptions,
  parentId?: string
) => {
  // Center parent vertically within its subtree's allocated height
  const myY = y + (node.height! / 2) - (NODE_HEIGHT / 2);
  const myX = x;
  
  const fontSizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  }[options.fontSize];

  nodes.push({
    id: node.id,
    type: 'custom',
    position: { x: myX, y: myY },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { 
        label: node.label, 
        summary: node.summary,
        pageNumber: node.pageNumber,
        quote: node.quote,
        fontSizeClass
    },
  });

  if (parentId) {
    edges.push({
      id: `${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: options.edgeType,
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#94a3b8',
      },
    });
  }

  if (node.children && node.children.length > 0) {
    const childX = x + NODE_WIDTH + RANK_SPACING; // Move right for children
    let currentY = y;
    
    // Calculate total height of children block to center it relative to parent
    const childrenStackHeight = node.children.reduce((acc, c) => acc + (c.height || 0), 0) 
                              + (node.children.length - 1) * NODE_SPACING;
    
    const offset = (node.height! - childrenStackHeight) / 2;
    currentY += offset;

    node.children.forEach((child) => {
      assignPositions(child, childX, currentY, nodes, edges, options, node.id);
      currentY += child.height! + NODE_SPACING; // Move down for next sibling
    });
  }
};

const CustomNode = ({ data }: { data: { label: string; summary: string; pageNumber: number; quote?: string; fontSizeClass: string } }) => {
  return (
    <div className={`
        px-4 py-3 shadow-md rounded-lg bg-white border border-slate-200 w-[280px] group 
        hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer h-[140px] flex flex-col relative
    `}>
      {/* Target Handle (Left) - for incoming connections */}
      <Handle type="target" position={Position.Left} className="!bg-slate-300 w-3 h-3 !-left-1.5" />
      
      <div className="flex items-start justify-between mb-2">
        <div className={`font-bold text-slate-800 leading-tight line-clamp-2 ${data.fontSizeClass}`}>{data.label}</div>
        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono flex items-center gap-1 whitespace-nowrap shrink-0 ml-2">
           Pg {data.pageNumber}
        </span>
      </div>
      
      <div className="text-xs text-slate-500 line-clamp-3 leading-relaxed border-t border-slate-50 pt-2 mt-1 flex-1">
        {data.summary}
      </div>

      <div className="mt-auto pt-2 flex items-center text-indigo-600 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        <BookOpen className="w-3 h-3 mr-1" />
        {data.quote ? "Read Quote" : "Go to Page"}
      </div>

      {/* Source Handle (Right) - for outgoing connections */}
      <Handle type="source" position={Position.Right} className="!bg-slate-300 w-3 h-3 !-right-1.5" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const MindMapGraph: React.FC<MindMapGraphProps> = ({ data, onNodeClick }) => {
  const [options, setOptions] = useState<MindMapOptions>({
    edgeType: 'smoothstep', // Default to smoothstep for clean LTR lines
    fontSize: 'medium'
  });

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    calculateSubtreeHeight(data.root);
    assignPositions(data.root, 0, 0, nodes, edges, options);

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, options]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
      onNodeClick(node.data.pageNumber, node.data.quote);
  }, [onNodeClick]);

  if (!data) return null;

  return (
    <div className="w-full h-full bg-slate-50 relative group/canvas">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
         <div className="bg-white p-1 rounded-lg shadow border border-slate-200 flex flex-col gap-1">
            <div className="p-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Settings className="w-3 h-3" /> Display
            </div>
            
            {/* Font Size Control */}
            <div className="flex items-center gap-1 p-1">
                <button onClick={() => setOptions(o => ({...o, fontSize: 'small'}))} className={`p-1.5 rounded ${options.fontSize === 'small' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><Type className="w-3 h-3" /></button>
                <button onClick={() => setOptions(o => ({...o, fontSize: 'medium'}))} className={`p-1.5 rounded ${options.fontSize === 'medium' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><Type className="w-4 h-4" /></button>
                <button onClick={() => setOptions(o => ({...o, fontSize: 'large'}))} className={`p-1.5 rounded ${options.fontSize === 'large' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}><Type className="w-5 h-5" /></button>
            </div>

             {/* Edge Style Control */}
             <div className="flex items-center gap-1 p-1 border-t border-slate-100">
                <button onClick={() => setOptions(o => ({...o, edgeType: 'straight'}))} className={`p-1.5 rounded ${options.edgeType === 'straight' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Straight"><div className="w-3 h-0.5 bg-current"></div></button>
                <button onClick={() => setOptions(o => ({...o, edgeType: 'smoothstep'}))} className={`p-1.5 rounded ${options.edgeType === 'smoothstep' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Step"><GitBranch className="w-4 h-4" /></button>
                <button onClick={() => setOptions(o => ({...o, edgeType: 'default'}))} className={`p-1.5 rounded ${options.edgeType === 'default' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`} title="Bezier"><div className="w-4 h-4 border-b-2 border-l-2 border-current rounded-bl-lg"></div></button>
            </div>
         </div>
      </div>

      <ReactFlow
        nodes={nodes} 
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        attributionPosition="bottom-right"
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <Controls className="bg-white shadow-sm border border-slate-200 !text-slate-600" />
      </ReactFlow>
    </div>
  );
};

export default MindMapGraph;