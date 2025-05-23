import ChatList from "@/pages/ChatList.vue";
import NewChat from "@/pages/NewChat.vue";
import { useSession } from "@clerk/vue";
import { watch } from "vue";
import {
	type NavigationGuardNext,
	type RouteLocationNormalized,
	createRouter,
	createWebHistory,
} from "vue-router";
import LoginPage from "../components/LoginPage.vue";
import Chat from "../pages/Chat.vue";

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			name: "login",
			path: "/login",
			component: LoginPage,
			meta: { requiresAuth: false },
		},
		{
			name: "chat-list",
			path: "/",
			component: ChatList,
			meta: { requiresAuth: true },
		},
		{
			name: "new-chat",
			path: "/chat/new",
			component: NewChat,
			meta: { requiresAuth: true },
		},
		{
			name: "chat",
			path: "/chat/:roomId",
			component: Chat,
			meta: {
				requiresAuth: true,
			},
		},
	],
});

router.beforeEach(
	async (
		to: RouteLocationNormalized,
		from: RouteLocationNormalized,
		next: NavigationGuardNext
	) => {
		const { isSignedIn, isLoaded } = useSession();

		if (!isLoaded.value) {
			await waitForClerkToLoad();
		}

		try {
			// If trying to access login page while signed in, redirect to home
			if (to.path === "/login" && isSignedIn.value) {
				console.log(
					"Router guard - redirecting to home (already authenticated)"
				);
				next({ path: "/", replace: true });
				return;
			}

			// If trying to access protected route while not signed in, redirect to login
			if (to.meta.requiresAuth && !isSignedIn.value) {
				console.log("Router guard - redirecting to login (not authenticated)");
				next({ path: "/login", replace: true });
				return;
			}

			// Allow navigation in all other cases
			console.log("Router guard - allowing navigation");
			next();
		} catch (error) {
			console.error("Router guard error:", error);
			// On error, redirect to login
			next({ path: "/login", replace: true });
		}
	}
);

async function waitForClerkToLoad() {
	const { isLoaded } = useSession();

	await new Promise((resolve) => {
		watch(isLoaded, (val) => {
			if (val) {
				resolve(true);
			}
		});
	});
}

export default router;
