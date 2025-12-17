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
│   └── WavyBackground.tsx     # Voice-reactive visualization
│
├── services/                   # Core services
│   ├── geminiService.ts       # LLM orchestration (router + responder + memory patches)
│   ├── liveService.ts         # Real-time voice session
│   └── memoryService.ts       # Local memory manager (TTL, checkpoints, resume)
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
| Model | `gemini-2.5-flash-native-audio-preview` |
| Voice | Configurable (default: Fenrir) |
| Visualization | Voice-reactive waveforms (Bass/Mid/Treble) |

---

## Intended Outcome

RAGBOT3000 becomes an **invaluable asset** as a learning partner:

- It helps users **learn faster**
- It helps users **do the work correctly**
- It helps users **recover quickly** from confusion or errors
- It stays **grounded in the documentation** you provide, with a clean, swappable expertise model

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
   npm install --include=dev
   ```

2. **Configure API key:**
   Create a `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open:** http://localhost:3000

---

## Customization

### Change the persona
Edit files in `/persona/`:
- `system.md` — Core behavior and rules
- `voice.json` — Voice name, greetings, tone

### Swap the knowledge base
Replace contents in `/knowledge/`:
- Add markdown docs to `/knowledge/docs/`
- Update `/knowledge/index.json` with document metadata

---

**Built by Legacy AI**
