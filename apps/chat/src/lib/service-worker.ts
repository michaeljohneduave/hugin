import { firebaseConfig } from "./firebase";

export async function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) {
		console.log("[Service Worker] Service Worker not supported");
		return null;
	}

	try {
		const [registration] = await navigator.serviceWorker.getRegistrations();

		const cacheKeys = await caches.keys();
		await Promise.all(cacheKeys.map((key) => caches.delete(key)));
		console.log("[Service Worker] Cleared existing caches");

		// Pass Firebase configuration to the service worker
		await registration.active?.postMessage({
			type: "FIREBASE_CONFIG",
			config: JSON.stringify(firebaseConfig),
		});

		console.log("[Service Worker] Registration successful:", registration);
		return registration;
	} catch (error) {
		if (error instanceof Error) {
			console.error("[Service Worker] Error details:", error.message);
		} else {
			console.error("[Service Worker] Registration failed:", error);
		}
		return null;
	}
}
