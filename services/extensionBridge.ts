/**
 * Extension Bridge — thin async bridge between Tom's React app and the Chrome Extension.
 *
 * Pure transport layer. No tool logic. Connects via chrome.runtime.connect() using
 * the extension ID injected by the content script into window.__TOM_EXTENSION_ID__.
 *
 * Features:
 * - Request-response correlation via unique requestIds
 * - Auto-reconnect with exponential backoff
 * - Event subscription for extension lifecycle events
 * - Guarded chrome.runtime access for non-extension environments
 */

import type {
  TomCommand,
  TomResponse,
  TomEvent,
  ToolName,
  TabInfo,
  ExtensionStatus,
} from './extensionBridge.types';

// ---------------------------------------------------------------------------
// Global type declarations
// ---------------------------------------------------------------------------

/**
 * Minimal chrome.runtime typings for the messaging API.
 * Avoids depending on @types/chrome — we only use connect/Port.
 */
declare namespace chrome {
  namespace runtime {
    interface Port {
      name: string;
      postMessage(message: any): void;
      disconnect(): void;
      onMessage: {
        addListener(callback: (message: any) => void): void;
        removeListener(callback: (message: any) => void): void;
      };
      onDisconnect: {
        addListener(callback: () => void): void;
        removeListener(callback: () => void): void;
      };
    }
    function connect(extensionId: string, connectInfo?: { name?: string }): Port;
  }
}

declare global {
  interface Window {
    __TOM_EXTENSION_ID__?: string;
  }
}

// Re-export types consumers will need
export type { TomCommand, TomResponse, TomEvent, ToolName, TabInfo, ExtensionStatus };

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Pending request waiting for a response from the extension */
interface PendingRequest {
  resolve: (response: TomResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type EventCallback = (event: TomEvent) => void;

// ---------------------------------------------------------------------------
// ExtensionBridge
// ---------------------------------------------------------------------------

export class ExtensionBridge {
  private port: chrome.runtime.Port | null = null;
  private extensionId: string | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventListeners = new Set<EventCallback>();

  // Reconnection state (pattern from liveService.ts)
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000; // base delay in ms
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect = false;

  // Request defaults
  private readonly requestTimeout = 30_000; // 30 s per request

  // ---------- public API ----------

  /**
   * Returns `true` if the extension is detected.
   * The content script sets `window.__TOM_EXTENSION_ID__` when injected.
   */
  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      typeof window.__TOM_EXTENSION_ID__ === 'string' &&
      window.__TOM_EXTENSION_ID__.length > 0
    );
  }

  /** Returns `true` if the long-lived port is currently open. */
  isConnected(): boolean {
    return this.port !== null;
  }

  /**
   * Establish a long-lived port to the extension via `chrome.runtime.connect`.
   * Resolves once the port is opened. Rejects if chrome.runtime is unavailable.
   */
  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Guard: chrome.runtime must exist
      if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
        reject(new Error('chrome.runtime is not available'));
        return;
      }

      // Resolve extension ID
      this.extensionId =
        (typeof window !== 'undefined' && window.__TOM_EXTENSION_ID__) || null;

      if (!this.extensionId) {
        reject(new Error('Extension ID not found. Is the extension installed?'));
        return;
      }

      // Already connected — noop
      if (this.port) {
        resolve();
        return;
      }

      try {
        this.isIntentionalDisconnect = false;
        this.reconnectAttempts = 0;

        this.port = chrome.runtime.connect(this.extensionId, {
          name: 'tom-the-peep',
        });

        this.port.onMessage.addListener(this.handleMessage);
        this.port.onDisconnect.addListener(this.handleDisconnect);

        resolve();
      } catch (err) {
        this.port = null;
        reject(err);
      }
    });
  }

  /** Intentionally close the port. No reconnection will be attempted. */
  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.clearReconnectTimer();
    this.cleanup();
  }

  /**
   * Send a tool command to the extension and await its response.
   *
   * @param tool   Tool name (must match ToolName union)
   * @param args   Arguments for the tool
   * @param tabId  Optional target tab ID
   * @returns      The TomResponse from the extension
   */
  execute(tool: ToolName, args: Record<string, any>, tabId?: number): Promise<TomResponse> {
    return new Promise<TomResponse>((resolve, reject) => {
      if (!this.port) {
        reject(new Error('Not connected to extension'));
        return;
      }

      const requestId = this.generateRequestId();

      const command: TomCommand = {
        type: 'tool_call',
        requestId,
        tool,
        args,
        ...(tabId !== undefined && { tabId }),
      };

      // Set up timeout for this request
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      try {
        this.port.postMessage(command);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  /**
   * Register a listener for TomEvents from the extension.
   * Returns an unsubscribe function.
   */
  onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /** Convenience: list all tabs the extension is aware of. */
  async listTabs(): Promise<TabInfo[]> {
    const response = await this.execute('list_tabs', {});
    if (!response.success) {
      throw new Error(response.error ?? 'Failed to list tabs');
    }
    return response.result as TabInfo[];
  }

  /** Convenience: get current extension status. */
  async getStatus(): Promise<ExtensionStatus> {
    if (!this.isConnected()) return 'disconnected';

    try {
      const response = await this.execute('get_tab_state', {});
      if (!response.success) return 'error';
      return 'ready';
    } catch {
      return 'error';
    }
  }

  /**
   * Listen for the `tom-extension-ready` custom event dispatched by the
   * content script, then auto-connect.
   * Call once at app startup.
   */
  listenForExtension(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('tom-extension-ready', () => {
      if (this.isAvailable() && !this.isConnected()) {
        this.connect().catch((err) => {
          console.warn('[ExtensionBridge] auto-connect failed:', err);
        });
      }
    });
  }

  // ---------- private ----------

  /** Handle an incoming message on the port. */
  private handleMessage = (message: TomResponse | TomEvent): void => {
    if (message.type === 'tool_response') {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.requestId);
        pending.resolve(message);
      }
      return;
    }

    if (message.type === 'event') {
      for (const cb of this.eventListeners) {
        try {
          cb(message);
        } catch (err) {
          console.error('[ExtensionBridge] event listener error:', err);
        }
      }
    }
  };

  /** Handle port disconnect — attempt reconnection unless intentional. */
  private handleDisconnect = (): void => {
    this.cleanup();

    // Notify listeners
    const disconnectEvent: TomEvent = {
      type: 'event',
      event: 'disconnected',
    };
    for (const cb of this.eventListeners) {
      try {
        cb(disconnectEvent);
      } catch {
        // swallow
      }
    }

    if (!this.isIntentionalDisconnect) {
      this.attemptReconnect();
    }
  };

  /**
   * Reconnect with exponential backoff.
   * Pattern adapted from liveService.ts:362-411.
   */
  private attemptReconnect(): void {
    if (this.isIntentionalDisconnect) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(
        `[ExtensionBridge] Max reconnect attempts (${this.maxReconnectAttempts}) reached`,
      );
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * 2 ** this.reconnectAttempts,
      30_000, // cap at 30 s
    );
    this.reconnectAttempts++;

    console.info(
      `[ExtensionBridge] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`,
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.isIntentionalDisconnect) return;

      this.connect().catch((err) => {
        console.error('[ExtensionBridge] Reconnection attempt failed:', err);
        // Will trigger handleDisconnect → another attemptReconnect if port fails
      });
    }, delay);
  }

  /** Tear down the current port and reject all pending requests. */
  private cleanup(): void {
    if (this.port) {
      try {
        this.port.onMessage.removeListener(this.handleMessage);
        this.port.onDisconnect.removeListener(this.handleDisconnect);
        this.port.disconnect();
      } catch {
        // port may already be invalid
      }
      this.port = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Port disconnected'));
      this.pendingRequests.delete(id);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /** Generate a unique request ID for command-response correlation. */
  private generateRequestId(): string {
    return `tom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const extensionBridge = new ExtensionBridge();
