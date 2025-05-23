import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { Resource } from "sst";

// Initialize Firebase Admin
const app = initializeApp({
	credential: cert({
		projectId: Resource.FIREBASE_PROJECT_ID.value,
		clientEmail: Resource.FIREBASE_CLIENT_EMAIL.value,
		privateKey: Resource.FIREBASE_PRIVATE_KEY.value.replace(/\\n/g, "\n"),
	}),
});

const messaging = getMessaging(app);

export async function sendPushNotification({
	token,
	title,
	body,
	data,
}: {
	token: string;
	title: string;
	body: string;
	data?: Record<string, string>;
}): Promise<void> {
	try {
		await messaging.send({
			token,
			data: {
				title,
				body: body,
				icon: "/pwa-192x192.png",
			},
			android: {
				ttl: 1000 * 60 * 60,
				priority: "normal",
			},
			apns: {
				headers: {
					"apns-expiration": `${(Date.now() / 1000 + 3600).toFixed(0)}`,
					"apns-priority": "5",
				},
			},
		});
	} catch (error) {
		console.error("[Firebase] Error sending push notification:", error);
		throw error;
	}
}
