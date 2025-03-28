import { vapidPublicKey } from "./config";
import { MessageTable, Postgres, Valkey } from "./database";
import { domain } from "./dns";
import { vpc } from "./network";
import { task } from "./puppeteer";
import {
	CLERK_SECRET_KEY,
	GIPHY_API_KEY,
	GOOGLE_GENERATIVE_AI_API_KEY,
	POSTGRES_CONN_URI,
	VAPID_PRIVATE_KEY,
} from "./secrets";

export const api = new sst.aws.ApiGatewayV2("Api", {
	vpc,
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
	vpc,
	handler: "packages/functions/src/trpc.api.handler",
	link: [
		MessageTable,
		CLERK_SECRET_KEY,
		GIPHY_API_KEY,
		vapidPublicKey,
		VAPID_PRIVATE_KEY,
		Valkey,
	],
});

api.route("POST /trpc/{proxy+}", {
	vpc,
	handler: "packages/functions/src/trpc.api.handler",
	link: [
		MessageTable,
		CLERK_SECRET_KEY,
		GIPHY_API_KEY,
		vapidPublicKey,
		VAPID_PRIVATE_KEY,
		Valkey,
	],
});

export const scraperFn = new sst.aws.Function("ScraperFn", {
	handler: "packages/functions/src/llm.scrapeCompanyUrl",
	link: [task, Postgres, POSTGRES_CONN_URI, GOOGLE_GENERATIVE_AI_API_KEY],
});

export const websocketApi = new sst.aws.ApiGatewayWebSocket("WebsocketApi", {
	domain:
		$app.stage === "prod"
			? {
					name: `hugin-ws.${domain}`,
					dns: sst.cloudflare.dns({}),
				}
			: null,
});

const wsFnLinks = [
	task,
	Postgres,
	POSTGRES_CONN_URI,
	GOOGLE_GENERATIVE_AI_API_KEY,
	websocketApi,
	Valkey,
	MessageTable,
	CLERK_SECRET_KEY,
];

websocketApi.route("$connect", {
	vpc,
	link: wsFnLinks,
	handler: "packages/functions/src/websocket.connect",
	transform: {
		function: {
			memorySize: 256,
		},
	},
});

websocketApi.route("$disconnect", {
	vpc,
	link: wsFnLinks,
	handler: "packages/functions/src/websocket.disconnect",
	transform: {
		function: {
			memorySize: 128,
		},
	},
});

websocketApi.route("$default", {
	vpc,
	link: wsFnLinks,
	handler: "packages/functions/src/websocket.$default",
	transform: {
		function: {
			memorySize: 256,
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
