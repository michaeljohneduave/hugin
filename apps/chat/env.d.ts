/// <reference types="vite/client" />

interface Window {
	mediaRecorder: MediaRecorder;
}

// Type declarations for SST Resource
declare module "sst" {
	export namespace Resource {
		export const MessageTable: {
			name: string;
		};

		export const GIPHY_API_KEY: {
			type: string;
			value: string;
		};

		export const Valkey: {
			host: string;
			port: number;
			username: string;
			password: string;
		};

		export const FirebaseConfig: {
			vapidPublicKey: string;
		};

		export const VAPID_PRIVATE_KEY: {
			value: string;
		};

		export const FIREBASE_PROJECT_ID: {
			value: string;
		};

		export const FIREBASE_PRIVATE_KEY: {
			value: string;
		};

		export const FIREBASE_CLIENT_EMAIL: {
			value: string;
		};
	}
}
