import { WebSocketManager } from "@/lib/wsClient";
import { useAuth, useSession } from "@clerk/vue";
import type { ChatPayload } from "@hugin-bot/core/src/types";

export function useWebsocket() {
	const ws = WebSocketManager.getInstance();
	const { session } = useSession();
	const { getToken } = useAuth();

	// Set up the getToken function for reconnection
	ws.setGetToken(async () => {
		const token = await getToken.value();
		return token;
	});

	const connect = async () => {
		const token = await getToken.value();
		if (token) {
			ws.connect(token);
		}
	};

	const joinRoom = (roomId: string) => {
		if (!session.value?.user) {
			return;
		}

		// ws.sendMessage({
		// 	action: "joinRoom",
		// 	roomId,
		// 	createdAt: Date.now(),
		// 	senderId: session.value?.user.id,
		// 	type: "event",
		// 	messageId: crypto.randomUUID(),
		// 	userId: session.value?.user.id,
		// });
	};

	const sendMessage = (message: ChatPayload) => {
		ws.sendMessage(message);
	};

	const addMessageHandler = (handler: (event: MessageEvent) => void) => {
		ws.addMessageHandler(handler);
	};

	const removeMessageHandler = (handler: (event: MessageEvent) => void) => {
		ws.removeMessageHandler(handler);
	};

	return {
		isOnline: ws.isConnected(),
		joinRoom,
		connect,
		sendMessage,
		addMessageHandler,
		removeMessageHandler,
	};
}
