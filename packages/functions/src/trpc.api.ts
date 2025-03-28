import crypto from "node:crypto";
import { MessageEntity } from "@hugin-bot/core/src/entities/message.dynamo";
import { RoomMessagesService } from "@hugin-bot/core/src/entities/room-messages.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import Valkey from "iovalkey";
import { groupBy, prop } from "remeda";
import { Resource } from "sst";
import webpush from "web-push";
import { z } from "zod";
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

webpush.setVapidDetails(
	"mailto:info@meduave.com",
	Resource.VapidPublicKey.key,
	Resource.VAPID_PRIVATE_KEY.value,
);

// Add logging to verify VAPID setup
console.log("[Debug] VAPID Setup:", {
	publicKeyLength: Resource.VapidPublicKey.key.length,
	privateKeyLength: Resource.VAPID_PRIVATE_KEY.value.length,
	publicKeyFormat: /^[A-Za-z0-9_-]+$/.test(Resource.VapidPublicKey.key)
		? "valid"
		: "invalid",
	privateKeyFormat: /^[A-Za-z0-9_-]+$/.test(Resource.VAPID_PRIVATE_KEY.value)
		? "valid"
		: "invalid",
	publicKeyPrefix: Resource.VapidPublicKey.key.substring(0, 10),
	privateKeyPrefix: Resource.VAPID_PRIVATE_KEY.value.substring(0, 10),
});

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
		const vapidPublicKey = Resource.VapidPublicKey.key;
		return { vapidPublicKey };
	}),

	savePushSubscription: publicProcedure
		.input(
			z.object({
				userId: z.string(),
				subscription: z.object({
					endpoint: z.string(),
					keys: z.object({
						p256dh: z.string(),
						auth: z.string(),
					}),
				}),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				// Store subscription in Redis with user ID as key
				await redis.set(
					`push:sub:${input.userId}`,
					JSON.stringify(input.subscription),
				);
				return { success: true };
			} catch (error) {
				console.error("Error saving push subscription:", error);
				throw new Error("Failed to save push subscription");
			}
		}),

	deletePushSubscription: publicProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ input }) => {
			try {
				// Remove subscription from Redis
				await redis.del(`push:sub:${input.userId}`);
				return { success: true };
			} catch (error) {
				console.error("Error deleting push subscription:", error);
				throw new Error("Failed to delete push subscription");
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
				// Get subscription from Redis
				const subscriptionString = await redis.get(`push:sub:${input.userId}`);
				if (!subscriptionString) {
					throw new Error("No subscription found for user");
				}

				const subscription = JSON.parse(subscriptionString);
				console.log("[Debug] Sending push notification:", {
					userId: input.userId,
					subscription: {
						endpoint: subscription.endpoint,
						keys: {
							p256dh: `${subscription.keys.p256dh.substring(0, 10)}...`,
							auth: `${subscription.keys.auth.substring(0, 10)}...`,
						},
					},
					vapidDetails: {
						subject: "mailto:info@meduave.com",
						publicKey: `${Resource.VapidPublicKey.key.substring(0, 10)}...`,
						privateKey: `${Resource.VAPID_PRIVATE_KEY.value.substring(0, 10)}...`,
					},
				});

				// Send push notification
				try {
					await webpush.sendNotification(
						subscription,
						JSON.stringify({
							title: input.title,
							body: input.body,
							url: input.url,
						}),
					);
					console.log("[Debug] Push notification sent successfully:", {
						userId: input.userId,
						subscriptionEndpoint: subscription.endpoint,
						message: {
							title: input.title,
							body: input.body,
							url: input.url,
						},
					});
				} catch (error: unknown) {
					const webpushError = error as Error & {
						statusCode?: number;
						headers?: Record<string, string>;
						body?: string;
					};
					console.error("[Debug] WebPush error details:", {
						name: webpushError.name,
						message: webpushError.message,
						statusCode: webpushError.statusCode,
						headers: webpushError.headers,
						body: webpushError.body,
					});
					throw webpushError;
				}

				return { success: true };
			} catch (error) {
				console.error("[Debug] Error sending push notification:", {
					error:
						error instanceof Error
							? {
									name: error.name,
									message: error.message,
									stack: error.stack,
								}
							: error,
					userId: input.userId,
				});
				// If subscription is invalid (410 Gone), remove it
				if (error instanceof Error && error.message.includes("410 Gone")) {
					await redis.del(`push:sub:${input.userId}`);
				}
				throw new Error("Failed to send push notification");
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
