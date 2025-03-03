import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { Resource } from "sst";
import * as schema from "./entities/url.sql";

const { Pool } = pg;

const pool = new Pool({
	connectionString: Resource.POSTGRES_CONN_URI.value,
});

export const db = drizzle(pool, { schema });
