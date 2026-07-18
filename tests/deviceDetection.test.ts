import { describe, expect, it, vi } from "vitest";
import {
	isIOS,
	isMobile,
	isStandalone,
	isScreenSharingSupported,
	isCameraSupported,
	getPermissionStatus,
} from "../lib/deviceDetection";

describe("isIOS", () => {
	it("returns true for iPhone user agent", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
			platform: "iPhone",
			maxTouchPoints: 5,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isIOS()).toBe(true);
	});

	it("returns true for iPad user agent", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
			platform: "iPad",
			maxTouchPoints: 5,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isIOS()).toBe(true);
	});

	it("returns false for desktop Chrome user agent", () => {
		vi.stubGlobal("navigator", {
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isIOS()).toBe(false);
	});
});

describe("isMobile", () => {
	it("returns true for Android user agent", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
			platform: "Linux armv8l",
			maxTouchPoints: 5,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isMobile()).toBe(true);
	});

	it("returns false for desktop user agent", () => {
		vi.stubGlobal("navigator", {
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isMobile()).toBe(false);
	});
});

describe("isStandalone", () => {
	it("returns false in a normal browser (not PWA)", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		// jsdom default: standalone is undefined, matchMedia returns matches:false
		expect(isStandalone()).toBe(false);
	});
});

describe("isScreenSharingSupported", () => {
	it("returns false on iOS even if getDisplayMedia exists", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
			platform: "iPhone",
			maxTouchPoints: 5,
			mediaDevices: {
				getDisplayMedia: () => {},
				getUserMedia: () => {},
			},
			permissions: { query: vi.fn() },
		});
		expect(isScreenSharingSupported()).toBe(false);
	});

	it("returns true on desktop when getDisplayMedia is available", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: {
				getDisplayMedia: () => {},
				getUserMedia: () => {},
			},
			permissions: { query: vi.fn() },
		});
		expect(isScreenSharingSupported()).toBe(true);
	});

	it("returns false when mediaDevices is undefined", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isScreenSharingSupported()).toBe(false);
	});
});

describe("isCameraSupported", () => {
	it("returns true when getUserMedia is available", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: {
				getUserMedia: () => {},
			},
			permissions: { query: vi.fn() },
		});
		expect(isCameraSupported()).toBe(true);
	});

	it("returns false when mediaDevices is undefined", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: { query: vi.fn() },
		});
		expect(isCameraSupported()).toBe(false);
	});
});

describe("getPermissionStatus", () => {
	it("returns null when permissions.query throws", async () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: {
				query: vi.fn().mockRejectedValue(new Error("not supported")),
			},
		});
		const result = await getPermissionStatus("microphone" as PermissionName);
		expect(result).toBeNull();
	});

	it("returns the state when permissions.query succeeds", async () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0",
			platform: "MacIntel",
			maxTouchPoints: 0,
			mediaDevices: undefined,
			permissions: {
				query: vi.fn().mockResolvedValue({ state: "granted" }),
			},
		});
		const result = await getPermissionStatus("microphone" as PermissionName);
		expect(result).toBe("granted");
	});
});
