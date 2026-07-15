import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const configuredSecrets = [
	process.env.GEMINI_API_KEY,
	process.env.GOOGLE_API_KEY,
].filter(Boolean);
const forbiddenMarkers = [
	"process.env.API_KEY",
	"process.env.GEMINI_API_KEY",
	"AIzaSy",
];

async function filesUnder(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesUnder(path)));
		else if (/\.(?:html|js|css|map)$/.test(entry.name)) files.push(path);
	}
	return files;
}

const files = await filesUnder(dist);
for (const file of files) {
	const content = await readFile(file, "utf8");
	for (const marker of [...forbiddenMarkers, ...configuredSecrets]) {
		if (marker && content.includes(marker))
			throw new Error(
				`Client bundle contains forbidden secret marker in ${file}`,
			);
	}
}
console.log(`Client bundle secret scan passed (${files.length} files).`);
