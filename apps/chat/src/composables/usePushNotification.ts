import { useSession } from "@clerk/vue";
import { getToken, onMessage } from "firebase/messaging";
import { onMounted, reactive, ref } from "vue";
import { onUnmounted, watch } from "vue";
import { messaging } from "../lib/firebase";
import { useNotification } from "./useNotification";
import { useTrpc } from "./useTrpc";

// Constants
const TOKEN_STORAGE_KEY = "fcm_token";
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Types
interface TokenInfo {
	token: string;
	timestamp: number;
}

interface State {
	token: string | null;
	isLoading: boolean;
	isRegistering: boolean;
	isSupported: boolean;
}

const state = reactive<State>({
	token: null,
	isLoading: false,
	isRegistering: false,
	isSupported: false,
});

export function usePushNotification() {
	const notification = useNotification();
	const { session } = useSession();
	const trpc = useTrpc();
	let foregroundUnsubscribe: (() => void) | null = null;

	const isSupported = ref(
		"Notification" in window &&
			"serviceWorker" in navigator &&
			"PushManager" in window
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
		state.token = newToken;
	}

	function removeToken(): string | null {
		const token = state.token;
		localStorage.removeItem(TOKEN_STORAGE_KEY);
		state.token = null;
		return token;
	}

	async function saveTokenToDb(
		newToken: string,
		userId: string
	): Promise<boolean> {
		try {
			await trpc.notifications.savePushSubscription.mutate({
				userId,
				token: newToken,
			});
			return true;
		} catch (error) {
			console.error("[Push Notification] Error registering token:", error);
			return false;
		}
	}

	async function removeTokenFromDb(newToken: string, userId: string) {
		await trpc.notifications.deletePushSubscription.mutate({
			userId,
			token: newToken,
		});
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
			console.log("[Push Notification] Received foreground message:", payload);
			const { data } = payload;

			if (!data) {
				console.error("[Push Notification] No data in foreground message");
				return;
			}

			// Show in-app notification
			notification.success(data.body, {
				title: data.title,
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
			console.log("[Push Notification] Testing push notification...");
			await trpc.notifications.sendPushNotification.mutate({
				userId: session.value.user.id,
				title: "Test Notification",
				body: msg,
				url: "/",
			});
			console.log("[Push Notification] Push notification sent successfully");
			// notification.success("Test notification sent successfully");
		} catch (error) {
			console.error(
				"[Push Notification] Error sending test notification:",
				error
			);
			if (error instanceof Error) {
				notification.error(
					`Failed to send test notification: ${error.message}`
				);
			} else {
				notification.error("Failed to send test notification");
			}
		}
	}

	async function initFirebase(userId: string): Promise<string | null> {
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			if (!registration) {
				console.error(
					"[Push Notification] No service worker registration found"
				);
				return null;
			}

			// Send Firebase config to service worker
			registration.active?.postMessage({
				type: "FIREBASE_CONFIG",
			});

			// Generate and register token
			const newToken = await getToken(messaging, {
				vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
				serviceWorkerRegistration: registration,
			});

			if (!newToken) {
				throw new Error("Failed to generate FCM token");
			}

			setupForegroundHandler();

			state.token = newToken;
			await saveTokenToDb(newToken, userId);
			storeToken(newToken);
			return newToken;
		} catch (error) {
			console.error(
				"[Firebase Messaging] Error setting up push notifications:",
				error
			);
			return null;
		}
	}

	async function enableNotifications() {
		try {
			const userId = session.value!.user.id;
			state.isRegistering = true;

			// Check current permission status
			const currentPermission = await Notification.permission;
			console.log(
				"[Push Notification] Current notification permission:",
				currentPermission
			);
			switch (currentPermission) {
				case "granted":
					// console.log("[FCM Messaging] Permission granted, Init Firebase");
					await initFirebase(userId);
					break;
				case "denied":
					// If previously denied, show a message about enabling in browser settings
					notification.info(
						"Please enable notifications in your browser settings to receive updates",
						{
							title: "Notifications Disabled",
							duration: 10000,
							closeable: true,
						}
					);
					break;
				default:
					notification.info(
						"Click to enable notifications and never miss a message",
						{
							title: "🔔 Get Notified",
							duration: 10000,
							closeable: true,
							onClick: async () => {
								const token = await initFirebase(userId);

								if (token) {
									notification.success("Notifications enabled successfully!");
								} else {
									notification.error(
										"Permission to send notifications was denied"
									);
								}
							},
						}
					);
			}
		} catch (error) {
			console.error("[Push Notification] Error initializing:", error);
		} finally {
			state.isRegistering = false;
		}
	}

	async function disableNotifications() {
		try {
			state.isLoading = true;
			console.log(
				"[Push Notification] Unsubscribing from push notifications..."
			);

			if (!session.value?.user.id) {
				throw new Error("User not logged in");
			}

			const registration = await navigator.serviceWorker.getRegistration();
			const currentToken = await getToken(messaging, {
				vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
				serviceWorkerRegistration: registration,
			});
			await removeTokenFromDb(currentToken, session.value.user.id);

			console.log(
				"[Push Notification] Successfully unsubscribed from push notifications"
			);
			notification.success("Push notifications disabled successfully");
		} catch (error) {
			console.error(
				"[Push Notification] Error unsubscribing from push notifications:",
				error
			);
			if (error instanceof Error) {
				notification.error(
					`Failed to disable push notifications: ${error.message}`
				);
			} else {
				notification.error("Failed to disable push notifications");
			}
			throw error;
		} finally {
			removeToken();
			state.isLoading = false;
		}
	}

	async function handleLogout() {
		const currentToken = removeToken();

		if (currentToken) {
			await removeTokenFromDb(currentToken, session.value!.user.id);
		}
	}

	function swMessageHandler(event: MessageEvent) {
		switch (event.data.type) {
			case "FIREBASE_TOKEN_REFRESH":
				console.log("[Push Notification] Token refreshed:", event.data.token);
				storeToken(event.data.token);
				break;
			case "FIREBASE_PUSH_MESSAGE":
				console.log(
					"[Push Notification] Push message received:",
					event.data.payload
				);
				break;
		}
	}

	onMounted(() => {
		const token = getStoredToken();

		if (token) {
			state.token = token;
		}

		if (isSupported.value) {
			navigator.serviceWorker.addEventListener("message", swMessageHandler);
		} else {
			console.error("[Push Notification] Push notifications not supported");
		}
	});

	// Cleanup on unmount
	onUnmounted(() => {
		if (foregroundUnsubscribe) {
			foregroundUnsubscribe();
		}
	});

	return {
		isSupported,
		state,
		testPushNotification,
		disableNotifications,
		handleLogout,
		enableNotifications,
	};
}
