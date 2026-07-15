import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./src/__tests__/mocks/chrome.ts"],
		include: ["src/__tests__/**/*.test.ts"],
	},
});
