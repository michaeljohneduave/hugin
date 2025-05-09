import "./assets/global.css";
import { clerkPlugin } from "@clerk/vue";
import * as Sentry from "@sentry/vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import { WebSocketManager } from "./lib/wsClient";
import router from "./router";

WebSocketManager.getInstance();

const app = createApp(App);

Sentry.init({
	app,
	dsn: "https://81a73f85728a848ffc4d7280618530d1@o4506177071808512.ingest.us.sentry.io/4509244796108800",
	// Setting this option to true will send default PII data to Sentry.
	// For example, automatic IP address collection on events
	sendDefaultPii: true,
	environment: import.meta.env.MODE,
	tracesSampleRate: 1.0,
	tracePropagationTargets: ["localhost", /^https:\/\/hugin-api.meduave.com/],
});

// Initialize Clerk
app.use(clerkPlugin, {
	publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
});

// Use router
app.use(router);

// Initialize Vue Query
app.use(VueQueryPlugin, {
	queryClient: new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 30, // 30 minutes
				retry: 1,
			},
		},
	}),
});

app.mount("#app");
