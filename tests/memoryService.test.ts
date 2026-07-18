import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryManager, type MemoryPatch } from "../services/memoryService";

const TEST_USER = "test-user-1";

const requireValue = <T>(value: T | null | undefined): T => {
	if (value == null) throw new Error("Expected a value");
	return value;
};

const basePatch: MemoryPatch = {
	should_write: true,
	topic: "Reviewing Indiana workplace rights",
	status: "active",
	goal: "Complete workplace rights guidance review",
	current_step: "Reviewing overtime eligibility",
	last_completed_step: "Reviewed wage protections",
	next_actions: ["Check overtime eligibility", "Review leave protections"],
	blockers: [],
	key_decisions: ["Use official Indiana and federal sources"],
	environment: ["Indiana workplace rights knowledge base"],
	verification: "Guidance cites the applicable workplace protections",
};

beforeEach(() => {
	memoryManager.clearUserSessions(TEST_USER);
});

afterEach(() => {
	memoryManager.clearUserSessions(TEST_USER);
});

describe("upsertSession — create", () => {
	it("creates a new session when should_write is true", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		expect(session.topic).toBe(basePatch.topic);
		expect(session.status).toBe("active");
		expect(session.user_id).toBe(TEST_USER);
		expect(session.session_id).toContain(TEST_USER);
	});

	it("returns null when should_write is false", () => {
		const patch = { ...basePatch, should_write: false };
		const session = memoryManager.upsertSession(TEST_USER, patch);
		expect(session).toBeNull();
	});

	it("generates a slug-based session ID containing the topic slug", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		// generateSessionId truncates the slug to 30 chars
		expect(session.session_id).toContain("reviewing-indiana-workplace-r");
	});

	it("sets an expiration timestamp 72 hours in the future", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		const expiresAt = new Date(session.expires_at).getTime();
		const now = Date.now();
		const seventyTwoHours = 72 * 60 * 60 * 1000;
		expect(expiresAt - now).toBeGreaterThan(seventyTwoHours - 5 * 60 * 1000);
		expect(expiresAt - now).toBeLessThanOrEqual(
			seventyTwoHours + 5 * 60 * 1000,
		);
	});
});

describe("upsertSession — update existing", () => {
	it("updates an existing session by sessionId", () => {
		const created = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);

		const updatePatch: MemoryPatch = {
			should_write: true,
			topic: "Updated topic",
			status: "active",
			current_step: "New step",
			last_completed_step: "Previous step done",
		};
		const updated = memoryManager.upsertSession(
			TEST_USER,
			updatePatch,
			created.session_id,
		);
		const requiredUpdated = requireValue(updated);
		expect(requiredUpdated.session_id).toBe(created.session_id);
		expect(requiredUpdated.topic).toBe("Updated topic");
	});

	it("merges key_decisions without duplicates", () => {
		const created = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		const updatePatch: MemoryPatch = {
			should_write: true,
			topic: basePatch.topic,
			status: "active",
			key_decisions: [
				"Use official Indiana and federal sources",
				"Include federal protections",
			],
		};
		const updated = requireValue(
			memoryManager.upsertSession(TEST_USER, updatePatch, created.session_id),
		);
		expect(updated.key_decisions).toContain(
			"Use official Indiana and federal sources",
		);
		expect(updated.key_decisions).toContain("Include federal protections");
		expect(
			updated.key_decisions.filter(
				(decision) => decision === "Use official Indiana and federal sources",
			),
		).toHaveLength(1);
	});
});

describe("session lifecycle transitions", () => {
	it("marks session as paused", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		memoryManager.pauseSession(session.session_id);
		const loaded = requireValue(memoryManager.loadActiveSession(TEST_USER));
		expect(loaded.status).toBe("paused");
	});

	it("marks session as completed", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		memoryManager.completeSession(session.session_id);
		const sessions = memoryManager.getActiveSessions(TEST_USER);
		expect(
			sessions.find((s) => s.session_id === session.session_id),
		).toBeUndefined();
	});
});

describe("loadActiveSession", () => {
	it("returns null when no sessions exist", () => {
		const loaded = memoryManager.loadActiveSession(TEST_USER);
		expect(loaded).toBeNull();
	});

	it("returns an active session when one exists", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-14T10:00:00Z"));
		memoryManager.upsertSession(TEST_USER, {
			...basePatch,
			topic: "First task",
		});
		vi.setSystemTime(new Date("2026-07-14T11:00:00Z"));
		const second = requireValue(
			memoryManager.upsertSession(TEST_USER, {
				...basePatch,
				topic: "Second task",
			}),
		);
		const loaded = requireValue(memoryManager.loadActiveSession(TEST_USER));
		// Second was created later so should be most recent
		expect(loaded.session_id).toBe(second.session_id);
		vi.useRealTimers();
	});
});

describe("deleteSession", () => {
	it("removes a session by ID", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		memoryManager.deleteSession(session.session_id);
		const loaded = memoryManager.loadActiveSession(TEST_USER);
		expect(loaded).toBeNull();
	});
});

describe("clearUserSessions", () => {
	it("removes all sessions for a user", () => {
		memoryManager.upsertSession(TEST_USER, { ...basePatch, topic: "Task A" });
		memoryManager.upsertSession(TEST_USER, { ...basePatch, topic: "Task B" });
		memoryManager.clearUserSessions(TEST_USER);
		expect(memoryManager.getActiveSessions(TEST_USER)).toHaveLength(0);
	});
});

describe("exportToMarkdown", () => {
	it("returns null for a non-existent session", () => {
		const md = memoryManager.exportToMarkdown("does-not-exist");
		expect(md).toBeNull();
	});

	it("produces markdown with frontmatter and goal", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		const md = requireValue(memoryManager.exportToMarkdown(session.session_id));
		expect(md).toContain("---");
		expect(md).toContain(`session_id: "${session.session_id}"`);
		expect(md).toContain("# Goal");
		expect(md).toContain(basePatch.goal);
		expect(md).toContain("# Next Actions");
	});
});

describe("generateResumePrompt", () => {
	it("builds a prompt referencing the topic and current step", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, basePatch),
		);
		const prompt = memoryManager.generateResumePrompt(session);
		expect(prompt).toContain(basePatch.topic);
		expect(prompt).toContain(basePatch.last_completed_step);
		expect(prompt).toContain(basePatch.current_step);
	});

	it("includes blocker note when blockers exist", () => {
		const session = requireValue(
			memoryManager.upsertSession(TEST_USER, {
				...basePatch,
				blockers: ["API rate limit"],
			}),
		);
		const prompt = memoryManager.generateResumePrompt(session);
		expect(prompt).toContain("API rate limit");
	});
});
