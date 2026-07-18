import { describe, expect, it } from "vitest";
import { KNOWLEDGE_BASE, retrieveDocs } from "../knowledgeBase";

describe("KNOWLEDGE_BASE", () => {
	it("loads markdown docs from knowledge/docs at build time", () => {
		expect(KNOWLEDGE_BASE.length).toBeGreaterThan(0);
	});

	it("parses each doc with id, title, content, tags, and productArea", () => {
		for (const doc of KNOWLEDGE_BASE) {
			expect(typeof doc.id).toBe("string");
			expect(doc.id.length).toBeGreaterThan(0);
			expect(typeof doc.title).toBe("string");
			expect(doc.content.length).toBeGreaterThan(0);
			expect(Array.isArray(doc.tags)).toBe(true);
			expect(typeof doc.productArea).toBe("string");
		}
	});

	it("filters out empty docs", () => {
		for (const doc of KNOWLEDGE_BASE) {
			expect(doc.content.length).toBeGreaterThan(0);
		}
	});
});

describe("retrieveDocs", () => {
	it("returns at most 3 results", () => {
		const results = retrieveDocs("workplace rights employment");
		expect(results.length).toBeLessThanOrEqual(3);
	});

	it("returns empty array for gibberish query", () => {
		const results = retrieveDocs("xyzzyqwerty blarghflorp");
		expect(results).toEqual([]);
	});

	it("ignores terms with 3 or fewer characters", () => {
		// Single short word that cannot match anything meaningful
		const results = retrieveDocs("a an the");
		expect(results).toEqual([]);
	});

	it("prioritizes a document containing the exact phrase", () => {
		const results = retrieveDocs("minimum wage");

		expect(results.length).toBeGreaterThan(0);
		expect(`${results[0].title} ${results[0].content}`.toLowerCase()).toContain(
			"minimum wage",
		);
	});

	it("returns relevant docs for a real query", () => {
		const results = retrieveDocs("overtime pay");
		expect(results.length).toBeGreaterThan(0);
		// The top result should contain the query terms
		const top = results[0];
		const combined = `${top.title} ${top.content}`.toLowerCase();
		expect(combined.includes("overtime") || combined.includes("pay")).toBe(
			true,
		);
	});
});
