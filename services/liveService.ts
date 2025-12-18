import { GoogleGenAI, type LiveServerMessage, Modality } from '@google/genai';
import { Mode } from '../types';
import { generateMemoryPatch, getLiveVoice } from './geminiService';
import { memoryManager } from './memoryService';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

type RealtimeInput = {
  media: {
    mimeType: string;
    data: string;
  };
};

type GeminiLiveSession = {
  sendRealtimeInput: (input: RealtimeInput) => void;
  close?: () => void;
  interrupt?: () => void;
};

// State machine for session lifecycle
type SessionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnecting';

// Typed error system
export type LiveSessionError =
  | { type: 'permission_denied'; device: 'microphone' | 'camera' | 'screen' }
  | { type: 'network_error'; retrying: boolean; attempt: number; message?: string }
  | { type: 'api_error'; message: string }
  | { type: 'audio_context_error'; message: string };

export class LiveSession {
  // State management
  private state: SessionState = 'idle';

  // Audio contexts and nodes
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private suppressOutputUntilMs = 0;
  private lastOutputAtMs = 0;

  // Session management
  private activeSession: Promise<GeminiLiveSession> | null = null;
  private stream: MediaStream | null = null;
  private abortController: AbortController | null = null;

  // Reconnection management
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start at 1s, max 30s
  private isIntentionalDisconnect = false;
  private reconnectTimeout: number | null = null;

  // Memory and video
  private currentSessionId: string | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private videoInterval: number | null = null;
  private videoStream: MediaStream | null = null;
  private transcriptBuffer: string[] = [];

  constructor(
    private onMessage: (text: string) => void,
    private onAudioData: (base64: string) => void,
    private onError?: (error: LiveSessionError) => void,
    private onStatusChange?: (status: SessionState) => void,
  ) {}

  /**
   * Get current connection state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Check if session is currently connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Whether the agent currently has audio playing/queued locally.
   * Used for barge-in interruption.
   */
  isSpeaking(): boolean {
    return this.sources.size > 0;
  }

  /**
   * Consider the agent "speaking" for a short grace window after the most recent
   * output chunk. This avoids missing barge-in during gaps between audio chunks.
   */
  isSpeakingOrRecently(graceMs: number = 1200): boolean {
    if (this.isSpeaking()) return true;
    return Date.now() - this.lastOutputAtMs < graceMs;
  }

  /**
   * Interrupt agent speech (barge-in): stop local playback immediately and
   * optionally suppress new audio chunks for a short window.
   *
   * This mirrors the "interruptions" behavior described in turn-taking systems.
   * See: https://docs.livekit.io/agents/logic-structure/turns/
   */
  interrupt(options?: { suppressMs?: number }) {
    const suppressMs = options?.suppressMs ?? 1200;
    this.suppressOutputUntilMs = Date.now() + suppressMs;

    // Stop all currently scheduled/playing audio immediately.
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.sources.clear();

    // Reset scheduling so we don't "resume" old queued audio.
    this.nextStartTime = 0;

    // Best-effort: if the underlying session supports an interrupt API, call it.
    // (Kept as optional to avoid coupling to a specific SDK shape.)
    this.activeSession
      ?.then((session) => {
        try {
          session.interrupt?.();
        } catch {}
      })
      .catch(() => {});
  }

  /**
   * Connect to Gemini Live API with robustness features
   */
  async connect(externalStream?: MediaStream, systemInstruction?: string) {
    // State machine guard
    if (this.state !== 'idle' && this.state !== 'reconnecting') {
      console.warn(`Cannot connect: state is ${this.state}`);
      return;
    }

    // Abort any pending operations
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Update state
    const wasReconnecting = this.state === 'reconnecting';
    this.state = wasReconnecting ? 'reconnecting' : 'connecting';
    this.onStatusChange?.(this.state);

    // Load active memory context
    const activeMemory = memoryManager.loadActiveSession('default_user');
    this.currentSessionId = activeMemory?.session_id || null;
    const memoryContext = activeMemory ? memoryManager.formatForContext(activeMemory) : 'No previous session data.';

    try {
      // Check abort before async operations
      if (signal.aborted) return;

      // Use external stream or create new one
      this.stream = externalStream || (await navigator.mediaDevices.getUserMedia({ audio: true }));

      if (signal.aborted) {
        this.stream.getTracks().forEach((t) => {
          t.stop();
        });
        return;
      }

      // Input context for sending audio to Gemini (16kHz)
      const WebkitAudioContext = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const AudioContextCtor = window.AudioContext ?? WebkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error('AudioContext is not available in this browser.');
      }
      this.inputAudioContext = new AudioContextCtor({ sampleRate: 16000 });

      // Output context for playing Gemini's response (24kHz)
      this.outputAudioContext = new AudioContextCtor({ sampleRate: 24000 });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);
      this.nextStartTime = 0;

      if (signal.aborted) return;

      // Final fallback for system instruction if not provided
      const finalInstruction =
        systemInstruction ||
        `You are Legacy, a helpful RAG teammate.

## Session Memory (Grounding)
${memoryContext}

Keep answers concise and helpful.`;

      // Connect to Gemini Live
      const sessionPromise = genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: getLiveVoice() } },
          },
          systemInstruction: finalInstruction,
        },
        callbacks: {
          onopen: () => {
            if (signal.aborted) return;

            console.log('Live session connected');
            this.state = 'connected';
            this.reconnectAttempts = 0; // Reset on successful connection
            this.onStatusChange?.(this.state);

            // Initialize audio input (with fallback)
            const stream = this.stream;
            if (!stream) return;
            this.initAudioInput(stream, sessionPromise as Promise<GeminiLiveSession>).catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.error('Audio input initialization failed:', err);
              this.onError?.({ type: 'audio_context_error', message: msg });
            });
          },
          onmessage: async (message: LiveServerMessage) => {
            if (signal.aborted || this.state !== 'connected') return;

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              // If we've recently interrupted, drop output chunks for a short window.
              if (Date.now() < this.suppressOutputUntilMs) return;
              this.playAudioChunk(base64Audio);
              this.onAudioData(base64Audio);
            }

            // Handle Text/Transcript Output (if available)
            const modelText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (modelText) {
              this.onMessage(modelText);
              this.handleMemoryCheckpoint(modelText);
            }
          },
          onclose: () => {
            console.log('Live session closed');

            // Only attempt reconnect if not intentional and not already disconnecting/idle
            if (
              !this.isIntentionalDisconnect &&
              this.state !== 'disconnecting' &&
              this.state !== 'idle' &&
              this.state === 'connected'
            ) {
              this.attemptReconnect();
            } else {
              // Intentional disconnect or already disconnecting - just update state
              if (this.state !== 'idle') {
                this.state = 'idle';
                this.onStatusChange?.(this.state);
              }
            }
          },
          onerror: (err) => {
            console.error('Live session error', err);

            // Don't show errors or reconnect if this is an intentional disconnect
            if (this.isIntentionalDisconnect || this.state === 'disconnecting') {
              this.state = 'idle';
              this.onStatusChange?.(this.state);
              return;
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            this.onError?.({
              type: 'api_error',
              message: errorMessage,
            });

            // Attempt reconnect on error if not intentional and still connected
            if (this.state === 'connected') {
              this.attemptReconnect();
            } else {
              this.state = 'idle';
              this.onStatusChange?.(this.state);
            }
          },
        },
      });

      this.activeSession = sessionPromise as Promise<GeminiLiveSession>;
      return sessionPromise as Promise<GeminiLiveSession>;
    } catch (err: unknown) {
      // Handle permission errors
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.onError?.({ type: 'permission_denied', device: 'microphone' });
      } else {
        this.onError?.({
          type: 'api_error',
          message: err instanceof Error ? err.message : 'Connection failed',
        });
      }

      this.state = 'idle';
      this.onStatusChange?.(this.state);
      throw err;
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private async attemptReconnect() {
    // Don't reconnect if intentionally disconnected or already disconnecting
    if (this.isIntentionalDisconnect || this.state === 'disconnecting' || this.state === 'idle') {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onError?.({
        type: 'network_error',
        retrying: false,
        attempt: this.reconnectAttempts,
        message: 'Connection lost. Please try again.',
      });
      this.state = 'idle';
      this.onStatusChange?.(this.state);
      return;
    }

    this.state = 'reconnecting';
    this.onStatusChange?.(this.state);

    const delay = Math.min(
      this.reconnectDelay * 2 ** this.reconnectAttempts,
      30000, // Max 30 seconds
    );
    this.reconnectAttempts++;

    this.onError?.({
      type: 'network_error',
      retrying: true,
      attempt: this.reconnectAttempts,
      message: `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
    });

    this.reconnectTimeout = window.setTimeout(async () => {
      // Double-check before attempting reconnect (user might have disconnected)
      if (this.isIntentionalDisconnect || this.state === 'disconnecting' || this.state === 'idle') {
        return;
      }

      try {
        await this.connect(this.stream || undefined);
      } catch (err) {
        // Will trigger another reconnect attempt via onerror handler (if not intentional)
        if (!this.isIntentionalDisconnect) {
          console.error('Reconnection attempt failed:', err);
        }
      }
    }, delay);
  }

  /**
   * Initialize audio input with AudioWorklet (modern) or fallback to ScriptProcessor
   */
  private async initAudioInput(stream: MediaStream, sessionPromise: Promise<GeminiLiveSession>) {
    if (!this.inputAudioContext) return;

    // Try AudioWorklet first (modern approach)
    if (this.inputAudioContext.audioWorklet) {
      try {
        await this.startAudioInputModern(stream, sessionPromise);
        return;
      } catch (err) {
        console.warn('AudioWorklet failed, falling back to ScriptProcessor:', err);
        // Fall through to legacy method
      }
    }

    // Fallback to ScriptProcessor (legacy, deprecated but widely supported)
    this.startAudioInputLegacy(stream, sessionPromise);
  }

  /**
   * Modern AudioWorklet-based audio input processing
   */
  private async startAudioInputModern(stream: MediaStream, sessionPromise: Promise<GeminiLiveSession>) {
    const inputCtx = this.inputAudioContext;
    if (!inputCtx) return;

    // Load the worklet module
    await inputCtx.audioWorklet.addModule('/audio/pcm-processor.worklet.js');

    // Create source and worklet node
    this.inputSource = inputCtx.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(inputCtx, 'pcm-processor');

    // Handle messages from worklet
    this.workletNode.port.onmessage = (e) => {
      if (this.state !== 'connected' || this.abortController?.signal.aborted) return;

      const pcmData = e.data.pcmData as Int16Array;
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

      sessionPromise
        .then((session) => {
          if (this.state === 'connected' && session) {
            try {
              session.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Data,
                },
              });
            } catch (err) {
              // Silently handle send errors (connection may be closing)
              if (this.state === 'connected') {
                console.warn('Failed to send audio chunk:', err);
              }
            }
          }
        })
        .catch(() => {});
    };

    // Connect the audio graph
    this.inputSource.connect(this.workletNode);
  }

  /**
   * Legacy ScriptProcessor-based audio input processing (fallback)
   */
  private startAudioInputLegacy(stream: MediaStream, sessionPromise: Promise<GeminiLiveSession>) {
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.state !== 'connected' || this.abortController?.signal.aborted) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.float32ToInt16(inputData);
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

      sessionPromise
        .then((session) => {
          if (this.state === 'connected' && session) {
            try {
              session.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: base64Data,
                },
              });
            } catch (err) {
              // Silently handle send errors (connection may be closing)
              if (this.state === 'connected') {
                console.warn('Failed to send audio chunk:', err);
              }
            }
          }
        })
        .catch(() => {});
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async playAudioChunk(base64: string) {
    if (!this.outputAudioContext || !this.outputNode || this.state !== 'connected') return;
    if (Date.now() < this.suppressOutputUntilMs) return;

    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.decodePCM(bytes, this.outputAudioContext);

      // Ensure proper timing - don't let chunks overlap
      const currentTime = this.outputAudioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      source.start(this.nextStartTime);

      // Track output activity for barge-in gating (covers chunk gaps).
      this.lastOutputAtMs = Date.now();

      this.nextStartTime += audioBuffer.duration;

      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  private async decodePCM(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const int16Data = new Int16Array(data.buffer);
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    return buffer;
  }

  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  }

  /**
   * Periodically checkpoints the conversation to long-term memory
   */
  private async handleMemoryCheckpoint(modelText: string) {
    this.transcriptBuffer.push(`Assistant: ${modelText}`);

    // Only checkpoint if we have a significant turn
    if (this.transcriptBuffer.length >= 2) {
      const history = this.transcriptBuffer.map((t) => ({ role: t.startsWith('User') ? 'user' : 'model', text: t }));

      try {
        const patch = await generateMemoryPatch(
          'Current Live Session',
          modelText,
          { intent: 'Live Interaction', goal: 'Collaborative Assistance', constraints: [], mode: Mode.GUIDE },
          history,
        );

        if (patch.should_write) {
          const session = memoryManager.upsertSession('default_user', patch, this.currentSessionId || undefined);
          if (session) this.currentSessionId = session.session_id;
          console.log('[Memory] Live session checkpointed:', patch.topic);
        }
      } catch (err) {
        console.error('[Memory] Checkpoint failed:', err);
      }

      // Keep only the most recent context in buffer to avoid re-processing old turns
      this.transcriptBuffer = this.transcriptBuffer.slice(-2);
    }
  }

  // --- Video Streaming ---
  public startVideoStream(stream: MediaStream) {
    if (this.state !== 'connected' || !this.activeSession) return;
    this.videoStream = stream;

    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = stream;
    this.videoElement.autoplay = true;
    this.videoElement.play();
    this.videoElement.muted = true; // prevent feedback loop if audio is included

    this.canvasElement = document.createElement('canvas');
    const ctx = this.canvasElement.getContext('2d');
    if (!ctx) return;

    // Send a frame every 500ms (2 FPS)
    this.videoInterval = window.setInterval(async () => {
      if (!this.videoElement || !this.canvasElement || !ctx || this.state !== 'connected') return;

      if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
        this.canvasElement.width = this.videoElement.videoWidth;
        this.canvasElement.height = this.videoElement.videoHeight;
        ctx.drawImage(this.videoElement, 0, 0);

        const base64Data = this.canvasElement.toDataURL('image/jpeg', 0.7).split(',')[1];

        this.activeSession
          .then((session) => {
            if (this.state === 'connected' && session) {
              try {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'image/jpeg',
                    data: base64Data,
                  },
                });
              } catch (err) {
                // Silently handle send errors
                if (this.state === 'connected') {
                  console.warn('Failed to send video frame:', err);
                }
              }
            }
          })
          .catch(() => {});
      }
    }, 500);
  }

  public stopVideoStream() {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.videoStream = null;
    }
    this.videoElement = null;
    this.canvasElement = null;
  }

  /**
   * Disconnect from session with proper cleanup
   */
  disconnect() {
    // Mark as intentional FIRST to prevent any reconnection attempts
    this.isIntentionalDisconnect = true;

    // Cancel any pending reconnection immediately
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Reset reconnect attempts to prevent any messages
    this.reconnectAttempts = 0;

    // Abort any pending operations
    this.abortController?.abort();

    // Update state
    if (this.state !== 'idle' && this.state !== 'disconnecting') {
      this.state = 'disconnecting';
      this.onStatusChange?.(this.state);
    }

    // Stop video stream if active
    this.stopVideoStream();

    // Stop all playing audio immediately
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.sources.clear();

    // Clean up audio processing nodes
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }

    // Close audio contexts
    if (this.inputAudioContext) {
      this.inputAudioContext.close().catch(() => {});
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close().catch(() => {});
      this.outputAudioContext = null;
    }

    // Close Gemini session
    if (this.activeSession) {
      this.activeSession
        .then((s) => {
          try {
            s.close?.();
          } catch {}
        })
        .catch(() => {});
      this.activeSession = null;
    }

    // Reset state
    this.state = 'idle';
    this.isIntentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.onStatusChange?.(this.state);
  }
}
