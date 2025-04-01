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

interface PushNotificationMessage {
	token: string;
	notification: {
		title: string;
		body: string;
	};
	data?: Record<string, string>;
}

export async function sendPushNotification(
	token: string,
	title: string,
	body: string,
	data?: Record<string, string>,
): Promise<void> {
	try {
		const message: PushNotificationMessage = {
			token,
			notification: {
				title,
				body,
			},
			data,
		};

		await messaging.send(message);
	} catch (error) {
		console.error("[Firebase] Error sending push notification:", error);
		throw error;
	}
}
