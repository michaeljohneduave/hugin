import {
	WsConnectionEntity,
	WsRoomsEntity,
} from "@hugin-bot/core/src/entities/wsConnection.dynamo";
import { CONNECTION_TTL_SECONDS, type ConnectionStorage } from "./index";

export class DynamoConnectionStorage implements ConnectionStorage {
	async refreshUserConnection(
		userId: string,
		token: string,
		connectionId: string,
	): Promise<void> {
		const now = Date.now();
		await WsConnectionEntity.upsert({
			userId,
			connectionId,
			token,
			createdAt: now,
			expireAt: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
		}).go();
	}

	async getUserConnections(userId: string): Promise<string[]> {
		const connections = await WsConnectionEntity.query
			.primary({
				userId,
			})
			.go();

		return connections.data.map((conn) => conn.connectionId);
	}

	async getConnectionData(
		connectionId: string,
	): Promise<{ userId: string; token: string } | null> {
		const connections = await WsConnectionEntity.query
			.byConnectionId({
				connectionId,
			})
			.go();

		if (connections.data.length === 0) {
			return null;
		}

		const connection = connections.data[0];
		if (!connection.token) {
			return null;
		}

		return {
			userId: connection.userId,
			token: connection.token,
		};
	}

	async removeConnection(connectionId: string): Promise<void> {
		const rooms = await WsRoomsEntity.query
			.byConnectionId({
				connectionId,
			})
			.go();

		await WsRoomsEntity.delete(
			rooms.data.map((room) => ({
				roomId: room.roomId,
				connectionId,
			})),
		).go();
	}

	async addConnIdToRooms(
		roomIds: string[],
		connectionId: string,
	): Promise<void> {
		await WsRoomsEntity.put(
			roomIds.map((roomId) => ({
				roomId,
				connectionId,
				expireAt: Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS,
			})),
		).go();
	}

	async delConnIdFromRoom(roomId: string, connectionId: string): Promise<void> {
		await WsRoomsEntity.remove({
			roomId,
			connectionId,
		}).go();
	}

	async getRoomConnectionIds(roomId: string): Promise<string[]> {
		const members = await WsRoomsEntity.query
			.primary({
				roomId,
			})
			.go({
				pages: "all",
			});

		return members.data.map((member) => member.connectionId);
	}
}
