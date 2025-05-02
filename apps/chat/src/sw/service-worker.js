import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// Service Worker for Firebase Cloud Messaging and PWA
const SW_VERSION = "1.0.1";
console.log("[Service Worker] Version:", SW_VERSION);

// Only precache essential assets and avoid caching HTML/JS that could cause issues
const manifestWithoutHtmlJs = self.__WB_MANIFEST.filter(entry => {
  const url = typeof entry === 'string' ? entry : entry.url;
  return !url.endsWith('.html') && !url.endsWith('.js');
});

// Only precache static assets like images and icons
precacheAndRoute(manifestWithoutHtmlJs);

// Cache images with a Cache First strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Use Network First for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Handle navigation requests with Network First to avoid stale content issues
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'navigation-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60, // 1 hour
      }),
    ],
  })
);

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
		if (!messaging) {
			console.warn("[Firebase Messaging] Messaging not initialized for token refresh.");
			return; // Need to ensure Firebase is initialized first
		}

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

self.addEventListener("install", (event) => {
	console.log("[Service Worker] Installing...");
	// Force the waiting service worker to become the active service worker.
	self.skipWaiting(); // <-- Add this
});

self.addEventListener("activate", (event) => {
	console.log("[Service Worker] Activating...");
	// Clean up old caches managed by Workbox after activation
	event.waitUntil(
		Promise.all([
			// Take control of clients immediately
			self.clients.claim(), // <-- Add this
			// Clean up outdated Workbox caches
			cleanupOutdatedCaches(), // <-- Add this for good practice
		]),
	);
});


self.addEventListener("notificationclick", handleNotificationClick);
self.addEventListener("error", (event) => handleError(event.error));
self.addEventListener("unhandledrejection", (event) =>
	handleError(event.reason),
);

// Set up token refresh listener
self.addEventListener("pushsubscriptionchange", () => {
	event.waitUntil(handleTokenRefresh());
});
