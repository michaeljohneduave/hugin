import { createHmac } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { GENERAL_ROOM } from "@hugin-bot/core/src/config";
import { InvitesEntity } from "@hugin-bot/core/src/entities/invites.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { Resource } from "sst";

const clerkClient = createClerkClient({
	secretKey: Resource.CLERK_WEBHOOK_SECRET.value,
});

function verifyClerkWebhookSig(event: APIGatewayProxyEvent) {
	if (Date.now() - Number(event.headers["svix-timestamp"]) * 1000 > 1000 * 60) {
		throw new Error("Invalid timestamp");
	}

	const id = event.headers["svix-id"];
	const timestamp = event.headers["svix-timestamp"];
	const sig = event.headers["svix-signature"];
	const signedContent = `${id}.${timestamp}.${event.body}`;
	const secret = Buffer.from(
		Resource.CLERK_WEBHOOK_SECRET.value.split("_")[1]!,
		"base64"
	);
	const signature = createHmac("sha256", secret)
		.update(signedContent)
		.digest("base64");

	console.log(signature);
	console.log(sig?.split(",")[1]);

	if (signature !== sig?.split(",")[1]) {
		throw new Error("Invalid signature");
	}
}

export const clerk = async (event: APIGatewayProxyEvent) => {
	verifyClerkWebhookSig(event);
	const body = JSON.parse(event.body || "{}");

	switch (body.type) {
		case "user.created":
			{
				const user = await clerkClient.users.getUser(body.data.id);
				const invite = await InvitesEntity.query
					.byEmail({
						email: user.emailAddresses[0].emailAddress,
					})
					.go();

				if (invite.data.length === 1) {
					const [_, __, room] = await Promise.all([
						clerkClient.users.updateUserMetadata(body.data.id, {
							privateMetadata: {
								groupId: invite.data[0].groupId,
							},
						}),
						InvitesEntity.update({
							inviteId: invite.data[0].inviteId,
							hostId: invite.data[0].hostId,
						})
							.set({
								status: "accepted",
							})
							.go(),
						RoomEntity.query
							.primary({
								roomId: invite.data[0].roomId,
								userId: invite.data[0].hostId,
							})
							.go(),
					]);

					// Let user join the existing room
					if (room.data.length === 1) {
						await RoomEntity.create({
							roomId: room.data[0].roomId,
							userId: body.data.id,
							user: {
								firstName: body.data.first_name,
								lastName: body.data.last_name,
								avatar: body.data.image_url,
							},
							status: "active",
							type: "group",
						}).go();
					}
				} else {
					await clerkClient.users.updateUserMetadata(body.data.id, {
						privateMetadata: {
							groupId: crypto.randomUUID(),
						},
					});

					// If the user is not invited, create a new room for them
					await RoomEntity.create({
						roomId: crypto.randomUUID(),
						name: GENERAL_ROOM,
						userId: body.data.id,
						user: {
							firstName: body.data.first_name,
							lastName: body.data.last_name,
							avatar: body.data.image_url,
						},
						status: "active",
						type: "group",
					}).go();
				}
			}
			break;
		case "user.updated":
			break;
		case "user.deleted":
			break;
	}

	return {
		statusCode: 200,
	};
};
