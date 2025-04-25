import type { JwtPayload } from "@clerk/types";
import type { MessageEntityType } from "@hugin-bot/core/src/entities/message.dynamo";
import type { appRouter } from "@hugin-bot/functions/src/trpc.api";
import type { inferRouterOutputs } from "@trpc/server";
import type { inferRouterInputs } from "@trpc/server";

// Let's go type gymnastics!!
// Helper type to remove properties from T that are in U
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object
	? (Without<T, U> & U) | (Without<U, T> & T)
	: T | U;
type AtLeastOne<T> = {
	[K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];

export type UserId = string;

export type CustomJwtPayload = JwtPayload & {
	firstName: string;
	lastName: string;
	imageUrl: string;
};

export interface User {
	id: string;
	name: string;
	avatar?: string;
	email?: string;
	type: MessageEntityType["type"];
}

export type RoomEvent = MessageEntityType & {
	user: User;
};

// Both for regular user and bot
export type ChatPayload = MessageEntityType & {
	user: User;
};

export type PingPayload = {
	action: "ping";
	token: string;
};

export type PongPayload = {
	action: "pong";
};

export type MessagePayload = ChatPayload | PingPayload | PongPayload;

export type AppRouter = typeof appRouter;
export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
