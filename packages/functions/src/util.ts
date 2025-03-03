import type { Handler } from "aws-lambda";

export function lambdaHandler(fn: Handler) {
	try {
		return fn;
	} catch (e) {
		console.error(e);
	}
}
