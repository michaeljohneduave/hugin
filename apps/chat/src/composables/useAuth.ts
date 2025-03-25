import { ref } from "vue";
import { type AuthUser, getAuthService } from "../services/auth";

export function useAuth() {
	const user = ref<AuthUser | null>(null);
	const isLoading = ref(true);
	const error = ref<Error | null>(null);
	const token = ref<string | null>(null);
	const authService = getAuthService();

	async function loadUser() {
		try {
			isLoading.value = true;
			await authService.waitForInitialization();
			const currentUser = await authService.getCurrentUser();
			user.value = currentUser;
			token.value = await authService.getToken();
		} catch (e) {
			console.error("Error loading user:", e);
			error.value = e as Error;
		} finally {
			isLoading.value = false;
		}
	}

	async function getToken() {
		const resource = await authService.getClerkInstance()?.session?.touch();
		return await authService.getToken();
	}

	async function signIn() {
		try {
			isLoading.value = true;
			await authService.signIn();
			await loadUser();
		} catch (e) {
			console.error("Error signing in:", e);
			error.value = e as Error;
		} finally {
			isLoading.value = false;
		}
	}

	async function signOut() {
		try {
			isLoading.value = true;
			await authService.signOut();
			user.value = null;
		} catch (e) {
			console.error("Error signing out:", e);
			error.value = e as Error;
		} finally {
			isLoading.value = false;
		}
	}

	// Load user immediately
	loadUser();

	return {
		user,
		isLoading,
		token,
		error,
		signIn,
		signOut,
		loadUser,
		getToken,
	};
}
