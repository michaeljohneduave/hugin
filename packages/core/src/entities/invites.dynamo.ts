import { Entity, type EntityItem } from "electrodb";
import { dynamoConfig } from "../electro";

export const InvitesEntity = new Entity(
	{
		model: {
			entity: "invite",
			version: "1",
			service: "hugin",
		},
		attributes: {
			inviteId: {
				type: "string",
				default: () => crypto.randomUUID(),
				readOnly: true,
			},
			email: {
				type: "string",
				required: true,
			},
			hostId: {
				type: "string",
				required: true,
			},
			// Host's groupId linking the host and invitees
			groupId: {
				type: "string",
				required: true,
			},
			// Primary room for the invitee to join
			roomId: {
				type: "string",
				required: true,
			},
			status: {
				type: ["pending", "accepted", "rejected"],
				default: "pending",
			},
			createdAt: {
				type: "number",
				default: () => Date.now(),
				readOnly: true,
			},
		},
		indexes: {
			primary: {
				pk: {
					field: "pk",
					composite: ["inviteId"],
				},
				sk: {
					field: "sk",
					composite: ["hostId"],
				},
			},
			byEmail: {
				index: "gsi1",
				pk: {
					field: "gsi1pk",
					composite: ["email"],
				},
				sk: {
					field: "gsi1sk",
					composite: ["status", "createdAt"],
				},
			},
			byGroupId: {
				index: "gsi2",
				pk: {
					field: "gsi2pk",
					composite: ["groupId"],
				},
				sk: {
					field: "gsi2sk",
					composite: ["createdAt"],
				},
			},
		},
	},
	dynamoConfig
);

export type InvitesEntityType = EntityItem<typeof InvitesEntity>;
