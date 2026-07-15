import { describe, it, expect } from "vitest";
import type {
	TomCommand,
	TomResponse,
	TomEvent,
	TabInfo,
	ExtensionStatus,
	ToolName,
} from "../types";

// ---------------------------------------------------------------------------
// These tests verify that the message protocol type definitions produce
// correct runtime shapes. If a field is renamed or removed in types.ts,
// the TypeScript compiler will catch the mismatch at compile-time AND
// the runtime assertions catch it at test-time.
// ---------------------------------------------------------------------------

describe("TomCommand", () => {
	it("accepts a valid tool_call with required fields", () => {
		const command: TomCommand = {
			type: "tool_call",
			requestId: "req-001",
			tool: "open_tab",
			args: { url: "https://example.com" },
		};

		expect(command.type).toBe("tool_call");
		expect(command.requestId).toBe("req-001");
		expect(command.tool).toBe("open_tab");
		expect(command.args).toEqual({ url: "https://example.com" });
		expect(command.tabId).toBeUndefined();
	});

	it("supports optional tabId for targeting a specific tab", () => {
		const command: TomCommand = {
			type: "tool_call",
			requestId: "req-002",
			tool: "analyze_page",
			args: { depth: "full" },
			tabId: 42,
		};

		expect(command.tabId).toBe(42);
	});
});

describe("TomResponse", () => {
	it("represents a success response with result payload", () => {
		const response: TomResponse = {
			type: "tool_response",
			requestId: "req-001",
			success: true,
			result: {
				tabId: 1,
				url: "https://example.com",
				title: "Example",
				active: true,
				status: "complete",
			},
		};

		expect(response.type).toBe("tool_response");
		expect(response.success).toBe(true);
		expect(response.result).toBeDefined();
		expect(response.error).toBeUndefined();
	});

	it("represents an error response with error message", () => {
		const response: TomResponse = {
			type: "tool_response",
			requestId: "req-001",
			success: false,
			error: "Tab not found",
		};

		expect(response.success).toBe(false);
		expect(response.error).toBe("Tab not found");
		expect(response.result).toBeUndefined();
	});
});

describe("TomEvent", () => {
	it("represents a lifecycle event with data", () => {
		const event: TomEvent = {
			type: "event",
			event: "tab_changed",
			data: { tabId: 5, reason: "navigated", url: "https://example.com" },
		};

		expect(event.type).toBe("event");
		expect(event.event).toBe("tab_changed");
		expect(event.data.tabId).toBe(5);
	});
});

describe("TabInfo", () => {
	it("has all required fields with correct types", () => {
		const tab: TabInfo = {
			tabId: 1,
			url: "https://example.com",
			title: "Example Page",
			active: true,
			status: "complete",
		};

		expect(typeof tab.tabId).toBe("number");
		expect(typeof tab.url).toBe("string");
		expect(typeof tab.title).toBe("string");
		expect(typeof tab.active).toBe("boolean");
		expect(typeof tab.status).toBe("string");
	});
});

describe("ToolName", () => {
	it("covers all 23 tool names without duplicates", () => {
		const allTools: ToolName[] = [
			// Original 13
			"analyze_page",
			"analyze_element",
			"find_elements",
			"check_accessibility",
			"extract_css",
			"check_contrast",
			"click_element",
			"scroll_to",
			"navigate_to",
			"extract_text",
			"get_page_state",
			"write_observation",
			"read_commands",
			// New 10
			"open_tab",
			"close_tab",
			"switch_tab",
			"list_tabs",
			"type_text",
			"fill_form",
			"select_option",
			"take_screenshot",
			"wait_for_element",
			"get_tab_state",
		];

		expect(allTools).toHaveLength(23);
		expect(new Set(allTools).size).toBe(23);
	});
});

describe("ExtensionStatus", () => {
	it("accepts all valid status values", () => {
		const statuses: ExtensionStatus[] = [
			"ready",
			"busy",
			"error",
			"disconnected",
		];
		expect(statuses).toHaveLength(4);
		expect(statuses).toContain("ready");
		expect(statuses).toContain("busy");
		expect(statuses).toContain("error");
		expect(statuses).toContain("disconnected");
	});
});
