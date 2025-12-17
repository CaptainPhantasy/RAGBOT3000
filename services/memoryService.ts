/**
 * Memory Service for RAGBOT3000
 * 
 * Handles session memory with:
 * - Markdown-based storage
 * - TTL expiration (72 hours)
 * - Progress checkpointing
 * - Resume capability
 */

export interface MemoryPatch {
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

export interface SessionMeta {
  session_id: string;
  user_id: string;
  topic: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  status: 'active' | 'paused' | 'completed';
}

export interface SessionData extends SessionMeta {
  goal: string;
  last_completed_step: string;
  current_step: string;
  next_actions: string[];
  blockers: string[];
  key_decisions: string[];
  environment: string[];
  verification: string;
}

const TTL_HOURS = 72;
const STORAGE_KEY = 'ragbot3000_memory';

/**
 * Memory Manager Class
 * Uses localStorage for browser-based persistence
 */
class MemoryManager {
  private sessions: Map<string, SessionData> = new Map();

  constructor() {
    this.loadFromStorage();
    this.cleanupExpired();
  }

  /**
   * Load sessions from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as SessionData[];
        data.forEach(session => {
          this.sessions.set(session.session_id, session);
        });
      }
    } catch (err) {
      console.error('[Memory] Failed to load from storage:', err);
    }
  }

  /**
   * Save sessions to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.sessions.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('[Memory] Failed to save to storage:', err);
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(userId: string, topic: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = topic.toLowerCase().replace(/\s+/g, '-').substring(0, 30);
    return `${timestamp}__${userId}__${slug}`;
  }

  /**
   * Calculate expiration timestamp (72 hours from now)
   */
  private getExpiresAt(): string {
    const expires = new Date();
    expires.setHours(expires.getHours() + TTL_HOURS);
    return expires.toISOString();
  }

  /**
   * Remove expired sessions
   */
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;

    this.sessions.forEach((session, id) => {
      if (new Date(session.expires_at) < now) {
        this.sessions.delete(id);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.saveToStorage();
      console.log(`[Memory] Cleaned up ${cleaned} expired session(s)`);
    }

    return cleaned;
  }

  /**
   * Find active session for a user
   */
  loadActiveSession(userId: string): SessionData | null {
    this.cleanupExpired();

    let mostRecent: SessionData | null = null;
    let mostRecentTime = 0;

    this.sessions.forEach(session => {
      if (
        session.user_id === userId &&
        (session.status === 'active' || session.status === 'paused')
      ) {
        const updatedTime = new Date(session.updated_at).getTime();
        if (updatedTime > mostRecentTime) {
          mostRecentTime = updatedTime;
          mostRecent = session;
        }
      }
    });

    return mostRecent;
  }

  /**
   * Get all active sessions for a user
   */
  getActiveSessions(userId: string): SessionData[] {
    this.cleanupExpired();
    
    return Array.from(this.sessions.values())
      .filter(s => s.user_id === userId && s.status !== 'completed')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Create or update a session from a memory patch
   */
  upsertSession(userId: string, patch: MemoryPatch, existingSessionId?: string): SessionData | null {
    if (!patch.should_write) {
      return null;
    }

    const now = new Date().toISOString();
    
    // Find existing or create new
    let session: SessionData;
    
    if (existingSessionId && this.sessions.has(existingSessionId)) {
      // Update existing
      const existing = this.sessions.get(existingSessionId)!;
      session = {
        ...existing,
        updated_at: now,
        expires_at: this.getExpiresAt(),
        status: patch.status,
        topic: patch.topic || existing.topic,
        goal: patch.goal || existing.goal,
        last_completed_step: patch.last_completed_step || existing.last_completed_step,
        current_step: patch.current_step || existing.current_step,
        next_actions: patch.next_actions || existing.next_actions,
        blockers: patch.blockers || existing.blockers,
        key_decisions: patch.key_decisions 
          ? [...new Set([...existing.key_decisions, ...patch.key_decisions])]
          : existing.key_decisions,
        environment: patch.environment || existing.environment,
        verification: patch.verification || existing.verification,
      };
    } else {
      // Create new session
      const sessionId = this.generateSessionId(userId, patch.topic);
      session = {
        session_id: sessionId,
        user_id: userId,
        topic: patch.topic,
        created_at: now,
        updated_at: now,
        expires_at: this.getExpiresAt(),
        status: patch.status,
        goal: patch.goal || '',
        last_completed_step: patch.last_completed_step || '',
        current_step: patch.current_step || '',
        next_actions: patch.next_actions || [],
        blockers: patch.blockers || [],
        key_decisions: patch.key_decisions || [],
        environment: patch.environment || [],
        verification: patch.verification || '',
      };
    }

    this.sessions.set(session.session_id, session);
    this.saveToStorage();

    return session;
  }

  /**
   * Mark session as completed
   */
  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.updated_at = new Date().toISOString();
      this.saveToStorage();
    }
  }

  /**
   * Mark session as paused
   */
  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'paused';
      session.updated_at = new Date().toISOString();
      this.saveToStorage();
    }
  }

  /**
   * Delete a specific session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.saveToStorage();
  }

  /**
   * Clear all sessions for a user
   */
  clearUserSessions(userId: string): void {
    this.sessions.forEach((session, id) => {
      if (session.user_id === userId) {
        this.sessions.delete(id);
      }
    });
    this.saveToStorage();
  }

  /**
   * Export session to Markdown format
   */
  exportToMarkdown(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return `---
session_id: "${session.session_id}"
user_id: "${session.user_id}"
topic: "${session.topic}"
created_at: "${session.created_at}"
updated_at: "${session.updated_at}"
expires_at: "${session.expires_at}"
status: "${session.status}"
---

# Goal
${session.goal}

# Current State
- Last completed step: ${session.last_completed_step || 'None'}
- Current step: ${session.current_step || 'None'}
- Next step: ${session.next_actions[0] || 'None'}

# Key Decisions
${session.key_decisions.map(d => `- ${d}`).join('\n') || '- None yet'}

# Blockers / Errors
${session.blockers.map(b => `- ${b}`).join('\n') || '- None'}

# Environment
${session.environment.map(e => `- ${e}`).join('\n') || '- Not specified'}

# Verification
${session.verification || 'Success criteria not defined'}

# Next Actions
${session.next_actions.map((a, i) => `${i + 1}. ${a}`).join('\n') || '1. Continue from current step'}
`;
  }

  /**
   * Format session for injection into conversation context
   */
  formatForContext(session: SessionData): string {
    return `## Memory Context (Session: ${session.topic})

**Goal:** ${session.goal}

**Current State:**
- Last completed: ${session.last_completed_step || 'Starting'}
- Current step: ${session.current_step || 'Beginning'}

**Blockers:** ${session.blockers.length > 0 ? session.blockers.join('; ') : 'None'}

**Next Actions:**
${session.next_actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

**Verification:** ${session.verification || 'Not specified'}
`;
  }

  /**
   * Generate a resume prompt for the user
   */
  generateResumePrompt(session: SessionData): string {
    const lastStep = session.last_completed_step || 'getting started';
    const currentStep = session.current_step || session.next_actions[0] || 'continue';
    const blockerNote = session.blockers.length > 0 
      ? ` You encountered: ${session.blockers[0]}.` 
      : '';

    return `Last time we were working on: **${session.topic}**. You had ${lastStep}.${blockerNote} Next step was to ${currentStep}. Want to continue from there?`;
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();

// Run cleanup periodically (every 30 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    memoryManager.cleanupExpired();
  }, 30 * 60 * 1000);
}

