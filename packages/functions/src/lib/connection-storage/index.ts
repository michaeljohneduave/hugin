import type Valkey from "iovalkey";
import { Resource } from "sst";
import { DynamoConnectionStorage } from "./dynamodb";
import { RedisConnectionStorage } from "./redis";

export type StorageType = "redis" | "dynamodb";

export interface ConnectionStorage {
	// User-Connection operations
	refreshUserConnection(
		userId: string,
		token: string,
		connectionId: string,
	): Promise<void>;
	getUserConnections(userId: string): Promise<string[]>;
	getConnectionData(
		connectionId: string,
	): Promise<{ userId: string; token: string } | null>;
	removeConnection(connectionId: string, userId: string): Promise<void>;

	// Room operations
	addUserToRoom(
		roomId: string,
		userId: string,
		connectionId: string,
	): Promise<void>;
	removeUserFromRoom(roomId: string, userId: string): Promise<void>;
	getRoomMembers(roomId: string): Promise<string[]>;
}

export const CONNECTION_TTL_SECONDS = 600; // 10 minutes

// const redis =
// 	Resource.Valkey.host === "localhost"
// 		? new Valkey({
// 				host: Resource.Valkey.host,
// 				port: Resource.Valkey.port,
// 			})
// 		: new Valkey.Cluster(
// 				[
// 					{
// 						host: Resource.Valkey.host,
// 						port: Resource.Valkey.port,
// 					},
// 				],
// 				{
// 					dnsLookup: (address, callback) => callback(null, address),
// 					slotsRefreshTimeout: 2000,
// 					redisOptions: {
// 						tls: {},
// 						username: Resource.Valkey.username,
// 						password: Resource.Valkey.password,
// 					},
// 				},
// 			);
export class MeasuredConnectionStorage implements ConnectionStorage {
	constructor(private storage: ConnectionStorage) {}

	async refreshUserConnection(
		userId: string,
		token: string,
		connectionId: string,
	): Promise<void> {
		const start = process.hrtime.bigint();
		await this.storage.refreshUserConnection(userId, token, connectionId);
		const end = process.hrtime.bigint();
		console.log(`refreshUserConnection took ${(end - start) / 1_000_000n}ms`);
	}

	async getUserConnections(userId: string): Promise<string[]> {
		const start = process.hrtime.bigint();
		const result = await this.storage.getUserConnections(userId);
		const end = process.hrtime.bigint();
		console.log(`getUserConnections took ${(end - start) / 1_000_000n}ms`);
		return result;
	}

	async getConnectionData(
		connectionId: string,
	): Promise<{ userId: string; token: string } | null> {
		const start = process.hrtime.bigint();
		const result = await this.storage.getConnectionData(connectionId);
		const end = process.hrtime.bigint();
		console.log(`getConnectionData took ${(end - start) / 1_000_000n}ms`);
		return result;
	}

	async removeConnection(connectionId: string, userId: string): Promise<void> {
		const start = process.hrtime.bigint();
		await this.storage.removeConnection(connectionId, userId);
		const end = process.hrtime.bigint();
		console.log(`removeConnection took ${(end - start) / 1_000_000n}ms`);
	}

	async addUserToRoom(
		roomId: string,
		userId: string,
		connectionId: string,
	): Promise<void> {
		const start = process.hrtime.bigint();
		await this.storage.addUserToRoom(roomId, userId, connectionId);
		const end = process.hrtime.bigint();
		console.log(`addUserToRoom took ${(end - start) / 1_000_000n}ms`);
	}

	async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
		const start = process.hrtime.bigint();
		await this.storage.removeUserFromRoom(roomId, userId);
		const end = process.hrtime.bigint();
		console.log(`removeUserFromRoom took ${(end - start) / 1_000_000n}ms`);
	}

	async getRoomMembers(roomId: string): Promise<string[]> {
		const start = process.hrtime.bigint();
		const result = await this.storage.getRoomMembers(roomId);
		const end = process.hrtime.bigint();
		console.log(`getRoomMembers took ${(end - start) / 1_000_000n}ms`);
		return result;
	}
}

export function createConnectionStorage(
	type: StorageType,
	redis?: Valkey,
): ConnectionStorage {
	let storage: ConnectionStorage;

	switch (type) {
		case "redis":
			if (!redis) {
				throw new Error("Redis client is required for Redis storage type");
			}
			storage = new RedisConnectionStorage(redis);
			break;
		case "dynamodb":
			storage = new DynamoConnectionStorage();
			break;
		default:
			throw new Error(`Unsupported storage type: ${type}`);
	}

	return new MeasuredConnectionStorage(storage);
}
