import crypto from "node:crypto";
import { Entity, type EntityItem } from "electrodb";
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
			threadId: {
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
			replyToMessageId: {
				type: "string",
			},
			// Event is for room metadata(?)
			// could be people leaving and joining
			type: {
				type: ["llm", "user", "event"] as const,
				required: true,
			},
			action: {
				type: ["message", "joinRoom", "leaveRoom"] as const,
				required: true,
			},
			metadata: {
				type: "map",
				properties: {
					responseDetails: {
						type: "map",
						properties: {
							tokenUsage: {
								type: "map",
								properties: {
									promptTokens: {
										type: "number",
									},
									completionTokens: {
										type: "number",
									},
									totalTokens: {
										type: "number",
									},
								},
							},
							finishReason: {
								// type LanguageModelV1FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
								type: "string",
							},
							steps: {
								type: "number",
							},
						},
						required: true,
					},
					responseSteps: {
						type: "list",
						items: {
							type: "map",
							properties: {
								type: {
									// type: "initial" | "tool-result" | "continue" | "final";
									type: "string",
								},
								content: {
									type: "string",
								},
							},
						},
						required: true,
					},
				},
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
				readOnly: true,
			},
			updatedAt: {
				type: "number",
				watch: "*",
				default: () => Date.now(),
				set: () => Date.now(),
				readOnly: true,
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
			byThread: {
				index: "gsi3",
				pk: {
					field: "gsi3pk",
					composite: ["threadId"],
				},
				sk: {
					field: "gsi3sk",
					composite: ["createdAt"],
				},
			},
		},
	},
	dynamoConfig,
);

export type MessageEntityType = EntityItem<typeof MessageEntity>;
