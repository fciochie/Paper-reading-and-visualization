import React from 'react';
import { MindMapData, MindMapNode } from '../types';
import { ChevronRight, FileText, Hash, Layers } from 'lucide-react';

interface OutlineViewProps {
  data: MindMapData;
  onNodeClick: (pageNumber: number, quote?: string) => void;
}

const OutlineView: React.FC<OutlineViewProps> = ({ data, onNodeClick }) => {
  
  const renderNode = (node: MindMapNode, depth: number) => {
    return (
      <div key={node.id} className="mb-2">
        <div 
            className={`
                group flex items-start p-2 rounded-lg cursor-pointer transition-colors
                ${depth === 0 ? 'bg-indigo-50 border border-indigo-100 mb-2 mt-4' : 'hover:bg-slate-50 border border-transparent hover:border-slate-100'}
            `}
            style={{ marginLeft: `${depth * 20}px` }}
            onClick={() => onNodeClick(node.pageNumber, node.quote)}
        >
          {/* Icon based on depth */}
          <div className="mt-1 mr-2 shrink-0 text-slate-400 group-hover:text-indigo-500">
             {depth === 0 ? <Hash className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
                <h4 className={`font-semibold text-slate-800 leading-tight ${depth === 0 ? 'text-lg' : 'text-sm'}`}>
                    {node.label}
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded ml-2 whitespace-nowrap shrink-0">
                    p. {node.pageNumber}
                </span>
            </div>
            
            {/* Show summary only if it exists and isn't just the title repeated */}
            {node.summary && node.summary !== node.label && (
                <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">
                    {node.summary}
                </p>
            )}

            {node.quote && (
                <div className="mt-1.5 flex items-center text-[10px] text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileText className="w-3 h-3 mr-1" />
                    Locate in Text
                </div>
            )}
          </div>
        </div>

        {node.children && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  // Determine what to render. 
  // If the root is our synthetic "Document Overview" (id='root-synthetic'), we skip rendering the root header itself
  // and instead render its children (the actual chapters) as the top level.
  const isSyntheticRoot = data.root.id === 'root-synthetic';
  const nodesToRender = isSyntheticRoot && data.root.children ? data.root.children : [data.root];

  return (
    <div className="h-full overflow-y-auto p-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
             <div className="bg-indigo-100 p-2 rounded-lg">
                <Layers className="w-5 h-5 text-indigo-600" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">Outline & Structure</h2>
                <p className="text-xs text-slate-500">Table of Contents from Document</p>
             </div>
        </div>
        
        {nodesToRender.length > 0 ? (
            nodesToRender.map(node => renderNode(node, 0))
        ) : (
            <div className="text-slate-400 text-center py-10 italic">
                No structure extracted.
            </div>
        )}
      </div>
    </div>
  );
};

export default OutlineView;