import { verifyToken as clerkVerifyToken } from "@clerk/backend";
import type { Handler } from "aws-lambda";
import { Resource } from "sst";

export function lambdaHandler(fn: Handler) {
	try {
		return fn;
	} catch (e) {
		console.error(e);
	}
}

export function verifyToken(token: string) {
	return clerkVerifyToken(token, {
		secretKey: Resource.CLERK_SECRET_KEY.value,
		authorizedParties: [
			"http://localhost:5173",
			"https://chat.meduave.com",
			// Add chat app domain here
		],
	});
}
