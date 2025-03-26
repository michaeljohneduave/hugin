import crypto from "node:crypto";
import { Entity } from "electrodb";
import { dynamoConfig } from "../electro";

// Quick note: I'm not sure what happened,
// but when I refactored and moved the instantiation of new Entity
// and replaced this with a schema (just the first parameter for new Entity)
// the types suddenly broke, ts server can't see the attributes
// export const MessageSchema: Schema<string, string, string> = {} (the culprit)
export const MessageEntity = new Entity(
	{
		model: {
			entity: "message",
			version: "1",
			service: "hugin",
		},
		attributes: {
			messageId: {
				type: "string",
				default: () => crypto.randomUUID(),
				readOnly: true,
			},
			userId: {
				type: "string",
				required: true,
				readOnly: true,
			},
			roomId: {
				type: "string",
				required: true,
				readOnly: true,
			},
			message: {
				type: "string",
			},
			videoFiles: {
				type: "list",
				items: {
					type: "string",
				},
			},
			audioFiles: {
				type: "list",
				items: {
					type: "string",
				},
			},
			imageFiles: {
				type: "list",
				items: {
					type: "string",
				},
			},
			mentions: {
				type: "list",
				items: {
					type: "string",
				},
			},
			// Event is for room metadata(?)
			// could be people leaving and joining
			type: {
				type: ["llm", "user", "event"],
				required: true,
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
			},
			updatedAt: {
				type: "number",
				watch: "*",
				default: () => Date.now(),
				set: () => Date.now(),
			},
			deletedAt: {
				type: "number",
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["messageId"],
				},
				sk: {
					field: "sk",
					composite: ["createdAt"],
				},
			},
			// byUser can enable a message keyword search functionality
			byUser: {
				collection: "rooms",
				index: "gsi1",
				pk: {
					field: "gsi1pk",
					composite: ["userId"],
				},
				sk: {
					field: "gsi1sk",
					composite: ["createdAt"],
				},
			},
			byRoom: {
				index: "gsi2",
				pk: {
					field: "gsi2pk",
					composite: ["roomId"],
				},
				sk: {
					field: "gsi2sk",
					composite: ["createdAt"],
				},
			},
		},
	},
	dynamoConfig,
);
