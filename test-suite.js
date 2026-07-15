// RAGBOT Vision Agent - Full Test Suite
// Open /test-harness.html in the local Vite server, then paste this into DevTools.

(async function runFullTestSuite() {
	console.log("RAGBOT Vision Agent - Full Test Suite");

	const results = {};
	const timing = {};

	async function test(name, tool, args) {
		console.log(`Running: ${name}`);
		const start = performance.now();
		try {
			const result = await window.runTool(tool, args);
			const elapsed = Math.round(performance.now() - start);
			timing[name] = elapsed;
			results[name] = result;
			console.log(`PASS ${name} (${elapsed}ms)`, result);
			return { success: true, result, elapsed };
		} catch (error) {
			const elapsed = Math.round(performance.now() - start);
			const message = error instanceof Error ? error.message : String(error);
			timing[name] = elapsed;
			results[name] = { error: message };
			console.error(`FAIL ${name} (${elapsed}ms): ${message}`);
			return { success: false, error: message, elapsed };
		}
	}

	await test("get_page_state", "get_page_state", {});
	await test("analyze_page", "analyze_page", {
		include_css: true,
		include_accessibility: true,
	});
	await test("find_elements_submit", "find_elements", {
		query: "Submit",
		limit: 10,
	});
	await test("find_elements_nav", "find_elements", {
		query: "Home",
		limit: 10,
	});
	await test("check_accessibility", "check_accessibility", { level: "AA" });
	await test("check_contrast", "check_contrast", {});
	await test("analyze_element_form", "analyze_element", {
		selector: "#test-form",
	});
	await test("extract_css", "extract_css", { selector: "#test-form" });
	await test("extract_text", "extract_text", { selector: "nav" });
	await test("scroll_to_bottom", "scroll_to", { target: "bottom" });
	await new Promise((resolve) => setTimeout(resolve, 500));
	await test("scroll_to_top", "scroll_to", { target: "top" });
	await test("write_observation", "write_observation", {
		summary: "Full test suite completed",
	});
	await test("read_commands", "read_commands", {});

	const passed = Object.values(results).filter(
		(result) => !result.error,
	).length;
	const failed = Object.values(results).filter((result) => result.error).length;
	const totalTime = Object.values(timing).reduce(
		(total, milliseconds) => total + milliseconds,
		0,
	);

	console.log("TEST SUMMARY", { passed, failed, totalTime, timing });
	window.TEST_RESULTS = {
		results,
		timing,
		summary: { passed, failed, totalTime },
	};
	return window.TEST_RESULTS;
})();
