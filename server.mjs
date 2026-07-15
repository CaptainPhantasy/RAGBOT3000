import {
	createReadStream,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GoogleGenAI, Modality, Type } from "@google/genai";

const DEFAULT_PORT = 3000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_BRIDGE_BODY_BYTES = 1024 * 1024;
const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const RATE_WINDOW_MS = 60_000;

const MIME_TYPES = new Map([
	[".css", "text/css; charset=utf-8"],
	[".gif", "image/gif"],
	[".html", "text/html; charset=utf-8"],
	[".ico", "image/x-icon"],
	[".jpeg", "image/jpeg"],
	[".jpg", "image/jpeg"],
	[".js", "text/javascript; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".png", "image/png"],
	[".svg", "image/svg+xml"],
	[".webmanifest", "application/manifest+json"],
	[".woff2", "font/woff2"],
]);

const ANALYZE_INTENT_SCHEMA = {
	type: Type.OBJECT,
	properties: {
		intent: { type: Type.STRING },
		goal: { type: Type.STRING },
		constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
		mode: { type: Type.STRING, enum: ["Teach", "Guide", "Rescue"] },
		missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
		steps: { type: Type.ARRAY, items: { type: Type.STRING } },
		prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
		verifications: { type: Type.ARRAY, items: { type: Type.STRING } },
		diagnosticQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
		possibleCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
	},
	required: ["intent", "goal", "constraints", "mode"],
};

const MEMORY_PATCH_SCHEMA = {
	type: Type.OBJECT,
	properties: {
		should_write: { type: Type.BOOLEAN },
		topic: { type: Type.STRING },
		status: { type: Type.STRING, enum: ["active", "paused", "completed"] },
		goal: { type: Type.STRING },
		last_completed_step: { type: Type.STRING },
		current_step: { type: Type.STRING },
		next_actions: { type: Type.ARRAY, items: { type: Type.STRING } },
		blockers: { type: Type.ARRAY, items: { type: Type.STRING } },
		key_decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
		environment: { type: Type.ARRAY, items: { type: Type.STRING } },
		verification: { type: Type.STRING },
	},
	required: ["should_write", "topic", "status"],
};

function json(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, {
		"cache-control": "no-store",
		"content-length": Buffer.byteLength(body),
		"content-type": "application/json; charset=utf-8",
	});
	res.end(body);
}

function readJson(req, maximumBytes = MAX_BODY_BYTES) {
	return new Promise((resolveBody, reject) => {
		let size = 0;
		const chunks = [];
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > maximumBytes) {
				reject(
					Object.assign(new Error("Request body is too large."), {
						statusCode: 413,
					}),
				);
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				const parsed = JSON.parse(
					Buffer.concat(chunks).toString("utf8") || "{}",
				);
				resolveBody(parsed);
			} catch {
				reject(
					Object.assign(new Error("Request body must be valid JSON."), {
						statusCode: 400,
					}),
				);
			}
		});
		req.on("error", reject);
	});
}

function safeEqual(left, right) {
	const a = Buffer.from(left);
	const b = Buffer.from(right);
	return a.length === b.length && timingSafeEqual(a, b);
}

function requireString(value, label, maximum) {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > maximum
	) {
		throw Object.assign(new Error(`${label} is invalid.`), { statusCode: 400 });
	}
	return value;
}

function validateParts(parts) {
	if (!Array.isArray(parts) || parts.length === 0 || parts.length > 4) {
		throw Object.assign(
			new Error("parts must contain between one and four entries."),
			{ statusCode: 400 },
		);
	}
	return parts.map((part) => {
		if (part && typeof part.text === "string") {
			return { text: requireString(part.text, "part.text", 200_000) };
		}
		const inline = part?.inlineData;
		const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
		if (
			!inline ||
			!allowedTypes.has(inline.mimeType) ||
			typeof inline.data !== "string" ||
			inline.data.length > 9_000_000
		) {
			throw Object.assign(new Error("inlineData is invalid."), {
				statusCode: 400,
			});
		}
		return { inlineData: { mimeType: inline.mimeType, data: inline.data } };
	});
}

function clientAddress(req) {
	return String(
		req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
	)
		.split(",")[0]
		.trim();
}

function isLoopback(address) {
	return (
		address === "127.0.0.1" ||
		address === "::1" ||
		address === "::ffff:127.0.0.1"
	);
}

function buildAllowedOrigins(env) {
	const values = new Set(
		String(env.ALLOWED_ORIGINS || "")
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean),
	);
	if (env.RAILWAY_PUBLIC_DOMAIN)
		values.add(`https://${env.RAILWAY_PUBLIC_DOMAIN}`);
	return values;
}

function requestOriginAllowed(req, allowedOrigins, localDevelopment) {
	const origin = req.headers.origin;
	if (!origin) return true;
	const forwardedProtocol = String(req.headers["x-forwarded-proto"] || "http")
		.split(",")[0]
		.trim();
	const host = req.headers.host;
	if (host && origin === `${forwardedProtocol}://${host}`) return true;
	if (allowedOrigins.has(origin)) return true;
	if (
		localDevelopment &&
		/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
	)
		return true;
	return false;
}

function setSecurityHeaders(res) {
	res.setHeader(
		"content-security-policy",
		"default-src 'self'; base-uri 'self'; connect-src 'self' https://generativelanguage.googleapis.com https://*.googleapis.com wss://generativelanguage.googleapis.com wss://*.googleapis.com; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; media-src 'self' blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
	);
	res.setHeader(
		"permissions-policy",
		"camera=(self), microphone=(self), display-capture=(self), geolocation=()",
	);
	res.setHeader("referrer-policy", "no-referrer");
	res.setHeader("x-content-type-options", "nosniff");
	res.setHeader("x-frame-options", "DENY");
}

function makeRateLimiter() {
	const buckets = new Map();
	return (key, limit) => {
		const now = Date.now();
		const current = buckets.get(key);
		if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
			buckets.set(key, { count: 1, startedAt: now });
			return true;
		}
		current.count += 1;
		return current.count <= limit;
	};
}

function createGeminiClients(apiKey) {
	if (!apiKey) return null;
	return {
		models: new GoogleGenAI({ apiKey }),
		tokens: new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } }),
	};
}

async function runGeminiAction(client, body) {
	switch (body.action) {
		case "analyzeIntent": {
			const prompt = requireString(body.prompt, "prompt", 200_000);
			const response = await client.models.generateContent({
				model: "gemini-3-flash-preview",
				contents: prompt,
				config: {
					responseMimeType: "application/json",
					tools: [{ googleSearch: {} }],
					responseSchema: ANALYZE_INTENT_SCHEMA,
				},
			});
			return { text: response.text || "{}" };
		}
		case "teammate": {
			const response = await client.models.generateContent({
				model: "gemini-3-pro-preview",
				contents: [{ role: "user", parts: validateParts(body.parts) }],
				config: { thinkingConfig: { thinkingBudget: 32_768 } },
			});
			return { text: response.text || "" };
		}
		case "speech": {
			const text = requireString(body.text, "text", 20_000);
			const voice = requireString(body.voice, "voice", 64);
			if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(voice)) {
				throw Object.assign(new Error("voice is invalid."), {
					statusCode: 400,
				});
			}
			const response = await client.models.generateContent({
				model: "gemini-2.5-flash-preview-tts",
				contents: [{ parts: [{ text }] }],
				config: {
					responseModalities: [Modality.AUDIO],
					speechConfig: {
						voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
					},
				},
			});
			return {
				audio:
					response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
					null,
			};
		}
		case "memoryPatch": {
			const prompt = requireString(body.prompt, "prompt", 200_000);
			const response = await client.models.generateContent({
				model: "gemini-2.5-flash",
				contents: prompt,
				config: {
					responseMimeType: "application/json",
					responseSchema: MEMORY_PATCH_SCHEMA,
				},
			});
			return { text: response.text || "{}" };
		}
		default:
			throw Object.assign(new Error("Unsupported Gemini action."), {
				statusCode: 400,
			});
	}
}

export function createAppServer(options = {}) {
	const env = options.env || process.env;
	const distDirectory = resolve(
		options.distDirectory || join(process.cwd(), "dist"),
	);
	const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || "";
	const accessToken = env.APP_ACCESS_TOKEN || "";
	const production =
		env.NODE_ENV === "production" || Boolean(env.RAILWAY_ENVIRONMENT);
	const localDevelopment = !production && env.ALLOW_INSECURE_LOCAL_DEV === "1";
	const allowedOrigins = buildAllowedOrigins(env);
	const clients = createGeminiClients(apiKey);
	const rateLimit = makeRateLimiter();
	const bridgeDirectory = resolve(env.RAGBOT_BRIDGE_DIR || process.cwd());
	const observationsFile = join(bridgeDirectory, "RAGBOT_OBSERVATIONS.md");
	const commandsFile = join(bridgeDirectory, "RAGBOT_COMMANDS.md");

	return createServer(async (req, res) => {
		setSecurityHeaders(res);
		const url = new URL(req.url || "/", "http://localhost");

		if (url.pathname === "/health") {
			return json(res, 200, {
				ok: true,
				apiConfigured: Boolean(clients),
				accessControlConfigured: Boolean(accessToken) || localDevelopment,
			});
		}

		if (
			url.pathname === "/api/commands" ||
			url.pathname === "/api/observations"
		) {
			const address = clientAddress(req);
			if (!localDevelopment || !isLoopback(address)) {
				return json(res, 404, { error: "API route not found." });
			}
			if (!requestOriginAllowed(req, allowedOrigins, localDevelopment)) {
				return json(res, 403, { error: "Origin is not allowed." });
			}
			if (req.method === "GET") {
				const file =
					url.pathname === "/api/commands" ? commandsFile : observationsFile;
				return json(res, 200, {
					content: existsSync(file) ? readFileSync(file, "utf8") : "",
				});
			}
			if (url.pathname !== "/api/observations" || req.method !== "POST") {
				return json(res, 405, { error: "Method not allowed." });
			}
			try {
				const body = await readJson(req, MAX_BRIDGE_BODY_BYTES);
				if (typeof body.content !== "string") {
					return json(res, 400, { error: "content must be a string." });
				}
				mkdirSync(bridgeDirectory, { recursive: true });
				writeFileSync(observationsFile, body.content, "utf8");
				return json(res, 200, { written: true });
			} catch (error) {
				return json(res, Number(error?.statusCode) || 400, {
					error: error.message || "Invalid request.",
				});
			}
		}

		if (url.pathname.startsWith("/api/")) {
			if (req.method !== "POST")
				return json(res, 405, { error: "Method not allowed." });
			if (!requestOriginAllowed(req, allowedOrigins, localDevelopment)) {
				return json(res, 403, { error: "Origin is not allowed." });
			}
			const address = clientAddress(req);
			if (!accessToken && !(localDevelopment && isLoopback(address))) {
				return json(res, 503, {
					error: "Server access control is not configured.",
				});
			}
			if (accessToken) {
				const authorization = String(req.headers.authorization || "");
				const supplied = authorization.startsWith("Bearer ")
					? authorization.slice(7)
					: "";
				if (!safeEqual(supplied, accessToken))
					return json(res, 401, { error: "Authorization required." });
			}
			if (!clients)
				return json(res, 503, {
					error: "Gemini is not configured on the server.",
				});

			const limit = url.pathname === "/api/live-token" ? 10 : 30;
			if (!rateLimit(`${address}:${url.pathname}`, limit)) {
				return json(res, 429, { error: "Rate limit exceeded." });
			}

			try {
				const body = await readJson(req);
				if (url.pathname === "/api/gemini") {
					return json(res, 200, await runGeminiAction(clients.models, body));
				}
				if (url.pathname === "/api/live-token") {
					const systemInstruction = requireString(
						body.systemInstruction,
						"systemInstruction",
						100_000,
					);
					const voice = requireString(body.voice, "voice", 64);
					if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(voice)) {
						throw Object.assign(new Error("voice is invalid."), {
							statusCode: 400,
						});
					}
					const now = Date.now();
					const token = await clients.tokens.authTokens.create({
						config: {
							uses: 1,
							newSessionExpireTime: new Date(now + 60_000).toISOString(),
							expireTime: new Date(now + 20 * 60_000).toISOString(),
							liveConnectConstraints: {
								model: LIVE_MODEL,
								config: {
									responseModalities: [Modality.AUDIO],
									speechConfig: {
										voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
									},
									systemInstruction,
								},
							},
							lockAdditionalFields: [],
						},
					});
					return json(res, 200, { token: token.name, model: LIVE_MODEL });
				}
				return json(res, 404, { error: "API route not found." });
			} catch (error) {
				const status = Number(error?.statusCode) || 502;
				if (status >= 500) console.error("API request failed:", error);
				return json(res, status, {
					error: status >= 500 ? "Upstream request failed." : error.message,
				});
			}
		}

		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405).end();
			return;
		}
		let requestedPath;
		try {
			requestedPath = decodeURIComponent(url.pathname);
		} catch {
			res.writeHead(400).end();
			return;
		}
		const normalizedPath = normalize(requestedPath).replace(/^([/\\])+/, "");
		let filePath = resolve(distDirectory, normalizedPath || "index.html");
		if (
			!filePath.startsWith(`${distDirectory}/`) &&
			filePath !== distDirectory
		) {
			res.writeHead(403).end();
			return;
		}
		if (!existsSync(filePath) || !statSync(filePath).isFile())
			filePath = join(distDirectory, "index.html");
		if (!existsSync(filePath)) {
			res
				.writeHead(503, { "content-type": "text/plain; charset=utf-8" })
				.end("Application build is unavailable.");
			return;
		}
		const stats = statSync(filePath);
		const cacheControl = filePath.includes("/assets/")
			? "public, max-age=31536000, immutable"
			: "no-cache";
		res.writeHead(200, {
			"cache-control": cacheControl,
			"content-length": stats.size,
			"content-type":
				MIME_TYPES.get(extname(filePath).toLowerCase()) ||
				"application/octet-stream",
		});
		if (req.method === "HEAD") res.end();
		else createReadStream(filePath).pipe(res);
	});
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
	const server = createAppServer();
	server.listen(port, "0.0.0.0", () =>
		console.log(`RAGBOT listening on ${port}`),
	);
}
