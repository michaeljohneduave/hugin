import { MessageEntity } from "@hugin-bot/core/src/entities/message.dynamo";
import { PnSubscriptionEntity } from "@hugin-bot/core/src/entities/pnSubscription.dynamo";
import { RoomMessagesService } from "@hugin-bot/core/src/entities/room-messages.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { groupBy, prop } from "remeda";
import { Resource } from "sst";
import { z } from "zod";
import { sendPushNotification } from "./lib/firebase";
import { createContext, protectedProcedure, router } from "./lib/trpc";

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
	savePushSubscription: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				token: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				await PnSubscriptionEntity.upsert({
					userId: input.userId,
					token: input.token,
				}).go();

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

	deletePushSubscription: protectedProcedure
		.input(
			z.object({
				userId: z.string(),
				token: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				await PnSubscriptionEntity.delete({
					userId: input.userId,
					token: input.token,
				}).go();

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

	sendPushNotification: protectedProcedure
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
				// Get all tokens for the user
				const subscriptions = await PnSubscriptionEntity.query
					.primary({
						userId: input.userId,
					})
					.go();

				if (subscriptions.data.length === 0) {
					throw new Error("No FCM tokens found for user");
				}

				const tokens = subscriptions.data.map((sub) => sub.token);

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
					await PnSubscriptionEntity.delete(
						failedTokens.map((token) => ({
							userId: input.userId,
							token,
						})),
					).go();

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

const chats = router({
	roomsWithLastMessage: protectedProcedure
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
	roomMembers: protectedProcedure
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
	userRooms: protectedProcedure.query(async ({ ctx }) => {
		const rooms = await RoomEntity.query
			.byUser({
				userId: ctx.userId,
			})
			.go();
		return rooms.data;
	}),
	messagesByRoom: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
				limit: z.number().default(1000),
			}),
		)
		.query(async ({ input }) => {
			const [members, messages] = await Promise.all([
				RoomEntity.query
					.primary({
						roomId: input.roomId,
					})
					.go(),
				MessageEntity.query
					.byRoom({
						roomId: input.roomId,
					})
					.go({
						limit: input.limit,
						order: "desc",
					}),
			]);

			messages.data.reverse();

			return {
				members: members.data,
				messages: messages.data,
			};
		}),
});

export const appRouter = router({
	notifications,
	giphy,
	chats,
});

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext,
});
