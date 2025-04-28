import type { ChatPayload, PingPayload } from "@hugin-bot/core/src/types";
import { type Ref, ref } from "vue";

export interface WebSocketClient {
	connect(token: string): void;
	disconnect(): void;
	sendMessage(message: ChatPayload): void;
	addMessageHandler(handler: (event: MessageEvent) => void): void;
	removeMessageHandler(handler: (event: MessageEvent) => void): void;
	onConnected(callback: () => void): void;
	removeConnectionCallback(callback: () => void): void;
	isConnected(): Ref<boolean>;
}

export class WebSocketManager implements WebSocketClient {
	private static instance: WebSocketManager;
	private ws: WebSocket | null = null;

	private messageHandlers: ((event: MessageEvent) => void)[] = [];
	private connectionCallbacks: (() => void)[] = [];

	private readonly PING_INTERVAL = 1000 * 60; // 1 minute
	private lastPongTime = Date.now();
	private pingInterval: ReturnType<typeof setInterval> | null = null;
	private pingCheckInterval: ReturnType<typeof setInterval> | null = null;

	private reconnectAttempts = 0;
	private readonly MAX_RECONNECT_ATTEMPTS = 5;
	private readonly BASE_RECONNECT_DELAY = 1000;

	private isOnline = ref(false);
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private isReconnecting = false;

	private getToken: (() => Promise<string | null>) | null = null;

	// Inactivity timer state
	private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly INACTIVITY_THRESHOLD = 1000 * 60 * 5;
	private isInactive = false;
private isWindowHandlerRegistered = false;

	private constructor() {
		// Set up window focus/blur listeners
if (!this.isWindowHandlerRegistered) {
		window.addEventListener("focus", this.handleFocus);
		window.addEventListener("blur", this.handleBlur);

			this.isWindowHandlerRegistered = true;
		}
	}

	public static getInstance(): WebSocketManager {
		if (!WebSocketManager.instance) {
			WebSocketManager.instance = new WebSocketManager();
		}
		return WebSocketManager.instance;
	}

	private handleFocus = () => {
		if (this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
			this.inactivityTimer = null;
		}

		this.isInactive = false;

		// Attempt to reconnect if we're not connected and not already reconnecting
		if (!this.isOnline.value && !this.isReconnecting && this.getToken) {
			this.getToken().then((token) => {
				if (token) {
					this.connect(token);
				}
			});
		}
	};

	private handleBlur = () => {
		if (!this.inactivityTimer) {
			this.inactivityTimer = setTimeout(() => {
				this.isInactive = true;
				this.disconnect();
			}, this.INACTIVITY_THRESHOLD);
		}
	};

	public setGetToken(getToken: () => Promise<string | null>): void {
		this.getToken = getToken;
	}

	public connect(token: string): void {
		if (!token) {
			throw new Error("No token provided for WebSocket connection");
		}

		if (this.ws?.readyState === WebSocket.OPEN) {
			return;
		}

		// Don't connect if the app is inactive
		if (this.isInactive) {
			return;
		}

		this.reconnectAttempts = 0;
		this.connectInternal(token);
	}

	private connectInternal(token: string): void {
		const wsUrl = `${import.meta.env.VITE_WEBSOCKET_API_URL}?token=${token}`;

		if (!this.ws) {
		this.ws = new WebSocket(wsUrl);
}

		this.ws.onopen = () => {
			this.isOnline.value = true;
			this.lastPongTime = Date.now();
			this.startPingInterval();
			this.reconnectAttempts = 0;
			this.isReconnecting = false;

			// Execute all connection callbacks
			for (const callback of this.connectionCallbacks) {
				callback();
			}
		};

		this.ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			// Handle pong messages
			if (data.type === "pong") {
				this.lastPongTime = Date.now();
				return;
			}

			// Forward message to handlers
			for (const handler of this.messageHandlers) {
				handler(event);
			}
		};

		this.ws.onerror = () => {
			this.isOnline.value = false;
			this.cleanup();
			this.handleReconnect();
		};

		this.ws.onclose = () => {
			this.isOnline.value = false;
			this.cleanup();
			this.handleReconnect();
		};
	}

	private handleReconnect() {
		if (this.isReconnecting || this.isInactive) {
			return;
		}

		if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			console.error("Max reconnection attempts reached");
			this.cleanup();
			return;
		}

		// Calculate delay with exponential backoff: 1s, 2s, 4s, 8s, 16s
		const delay = this.BASE_RECONNECT_DELAY * 2 ** this.reconnectAttempts;
		this.reconnectAttempts++;
		this.isReconnecting = true;

		console.log(
			`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
		);

		this.reconnectTimeout = setTimeout(async () => {
			if (!this.getToken) {
				console.error("No getToken function provided for reconnection");
				return;
			}

			const token = await this.getToken();
			if (token) {
				this.connectInternal(token);
			}
		}, delay);
	}

	private async startPingInterval(): Promise<void> {
		const token = this.getToken && (await this.getToken());

		if (token) {
			this.sendPing({ action: "ping", token });
		}

		// Send ping every minute
		this.pingInterval = setInterval(async () => {
			if (this.ws?.readyState === WebSocket.OPEN && this.getToken) {
				const token = await this.getToken();

				if (token) {
					this.sendPing({ action: "ping", token });
				}
			}
		}, this.PING_INTERVAL);

		// Check for pong response every minute
		this.pingCheckInterval = setInterval(() => {
			const now = Date.now();
			if (now - this.lastPongTime > this.PING_INTERVAL * 3) {
				console.log("No pong received, disconnecting");
				this.disconnect();
			}
		}, this.PING_INTERVAL);
	}

	private cleanup(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
		if (this.pingCheckInterval) {
			clearInterval(this.pingCheckInterval);
			this.pingCheckInterval = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
			this.inactivityTimer = null;
		}
	}

	public disconnect(): void {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
			this.isOnline.value = false;
			this.cleanup();
			this.reconnectAttempts = 0;
		}
	}

	public sendMessage(message: ChatPayload): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	public sendPing(payload: PingPayload): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(payload));
		}
	}

	public addMessageHandler(handler: (event: MessageEvent) => void): void {
		this.messageHandlers.push(handler);
	}

	public removeMessageHandler(handler: (event: MessageEvent) => void): void {
		this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
	}

	public onConnected(callback: () => void): void {
		this.connectionCallbacks.push(callback);
		// If already connected, execute callback immediately
		if (this.isOnline.value) {
			callback();
		}
	}

	public removeConnectionCallback(callback: () => void): void {
		this.connectionCallbacks = this.connectionCallbacks.filter(
			(c) => c !== callback,
		);
	}

	public isConnected(): Ref<boolean> {
		return this.isOnline;
	}
}
