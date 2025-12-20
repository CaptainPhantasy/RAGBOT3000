import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorToast } from './components/ErrorToast';
import { type InteractionMode, ModeControls } from './components/ModeControls';
import { VisionPreview } from './components/VisionPreview';
// Sparkles replaced with edition background image
// import { SparklesCore } from './components/SparklesBackground';
import { useDragAndResize } from './hooks/useDragAndResize';
import { useMediaStream } from './hooks/useMediaStream';
import { isIOS, isScreenSharingSupported } from './lib/deviceDetection';
import { buildUnifiedSystemPrompt } from './services/geminiService';
import { LiveSession, type LiveSessionError } from './services/liveService';
import { type DocChunk, Mode, type TaskFrame } from './types';

const App = () => {
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [activeTaskFrame] = useState<TaskFrame>({
    intent: 'General Inquiry',
    goal: 'Assist the user',
    constraints: [],
    mode: Mode.TEACH,
  });
  const [retrievedDocs] = useState<DocChunk[]>([]);

  const { isScreenSharing, isCameraActive, cameraFacingMode, analyser, streamRef, setupAudio, startVideoSource, stopVideoSource, toggleCamera } =
    useMediaStream(liveSessionRef, videoPreviewRef);

  // Barge-in interruption state (local VAD)
  const vadFramesAboveRef = useRef(0);
  const vadCooldownUntilRef = useRef(0);
  const vadNoiseFloorRef = useRef(0.02);

  const {
    previewPosition,
    previewSize,
    isDragging,
    isResizing,
    setPreviewPosition,
    handleDragStart,
    handleResizeStart,
    getResizeCursor,
  } = useDragAndResize();

  const handleSessionError = useCallback((error: LiveSessionError) => {
    let msg = '';
    if (error.type === 'permission_denied') {
      if (isIOS()) {
        msg = `Microphone access denied. On iOS, please allow microphone access in Settings > Safari > Microphone, then tap the button again.`;
      } else {
        msg = `Permission denied for ${error.device}. Please allow microphone access and try again.`;
      }
    } else if (error.type === 'network_error') {
      msg = error.message || 'Connection lost.';
    } else {
      msg = `Error: ${error.message}`;
    }
    setLastError(msg);
    setTimeout(() => setLastError(null), 8000);
  }, []);

  const handleModeChange = useCallback(
    async (mode: InteractionMode) => {
      if (interactionMode === mode) {
        setInteractionMode('idle');
        const prev = liveSessionRef.current;
        liveSessionRef.current = null; // prevent status callbacks from re-entering cleanup
        stopVideoSource(prev);
        prev?.disconnect();
        return;
      }

      const prev = liveSessionRef.current;
      liveSessionRef.current = null; // prevent status callbacks from re-entering cleanup
      stopVideoSource(prev);
      prev?.disconnect();
      setInteractionMode(mode);
      if (mode === 'idle') return;

      const session = new LiveSession(
        (text) => console.log('T:', text),
        (base64) => console.log('A:', base64.length),
        handleSessionError,
        async (status) => {
          // Ignore status updates from sessions that are no longer the active one.
          if (liveSessionRef.current !== session) return;

          if (status === 'connected') {
            if (mode === 'screen') {
              const result = await startVideoSource('screen');
              if (!result.success) {
                setLastError(result.error || 'Screen sharing failed.');
                setInteractionMode('idle');
                liveSessionRef.current = null;
                stopVideoSource(session);
                session.disconnect();
              }
            } else if (mode === 'live') {
              const result = await startVideoSource('camera');
              if (!result.success) {
                setLastError(result.error || 'Camera access failed.');
                setInteractionMode('idle');
                liveSessionRef.current = null;
                stopVideoSource(session);
                session.disconnect();
              }
            }
          } else if (status === 'idle') {
            setInteractionMode('idle');
            liveSessionRef.current = null;
            stopVideoSource(session);
          }
        },
      );

      // IMPORTANT: set ref before connecting so startVideoSource() can see an active session.
      liveSessionRef.current = session;

      // iOS Safari requires getUserMedia to be called directly from user gesture
      // setupAudio is called synchronously in the click handler, so this should work
      const ready = await setupAudio();
      if (!ready) {
        if (isIOS()) {
          setLastError('Microphone access required. Please allow access when prompted, or check Settings > Safari > Microphone.');
        } else {
          setLastError('Microphone access required. Please allow access and try again.');
        }
        setInteractionMode('idle');
        liveSessionRef.current = null;
        stopVideoSource(session);
        session.disconnect();
        return;
      }

      const includeVision = mode !== 'voice';
      const prompt = buildUnifiedSystemPrompt(activeTaskFrame, retrievedDocs, includeVision);

      await session.connect(streamRef.current || undefined, prompt);
    },
    [
      interactionMode,
      activeTaskFrame,
      retrievedDocs,
      setupAudio,
      handleSessionError,
      startVideoSource,
      stopVideoSource,
      streamRef,
    ],
  );

  useEffect(() => {
    if ((isScreenSharing || isCameraActive) && previewPosition.x === 0) {
      setPreviewPosition({ x: window.innerWidth - 288, y: window.innerHeight - 272 });
    }
  }, [isScreenSharing, isCameraActive, previewPosition.x, setPreviewPosition]);

  // Barge-in: if the agent is speaking and we detect the user speaking, interrupt agent playback.
  useEffect(() => {
    if (!analyser) return;

    const buffer = new Uint8Array(analyser.fftSize);
    let rafId = 0;

    const tick = () => {
      rafId = window.requestAnimationFrame(tick);

      const session = liveSessionRef.current;
      if (!session || !session.isConnected()) return;

      const now = Date.now();
      if (now < vadCooldownUntilRef.current) return;

      analyser.getByteTimeDomainData(buffer);

      // Compute RMS from centered signal (0-255, center at ~128)
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);

      // Consider the agent "speaking" during short chunk gaps so barge-in is responsive.
      const agentSpeaking = session.isSpeakingOrRecently(1200);

      // Track an adaptive noise floor when the agent is NOT speaking.
      // This helps reduce self-interrupts caused by echo leakage.
      if (!agentSpeaking) {
        // Exponential moving average; clamp to avoid collapsing to ~0.
        vadNoiseFloorRef.current = Math.max(0.01, vadNoiseFloorRef.current * 0.98 + rms * 0.02);
        vadFramesAboveRef.current = 0;
        return;
      }

      const noiseFloor = vadNoiseFloorRef.current;
      // Tune for <2s barge-in: slightly lower thresholds + fewer consecutive frames.
      const absoluteGate = 0.09;
      const relativeGate = noiseFloor * 3 + 0.025;
      const threshold = Math.max(absoluteGate, relativeGate);

      // Require it to be clearly above the floor to avoid echo-triggered interrupts.
      const isSpeech = rms > threshold && rms - noiseFloor > 0.06;
      vadFramesAboveRef.current = isSpeech ? vadFramesAboveRef.current + 1 : 0;

      // Require a few consecutive frames to reduce false positives.
      if (vadFramesAboveRef.current >= 4) {
        vadFramesAboveRef.current = 0;
        vadCooldownUntilRef.current = now + 700;
        session.interrupt({ suppressMs: 1400 });
    }
  };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [analyser]);

  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden relative">
      {/* Edition Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: 'url(/background.jpeg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      
      <h1 className="md:text-7xl text-3xl lg:text-9xl font-bold text-center text-white relative z-20">RAGBot3000</h1>
      <div className="w-[40rem] h-40 relative">
        {/* Gradients */}
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />
      </div>
      <div className="absolute inset-0 z-10">
      <VisionPreview
        isScreenSharing={isScreenSharing}
        isCameraActive={isCameraActive}
        videoPreviewRef={videoPreviewRef}
        previewPosition={previewPosition}
        previewSize={previewSize}
        isDragging={isDragging}
        isResizing={isResizing}
        onDragStart={handleDragStart}
        onResizeStart={handleResizeStart}
        getResizeCursor={getResizeCursor}
      />
      <ModeControls 
        interactionMode={interactionMode} 
        onModeChange={handleModeChange}
        cameraFacingMode={cameraFacingMode}
        onToggleCamera={async () => {
          const result = await toggleCamera();
          if (!result.success && result.error) {
            setLastError(result.error);
          }
        }}
      />
      <ErrorToast error={lastError} onClose={() => setLastError(null)} />
      </div>
    </div>
  );
};

export default App;
