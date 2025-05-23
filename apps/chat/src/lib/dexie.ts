import type {
	ChatPayload,
	RoomPayload,
	RoomWithLastMessage,
} from "@hugin-bot/core/src/types";
import { Dexie, type EntityTable } from "dexie";

export type Message =
	| (ChatPayload & {
			keywords: string[];
	  })
	| (RoomPayload & {
			keywords: string[];
	  });

interface ChatDatabase extends Dexie {
	messages: EntityTable<Message, "messageId">;
	rooms: EntityTable<RoomWithLastMessage, "roomId">;
}

class ChatDb {
	private static instance: ChatDb;
	private db: ChatDatabase;

	private constructor() {
		this.db = new Dexie("chat") as ChatDatabase;
		this.db.version(1).stores({
			messages:
				"messageId, roomId, roomType, createdAt, updatedAt, keywords, status, [roomId+createdAt]",
			rooms: "roomId, userId, name, [lastMessageAt+createdAt]",
		});
	}

	static getInstance(): ChatDatabase {
		if (!ChatDb.instance) {
			ChatDb.instance = new ChatDb();
		}
		return ChatDb.instance.db;
	}
}

// Export singleton instance
export const db = ChatDb.getInstance();

export const addMessageToDb = async (
	message: Array<ChatPayload | RoomPayload> | ChatPayload | RoomPayload
) => {
	if (Array.isArray(message)) {
		const msgs = message.map((m) => {
			const keywords = m.message?.split(" ") ?? [];
			return {
				...m,
				keywords,
			};
		});
		await db.messages.bulkPut(msgs);
	} else {
		const keywords = message.message?.split(" ") ?? [];
		await db.messages.put({
			...message,
			keywords,
		});
	}
};
