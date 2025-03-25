import { Clerk } from "@clerk/clerk-js";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
	throw new Error("Missing Clerk Publishable Key");
}

export const clerk = new Clerk(clerkPubKey);

// Initialize Clerk
export async function initializeClerk() {
	await clerk.load();
	return clerk;
}
