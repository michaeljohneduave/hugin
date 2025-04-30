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

	// Ping/Pong settings
	private readonly PING_INTERVAL = 1000 * 60; // 1 minute
	private lastPongTime = Date.now();
	private pingInterval: ReturnType<typeof setInterval> | null = null;
	private pingCheckInterval: ReturnType<typeof setInterval> | null = null;

	// Reconnection settings
	private reconnectAttempts = 0;
	private readonly MAX_RECONNECT_ATTEMPTS = 5;
	private readonly BASE_RECONNECT_DELAY = 1000; // 1 second
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private isReconnecting = false; // Flag to prevent multiple concurrent reconnect loops

	// Vue reactive state
	private isOnline = ref(false);

	// Ensure event listeners are added only once
	private static eventListenersRegistered = false;

	private constructor() {
		// Private constructor for singleton
		this.registerEventListeners();
	}

	public static getInstance(): WebSocketManager {
		if (!WebSocketManager.instance) {
			WebSocketManager.instance = new WebSocketManager();
		}
		return WebSocketManager.instance;
	}

	// Register essential event listeners
	private registerEventListeners(): void {
		// Prevent duplicate listeners if getInstance is called multiple times (though unlikely with correct singleton usage)
		if (WebSocketManager.eventListenersRegistered) {
			return;
		}
		console.log("Registering WebSocketManager event listeners");
		window.addEventListener("online", this.handleOnline);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		// Optional: Listen for page unload to explicitly close
		window.addEventListener("beforeunload", this.handleBeforeUnload);

		WebSocketManager.eventListenersRegistered = true;
	}

	// --- Event Handlers ---
	private handleOnline = () => {
		console.log("Browser came online");
		// Add a small delay to allow network stack to stabilize
		setTimeout(() => this.checkAndReconnectIfNeeded("online"), 100);
	};

	private handleVisibilityChange = () => {
		console.log(`Document visibility changed to: ${document.visibilityState}`);
		if (document.visibilityState === "visible") {
			// Add a small delay when becoming visible
			setTimeout(() => this.checkAndReconnectIfNeeded("visibilitychange"), 100);
		}
		// No action needed when hidden, rely on ping/pong or OS disconnect
	};

	private handleBeforeUnload = () => {
		console.log("Page unloading, disconnecting WebSocket.");
		this.disconnect(true); // Indicate intentional disconnect on unload
	};

	/**
	 * Initiates a WebSocket connection. If already connected, does nothing.
	 * Resets any reconnection backoff attempts.
	 */
	public connect(token: string) {
		if (!token) {
			console.error("WebSocket connect: No token provided.");
			throw new Error("No token provided for WebSocket connection");
		}

		// Don't reconnect if already open or connecting
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN ||
				this.ws.readyState === WebSocket.CONNECTING)
		) {
			console.log("WebSocket connect: Already open or connecting.");
			return;
		}

		console.log("WebSocket connect: Initiating connection...");
		// Reset state for a fresh connection attempt
		this.resetReconnectionState();
		this.isReconnecting = true; // Mark as (re)connecting during this attempt
		this.connectInternal(token);
	}

	/**
	 * Closes the WebSocket connection intentionally.
	 */
	public disconnect(isUnloading = false): void {
		console.log("WebSocket disconnect: Closing connection intentionally.");
		this.resetReconnectionState(); // Stop any scheduled reconnections
		if (this.ws) {
			// Remove listeners before closing to prevent onclose handler
			// from triggering reconnection logic after manual disconnect.
			this.ws.onopen = null;
			this.ws.onmessage = null;
			this.ws.onerror = null;
			this.ws.onclose = null;
			// Use code 1000 for normal closure
			this.ws.close(1000, isUnloading ? "Page unloading" : "Manual disconnect");
			this.ws = null;
		}
		this.isOnline.value = false;
		this.cleanupTimers(); // Clean up ping/pong timers
	}

	public sendMessage(message: ChatPayload): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn("WebSocket sendMessage: Connection not open.");
			// TODO: Queue message or throw error?
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

	// --- Internal Logic ---

	/**
	 * Central function to check if a reconnection attempt is needed.
	 * Triggered by events like 'online' or 'visibilitychange'.
	 */
	private async checkAndReconnectIfNeeded(trigger: string): Promise<void> {
		console.log(
			`Checking connection status (triggered by ${trigger}): isOnline=${this.isOnline.value}, wsState=${this.ws?.readyState}, isReconnecting=${this.isReconnecting}`,
		);

		// Don't attempt if already connected, connecting, or in a backoff loop
		if (
			this.isOnline.value ||
			this.ws?.readyState === WebSocket.CONNECTING ||
			this.ws?.readyState === WebSocket.OPEN ||
			this.isReconnecting // Respect the backoff timer if it's running
		) {
			console.log(
				"Check skipped: Connection is active or reconnection attempt already in progress.",
			);
			return;
		}

		console.log(`Attempting to reconnect (triggered by ${trigger})...`);
		// Reset backoff state and try connecting immediately
		this.resetReconnectionState();
		this.isReconnecting = true; // Mark that we are initiating a connection attempt

		try {
			const token = await window.Clerk.session?.getToken();
			if (token) {
				this.connectInternal(token);
			} else {
				console.error(
					"Failed to get token for reconnection (checkAndReconnectIfNeeded).",
				);
				this.isReconnecting = false; // Reset flag if token fails
			}
		} catch (error) {
			console.error(
				"Error getting token for reconnection (checkAndReconnectIfNeeded):",
				error,
			);
			this.isReconnecting = false; // Reset flag on error
		}
	}

	/**
	 * Core connection logic. Always creates a new WebSocket instance.
	 */
	private connectInternal(token: string): void {
		const wsUrl = `${import.meta.env.VITE_WEBSOCKET_API_URL}?token=${token}`;

		// 1. Clean up any existing socket and its timers/listeners
		if (this.ws) {
			console.log(
				"Cleaning up previous WebSocket instance before reconnecting.",
			);
			// Remove listeners to prevent them firing on the old instance
			this.ws.onopen = null;
			this.ws.onmessage = null;
			this.ws.onerror = null;
			this.ws.onclose = null;
			if (
				this.ws.readyState !== WebSocket.CLOSED &&
				this.ws.readyState !== WebSocket.CLOSING
			) {
				this.ws.close();
			}
		}
		this.cleanupTimers(); // Clear any running timers (ping, pong check, reconnect)

		// 2. Create the new WebSocket instance
		console.log(`Creating new WebSocket connection to ${wsUrl}`);
		this.ws = new WebSocket(wsUrl);
		this.isOnline.value = false; // Explicitly set to false until onopen

		// 3. Assign event handlers to the new instance
		this.ws.onopen = () => {
			console.log("WebSocket connection established.");
			this.isOnline.value = true;
			this.isReconnecting = false; // Successfully connected, no longer "reconnecting"
			this.reconnectAttempts = 0; // Reset counter on successful connection
			this.lastPongTime = Date.now();
			this.startPingPongChecks(); // Start keep-alive for the new connection

			// Notify listeners
			for (const callback of this.connectionCallbacks) {
				try {
					callback();
				} catch (err) {
					console.error("Error in onConnected callback:", err);
				}
			}
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data as string);
				// Handle pong messages for keep-alive
				if (data.type === "pong") {
					// console.debug("Pong received");
					this.lastPongTime = Date.now();
					return;
				}
			} catch (e) {
				// Ignore non-JSON messages or handle as needed
				// console.warn("Received non-JSON WebSocket message:", event.data);
			}

			// Forward message to registered handlers
			for (const handler of this.messageHandlers) {
				try {
					handler(event);
				} catch (err) {
					console.error("Error in message handler:", err);
				}
			}
		};

		this.ws.onerror = (event) => {
			// Log the error, but don't try to reconnect here.
			// The 'onclose' event will almost always follow an error.
			console.error("WebSocket error:", event);
			this.isOnline.value = false; // Ensure state reflects the error
			// Note: isReconnecting might already be true if error occurs during initial connectInternal call
		};

		this.ws.onclose = (event) => {
			console.log(
				`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason || "N/A"}, Clean: ${event.wasClean}`,
			);
			this.isOnline.value = false;
			this.cleanupTimers(); // Stop ping/pong on close

			// Check if the closure was unexpected and we should attempt to reconnect
			// Code 1000 is normal closure (e.g., called by disconnect())
			// Code 1005 is "No Status Received" - often happens on abnormal closures
			// Code 1006 is "Abnormal Closure" - also common for network issues
			// Avoid reconnecting if it was a clean, intentional close (code 1000)
			// or if we are already in a reconnection backoff loop.
			if (event.code !== 1000 && !this.isReconnecting) {
				console.log(
					"Unexpected closure detected, initiating reconnect sequence.",
				);
				this.handleReconnect();
			} else {
				console.log(
					`Skipping reconnect sequence (Code: ${event.code}, isReconnecting: ${this.isReconnecting})`,
				);
				// Ensure flag is false if we are not starting a reconnect sequence
				this.isReconnecting = false;
				this.ws = null; // Clear reference after close
			}
		};
	}

	/**
	 * Handles the exponential backoff reconnection strategy.
	 * Called by `onclose` after an unexpected disconnection.
	 */
	private handleReconnect(): void {
		if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			console.error("Max reconnection attempts reached. Stopping attempts.");
			this.resetReconnectionState(); // Give up after max attempts
			return;
		}

		// Set flag immediately to prevent concurrent attempts from onclose or checks
		this.isReconnecting = true;

		const delay = this.BASE_RECONNECT_DELAY * 2 ** this.reconnectAttempts;
		this.reconnectAttempts++;

		console.log(
			`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`,
		);

		// Clear previous timeout just in case (shouldn't be necessary but safe)
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}

		this.reconnectTimeout = setTimeout(async () => {
			// Check if still marked as reconnecting (could have been cancelled by manual connect/disconnect)
			if (!this.isReconnecting) {
				console.log("Reconnect cancelled during timeout.");
				return;
			}

			console.log(`Executing reconnect attempt ${this.reconnectAttempts}...`);
			try {
				const token = await window.Clerk.session?.getToken();
				if (token) {
					// connectInternal will reset isReconnecting on success/failure path
					this.connectInternal(token);
				} else {
					console.error("Failed to get token during reconnect attempt.");
					// If token fails, schedule the *next* reconnect attempt
					this.isReconnecting = false; // Allow next attempt
					this.handleReconnect(); // Try again after next delay
				}
			} catch (error) {
				console.error("Error getting token during reconnect attempt:", error);
				// Also schedule the next attempt on error
				this.isReconnecting = false; // Allow next attempt
				this.handleReconnect(); // Try again after next delay
			}
		}, delay);
	}

	/**
	 * Starts the ping sending and pong checking intervals.
	 */
	private async startPingPongChecks(): Promise<void> {
		console.log("Starting ping/pong checks.");
		this.cleanupTimers(); // Ensure no old timers are running

		// Initial Ping
		this.sendPing();

		// Send ping periodically
		this.pingInterval = setInterval(() => {
			this.sendPing();
		}, this.PING_INTERVAL);

		// Check if pong was received recently
		this.pingCheckInterval = setInterval(() => {
			const now = Date.now();
			// Allow some grace period (e.g., 2.5x interval) before disconnecting
			const pongTimeoutThreshold = this.PING_INTERVAL * 2.5;
			if (now - this.lastPongTime > pongTimeoutThreshold) {
				console.warn(
					`No pong received in ${pongTimeoutThreshold}ms. Disconnecting.`,
				);
				// Treat lack of pong as a connection failure
				if (this.ws) {
					// Close will trigger onclose, which should handle reconnect logic
					this.ws.close(1006, "Ping timeout");
				}
				this.cleanupTimers(); // Stop checks immediately
			}
		}, this.PING_INTERVAL); // Check pong status at the same frequency as ping
	}

	/**
	 * Sends a ping message if the connection is open.
	 */
	private async sendPing(): Promise<void> {
		if (this.ws?.readyState === WebSocket.OPEN) {
			try {
				const token = await window.Clerk.session?.getToken(); // Get fresh token if needed by ping payload
				if (token) {
					const pingPayload: PingPayload = { action: "ping", token: token };
					// console.debug("Sending ping");
					this.ws.send(JSON.stringify(pingPayload));
				} else {
					console.warn("Could not send ping: failed to get token.");
				}
			} catch (error) {
				console.error("Error getting token for ping:", error);
			}
		}
	}

	/**
	 * Clears all running timers (ping, pong check, reconnect).
	 */
	private cleanupTimers(): void {
		// console.debug("Cleaning up timers");
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
	}

	/**
	 * Resets the state related to reconnection attempts.
	 */
	private resetReconnectionState(): void {
		console.log("Resetting reconnection state.");
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		this.reconnectAttempts = 0;
		this.isReconnecting = false;
	}
}
