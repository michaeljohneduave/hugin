import { Postgres } from "./database";
import { cluster } from "./network";
import { POSTGRES_CONN_URI } from "./secrets";

export const task = new sst.aws.Task("ScraperTask", {
	link: [POSTGRES_CONN_URI, Postgres],
	cluster: cluster,
	image: {
		context: ".",
		dockerfile: "packages/scraper/Dockerfile",
	},
	environment: {
		PUPPETEER_USER_DATA_DIR: "/home/mike/.config/puppeteer",
		HOME: "/home/mike",
	},
	dev: {
		command: "bun run packages/scraper/src/index.ts",
	},
});
