import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getLiveVoice } from './geminiService';

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class LiveSession {
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private activeSession: any = null;
  private isConnected = false;
  private stream: MediaStream | null = null;

  constructor(
    private onMessage: (text: string) => void,
    private onAudioData: (base64: string) => void
  ) {}

  async connect(externalStream?: MediaStream) {
    if (this.isConnected) {
      console.warn("LiveSession already connected");
      return;
    }

    // Use external stream or create new one
    this.stream = externalStream || await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Input context for sending audio to Gemini (16kHz)
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    
    // Output context for playing Gemini's response (24kHz)
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);
    this.nextStartTime = 0;

    // Connect to Gemini Live
    const sessionPromise = genAI.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: getLiveVoice() } },
        },
        systemInstruction: "You are Atlas, a helpful RAG teammate. Keep answers concise and helpful.",
      },
      callbacks: {
        onopen: () => {
          console.log("Live session connected");
          this.isConnected = true;
          this.startAudioInput(this.stream!, sessionPromise);
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            this.playAudioChunk(base64Audio);
            this.onAudioData(base64Audio);
          }
        },
        onclose: () => {
          console.log("Live session closed");
          this.isConnected = false;
        },
        onerror: (err) => {
          console.error("Live session error", err);
          this.isConnected = false;
        },
      }
    });

    this.activeSession = sessionPromise;
    return sessionPromise;
  }

  private startAudioInput(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.float32ToInt16(inputData);
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
      
      sessionPromise.then(session => {
        if (this.isConnected) {
          session.sendRealtimeInput({
            media: {
              mimeType: "audio/pcm;rate=16000",
              data: base64Data
            }
          });
        }
      }).catch(() => {});
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async playAudioChunk(base64: string) {
    if (!this.outputAudioContext || !this.outputNode || !this.isConnected) return;

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
      
      this.nextStartTime += audioBuffer.duration;
      
      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
    } catch (err) {
      console.error("Error playing audio chunk:", err);
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
      let s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  disconnect() {
    this.isConnected = false;
    
    // Stop all playing audio immediately
    this.sources.forEach(s => {
      try { s.stop(); } catch {}
    });
    this.sources.clear();
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    
    // Close Gemini session
    if (this.activeSession) {
      this.activeSession.then((s: any) => {
        try { s.close?.(); } catch {}
      }).catch(() => {});
      this.activeSession = null;
    }
  }
}
