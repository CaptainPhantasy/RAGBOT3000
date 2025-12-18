import { GoogleGenAI, Modality, Type } from '@google/genai';
import rescueFlowPrompt from '../persona/rescue-flow.md?raw';
import routerPrompt from '../persona/router.md?raw';
// Import persona files
import systemPrompt from '../persona/system.md?raw';
import voiceConfig from '../persona/voice.json';
import { type DocChunk, type MessageImage, Mode, type TaskFrame } from '../types';

// NOTE: In a real app, this should be initialized securely.
// We are using process.env.API_KEY as per instructions.
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Get greeting message from voice config
 */
export const getGreeting = (type: 'initial' | 'liveStart' | 'liveEnd'): string => {
  return voiceConfig.greetings[type];
};

/**
 * Get TTS voice name from config
 */
export const getTTSVoice = (): string => {
  return voiceConfig.ttsVoice;
};

/**
 * Get Live voice name from config
 */
export const getLiveVoice = (): string => {
  return voiceConfig.liveVoice;
};

/**
 * Step 1: Analyze Intent (The Router)
 * Uses a faster model to determine the Mode and construct the Task Frame.
 * Now includes: steps, prerequisites, verifications for task progress tracking.
 * Added: Google Search for grounding if relevant to "recent events" or outside internal scope.
 */
export const analyzeIntent = async (
  userMessage: string,
  history: { role: string; text: string }[],
): Promise<TaskFrame> => {
  // Use gemini-3-flash-preview as requested for fast logic + search
  const model = 'gemini-3-flash-preview';

  const historyText = history
    .slice(-5)
    .map((h) => `${h.role}: ${h.text}`)
    .join('\n');

  const prompt = `
    ${routerPrompt}

    ## Enhanced Task Analysis

    In addition to mode detection, extract:
    - **steps**: If this is a multi-step task, list the action steps (empty array if just a question)
    - **prerequisites**: What must be true before the user can start (role, access, settings)
    - **verifications**: For each step, what the user should see/confirm after completing it
    - **diagnosticQuestions**: If RESCUE mode, list 2-3 specific questions to diagnose the issue
    - **possibleCauses**: If RESCUE mode, list potential root causes to investigate

    History:
    ${historyText}

    User Input: "${userMessage}"
  `;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        tools: [{ googleSearch: {} }], // Grounding for updated context if needed
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING },
            goal: { type: Type.STRING },
            constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
            mode: { type: Type.STRING, enum: ['Teach', 'Guide', 'Rescue'] },
            missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
            // Task Progress Tracking
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
            verifications: { type: Type.ARRAY, items: { type: Type.STRING } },
            // RESCUE mode diagnostics
            diagnosticQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            possibleCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['intent', 'goal', 'constraints', 'mode'],
        },
      },
    });

    const jsonText = response.text || '{}';
    const parsed = JSON.parse(jsonText) as TaskFrame;

    // Initialize currentStep to 0 if steps exist
    if (parsed.steps && parsed.steps.length > 0) {
      parsed.currentStep = 0;
    }

    return parsed;
  } catch (error) {
    console.error('Error analyzing intent:', error);
    // Fallback default
    return {
      intent: 'General Inquiry',
      goal: 'Answer user question',
      constraints: [],
      mode: Mode.TEACH,
    };
  }
};

/**
 * Get mode-specific behavior instruction
 */
const getModeInstruction = (mode: Mode, taskFrame: TaskFrame): string => {
  switch (mode) {
    case Mode.TEACH:
      return 'Mode: TEACH. Explain concepts clearly. Use examples. Check for understanding. Always cite sources with [FROM KB: title].';
    case Mode.GUIDE:
      return `Mode: GUIDE. Provide short, actionable steps. Use 'Plan -> Steps -> Verify' structure. Be concise.
      
Task Progress:
- Steps to complete: ${taskFrame.steps?.join(' → ') || 'Determine from context'}
- Current step: ${taskFrame.currentStep !== undefined ? taskFrame.currentStep + 1 : 1}
- Prerequisites: ${taskFrame.prerequisites?.join(', ') || 'None identified'}
- After each step, include verification: "✓ You should see: [expected result]"`;
    case Mode.RESCUE:
      return `Mode: RESCUE. Follow the diagnostic flow below.

${rescueFlowPrompt}

Diagnostic Questions to Ask: ${taskFrame.diagnosticQuestions?.join(', ') || 'Determine based on issue'}
Possible Causes to Investigate: ${taskFrame.possibleCauses?.join(', ') || 'Determine from KB'}`;
    default:
      return '';
  }
};

/**
 * Build grounding context with source markers
 */
const buildGroundedDocsContext = (retrievedDocs: DocChunk[]): { context: string; hasKBSupport: boolean } => {
  if (retrievedDocs.length === 0) {
    return {
      context: '[NOT IN KB] No relevant documentation found for this query.',
      hasKBSupport: false,
    };
  }

  const context = retrievedDocs
    .map((d) => `[FROM KB: ${d.title}]\nProduct Area: ${d.productArea}\nTags: ${d.tags.join(', ')}\n\n${d.content}`)
    .join('\n\n---\n\n');

  return { context, hasKBSupport: true };
};

/**
 * Centralized System Prompt Generator
 * Unifies persona, behavior, grounding, and capabilities across all modes (Chat, Live, Screen)
 */
export const buildUnifiedSystemPrompt = (
  taskFrame: TaskFrame,
  retrievedDocs: DocChunk[],
  includeVision: boolean = false,
): string => {
  const { hasKBSupport } = buildGroundedDocsContext(retrievedDocs);
  const behaviorInstruction = getModeInstruction(taskFrame.mode, taskFrame);

  // Build task progress section
  const taskProgressSection =
    taskFrame.steps && taskFrame.steps.length > 0
      ? `
## Current Task Progress
- Total Steps: ${taskFrame.steps.length}
- Current Step: ${(taskFrame.currentStep || 0) + 1} of ${taskFrame.steps.length}
- Steps: 
${taskFrame.steps.map((s, i) => `  ${i + 1}. ${s}${taskFrame.verifications?.[i] ? ` → Verify: "${taskFrame.verifications[i]}"` : ''}`).join('\n')}
- Prerequisites: ${taskFrame.prerequisites?.join(', ') || 'None'}
`
      : '';

  // Grounding enforcement
  const groundingRules = hasKBSupport
    ? `
## Grounding Rules (ENFORCE)
- You have KB support for this query
- ALWAYS cite sources: [FROM KB: Document Title]
- If information comes from logical deduction, mark as [INFERRED]
- Do NOT add information not present in the retrieved docs
`
    : `
## Grounding Rules (ENFORCE)
- [NOT IN KB] No direct documentation found
- Be transparent: "I don't have specific information about this in my knowledge base"
- Suggest: official documentation, support channels, or general troubleshooting
- Do NOT guess or fabricate features/procedures
`;

  const visionCapabilities = includeVision
    ? `
## VISION CAPABILITIES
When the user shares their screen or camera, actively look for UI elements, errors, code, or real-world objects.
Use precise spatial language to "point out" items.
Example: "I see the error in the top-right corner..." or "That object you're holding looks like..."
`
    : '';

  return `
${systemPrompt}

${behaviorInstruction}

${groundingRules}

${taskProgressSection}

${visionCapabilities}

Current Task Frame:
Intent: ${taskFrame.intent}
Goal: ${taskFrame.goal}
Constraints: ${taskFrame.constraints.join(', ') || 'None'}
Missing Info: ${taskFrame.missingInfo?.join(', ') || 'None'}
`.trim();
};

/**
 * Get unified system prompt for Live Sessions
 */
export const getUnifiedLivePrompt = (taskFrame?: TaskFrame, retrievedDocs: DocChunk[] = []): string => {
  const frame = taskFrame || {
    intent: 'General Live Interaction',
    goal: 'Assist the user in real-time',
    constraints: [],
    mode: Mode.GUIDE,
  };
  // Default to no vision unless explicitly enabled by the caller (SCREEN/LIVE)
  return buildUnifiedSystemPrompt(frame, retrievedDocs, false);
};

/**
 * Step 2: Generate Response (The Teammate)
 * Uses the thinking model to synthesize retrieved docs into guidance.
 * Enhanced with: task progress tracking, grounding signals, RESCUE flow
 * Updated: Support for Image Analysis
 */
export const generateTeammateResponse = async (
  userMessage: string,
  taskFrame: TaskFrame,
  retrievedDocs: DocChunk[],
  history: { role: string; text: string }[],
  image?: MessageImage,
): Promise<string> => {
  const model = 'gemini-3-pro-preview'; // As requested for complex tasks

  const { context: docsContext } = buildGroundedDocsContext(retrievedDocs);
  const fullSystemPrompt = buildUnifiedSystemPrompt(taskFrame, retrievedDocs, !!image);

  const userPrompt = `
    Retrieved Documentation:
    ${docsContext}

    Conversation History:
    ${history
      .slice(-3)
      .map((h) => `${h.role}: ${h.text}`)
      .join('\n')}

    User Input:
    ${userMessage}

    REMEMBER: 
    - Use [FROM KB: title] when citing documentation
    - Use [INFERRED] for logical deductions
    - Use [NOT IN KB] when information is unavailable
    - Include verification checkpoints: "✓ You should see: [expected]"
  `;

  // Construct parts: [Image if present] + System prompt + User Prompt
  type GeminiPart =
    | { text: string }
    | {
        inlineData: {
          mimeType: string;
          data: string;
        };
      };

  const parts: GeminiPart[] = [{ text: fullSystemPrompt + '\n\n' + userPrompt }];

  if (image) {
    parts.unshift({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ role: 'user', parts: parts }],
      config: {
        // High thinking budget for complex reasoning as requested
        thinkingConfig: { thinkingBudget: 32768 },
        // Do not set maxOutputTokens when using thinking budget as per instructions
      },
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error('Error generating response:', error);
    return 'I encountered an error while processing your request. Please try again.';
  }
};

/**
 * Generate Speech (TTS)
 * Uses gemini-2.5-flash-preview-tts with voice from persona config.
 */
export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const model = 'gemini-2.5-flash-preview-tts';
  const voice = getTTSVoice();

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    // Return base64 audio data
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error('Error generating speech:', error);
    return undefined;
  }
};

/**
 * Memory Patch Schema for session state tracking
 */
export interface MemoryPatchResult {
  should_write: boolean;
  topic: string;
  status: 'active' | 'paused' | 'completed';
  goal?: string;
  last_completed_step?: string;
  current_step?: string;
  next_actions?: string[];
  blockers?: string[];
  key_decisions?: string[];
  environment?: string[];
  verification?: string;
}

/**
 * Generate a memory patch after each assistant response
 * Uses fast model to extract session state for checkpointing
 */
export const generateMemoryPatch = async (
  userMessage: string,
  assistantResponse: string,
  taskFrame: TaskFrame,
  history: { role: string; text: string }[],
): Promise<MemoryPatchResult> => {
  const model = 'gemini-2.0-flash';

  const prompt = `
Analyze this conversation turn and extract session state for memory checkpoint.

## Task Frame
- Intent: ${taskFrame.intent}
- Goal: ${taskFrame.goal}
- Mode: ${taskFrame.mode}
- Steps: ${taskFrame.steps?.join(' → ') || 'Not defined'}

## Recent History
${history
  .slice(-3)
  .map((h) => `${h.role}: ${h.text.substring(0, 200)}...`)
  .join('\n')}

## Latest Turn
User: ${userMessage}
Assistant: ${assistantResponse.substring(0, 500)}...

## Instructions
Determine if this conversation has meaningful state worth saving:
- should_write: true if there's a task in progress, false for simple Q&A
- status: "active" (in progress), "paused" (user said stop/later), "completed" (task done)
- Extract the current progress state

Return JSON only.
  `;

  try {
    const response = await genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            should_write: { type: Type.BOOLEAN },
            topic: { type: Type.STRING },
            status: { type: Type.STRING, enum: ['active', 'paused', 'completed'] },
            goal: { type: Type.STRING },
            last_completed_step: { type: Type.STRING },
            current_step: { type: Type.STRING },
            next_actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            blockers: { type: Type.ARRAY, items: { type: Type.STRING } },
            key_decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
            environment: { type: Type.ARRAY, items: { type: Type.STRING } },
            verification: { type: Type.STRING },
          },
          required: ['should_write', 'topic', 'status'],
        },
      },
    });

    const jsonText = response.text || '{}';
    return JSON.parse(jsonText) as MemoryPatchResult;
  } catch (error) {
    console.error('Error generating memory patch:', error);
    return {
      should_write: false,
      topic: taskFrame.goal || 'Unknown',
      status: 'active',
    };
  }
};

/**
 * Check if user message indicates pause/resume intent
 */
export const detectSessionIntent = (message: string): 'resume' | 'pause' | 'clear' | 'none' => {
  const lower = message.toLowerCase();

  // Resume patterns
  if (
    lower.includes('where were we') ||
    lower.includes('continue') ||
    lower.includes('pick up') ||
    lower.includes('resume') ||
    lower.includes('what was i doing') ||
    lower.includes('last time')
  ) {
    return 'resume';
  }

  // Pause patterns
  if (
    lower.includes('stop') ||
    lower.includes('later') ||
    lower.includes('tomorrow') ||
    lower.includes('come back') ||
    lower.includes('pause') ||
    lower.includes('save progress') ||
    lower.includes('gotta go')
  ) {
    return 'pause';
  }

  // Clear patterns
  if (
    lower.includes('forget') ||
    lower.includes('clear memory') ||
    lower.includes('start fresh') ||
    lower.includes('new topic') ||
    lower.includes('never mind')
  ) {
    return 'clear';
  }

  return 'none';
};
