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
    async (type: 'screen' | 'camera') => {
      if (!liveSessionRef.current) return;

      try {
        stopVideoSource();

        const stream =
          type === 'screen'
            ? await navigator.mediaDevices.getDisplayMedia({ video: true })
            : await navigator.mediaDevices.getUserMedia({ video: true });

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
      } catch (err) {
        console.error(`Failed to start ${type}:`, err);
        setIsScreenSharing(false);
        setIsCameraActive(false);
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
