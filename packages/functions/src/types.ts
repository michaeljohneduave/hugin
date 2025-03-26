import type { Actions, JwtPayload } from "@clerk/types";

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

export type ChatPayloadBase = {
	senderId: UserId;
	timestamp: number;
};

export type TokenPayload = ChatPayloadBase & {
	action: "verifiedToken";
	token: string;
};

export type RoomPayload = ChatPayloadBase & {
	action: "joinRoom" | "leaveRoom";
	roomId: string;
	members?: UserId[];
};

type MediaFiles = {
	imageFiles?: string[];
	videoFiles?: string[];
	audioFiles?: string[];
};

export type ChatPayload = ChatPayloadBase & {
	action: "sendMessage";
	roomId: string;
	type: "llm" | "user" | "event";
} & XOR<
		{
			message: string;
			mentions?: string[];
		},
		AtLeastOne<MediaFiles>
	>;

export type PingPayload = {
	action: "ping";
	token: string;
};

export type PongPayload = {
	action: "pong";
};

export type MessagePayload =
	| RoomPayload
	| ChatPayload
	| TokenPayload
	| PingPayload
	| PongPayload;
