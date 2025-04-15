import type { Actions, JwtPayload } from "@clerk/types";
import type { MessageEntityType } from "@hugin-bot/core/src/entities/message.dynamo";

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
	messageId: MessageEntityType["messageId"];
	action: "joinRoom" | "leaveRoom";
	roomId: string;
	members?: UserId[];
	type: "event";
};

type MediaFiles = {
	imageFiles?: string[];
	videoFiles?: string[];
	audioFiles?: string[];
};

// Payload has reached the server and has a messageId attached to it
export type ChatPayload = ChatPayloadBase & {
	messageId: MessageEntityType["messageId"];
	threadId?: MessageEntityType["threadId"];
	action: "message";
	roomId: string;
	type: Exclude<MessageEntityType["type"], "event">;
	replyToMessageId?: string;
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
