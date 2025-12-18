import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveSession, LiveSessionError } from './services/liveService';
import { getUnifiedLivePrompt, analyzeIntent, generateTeammateResponse } from './services/geminiService';
import { WavyBackground } from './components/WavyBackground';
import { EvidenceWidget } from './components/EvidenceWidget';
import { TaskFrameWidget } from './components/TaskFrameWidget';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { TaskFrame, DocChunk, Mode, Message } from './types';
import { knowledgeBase } from './knowledgeBase';

type MicPermission = 'prompt' | 'granted' | 'denied' | 'requesting';
type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnecting' | 'error';
type InteractionMode = 'chat' | 'screen' | 'live' | 'idle';

const App: React.FC = () => {
  const [micPermission, setMicPermission] = useState<MicPermission>('prompt');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('idle');
  const [isListening, setIsListening] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [errorTimeout, setErrorTimeout] = useState<number | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Shared Agent Context (The "Brain" state)
  const [activeTaskFrame, setActiveTaskFrame] = useState<TaskFrame>({
    intent: "General Inquiry",
    goal: "Assist the user",
    constraints: [],
    mode: Mode.TEACH
  });
  const [retrievedDocs, setRetrievedDocs] = useState<DocChunk[]>([]);
  
  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Text Submission
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userText = inputValue.trim();
    setInputValue('');
    
    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 2. RAG Retrieval
      const docs = await knowledgeBase.search(userText);
      setRetrievedDocs(docs);

      // 3. Analyze Intent
      const taskFrame = await analyzeIntent(userText, messages.map(m => ({ role: m.role, text: m.text })));
      setActiveTaskFrame(taskFrame);

      // 4. Generate Response
      const response = await generateTeammateResponse(
        userText,
        taskFrame,
        docs,
        messages.map(m => ({ role: m.role, text: m.text }))
      );

      // 5. Add AI Message
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Failed to process message:', err);
      showError('Failed to send message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Vision preview position and size state
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 256, height: 144 }); // 16:9 aspect ratio
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
  // Use refs to avoid stale closures and track drag/resize state
  const dragStateRef = useRef<{
    isActive: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    thresholdMet: boolean;
  }>({
    isActive: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    thresholdMet: false
  });
  
  const resizeStateRef = useRef<{
    isActive: boolean;
    handle: string | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startPosX: number;
    startPosY: number;
  }>({
    isActive: false,
    handle: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startPosX: 0,
    startPosY: 0
  });
  
  const previewPositionRef = useRef(previewPosition);
  const previewSizeRef = useRef(previewSize);
  
  // Keep refs in sync with state
  useEffect(() => {
    previewPositionRef.current = previewPosition;
  }, [previewPosition]);
  
  useEffect(() => {
    previewSizeRef.current = previewSize;
  }, [previewSize]);
  
  // Shared audio resources (refs for things that don't need re-render)
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  // Unified video source handler for robustness
  const startVideoSource = async (type: 'screen' | 'camera') => {
    if (!liveSessionRef.current) return;

    try {
      // 1. Absolute Cleanup of existing video
      liveSessionRef.current.stopVideoStream();
      setIsScreenSharing(false);
      setIsCameraActive(false);

      // 2. Request New Stream
      const stream = type === 'screen' 
        ? await navigator.mediaDevices.getDisplayMedia({ video: true })
        : await navigator.mediaDevices.getUserMedia({ video: true });

      // 3. Attach to Agent
      liveSessionRef.current.startVideoStream(stream);
      
      // 4. Update UI State
      if (type === 'screen') setIsScreenSharing(true);
      else setIsCameraActive(true);

      // 5. Attach to Preview (Timeout to allow DOM to render if it was hidden)
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      }, 100);

      // 6. Robust "Stop Sharing" handling
      stream.getVideoTracks()[0].onended = () => {
        liveSessionRef.current?.stopVideoStream();
        setIsScreenSharing(false);
        setIsCameraActive(false);
      };

    } catch (err) {
      console.error(`Failed to start ${type}:`, err);
      // Ensure UI stays synced on cancel/error
      setIsScreenSharing(false);
      setIsCameraActive(false);
    }
  };

  // Clear error message after timeout
  const showError = useCallback((message: string, duration: number = 5000) => {
    setLastError(message);
    
    // Clear any existing timeout
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    
    // Set new timeout to clear error
    const timeout = window.setTimeout(() => {
      setLastError(null);
      setErrorTimeout(null);
    }, duration);
    
    setErrorTimeout(timeout);
  }, [errorTimeout]);

  // Handle LiveSession errors
  const handleSessionError = useCallback((error: LiveSessionError) => {
    let errorMessage = '';
    
    switch (error.type) {
      case 'permission_denied':
        errorMessage = `Permission denied for ${error.device}. Please grant access in your browser settings.`;
        break;
      case 'network_error':
        if (error.retrying) {
          errorMessage = error.message || `Reconnecting (${error.attempt}/5)...`;
        } else {
          errorMessage = error.message || 'Connection lost. Please try again.';
          setConnectionStatus('error');
        }
        break;
      case 'api_error':
        errorMessage = `API Error: ${error.message}`;
        setConnectionStatus('error');
        break;
      case 'audio_context_error':
        errorMessage = `Audio Error: ${error.message}`;
        break;
    }
    
    if (errorMessage) {
      showError(errorMessage, error.type === 'network_error' && error.retrying ? 3000 : 5000);
    }
  }, [showError]);

  // Handle status changes
  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    
    // Update listening state based on connection status
    if (status === 'connected') {
      setIsListening(true);
    } else if (status === 'idle' || status === 'error') {
      setIsListening(false);
      // Reset to idle mode if connection fails
      if (status === 'error') {
        setInteractionMode('idle');
      }
    }
  }, []);

  // Handle mode change for three-way toggle
  const handleModeChange = useCallback(async (mode: InteractionMode) => {
    console.log('=== MODE CHANGE TRIGGERED ===');
    console.log('Requested mode:', mode);
    console.log('Current mode state:', interactionMode);
    
    // Rule 1: If clicking the mode that is ALREADY active, toggle it OFF to 'idle'
    if (interactionMode === mode) {
      console.log('Toggling off mode:', mode);
      setInteractionMode('idle');
      
      // Full Cleanup
      liveSessionRef.current?.disconnect();
      liveSessionRef.current = null;
      setIsListening(false);
      setConnectionStatus('idle');
      setLastError(null);
      setIsScreenSharing(false);
      setIsCameraActive(false);
      return;
    }

    // Rule 2: If switching to a different mode, perform a clean handover
    console.log('Switching from', interactionMode, 'to', mode);
    
    // Stop any existing session/streams first for a clean state
    if (liveSessionRef.current) {
      liveSessionRef.current.disconnect();
      liveSessionRef.current = null;
    }
    setIsScreenSharing(false);
    setIsCameraActive(false);
    setIsListening(false);
    setConnectionStatus('idle');

    // Update state immediately for visual feedback
    setInteractionMode(mode);

    // If requested mode is idle, we are done
    if (mode === 'idle') return;

    // Start the new mode
    if (mode === 'chat') {
      // Chat mode - Just show the UI, no voice session
      setIsListening(false);
      setConnectionStatus('idle');
      return;
    }

    // Voice modes (screen, live)
    setIsListening(true);
    setConnectionStatus('connecting');

    const session = new LiveSession(
      (text) => {
        console.log('Transcription:', text);
        // Optionally add transcriptions to message history
      },
      (base64Audio) => console.log('Audio chunk received'),
      handleSessionError,
      (status) => {
        handleStatusChange(status);
        // Automatically trigger vision if the mode requires it
        if (status === 'connected') {
          if (mode === 'screen') {
            startVideoSource('screen').catch(err => console.error('Screen start failed:', err));
          } else if (mode === 'live') {
            startVideoSource('camera').catch(err => console.error('Camera start failed:', err));
          }
        }
      }
    );
    
    try {
      // Ensure audio is ready before connecting
      const ready = await setupAudio();
      if (!ready) {
        showError('Microphone access is required.');
        setInteractionMode('idle');
        return;
      }

      const prompt = getUnifiedLivePrompt(activeTaskFrame, retrievedDocs);
      await session.connect(streamRef.current!, prompt);
      liveSessionRef.current = session;
    } catch (err: any) {
      console.error('Failed to connect:', err);
      setIsListening(false);
      setConnectionStatus('error');
      setInteractionMode('idle');
      showError(`Connection failed: ${err.message || 'Unknown error'}`);
    }
  }, [interactionMode, activeTaskFrame, retrievedDocs, setupAudio, handleSessionError, handleStatusChange, showError]);

  // Initialize preview position on first show (only once)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if ((isScreenSharing || isCameraActive) && !hasInitializedRef.current) {
      // Position initially at bottom-right (default macOS-like position)
      const initialX = Math.max(0, window.innerWidth - previewSize.width - 32);
      const initialY = Math.max(0, window.innerHeight - previewSize.height - 128); // Above controls
      setPreviewPosition({ x: initialX, y: initialY });
      hasInitializedRef.current = true;
    } else if (!isScreenSharing && !isCameraActive) {
      hasInitializedRef.current = false;
    }
  }, [isScreenSharing, isCameraActive, previewSize]);

  // Drag handlers with threshold (macOS-like behavior)
  const DRAG_THRESHOLD = 5; // pixels to move before drag starts
  
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't drag if already resizing
    if (resizeStateRef.current.isActive) return;
    
    // Check if click is on a resize handle (they stop propagation)
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize-handle]')) {
      return;
    }
    
    // Initialize drag state but don't activate until threshold is met
    dragStateRef.current = {
      isActive: false,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: previewPositionRef.current.x,
      startPosY: previewPositionRef.current.y,
      thresholdMet: false
    };
    
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const { innerWidth: vw, innerHeight: vh } = window;
    const MIN_WIDTH = 160;
    const MIN_HEIGHT = 90;
    
    // Handle dragging
    if (dragStateRef.current.isActive || dragStateRef.current.startX !== 0) {
      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Check if threshold is met
      if (!dragStateRef.current.thresholdMet) {
        if (distance >= DRAG_THRESHOLD) {
          dragStateRef.current.thresholdMet = true;
          dragStateRef.current.isActive = true;
          setIsDragging(true);
          document.body.style.cursor = 'grabbing';
        } else {
          return; // Don't move until threshold is met
        }
      }
      
      if (dragStateRef.current.isActive) {
        const newX = dragStateRef.current.startPosX + deltaX;
        const newY = dragStateRef.current.startPosY + deltaY;
        const maxX = vw - previewSizeRef.current.width;
        const maxY = vh - previewSizeRef.current.height;
        
        setPreviewPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    }
    
    // Handle resizing
    if (resizeStateRef.current.isActive && resizeStateRef.current.handle) {
      const handle = resizeStateRef.current.handle;
      const deltaX = e.clientX - resizeStateRef.current.startX;
      const deltaY = e.clientY - resizeStateRef.current.startY;
      const aspectRatio = resizeStateRef.current.startWidth / resizeStateRef.current.startHeight;
      
      let newWidth = resizeStateRef.current.startWidth;
      let newHeight = resizeStateRef.current.startHeight;
      let newX = resizeStateRef.current.startPosX;
      let newY = resizeStateRef.current.startPosY;
      
      // Corner resizes (maintain aspect ratio)
      if (handle.includes('corner')) {
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);
        
        // Use the larger delta for smoother corner resizing
        if (absDeltaX > absDeltaY) {
          // Resize based on X
          if (handle.includes('right')) {
            newWidth = Math.max(MIN_WIDTH, resizeStateRef.current.startWidth + deltaX);
          } else {
            newWidth = Math.max(MIN_WIDTH, resizeStateRef.current.startWidth - deltaX);
            newX = resizeStateRef.current.startPosX + (resizeStateRef.current.startWidth - newWidth);
          }
          newHeight = newWidth / aspectRatio;
          if (handle.includes('top')) {
            newY = resizeStateRef.current.startPosY + (resizeStateRef.current.startHeight - newHeight);
          }
        } else {
          // Resize based on Y
          if (handle.includes('bottom')) {
            newHeight = Math.max(MIN_HEIGHT, resizeStateRef.current.startHeight + deltaY);
          } else {
            newHeight = Math.max(MIN_HEIGHT, resizeStateRef.current.startHeight - deltaY);
            newY = resizeStateRef.current.startPosY + (resizeStateRef.current.startHeight - newHeight);
          }
          newWidth = newHeight * aspectRatio;
          if (handle.includes('left')) {
            newX = resizeStateRef.current.startPosX + (resizeStateRef.current.startWidth - newWidth);
          }
        }
      } else {
        // Edge resizes (free resize)
        if (handle === 'right') {
          newWidth = Math.max(MIN_WIDTH, Math.min(resizeStateRef.current.startWidth + deltaX, vw - resizeStateRef.current.startPosX));
        } else if (handle === 'left') {
          const maxWidthChange = resizeStateRef.current.startPosX + resizeStateRef.current.startWidth;
          const widthChange = Math.max(0, Math.min(deltaX, maxWidthChange - MIN_WIDTH));
          newWidth = resizeStateRef.current.startWidth - widthChange;
          newX = resizeStateRef.current.startPosX + widthChange;
        } else if (handle === 'bottom') {
          newHeight = Math.max(MIN_HEIGHT, Math.min(resizeStateRef.current.startHeight + deltaY, vh - resizeStateRef.current.startPosY));
        } else if (handle === 'top') {
          const maxHeightChange = resizeStateRef.current.startPosY + resizeStateRef.current.startHeight;
          const heightChange = Math.max(0, Math.min(deltaY, maxHeightChange - MIN_HEIGHT));
          newHeight = resizeStateRef.current.startHeight - heightChange;
          newY = resizeStateRef.current.startPosY + heightChange;
        }
      }
      
      // Constrain to viewport
      const maxX = vw - newWidth;
      const maxY = vh - newHeight;
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));
      
      // Final size constraints
      const finalWidth = Math.max(MIN_WIDTH, Math.min(newWidth, vw - constrainedX));
      const finalHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, vh - constrainedY));
      
      setPreviewPosition({ x: constrainedX, y: constrainedY });
      setPreviewSize({ width: finalWidth, height: finalHeight });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    // Reset drag state
    if (dragStateRef.current.isActive || dragStateRef.current.startX !== 0) {
      setIsDragging(false);
      dragStateRef.current = {
        isActive: false,
        startX: 0,
        startY: 0,
        startPosX: 0,
        startPosY: 0,
        thresholdMet: false
      };
      document.body.style.cursor = '';
    }
    
    // Reset resize state
    if (resizeStateRef.current.isActive) {
      setIsResizing(null);
      resizeStateRef.current = {
        isActive: false,
        handle: null,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startPosX: 0,
        startPosY: 0
      };
      document.body.style.cursor = '';
    }
    
    document.body.style.userSelect = '';
  }, []);

  // Attach global mouse event listeners (always attached for threshold detection)
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, handleMouseUp]);

  // Get cursor style for resize handles
  const getResizeCursor = useCallback((handle: string) => {
    if (handle.includes('corner')) {
      if (handle.includes('top-left') || handle.includes('bottom-right')) return 'nwse-resize';
      return 'nesw-resize';
    }
    if (handle.includes('top') || handle.includes('bottom')) return 'ns-resize';
    return 'ew-resize';
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    resizeStateRef.current = {
      isActive: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: previewSizeRef.current.width,
      startHeight: previewSizeRef.current.height,
      startPosX: previewPositionRef.current.x,
      startPosY: previewPositionRef.current.y
    };
    setIsResizing(handle);
    document.body.style.cursor = getResizeCursor(handle);
    document.body.style.userSelect = 'none';
    e.preventDefault();
    e.stopPropagation();
  }, [getResizeCursor]);

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
      
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
      
      setAnalyser(null);
    };
  }, [errorTimeout]);

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
      {/* Main UI Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
        
        {/* Chat Interface - Visible in 'chat' mode or when idle */}
        {(interactionMode === 'chat' || interactionMode === 'idle') && (
          <div className="w-full max-w-4xl h-[80vh] bg-white/10 backdrop-blur-3xl rounded-3xl border border-white/20 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Split Screen Chat */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* Left Side: Messages */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-white/10">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                      <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-semibold text-white">Hi, I'm Legacy</h2>
                      <p className="text-slate-300 max-w-sm">I'm your technical RAG teammate. Ask me anything about OrbitWork or share your screen for live help.</p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 ${
                          m.role === 'user' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                            : 'bg-slate-800 text-slate-100 border border-white/10'
                        }`}>
                          <MarkdownRenderer content={m.text} />
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/20 border-t border-white/10">
                  <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isProcessing}
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isProcessing || !inputValue.trim()}
                      className="p-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all disabled:opacity-50 disabled:bg-slate-700"
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Side: Sidebars (RAG + Progress) */}
              <div className="w-80 hidden lg:flex flex-col min-w-0 bg-black/10 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                <TaskFrameWidget frame={activeTaskFrame} />
                <EvidenceWidget docs={retrievedDocs} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Confidence Monitor (Visual Preview) - Draggable & Resizable */}
      {(isScreenSharing || isCameraActive) && (
        <div
          ref={previewContainerRef}
          className="absolute z-30 rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-slate-900/80 backdrop-blur-2xl select-none"
          style={{
            left: `${previewPosition.x}px`,
            top: `${previewPosition.y}px`,
            width: `${previewSize.width}px`,
            height: `${previewSize.height}px`,
            cursor: isResizing ? 'default' : (isDragging ? 'grabbing' : 'grab'),
            transition: isDragging || isResizing ? 'none' : 'opacity 0.2s ease'
          }}
          onMouseDown={handleDragStart}
        >
          {/* Video Element */}
          <video 
            ref={videoPreviewRef} 
            autoPlay 
            muted 
            playsInline 
            className={`w-full h-full object-cover ${isCameraActive ? 'scale-x-[-1]' : ''}`}
            style={{ pointerEvents: 'none' }}
          />
          
          {/* Status Badge */}
          <div 
            className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[10px] text-white font-bold tracking-wider flex items-center gap-2 border border-white/5 pointer-events-none"
            style={{ pointerEvents: 'none' }}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            AGENT VISION ACTIVE
          </div>
          
          {/* Transition Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 to-transparent" />
          
          {/* Resize Handles - macOS style (larger, easier to target) */}
          {/* Corners - 8px for better targeting */}
          <div
            data-resize-handle
            className="absolute top-0 left-0 w-8 h-8 cursor-nwse-resize hover:bg-white/20 transition-colors rounded-tl-2xl z-10 -ml-1 -mt-1"
            style={{ cursor: getResizeCursor('corner-top-left') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'corner-top-left');
            }}
          />
          <div
            data-resize-handle
            className="absolute top-0 right-0 w-8 h-8 cursor-nesw-resize hover:bg-white/20 transition-colors rounded-tr-2xl z-10 -mr-1 -mt-1"
            style={{ cursor: getResizeCursor('corner-top-right') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'corner-top-right');
            }}
          />
          <div
            data-resize-handle
            className="absolute bottom-0 left-0 w-8 h-8 cursor-nesw-resize hover:bg-white/20 transition-colors rounded-bl-2xl z-10 -ml-1 -mb-1"
            style={{ cursor: getResizeCursor('corner-bottom-left') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'corner-bottom-left');
            }}
          />
          <div
            data-resize-handle
            className="absolute bottom-0 right-0 w-8 h-8 cursor-nwse-resize hover:bg-white/20 transition-colors rounded-br-2xl z-10 -mr-1 -mb-1"
            style={{ cursor: getResizeCursor('corner-bottom-right') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'corner-bottom-right');
            }}
          />
          
          {/* Edges - 4px for better targeting */}
          <div
            data-resize-handle
            className="absolute top-0 left-8 right-8 h-4 cursor-ns-resize hover:bg-white/10 transition-colors z-10 -mt-1"
            style={{ cursor: getResizeCursor('top') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'top');
            }}
          />
          <div
            data-resize-handle
            className="absolute bottom-0 left-8 right-8 h-4 cursor-ns-resize hover:bg-white/10 transition-colors z-10 -mb-1"
            style={{ cursor: getResizeCursor('bottom') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'bottom');
            }}
          />
          <div
            data-resize-handle
            className="absolute left-0 top-8 bottom-8 w-4 cursor-ew-resize hover:bg-white/10 transition-colors z-10 -ml-1"
            style={{ cursor: getResizeCursor('left') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'left');
            }}
          />
          <div
            data-resize-handle
            className="absolute right-0 top-8 bottom-8 w-4 cursor-ew-resize hover:bg-white/10 transition-colors z-10 -mr-1"
            style={{ cursor: getResizeCursor('right') }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleResizeStart(e, 'right');
            }}
          />
        </div>
      )}

      {/* Controls - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3">
        {/* Radio Button Style Toggle - Exact match from uiverse.io */}
        <div className="radio-input">
          <div 
            className={`label ${interactionMode === 'chat' ? 'checked' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('CHAT button clicked - calling handleModeChange');
              handleModeChange('chat').catch(err => console.error('Error in handleModeChange:', err));
            }}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <input 
              type="radio" 
              name="interaction-mode" 
              value="chat" 
              checked={interactionMode === 'chat'}
              readOnly
              style={{ display: 'none' }}
              onChange={() => {}}
            />
            <span className="text">CHAT</span>
          </div>
          
          <div 
            className={`label ${interactionMode === 'screen' ? 'checked' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('SCREEN button clicked - calling handleModeChange');
              handleModeChange('screen').catch(err => console.error('Error in handleModeChange:', err));
            }}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <input 
              type="radio" 
              name="interaction-mode" 
              value="screen" 
              checked={interactionMode === 'screen'}
              readOnly
              style={{ display: 'none' }}
              onChange={() => {}}
            />
            <span className="text">SCREEN</span>
          </div>
          
          <div 
            className={`label ${interactionMode === 'live' ? 'checked' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('LIVE button clicked - calling handleModeChange');
              handleModeChange('live').catch(err => console.error('Error in handleModeChange:', err));
            }}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <input 
              type="radio" 
              name="interaction-mode" 
              value="live" 
              checked={interactionMode === 'live'}
              readOnly
              style={{ display: 'none' }}
              onChange={() => {}}
            />
            <span className="text">LIVE</span>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {lastError && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-red-900/90 backdrop-blur-md border border-red-700/50 shadow-xl animate-in fade-in slide-in-from-top-4 max-w-md">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-red-100 text-sm font-medium flex-1">{lastError}</p>
            <button
              onClick={() => {
                setLastError(null);
                if (errorTimeout) {
                  clearTimeout(errorTimeout);
                  setErrorTimeout(null);
                }
              }}
              className="text-red-300 hover:text-red-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </WavyBackground>
  );
};

export default App;
