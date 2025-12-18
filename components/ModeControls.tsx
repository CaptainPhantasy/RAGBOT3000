import type React from 'react';

export type InteractionMode = 'voice' | 'screen' | 'live' | 'idle';

interface ModeControlsProps {
  interactionMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
}

export const ModeControls: React.FC<ModeControlsProps> = ({ interactionMode, onModeChange }) => {
  const modes: { id: InteractionMode; label: string }[] = [
    { id: 'voice', label: 'VOICE' },
    { id: 'screen', label: 'SCREEN' },
    { id: 'live', label: 'LIVE' },
  ];

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
      <div className="radio-input" role="group" aria-label="Interaction Mode">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`label ${interactionMode === mode.id ? 'checked' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onModeChange(mode.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onModeChange(mode.id);
              }
            }}
            aria-pressed={interactionMode === mode.id}
          >
            <span className="text">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
