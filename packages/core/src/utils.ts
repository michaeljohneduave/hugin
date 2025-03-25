export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function tryCatch<T>(
	promise: () => Promise<T>,
): Promise<[T, null] | [null, Error]> {
	try {
		return [await promise(), null];
	} catch (error) {
		if (error instanceof Error) {
			return [null, error];
		}

		return [null, new Error(String(error))];
	}
}
