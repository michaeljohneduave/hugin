import {
	type inferRouterInputs,
	type inferRouterOutputs,
	initTRPC,
} from "@trpc/server";
import type { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import type { appRouter } from "./trpc.api";

export function createContext(
	opts: CreateAWSLambdaContextOptions<
		APIGatewayProxyEvent | APIGatewayProxyEventV2
	>,
) {
	return {};
}

type Context = ReturnType<typeof createContext>;

export const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(function isAuthed(opts) {
	return opts.next({
		ctx: {
			session: "sessionHere",
		},
	});
});
export const router = t.router;

export type AppRouter = typeof appRouter;
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
