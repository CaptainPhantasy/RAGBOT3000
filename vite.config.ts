import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 3000,
		host: "0.0.0.0",
		proxy: {
			"/api": "http://127.0.0.1:3001",
			"/health": "http://127.0.0.1:3001",
		},
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, "index.html"),
				"test-harness": path.resolve(__dirname, "test-harness.html"),
			},
			output: {
				assetFileNames: (assetInfo) => {
					if (assetInfo.name?.endsWith(".worklet.js")) {
						return "audio/[name][extname]";
					}
					return "assets/[name]-[hash][extname]";
				},
			},
		},
	},
});
