import type React from 'react';
import { isScreenSharingSupported } from '../lib/deviceDetection';

export type InteractionMode = 'voice' | 'screen' | 'live' | 'idle';

interface ModeControlsProps {
  interactionMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
}

export const ModeControls: React.FC<ModeControlsProps> = ({ interactionMode, onModeChange }) => {
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

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
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
