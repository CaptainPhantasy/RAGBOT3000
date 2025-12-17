import React from 'react';

// In a real app, use 'react-markdown' or 'markdown-to-jsx'
// This is a simplified renderer for the demo to avoid heavy dependencies in the generated code
export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        if (line.startsWith('# ')) return <h1 key={idx} className="text-xl font-bold mt-4 mb-2 text-slate-800">{line.replace('# ', '')}</h1>;
        if (line.startsWith('## ')) return <h2 key={idx} className="text-lg font-semibold mt-3 mb-1 text-slate-700">{line.replace('## ', '')}</h2>;
        if (line.startsWith('* ') || line.startsWith('- ')) return <li key={idx} className="ml-4 list-disc text-slate-600">{line.replace(/^[*-] /, '')}</li>;
        if (line.startsWith('1. ')) return <li key={idx} className="ml-4 list-decimal text-slate-600">{line.replace(/^\d+\. /, '')}</li>;
        if (line.trim() === '') return <div key={idx} className="h-2" />;
        
        // Bold handling (simple)
        const parts = line.split('**');
        if (parts.length > 1) {
            return (
                <p key={idx} className="text-slate-600">
                    {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-800">{part}</strong> : part)}
                </p>
            )
        }

        return <p key={idx} className="text-slate-600">{line}</p>;
      })}
    </div>
  );
};