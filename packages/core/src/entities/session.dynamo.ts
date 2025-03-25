import { Entity } from "electrodb";
import { dynamoConfig } from "../electro";

const ROOM_RECORD_EXPIRY = 1000 * 3600 * 24 * 7; // 1 Day

export const SessionEntity = new Entity(
	{
		model: {
			entity: "session",
			version: "1",
			service: "hugin",
		},
		attributes: {
			connectionId: {
				type: "string",
				required: true,
				readOnly: true,
			},
			userId: {
				type: "string",
				required: true,
				readOnly: true,
			},
			rooms: {
				type: "list",
				items: {
					type: "string",
				},
				required: true,
			},
			expireAt: {
				type: "number",
				default: () => Date.now() + ROOM_RECORD_EXPIRY,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["connectionId"],
				},
				sk: {
					field: "sk",
					composite: [],
				},
			},
			byUser: {
				index: "gsi1",
				pk: {
					field: "gsi1pk",
					composite: ["userId"],
				},
				sk: {
					field: "gsi1sk",
					composite: [],
				},
			},
		},
	},
	dynamoConfig,
);
