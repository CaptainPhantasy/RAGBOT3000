import { describe, it, expect, beforeEach } from 'vitest';
import { chromeMock, resetChromeAPIs } from './mocks/chrome';
import { saveState, loadState, initKeepalive, type PersistedState } from '../keepalive';

// ---------------------------------------------------------------------------
// Tests for the keepalive module — state persistence + alarm management
// ---------------------------------------------------------------------------

describe('saveState', () => {
  beforeEach(() => {
    resetChromeAPIs();
  });

  it('writes partial state to chrome.storage.local', async () => {
    await saveState({ tomTabId: 42 });

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ tomTabId: 42 });
  });

  it('writes multiple fields in a single call', async () => {
    await saveState({ tomTabId: 10, controlledTabs: [20, 30], extensionStatus: 'busy' });

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      tomTabId: 10,
      controlledTabs: [20, 30],
      extensionStatus: 'busy',
    });
  });
});

describe('loadState', () => {
  beforeEach(() => {
    resetChromeAPIs();
  });

  it('returns defaults when storage is empty', async () => {
    chromeMock.storage.local.get.mockResolvedValue({});

    const state = await loadState();

    expect(state).toEqual({
      tomTabId: null,
      controlledTabs: [],
      extensionStatus: 'ready',
    });
  });

  it('returns stored values when present', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      tomTabId: 5,
      controlledTabs: [10, 20],
      extensionStatus: 'busy',
    });

    const state = await loadState();

    expect(state.tomTabId).toBe(5);
    expect(state.controlledTabs).toEqual([10, 20]);
    expect(state.extensionStatus).toBe('busy');
  });

  it('falls back to defaults for invalid stored types', async () => {
    chromeMock.storage.local.get.mockResolvedValue({
      tomTabId: 'not-a-number',      // invalid: should be number | null
      controlledTabs: 'not-an-array', // invalid: should be number[]
      extensionStatus: 42,            // invalid: should be string
    });

    const state = await loadState();

    expect(state.tomTabId).toBeNull();
    expect(state.controlledTabs).toEqual([]);
    expect(state.extensionStatus).toBe('ready');
  });
});

describe('initKeepalive', () => {
  beforeEach(() => {
    resetChromeAPIs();
    // Clear event listeners from prior tests so we don't double-register
    chromeMock.alarms.onAlarm.clearListeners();
    chromeMock.runtime.onStartup.clearListeners();
    chromeMock.runtime.onInstalled.clearListeners();
  });

  it('creates the keepalive alarm when none exists', async () => {
    chromeMock.alarms.get.mockResolvedValue(null); // no existing alarm
    chromeMock.storage.local.get.mockResolvedValue({});
    // tabs.get should fail for validation (no stored tabs)
    chromeMock.tabs.get.mockRejectedValue(new Error('No tab'));

    await initKeepalive();

    expect(chromeMock.alarms.create).toHaveBeenCalledWith('tom-keepalive', {
      periodInMinutes: 1,
    });
  });

  it('skips alarm creation when alarm already exists', async () => {
    chromeMock.alarms.get.mockResolvedValue({ name: 'tom-keepalive' }); // exists
    chromeMock.storage.local.get.mockResolvedValue({});

    await initKeepalive();

    expect(chromeMock.alarms.create).not.toHaveBeenCalled();
  });

  it('registers alarm, startup, and installed listeners', async () => {
    chromeMock.alarms.get.mockResolvedValue(null);
    chromeMock.storage.local.get.mockResolvedValue({});
    chromeMock.tabs.get.mockRejectedValue(new Error('No tab'));

    await initKeepalive();

    expect(chromeMock.alarms.onAlarm.getListeners().length).toBeGreaterThan(0);
    expect(chromeMock.runtime.onStartup.getListeners().length).toBeGreaterThan(0);
    expect(chromeMock.runtime.onInstalled.getListeners().length).toBeGreaterThan(0);
  });

  it('recovers and validates persisted state', async () => {
    chromeMock.alarms.get.mockResolvedValue(null);
    chromeMock.storage.local.get.mockResolvedValue({
      tomTabId: 99,
      controlledTabs: [100, 101],
      extensionStatus: 'busy',
    });

    // recoverState calls chrome.tabs.get 3 times:
    //   1. tomTabId (99) — exists
    //   2. controlledTabs[0] (100) — exists
    //   3. controlledTabs[1] (101) — gone
    chromeMock.tabs.get
      .mockResolvedValueOnce({ id: 99 })   // tomTabId check
      .mockResolvedValueOnce({ id: 100 })  // controlledTabs[0]
      .mockRejectedValueOnce(new Error('No such tab')); // controlledTabs[1] gone

    const state = await initKeepalive();

    expect(state.tomTabId).toBe(99);
    expect(state.controlledTabs).toEqual([100]); // 101 was pruned
    // Should have persisted the cleaned-up state
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
  });

  it('clears tomTabId if the persisted tab no longer exists', async () => {
    chromeMock.alarms.get.mockResolvedValue(null);
    chromeMock.storage.local.get.mockResolvedValue({
      tomTabId: 999,
      controlledTabs: [],
      extensionStatus: 'ready',
    });

    // Tab 999 doesn't exist
    chromeMock.tabs.get.mockRejectedValue(new Error('No such tab'));

    const state = await initKeepalive();

    expect(state.tomTabId).toBeNull();
  });
});

describe('Keepalive alarm handler', () => {
  beforeEach(() => {
    resetChromeAPIs();
    chromeMock.alarms.onAlarm.clearListeners();
    chromeMock.runtime.onStartup.clearListeners();
    chromeMock.runtime.onInstalled.clearListeners();
  });

  it('validates and prunes stale tabs on alarm tick', async () => {
    chromeMock.alarms.get.mockResolvedValue(null);
    chromeMock.storage.local.get.mockResolvedValue({
      tomTabId: null,
      controlledTabs: [10, 20],
      extensionStatus: 'ready',
    });
    chromeMock.tabs.get.mockRejectedValue(new Error('No tab'));

    await initKeepalive();

    // Reset to set up for alarm tick
    chromeMock.storage.local.get.mockResolvedValue({
      tomTabId: null,
      controlledTabs: [10, 20],
      extensionStatus: 'ready',
    });
    chromeMock.tabs.get
      .mockResolvedValueOnce({ id: 10 }) // tab 10 exists
      .mockRejectedValueOnce(new Error('No such tab')); // tab 20 gone
    chromeMock.storage.local.set.mockReset().mockResolvedValue(undefined);

    // Fire the alarm
    chromeMock.alarms.onAlarm.fire({ name: 'tom-keepalive' });

    // Wait for async handler
    await new Promise<void>((r) => setTimeout(r, 50));

    // Should have saved the pruned list
    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      controlledTabs: [10],
    });
  });
});
