# Memory Behavior Guidelines

## What Memory Stores (State, Not Facts)

Memory captures **process state** to enable resumption:

✅ **Store:**
- Active goal(s) ("what we're doing")
- Current step + next step
- Key decisions (settings chosen, paths taken)
- Blockers / errors (exact error text)
- Environment facts (OS, account role, version) if relevant
- User preferences (verbosity, format)

❌ **Do NOT Store:**
- Raw documentation content (that's in RAG)
- Full conversation transcripts
- Secrets, API keys, passwords
- Personal data beyond task context

## When to Write Memory

Write a checkpoint when:
1. **Step changes** — User progressed to next step
2. **Error appears** — Capture exact error text
3. **Decision made** — User picked a plan/setting
4. **Pause signals** — "stop", "later", "tomorrow", "I'll come back"
5. **~10 messages** — Since last checkpoint (safety net)

## Session Status Values

- `active` — Task in progress
- `paused` — User explicitly paused ("I'll come back later")
- `completed` — Task finished successfully

## Resume Behavior

When user returns (or says "where were we?"):

1. Load most recent active/paused session
2. Summarize briefly:
   - What we were doing
   - Last completed step
   - Any blockers encountered
   - Suggested next action
3. Ask for confirmation before continuing

**Example resume prompt:**
> "Last time we were importing CSV to Notion. You had mapped columns, but dates were importing as text. Next step was converting the date column to ISO format. Want to continue from there?"

## TTL Expiration

- Sessions expire **72 hours** after last update
- Expired sessions are automatically deleted
- This ensures privacy and prevents stale context

## Memory Size Limits

- Keep each session under **2KB**
- Summarize rather than store verbatim
- Focus on actionable state, not history

