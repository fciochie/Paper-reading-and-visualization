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

// --- Layout Engine (Block Layout) ---
// This ensures nodes don't overlap by calculating subtree widths
const NODE_WIDTH = 260;
const NODE_HEIGHT = 140; // Base height estimate
const X_SPACING = 30; // Horizontal gap between sibling trees
const Y_SPACING = 80; // Vertical gap between generations

// Calculate the size of each subtree
const calculateSubtreeSize = (node: MindMapNode): { width: number } => {
  if (!node.children || node.children.length === 0) {
    node.width = NODE_WIDTH;
    return { width: NODE_WIDTH };
  }

  let totalWidth = 0;
  node.children.forEach((child, index) => {
    const { width } = calculateSubtreeSize(child);
    totalWidth += width;
    if (index < (node.children?.length || 0) - 1) {
      totalWidth += X_SPACING;
    }
  });

  // The node itself needs at least NODE_WIDTH, but its subtree might be wider
  node.width = Math.max(NODE_WIDTH, totalWidth);
  return { width: node.width };
};

// Assign positions based on subtree sizes
const assignPositions = (
  node: MindMapNode, 
  x: number, 
  y: number, 
  nodes: Node[], 
  edges: Edge[], 
  options: MindMapOptions,
  parentId?: string
) => {
  // Center the node itself within its allocated subtree width
  // If it's a leaf, it just sits at x.
  // If it has children, it sits centered above them.
  
  const myX = x + (node.width! / 2) - (NODE_WIDTH / 2);
  
  // Font Size Classes
  const fontSizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  }[options.fontSize];

  nodes.push({
    id: node.id,
    type: 'custom',
    position: { x: myX, y },
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
    let currentX = x;
    
    // If subtree is wider than children combined (due to parent being wide), center children
    // But usually subtree width is sum of children width.
    
    node.children.forEach((child) => {
      assignPositions(child, currentX, y + NODE_HEIGHT + Y_SPACING, nodes, edges, options, node.id);
      currentX += child.width! + X_SPACING;
    });
  }
};

// --- Custom Node Component ---
const CustomNode = ({ data }: { data: { label: string; summary: string; pageNumber: number; quote?: string; fontSizeClass: string } }) => {
  return (
    <div className={`
        px-4 py-3 shadow-md rounded-lg bg-white border border-slate-200 w-[260px] group 
        hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer
    `}>
      <Handle type="target" position={Position.Top} className="!bg-slate-300 w-3 h-3" />
      
      <div className="flex items-start justify-between mb-2">
        <div className={`font-bold text-slate-800 leading-tight ${data.fontSizeClass}`}>{data.label}</div>
        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono flex items-center gap-1 whitespace-nowrap shrink-0 ml-2">
           Pg {data.pageNumber}
        </span>
      </div>
      
      <div className="text-xs text-slate-500 line-clamp-4 leading-relaxed border-t border-slate-50 pt-2 mt-1">
        {data.summary}
      </div>

      <div className="mt-2 flex items-center text-indigo-600 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        <BookOpen className="w-3 h-3 mr-1" />
        {data.quote ? "Read Quote" : "Go to Page"}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 w-3 h-3" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const MindMapGraph: React.FC<MindMapGraphProps> = ({ data, onNodeClick }) => {
  const [options, setOptions] = useState<MindMapOptions>({
    edgeType: 'smoothstep',
    fontSize: 'medium'
  });

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    // 1. Calculate dimensions
    calculateSubtreeSize(data.root);

    // 2. Assign positions (centering root at 0,0 conceptually, though x will be offset)
    // We start x at 0.
    assignPositions(data.root, 0, 0, nodes, edges, options);

    return { initialNodes: nodes, initialEdges: edges };
  }, [data, options]);

  // Keep React Flow state in sync with layout
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
                <button 
                    onClick={() => setOptions(o => ({...o, fontSize: 'small'}))}
                    className={`p-1.5 rounded ${options.fontSize === 'small' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Small Text"
                >
                    <Type className="w-3 h-3" />
                </button>
                <button 
                    onClick={() => setOptions(o => ({...o, fontSize: 'medium'}))}
                    className={`p-1.5 rounded ${options.fontSize === 'medium' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Medium Text"
                >
                    <Type className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setOptions(o => ({...o, fontSize: 'large'}))}
                    className={`p-1.5 rounded ${options.fontSize === 'large' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Large Text"
                >
                    <Type className="w-5 h-5" />
                </button>
            </div>

             {/* Edge Style Control */}
             <div className="flex items-center gap-1 p-1 border-t border-slate-100">
                <button 
                    onClick={() => setOptions(o => ({...o, edgeType: 'straight'}))}
                    className={`p-1.5 rounded ${options.edgeType === 'straight' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Straight Lines"
                >
                    <div className="w-4 h-4 flex items-center justify-center"><div className="w-3 h-0.5 bg-current rotate-45"></div></div>
                </button>
                 <button 
                    onClick={() => setOptions(o => ({...o, edgeType: 'smoothstep'}))}
                    className={`p-1.5 rounded ${options.edgeType === 'smoothstep' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Step Lines"
                >
                    <GitBranch className="w-4 h-4" />
                </button>
                 <button 
                    onClick={() => setOptions(o => ({...o, edgeType: 'default'}))}
                    className={`p-1.5 rounded ${options.edgeType === 'default' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Bezier Curves"
                >
                     <div className="w-4 h-4 border-b-2 border-l-2 border-current rounded-bl-lg"></div>
                </button>
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