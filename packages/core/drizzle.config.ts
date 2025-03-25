import { defineConfig } from "drizzle-kit";
import { Resource } from "sst";

// TODO: Move back to core package when fix is released
// https://github.com/drizzle-team/drizzle-orm/issues/2699
export default defineConfig({
	dialect: "postgresql",
	// Pick up all our schema files
	schema: ["./src/**/*.sql.ts"],
	out: "./migrations",
	dbCredentials: {
		ssl: {
			rejectUnauthorized: false,
		},
		url: Resource.POSTGRES_CONN_URI.value,
	},
});
