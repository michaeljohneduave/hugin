import {
	type NavigationGuardNext,
	type RouteLocationNormalized,
	createRouter,
	createWebHistory,
} from "vue-router";
import GroupChat from "../components/GroupChat.vue";
import LoginPage from "../components/LoginPage.vue";
import { useAuth } from "../composables/useAuth";
import { getAuthService } from "../services/auth";

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			component: GroupChat,
			meta: { requiresAuth: true },
		},
		{
			path: "/login",
			component: LoginPage,
			meta: { requiresAuth: false },
		},
	],
});

router.beforeEach(
	async (
		to: RouteLocationNormalized,
		from: RouteLocationNormalized,
		next: NavigationGuardNext,
	) => {
		const { user, isLoading } = useAuth();
		const authService = getAuthService();

		try {
			// Wait for auth to be initialized
			await authService.waitForInitialization();

			// Check if user is authenticated
			const isAuthenticated = await authService.isAuthenticated();
			console.log("Router guard - isAuthenticated:", isAuthenticated);
			console.log("Router guard - user.value:", user.value);

			// If trying to access login page while signed in, redirect to home
			if (to.path === "/login" && isAuthenticated) {
				console.log(
					"Router guard - redirecting to home (already authenticated)",
				);
				next({ path: "/", replace: true });
				return;
			}

			// If trying to access protected route while not signed in, redirect to login
			if (to.meta.requiresAuth && !isAuthenticated) {
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
	},
);

export default router;
