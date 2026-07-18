import { describe, it, expect } from "vitest";
import {
	getGreeting,
	getTTSVoice,
	getLiveVoice,
} from "../services/geminiService";

describe("getGreeting", () => {
	it("returns the initial greeting string", () => {
		const greeting = getGreeting("initial");
		expect(typeof greeting).toBe("string");
		expect(greeting.length).toBeGreaterThan(0);
		expect(greeting).toContain("Tom the Peep");
	});

	it("returns the liveStart greeting string", () => {
		const greeting = getGreeting("liveStart");
		expect(typeof greeting).toBe("string");
		expect(greeting).toContain("listening");
	});

	it("returns the liveEnd greeting string", () => {
		const greeting = getGreeting("liveEnd");
		expect(typeof greeting).toBe("string");
		expect(greeting).toContain("Ending live session");
	});
});

describe("getTTSVoice", () => {
	it("returns a non-empty voice name", () => {
		const voice = getTTSVoice();
		expect(typeof voice).toBe("string");
		expect(voice.length).toBeGreaterThan(0);
	});
});

describe("getLiveVoice", () => {
	it("returns a non-empty voice name", () => {
		const voice = getLiveVoice();
		expect(typeof voice).toBe("string");
		expect(voice.length).toBeGreaterThan(0);
	});
});
