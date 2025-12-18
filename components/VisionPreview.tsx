import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

interface VisionPreviewProps {
  isScreenSharing: boolean;
  isCameraActive: boolean;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
  previewPosition: { x: number; y: number };
  previewSize: { width: number; height: number };
  isDragging: boolean;
  isResizing: string | null;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
  getResizeCursor: (handle: string) => string;
}

export const VisionPreview: React.FC<VisionPreviewProps> = ({
  isScreenSharing,
  isCameraActive,
  videoPreviewRef,
  previewPosition,
  previewSize,
  isDragging,
  isResizing,
  onDragStart,
  onResizeStart,
  getResizeCursor,
}) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);

  if (!isScreenSharing && !isCameraActive) return null;

  return (
    <section
      ref={previewContainerRef}
      className="absolute z-30 rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-slate-900/80 backdrop-blur-2xl select-none"
      style={{
        left: `${previewPosition.x}px`,
        top: `${previewPosition.y}px`,
        width: `${previewSize.width}px`,
        height: `${previewSize.height}px`,
        cursor: isResizing ? 'default' : isDragging ? 'grabbing' : 'grab',
        transition: isDragging || isResizing ? 'none' : 'opacity 0.2s ease',
      }}
      onMouseDown={onDragStart}
      role="region"
      aria-label="Agent Vision Preview"
    >
      {/* Video Element */}
      <video
        ref={videoPreviewRef}
        autoPlay
        muted
        playsInline
        className={`w-full h-full object-cover ${isCameraActive ? 'scale-x-[-1]' : ''}`}
        style={{ pointerEvents: 'none' }}
      >
        <track kind="captions" />
      </video>

      {/* Status Badge */}
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[10px] text-white font-bold tracking-wider flex items-center gap-2 border border-white/5 pointer-events-none">
        <span
          className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          aria-hidden="true"
        />
        AGENT VISION ACTIVE
      </div>

      {/* Transition Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />

      {/* Resize Handles */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((handle) => (
        <button
          key={`corner-${handle}`}
          type="button"
          data-resize-handle
          aria-label={`Resize from ${handle.replace('-', ' ')}`}
          className={`absolute ${handle.includes('top') ? 'top-0' : 'bottom-0'} ${handle.includes('left') ? 'left-0' : 'right-0'} w-8 h-8 hover:bg-white/20 transition-colors z-10 ${handle === 'top-left' ? 'rounded-tl-2xl' : handle === 'top-right' ? 'rounded-tr-2xl' : handle === 'bottom-left' ? 'rounded-bl-2xl' : 'rounded-br-2xl'}`}
          style={{ cursor: getResizeCursor(`corner-${handle}`) }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, `corner-${handle}`);
          }}
        />
      ))}

      {/* Edges */}
      {['top', 'bottom', 'left', 'right'].map((handle) => (
        <button
          key={`edge-${handle}`}
          type="button"
          data-resize-handle
          aria-label={`Resize from ${handle}`}
          className={`absolute ${
            handle === 'top' || handle === 'bottom'
              ? `${handle}-0 left-8 right-8 h-4`
              : `${handle}-0 top-8 bottom-8 w-4`
          } hover:bg-white/10 transition-colors z-10`}
          style={{ cursor: getResizeCursor(handle) }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, handle);
          }}
        />
      ))}
    </section>
  );
};
