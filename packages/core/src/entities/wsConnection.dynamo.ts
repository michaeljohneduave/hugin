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

// This manages the ws connections of a user
export const WsConnectionEntity = new Entity(
	{
		model: {
			entity: "wsConnections",
			version: "1",
			service: "hugin",
		},
		attributes: {
			userId: {
				type: "string",
				required: true,
			},
			connectionId: {
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
		},
	},
	dynamoConfig,
);

// This manages the rooms of a user via their connectionIds (multi devices, multi browser)
export const WsRoomsEntity = new Entity(
	{
		model: {
			entity: "wsRooms",
			version: "1",
			service: "hugin",
		},
		attributes: {
			roomId: {
				type: "string",
				required: true,
			},
			connectionId: {
				type: "string",
				required: true,
			},
			expireAt: {
				type: "number",
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["roomId"],
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
					composite: ["roomId"],
				},
			},
		},
	},
	dynamoConfig,
);
