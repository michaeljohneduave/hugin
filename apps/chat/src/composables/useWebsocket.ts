import { WebSocketManager } from "@/lib/wsClient";
import { useAuth, useSession, useUser } from "@clerk/vue";
import type { ChatPayload } from "@hugin-bot/core/src/types";

export function useWebsocket() {
	const ws = WebSocketManager.getInstance();
	const { session } = useSession();
	const { getToken } = useAuth();
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
	};

	const forceReconnect = async () => {
		const token = await getToken.value();
		if (token) {
			ws.connect(token);
		}
	};

	const sendMessage = (message: ChatPayload) => {
		if (!ws.isConnected.value) {
			forceReconnect();
		}

		ws.sendMessage(message);
	};

	const addMessageHandler = (handler: (event: MessageEvent) => void) => {
		ws.addMessageHandler(handler);
	};

	const removeMessageHandler = (handler: (event: MessageEvent) => void) => {
		ws.removeMessageHandler(handler);
	};

	return {
		isOnline: ws.isConnected,
		joinRoom,
		connect,
		sendMessage,
		addMessageHandler,
		removeMessageHandler,
	};
}
