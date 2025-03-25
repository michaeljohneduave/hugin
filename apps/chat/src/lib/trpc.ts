import { useSession } from "@clerk/vue";
import type { AppRouter } from "@hugin-bot/functions/src/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const useTrpc = () => {
	const { session } = useSession();

	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `${import.meta.env.VITE_TRPC_URL}`,
				async headers() {
					const token = await session.value?.getToken();
					return {
						Authorization: token ? `Bearer ${token}` : "",
					};
				},
			}),
		],
	});
};
