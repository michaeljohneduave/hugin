import crypto from "node:crypto";
import { MessageEntity } from "@hugin-bot/core/src/entities/message.dynamo";
import { RoomMessagesService } from "@hugin-bot/core/src/entities/room-messages.dynamo";
import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { groupBy, prop } from "remeda";
import { Resource } from "sst";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router, t } from "./trpc";

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
	giphy,
});

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext: (opts) => opts,
});
