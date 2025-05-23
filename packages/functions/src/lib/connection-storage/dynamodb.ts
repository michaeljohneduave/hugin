import { RoomEntity } from "@hugin-bot/core/src/entities/room.dynamo";
import {
	WsConnectionEntity,
	WsRoomsEntity,
} from "@hugin-bot/core/src/entities/wsConnection.dynamo";
import { CONNECTION_TTL_SECONDS, type ConnectionStorage } from "./index";

export class DynamoConnectionStorage implements ConnectionStorage {
	// Called 1/min/user for ping messages
	async refreshUserConnection(
		userId: string,
		token: string,
		connectionId: string
	): Promise<void> {
		const now = Date.now();
		await WsConnectionEntity.upsert({
			userId,
			connectionId,
			token,
			createdAt: now,
			expireAt: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
		}).go();

		const rooms = await RoomEntity.query
			.byUser({
				userId,
			})
			.where((attr, op) => op.eq(attr.type, "group"))
			.go();

		// Refresh the user's connection in all rooms
		// Should only be one operation instead of this
		// await Promise.all(
		// 	rooms.data.map((room) =>
		// 		WsRoomsEntity.upsert({
		// 			roomId: room.roomId,
		// 			connectionId,
		// 			expireAt: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
		// 		}).go({
		// 			response: "none",
		// 		})
		// 	)
		// );

		// We only refresh non llm rooms to save writes
		await WsRoomsEntity.put(
			rooms.data.map((room) => ({
				roomId: room.roomId,
				connectionId,
				expireAt: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
			}))
		).go();
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
		connectionId: string
	): Promise<{ userId: string; token: string } | null> {
		const connections = await WsConnectionEntity.query
			.byConnection({
				connectionId,
			})
			.go({
				pages: "all",
			});

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
		const rooms = await WsRoomsEntity.query
			.byConnection({
				connectionId,
			})
			.go();

		await Promise.all([
			WsRoomsEntity.delete(
				rooms.data.map((room) => ({
					roomId: room.roomId,
					connectionId,
				}))
			).go(),
			WsConnectionEntity.delete({
				userId,
				connectionId,
			}).go(),
		]);
	}

	async addConnIdToRooms(
		roomIds: string[],
		connectionId: string
	): Promise<void> {
		await WsRoomsEntity.put(
			roomIds.map((roomId) => ({
				roomId,
				connectionId,
				expireAt: Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS,
			}))
		).go();
	}

	async delConnIdFromRoom(roomId: string, connectionId: string): Promise<void> {
		await WsRoomsEntity.remove({
			roomId,
			connectionId,
		}).go();
	}

	// Called every time a user sends a message
	async getConnectionIdsByRoom(
		userId: string,
		roomId: string
	): Promise<string[]> {
		const userConnections = await this.getUserConnections(userId);
		const members = await WsRoomsEntity.query
			.primary({
				roomId,
			})
			.go({
				pages: "all",
			});

		return [
			...new Set(
				userConnections.concat(
					members.data.map((member) => member.connectionId)
				)
			),
		];
	}

	async getRoomsByConnectionId(connectionId: string): Promise<string[]> {
		const rooms = await WsRoomsEntity.query
			.byConnection({
				connectionId,
			})
			.go();

		return rooms.data.map((room) => room.roomId);
	}
}
