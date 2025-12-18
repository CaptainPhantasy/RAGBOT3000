import type React from 'react';
import type { DocChunk } from '../types';

interface EvidenceWidgetProps {
  docs: DocChunk[];
}

export const EvidenceWidget: React.FC<EvidenceWidgetProps> = ({ docs }) => {
  if (docs.length === 0) return null;

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Retrieved Context (RAG)</h3>
      <div className="space-y-3">
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border border-slate-200 rounded-md p-3 shadow-sm hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {doc.productArea}
              </span>
              <span className="text-[10px] text-slate-400">Score: High</span>
            </div>
            <h4 className="text-sm font-medium text-slate-800 truncate" title={doc.title}>
              {doc.title}
            </h4>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {doc.content.substring(0, 100).replace(/#/g, '')}...
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
