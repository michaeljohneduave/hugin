import crypto from "node:crypto";
import { MessageEntity } from "@hugin-bot/core/src/entities/message.dynamo";
import { RoomMessagesService } from "@hugin-bot/core/src/entities/room-messages.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import Valkey from "iovalkey";
import { groupBy, prop } from "remeda";
import { Resource } from "sst";
import { z } from "zod";
import { sendPushNotification } from "./lib/firebase";
import { protectedProcedure, publicProcedure, router, t } from "./trpc";

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

interface GiphySearchResponse {
	data: Array<{
		id: string;
		title: string;
		images: {
			fixed_width: {
				url: string;
				width: string;
				height: string;
			};
			original: {
				url: string;
				width: string;
				height: string;
			};
		};
	}>;
}

const giphy = router({
	search: protectedProcedure
		.input(
			z.object({
				query: z.string(),
				limit: z.number().default(20),
			}),
		)
		.query(async ({ input }) => {
			const response = await fetch(
				`https://api.giphy.com/v1/gifs/search?api_key=${Resource.GIPHY_API_KEY.value}&q=${encodeURIComponent(input.query)}&limit=${input.limit}&rating=g&lang=en&bundle=messaging_non_clips`,
			);

			const data = (await response.json()) as GiphySearchResponse;
			return data.data;
		}),

	trending: protectedProcedure
		.input(
			z.object({
				limit: z.number().default(20),
			}),
		)
		.query(async ({ input }) => {
			const response = await fetch(
				`https://api.giphy.com/v1/gifs/trending?api_key=${Resource.GIPHY_API_KEY.value}&limit=${input.limit}&rating=g`,
			);

			const data = (await response.json()) as GiphySearchResponse;
			return data.data;
		}),
});

const notifications = router({
	getVapidPublicKey: publicProcedure.query(() => {
		const vapidPublicKey = Resource.FirebaseConfig.vapidPublicKey;
		return { vapidPublicKey };
	}),

	savePushSubscription: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				token: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// Add token to the user's set of tokens
				const setKey = `push:tokens:${input.userId}`;
				await redis.sadd(setKey, input.token);

				// Set expiration for the token set (30 days)
				await redis.expire(setKey, 30 * 24 * 60 * 60);

				console.log("[Debug] Saved FCM token:", {
					userId: input.userId,
					token: input.token,
				});
				return { success: true };
			} catch (error) {
				console.error("[Debug] Error saving FCM token:", error);
				throw error;
			}
		}),

	deletePushSubscription: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				token: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// Remove the specific token from the user's set
				const setKey = `push:tokens:${input.userId}`;
				await redis.srem(setKey, input.token);
				console.log("[Debug] Deleted FCM token for user:", {
					userId: input.userId,
					token: `${input.token.substring(0, 10)}...`,
				});
				return { success: true };
			} catch (error) {
				console.error("[Debug] Error deleting FCM token:", error);
				throw error;
			}
		}),

	sendPushNotification: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				title: z.string(),
				body: z.string(),
				url: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// Get all tokens for the user from the Redis set
				const setKey = `push:tokens:${input.userId}`;
				const tokens = await redis.smembers(setKey);

				if (tokens.length === 0) {
					throw new Error("No FCM tokens found for user");
				}

				console.log("[Debug] Sending push notification:", {
					userId: input.userId,
					tokenCount: tokens.length,
				});

				// Send push notification to all tokens
				const results = await Promise.allSettled(
					tokens.map((token) =>
						sendPushNotification(
							token,
							input.title,
							input.body,
							input.url ? { url: input.url } : undefined,
						),
					),
				);

				// Check for failed tokens and remove them
				const failedTokens = results
					.map((result, index) => {
						if (result.status === "rejected") {
							return tokens[index];
						}
						return null;
					})
					.filter((token): token is string => token !== null);

				if (failedTokens.length > 0) {
					await redis.srem(setKey, ...failedTokens);
					console.log("[Debug] Removed failed tokens:", {
						userId: input.userId,
						failedCount: failedTokens.length,
					});
				}

				return { success: true };
			} catch (error) {
				console.error("[Debug] Error sending push notification:", error);
				throw error;
			}
		}),
});

export const appRouter = router({
	rooms: publicProcedure
		.input(
			z.object({
				userId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const rooms = await RoomEntity.query
				.byUser({
					userId: input.userId,
				})
				.go();

			return rooms.data;
		}),
	createAiRoom: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				name: z.string(),
				type: z.enum(["group", "dm", "llm"]),
			}),
		)
		.mutation(async ({ input }) => {
			const room = await RoomEntity.create({
				roomId: crypto.randomUUID(),
				userId: input.userId,
				name: input.name,
				type: input.type,
				user: {
					firstName: "AI",
					lastName: "Assistant",
					avatar: "/ai-avatar.png",
				},
			}).go();

			return room.data;
		}),
	roomsWithLastMessage: publicProcedure
		.input(
			z.object({
				userId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const res = await RoomMessagesService.collections
				.rooms({
					userId: input.userId,
				})
				.go({
					order: "desc",
				});

			const groupedMessages = groupBy(res.data.message, prop("roomId"));
			const rooms = res.data.room.map((room) => {
				const msg = groupedMessages[room.roomId].pop();

				return {
					...room,
					lastMessage: msg,
				};
			});

			return rooms;
		}),
	roomMembers: publicProcedure
		.input(
			z.object({
				roomId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const rooms = await RoomEntity.query
				.primary({
					roomId: input.roomId,
				})
				.go();
			return rooms.data.map((room) => ({
				id: room.userId,
				name: `${room.user.firstName} ${room.user.lastName}`,
				avatar: room.user.avatar,
				type: "user" as const,
			}));
		}),
	messages: publicProcedure
		.input(
			z.object({
				userId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const messages = await MessageEntity.query
				.byUser({
					userId: input.userId,
				})
				.go();

			return messages.data;
		}),
	messagesByRoom: publicProcedure
		.input(
			z.object({
				roomId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const messages = await MessageEntity.query
				.byRoom({
					roomId: input.roomId,
				})
				.go({
					limit: 50,
					order: "desc",
				});

			return messages.data.reverse();
		}),
	greet: publicProcedure
		.input(z.object({ name: z.string() }))
		.query(({ input }) => {
			return `Hello ${input.name}!`;
		}),
	notifications,
	giphy,
});

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext: (opts) => opts,
});
