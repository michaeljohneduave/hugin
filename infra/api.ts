import { MessageTable, Postgres } from "./database";
import { domain } from "./dns";
import { task } from "./puppeteer";
import {
	CLERK_SECRET_KEY,
	GIPHY_API_KEY,
	GOOGLE_GENERATIVE_AI_API_KEY,
	POSTGRES_CONN_URI,
} from "./secrets";

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
	handler: "packages/functions/src/trpc.api.handler",
	link: [MessageTable, CLERK_SECRET_KEY, GIPHY_API_KEY],
});

api.route("POST /trpc/{proxy+}", {
	handler: "packages/functions/src/trpc.api.handler",
	link: [MessageTable, CLERK_SECRET_KEY, GIPHY_API_KEY],
});

export const scraperFn = new sst.aws.Function("ScraperFn", {
	handler: "packages/functions/src/llm.scrapeCompanyUrl",
	link: [task, Postgres, POSTGRES_CONN_URI, GOOGLE_GENERATIVE_AI_API_KEY],
});

// export const trpcFn = new sst.aws.Function("TrpcFn", {
// 	handler: "packages/functions/src/api.handler",
// 	url: true,
// 	link: [MessageTable, CLERK_SECRET_KEY],
// });

// export const router = new sst.aws.Router("Router", {
// 	routes: {
// 		"/api/trpc/*": trpcFn.url,
// 		"/ws/*": websocketApi.url,
// 	},
// });
