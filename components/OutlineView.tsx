import React from 'react';
import { MindMapData, MindMapNode } from '../types';
import { ChevronRight, FileText, Hash } from 'lucide-react';

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
                ${depth === 0 ? 'bg-indigo-50 border border-indigo-100 mb-4' : 'hover:bg-slate-50 border border-transparent hover:border-slate-100'}
            `}
            style={{ marginLeft: `${depth * 16}px` }}
            onClick={() => onNodeClick(node.pageNumber, node.quote)}
        >
          {/* Icon based on depth */}
          <div className="mt-1 mr-2 shrink-0 text-slate-400 group-hover:text-indigo-500">
             {depth === 0 ? <Hash className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
                <h4 className={`font-semibold text-slate-800 ${depth === 0 ? 'text-lg' : 'text-sm'}`}>
                    {node.label}
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded ml-2 whitespace-nowrap">
                    p. {node.pageNumber}
                </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {node.summary}
            </p>
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

  return (
    <div className="h-full overflow-y-auto p-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 pb-4 border-b border-slate-100">
             <h2 className="text-xl font-bold text-slate-800">Outline & Structure</h2>
             <p className="text-sm text-slate-500">Hierarchical breakdown of the document</p>
        </div>
        {renderNode(data.root, 0)}
      </div>
    </div>
  );
};

export default OutlineView;