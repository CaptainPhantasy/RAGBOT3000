import { useCallback, useRef, useState } from 'react';
import type { LiveSession } from '../services/liveService';

export const useMediaStream = (
  liveSessionRef: React.RefObject<LiveSession | null>,
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>,
) => {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const setupAudio = useCallback(async (): Promise<boolean> => {
    if (streamRef.current && audioContextRef.current && analyser) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const newAnalyser = audioContext.createAnalyser();
      newAnalyser.fftSize = 512;
      newAnalyser.smoothingTimeConstant = 0.3;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(newAnalyser);
      setAnalyser(newAnalyser);
      return true;
    } catch (err) {
      console.error('Mic permission denied:', err);
      return false;
    }
  }, [analyser]);

  const stopVideoSource = useCallback((session?: LiveSession | null) => {
    // Allow callers to stop the previous session even if liveSessionRef has already been cleared.
    (session ?? liveSessionRef.current)?.stopVideoStream();
    setIsScreenSharing(false);
    setIsCameraActive(false);
  }, [liveSessionRef]);

  const startVideoSource = useCallback(
    async (type: 'screen' | 'camera'): Promise<{ success: boolean; error?: string }> => {
      if (!liveSessionRef.current) {
        return { success: false, error: 'Session not initialized' };
      }

      try {
        stopVideoSource();

        // Check support before attempting
        if (type === 'screen' && !navigator.mediaDevices?.getDisplayMedia) {
          return { 
            success: false, 
            error: 'Screen sharing is not supported on this device or browser.' 
          };
        }

        if (type === 'camera' && !navigator.mediaDevices?.getUserMedia) {
          return { 
            success: false, 
            error: 'Camera access is not supported on this device or browser.' 
          };
        }

        const stream =
          type === 'screen'
            ? await navigator.mediaDevices.getDisplayMedia({ 
                video: {
                  displaySurface: 'browser', // Prefer browser tab/window over entire screen
                  cursor: 'always',
                } as MediaTrackConstraints 
              })
            : await navigator.mediaDevices.getUserMedia({ 
                video: {
                  facingMode: 'user',
                } 
              });

        liveSessionRef.current.startVideoStream(stream);

        if (type === 'screen') setIsScreenSharing(true);
        else setIsCameraActive(true);

        setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
          }
        }, 100);

        stream.getVideoTracks()[0].onended = () => {
          stopVideoSource();
        };

        return { success: true };
      } catch (err: any) {
        console.error(`Failed to start ${type}:`, err);
        setIsScreenSharing(false);
        setIsCameraActive(false);
        
        let errorMsg = `Failed to start ${type === 'screen' ? 'screen sharing' : 'camera'}.`;
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = type === 'screen' 
            ? 'Screen sharing permission denied. Please allow screen sharing in your browser settings.'
            : 'Camera permission denied. Please allow camera access and try again.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = type === 'screen'
            ? 'No screen or window available to share.'
            : 'No camera found. Please connect a camera and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMsg = `Unable to access ${type === 'screen' ? 'screen' : 'camera'}. It may be in use by another application.`;
        } else if (err.message) {
          errorMsg = err.message;
        }
        
        return { success: false, error: errorMsg };
      }
    },
    [liveSessionRef, videoPreviewRef, stopVideoSource],
  );

  return {
    isScreenSharing,
    isCameraActive,
    analyser,
    streamRef,
    audioContextRef,
    setupAudio,
    startVideoSource,
    stopVideoSource,
    setIsScreenSharing,
    setIsCameraActive,
    setAnalyser,
  };
};
