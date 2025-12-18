import type React from 'react';

interface ErrorToastProps {
  error: string | null;
  onClose: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-red-900/90 backdrop-blur-md border border-red-700/50 shadow-xl animate-in fade-in slide-in-from-top-4 max-w-md">
      <div className="flex items-start gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <title>Error Icon</title>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-red-100 text-sm font-medium flex-1">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-red-300 hover:text-red-100 transition-colors"
          aria-label="Close Error"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <title>Close Icon</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
