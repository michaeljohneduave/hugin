import type Valkey from "iovalkey";
import { CONNECTION_TTL_SECONDS, type ConnectionStorage } from "./index";

export class RedisConnectionStorage implements ConnectionStorage {
	constructor(private redis: Valkey) {}

	async refreshUserConnection(
		userId: string,
		token: string,
		connectionId: string,
	): Promise<void> {
		const pipeline = this.redis.pipeline();
		await pipeline
			.sadd(`user:${userId}`, [connectionId])
			.expire(`user:${userId}`, CONNECTION_TTL_SECONDS)
			.set(
				`connection:${connectionId}`,
				`${userId}--${token}`,
				"EX",
				CONNECTION_TTL_SECONDS,
			)
			.exec();
	}

	async getUserConnections(userId: string): Promise<string[]> {
		return await this.redis.smembers(`user:${userId}`);
	}

	async getConnectionData(
		connectionId: string,
	): Promise<{ userId: string; token: string } | null> {
		const data = await this.redis.get(`connection:${connectionId}`);
		if (!data) return null;
		const [userId, token] = data.split("--");
		return { userId, token };
	}

	async removeConnection(connectionId: string, userId: string): Promise<void> {
		await Promise.allSettled([
			this.redis.del([`connection:${connectionId}`]),
			this.redis.srem(`user:${userId}`, [connectionId]),
		]);
	}

	async addConnIdToRooms(
		roomIds: string[],
		connectionId: string,
	): Promise<void> {
		const pipeline = this.redis.pipeline();

		for (const roomId of roomIds) {
			pipeline.sadd(`room:${roomId}:members`, [connectionId]);
		}

		await pipeline.exec();
	}

	async delConnIdFromRoom(roomId: string, userId: string): Promise<void> {
		await this.redis.srem(`room:${roomId}:members`, [userId]);
	}

	async getRoomConnectionIds(roomId: string): Promise<string[]> {
		return await this.redis.smembers(`room:${roomId}:members`);
	}
}
