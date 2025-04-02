import { Entity } from "electrodb";
import { dynamoConfig } from "../electro";

// Connect:
// Get all rooms and create a roomId + userId + connectionId + token record
// Join room:
// Add roomId + userId + connectionId + token record
// Send message:
// Get roomId
// Disconnect:
// Remove connectionId + token from the room/userId record

// Two sub-entities:
// - Room: roomId + userId
// - User: userId + connectionId + token

export const WsConnectionEntity = new Entity(
	{
		model: {
			entity: "wsConnections",
			version: "1",
			service: "hugin",
		},
		attributes: {
			roomId: {
				type: "string",
			},
			userId: {
				type: "string",
			},
			connectionId: {
				type: "string",
			},
			token: {
				type: "string",
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
			},
			expireAt: {
				type: "number",
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["userId"],
				},
				sk: {
					field: "sk",
					composite: ["connectionId"],
				},
			},

			byConnectionId: {
				index: "gsi1",
				pk: {
					field: "gsi1pk",
					composite: ["connectionId"],
				},
				sk: {
					field: "gsi1sk",
					composite: ["userId"],
				},
			},

			byRoomId: {
				index: "gsi2",
				pk: {
					field: "gsi2pk",
					composite: ["roomId"],
				},
				sk: {
					field: "gsi2sk",
					composite: ["userId"],
				},
			},
		},
	},
	dynamoConfig,
);
