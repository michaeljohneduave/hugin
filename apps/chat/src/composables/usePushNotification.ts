import { useSession } from "@clerk/vue";
import { getToken, onMessage } from "firebase/messaging";
import { ref } from "vue";
import { onMounted, onUnmounted, watch } from "vue";
import { messaging } from "../lib/firebase";
import { registerServiceWorker } from "../lib/service-worker";
import { useTrpc } from "../lib/trpc";
import { useAuth } from "./useAuth";
import { useNotification } from "./useNotification";

// Constants
const TOKEN_STORAGE_KEY = "fcm_token";
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Types
interface TokenInfo {
	token: string;
	timestamp: number;
}

interface FirebaseMessagePayload {
	notification: {
		title: string;
		body: string;
		data?: Record<string, string>;
	};
}

interface NotificationAction {
	action: string;
	title: string;
}

interface ExtendedNotificationOptions extends NotificationOptions {
	actions?: NotificationAction[];
}

interface ExtendedNotification extends Notification {
	onactionclick?: (event: { action: string }) => void;
}

interface InAppNotificationOptions {
	onClick?: () => void;
}

export function usePushNotification() {
	const notification = useNotification();
	const { user } = useAuth();
	const { session } = useSession();
	const trpc = useTrpc();
	const token = ref<string | null>(null);
	const isLoading = ref(false);
	const isRegistering = ref(false);
	let foregroundUnsubscribe: (() => void) | null = null;

	const isSupported = ref(
		"Notification" in window &&
			"serviceWorker" in navigator &&
			"PushManager" in window,
	);

	// Token Management
	function getStoredToken(): string | null {
		const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
		if (!stored) return null;

		try {
			const tokenInfo: TokenInfo = JSON.parse(stored);
			// Check if token is expired
			if (Date.now() - tokenInfo.timestamp > TOKEN_EXPIRY) {
				localStorage.removeItem(TOKEN_STORAGE_KEY);
				return null;
			}
			return tokenInfo.token;
		} catch {
			localStorage.removeItem(TOKEN_STORAGE_KEY);
			return null;
		}
	}

	function storeToken(newToken: string): void {
		const tokenInfo: TokenInfo = {
			token: newToken,
			timestamp: Date.now(),
		};
		localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenInfo));
		token.value = newToken;
	}

	function removeToken(): void {
		localStorage.removeItem(TOKEN_STORAGE_KEY);
		token.value = null;
	}

	// Token Generation and Registration
	async function generateToken(
		registration: ServiceWorkerRegistration,
	): Promise<string | null> {
		try {
			const newToken = await getToken(messaging, {
				vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
				serviceWorkerRegistration: registration,
			});

			if (!newToken) {
				throw new Error("Failed to generate FCM token");
			}

			return newToken;
		} catch (error) {
			console.error("[Firebase Messaging] Error generating token:", error);
			return null;
		}
	}

	async function registerToken(
		newToken: string,
		userId: string,
	): Promise<boolean> {
		try {
			await trpc.notifications.savePushSubscription.mutate({
				userId,
				token: newToken,
			});
			storeToken(newToken);
			return true;
		} catch (error) {
			console.error("[Firebase Messaging] Error registering token:", error);
			return false;
		}
	}

	async function unregisterToken(
		newToken: string,
		userId: string,
	): Promise<boolean> {
		try {
			await trpc.notifications.deletePushSubscription.mutate({
				userId,
				token: newToken,
			});
			removeToken();
			return true;
		} catch (error) {
			console.error("[Firebase Messaging] Error unregistering token:", error);
			return false;
		}
	}

	async function requestPermission(): Promise<NotificationPermission> {
		console.log("[Debug] Starting notification permission request");
		if (!isSupported.value) {
			console.error("[Debug] Push notifications not supported");
			notification.error(
				"Push notifications are not supported in this browser",
			);
			return "denied";
		}

		if (!session.value?.user.id) {
			console.error("[Debug] User not logged in");
			notification.error("You must be logged in to enable notifications");
			return "denied";
		}

		const permission = await Notification.requestPermission();
		if (permission !== "granted") {
			return "denied";
		}
		return "granted";
	}

	/**
	 * Sets up the foreground message handler for when the app is open.
	 * This handler is called when a push notification is received while the app is in the foreground.
	 *
	 * For foreground notifications, we only show an in-app notification.
	 * Background notifications are handled by the service worker (firebase-messaging-sw.js).
	 */
	function setupForegroundHandler() {
		foregroundUnsubscribe = onMessage(messaging, (payload) => {
			console.log("[Debug] Received foreground message:", payload);
			const { title, body, data } = (payload as FirebaseMessagePayload)
				.notification;

			// Show in-app notification
			notification.success(body, {
				title,
				duration: 5000, // Show for 5 seconds
				closeable: true, // Allow user to dismiss
				onClick: () => {
					if (data?.url) {
						window.open(data.url, "_blank");
					}
				},
			});
		});
	}

	// Background message handling is done in the service worker
	// The service worker will receive the message and show the notification
	// This is handled in the service-worker.ts file
	async function testPushNotification(msg: string) {
		if (!session.value?.user.id) {
			notification.error("You must be logged in to test notifications");
			return;
		}

		try {
			console.log("[Debug] Testing push notification...");
			await trpc.notifications.sendPushNotification.mutate({
				userId: session.value.user.id,
				title: "Test Notification",
				body: msg,
				url: "/",
			});
			console.log("[Debug] Push notification sent successfully");
			notification.success("Test notification sent successfully");
		} catch (error) {
			console.error("[Debug] Error sending test notification:", error);
			if (error instanceof Error) {
				notification.error(
					`Failed to send test notification: ${error.message}`,
				);
			} else {
				notification.error("Failed to send test notification");
			}
		}
	}

	async function checkNotificationPermission() {
		if (!isSupported.value) {
			console.log("[Debug] Push notifications not supported");
			return "unsupported";
		}

		const permission = await Notification.permission;
		console.log("[Debug] Current notification permission:", permission);
		return permission;
	}

	async function setupPushNotifications(userId: string): Promise<boolean> {
		try {
			// Register service worker
			const registration = await registerServiceWorker();
			if (!registration) return false;

			// Send Firebase config to service worker
			registration.active?.postMessage({
				type: "FIREBASE_CONFIG",
				config: import.meta.env.VITE_FIREBASE_CONFIG,
				vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
			});

			// Generate and register token
			const newToken = await generateToken(registration);
			if (!newToken) return false;

			// Set up foreground message handler
			setupForegroundHandler();

			return await registerToken(newToken, userId);
		} catch (error) {
			console.error(
				"[Firebase Messaging] Error setting up push notifications:",
				error,
			);
			return false;
		}
	}

	async function initialize(userId: string): Promise<boolean> {
		try {
			isRegistering.value = true;

			// Check current permission status
			const currentPermission = await Notification.permission;

			// If permission is already granted, proceed with token setup
			if (currentPermission === "granted") {
				// Check for existing token
				const existingToken = getStoredToken();
				console.log("[Debug] Existing token:", existingToken);
				if (existingToken) {
					// Verify token is still valid
					const isValid = await registerToken(existingToken, userId);
					if (isValid) return true;
				}
			} else if (currentPermission === "default") {
				// First tier: Show friendly in-app notification
				notification.info(
					"Click to enable notifications and never miss a message",
					{
						title: "🔔 Get Notified",
						duration: 10000,
						closeable: true,
						onClick: async () => {
							// Second tier: Show browser permission prompt
							const permission = await Notification.requestPermission();
							if (permission === "granted") {
								const success = await setupPushNotifications(userId);
								if (success) {
									notification.success("Notifications enabled successfully!");
								} else {
									notification.error(
										"Failed to enable notifications. Please try again.",
									);
								}
							} else {
								notification.error(
									"Permission to send notifications was denied",
								);
							}
						},
					},
				);
				return false;
			} else if (currentPermission === "denied") {
				// If previously denied, show a message about enabling in browser settings
				notification.info(
					"Please enable notifications in your browser settings to receive updates",
					{
						title: "Notifications Disabled",
						duration: 10000,
						closeable: true,
					},
				);
				return false;
			}

			// If we get here, either permission was already granted or we need to set up new token
			return await setupPushNotifications(userId);
		} catch (error) {
			console.error("[Firebase Messaging] Error initializing:", error);
			return false;
		} finally {
			isRegistering.value = false;
		}
	}

	async function unsubscribe() {
		try {
			isLoading.value = true;
			console.log("[Debug] Unsubscribing from push notifications...");
			if (!session.value?.user.id) {
				throw new Error("User not logged in");
			}

			const currentToken = getStoredToken();
			if (!currentToken) return true;

			// Clean up the push token
			await unregisterToken(currentToken, session.value.user.id);

			// Revoke notification permission
			const permission = await Notification.requestPermission();
			if (permission === "granted") {
				await Notification.requestPermission();
			}

			console.log("[Debug] Successfully unsubscribed from push notifications");
			notification.success("Push notifications disabled successfully");
		} catch (error) {
			console.error(
				"[Debug] Error unsubscribing from push notifications:",
				error,
			);
			if (error instanceof Error) {
				notification.error(
					`Failed to disable push notifications: ${error.message}`,
				);
			} else {
				notification.error("Failed to disable push notifications");
			}
			throw error;
		} finally {
			isLoading.value = false;
		}
	}

	// Watch for user changes
	watch(
		() => session.value?.user.id,
		async (newUserId) => {
			if (newUserId) {
				await initialize(newUserId);
			} else {
				removeToken();
			}
		},
		{ immediate: true },
	);

	// Cleanup on unmount
	onUnmounted(async () => {
		if (foregroundUnsubscribe) {
			foregroundUnsubscribe();
		}
		if (session.value?.user.id) {
			const currentToken = getStoredToken();
			if (currentToken) {
				await unregisterToken(currentToken, session.value.user.id);
			}
		}
	});

	return {
		isSupported,
		token,
		requestPermission,
		testPushNotification,
		checkNotificationPermission,
		unsubscribe,
		initialize,
		isLoading,
		isRegistering,
		setupPushNotifications,
	};
}
