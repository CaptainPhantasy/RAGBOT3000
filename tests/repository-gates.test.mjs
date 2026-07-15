import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the browser never receives a long-lived Gemini key", async () => {
	const viteConfig = await read("vite.config.ts");
	const geminiService = await read("services/geminiService.ts");
	const liveService = await read("services/liveService.ts");
	assert.doesNotMatch(viteConfig, /GEMINI_API_KEY|process\.env\.API_KEY/);
	assert.doesNotMatch(geminiService, /new GoogleGenAI|process\.env\.API_KEY/);
	assert.doesNotMatch(liveService, /process\.env\.API_KEY/);
	assert.match(liveService, /requestLiveToken/);
});

test("Live video obeys the one-frame-per-second provider contract", async () => {
	const liveService = await read("services/liveService.ts");
	assert.match(liveService, /\}, 1000\);/);
	assert.match(liveService, /videoFramePending/);
});

test("deployment and lint gates are deterministic and non-mutating", async () => {
	const packageJson = JSON.parse(await read("package.json"));
	assert.equal(packageJson.scripts.start, "node server.mjs");
	assert.match(packageJson.scripts.check, /typecheck/);
	assert.match(packageJson.scripts.check, /audit:prod/);
	assert.doesNotMatch(packageJson.scripts.lint, /--(?:write|fix)/);
	assert.doesNotMatch(packageJson.scripts["format:check"] || "", /--write/);
	const railway = await read("railway.json");
	assert.match(railway, /npm ci --include=dev/);
});

test("ephemeral live tokens are single-use and server-authenticated", async () => {
	const server = await read("server.mjs");
	assert.match(server, /uses: 1/);
	assert.match(server, /APP_ACCESS_TOKEN/);
	assert.match(server, /timingSafeEqual/);
	assert.match(server, /Rate limit exceeded/);
});
