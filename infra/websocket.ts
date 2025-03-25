import { MessageTable, Valkey } from "./database";
import { domain } from "./dns";
import { vpc } from "./network";
import { CLERK_SECRET_KEY } from "./secrets";

export const websocketApi = new sst.aws.ApiGatewayWebSocket("WebsocketApi", {
	domain:
		$app.stage === "prod"
			? {
					name: `hugin-ws.${domain}`,
					dns: sst.cloudflare.dns({}),
				}
			: null,
});

websocketApi.route("$connect", {
	vpc,
	link: [websocketApi, Valkey, MessageTable, CLERK_SECRET_KEY],
	handler: "packages/functions/src/websocket.connect",
	transform: {
		function: {
			memorySize: 256,
		},
	},
});

websocketApi.route("$disconnect", {
	vpc,
	link: [websocketApi, Valkey, MessageTable, CLERK_SECRET_KEY],
	handler: "packages/functions/src/websocket.disconnect",
	transform: {
		function: {
			memorySize: 128,
		},
	},
});

websocketApi.route("$default", {
	vpc,
	link: [websocketApi, Valkey, MessageTable, CLERK_SECRET_KEY],
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
