import "./assets/global.css";

import { clerkPlugin } from "@clerk/vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import { initializeClerk } from "./lib/clerk";
import router from "./router";

// Initialize Clerk before mounting the app
initializeClerk()
	.then(() => {
		const app = createApp(App);

		// Initialize Clerk
		const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
		app.use(clerkPlugin, { publishableKey: clerkPubKey });

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
	})
	.catch((error) => {
		console.error("Failed to initialize Clerk:", error);
	});
