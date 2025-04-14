import { Postgres } from "./database";
import { GOOGLE_GENERATIVE_AI_API_KEY, POSTGRES_CONN_URI } from "./secrets";

export const puppeteerFn = new sst.aws.Function("Puppeteer", {
	handler: "packages/functions/src/puppeteer.handler",
	link: [POSTGRES_CONN_URI, Postgres, GOOGLE_GENERATIVE_AI_API_KEY],
	architecture: "arm64",
	memory: "3008 MB",
	timeout: "10 seconds",
	nodejs: {
		install: ["@sparticuz/chromium@133.0.0"],
	},
});
