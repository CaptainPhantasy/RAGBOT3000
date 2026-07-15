import type { TabInfo, TomCommand, TomResponse } from './types';
import { initKeepalive } from './keepalive';

declare const chrome: any;

type PageControllerLike = {
  executeToolCall?: (command: TomCommand, tabId: number) => Promise<unknown>;
  handleCommand?: (command: TomCommand, tabId: number) => Promise<unknown>;
  onTabClosed?: (tabId: number) => Promise<void> | void;
  onTabUpdated?: (tabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => Promise<void> | void;
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

const PAGE_CONTROLLER_IMPORT_PATH = './pageController';

const ALLOWED_ORIGINS = new Set([
  'https://ragbot3000gsev1beta-vision-agent.up.railway.app',
  'http://localhost:3000',
]);

const RAILWAY_WILDCARD_ORIGIN = /^[a-z]+:\/\/([a-z0-9-]+\.)+up\.railway\.app$/i;

const LOCALHOST_ANY_PORT = /^https?:\/\/localhost(:\d+)?$/i;

const READ_ONLY_TOOLS = new Set([
  'analyze_page',
  'analyze_element',
  'find_elements',
  'check_accessibility',
  'extract_css',
  'check_contrast',
  'extract_text',
  'get_page_state',
  'list_tabs',
  'get_tab_state',
  'read_commands',
]);

let tomTabId: number | null = null;
let activeControlledTabId: number | null = null;
let tomPort: RuntimePort | null = null;
let pageController: PageControllerLike | null = null;
let pageControllerInitPromise: Promise<PageControllerLike | null> | null = null;

// Initialize service worker keepalive and recover persisted state
void initKeepalive().then((state) => {
  if (state.tomTabId !== null) {
    tomTabId = state.tomTabId;
  }
  if (state.controlledTabs.length > 0) {
    activeControlledTabId = state.controlledTabs[0];
  }
});

async function ensurePageController(): Promise<PageControllerLike | null> {
  if (pageController) {
    return pageController;
  }

  if (!pageControllerInitPromise) {
    pageControllerInitPromise = import(PAGE_CONTROLLER_IMPORT_PATH)
      .then((module: unknown) => {
        const pageControllerModule = module as { PageController?: new () => PageControllerLike };
        if (!pageControllerModule.PageController) {
          return null;
        }

        pageController = new pageControllerModule.PageController();
        return pageController;
      })
      .catch(() => null)
      .finally(() => {
        pageControllerInitPromise = null;
      });
  }

  return pageControllerInitPromise;
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

  return ALLOWED_ORIGINS.has(origin) || RAILWAY_WILDCARD_ORIGIN.test(origin) || LOCALHOST_ANY_PORT.test(origin);
}

function isExternalSenderAllowed(sender: MessageSender | undefined): boolean {
  return isAllowedOrigin(getSenderOrigin(sender));
}

function toTabInfo(tab: BrowserTab): TabInfo {
  return {
    tabId: tab.id ?? -1,
    url: tab.url ?? '',
    title: tab.title ?? '',
    active: Boolean(tab.active),
    status: tab.status ?? 'unknown',
  };
}

function createErrorResponse(requestId: string, error: string): TomResponse {
  return {
    type: 'tool_response',
    requestId,
    success: false,
    error,
  };
}

function createSuccessResponse(requestId: string, result: unknown): TomResponse {
  return {
    type: 'tool_response',
    requestId,
    success: true,
    result,
  };
}

function isTomCommand(value: unknown): value is TomCommand {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeCommand = value as Partial<TomCommand>;
  return (
    maybeCommand.type === 'tool_call' &&
    typeof maybeCommand.requestId === 'string' &&
    typeof maybeCommand.tool === 'string' &&
    typeof maybeCommand.args === 'object' &&
    maybeCommand.args !== null
  );
}

function emitEvent(event: 'connected' | 'disconnected' | 'tab_changed' | 'error', data?: unknown): void {
  if (!tomPort) {
    return;
  }

  tomPort.postMessage({ type: 'event', event, data });
}

function assertTabIsControllable(tabId: number, actionName: string): void {
  if (tomTabId !== null && tabId === tomTabId) {
    throw new Error(`Refused to ${actionName}: Tom's app tab is protected`);
  }
}

function resolveTargetTabId(command: TomCommand): number | null {
  if (typeof command.tabId === 'number') {
    return command.tabId;
  }

  return activeControlledTabId;
}

export async function openTab(url: string): Promise<TabInfo> {
  const tab = (await chrome.tabs.create({ url, active: true })) as BrowserTab;
  if (!tab.id) {
    throw new Error('Chrome did not return a tab ID for the new tab');
  }

  activeControlledTabId = tab.id;
  emitEvent('tab_changed', { tabId: activeControlledTabId, reason: 'opened' });
  return toTabInfo(tab);
}

export async function closeTab(tabId: number): Promise<void> {
  assertTabIsControllable(tabId, 'close tab');
  await chrome.tabs.remove(tabId);

  if (activeControlledTabId === tabId) {
    activeControlledTabId = null;
    emitEvent('tab_changed', { tabId: null, reason: 'closed' });
  }
}

export async function switchTab(tabId: number): Promise<TabInfo> {
  assertTabIsControllable(tabId, 'switch to tab');
  const tab = (await chrome.tabs.update(tabId, { active: true })) as BrowserTab;
  if (!tab) {
    throw new Error(`Tab ${tabId} was not found`);
  }

  activeControlledTabId = tabId;
  emitEvent('tab_changed', { tabId: activeControlledTabId, reason: 'switched' });
  return toTabInfo(tab);
}

export async function listTabs(): Promise<TabInfo[]> {
  const tabs = (await chrome.tabs.query({ currentWindow: true })) as BrowserTab[];
  return tabs.filter((tab) => typeof tab.id === 'number').map(toTabInfo);
}

export async function getTabState(tabId: number): Promise<TabInfo> {
  const tab = (await chrome.tabs.get(tabId)) as BrowserTab;
  return toTabInfo(tab);
}

async function routeToPageController(command: TomCommand, tabId: number): Promise<unknown> {
  const controller = await ensurePageController();
  if (!controller) {
    throw new Error('PageController is not available yet');
  }

  if (typeof controller.executeToolCall === 'function') {
    return controller.executeToolCall(command, tabId);
  }

  if (typeof controller.handleCommand === 'function') {
    return controller.handleCommand(command, tabId);
  }

  throw new Error('PageController is missing a tool execution method');
}

async function executeCommand(command: TomCommand): Promise<TomResponse> {
  try {
    switch (command.tool) {
      case 'open_tab': {
        const url = command.args.url;
        if (typeof url !== 'string' || url.trim() === '') {
          throw new Error('open_tab requires args.url as a non-empty string');
        }

        return createSuccessResponse(command.requestId, await openTab(url));
      }

      case 'close_tab': {
        const tabId = command.args.tabId;
        if (typeof tabId !== 'number') {
          throw new Error('close_tab requires args.tabId as a number');
        }

        await closeTab(tabId);
        return createSuccessResponse(command.requestId, { closed: true, tabId });
      }

      case 'switch_tab': {
        const tabId = command.args.tabId;
        if (typeof tabId !== 'number') {
          throw new Error('switch_tab requires args.tabId as a number');
        }

        return createSuccessResponse(command.requestId, await switchTab(tabId));
      }

      case 'list_tabs':
        return createSuccessResponse(command.requestId, await listTabs());

      case 'get_tab_state': {
        const tabId = command.args.tabId;
        if (typeof tabId !== 'number') {
          throw new Error('get_tab_state requires args.tabId as a number');
        }

        return createSuccessResponse(command.requestId, await getTabState(tabId));
      }

      default: {
        const targetTabId = resolveTargetTabId(command);
        if (targetTabId === null) {
          throw new Error(`No target tab available for tool ${command.tool}`);
        }

        if (!READ_ONLY_TOOLS.has(command.tool)) {
          assertTabIsControllable(targetTabId, `run ${command.tool}`);
        }

        return createSuccessResponse(command.requestId, await routeToPageController(command, targetTabId));
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown command error';
    emitEvent('error', { requestId: command.requestId, message });
    return createErrorResponse(command.requestId, message);
  }
}

chrome.runtime.onConnectExternal.addListener((port: RuntimePort) => {
  if (!isExternalSenderAllowed(port.sender)) {
    port.disconnect();
    return;
  }

  tomPort = port;
  if (typeof port.sender?.tab?.id === 'number') {
    tomTabId = port.sender.tab.id;
  }

  emitEvent('connected', {
    tabId: tomTabId,
    controlledTabId: activeControlledTabId,
    origin: getSenderOrigin(port.sender),
  });

  port.onMessage.addListener((message: unknown) => {
    if (!isTomCommand(message)) {
      port.postMessage(createErrorResponse('unknown', 'Invalid message: expected TomCommand'));
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

chrome.runtime.onMessageExternal.addListener((message: unknown, sender: MessageSender, sendResponse: (response: TomResponse) => void) => {
  if (!isExternalSenderAllowed(sender)) {
    sendResponse(createErrorResponse('unknown', 'Sender origin is not allowed'));
    return false;
  }

  if (!isTomCommand(message)) {
    sendResponse(createErrorResponse('unknown', 'Invalid message: expected TomCommand'));
    return false;
  }

  void executeCommand(message)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : 'Unknown execution failure';
      sendResponse(createErrorResponse(message.requestId, messageText));
    });

  return true;
});

chrome.runtime.onConnect.addListener((port: RuntimePort) => {
  port.onMessage.addListener((message: unknown) => {
    if (!isTomCommand(message)) {
      port.postMessage(createErrorResponse('unknown', 'Invalid internal command message'));
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
  if (tabId === activeControlledTabId) {
    activeControlledTabId = null;
    emitEvent('tab_changed', { tabId: null, reason: 'removed' });
  }

  if (tabId === tomTabId) {
    tomTabId = null;
  }

  void ensurePageController().then((controller) => {
    void controller?.onTabClosed?.(tabId);
  });
});

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) => {
  if (tabId === activeControlledTabId && changeInfo.url) {
    emitEvent('tab_changed', {
      tabId,
      reason: 'navigated',
      url: changeInfo.url,
    });
  }

  if (tabId !== activeControlledTabId) {
    return;
  }

  void ensurePageController().then((controller) => {
    void controller?.onTabUpdated?.(tabId, changeInfo, tab);
  });
});
