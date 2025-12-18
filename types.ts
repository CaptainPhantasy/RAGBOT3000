export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export enum Mode {
  TEACH = 'Teach', // Explain concepts
  GUIDE = 'Guide', // Step-by-step
  RESCUE = 'Rescue' // Troubleshooting
}

export interface TaskFrame {
  intent: string;
  goal: string;
  constraints: string[];
  mode: Mode;
  missingInfo?: string[];
  // Task Progress Tracking
  steps?: string[];           // Extracted action steps
  currentStep?: number;       // Where user is in the flow (0-indexed)
  prerequisites?: string[];   // What must be true before starting
  verifications?: string[];   // "What you should see" for each step
  // Diagnostic tracking (RESCUE mode)
  diagnosticQuestions?: string[];  // Questions to ask user for troubleshooting
  possibleCauses?: string[];       // Potential root causes from KB
}

export interface DocChunk {
  id: string;
  title: string;
  content: string;
  tags: string[];
  productArea: string;
}

export interface Feedback {
  rating: 'up' | 'down';
  text?: string;
  timestamp: number;
}

export interface MessageImage {
  data: string; // base64
  mimeType: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  taskFrame?: TaskFrame;
  citations?: DocChunk[];
  timestamp: number;
  audioBase64?: string; // For TTS
  feedback?: Feedback;
  image?: MessageImage; // User uploaded image
}

export interface RetrievalResult {
  chunk: DocChunk;
  score: number;
}