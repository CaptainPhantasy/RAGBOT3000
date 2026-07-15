import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock, resetChromeAPIs, createMockPort } from './mocks/chrome';
import type { TomCommand, TomResponse } from '../types';

// ---------------------------------------------------------------------------
// Mock keepalive so background.ts module-level initKeepalive() doesn't blow up
// ---------------------------------------------------------------------------
vi.mock('../keepalive', () => ({
  initKeepalive: vi.fn().mockResolvedValue({
    tomTabId: null,
    controlledTabs: [],
    extensionStatus: 'ready' as const,
  }),
}));

// Mock the dynamic import of pageController — we don't test puppeteer internals
vi.mock('../pageController', () => ({
  default: class MockPageController {
    async executeToolCall(command: TomCommand, _tabId: number) {
      return { mockResult: true, tool: command.tool };
    }
  },
  PageController: class MockPageController {
    async executeToolCall(command: TomCommand, _tabId: number) {
      return { mockResult: true, tool: command.tool };
    }
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test — triggers listener registrations
// ---------------------------------------------------------------------------
import { openTab, closeTab, switchTab, listTabs, getTabState } from '../background';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush the microtask queue so fire-and-forget async work completes. */
const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 10));

function makeCommand(tool: string, args: Record<string, unknown> = {}, requestId = 'req-1'): TomCommand {
  return { type: 'tool_call', requestId, tool: tool as TomCommand['tool'], args };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tab management — exported functions', () => {
  beforeEach(() => {
    resetChromeAPIs();
  });

  it('openTab creates a new tab and returns TabInfo', async () => {
    chromeMock.tabs.create.mockResolvedValue({
      id: 200,
      url: 'https://example.com',
      title: 'Example',
      active: true,
      status: 'loading',
    });

    const result = await openTab('https://example.com');

    expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com', active: true });
    expect(result).toEqual({
      tabId: 200,
      url: 'https://example.com',
      title: 'Example',
      active: true,
      status: 'loading',
    });
  });

  it('openTab throws when Chrome returns no tab ID', async () => {
    chromeMock.tabs.create.mockResolvedValue({ url: 'about:blank' }); // no id

    await expect(openTab('about:blank')).rejects.toThrow('Chrome did not return a tab ID');
  });

  it('closeTab calls chrome.tabs.remove', async () => {
    await closeTab(200);

    expect(chromeMock.tabs.remove).toHaveBeenCalledWith(200);
  });

  it('switchTab activates a tab and returns TabInfo', async () => {
    chromeMock.tabs.update.mockResolvedValue({
      id: 300,
      url: 'https://switched.com',
      title: 'Switched',
      active: true,
      status: 'complete',
    });

    const result = await switchTab(300);

    expect(chromeMock.tabs.update).toHaveBeenCalledWith(300, { active: true });
    expect(result.tabId).toBe(300);
    expect(result.active).toBe(true);
  });

  it('switchTab throws when tab is not found', async () => {
    chromeMock.tabs.update.mockResolvedValue(null);

    await expect(switchTab(999)).rejects.toThrow('Tab 999 was not found');
  });

  it('listTabs queries current window and maps to TabInfo[]', async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://a.com', title: 'A', active: true, status: 'complete' },
      { id: 2, url: 'https://b.com', title: 'B', active: false, status: 'complete' },
      { url: 'chrome://newtab' }, // no id — should be filtered out
    ]);

    const tabs = await listTabs();

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
    expect(tabs).toHaveLength(2);
    expect(tabs[0].tabId).toBe(1);
    expect(tabs[1].tabId).toBe(2);
  });

  it('getTabState returns info for a specific tab', async () => {
    chromeMock.tabs.get.mockResolvedValue({
      id: 5,
      url: 'https://state.com',
      title: 'State',
      active: false,
      status: 'complete',
    });

    const info = await getTabState(5);

    expect(chromeMock.tabs.get).toHaveBeenCalledWith(5);
    expect(info).toEqual({
      tabId: 5,
      url: 'https://state.com',
      title: 'State',
      active: false,
      status: 'complete',
    });
  });
});

// ---------------------------------------------------------------------------
// Message routing via chrome.runtime.onMessageExternal listener
// ---------------------------------------------------------------------------

describe('Message routing — onMessageExternal', () => {
  let onMessageExternal: (message: unknown, sender: object, sendResponse: (r: TomResponse) => void) => boolean | void;

  beforeEach(() => {
    resetChromeAPIs();
    // Grab the listener that background.ts registered during import
    const calls = chromeMock.runtime.onMessageExternal.addListener.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    onMessageExternal = calls[0][0];
  });

  it('routes list_tabs command and returns success response', async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://a.com', title: 'A', active: true, status: 'complete' },
    ]);

    const sendResponse = vi.fn();
    onMessageExternal(
      makeCommand('list_tabs'),
      { origin: 'http://localhost:3000' },
      sendResponse,
    );

    await flushMicrotasks();

    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response: TomResponse = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.type).toBe('tool_response');
    expect(Array.isArray(response.result)).toBe(true);
  });

  it('rejects messages from non-whitelisted origins', () => {
    const sendResponse = vi.fn();
    onMessageExternal(
      makeCommand('list_tabs'),
      { origin: 'https://evil.com' },
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response: TomResponse = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.error).toContain('not allowed');
  });

  it('accepts messages from Railway wildcard origins', async () => {
    chromeMock.tabs.query.mockResolvedValue([]);

    const sendResponse = vi.fn();
    onMessageExternal(
      makeCommand('list_tabs'),
      { origin: 'https://my-preview-abc123.up.railway.app' },
      sendResponse,
    );

    await flushMicrotasks();

    const response: TomResponse = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
  });

  it('rejects invalid messages that are not TomCommand', () => {
    const sendResponse = vi.fn();
    onMessageExternal(
      { type: 'garbage', foo: 'bar' },
      { origin: 'http://localhost:3000' },
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response: TomResponse = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.error).toContain('Invalid message');
  });

  it('routes open_tab and returns new tab info', async () => {
    chromeMock.tabs.create.mockResolvedValue({
      id: 500,
      url: 'https://new-tab.com',
      title: 'New Tab',
      active: true,
      status: 'loading',
    });

    const sendResponse = vi.fn();
    onMessageExternal(
      makeCommand('open_tab', { url: 'https://new-tab.com' }),
      { origin: 'http://localhost:3000' },
      sendResponse,
    );

    await flushMicrotasks();

    const response: TomResponse = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.result.tabId).toBe(500);
    expect(response.result.url).toBe('https://new-tab.com');
  });

  it('returns error when open_tab has no url arg', async () => {
    const sendResponse = vi.fn();
    onMessageExternal(
      makeCommand('open_tab', {}),
      { origin: 'http://localhost:3000' },
      sendResponse,
    );

    await flushMicrotasks();

    const response: TomResponse = sendResponse.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.error).toContain('args.url');
  });
});

// ---------------------------------------------------------------------------
// Port-based communication — onConnectExternal
// ---------------------------------------------------------------------------

describe('Port connection — onConnectExternal', () => {
  let onConnectExternal: (port: any) => void;

  beforeEach(() => {
    resetChromeAPIs();
    const calls = chromeMock.runtime.onConnectExternal.addListener.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    onConnectExternal = calls[0][0];
  });

  it('disconnects ports from non-whitelisted origins', () => {
    const port = createMockPort({ origin: 'https://evil-site.com' });
    onConnectExternal(port);

    expect(port.disconnect).toHaveBeenCalled();
    expect(port.onMessage.addListener).not.toHaveBeenCalled();
  });

  it('accepts ports from whitelisted origins and registers listeners', () => {
    const port = createMockPort({ origin: 'http://localhost:3000', tabId: 42 });
    onConnectExternal(port);

    expect(port.disconnect).not.toHaveBeenCalled();
    expect(port.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(port.onDisconnect.addListener).toHaveBeenCalledTimes(1);
    // Should emit 'connected' event
    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event', event: 'connected' }),
    );
  });

  it('routes commands received via port and replies with response', async () => {
    const port = createMockPort({ origin: 'http://localhost:3000' });
    onConnectExternal(port);

    chromeMock.tabs.query.mockResolvedValue([
      { id: 10, url: 'https://a.com', title: 'A', active: true, status: 'complete' },
    ]);

    // Get the message listener that was registered on the port
    const messageListener = port.onMessage.addListener.mock.calls[0][0];
    messageListener(makeCommand('list_tabs'));

    await flushMicrotasks();

    // postMessage is called once for 'connected' event + once for response
    const responseCalls = port.postMessage.mock.calls.filter(
      (call: any[]) => call[0]?.type === 'tool_response',
    );
    expect(responseCalls).toHaveLength(1);
    expect(responseCalls[0][0].success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tab lifecycle events
// ---------------------------------------------------------------------------

describe('Tab lifecycle — onRemoved', () => {
  beforeEach(() => {
    resetChromeAPIs();
  });

  it('clears activeControlledTabId when the controlled tab is removed', async () => {
    // First, open a tab to set activeControlledTabId
    chromeMock.tabs.create.mockResolvedValue({
      id: 777,
      url: 'https://controlled.com',
      title: 'Controlled',
      active: true,
      status: 'complete',
    });
    await openTab('https://controlled.com');

    // Now simulate tab removal
    chromeMock.tabs.onRemoved.fire(777, {});

    await flushMicrotasks();

    // After removal, listing tabs should not reference 777 as active
    chromeMock.tabs.query.mockResolvedValue([]);
    const tabs = await listTabs();
    expect(tabs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Security — Tom's tab protection
// ---------------------------------------------------------------------------

describe('Tom tab protection', () => {
  let onConnectExternal: (port: any) => void;

  beforeEach(() => {
    resetChromeAPIs();
    const calls = chromeMock.runtime.onConnectExternal.addListener.mock.calls;
    onConnectExternal = calls[0][0];
  });

  it('refuses to close Tom\'s own app tab', async () => {
    // Connect from Tom's app tab — this sets tomTabId
    const port = createMockPort({ origin: 'http://localhost:3000', tabId: 42 });
    onConnectExternal(port);

    // Attempting to close Tom's tab should be rejected
    await expect(closeTab(42)).rejects.toThrow("Tom's app tab is protected");

    // Verify chrome.tabs.remove was NOT called
    expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
  });
});
