import { Postgres } from "./database";
import { POSTGRES_CONN_URI } from "./secrets";

if ($app.stage !== "prod") {
	new sst.x.DevCommand("DrizzleStudio", {
		link: [Postgres, POSTGRES_CONN_URI],
		dev: {
			directory: "packages/core",
			command: "npx drizzle-kit studio",
		},
	});
}
