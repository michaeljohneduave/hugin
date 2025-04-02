import { Entity, type EntityItem } from "electrodb";
import { dynamoConfig } from "../electro";

export const PnSubscriptionEntity = new Entity(
	{
		model: {
			entity: "PnSubscription",
			version: "1",
			service: "hugin-bot",
		},
		attributes: {
			userId: {
				type: "string",
				required: true,
			},
			token: {
				type: "string",
				required: true,
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
			},
			expireAt: {
				type: "number",
				default: () => Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
			},
		},
		indexes: {
			primary: {
				pk: { field: "pk", composite: ["userId"] },
				sk: { field: "sk", composite: ["token"] },
			},
			byToken: {
				index: "gsi1",
				pk: { field: "gsi1pk", composite: ["token"] },
				sk: { field: "gsi1sk", composite: ["userId"] },
			},
		},
	},
	dynamoConfig,
);

export type PnSubscriptionEntityType = EntityItem<typeof PnSubscriptionEntity>;
