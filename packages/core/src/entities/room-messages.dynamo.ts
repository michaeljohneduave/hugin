import { Service } from "electrodb";
import { dynamoConfig } from "../electro";
import { MessageEntity } from "./message.dynamo";
import { RoomEntity } from "./room.dynamo";

export const RoomMessagesService = new Service(
	{
		room: RoomEntity,
		message: MessageEntity,
	},
	dynamoConfig,
);
