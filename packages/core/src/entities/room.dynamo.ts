import { Entity, type Schema } from "electrodb";
import { dynamoConfig } from "../electro";

const MAX_ROOM_NAME_LENGTH = 200;

// Query patterns for Room
// 1. Get all rooms for a userId - high occurrence
// 2. Search room name? - medium (direct for psql, dynamodb can use index for name)
// 3. Update room name - very low (requires multi record update)
// 4. Add/Remove member to the room - low DYNAMO (add/remove record)
export const RoomEntity = new Entity(
	{
		model: {
			entity: "room",
			version: "1",
			service: "hugin",
		},
		attributes: {
			roomId: {
				type: "string",
				required: true,
				readOnly: true,
			},
			userId: {
				type: "string",
				required: true,
				readOnly: true,
			},
			user: {
				type: "map",
				properties: {
					firstName: {
						type: "string",
					},
					lastName: {
						type: "string",
					},
					avatar: {
						type: "string",
					},
				},
				required: true,
			},
			name: {
				type: "string",
				validate: (name) => !name || name.length <= MAX_ROOM_NAME_LENGTH,
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
				readOnly: true,
			},
			type: {
				type: ["group", "dm"],
			},
			updatedAt: {
				type: "number",
				watch: ["name"],
				set: () => Date.now(),
			},
			// Room metadata? users leaving and joining
			// I think it wont reach the limit, the amount of people that join/leave
			// tend to be few, >100 instances are too few
			// We can even call it a message so the ordering
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["roomId"],
				},
				sk: {
					field: "sk",
					composite: ["userId"],
				},
			},
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
		},
	},
	dynamoConfig,
);
