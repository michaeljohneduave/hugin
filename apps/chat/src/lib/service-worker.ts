import { firebaseConfig } from "./firebase";

export async function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) {
		console.log("[Service Worker] Service Worker not supported");
		return null;
	}

	try {
		// Unregister any existing service workers
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(
			registrations.map((registration) => registration.unregister()),
		);
		console.log("[Service Worker] Unregistered existing service workers");

		const registration = await navigator.serviceWorker.register(
			"/firebase-messaging-sw.js",
			{
				scope: "/",
			},
		);

		// Pass Firebase configuration to the service worker
		await registration.active?.postMessage({
			type: "FIREBASE_CONFIG",
			config: JSON.stringify(firebaseConfig),
		});

		console.log("[Service Worker] Registration successful:", registration);
		return registration;
	} catch (error) {
		console.error("[Service Worker] Registration failed:", error);
		if (error instanceof Error) {
			console.error("[Service Worker] Error details:", error.message);
		}
		return null;
	}
}
