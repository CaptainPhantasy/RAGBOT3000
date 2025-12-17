import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveSession } from './services/liveService';
import { WavyBackground } from './components/WavyBackground';

type MicPermission = 'prompt' | 'granted' | 'denied' | 'requesting';

const App: React.FC = () => {
  const [micPermission, setMicPermission] = useState<MicPermission>('prompt');
  const [isListening, setIsListening] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  // Shared audio resources (refs for things that don't need re-render)
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);

  // Check mic permission on mount
  useEffect(() => {
    checkMicPermission();
  }, []);

  const checkMicPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setMicPermission(result.state as MicPermission);
      
      result.onchange = () => {
        setMicPermission(result.state as MicPermission);
      };
    } catch {
      setMicPermission('prompt');
    }
  };

  // Setup shared audio stream and analyser
  const setupAudio = useCallback(async (): Promise<boolean> => {
    if (streamRef.current && audioContextRef.current && analyser) {
      return true; // Already setup
    }

    setMicPermission('requesting');
    
    try {
      // Get mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create audio context for visualization (standard sample rate)
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Create analyser for waveform visualization
      const newAnalyser = audioContext.createAnalyser();
      newAnalyser.fftSize = 512;
      newAnalyser.smoothingTimeConstant = 0.3;
      
      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(newAnalyser);
      
      // Use state so WavyBackground re-renders with the analyser
      setAnalyser(newAnalyser);
      setMicPermission('granted');
      return true;
    } catch (err) {
      console.error('Mic permission denied:', err);
      setMicPermission('denied');
      return false;
    }
  }, [analyser]);

  const toggleListening = async () => {
    if (isListening) {
      // Stop listening
      liveSessionRef.current?.disconnect();
      liveSessionRef.current = null;
      setIsListening(false);
    } else {
      // Setup audio if needed
      const ready = await setupAudio();
      if (!ready) return;

      // Start Live session with shared stream
      setIsListening(true);
      const session = new LiveSession(
        (text) => console.log('Transcription:', text),
        (base64Audio) => console.log('Audio chunk received')
      );
      
      try {
        await session.connect(streamRef.current!);
        liveSessionRef.current = session;
      } catch (err) {
        console.error('Failed to connect:', err);
        setIsListening(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      liveSessionRef.current?.disconnect();
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setAnalyser(null);
    };
  }, []);

  return (
    <WavyBackground
      analyser={analyser}
      speed="slow"
      waveOpacity={0.4}
      blur={10}
      backgroundFill="#0a0a0f"
      colors={[
        "rgba(220, 38, 38, 0.6)",
        "rgba(34, 211, 238, 0.6)",
        "rgba(168, 85, 247, 0.6)",
      ]}
      containerClassName="relative"
      className="w-full h-full"
    >
      {/* Mic Toggle Button - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
        <button
          onClick={toggleListening}
          disabled={micPermission === 'requesting'}
          className={`
            p-4 rounded-full transition-all duration-300 ease-out
            ${isListening 
              ? 'bg-gradient-to-br from-cyan-500 to-purple-600 shadow-[0_0_40px_rgba(34,211,238,0.4)]' 
              : 'bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700 hover:border-slate-500'
            }
            ${micPermission === 'requesting' ? 'animate-pulse' : ''}
            ${micPermission === 'denied' ? 'opacity-50' : ''}
          `}
        >
          {micPermission === 'denied' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : isListening ? (
            <div className="relative h-6 w-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Minimal Status */}
        {micPermission === 'denied' && (
          <p className="text-red-400/70 text-xs">Mic blocked</p>
        )}
        {micPermission === 'requesting' && (
          <p className="text-slate-500 text-xs animate-pulse">...</p>
        )}
      </div>
    </WavyBackground>
  );
};

export default App;
