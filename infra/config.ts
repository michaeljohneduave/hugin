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

export const clerkPublicKey = new sst.Linkable("ClerkPublicKey", {
	properties: {
		key: $dev
			? `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzFaMB/s+aN/UhplUGCWo
V6FK/OKc8rzf7BJy8Z0b4i4NO9njTzAo8cMC4v1ls+1uMQXnmMc8o54asGtpYbFo
HfQTQtX+b23z1znlWHfik0+9r7MU8RHlnWUtC9QV521waMg42Ozbk81nNB1TZeNi
4rRacHdOwDl96Sr8qk7myOXb8busQ+DMIv4aJIGC/24paxqCpRvN4CiX1Pw3K7ov
eD9GKRdAIBIuq/oz9XeHT9W4/hyXgsj3E911/8jvv0h8L/O0KuYC9+25YxVUq5+7
/lql2v1F4sX9N9kbQ/bTYWfAYPIVSy+o/A+hUxe0sZoOGbx+RfoS/96KCmL46ETi
5wIDAQAB
-----END PUBLIC KEY-----
`
			: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvwLCSgbkpijO838/XNtT
uEGGHlOpGuYiv5tiACbsPG4CXwcMvz4Y0jmEX7ffGoMGBI+NYHi0XZLtwxC9S5ai
saHlGnvvVtnBwB02351CSDZbl9FrzZySj8o8MXTQbCMvl+5WiYAZ04NybaNIZo34
7//+UVbCoXC/r8BHKuKr1x9VSrYNwoYWeH1YSd/O/GWl7LQQM0NUlzt6k1+IxKcK
cUJDriW8Goi/diG3RP5lYlR9cfjG2OxvhjRddSsYuteKuHbZVhf2MiLEtwUpjsLp
875cfZC/VtDr57mYWEWtgllPoobkaMyHEvqg2x+S2TLbWf01S5Ewe0R52brFzao4
WQIDAQAB
-----END PUBLIC KEY-----
`,
	},
});
