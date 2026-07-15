import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAppServer } from "../server.mjs";

async function withServer(env, run) {
	const server = createAppServer({ env, distDirectory: tmpdir() });
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		const address = server.address();
		await run(`http://127.0.0.1:${address.port}`);
	} finally {
		await new Promise((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
}

test("local bridge reads commands and persists observations", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ragbot-bridge-"));
	try {
		await writeFile(
			join(directory, "RAGBOT_COMMANDS.md"),
			"inspect the form",
			"utf8",
		);
		await withServer(
			{ ALLOW_INSECURE_LOCAL_DEV: "1", RAGBOT_BRIDGE_DIR: directory },
			async (origin) => {
				const commands = await fetch(`${origin}/api/commands`).then(
					(response) => response.json(),
				);
				assert.equal(commands.content, "inspect the form");
				const response = await fetch(`${origin}/api/observations`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ content: "verified observation" }),
				});
				assert.equal(response.status, 200);
			},
		);
		assert.equal(
			await readFile(join(directory, "RAGBOT_OBSERVATIONS.md"), "utf8"),
			"verified observation",
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("filesystem bridge is absent in production", async () => {
	await withServer({ NODE_ENV: "production" }, async (origin) => {
		const response = await fetch(`${origin}/api/commands`);
		assert.equal(response.status, 404);
	});
});
