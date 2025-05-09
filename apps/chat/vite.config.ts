import { URL, fileURLToPath } from "node:url";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => ["BotIcon", "FileIcon"].includes(tag),
				},
			},
		}),
		tailwindcss(),
		vueDevTools(),
		VitePWA({
			// mode: "development",
			base: "/",
			injectRegister: "auto",
			strategies: "injectManifest",
			registerType: "prompt",
			srcDir: "src/sw",
			filename: "service-worker.ts",
			injectManifest: {
				minify: false,
				// enableWorkboxModulesLogs: true,
				// maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
			},
			includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.png"],
			manifest: {
				name: "Pearl",
				short_name: "Pearl",
				description: "Pearl, your life assistant",
				theme_color: "#4a4a4a",
				background_color: "#4a4a4a",
				display: "standalone",
				orientation: "portrait",
				start_url: "/",
				icons: [
					{
						src: "pwa-192x192.webp",
						sizes: "192x192",
						type: "image/webp",
					},
					{
						src: "pwa-512x512.webp",
						sizes: "512x512",
						type: "image/webp",
						purpose: "any maskable",
					},
					{
						src: "/pwa-icon-monochrome-192x192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "monochrome",
					},
				],
			},
			devOptions: {
				enabled: true,
				type: "module",
				navigateFallback: "/index.html",
				suppressWarnings: true,
			},
		}),
		sentryVitePlugin({
			org: "michael-eduave",
			project: "pearl-chat",
			sourcemaps: {
				filesToDeleteAfterUpload: [
					"index-*.js.map",
					"chunk-*.js.map",
					"vendor-*.js.map",
					"service-worker.js.map",
				],
			},
		}),
	],

	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	build: {
		sourcemap: "hidden",
	},
});
