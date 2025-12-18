import type React from 'react';
import { isScreenSharingSupported } from '../lib/deviceDetection';
import type { CameraFacingMode } from '../hooks/useMediaStream';

export type InteractionMode = 'voice' | 'screen' | 'live' | 'idle';

interface ModeControlsProps {
  interactionMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  cameraFacingMode?: CameraFacingMode;
  onToggleCamera?: () => void;
}

export const ModeControls: React.FC<ModeControlsProps> = ({ 
  interactionMode, 
  onModeChange, 
  cameraFacingMode,
  onToggleCamera 
}) => {
  const screenSharingSupported = isScreenSharingSupported();
  
  const modes: { id: InteractionMode; label: string; disabled?: boolean; title?: string }[] = [
    { id: 'voice', label: 'VOICE' },
    { 
      id: 'screen', 
      label: 'SCREEN',
      disabled: !screenSharingSupported,
      title: !screenSharingSupported ? 'Screen sharing not supported on this device' : undefined
    },
    { id: 'live', label: 'LIVE' },
  ];

  const showCameraToggle = interactionMode === 'live' && onToggleCamera;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
      {/* Camera flip button - only visible in LIVE mode */}
      {showCameraToggle && (
        <button
          type="button"
          onClick={onToggleCamera}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
          title={cameraFacingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
            <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
            <circle cx="12" cy="12" r="3" />
            <path d="m18 22-3-3 3-3" />
            <path d="m6 2 3 3-3 3" />
          </svg>
          <span>{cameraFacingMode === 'user' ? 'Back' : 'Front'}</span>
        </button>
      )}
      <div className="radio-input" role="group" aria-label="Interaction Mode">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`label ${interactionMode === mode.id ? 'checked' : ''} ${mode.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!mode.disabled) {
                onModeChange(mode.id);
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !mode.disabled) {
                onModeChange(mode.id);
              }
            }}
            aria-pressed={interactionMode === mode.id}
            disabled={mode.disabled}
            title={mode.title}
          >
            <span className="text">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
