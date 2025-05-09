/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: "hugin-bot",
			removal: input?.stage === "prod" ? "retain" : "remove",
			// protect: ["prod"].includes(input?.stage),
			home: "aws",
			providers: {
				aws: {
					profile: "alt_account",
				},
				aiven: {
					apiToken: process.env.AIVEN_TOKEN,
					version: "6.35.0",
				},
				cloudflare: {
					apiToken: process.env.CLOUDFLARE_API_TOKEN,
				},
			},
		};
	},
	async run() {
		// // credits: https://github.com/terminaldotshop/terminal/blob/a43019af732f4359a59b5e251e11fefaf3d3198d/sst.config.ts#L52
		// const outputs = {};
		// for (const value of readdirSync("./infra/")) {
		// 	const result = await import(`./infra/${value}`);
		// 	if (result.outputs) Object.assign(outputs, result.outputs);
		// }
		const dns = await import("./infra/dns");
		const api = await import("./infra/api");
		const database = await import("./infra/database");
		await import("./infra/local");
		const { clerkPublishableKey, firebaseConfig } = await import(
			"./infra/config"
		);
		const chatSite = new sst.aws.StaticSite("ChatSite", {
			path: "apps/chat",
			assets: {
				fileOptions: [
					{
						files: ["service-worker.js", "index.html"],
						cacheControl: "no-cache",
					},
					{
						files: "**/*",
						cacheControl: "max-age=31536000, immutable",
					},
				],
				purge: true,
			},
			indexPage: "/",
			build: {
				command: "npm run build",
				output: "dist",
			},
			domain:
				$app.stage === "prod"
					? {
							name: `chat.${dns.domain}`,
							dns: sst.cloudflare.dns({}),
						}
					: null,
			environment: {
				VITE_API_URL: $interpolate`${api.api.url}`,
				VITE_WEBSOCKET_API_URL: api.websocketApi.url,
				VITE_CLERK_PUBLISHABLE_KEY: clerkPublishableKey.properties.key,
				VITE_FIREBASE_CONFIG: JSON.stringify(firebaseConfig.properties),
				VITE_FIREBASE_VAPID_KEY: firebaseConfig.properties.vapidPublicKey,
			},
			dev: {
				url: "http://localhost:5173",
			},
		});

		return {
			ApiUrl: api.api.url,
			WsUrl: api.websocketApi.url,
			Chat: chatSite.url,
			DynamoDb: database.MessageTable.name,
		};
	},
});
