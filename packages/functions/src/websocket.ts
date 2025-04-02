import crypto from "node:crypto";
import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { verifyToken as clerkVerifyToken } from "@clerk/backend";
import { decodeJwt } from "@clerk/backend/jwt";
import { router } from "@hugin-bot/core/src/ai/router";
import { MessageEntity } from "@hugin-bot/core/src/entities/message.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import type { APIGatewayProxyEvent } from "aws-lambda";
import Valkey, { type Redis } from "iovalkey";
import { Resource } from "sst";
import {
	type ConnectionStorage,
	createConnectionStorage,
} from "./lib/connection-storage";
import type { ChatPayload, CustomJwtPayload, MessagePayload } from "./types";

const apiClient = new ApiGatewayManagementApiClient({
	endpoint: Resource.WebsocketApi.managementEndpoint,
	maxAttempts: 0,
});

const connectionStorage: ConnectionStorage = createConnectionStorage(
	"dynamodb",
	// redis as Redis,
);

// Handles rejoining existing rooms (user becoming online)
export const connect = async (event: APIGatewayProxyEvent) => {
	try {
		const token = event.queryStringParameters?.token;
		const connectionId = event.requestContext.connectionId;

		if (!token) {
			console.log("Token not found");
			return {
				statusCode: 401,
			};
		}

		if (!connectionId) {
			console.log("ConnectionId not found");
			return {
				statusCode: 400,
			};
		}

		const verifiedToken = await clerkVerifyToken(token, {
			secretKey: Resource.CLERK_SECRET_KEY.value,
			authorizedParties: [
				"http://localhost:5173",
				"https://chat.meduave.com",
				// Add chat app domain here
			],
		});

		const rooms = await RoomEntity.query
			.byUser({
				userId: verifiedToken.sub,
			})
			.go({
				pages: "all",
			});

		// We want to make this connect handler "very" fast
		// For now just warn that the user will be joining >100 rooms
		// Let future Michael handle the optimization of joining >100 rooms
		if (rooms.data.length > 100) {
			console.log("User is in 100 rooms");
		}

		await connectionStorage.refreshUserConnection(
			verifiedToken.sub,
			token,
			connectionId,
		);

		// Join all rooms
		await Promise.all(
			rooms.data.map((room) =>
				connectionStorage.addUserToRoom(
					room.roomId,
					verifiedToken.sub,
					connectionId,
				),
			),
		);

		return {
			statusCode: 200,
		};
	} catch (error) {
		console.error(error);

		return {
			statusCode: 500,
		};
	}
};

// Handles joining new rooms and message being sent
export const $default = async (event: APIGatewayProxyEvent) => {
	try {
		const connectionId = event.requestContext.connectionId;
		if (!connectionId) {
			return {
				statusCode: 400,
			};
		}

		const payload: MessagePayload = JSON.parse(event.body!);
		console.log("Receive message", payload);

		switch (payload.action) {
			case "ping": {
				const { verifiedToken, error } = await clerkVerifyToken(payload.token, {
					secretKey: Resource.CLERK_SECRET_KEY.value,
					authorizedParties: [
						"http://localhost:5173",
						"https://chat.meduave.com",
						// Add chat app domain here
					],
				})
					.then((t) => ({
						error: null,
						verifiedToken: t,
					}))
					.catch((err) => ({
						verifiedToken: null,
						error: err,
					}));

				if (error || !verifiedToken) {
					console.error("Error verifying jwt token", error);
					return {
						statusCode: 500,
					};
				}

				await Promise.allSettled([
					connectionStorage.refreshUserConnection(
						verifiedToken.sub,
						payload.token,
						connectionId,
					),
					pong(connectionId),
				]);
				break;
			}
			case "joinRoom": {
				const connectionData =
					await connectionStorage.getConnectionData(connectionId);
				if (!connectionData) {
					return {
						statusCode: 400,
					};
				}
				const jwtPayload = decodeJwt(connectionData.token)
					.payload as CustomJwtPayload;
				await Promise.all([
					RoomEntity.upsert({
						roomId: payload.roomId,
						userId: connectionData.userId,
						user: {
							firstName: jwtPayload.firstName,
							lastName: jwtPayload.lastName,
							avatar: jwtPayload.imageUrl,
						},
					}).go({
						response: "none",
					}),
					connectionStorage.addUserToRoom(
						payload.roomId,
						connectionData.userId,
						connectionId,
					),
				]);
				break;
			}
			case "leaveRoom": {
				const connectionData =
					await connectionStorage.getConnectionData(connectionId);
				if (!connectionData) {
					return {
						statusCode: 400,
					};
				}

				await Promise.all([
					RoomEntity.delete({
						roomId: payload.roomId,
						userId: connectionData.userId,
					}).go(),
					connectionStorage.removeUserFromRoom(
						payload.roomId,
						connectionData.userId,
					),
				]);
				break;
			}
			case "message":
				await sendMessage(payload, connectionId);
				break;
		}
		return {
			statusCode: 200,
		};
	} catch (error) {
		console.error(error);
		return {
			statusCode: 500,
		};
	}
};

export const pong = (conn: string) => {
	return apiClient.send(
		new PostToConnectionCommand({
			Data: JSON.stringify({
				type: "pong",
			}),
			ConnectionId: conn,
		}),
	);
};

async function multiSendMsg(message: ChatPayload, connectionIds: string[]) {
	await Promise.allSettled(
		connectionIds.map((conn) =>
			apiClient
				.send(
					new PostToConnectionCommand({
						Data: JSON.stringify(message),
						ConnectionId: conn,
					}),
				)
				.catch(async (error: Error) => {
					// Clean up connectionIds not deleted on disconnect
					if (error.name === "GoneException") {
						const connectionData =
							await connectionStorage.getConnectionData(conn);
						if (connectionData) {
							await connectionStorage.removeConnection(
								conn,
								connectionData.userId,
							);
						}
						return;
					}
					throw error;
				}),
		),
	);
}

async function getLLMResponse({
	roomId,
	message,
	connectionIds,
}: {
	roomId: string;
	message: string;
	connectionIds: string[];
}) {
	const response = await router([
		{
			role: "user",
			content: message,
		},
	]);
	const text = response.text;
	const senderId = "gemini";

	console.log("response", response);

	const chatPayload: ChatPayload = {
		messageId: crypto.randomUUID(),
		action: "message",
		senderId,
		roomId,
		timestamp: Date.now(),
		mentions: [senderId],
		message: text,
		type: "llm",
	};

	MessageEntity.create({
		userId: senderId,
		action: "message",
		message: text,
		roomId: roomId,
		type: "llm",
	})
		.go()
		.catch(console.error);

	await multiSendMsg(chatPayload, connectionIds);
}

// TODO: Need to separate the endpoint for DMs and rooms
export const sendMessage = async (
	payload: ChatPayload,
	connectionId: string,
) => {
	const connectionData =
		await connectionStorage.getConnectionData(connectionId);
	if (!connectionData) {
		throw new Error("Connection data not found");
	}

	const jwtPayload = decodeJwt(connectionData.token);
	const roomMembers = await connectionStorage.getRoomMembers(payload.roomId);

	const connectionIds = await Promise.all(
		roomMembers.map((userId) => connectionStorage.getUserConnections(userId)),
	);

	const messageId = crypto.randomUUID();

	MessageEntity.create({
		messageId,
		action: "message",
		userId: payload.senderId,
		message: payload.message,
		imageFiles: payload.imageFiles,
		audioFiles: payload.audioFiles,
		videoFiles: payload.videoFiles,
		roomId: payload.roomId,
		type: "user",
	})
		.go()
		.catch(console.error);

	const allConnectionIds = connectionIds.flat();

	const message: ChatPayload = {
		messageId,
		action: "message",
		senderId: jwtPayload.payload.sub,
		roomId: payload.roomId,
		timestamp: Date.now(),
		type: "user",
		...(payload.message
			? { message: payload.message, mentions: payload.mentions }
			: {
					imageFiles: payload.imageFiles || [],
					videoFiles: payload.videoFiles || [],
					audioFiles: payload.audioFiles || [],
				}),
	};

	await multiSendMsg(message, allConnectionIds);

	// if llm tag is detected send the message to the router function
	if (payload.mentions && message.message) {
		await getLLMResponse({
			roomId: payload.roomId,
			message: payload.message,
			connectionIds: allConnectionIds,
		});
	}
};

// Handles cleaning up the connectionId (if possible)
export const disconnect = async (event: APIGatewayProxyEvent) => {
	try {
		const token = event.queryStringParameters?.token;
		const connectionId = event.requestContext.connectionId;
		if (!token || !connectionId) {
			return {
				statusCode: 200,
			};
		}

		const connectionData =
			await connectionStorage.getConnectionData(connectionId);
		if (connectionData) {
			await connectionStorage.removeConnection(
				connectionId,
				connectionData.userId,
			);
		}

		return {
			statusCode: 200,
		};
	} catch (error) {
		console.error(error);
		return {
			statusCode: 500,
		};
	}
};
