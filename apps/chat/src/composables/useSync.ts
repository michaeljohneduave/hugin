import carmyAvatar from "@/assets/carmy-avatar.webp";
import loebotteAvatar from "@/assets/loebotte-avatar.webp";
import pearlAvatar from "@/assets/pearl.svg";
import { useTrpc } from "@/composables/useTrpc";
import { type Message, addMessageToDb, db } from "@/lib/dexie";
import { useUser } from "@clerk/vue";
import { llmRouters } from "@hugin-bot/core/src/ai";
import { llmAgents } from "@hugin-bot/core/src/ai";
import type { MessageEntityType } from "@hugin-bot/core/src/entities/message.dynamo";
import type {
	Room,
	RoomPayload,
	RoomWithLastMessage,
} from "@hugin-bot/core/src/types";
import type { User } from "@hugin-bot/core/src/types";
import type { ChatPayload } from "@hugin-bot/core/src/types";
import { type Subscription, liveQuery } from "dexie";
import {
	onBeforeMount,
	onMounted,
	onUnmounted,
	reactive,
	ref,
	watch,
} from "vue";
import { onBeforeRouteUpdate, useRoute } from "vue-router";
import { useWebsocket } from "./useWebsocket";

const botAvatars = {
	carmy: carmyAvatar,
	pearl: pearlAvatar,
	lobot: loebotteAvatar,
};
const userMap = new Map<string, User>();
const availableBots = llmAgents.concat(llmRouters).map((agent) => ({
	id: agent.id,
	name: agent.name,
	avatar: botAvatars[agent.id as keyof typeof botAvatars],
	type: "llm" as const,
}));
const unknownBot: User = {
	id: "lobot",
	name: "Loebotte",
	avatar: loebotteAvatar,
	type: "llm" as const,
};

const state = reactive({
	rooms: [] as RoomWithLastMessage[],
	messages: [] as Array<ChatPayload | RoomPayload>,
	roomsLoading: false,
});

export function getLocalRooms() {
	return db.rooms.orderBy(["lastMessageAt", "createdAt"]).reverse().toArray();
}

export function getChatMessagesQuery(roomId: string) {
	return db.messages.where("roomId").equals(roomId).sortBy("createdAt");
}

function getUserOrBot(userId: string, type: MessageEntityType["type"]) {
	if (type === "user") {
		return (
			userMap.get(userId) || {
				id: userId,
				name: "Unknown",
				avatar: "",
				type: "user" as const,
			}
		);
	}

	if (type === "llm") {
		return availableBots.find((bot) => bot.id === userId) || unknownBot;
	}

	if (type === "event") {
		return (
			userMap.get(userId) || {
				id: userId,
				name: "Unknown",
				avatar: "",
				type: "user" as const,
			}
		);
	}

	return {
		id: userId,
		name: "Unknown",
		avatar: "",
		type: "user" as const,
	};
}

// Determines the last message by message type
// image/video/text
function getLastMessage(msg: Omit<Message, "keywords">) {
	if (msg.type === "event") {
		return "Event (Not implemented)";
	}

	if (msg.message) {
		return msg.message;
	}

	if (msg.imageFiles && msg.imageFiles.length > 0) {
		return "Image";
	}

	if (msg.audioFiles && msg.audioFiles.length > 0) {
		return "Audio";
	}

	if (msg.videoFiles && msg.videoFiles.length > 0) {
		return "Video";
	}

	return "Unknown";
}

export function useCurrentMessages() {
	const route = useRoute<"chat">();
	const messages = ref<Array<ChatPayload | RoomPayload>>([]);
	let messagesSubscription: Subscription | null = null;

	watch(
		() => route.params.roomId,
		async (newRoomId) => {
			const observable = liveQuery(() => {
				return getChatMessagesQuery(newRoomId as string);
			});

			messagesSubscription = observable.subscribe({
				next: (result) => {
					messages.value = result;
				},
			});
		}
	);

	onBeforeMount(async () => {
		messages.value = (
			await db.messages
				.where("[roomId+createdAt]")
				.between(
					[route.params.roomId as string, 0],
					[route.params.roomId as string, Date.now()]
				)
				.reverse()
				.offset(1)
				.limit(50)
				.toArray()
		).reverse();

		const observable = liveQuery(() => {
			return getChatMessagesQuery(route.params.roomId as string);
		});

		messagesSubscription = observable.subscribe({
			next: (result) => {
				messages.value = result;
			},
		});
	});

	onBeforeRouteUpdate(async () => {
		messages.value = await getChatMessagesQuery(route.params.roomId as string);
	});

	onUnmounted(() => {
		if (messagesSubscription) {
			messagesSubscription.unsubscribe();
		}
	});

	return {
		messages,
	};
}

export function useCurrentRoom() {
	const route = useRoute<"chat">();
	const room = ref<RoomWithLastMessage>();
	let roomSubscription: Subscription | null = null;

	// Move to another room via url change
	watch(
		() => route.params.roomId,
		async (newRoomId) => {
			const observable = liveQuery(() => {
				return db.rooms.get(newRoomId as string);
			});

			roomSubscription = observable.subscribe({
				next: (result) => {
					room.value = result;
				},
			});
		}
	);

	onBeforeMount(async () => {
		room.value = await db.rooms.get(route.params.roomId as string);

		const observable = liveQuery(() => {
			return db.rooms.get(route.params.roomId as string);
		});

		roomSubscription = observable.subscribe({
			next: (result) => {
				room.value = result;
			},
		});
	});

	onBeforeRouteUpdate(async () => {
		room.value = await db.rooms.get(route.params.roomId as string);
	});

	onUnmounted(() => {
		if (roomSubscription) {
			roomSubscription.unsubscribe();
		}
	});

	return {
		room,
	};
}

export function useRooms() {
	const rooms = ref<RoomWithLastMessage[]>([]);
	let roomsSubscription: Subscription | null = null;

	onBeforeMount(async () => {
		rooms.value = await db.rooms
			.orderBy(["lastMessageAt", "createdAt"])
			.reverse()
			.toArray();
		const observable = liveQuery(() => {
			return db.rooms
				.orderBy(["lastMessageAt", "createdAt"])
				.reverse()
				.toArray();
		});

		roomsSubscription = observable.subscribe({
			next: (result) => {
				rooms.value = result;
			},
		});
	});

	onUnmounted(() => {
		if (roomsSubscription) {
			roomsSubscription.unsubscribe();
		}
	});

	return {
		rooms,
	};
}

export default function useSync() {
	const route = useRoute();
	const { user: clerkUser } = useUser();
	let roomSubscription: Subscription | null = null;
	let messagesSubscription: Subscription | null = null;
	const { addMessageHandler, removeMessageHandler } = useWebsocket();
	const trpc = useTrpc();

	// Only for group rooms
	const syncGroupMessages = async (roomId: string) => {
		const [lastMessage] = await db.messages
			.where("roomId")
			.equals(roomId)
			.reverse()
			.sortBy("createdAt");

		const lastMessageAt = Math.min(
			lastMessage?.createdAt || 0,
			Date.now() - 1000 * 60 * 60 * 24 * 2 // 2 days
		);

		const roomsMap = new Map<
			string,
			{ lastMessageAt: number; lastMessage: string; lastMessageUser: User }
		>();
		let messageCursor: string | null = null;

		do {
			const response = await trpc.chats.messagesByRoom.query({
				roomId: roomId,
				limit: 100,
				createdAt: lastMessageAt,
				messageCursor,
			});

			if (response.messageCursor) {
				messageCursor = response.messageCursor;
			} else {
				messageCursor = null;
			}

			const msgs: (ChatPayload | RoomPayload)[] = [];
			for (const msg of response.messages) {
				const item = roomsMap.get(msg.roomId) || {
					lastMessageAt: 0,
					lastMessage: "",
					lastMessageUser: {
						id: "",
						name: "",
						type: "user",
					},
				};

				switch (msg.action) {
					case "message":
						{
							const user = getUserOrBot(msg.userId, msg.type);
							// Update last message at and last message
							if (
								msg.action === "message" &&
								item.lastMessageAt < msg.createdAt
							) {
								const lastMessage = getLastMessage(
									msg as Omit<Message, "keywords">
								);

								roomsMap.set(msg.roomId, {
									lastMessageAt: msg.createdAt,
									lastMessage,
									lastMessageUser: user,
								});
							}

							msgs.push({
								...msg,
								user,
								status: "delivered",
							});
						}
						break;
					case "joinRoom":
					case "leaveRoom":
						break;
				}
			}

			await addMessageToDb(msgs);

			for (const [roomId, item] of roomsMap.entries()) {
				await db.rooms.update(roomId, {
					lastMessageAt: item.lastMessageAt,
					lastMessage: item.lastMessage,
					lastMessageUser: item.lastMessageUser,
				});
			}
		} while (messageCursor);
	};

	const syncLLMMessages = async () => {
		const lastMessage = await db.messages.orderBy("createdAt").last();

		const roomsMap = new Map<
			string,
			{ lastMessageAt: number; lastMessage: string; lastMessageUser: User }
		>();
		let messageCursor: string | null = null;
		let maxTime = lastMessage?.createdAt || 0;

		do {
			const response = await trpc.chats.messagesByLLMChat.query({
				limit: 100,
				createdAt: lastMessage?.createdAt || 0,
				messageCursor,
			});

			if (response.messageCursor) {
				messageCursor = response.messageCursor;
			} else {
				messageCursor = null;
			}

			const msgs: (ChatPayload | RoomPayload)[] = [];
			for (const msg of response.messages) {
				const item = roomsMap.get(msg.roomId) || {
					lastMessageAt: 0,
				};
				const user = getUserOrBot(msg.userId, msg.type);

				// Update last message at and last message
				if (msg.action === "message" && item.lastMessageAt < msg.createdAt) {
					const lastMessage = getLastMessage(msg as Omit<Message, "keywords">);
					roomsMap.set(msg.roomId, {
						lastMessageAt: msg.createdAt,
						lastMessage,
						lastMessageUser: user,
					});
				}

				msgs.push({
					...msg,
					user,
					status: "delivered",
				});

				maxTime = Math.max(maxTime, msg.createdAt);
			}

			for (const [roomId, item] of roomsMap.entries()) {
				await db.rooms.update(roomId, {
					lastMessageAt: item.lastMessageAt,
					lastMessage: item.lastMessage,
					lastMessageUser: item.lastMessageUser,
				});
			}

			await addMessageToDb(msgs);
		} while (messageCursor);
	};

	const getRooms = async () => {
		const rooms = await getLocalRooms();
		return rooms;
	};

	// TODO: Reduce re-querying by using a createdAt timestamp in the query
	const syncRooms = async () => {
		const roomCount = await db.rooms.count();

		if (roomCount === 0) {
			state.roomsLoading = true;
		}

		const existingRooms = await db.rooms.toArray();
		const set = new Set(existingRooms.map((r) => r.roomId));
		const [rooms, llmRooms] = await Promise.all([
			trpc.chats.userRoomsAndMembers.query(),
			trpc.chats.userLLMChats.query(),
		]);

		for (const room of rooms) {
			for (const member of room.members) {
				userMap.set(member.id, member);
			}
		}

		console.log("userMap", userMap);

		const newRooms = rooms
			.concat(llmRooms)
			.filter((room) => !set.has(room.roomId))
			.map((room) => {
				room.lastMessageAt = 0;

				return room;
			});

		await db.rooms.bulkPut(newRooms);

		state.rooms = await getRooms();
		state.roomsLoading = false;
	};

	const handleWebSocketMessage = async (event: MessageEvent) => {
		const data = JSON.parse(event.data) as ChatPayload | RoomPayload;
		const user = getUserOrBot(data.userId, data.type);
		const lastMessage = getLastMessage(data as Omit<Message, "keywords">);

		if (data.action === "message") {
			data.status = "delivered";
		}

		data.user = user;

		await addMessageToDb(data);
		await db.rooms.update(data.roomId, {
			lastMessageAt: data.createdAt,
			lastMessage,
			lastMessageUser: user,
		});
	};

	const runObservables = () => {
		const roomsObservable = liveQuery(() => {
			return getLocalRooms();
		});

		roomSubscription = roomsObservable.subscribe({
			next: (result) => {
				state.rooms = result;
			},
		});

		const messagesObservable = liveQuery(() => {
			return db.messages
				.where("roomId")
				.equals(route.params.roomId as string)
				.toArray();
		});

		messagesSubscription = messagesObservable.subscribe({
			next: (result) => {
				state.messages = result;
			},
		});
	};

	const initDataSync = async () => {
		// runObservables();
		await Promise.all([syncRooms(), syncLLMMessages()]);

		// This query depends on syncRooms()
		const rooms = await getLocalRooms();

		for (const room of rooms) {
			if (room.type === "group") {
				await syncGroupMessages(room.roomId);
			} else if (room.type === "llm") {
			} else {
				// await syncDirectMessages(room.roomId);
			}
		}
	};

	onMounted(async () => {
		addMessageHandler(handleWebSocketMessage);
		state.rooms = await getRooms();
	});

	onUnmounted(() => {
		removeMessageHandler(handleWebSocketMessage);
		if (roomSubscription) {
			roomSubscription.unsubscribe();
		}
		if (messagesSubscription) {
			messagesSubscription.unsubscribe();
		}
	});

	return {
		initDataSync,
		state,
	};
}
