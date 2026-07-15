import type { TabInfo, TomCommand, TomResponse } from "./types";
import { initKeepalive, saveState } from "./keepalive";
import PageController from "./pageController";

declare const chrome: any;

type PageControllerLike = {
	attachToTab: (tabId: number) => Promise<void>;
	detachFromTab: (tabId: number) => Promise<void>;
	executeToolCall: (command: TomCommand, tabId: number) => Promise<unknown>;
	onTabClosed?: (tabId: number) => Promise<void> | void;
	onTabUpdated?: (
		tabId: number,
		changeInfo: BrowserTabChangeInfo,
		tab: BrowserTab,
	) => Promise<void> | void;
};

type BrowserTab = {
	id?: number;
	url?: string;
	title?: string;
	active?: boolean;
	status?: string;
};

type BrowserTabChangeInfo = {
	url?: string;
	status?: string;
};

type MessageSender = {
	origin?: string;
	url?: string;
	tab?: { id?: number };
};

type RuntimePort = {
	sender?: MessageSender;
	onMessage: { addListener: (listener: (message: unknown) => void) => void };
	onDisconnect: { addListener: (listener: () => void) => void };
	postMessage: (message: unknown) => void;
	disconnect: () => void;
};

const ALLOWED_ORIGINS = new Set([
	"https://ragbot3000gsev1beta-vision-agent.up.railway.app",
	"http://localhost:3000",
	"http://localhost",
]);

const READ_ONLY_TOOLS = new Set([
	"analyze_page",
	"analyze_element",
	"find_elements",
	"check_accessibility",
	"extract_css",
	"check_contrast",
	"extract_text",
	"get_page_state",
	"list_tabs",
	"get_tab_state",
	"read_commands",
]);

let tomTabId: number | null = null;
let activeControlledTabId: number | null = null;
const controlledTabIds = new Set<number>();
let tomPort: RuntimePort | null = null;
const pageController: PageControllerLike = new PageController();

// Initialize service worker keepalive and recover persisted state
void initKeepalive().then((state) => {
	if (state.tomTabId !== null) {
		tomTabId = state.tomTabId;
	}
	if (state.controlledTabs.length > 0) {
		for (const tabId of state.controlledTabs) {
			controlledTabIds.add(tabId);
		}
		activeControlledTabId = state.controlledTabs[0];
	}
});

async function rememberControlledTab(tabId: number): Promise<void> {
	controlledTabIds.delete(tabId);
	const remaining = [...controlledTabIds];
	controlledTabIds.clear();
	controlledTabIds.add(tabId);
	for (const existingId of remaining) controlledTabIds.add(existingId);
	activeControlledTabId = tabId;
	await saveState({ controlledTabs: [...controlledTabIds] });
}

async function forgetControlledTab(tabId: number): Promise<void> {
	controlledTabIds.delete(tabId);
	if (activeControlledTabId === tabId) {
		activeControlledTabId = controlledTabIds.values().next().value ?? null;
	}
	await saveState({ controlledTabs: [...controlledTabIds] });
}

function getSenderOrigin(sender: MessageSender | undefined): string | null {
	if (!sender) {
		return null;
	}

	if (sender.origin) {
		return sender.origin;
	}

	if (!sender.url) {
		return null;
	}

	try {
		return new URL(sender.url).origin;
	} catch {
		return null;
	}
}

function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) {
		return false;
	}

	return ALLOWED_ORIGINS.has(origin);
}

function isExternalSenderAllowed(sender: MessageSender | undefined): boolean {
	return isAllowedOrigin(getSenderOrigin(sender));
}

function toTabInfo(tab: BrowserTab): TabInfo {
	return {
		tabId: tab.id ?? -1,
		url: tab.url ?? "",
		title: tab.title ?? "",
		active: Boolean(tab.active),
		status: tab.status ?? "unknown",
	};
}

function createErrorResponse(requestId: string, error: string): TomResponse {
	return {
		type: "tool_response",
		requestId,
		success: false,
		error,
	};
}

function createSuccessResponse(
	requestId: string,
	result: unknown,
): TomResponse {
	return {
		type: "tool_response",
		requestId,
		success: true,
		result,
	};
}

function isTomCommand(value: unknown): value is TomCommand {
	if (!value || typeof value !== "object") {
		return false;
	}

	const maybeCommand = value as Partial<TomCommand>;
	return (
		maybeCommand.type === "tool_call" &&
		typeof maybeCommand.requestId === "string" &&
		typeof maybeCommand.tool === "string" &&
		typeof maybeCommand.args === "object" &&
		maybeCommand.args !== null
	);
}

function emitEvent(
	event: "connected" | "disconnected" | "tab_changed" | "error",
	data?: unknown,
): void {
	if (!tomPort) {
		return;
	}

	tomPort.postMessage({ type: "event", event, data });
}

function assertTabIsControllable(tabId: number, actionName: string): void {
	if (tomTabId !== null && tabId === tomTabId) {
		throw new Error(`Refused to ${actionName}: Tom's app tab is protected`);
	}
}

function resolveTargetTabId(command: TomCommand): number | null {
	if (typeof command.tabId === "number") {
		return command.tabId;
	}

	return activeControlledTabId;
}

function getTabIdArgument(command: TomCommand): number | null {
	const tabId = command.args.tabId ?? command.args.tab_id;
	return typeof tabId === "number" ? tabId : null;
}

export async function openTab(url: string): Promise<TabInfo> {
	const tab = (await chrome.tabs.create({ url, active: true })) as BrowserTab;
	if (!tab.id) {
		throw new Error("Chrome did not return a tab ID for the new tab");
	}

	await pageController.attachToTab(tab.id);
	await rememberControlledTab(tab.id);
	emitEvent("tab_changed", { tabId: activeControlledTabId, reason: "opened" });
	return toTabInfo(tab);
}

export async function closeTab(tabId: number): Promise<void> {
	assertTabIsControllable(tabId, "close tab");
	await pageController.detachFromTab(tabId);
	await chrome.tabs.remove(tabId);
	await forgetControlledTab(tabId);
	emitEvent("tab_changed", { tabId: activeControlledTabId, reason: "closed" });
}

export async function switchTab(tabId: number): Promise<TabInfo> {
	assertTabIsControllable(tabId, "switch to tab");
	const tab = (await chrome.tabs.update(tabId, { active: true })) as BrowserTab;
	if (!tab) {
		throw new Error(`Tab ${tabId} was not found`);
	}

	await pageController.attachToTab(tabId);
	await rememberControlledTab(tabId);
	emitEvent("tab_changed", {
		tabId: activeControlledTabId,
		reason: "switched",
	});
	return toTabInfo(tab);
}

export async function listTabs(): Promise<TabInfo[]> {
	const tabs = (await chrome.tabs.query({
		currentWindow: true,
	})) as BrowserTab[];
	return tabs.filter((tab) => typeof tab.id === "number").map(toTabInfo);
}

export async function getTabState(tabId: number): Promise<TabInfo> {
	const tab = (await chrome.tabs.get(tabId)) as BrowserTab;
	return toTabInfo(tab);
}

async function routeToPageController(
	command: TomCommand,
	tabId: number,
): Promise<unknown> {
	await pageController.attachToTab(tabId);
	return pageController.executeToolCall(command, tabId);
}

async function executeCommand(command: TomCommand): Promise<TomResponse> {
	try {
		switch (command.tool) {
			case "open_tab": {
				const url = command.args.url;
				if (typeof url !== "string" || url.trim() === "") {
					throw new Error("open_tab requires args.url as a non-empty string");
				}

				return createSuccessResponse(command.requestId, await openTab(url));
			}

			case "close_tab": {
				const tabId = getTabIdArgument(command);
				if (tabId === null) {
					throw new Error("close_tab requires args.tabId as a number");
				}

				await closeTab(tabId);
				return createSuccessResponse(command.requestId, {
					closed: true,
					tabId,
				});
			}

			case "switch_tab": {
				const tabId = getTabIdArgument(command);
				if (tabId === null) {
					throw new Error("switch_tab requires args.tabId as a number");
				}

				return createSuccessResponse(command.requestId, await switchTab(tabId));
			}

			case "list_tabs":
				return createSuccessResponse(command.requestId, await listTabs());

			case "get_tab_state": {
				const tabId = getTabIdArgument(command) ?? activeControlledTabId;
				if (tabId === null) {
					throw new Error("get_tab_state requires args.tabId as a number");
				}

				return createSuccessResponse(
					command.requestId,
					await getTabState(tabId),
				);
			}

			default: {
				const targetTabId = resolveTargetTabId(command);
				if (targetTabId === null) {
					throw new Error(`No target tab available for tool ${command.tool}`);
				}

				if (!READ_ONLY_TOOLS.has(command.tool)) {
					assertTabIsControllable(targetTabId, `run ${command.tool}`);
				}

				return createSuccessResponse(
					command.requestId,
					await routeToPageController(command, targetTabId),
				);
			}
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown command error";
		emitEvent("error", { requestId: command.requestId, message });
		return createErrorResponse(command.requestId, message);
	}
}

chrome.runtime.onConnectExternal.addListener((port: RuntimePort) => {
	if (!isExternalSenderAllowed(port.sender)) {
		port.disconnect();
		return;
	}

	tomPort = port;
	if (typeof port.sender?.tab?.id === "number") {
		tomTabId = port.sender.tab.id;
		void saveState({ tomTabId });
	}

	emitEvent("connected", {
		tabId: tomTabId,
		controlledTabId: activeControlledTabId,
		origin: getSenderOrigin(port.sender),
	});

	port.onMessage.addListener((message: unknown) => {
		if (!isTomCommand(message)) {
			port.postMessage(
				createErrorResponse("unknown", "Invalid message: expected TomCommand"),
			);
			return;
		}

		void executeCommand(message).then((response) => {
			port.postMessage(response);
		});
	});

	port.onDisconnect.addListener(() => {
		if (tomPort === port) {
			tomPort = null;
		}
	});
});

chrome.runtime.onMessageExternal.addListener(
	(
		message: unknown,
		sender: MessageSender,
		sendResponse: (response: TomResponse) => void,
	) => {
		if (!isExternalSenderAllowed(sender)) {
			sendResponse(
				createErrorResponse("unknown", "Sender origin is not allowed"),
			);
			return false;
		}

		if (!isTomCommand(message)) {
			sendResponse(
				createErrorResponse("unknown", "Invalid message: expected TomCommand"),
			);
			return false;
		}

		void executeCommand(message)
			.then((response) => {
				sendResponse(response);
			})
			.catch((error: unknown) => {
				const messageText =
					error instanceof Error ? error.message : "Unknown execution failure";
				sendResponse(createErrorResponse(message.requestId, messageText));
			});

		return true;
	},
);

chrome.runtime.onConnect.addListener((port: RuntimePort) => {
	port.onMessage.addListener((message: unknown) => {
		if (!isTomCommand(message)) {
			port.postMessage(
				createErrorResponse("unknown", "Invalid internal command message"),
			);
			return;
		}

		void executeCommand(message).then((response) => {
			port.postMessage(response);
		});
	});

	port.onDisconnect.addListener(() => {
		if (tomPort === port) {
			tomPort = null;
		}
	});
});

chrome.tabs.onRemoved.addListener((tabId: number) => {
	if (controlledTabIds.has(tabId)) {
		void forgetControlledTab(tabId).then(() => {
			emitEvent("tab_changed", {
				tabId: activeControlledTabId,
				reason: "removed",
			});
		});
	}

	if (tabId === tomTabId) {
		tomTabId = null;
	}

	void pageController.onTabClosed?.(tabId);
});

chrome.tabs.onUpdated.addListener(
	(tabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => {
		if (tabId === activeControlledTabId && changeInfo.url) {
			emitEvent("tab_changed", {
				tabId,
				reason: "navigated",
				url: changeInfo.url,
			});
		}

		if (tabId !== activeControlledTabId) {
			return;
		}

		void pageController.onTabUpdated?.(tabId, changeInfo, tab);
	},
);
