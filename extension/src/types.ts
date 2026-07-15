/**
 * Shared TypeScript type definitions for the command/response message protocol
 * between Tom's app and the Chrome Extension.
 *
 * This is the source of truth for all message types.
 * A copy is maintained in services/extensionBridge.types.ts for Tom's app.
 */

/**
 * All available tool names (13 existing + 10 new)
 */
export type ToolName =
	// Existing 13 tools
	| "analyze_page"
	| "analyze_element"
	| "find_elements"
	| "check_accessibility"
	| "extract_css"
	| "check_contrast"
	| "click_element"
	| "scroll_to"
	| "navigate_to"
	| "extract_text"
	| "get_page_state"
	| "write_observation"
	| "read_commands"
	// New 10 tools
	| "open_tab"
	| "close_tab"
	| "switch_tab"
	| "list_tabs"
	| "type_text"
	| "fill_form"
	| "select_option"
	| "take_screenshot"
	| "wait_for_element"
	| "get_tab_state";

/**
 * Command sent from Tom's app to the extension
 */
export interface TomCommand {
	type: "tool_call";
	requestId: string;
	tool: ToolName;
	args: Record<string, any>;
	tabId?: number;
}

/**
 * Response sent from the extension back to Tom's app
 */
export interface TomResponse {
	type: "tool_response";
	requestId: string;
	success: boolean;
	result?: any;
	error?: string;
}

/**
 * Event sent from the extension to Tom's app
 */
export interface TomEvent {
	type: "event";
	event: "connected" | "disconnected" | "tab_changed" | "error";
	data?: any;
}

/**
 * Information about a browser tab
 */
export interface TabInfo {
	tabId: number;
	url: string;
	title: string;
	active: boolean;
	status: string;
}

/**
 * Current status of the extension
 */
export type ExtensionStatus = "ready" | "busy" | "error" | "disconnected";
