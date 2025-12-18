import type React from 'react';
import { useState } from 'react';
import type { Feedback } from '../types';

interface FeedbackWidgetProps {
  onFeedback: (feedback: Feedback) => void;
  existingFeedback?: Feedback;
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ onFeedback, existingFeedback }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');

  if (existingFeedback) {
    return (
      <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
        <span>Feedback sent:</span>
        {existingFeedback.rating === 'up' ? '👍' : '👎'}
      </div>
    );
  }

  const handleRate = (rating: 'up' | 'down') => {
    onFeedback({ rating, timestamp: Date.now(), text: text || undefined });
    setIsOpen(false);
  };

  return (
    <div className="mt-2 flex items-start gap-2">
      {!isOpen ? (
        <div className="flex gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-green-600 transition-colors"
            title="Helpful"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
              />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600 transition-colors"
            title="Not Helpful"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded p-2 flex flex-col gap-2 animate-fade-in w-64">
          <p className="text-xs text-slate-500 font-medium">Rate this response</p>
          <textarea
            className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-400 outline-none"
            rows={2}
            placeholder="Optional feedback..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => handleRate('down')}
              className="p-1.5 rounded bg-white border border-slate-200 hover:bg-red-50 text-slate-600 text-xs"
            >
              👎 Bad
            </button>
            <button
              onClick={() => handleRate('up')}
              className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
            >
              👍 Good
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
