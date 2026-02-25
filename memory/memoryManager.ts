import { MemoryFile, WebObservation } from './types';

const MEMORY_KEY = 'ragbot_web_analyzer_memory';
const MAX_OBSERVATIONS = 50; // Limit to prevent memory bloat

export class MemoryManager {
  private memory: MemoryFile;
  private listeners: Array<(memory: MemoryFile) => void> = [];

  constructor(sessionId?: string) {
    this.memory = this.loadMemory(sessionId);
  }

  private loadMemory(sessionId?: string): MemoryFile {
    const existing = localStorage.getItem(MEMORY_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        // If new session ID provided, reset the memory
        if (sessionId && parsed.session_id !== sessionId) {
          return this.createNewMemory(sessionId);
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse existing memory:', e);
      }
    }
    return this.createNewMemory(sessionId);
  }

  private createNewMemory(sessionId?: string): MemoryFile {
    const now = Date.now();
    return {
      session_id: sessionId || `session_${now}`,
      created_at: now,
      last_updated: now,
      current_url: undefined,
      session_history: [],
      observations: [],
      llm_interface: {
        ready_for_reading: false,
        pending_commands: []
      }
    };
  }

  private saveMemory(): void {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(this.memory));
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save memory:', e);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.memory);
    });
  }

  public addObservation(observation: WebObservation): void {
    this.memory.observations.push(observation);
    
    // Add to history
    this.memory.session_history.push({
      timestamp: Date.now(),
      type: 'observation',
      content: observation
    });

    // Limit observations to prevent memory issues
    if (this.memory.observations.length > MAX_OBSERVATIONS) {
      this.memory.observations = this.memory.observations.slice(-MAX_OBSERVATIONS);
    }

    this.memory.last_updated = Date.now();
    this.saveMemory();
  }

  public addNavigationEvent(url: string): void {
    this.memory.current_url = url;
    this.memory.session_history.push({
      timestamp: Date.now(),
      type: 'navigation',
      content: `Navigated to: ${url}`
    });
    this.memory.last_updated = Date.now();
    this.saveMemory();
  }

  public addCommand(command: string): void {
    this.memory.llm_interface.pending_commands.push(command);
    this.memory.session_history.push({
      timestamp: Date.now(),
      type: 'command',
      content: command
    });
    this.memory.last_updated = Date.now();
    this.saveMemory();
  }

  public addAnalysis(analysis: string): void {
    this.memory.session_history.push({
      timestamp: Date.now(),
      type: 'analysis',
      content: analysis
    });
    this.memory.last_updated = Date.now();
    this.saveMemory();
  }

  public getLatestObservation(): WebObservation | null {
    return this.memory.observations.length > 0 
      ? this.memory.observations[this.memory.observations.length - 1]
      : null;
  }

  public getAllObservations(): WebObservation[] {
    return [...this.memory.observations];
  }

  public getMemory(): MemoryFile {
    return { ...this.memory };
  }

  public markAsRead(): void {
    this.memory.llm_interface.ready_for_reading = true;
    this.memory.llm_interface.last_read_timestamp = Date.now();
    this.saveMemory();
  }

  public clearCommands(): void {
    this.memory.llm_interface.pending_commands = [];
    this.saveMemory();
  }

  public getPendingCommands(): string[] {
    return [...this.memory.llm_interface.pending_commands];
  }

  public subscribe(listener: (memory: MemoryFile) => void): () => void {
    this.listeners.push(listener);
    // Immediately call with current state
    listener(this.memory);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public clearMemory(): void {
    this.memory = this.createNewMemory(this.memory.session_id);
    this.saveMemory();
  }

  // Export memory for LLM consumption
  public exportForLLM(): string {
    const latest = this.getLatestObservation();
    if (!latest) {
      return JSON.stringify({
        status: 'no_observations',
        session_id: this.memory.session_id,
        pending_commands: this.memory.llm_interface.pending_commands
      }, null, 2);
    }

    return JSON.stringify({
      status: 'ready',
      session_id: this.memory.session_id,
      current_url: this.memory.current_url,
      latest_observation: latest,
      navigation_guidance: latest.navigation_guidance,
      critical_issues: latest.summary.critical_issues,
      recommended_fixes: latest.summary.recommended_fixes,
      pending_commands: this.memory.llm_interface.pending_commands
    }, null, 2);
  }

  // Export detailed memory for human review
  public exportDetailed(): string {
    return JSON.stringify(this.memory, null, 2);
  }
}

// Singleton instance
let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(sessionId?: string): MemoryManager {
  if (!memoryManagerInstance || sessionId) {
    memoryManagerInstance = new MemoryManager(sessionId);
  }
  return memoryManagerInstance;
}