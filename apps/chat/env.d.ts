/// <reference types="vite/client" />

interface Window {
	mediaRecorder: MediaRecorder;
}

// Type declarations for SST Resource
declare module "sst" {
	export namespace Resource {
		export const WebsocketApi: {
			managementEndpoint: string;
		};

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

		export const Puppeteer: {
			name: string;
		};

		export const POSTGRES_CONN_URI: {
			value: string;
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

		export const CLERK_SECRET_KEY: {
			value: string;
		};

		export const BRAVE_API_KEY: {
			value: string;
		};

		export const GOOGLE_GENERATIVE_AI_API_KEY: {
			value: string;
		};

		export const ClerkPublicKey: {
			key: string;
		};
	}
}
