import { Postgres } from "./postgres";
import { task } from "./puppeteer";
import { GOOGLE_GENERATIVE_AI_API_KEY, POSTGRES_CONN_URI } from "./secrets";

// export const myApi = new sst.aws.Function("MyApi", {
// 	url: true,
// 	link: [bucket, database, queue],
// 	handler: "packages/functions/src/api.handler",
// });

export const scraper = new sst.aws.Function("companyScrapeHandler", {
	url: true,
	link: [task, Postgres, POSTGRES_CONN_URI],
	handler: "packages/functions/src/api.scrapeCompanyUrl",
	environment: {
		GOOGLE_GENERATIVE_AI_API_KEY: GOOGLE_GENERATIVE_AI_API_KEY.value,
	},
});
