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
import Valkey from "iovalkey";
import { Resource } from "sst";
import type { ChatPayload, CustomJwtPayload, MessagePayload } from "./types";

const USERID_CONNECTIONID_TTL_SEC = 600;

const redis =
	Resource.Valkey.host === "localhost"
		? new Valkey({
				host: Resource.Valkey.host,
				port: Resource.Valkey.port,
			})
		: new Valkey.Cluster(
				[
					{
						host: Resource.Valkey.host,
						port: Resource.Valkey.port,
					},
				],
				{
					dnsLookup: (address, callback) => callback(null, address),
					slotsRefreshTimeout: 2000,
					redisOptions: {
						tls: {},
						username: Resource.Valkey.username,
						password: Resource.Valkey.password,
					},
				},
			);

const apiClient = new ApiGatewayManagementApiClient({
	endpoint: Resource.WebsocketApi.managementEndpoint,
	maxAttempts: 0,
});

async function refreshRedisConnectionId(
	userId: string,
	token: string,
	connectionId: string,
	extendPipeline = false,
) {
	await redis
		.pipeline()
		.sadd(`user:${userId}`, [connectionId])
		.expire(`user:${userId}`, USERID_CONNECTIONID_TTL_SEC)
		.set(
			`connection:${connectionId}`,
			`${userId}--${token}`,
			"EX",
			USERID_CONNECTIONID_TTL_SEC,
		)
		.exec();
}

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

		await refreshRedisConnectionId(
			verifiedToken.sub,
			token,
			connectionId,
			true,
		);

		let pipeline = redis.pipeline();

		for (const room of rooms.data) {
			pipeline = pipeline.sadd(`room:${room.roomId}:members`, [
				verifiedToken.sub,
			]);
		}

		await pipeline.exec();

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
					// Refresh jwt tokens
					refreshRedisConnectionId(
						verifiedToken.sub,
						payload.token,
						connectionId,
					),
					// Send pong
					pong(connectionId),
				]);
				break;
			}
			case "joinRoom": {
				const [userId, token] =
					(await redis.get(`connection:${connectionId}`))?.split("--") || [];

				if (!userId || !token) {
					return {
						statusCode: 400,
					};
				}
				const jwtPayload = decodeJwt(token).payload as CustomJwtPayload;
				await Promise.all([
					RoomEntity.upsert({
						roomId: payload.roomId,
						userId: userId,
						user: {
							firstName: jwtPayload.firstName,
							lastName: jwtPayload.lastName,
							avatar: jwtPayload.imageUrl,
						},
					}).go({
						response: "none",
					}),
					redis.sadd(`room:${payload.roomId}:members`, [userId]),
				]);
				break;
			}
			case "leaveRoom": {
				const [userId, token] =
					(await redis.get(`connection:${connectionId}`))?.split("--") || [];

				if (!userId || !token) {
					return {
						statusCode: 400,
					};
				}

				await Promise.all([
					RoomEntity.delete({
						roomId: payload.roomId,
						userId: userId,
					}).go(),
					redis.srem(`room:${payload.roomId}:members`, [userId]),
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
						const connectionData = await redis.get(`connection:${conn}`);
						const [userId] = connectionData?.split("--") || [];

						if (userId) {
							await Promise.allSettled([
								redis.del([`connection:${conn}`]),
								redis.srem(`user:${userId}`, [conn]),
							]);
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
	const { text } = await router([
		{
			role: "user",
			content: message,
		},
	]);

	const senderId = "gemini";

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
	const value = await redis.get(`connection:${connectionId}`);
	const [userId, token] = value?.split("--") || [];

	if (!token) {
		throw new Error("Jwt token not found");
	}

	// console.log("decoding value", value);
	// console.log("decoding token", token);
	const jwtPayload = decodeJwt(token);
	const userIds = await redis.smembers(`room:${payload.roomId}:members`);
	let pipeline = redis.pipeline();

	for (const userId of userIds) {
		pipeline = pipeline.smembers(`user:${userId}`);
	}

	const results = await pipeline.exec();
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

	const connectionIds =
		results?.flatMap((result) => {
			// has error
			if (result[0]) {
				return [];
			}

			return result[1] as string[];
		}) || [];

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

	await multiSendMsg(message, connectionIds);

	// if llm tag is detected send the message to the router function
	if (payload.mentions && message.message) {
		await getLLMResponse({
			roomId: payload.roomId,
			message: payload.message,
			connectionIds,
		});
	}
};

// Handles cleaning up the connectionId (if possible)
export const disconnect = async (event: APIGatewayProxyEvent) => {
	try {
		const token = event.queryStringParameters?.token;
		const connectionId = event.requestContext.connectionId;
		if (!token) {
			return {
				statusCode: 200,
			};
		}

		if (!connectionId) {
			return {
				statusCode: 200,
			};
		}

		const connectionData = await redis.get(`connection:${connectionId}`);
		const [userId] = connectionData?.split("--") || [];

		if (userId) {
			await Promise.allSettled([
				redis.del([`connection:${connectionId}`]),
				redis.srem(`user:${userId}`, [connectionId]),
			]);
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
