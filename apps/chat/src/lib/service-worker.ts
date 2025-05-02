import { firebaseConfig } from "./firebase";

export async function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) {
		console.log("[Service Worker] Service Worker not supported");
		return null;
	}

	try {
		// Register or update the service worker
		const registration = await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/',
			type: 'module',
			updateViaCache: 'none' // Ensure the browser always checks for updates
		});

		// Only clear problematic caches (HTML/JS) but keep image and other static asset caches
		const cacheKeys = await caches.keys();
		const problematicCaches = cacheKeys.filter(key => 
			key.includes('html') || key.includes('js') || key.includes('navigation'));
		
		if (problematicCaches.length > 0) {
			await Promise.all(problematicCaches.map((key) => caches.delete(key)));
			console.log("[Service Worker] Cleared problematic caches:", problematicCaches);
		}

		// Pass Firebase configuration to the service worker
		await registration.active?.postMessage({
			type: "FIREBASE_CONFIG",
			config: JSON.stringify(firebaseConfig),
			vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
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
