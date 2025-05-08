import { Postgres } from "./database";
import { GOOGLE_GENERATIVE_AI_API_KEY, POSTGRES_CONN_URI } from "./secrets";

if ($app.stage !== "prod") {
	new sst.x.DevCommand("DrizzleStudio", {
		link: [Postgres, POSTGRES_CONN_URI, GOOGLE_GENERATIVE_AI_API_KEY],
		dev: {
			directory: "packages/core",
			command: "npx drizzle-kit studio",
		},
	});
}
