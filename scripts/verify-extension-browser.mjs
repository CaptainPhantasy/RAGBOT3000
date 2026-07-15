import { mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireFromExtension = createRequire(
	resolve(root, "extension/package.json"),
);
const puppeteer = requireFromExtension("puppeteer-core");
function locateChromeForTesting() {
	const cache = resolve(homedir(), ".cache/puppeteer/chrome");
	if (!existsSync(cache)) return null;
	for (const directory of readdirSync(cache).sort().reverse()) {
		const candidate = resolve(
			cache,
			directory,
			"chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
		);
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

const chromeExecutable =
	process.env.CHROME_EXECUTABLE || locateChromeForTesting();
if (!chromeExecutable)
	throw new Error(
		"Set CHROME_EXECUTABLE to Chromium or Chrome for Testing; branded Chrome ignores unpacked-extension flags.",
	);
const baseUrl = process.env.RAGBOT_BASE_URL || "http://localhost:3000";
const extensionDirectory = resolve(root, "extension");
const screenshotPath = resolve(root, "artifacts/extension-browser-proof.png");

await mkdir(dirname(screenshotPath), { recursive: true });

const browser = await puppeteer.launch({
	executablePath: chromeExecutable,
	headless: false,
	defaultViewport: { width: 1440, height: 1000 },
	args: [
		`--disable-extensions-except=${extensionDirectory}`,
		`--load-extension=${extensionDirectory}`,
		"--no-first-run",
		"--no-default-browser-check",
		"--host-resolver-rules=MAP localhost [::1]",
	],
});

try {
	let workerTarget;
	try {
		workerTarget = await browser.waitForTarget(
			(target) =>
				target.type() === "service_worker" &&
				target.url().endsWith("/dist/background.js"),
			{ timeout: 20_000 },
		);
	} catch (error) {
		console.error(
			"Observed Chromium targets:",
			browser
				.targets()
				.map((target) => ({ type: target.type(), url: target.url() })),
		);
		throw error;
	}
	const page = await browser.newPage();
	await page.goto(`${baseUrl}/test-harness.html`, {
		waitUntil: "networkidle0",
	});
	await page.waitForSelector('meta[name="tom-extension-id"]', {
		timeout: 10_000,
	});
	const proof = await page.evaluate(() => window.runExtensionProof());
	const worker = await workerTarget.worker();
	if (!worker) throw new Error("Extension service worker was not inspectable");
	const persisted = await worker.evaluate(() =>
		chrome.storage.local.get(["tomTabId", "controlledTabs", "extensionStatus"]),
	);

	if (proof.extensionId !== new URL(workerTarget.url()).host)
		throw new Error(
			"Content bridge extension ID does not match the loaded worker",
		);
	if (
		!proof.analyzed?.success ||
		proof.analyzed.result?.title !== "RAGBOT Extension Proof Target"
	)
		throw new Error("analyze_page did not execute in the controlled tab");
	if (
		!proof.found?.success ||
		!proof.found.result?.results?.some((result) =>
			result.selector.includes("\\:"),
		)
	)
		throw new Error("find_elements did not return a CSS-escaped selector");
	if (!proof.state?.success || proof.state.result?.tabId !== proof.tabId)
		throw new Error("Active controlled tab state was not retained");
	if (
		!persisted.controlledTabs?.includes(proof.tabId) ||
		persisted.tomTabId == null
	)
		throw new Error("Controlled-tab state was not persisted");

	await page.screenshot({ path: screenshotPath, fullPage: true });
	console.log(
		JSON.stringify(
			{
				pass: true,
				extensionId: proof.extensionId,
				serviceWorker: workerTarget.url(),
				controlledTabId: proof.tabId,
				controlledPageTitle: proof.analyzed.result.title,
				escapedSelector: proof.found.result.results.find((result) =>
					result.selector.includes("\\:"),
				)?.selector,
				persisted,
				screenshotPath,
			},
			null,
			2,
		),
	);
} finally {
	await browser.close();
}
