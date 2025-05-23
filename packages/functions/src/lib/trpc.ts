import type { CustomJwtPayload } from "@hugin-bot/core/src/types";
import { TRPCError, initTRPC } from "@trpc/server";
import type { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import { verifyToken } from "../util";

export function createContext(
	opts: CreateAWSLambdaContextOptions<
		APIGatewayProxyEvent | APIGatewayProxyEventV2
	>
) {
	return {
		token: opts.event.headers.authorization?.split(" ")[1],
	};
}

type Context = ReturnType<typeof createContext>;

export const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(
	async function isAuthed(opts) {
		if (!opts.ctx.token) {
			throw new Error("No token provided");
		}

		try {
			const verifiedToken = (await verifyToken(
				opts.ctx.token
			)) as CustomJwtPayload;

			return opts.next({
				ctx: {
					userId: verifiedToken.sub,
					firstName: verifiedToken.firstName,
					lastName: verifiedToken.lastName,
					imageUrl: verifiedToken.imageUrl,
				},
			});
		} catch (error) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
			});
		}
	}
);
export const router = t.router;
