import { URL, fileURLToPath } from "node:url";
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
			strategies: "injectManifest",
			injectManifest: {
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
			},
			srcDir: "src/sw",
			filename: "service-worker.js",
			registerType: "autoUpdate",
			devOptions: {
				enabled: true,
				type: "module",
			},
			includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.png"],
			manifest: {
				name: "Hugin Chat",
				short_name: "Hugin",
				description: "Hugin Chat Application",
				theme_color: "#ffffff",
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any maskable",
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
