const ACCESS_TOKEN_KEY = "ragbot.access-token";

function readAccessToken(): string {
	try {
		return sessionStorage.getItem(ACCESS_TOKEN_KEY) || "";
	} catch {
		return "";
	}
}

function storeAccessToken(token: string) {
	try {
		sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
	} catch {
		// Session storage can be unavailable in strict privacy modes. The current request still proceeds.
	}
}

async function post(
	path: string,
	body: unknown,
	token = readAccessToken(),
): Promise<Response> {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (token) headers.authorization = `Bearer ${token}`;
	return fetch(path, {
		method: "POST",
		credentials: "same-origin",
		headers,
		body: JSON.stringify(body),
	});
}

export async function requestApi<T>(path: string, body: unknown): Promise<T> {
	let response = await post(path, body);
	if (response.status === 401) {
		const supplied =
			window
				.prompt("Enter the RAGBOT access token for this browser session:")
				?.trim() || "";
		if (!supplied) throw new Error("Application authorization is required.");
		response = await post(path, body, supplied);
		if (response.ok) storeAccessToken(supplied);
	}
	const payload = (await response.json().catch(() => ({}))) as T & {
		error?: string;
	};
	if (!response.ok)
		throw new Error(
			payload.error || `Request failed with status ${response.status}.`,
		);
	return payload;
}

export function requestGemini<T>(
	action: string,
	payload: Record<string, unknown>,
): Promise<T> {
	return requestApi<T>("/api/gemini", { action, ...payload });
}

export function requestLiveToken(systemInstruction: string, voice: string) {
	return requestApi<{ token: string; model: string }>("/api/live-token", {
		systemInstruction,
		voice,
	});
}
