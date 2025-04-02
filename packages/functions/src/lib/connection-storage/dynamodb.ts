import { WsConnectionEntity } from "@hugin-bot/core/src/entities/wsConnection.dynamo";
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

	async removeConnection(connectionId: string, userId: string): Promise<void> {
		await WsConnectionEntity.delete({
			userId,
			connectionId,
		}).go();
	}

	async addUserToRoom(
		roomId: string,
		userId: string,
		connectionId: string,
	): Promise<void> {
		const now = Date.now();
		await WsConnectionEntity.upsert({
			userId,
			connectionId,
			roomId,
			expireAt: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
		}).go();
	}

	async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
		const records = await WsConnectionEntity.query
			.byRoomId({
				roomId,
				userId,
			})
			.go();

		await WsConnectionEntity.delete(
			records.data.map((data) => ({
				userId: data.userId,
				connectionId: data.connectionId,
			})),
		).go();
	}

	async getRoomMembers(roomId: string): Promise<string[]> {
		const members = await WsConnectionEntity.query
			.byRoomId({
				roomId,
			})
			.go();

		// Get unique userIds from connections
		return [...new Set(members.data.map((member) => member.userId))];
	}
}
