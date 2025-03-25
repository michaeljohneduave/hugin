import type { Clerk, UserResource } from "@clerk/types";
import { clerk } from "../lib/clerk";

export interface AuthUser {
	id: string;
	name: string;
	avatar?: string;
	email?: string;
	type: "human";
}

export interface AuthService {
	getCurrentUser(): Promise<AuthUser | null>;
	signIn(): Promise<void>;
	signOut(): Promise<void>;
	isAuthenticated(): Promise<boolean>;
	waitForInitialization(): Promise<void>;
	getToken(): Promise<string | null>;
	getClerkInstance(): Clerk | null;
}

class ClerkAuthService implements AuthService {
	private initialized = false;

	private mapClerkUser(clerkUser: UserResource): AuthUser {
		return {
			id: clerkUser.id,
			name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim(),
			avatar: clerkUser.imageUrl,
			email: clerkUser.emailAddresses[0]?.emailAddress,
			type: "human",
		};
	}

	getClerkInstance() {
		return clerk;
	}

	async waitForInitialization(): Promise<void> {
		if (this.initialized) return;

		// Wait for Clerk to be ready
		await clerk.load();
		this.initialized = true;
	}

	async getCurrentUser(): Promise<AuthUser | null> {
		await this.waitForInitialization();
		const user = await clerk.user;
		console.log("getCurrentUser - user:", user);
		return user ? await this.mapClerkUser(user) : null;
	}

	async signIn(): Promise<void> {
		await this.waitForInitialization();

		return new Promise((resolve, reject) => {
			// Listen for sign-in completion
			clerk.addListener(({ user }) => {
				if (user) {
					console.log("Sign in completed - user:", user);
					resolve();
				}
			});

			// Open sign-in modal
			clerk.openSignIn({
				afterSignInUrl: window.location.origin,
				afterSignUpUrl: window.location.origin,
			});
		});
	}

	async signOut(): Promise<void> {
		await this.waitForInitialization();
		await clerk.signOut();
	}

	async isAuthenticated(): Promise<boolean> {
		await this.waitForInitialization();
		const isSignedIn = await clerk.isSignedIn;
		console.log("isAuthenticated:", isSignedIn);
		return isSignedIn;
	}

	async getToken(): Promise<string | null> {
		await this.waitForInitialization();

		if (!((await clerk.isSignedIn) && clerk.session)) {
			return null;
		}
		return clerk.session.getToken(); // Or getToken({template: "yourTemplate"})
	}
}

// Create a singleton instance
export const authService = new ClerkAuthService();

// Export a function to get the auth service
// This allows us to swap implementations if needed
export function getAuthService(): AuthService {
	return authService;
}
