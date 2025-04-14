import { WebSocketManager } from "@/lib/ws";
import { useAuth, useSession } from "@clerk/vue";
import type { MessagePayload } from "@hugin-bot/functions/src/lib/types";
import { jwtDecode } from "jwt-decode";
import { watch } from "vue";

export function useWebsocket() {
	const ws = WebSocketManager.getInstance();
	const { session, isLoaded } = useSession();
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

		ws.onConnected(() => {
			joinRoom("general");
		});
	};

	const joinRoom = (roomId: string) => {
		if (!session.value?.user) {
			return;
		}

		ws.sendMessage({
			action: "joinRoom",
			roomId,
			timestamp: Date.now(),
			senderId: session.value?.user.id,
		});
	};

	const sendMessage = (message: MessagePayload) => {
		ws.sendMessage(message);
	};

	const addMessageHandler = (handler: (event: MessageEvent) => void) => {
		ws.addMessageHandler(handler);
	};

	const removeMessageHandler = (handler: (event: MessageEvent) => void) => {
		ws.removeMessageHandler(handler);
	};

	watch(
		isLoaded,
		(newVal, oldVal) => {
			if (newVal) {
				connect();
			} else if (oldVal) {
				ws.disconnect();
			}
		},
		{
			immediate: true,
		},
	);

	return {
		isOnline: ws.isConnected(),
		joinRoom,
		sendMessage,
		addMessageHandler,
		removeMessageHandler,
	};
}
