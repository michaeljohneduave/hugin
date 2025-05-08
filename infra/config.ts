export const clerkPublishableKey = new sst.Linkable("ClerkPublishableKey", {
	properties: {
		key: $dev
			? "pk_test_cG9wdWxhci13ZWV2aWwtNDcuY2xlcmsuYWNjb3VudHMuZGV2JA"
			: "pk_live_Y2xlcmsubWVkdWF2ZS5jb20k",
	},
});

export const firebaseConfig = new sst.Linkable("FirebaseConfig", {
	properties: {
		apiKey: "AIzaSyDy4YGt8efbQbPWsk_VHC5h4KqqRQChz7c",
		authDomain: "hugin-bot.firebaseapp.com",
		projectId: "hugin-bot",
		storageBucket: "hugin-bot.firebasestorage.app",
		messagingSenderId: "87988393213",
		appId: "1:87988393213:web:65269090bd0465bf755a94",
		measurementId: "G-YFF7VZDH5Q",
		vapidPublicKey:
			"BDOSwqeNW7P0czvapv6EvXJMiSBcbBgQzpWs9xXLErvVqWSs0Qvg6m7aR8OlF-HONYQcybU4Q0ttK7fKFeDBfV4",
	},
});
