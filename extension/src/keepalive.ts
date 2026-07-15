/**
 * Service Worker Lifecycle Management
 *
 * MV3 service workers can be terminated at any time by the browser.
 * This module uses chrome.alarms to keep the worker alive and
 * chrome.storage.local to persist critical state across restarts.
 */

import type { ExtensionStatus } from "./types";

declare const chrome: any;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEEPALIVE_ALARM = "tom-keepalive";
const KEEPALIVE_INTERVAL_MINUTES = 1;

const STORAGE_KEYS = {
	tomTabId: "tomTabId",
	controlledTabs: "controlledTabs",
	extensionStatus: "extensionStatus",
} as const;

// ---------------------------------------------------------------------------
// Persisted State Types
// ---------------------------------------------------------------------------

export interface PersistedState {
	tomTabId: number | null;
	controlledTabs: number[];
	extensionStatus: ExtensionStatus;
}

const DEFAULT_STATE: PersistedState = {
	tomTabId: null,
	controlledTabs: [],
	extensionStatus: "ready",
};

// ---------------------------------------------------------------------------
// State Persistence Helpers
// ---------------------------------------------------------------------------

/** Save a partial state update to chrome.storage.local. */
export async function saveState(
	partial: Partial<PersistedState>,
): Promise<void> {
	await chrome.storage.local.set(partial);
}

/** Load the full persisted state, falling back to defaults for missing keys. */
export async function loadState(): Promise<PersistedState> {
	const keys = Object.values(STORAGE_KEYS);
	const stored: Record<string, unknown> = await chrome.storage.local.get(keys);

	return {
		tomTabId:
			typeof stored[STORAGE_KEYS.tomTabId] === "number"
				? (stored[STORAGE_KEYS.tomTabId] as number)
				: DEFAULT_STATE.tomTabId,
		controlledTabs: Array.isArray(stored[STORAGE_KEYS.controlledTabs])
			? (stored[STORAGE_KEYS.controlledTabs] as number[])
			: DEFAULT_STATE.controlledTabs,
		extensionStatus:
			typeof stored[STORAGE_KEYS.extensionStatus] === "string"
				? (stored[STORAGE_KEYS.extensionStatus] as ExtensionStatus)
				: DEFAULT_STATE.extensionStatus,
	};
}

// ---------------------------------------------------------------------------
// Keepalive Alarm
// ---------------------------------------------------------------------------

/** Create (or re-create) the keepalive alarm. */
async function ensureKeepaliveAlarm(): Promise<void> {
	const existing = await chrome.alarms.get(KEEPALIVE_ALARM);
	if (existing) {
		return;
	}

	await chrome.alarms.create(KEEPALIVE_ALARM, {
		periodInMinutes: KEEPALIVE_INTERVAL_MINUTES,
	});
}

/**
 * Handle the keepalive alarm tick.
 * Reads from chrome.storage.local to keep the service worker event loop busy.
 */
async function onKeepaliveAlarm(): Promise<void> {
	// Touch storage to keep the service worker alive
	const state = await loadState();

	// Validate that persisted tabs still exist
	if (state.tomTabId !== null) {
		try {
			await chrome.tabs.get(state.tomTabId);
		} catch {
			// Tab no longer exists — clear stale reference
			await saveState({ tomTabId: null });
		}
	}

	if (state.controlledTabs.length > 0) {
		const validTabs: number[] = [];
		for (const tabId of state.controlledTabs) {
			try {
				await chrome.tabs.get(tabId);
				validTabs.push(tabId);
			} catch {
				// Tab gone — skip
			}
		}

		if (validTabs.length !== state.controlledTabs.length) {
			await saveState({ controlledTabs: validTabs });
		}
	}
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

/**
 * Re-establish state after a service worker restart.
 * Reads persisted state and validates it against live browser state.
 */
async function recoverState(): Promise<PersistedState> {
	const state = await loadState();

	// Validate tomTabId
	if (state.tomTabId !== null) {
		try {
			await chrome.tabs.get(state.tomTabId);
		} catch {
			state.tomTabId = null;
		}
	}

	// Validate controlled tabs
	const validTabs: number[] = [];
	for (const tabId of state.controlledTabs) {
		try {
			await chrome.tabs.get(tabId);
			validTabs.push(tabId);
		} catch {
			// Tab no longer exists
		}
	}
	state.controlledTabs = validTabs;

	// Persist the cleaned-up state
	await saveState(state);

	return state;
}

// ---------------------------------------------------------------------------
// Lifecycle Handlers
// ---------------------------------------------------------------------------

function registerAlarmListener(): void {
	chrome.alarms.onAlarm.addListener((alarm: { name: string }) => {
		if (alarm.name === KEEPALIVE_ALARM) {
			void onKeepaliveAlarm();
		}
	});
}

function registerStartupHandler(): void {
	chrome.runtime.onStartup.addListener(() => {
		void (async () => {
			await ensureKeepaliveAlarm();
			await recoverState();
		})();
	});
}

function registerInstalledHandler(): void {
	chrome.runtime.onInstalled.addListener(() => {
		void (async () => {
			// Initialize default state on fresh install or update
			await saveState(DEFAULT_STATE);
			await ensureKeepaliveAlarm();
		})();
	});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the keepalive system. Call once from the top level of background.ts.
 *
 * - Registers alarm, startup, and installed listeners
 * - Creates the keepalive alarm
 * - Recovers persisted state
 *
 * @returns The recovered persisted state
 */
export async function initKeepalive(): Promise<PersistedState> {
	registerAlarmListener();
	registerStartupHandler();
	registerInstalledHandler();

	await ensureKeepaliveAlarm();

	return recoverState();
}
