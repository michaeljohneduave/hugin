import { verifyToken as clerkVerifyToken } from "@clerk/backend";
import { verifyJwt } from "@clerk/backend/jwt";
import { InvitesEntity } from "@hugin-bot/core/src/entities/invites.dynamo";
import type { Handler } from "aws-lambda";
import { verify } from "jsonwebtoken";
import { Resource } from "sst";

export function lambdaHandler(fn: Handler) {
	try {
		return fn;
	} catch (e) {
		console.error(e);
	}
}

export function verifyToken(token: string) {
	return clerkVerifyToken(token, {
		jwtKey: Resource.ClerkPublicKey.key,
		secretKey: Resource.CLERK_SECRET_KEY.value,
		authorizedParties: process.env.SST_DEV
			? ["http://localhost:5173"]
			: ["https://chat.meduave.com"],
	});
}

export async function createInvitations({
	emails,
	groupId,
	hostId,
	roomId,
}: { emails: string[]; groupId: string; hostId: string; roomId: string }) {
	try {
		await InvitesEntity.put(
			emails.map((email) => ({
				email,
				hostId,
				groupId,
				roomId,
			}))
		).go();

		const response = await fetch("https://api.clerk.com/v1/invitations/bulk", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${Resource.CLERK_SECRET_KEY.value}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(
				emails.map((email) => ({
					email_address: email,
					notify: true,
					ignore_existing: true,
				}))
			),
		});

		if (!response.ok) {
			throw new Error("Failed to create invitations");
		}
	} catch (error) {
		console.error(error);
	}
}

export async function getUser(userId: string) {
	const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
		headers: {
			Authorization: `Bearer ${Resource.CLERK_SECRET_KEY.value}`,
		},
	});

	if (!response.ok) {
		throw new Error("Failed to get user");
	}

	return response.json();
}
