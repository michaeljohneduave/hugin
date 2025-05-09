import {
	type FirebaseApp,
	type FirebaseOptions,
	initializeApp,
} from "firebase/app";
import { type Messaging, getToken } from "firebase/messaging";
import {
	type MessagePayload,
	getMessaging,
	onBackgroundMessage,
} from "firebase/messaging/sw";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
	CacheFirst,
	NetworkFirst,
	NetworkOnly,
	StaleWhileRevalidate,
} from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

// Service Worker for Firebase Cloud Messaging and PWA
const SW_VERSION = "1.0.1";
console.log("[Service Worker] Version:", SW_VERSION);

const manifest = self.__WB_MANIFEST || [];
console.log("[Service Worker] Precache Manifest:", manifest);

// Only precache essential assets and avoid caching HTML/JS that could cause issues
const manifestWithoutHtmlJs = manifest.filter((entry) => {
	const url = typeof entry === "string" ? entry : entry.url;
	return !url.endsWith(".html") && !url.endsWith(".js");
});

console.log(
	"[Service Worker] Precache Manifest without HTML/JS:",
	manifestWithoutHtmlJs
);

console.log("Precaching all assets");

// Only precache static assets like images and icons
precacheAndRoute(manifest);

// registerRoute(
//   ({ request }) => request.destination === 'image',
//   new CacheFirst({
//     cacheName: 'images-cache',
//     plugins: [
//       new ExpirationPlugin({
//         maxEntries: 50,
//         maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
//       }),
//     ],
//   })
// );

// // Use Network First for API calls
// registerRoute(
//   ({ url }) => url.pathname.startsWith('/api/'),
//   new NetworkFirst({
//     cacheName: 'api-cache',
//     plugins: [
//       new ExpirationPlugin({
//         maxEntries: 50,
//         maxAgeSeconds: 5 * 60, // 5 minutes
//       }),
//     ],
//   })
// );

// // Handle navigation requests with Network First to avoid stale content issues
// registerRoute(
//   ({ request }) => request.mode === 'navigate',
//   new NetworkFirst({
//     cacheName: 'navigation-cache',
//     plugins: [
//       new ExpirationPlugin({
//         maxEntries: 10,
//         maxAgeSeconds: 60 * 60, // 1 hour
//       }),
//     ],
//   })
// );

// Constants
const NOTIFICATION_ICON = "/pwa-192x192.png";
const NOTIFICATION_BADGE = "/pwa-mono-192x192.png";
const DEFAULT_TAG = "default";
const TOKEN_STORAGE_KEY = "fcm_token";
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// State
let messaging: Messaging | null = null;
let isInitialized = false;
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function storeToken(newToken: string) {
	const tokenInfo = {
		token: newToken,
		timestamp: Date.now(),
	};
	// self.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenInfo));
}

// Notification options factory
function createNotificationOptions(payload: MessagePayload) {
	if (!payload.notification) {
		console.warn(
			"[Firebase Messaging] No notification payload found. Using default options."
		);
	}
	return {
		body: payload.notification?.body || "Default body text",
		icon: NOTIFICATION_ICON,
		badge: NOTIFICATION_BADGE,
		tag: payload.data?.tag || DEFAULT_TAG,
		data: payload.data,
		actions: [
			{ action: "open", title: "Open" },
			{ action: "close", title: "Close" },
		],
	};
}

// Initialize Firebase
function initializeFirebase(config: FirebaseOptions) {
	if (isInitialized) {
		console.log("[Firebase Messaging] Already initialized");
		return;
	}

	try {
		const app = initializeApp(config);
		messaging = getMessaging(app);
		isInitialized = true;
		console.log("[Firebase Messaging] Initialized successfully");

		// // Set up background message handler once
		// onBackgroundMessage(messaging, handleBackgroundMessage);
	} catch (error) {
		console.error("[Firebase Messaging] Initialization failed:", error);
		throw error;
	}
}

// Handle background messages
function handleBackgroundMessage(payload: MessagePayload) {
	console.log("[Firebase Messaging] Received background message:", payload);
	const notificationTitle = payload.notification?.title || "New Notification";
	const notificationOptions = createNotificationOptions(payload);

	self.registration.showNotification(notificationTitle, notificationOptions);
}

// Handle notification clicks
async function handleNotificationClick(event: NotificationEvent) {
	console.log("[Service Worker] Notification click received:", event);
	event.notification.close();

	if (event.action === "open" && event.notification.data?.url) {
		await event.waitUntil(self.clients.openWindow(event.notification.data.url));
	}
}

// Handle token refresh
async function handleTokenRefresh() {
	try {
		if (!messaging) {
			console.warn(
				"[Firebase Messaging] Messaging not initialized for token refresh."
			);
			return; // Need to ensure Firebase is initialized first
		}

		const newToken = await getToken(messaging, {
			vapidKey: vapidKey,
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

// Handle service worker errors
function handleError(context: string, error: ErrorEvent) {
	console.error("[Service Worker]", context, error);
}

// Event Listeners
self.addEventListener("message", (event) => {
	console.log("[Service Worker] Message received:", event.data);
	switch (event.data?.type) {
		case "SKIP_WAITING":
			console.log("[Service Worker] Skip waiting");
			self.skipWaiting();
			break;
		case "FIREBASE_CONFIG": {
			console.log("[Firebase Messaging] Received configuration");
			initializeFirebase(JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG));
			break;
		}
	}
});

self.addEventListener("install", (event) => {
	console.log("[Service Worker] Installing...");
});

self.addEventListener("activate", (event) => {
	console.log("[Service Worker] Activating...");
	// Clean up old caches managed by Workbox after activation
	event.waitUntil(
		Promise.all([
			// Take control of clients immediately
			self.clients.claim(),
			// Clean up outdated Workbox caches
			cleanupOutdatedCaches(),
		])
	);
});

self.addEventListener("push", (event) => {
	console.log("[Service Worker] Push event received:", event);
	if (event.data) {
		const payload = event.data.json();
		console.log("[Service Worker] Push data:", payload);
		const notificationTitle = payload.notification?.title || "New Notification";
		const notificationOptions = createNotificationOptions(payload);

		event.waitUntil(
			self.registration.showNotification(notificationTitle, notificationOptions)
		);
	} else {
		console.warn("[Service Worker] Push event has no data");
	}
});

self.addEventListener("notificationclick", (event) => {
	console.log("[Service Worker] Notification click event:", event);
	event.waitUntil(handleNotificationClick(event));
});

self.addEventListener("error", (event: ErrorEvent) =>
	handleError("Global Error:", event)
);

self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) =>
	handleError("Unhandled Rejection", event.reason)
);

// Set up token refresh listener
self.addEventListener("pushsubscriptionchange", (event) => {
	console.log("[Service Worker] Push subscription change event:", event);

	handleTokenRefresh().catch((error) => {
		console.error(
			"[Service Worker] Error during push subscription change:",
			error
		);
	});
});
