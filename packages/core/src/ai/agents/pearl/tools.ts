import type { AgentContext } from "../..";
import { scrapeUrl, scrapingTaskStatus } from "../pearl/scraping";
import { queryVectorDb, searchUrlInDb, transformQuery } from "./query";
export const pearlTools = (context: AgentContext) => {
	const personalTools = {
		scrapeUrl,
	};

	return {
		...personalTools,
	};
};
