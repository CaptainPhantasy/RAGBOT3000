/**
 * Comprehensive Chrome Extension API mocks for vitest.
 *
 * Provides mock implementations of chrome.tabs, chrome.runtime,
 * chrome.storage, chrome.alarms, and chrome.debugger.
 *
 * Used as a vitest setupFile so the global `chrome` object exists
 * before any module under test is imported.
 */
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helper: create an event target that captures registered listeners
// ---------------------------------------------------------------------------

export interface MockEvent<T extends (...args: any[]) => any = (...args: any[]) => void> {
  addListener: ReturnType<typeof vi.fn<[T], void>>;
  /** Fire all registered listeners with the given arguments. */
  fire: (...args: Parameters<T>) => void;
  /** Get all registered listener callbacks. */
  getListeners: () => T[];
  /** Remove all registered listeners (for test isolation). */
  clearListeners: () => void;
}

function createMockEvent<T extends (...args: any[]) => any = (...args: any[]) => void>(): MockEvent<T> {
  const listeners: T[] = [];

  const addListener = vi.fn((cb: T) => {
    listeners.push(cb);
  });

  return {
    addListener,
    fire: (...args: Parameters<T>) => {
      for (const listener of listeners) {
        listener(...args);
      }
    },
    getListeners: () => [...listeners],
    clearListeners: () => {
      listeners.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Chrome mock object
// ---------------------------------------------------------------------------

function buildChromeMock() {
  return {
    tabs: {
      create: vi.fn().mockResolvedValue({ id: 100, url: '', title: '', active: true, status: 'loading' }),
      remove: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue({ id: 1, url: '', title: '', active: true, status: 'complete' }),
      query: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ id: 1, url: '', title: '', active: false, status: 'complete' }),
      onRemoved: createMockEvent<(tabId: number, removeInfo: object) => void>(),
      onUpdated: createMockEvent<(tabId: number, changeInfo: object, tab: object) => void>(),
    },
    runtime: {
      onConnect: createMockEvent<(port: any) => void>(),
      onConnectExternal: createMockEvent<(port: any) => void>(),
      onMessageExternal: createMockEvent<(message: any, sender: any, sendResponse: (r: any) => void) => boolean | void>(),
      onStartup: createMockEvent<() => void>(),
      onInstalled: createMockEvent<() => void>(),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    alarms: {
      create: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      onAlarm: createMockEvent<(alarm: { name: string }) => void>(),
    },
    debugger: {
      attach: vi.fn().mockResolvedValue(undefined),
      detach: vi.fn().mockResolvedValue(undefined),
      sendCommand: vi.fn().mockResolvedValue(undefined),
      getTargets: vi.fn().mockResolvedValue([]),
      onDetach: createMockEvent(),
      onEvent: createMockEvent(),
    },
  };
}

export type ChromeMock = ReturnType<typeof buildChromeMock>;

export const chromeMock: ChromeMock = buildChromeMock();

// Install globally — must happen before any module import
(globalThis as any).chrome = chromeMock;

// ---------------------------------------------------------------------------
// Reset helpers
// ---------------------------------------------------------------------------

/**
 * Reset API call mocks to default resolved values.
 * Does NOT clear listener registrations — those persist across tests
 * because modules are loaded once per test file.
 */
export function resetChromeAPIs(): void {
  // tabs
  chromeMock.tabs.create.mockReset().mockResolvedValue({ id: 100, url: '', title: '', active: true, status: 'loading' });
  chromeMock.tabs.remove.mockReset().mockResolvedValue(undefined);
  chromeMock.tabs.update.mockReset().mockResolvedValue({ id: 1, url: '', title: '', active: true, status: 'complete' });
  chromeMock.tabs.query.mockReset().mockResolvedValue([]);
  chromeMock.tabs.get.mockReset().mockResolvedValue({ id: 1, url: '', title: '', active: false, status: 'complete' });

  // storage
  chromeMock.storage.local.get.mockReset().mockResolvedValue({});
  chromeMock.storage.local.set.mockReset().mockResolvedValue(undefined);

  // alarms
  chromeMock.alarms.create.mockReset().mockResolvedValue(undefined);
  chromeMock.alarms.get.mockReset().mockResolvedValue(null);

  // debugger
  chromeMock.debugger.attach.mockReset().mockResolvedValue(undefined);
  chromeMock.debugger.detach.mockReset().mockResolvedValue(undefined);
  chromeMock.debugger.sendCommand.mockReset().mockResolvedValue(undefined);
  chromeMock.debugger.getTargets.mockReset().mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Port factory — creates a mock RuntimePort for testing chrome.runtime.connect
// ---------------------------------------------------------------------------

export interface MockPort {
  sender: { origin?: string; url?: string; tab?: { id?: number } } | undefined;
  onMessage: MockEvent;
  onDisconnect: MockEvent;
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

export function createMockPort(overrides?: Partial<{
  origin: string;
  tabId: number;
}>): MockPort {
  return {
    sender: {
      origin: overrides?.origin ?? 'http://localhost:3000',
      tab: overrides?.tabId != null ? { id: overrides.tabId } : undefined,
    },
    onMessage: createMockEvent(),
    onDisconnect: createMockEvent(),
    postMessage: vi.fn(),
    disconnect: vi.fn(),
  };
}
