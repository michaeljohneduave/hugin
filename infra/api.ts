import { clerkPublicKey } from "./config";
import { MessageTable, Postgres } from "./database";
import { domain } from "./dns";
import { puppeteerFn } from "./puppeteer";
import {
	BRAVE_API_KEY,
	CLERK_SECRET_KEY,
	CLERK_WEBHOOK_SECRET,
	FIREBASE_CLIENT_EMAIL,
	FIREBASE_PRIVATE_KEY,
	FIREBASE_PROJECT_ID,
	GIPHY_API_KEY,
	GOOGLE_GENERATIVE_AI_API_KEY,
	POSTGRES_CONN_URI,
	VAPID_PRIVATE_KEY,
} from "./secrets";

export const websocketApi = new sst.aws.ApiGatewayWebSocket("WebsocketApi", {
	domain:
		$app.stage === "prod"
			? {
					name: `hugin-ws.${domain}`,
					dns: sst.cloudflare.dns({}),
				}
			: null,
});

export const api = new sst.aws.ApiGatewayV2("Api", {
	domain:
		$app.stage === "prod"
			? {
					name: `hugin-api.${domain}`,
					dns: sst.cloudflare.dns({}),
				}
			: null,
	cors: {
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: [
			"content-type",
			"authorization",
			"x-trpc-source",
			"x-requested-with",
		],
		allowOrigins: ["http://localhost:5173", "https://chat.meduave.com"],
		allowCredentials: true,
	},
});

api.route("GET /trpc/{proxy+}", {
	transform: {
		function: {
			memorySize: 1024,
			architectures: ["arm64"],
			tracingConfig: {
				mode: "Active",
			},
		},
	},
	timeout: "300 seconds",
	handler: "packages/functions/src/trpc.api.handler",
	link: [
		MessageTable,
		CLERK_SECRET_KEY,
		GIPHY_API_KEY,
		VAPID_PRIVATE_KEY,
		FIREBASE_CLIENT_EMAIL,
		FIREBASE_PROJECT_ID,
		FIREBASE_PRIVATE_KEY,
		GOOGLE_GENERATIVE_AI_API_KEY,
		POSTGRES_CONN_URI,
		websocketApi,
		puppeteerFn,
		clerkPublicKey,
	],
});

api.route("POST /trpc/{proxy+}", {
	transform: {
		function: {
			memorySize: 1024,
			architectures: ["arm64"],
			tracingConfig: {
				mode: "Active",
			},
		},
	},
	timeout: "300 seconds",
	handler: "packages/functions/src/trpc.api.handler",
	link: [
		MessageTable,
		CLERK_SECRET_KEY,
		GIPHY_API_KEY,
		VAPID_PRIVATE_KEY,
		FIREBASE_CLIENT_EMAIL,
		FIREBASE_PROJECT_ID,
		FIREBASE_PRIVATE_KEY,
		GOOGLE_GENERATIVE_AI_API_KEY,
		POSTGRES_CONN_URI,
		websocketApi,
		puppeteerFn,
		clerkPublicKey,
	],
});

api.route("POST /webhooks/clerk", {
	handler: "packages/functions/src/webhooks.clerk",
	link: [CLERK_WEBHOOK_SECRET, MessageTable],
	transform: {
		function: {
			tracingConfig: {
				mode: "Active",
			},
		},
	},
});

export const scraperFn = new sst.aws.Function("ScraperFn", {
	handler: "packages/functions/src/llm.scrapeCompanyUrl",
	link: [
		Postgres,
		POSTGRES_CONN_URI,
		GOOGLE_GENERATIVE_AI_API_KEY,
		puppeteerFn,
	],
	transform: {
		function: {
			memorySize: 256,
			architectures: ["arm64"],
			tracingConfig: {
				mode: "Active",
			},
		},
	},
});

const wsFnLinks = [
	Postgres,
	POSTGRES_CONN_URI,
	GOOGLE_GENERATIVE_AI_API_KEY,
	websocketApi,
	MessageTable,
	CLERK_SECRET_KEY,
	clerkPublicKey,
	puppeteerFn,
	BRAVE_API_KEY,
];

websocketApi.route("$connect", {
	link: wsFnLinks,
	handler: "packages/functions/src/websocket.connect",
	transform: {
		function: {
			memorySize: 256,
			architectures: ["arm64"],
			tracingConfig: {
				mode: "Active",
			},
		},
	},
});

websocketApi.route("$disconnect", {
	link: wsFnLinks,
	handler: "packages/functions/src/websocket.disconnect",
	transform: {
		function: {
			memorySize: 128,
			architectures: ["arm64"],
			tracingConfig: {
				mode: "Active",
			},
		},
	},
});

websocketApi.route("$default", {
	link: wsFnLinks,
	handler: "packages/functions/src/websocket.$default",
	transform: {
		function: {
			memorySize: 256,
			architectures: ["arm64"],
			tracingConfig: {
				mode: "Active",
			},
		},
	},
	// TODOS: This is temp, we will decouple the ws message handler for agent requests
	// 30s is the max timeout for ws api gateway, we just give more time to the actual lambda
	timeout: "300 seconds",
	permissions: [
		{
			actions: ["execute-api:ManageConnections"],
			effect: "allow",
			resources: ["arn:aws:execute-api:*:*:*"],
		},
	],
});

export const agentResponseFn = new sst.aws.Function("AgentResponseFn", {
	handler: "packages/functions/src/websocket.agentResponse",
	link: [MessageTable, websocketApi],
	transform: {
		function: {
			tracingConfig: {
				mode: "Active",
			},
		},
	},
	permissions: [
		{
			actions: ["execute-api:ManageConnections"],
			effect: "allow",
			resources: ["arn:aws:execute-api:*:*:*"],
		},
	],
});
