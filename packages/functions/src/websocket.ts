import crypto from "node:crypto";
import {
	ApiGatewayManagementApiClient,
	PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { decodeJwt } from "@clerk/backend/jwt";
import { llmAgents } from "@hugin-bot/core/src/ai";
import { llmRouter } from "@hugin-bot/core/src/ai/router";
import { GENERAL_ROOM } from "@hugin-bot/core/src/config";
import {
	MessageEntity,
	type MessageEntityType,
} from "@hugin-bot/core/src/entities/message.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import type {
	ChatPayload,
	CustomJwtPayload,
	MessagePayload,
} from "@hugin-bot/core/src/types";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { Resource } from "sst";
import {
	type ConnectionStorage,
	createConnectionStorage,
} from "./lib/connection-storage";
import { verifyToken } from "./util";
const apiClient = new ApiGatewayManagementApiClient({
	endpoint: Resource.WebsocketApi.managementEndpoint,
	maxAttempts: 0,
});

const connectionStorage: ConnectionStorage =
	createConnectionStorage("dynamodb");

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

		const verifiedToken = (await verifyToken(token)) as CustomJwtPayload;
		const rooms = await RoomEntity.query
			.byUser({
				userId: verifiedToken.sub,
			})
			.go({
				pages: "all",
			});

		if (rooms.data.length === 0) {
			const r = await RoomEntity.create({
				roomId: GENERAL_ROOM,
				name: GENERAL_ROOM,
				userId: verifiedToken.sub,
				user: {
					firstName: verifiedToken.firstName,
					lastName: verifiedToken.lastName,
					avatar: verifiedToken.imageUrl,
				},
				status: "active",
				type: "group",
			}).go();

			rooms.data.push(r.data);
		}

		// We want to make this connect handler "very" fast
		// For now just warn that the user will be joining >100 rooms
		// Let future Michael handle the optimization of joining >100 rooms
		if (rooms.data.length > 100) {
			console.log("User is in 100 rooms");
		}
		console.log(
			"Joining rooms",
			rooms.data.map((room) => room.roomId),
		);
		await Promise.all([
			connectionStorage.refreshUserConnection(
				verifiedToken.sub,
				token,
				connectionId,
			),
			connectionStorage.addConnIdToRooms(
				rooms.data.map((room) => room.roomId),
				connectionId,
			),
		]);

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
		switch (payload.action) {
			case "ping": {
				const { verifiedToken, error } = await verifyToken(payload.token)
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
				console.log("Connection id", connectionId);
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
						status: "active",
					}).go({
						response: "none",
					}),
					connectionStorage.addConnIdToRooms([payload.roomId], connectionId),
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
					RoomEntity.update({
						roomId: payload.roomId,
						userId: connectionData.userId,
					})
						.set({
							status: "inactive",
						})
						.go({
							response: "none",
						}),
					connectionStorage.delConnIdFromRoom(payload.roomId, connectionId),
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

async function multiSendMsg(
	message: ChatPayload | MessageEntityType,
	connectionIds: string[],
) {
	// TODO: AWS WS is limited to 128kb payloads
	// We need to split long messages into smaller chunks
	// and send them separately
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

// TODO: Add llm errors as a message entity
async function generateLLMResponse({
	message,
	connectionIds,
	agentId,
	user,
}: {
	message: MessageEntityType;
	connectionIds: string[];
	agentId: string;
	user: {
		id: string;
		name: string;
	};
}) {
	if (!message.threadId) {
		console.error("Called generateLLMResponse with no threadId");
		return;
	}

	if (!llmAgents.some((agent) => agent.id === agentId)) {
		console.error("Invalid agentId", agentId);
		return;
	}

	const router = llmRouter[agentId as keyof typeof llmRouter];

	const { response, error } = await router(message.threadId, {
		userId: user.id,
		userName: user.name,
	})
		.then((res) => ({
			response: res,
			error: null,
		}))
		.catch((err) => ({
			response: null,
			error: err,
		}));

	let text = "";
	if (error) {
		console.error("Error generating LLM response", error);

		text = error.message;

		if (!process.env.SST_DEV) {
			text =
				"An error occurred while generating the response. Please try again.";
		}
	} else if (response) {
		text = response.text;
	}

	const llmMessage = await MessageEntity.create({
		userId: agentId,
		action: "message",
		message: text,
		roomId: message.roomId,
		type: "llm",
		replyToMessageId: message.messageId,
		threadId: message.threadId,
		mentions: [agentId],
	}).go();

	await multiSendMsg(llmMessage.data, connectionIds);
}

export const sendMessage = async (
	payload: ChatPayload,
	connectionId: string,
) => {
	const connectionData =
		await connectionStorage.getConnectionData(connectionId);
	if (!connectionData) {
		throw new Error("Connection data not found");
	}

	console.log("Connection data", connectionData);

	const jwtPayload = decodeJwt(connectionData.token)
		.payload as CustomJwtPayload;
	const connectionIds = await connectionStorage.getRoomConnectionIds(
		payload.roomId,
	);

	console.log("Room members", connectionId, payload.roomId, connectionIds);

	payload.messageId = crypto.randomUUID();
	payload.threadId = payload.threadId || crypto.randomUUID();

	// Note: For now we are waiting for the message to be created before sending it to the client
	// This might be slower than sending the message immediately
	// TODO: Measure the performance of this
	await MessageEntity.create({
		messageId: payload.messageId,
		action: "message" as const,
		userId: payload.userId,
		message: payload.message,
		imageFiles: payload.imageFiles,
		audioFiles: payload.audioFiles,
		videoFiles: payload.videoFiles,
		roomId: payload.roomId,
		type: "user" as const,
		replyToMessageId: payload.replyToMessageId,
		mentions: payload.mentions,
		// For now, we trust the frontend to send the correct threadId/replyToMessageId
		threadId: payload.threadId,
	}).go();

	multiSendMsg(payload, connectionIds);

	// if llm tag is detected send the message to the router function
	// TODO: Check mention for llm tag
	if (payload.mentions) {
		await generateLLMResponse({
			message: payload,
			agentId: payload.mentions[0],
			connectionIds,
			user: {
				id: `${jwtPayload.sub}`,
				name: `${jwtPayload.firstName} ${jwtPayload.lastName}`,
			},
		});
		// if the message is a reply to a llm message, send the message to the router function
	} else if (payload.replyToMessageId) {
		const replyToMessage = await MessageEntity.query
			.primary({
				messageId: payload.replyToMessageId,
			})
			.go();

		if (replyToMessage.data[0].type === "llm") {
			await generateLLMResponse({
				message: payload,
				agentId: replyToMessage.data[0].userId,
				connectionIds,
				user: {
					id: `${jwtPayload.sub}`,
					name: `${jwtPayload.firstName} ${jwtPayload.lastName}`,
				},
			});
		}
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

export const agentResponse = (event: APIGatewayProxyEvent) => {
	const body = JSON.parse(event.body!);
	const messagePayload: ChatPayload = body.messagePayload;
	const connectionId = body.connectionIds;

	if (!messagePayload || !connectionId) {
		return {
			statusCode: 400,
		};
	}

	MessageEntity.create(messagePayload).go();

	multiSendMsg(messagePayload, [connectionId]);

	return {
		statusCode: 200,
	};
};
