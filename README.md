# RAGBOT3000

**By Legacy AI**

RAGBOT3000 is a white-labeled, retrieval-augmented "teammate" chatbot designed to **teach, guide, and troubleshoot** across *any platform* by grounding its help in a **swappable RAG knowledgebase** while keeping its **persona (name/voice/behavior)** separate and reusable.

It is built to feel less like a Q&A bot and more like a **hands-on operator + patient instructor** who helps a human move from "I want to do X" to "X is done," with minimal friction.

---

## Purpose

RAGBOT3000 exists to solve the real problem of learning and using unfamiliar tools:

- People don't just need explanations — they need **step-by-step execution**
- Documentation is often correct but hard to apply — users need it turned into **actionable guidance**
- Work gets interrupted — the bot must **resume progress** confidently and quickly
- Platforms differ by plan, role, version, and UI — the bot must **diagnose friction** and adapt without guessing

---

## Features

### 🎤 Real-Time Voice Interface
- **Live audio streaming** with Google Gemini's native audio API
- **Chirp 3 HD voices** for natural, emotionally resonant speech
- **Voice-reactive visualization** with real-time waveform analysis
- **Modern audio processing** using AudioWorklet (with ScriptProcessor fallback)

### 👁️ Vision Capabilities
- **Screen sharing** for digital task assistance
- **Camera feed** for real-world object collaboration
- **Live preview** (confidence monitor) showing what the agent sees
- **2 FPS video streaming** optimized for real-time analysis

### 🧠 Persistent Memory System
- **Session memory** with 72-hour TTL expiration
- **Progress checkpointing** across all interaction modes
- **Resume capability** - pick up where you left off
- **Unified memory** shared between chat and live voice sessions

### 🛡️ Production-Ready Robustness
- **Auto-reconnection** with exponential backoff (up to 5 attempts)
- **State machine** architecture preventing race conditions
- **Typed error handling** with user-friendly messages
- **Graceful degradation** for older browsers
- **Resource cleanup** with AbortController pattern
- **Connection status indicators** and error toasts

---

## Goals

### 1) Teach and guide through any process

RAGBOT3000 should:
- Translate documentation into **clear, ordered steps**
- Explain the "why" when helpful, without overwhelming the user
- Provide **checkpoints** ("what you should see") so users can verify progress
- Offer "fast path" vs "safe path" depending on user preference

### 2) Be a reliable, grounded teammate (not a hallucination machine)

RAGBOT3000 should:
- Treat retrieved documentation as the **source of truth**
- Avoid inventing UI labels, product limits, API fields, or workflows
- Clearly signal when the knowledgebase lacks coverage and what's needed to proceed

### 3) Handle friction like a pro

When users get stuck, RAGBOT3000 should:
- Switch into **Rescue Mode**
- Ask for the **minimum** diagnostics (error text, step number, what they expected)
- Retrieve again using those friction signals
- Provide a short decision tree with 1–2 actions per branch

### 4) Be white-labeled and modular

RAGBOT3000 is built around strict separation of concerns:
- **Persona & behavior prompts** are reusable and brandable
- **Knowledgebase packs** are swappable "expertise repos" (platform-specific docs)
- You can assign a new expertise pack without changing the bot's identity

### 5) Resume interrupted work with local memory (and forget on schedule)

RAGBOT3000 maintains a lightweight local memory that captures:
- Current goal
- Last completed step
- Current step / next actions
- Key decisions and blockers

Memory expires automatically:
- **Wipe/expire after 72 hours** (TTL-based cleanup)

---

## High-Level Architecture

### Runtime Loop (conceptual)

1. **Intake** user message and infer intent (Teach / Guide / Rescue)
2. **Frame** the task (goal, success criteria, constraints)
3. **Retrieve** relevant evidence from the selected knowledgebase pack
4. **Distill** evidence into a tight context brief (steps, prereqs, warnings, verification)
5. **Respond** using persona + behavior + retrieved context
6. **Log** progress to local memory for resumability (with 72h expiration)

### Connection State Machine

The live session uses a robust state machine:
- `idle` → `connecting` → `connected` → `disconnecting` → `idle`
- `connected` → `reconnecting` (on network error) → `connected` (after retry)
- Prevents race conditions and ensures clean state transitions

### Error Recovery

- **Network errors**: Automatic reconnection with exponential backoff (1s → 30s max)
- **Permission errors**: Clear user guidance with device-specific messages
- **API errors**: Graceful degradation with informative error toasts
- **Audio errors**: Fallback from AudioWorklet to ScriptProcessor for compatibility

---

## Repository Structure

```
ragbot3000/
├── persona/                    # INTERNAL PROMPTS ONLY (no platform knowledge)
│   ├── system.md              # Core system prompt
│   ├── router.md              # Intent analysis prompt
│   ├── rescue-flow.md         # Troubleshooting behavior
│   ├── memory.md              # Memory behavior guidelines
│   └── voice.json             # Voice config (name, tone, greetings)
│
├── knowledge/                  # SWAPPABLE expertise packs (RAG KB)
│   ├── index.json             # Document manifest
│   └── docs/                   # Platform-specific documentation
│       ├── getting-started.md
│       ├── api-keys.md
│       └── ...
│
├── components/                 # UI components
│   ├── WavyBackground.tsx     # Voice-reactive visualization
│   ├── EvidenceWidget.tsx     # Evidence display
│   ├── TaskFrameWidget.tsx    # Task progress display
│   └── ...
│
├── services/                   # Core services
│   ├── geminiService.ts       # LLM orchestration (router + responder + memory patches)
│   ├── liveService.ts         # Real-time voice session (with robustness features)
│   └── memoryService.ts       # Local memory manager (TTL, checkpoints, resume)
│
├── audio/                      # Audio processing
│   └── pcm-processor.worklet.ts  # Modern AudioWorklet processor
│
├── public/                     # Static assets
│   └── audio/
│       └── pcm-processor.worklet.js  # Compiled worklet for browser
│
├── lib/                        # Utilities
├── App.tsx                     # Main application
└── knowledgeBase.ts           # RAG retrieval logic
```

---

## Key Design Rules

### Persona vs Knowledge

| Persona Files | Knowledge Files |
|---------------|-----------------|
| Define name, tone, voice, teaching style, behaviors | Contain documentation and indexing configs |
| Located in `/persona/` | Located in `/knowledge/` |
| Reusable across platforms | Swappable per platform |

**Rule:** The bot must never "hide knowledge" in the persona prompt; knowledge comes from retrieval.

### Grounded Guidance Format

Default response structure:

1. **Goal confirmation** + assumptions
2. **Plan** (A → B → C)
3. **Steps** with verification ("You should see…")
4. **If stuck:** short troubleshooting branches
5. **Next options** ("continue" vs "explain")

### Confidence Signals

Responses include source markers:
- `[FROM KB: Document Title]` — Direct from retrieved docs
- `[INFERRED]` — Logical deduction from KB patterns
- `[NOT IN KB]` — Information not available

### Local Memory Scope

Memory stores **state**, not facts:

✅ "We're on step 3, mapping CSV columns"  
✅ "Error: 403 missing permission"  
❌ "Full platform documentation pasted into memory"

Memory expires after 72 hours to stay privacy-conscious and avoid stale context.

---

## Voice Interface

RAGBOT3000 features a real-time voice interface powered by:

| Component | Technology |
|-----------|------------|
| Platform | Google Gemini |
| Model | `gemini-2.5-flash-native-audio-preview-09-2025` |
| Voice | Chirp 3 HD (configurable via `persona/voice.json`) |
| Audio Input | AudioWorklet (modern) / ScriptProcessor (fallback) |
| Visualization | Voice-reactive waveforms (Bass/Mid/Treble) |

### Vision Capabilities

- **Screen Sharing**: Share your screen for digital task assistance
- **Camera Feed**: Share real-world objects via camera
- **Live Preview**: See exactly what the agent is viewing
- **Spatial Awareness**: Agent uses precise spatial language ("top-right corner", "that object you're holding")

---

## Robustness Features

### Network Resilience
- **Auto-reconnect**: Exponential backoff (1s → 30s max, 5 attempts)
- **State management**: Prevents multiple simultaneous connections
- **Intentional disconnect tracking**: Won't reconnect on user-initiated stops

### Error Handling
- **Typed errors**: Categorized by type (permission, network, API, audio)
- **User-friendly messages**: Clear guidance for each error type
- **Status indicators**: Visual feedback for connection state
- **Error toasts**: Auto-dismissing notifications with manual close option

### Audio Processing
- **Modern API**: AudioWorklet replaces deprecated ScriptProcessorNode
- **Browser compatibility**: Automatic fallback for older browsers
- **No deprecation warnings**: Clean console output

### Resource Management
- **AbortController**: Clean cancellation of async operations
- **Proper cleanup**: All streams, contexts, and sessions cleaned up on disconnect
- **Memory leak prevention**: Comprehensive resource tracking

---

## Intended Outcome

RAGBOT3000 becomes an **invaluable asset** as a learning partner:

- It helps users **learn faster**
- It helps users **do the work correctly**
- It helps users **recover quickly** from confusion or errors
- It stays **grounded in the documentation** you provide, with a clean, swappable expertise model
- It provides **visual assistance** through screen and camera sharing
- It **remembers context** across sessions and interaction modes

---

## Non-Goals

| What RAGBOT3000 Does NOT Do |
|-----------------------------|
| Replace official documentation (it operationalizes it) |
| Store long-term personal data (memory is short-lived and task-focused) |
| Guess answers when the knowledgebase is missing coverage |

---

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API key:**
   Create a `.env` file in the project root:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open:** http://localhost:3000

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## Usage

### Starting a Live Session

1. Click the microphone button to start listening
2. Grant microphone permissions when prompted
3. Speak naturally - the agent will respond with voice
4. Use screen share or camera buttons to share visual context

### Sharing Visual Context

- **Screen Share**: Click the screen icon to share your screen
- **Camera**: Click the camera icon to share your camera feed
- **Live Preview**: A small preview window shows what the agent sees
- **Stop Sharing**: Click the active button again or use browser controls

### Connection Status

The UI displays connection status:
- 🟡 **Connecting...** - Establishing connection
- 🟢 **Connected** - Active session
- 🟠 **Reconnecting...** - Auto-reconnecting after network error
- 🔴 **Connection Error** - Manual retry needed

### Error Handling

- **Permission Denied**: Check browser settings and grant access
- **Network Error**: Automatic reconnection (up to 5 attempts)
- **Connection Lost**: Status indicator shows reconnection progress

---

## Customization

### Change the persona
Edit files in `/persona/`:
- `system.md` — Core behavior and rules
- `voice.json` — Voice name, greetings, tone, TTS/Live voice selection

### Swap the knowledge base
Replace contents in `/knowledge/`:
- Add markdown docs to `/knowledge/docs/`
- Update `/knowledge/index.json` with document metadata

### Adjust robustness settings
Edit `services/liveService.ts`:
- `maxReconnectAttempts` - Number of reconnection attempts (default: 5)
- `reconnectDelay` - Initial delay in ms (default: 1000)
- Connection timeout values

---

## Technical Details

### Audio Processing Pipeline

1. **Input**: Microphone → AudioContext (16kHz) → AudioWorklet/ScriptProcessor → PCM conversion → Base64 → Gemini API
2. **Output**: Gemini API → Base64 audio → PCM decode → AudioContext (24kHz) → Speakers

### Memory Integration

- **Chat sessions**: Memory checkpoints after each assistant response
- **Live sessions**: Background checkpointing during conversation
- **Unified storage**: Same memory system for both interaction modes
- **Session resumption**: Load active session on connection

### State Management

- **Session state**: Typed state machine prevents invalid transitions
- **Reconnection logic**: Exponential backoff with attempt tracking
- **Resource cleanup**: AbortController ensures clean shutdowns

---

## Browser Compatibility

- **Chrome/Edge**: Full support (AudioWorklet)
- **Firefox**: Full support (AudioWorklet)
- **Safari**: Supported with ScriptProcessor fallback
- **Mobile**: iOS Safari and Chrome Android supported

---

**Built by Legacy AI**
