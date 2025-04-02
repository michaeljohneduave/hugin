import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { precacheAndRoute } from "workbox-precaching";

// Service Worker for Firebase Cloud Messaging
const SW_VERSION = "1.0.0";
console.log("[Service Worker] Version:", SW_VERSION);

precacheAndRoute(self.__WB_MANIFEST);

// Constants
const NOTIFICATION_ICON = "/pwa-192x192.png";
const DEFAULT_TAG = "default";
const TOKEN_STORAGE_KEY = "fcm_token";
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// State
let messaging = null;
let isInitialized = false;

function storeToken(newToken) {
	const tokenInfo = {
		token: newToken,
		timestamp: Date.now(),
	};
	self.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenInfo));
}

// Notification options factory
function createNotificationOptions(payload) {
	return {
		body: payload.notification.body,
		icon: NOTIFICATION_ICON,
		badge: NOTIFICATION_ICON,
		tag: payload.data?.tag || DEFAULT_TAG,
		data: payload.data,
		actions: [
			{ action: "open", title: "Open" },
			{ action: "close", title: "Close" },
		],
	};
}

// Initialize Firebase
function initializeFirebase(config) {
	if (isInitialized) {
		console.log("[Firebase Messaging] Already initialized");
		return;
	}

	try {
		const app = initializeApp(config);
		messaging = getMessaging(app);
		isInitialized = true;
		console.log("[Firebase Messaging] Initialized successfully");

		// Set up background message handler once
		onBackgroundMessage(messaging, handleBackgroundMessage);
	} catch (error) {
		console.error("[Firebase Messaging] Initialization failed:", error);
		throw error;
	}
}

// Handle background messages
async function handleBackgroundMessage(payload) {
	try {
		console.log("[Firebase Messaging] Received background message:", payload);
		const notificationTitle = payload.notification.title;
		const notificationOptions = createNotificationOptions(payload);

		await self.registration.showNotification(
			notificationTitle,
			notificationOptions,
		);
	} catch (error) {
		console.error("[Firebase Messaging] Error showing notification:", error);
	}
}

// Handle notification clicks
async function handleNotificationClick(event) {
	console.log("[Service Worker] Notification click received:", event);
	event.notification.close();

	if (event.action === "open" && event.notification.data?.url) {
		await event.waitUntil(clients.openWindow(event.notification.data.url));
	}
}

// Handle service worker errors
function handleError(error) {
	console.error("[Service Worker] Error:", error);
}

// Handle token refresh
async function handleTokenRefresh() {
	try {
		const newToken = await messaging.getToken({
			vapidKey: self.FIREBASE_VAPID_KEY,
		});
		if (newToken) {
			console.log("[Firebase Messaging] Token refreshed:", newToken);
			storeToken(newToken);
			// Notify the client about the new token
			const clients = await self.clients.matchAll();
			for (const client of clients) {
				client.postMessage({
					type: "FIREBASE_TOKEN_REFRESH",
					token: newToken,
				});
			}
		}
	} catch (error) {
		console.error("[Firebase Messaging] Error refreshing token:", error);
	}
}

// Event Listeners
self.addEventListener("message", (event) => {
	if (event.data?.type === "FIREBASE_CONFIG") {
		try {
			const config = JSON.parse(event.data.config);
			self.FIREBASE_VAPID_KEY = event.data.vapidKey;
			console.log("[Firebase Messaging] Received configuration");
			initializeFirebase(config);
		} catch (error) {
			console.error("[Firebase Messaging] Configuration error:", error);
		}
	}
});

self.addEventListener("notificationclick", handleNotificationClick);
self.addEventListener("error", (event) => handleError(event.error));
self.addEventListener("unhandledrejection", (event) =>
	handleError(event.reason),
);

// Set up token refresh listener
self.addEventListener("pushsubscriptionchange", () => {
	handleTokenRefresh();
});
