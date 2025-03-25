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
	}
}
