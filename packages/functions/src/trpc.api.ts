import { titleGenerator } from "@hugin-bot/core/src/ai/agents/utils";
import { MAX_BATCH_INVITES } from "@hugin-bot/core/src/config";
import { InvitesEntity } from "@hugin-bot/core/src/entities/invites.dynamo";
import {
	MessageEntity,
	type MessageEntityType,
	MessageMetadataEntity,
} from "@hugin-bot/core/src/entities/message.dynamo";
import { PnSubscriptionEntity } from "@hugin-bot/core/src/entities/pnSubscription.dynamo";
import { RoomMessagesService } from "@hugin-bot/core/src/entities/room-messages.dynamo";
import {
	RoomEntity,
	type RoomEntityType,
} from "@hugin-bot/core/src/entities/room.dynamo";
import type {
	ChatPayload,
	RoomWithLastMessage,
} from "@hugin-bot/core/src/types";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { groupBy, prop } from "remeda";
import { Resource } from "sst";
import { z } from "zod";
import { createConnectionStorage } from "./lib/connection-storage";
import { sendPushNotification } from "./lib/firebase";
import { createContext, protectedProcedure, router } from "./lib/trpc";
import { createInvitations, getUser } from "./util";
import { generateLLMResponse } from "./websocket";

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
			})
		)
		.query(async ({ input }) => {
			const response = await fetch(
				`https://api.giphy.com/v1/gifs/search?api_key=${Resource.GIPHY_API_KEY.value}&q=${encodeURIComponent(input.query)}&limit=${input.limit}&rating=g&lang=en&bundle=messaging_non_clips`
			);

			const data = (await response.json()) as GiphySearchResponse;
			return data.data;
		}),

	trending: protectedProcedure
		.input(
			z.object({
				limit: z.number().default(20),
			})
		)
		.query(async ({ input }) => {
			const response = await fetch(
				`https://api.giphy.com/v1/gifs/trending?api_key=${Resource.GIPHY_API_KEY.value}&limit=${input.limit}&rating=g`
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
			})
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
			})
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
			})
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
						sendPushNotification({
							token,
							title: input.title,
							body: input.body,
							data: input.url ? { url: input.url } : undefined,
						})
					)
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
						}))
					).go();

					console.log("[Debug] Removed failed tokens:", {
						userId: input.userId,
						failedCount: failedTokens.length,
					});
				}

				console.log("[Debug] Push notification sent successfully:", results);

				return { success: true };
			} catch (error) {
				console.error("[Debug] Error sending push notification:", error);
				throw error;
			}
		}),
});

const connectionStorage = createConnectionStorage("dynamodb");

const roomsWithLastMessage = z.array(
	z.object({
		userId: z.string(),
		roomId: z.string(),
		type: z.enum(["dm", "group", "llm"]),
		status: z.enum(["active", "inactive"]),
		name: z.string().optional(),
		createdAt: z.number().optional(),
		updatedAt: z.number().optional(),
		members: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				avatar: z.string().optional(),
				type: z.enum(["user"]),
			})
		),
		lastMessageAt: z.number(),
	}) satisfies z.ZodType<RoomWithLastMessage>
);

const attributes: (keyof MessageEntityType)[] = [
	"userId",
	"messageId",
	"roomId",
	"threadId",
	"action",
	"type",
	"roomType",
	"message",
	"imageFiles",
	"audioFiles",
	"videoFiles",
	"replyToMessageId",
	"mentions",
	"createdAt",
	"updatedAt",
	"llmChatOwnerId",
];

const chats = router({
	initializeRoom: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
				type: z.enum(["dm", "group", "llm"]),
				name: z.string().optional(),
				message: z.object({
					// MessageEntityType
					userId: z.string(),
					message: z.string().optional(),
					messageId: z.string(),
					roomId: z.string(),
					createdAt: z.number(),
					type: z.enum(["llm", "user", "event"]),
					roomType: z.enum(["group", "dm", "llm"]),
					llmChatOwnerId: z.string().optional(),
					// Action
					action: z.enum(["message"]),
					// User
					user: z.object({
						id: z.string(),
						name: z.string(),
						avatar: z.string().optional(),
						email: z.string().optional(),
						type: z.enum(["llm", "user"]),
					}),
				}) satisfies z.ZodType<ChatPayload>,
				members: z.array(z.string()).optional(),
				agentId: z.string().optional(),
			})
		)
		.mutation(async ({ input, ctx }) => {
			const roomData: RoomEntityType = {
				userId: ctx.userId,
				roomId: input.roomId,
				type: input.type,
				agentId: input.agentId,
				status: "active",
				user: {
					avatar: ctx.imageUrl,
					firstName: ctx.firstName,
					lastName: ctx.lastName,
				},
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			if (input.type === "llm" && input.message.message) {
				roomData.name = await titleGenerator(input.message.message);
			}

			// Create room and message
			const [room, message] = await Promise.all([
				RoomEntity.create(roomData).go(),
				MessageEntity.create({
					userId: ctx.userId,
					messageId: input.message.messageId,
					threadId: crypto.randomUUID(),
					roomId: input.message.roomId,
					message: input.message.message,
					type: input.message.type,
					action: input.message.action,
					roomType: input.type,
					mentions: input.agentId ? [input.agentId] : [],
					llmChatOwnerId: input.type === "llm" ? ctx.userId : undefined,
				}).go(),
			]);

			const connectionIds = await connectionStorage.getUserConnections(
				ctx.userId
			);
			await generateLLMResponse({
				message: {
					...message.data,
					user: {
						id: ctx.userId,
						name: ctx.firstName,
						avatar: ctx.imageUrl,
						type: "user",
					},
					action: "message",
					roomType: message.data.roomType,
					llmChatOwnerId: message.data.llmChatOwnerId,
				},
				connectionIds,
				agentId: message.data.mentions?.[0] ?? "",
				user: {
					id: ctx.userId,
					name: ctx.firstName,
				},
			});

			return {
				room: room.data,
				message: message.data,
			};
		}),
	roomMembers: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
			})
		)
		.query(async ({ input }) => {
			const rooms = await RoomEntity.query
				.primary({
					roomId: input.roomId,
				})
				.go({
					pages: "all",
				});

			return rooms.data;
		}),
	userRoomsAndMembers: protectedProcedure
		.output(roomsWithLastMessage)
		.query(async ({ ctx }) => {
			const rooms = await RoomEntity.query
				.byUser({
					userId: ctx.userId,
				})
				.where((attr, op) => op.ne(attr.type, "llm"))
				.go();

			const members = await Promise.all(
				rooms.data.map(async (room) =>
					RoomEntity.query
						.primary({
							roomId: room.roomId,
						})
						.go({
							pages: "all",
						})
				)
			);

			const roomsWithMembers = rooms.data.map((room, index) => ({
				...room,
				members: members[index].data.map((member) => ({
					id: member.userId,
					name: member.user.firstName || "",
					avatar: member.user.avatar,
					type: "user" as const,
				})),
				lastMessageAt: 0,
			}));

			return roomsWithMembers;
		}),
	userLLMChats: protectedProcedure
		.output(roomsWithLastMessage)
		.query(async ({ ctx }) => {
			const rooms = await RoomEntity.query
				.byUser({
					userId: ctx.userId,
				})
				.where((attr, op) => op.eq(attr.type, "llm"))
				.go();

			return rooms.data.map((room) => ({
				...room,
				members: [],
				lastMessageAt: 0,
			}));
		}),
	messagesByLLMChat: protectedProcedure
		.input(
			z.object({
				limit: z.number().default(20),
				messageCursor: z.string().nullable(),
				createdAt: z.number().optional().default(0),
			})
		)
		.query(async ({ input, ctx }) => {
			const messages = await MessageEntity.query
				.byLLMChatOwner({
					llmChatOwnerId: ctx.userId,
				})
				.where(
					(attr, op) =>
						`${op.eq(attr.roomType, "llm")} AND ${op.gt(attr.createdAt, input.createdAt)}`
				)
				.go({
					count: input.limit,
					order: "desc",
					cursor: input.messageCursor,
					attributes,
				});

			return {
				messages: messages.data,
				messageCursor: messages.cursor,
			};
		}),
	messagesByRoom: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
				limit: z.number().default(20),
				messageCursor: z.string().nullable(),
				createdAt: z.number().optional().default(0),
			})
		)
		.query(async ({ input }) => {
			const messages = await MessageEntity.query
				.byRoomAndThreadSortedByTime({
					roomId: input.roomId,
				})
				.where((attr, op) => op.gt(attr.createdAt, input.createdAt))
				.go({
					count: input.limit,
					order: "desc",
					cursor: input.messageCursor,
					attributes,
				});

			return {
				messages: messages.data,
				messageCursor: messages.cursor,
			};
		}),

	getMessageContext: protectedProcedure
		.input(z.string())
		.query(async ({ input }) => {
			const message = await MessageMetadataEntity.query
				.primary({
					messageId: input,
				})
				.go();

			return message.data[0]?.metadata;
		}),
});

const user = router({
	invite: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
				email: z.array(z.string().email()).max(MAX_BATCH_INVITES),
			})
		)
		.mutation(async ({ input, ctx }) => {
			const user = await getUser(ctx.userId);

			await createInvitations({
				emails: input.email,
				groupId: user.private_metadata.groupId,
				hostId: ctx.userId,
				roomId: input.roomId,
			});

			return { success: true };
		}),
});

export const appRouter = router({
	notifications,
	giphy,
	chats,
	user,
});

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext,
});
