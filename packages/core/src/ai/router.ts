import { type CoreMessage, streamText } from "ai";
import { bigModel } from "./config";
import { queryVectorDb } from "./tools/query";
import { scrapeUrl, scrapingTaskStatus } from "./tools/scraping";

const toolset = {
	queryVectorDb: queryVectorDb,
	scrapeUrl: scrapeUrl,
	scrapingTaskStatus: scrapingTaskStatus,
};

export default async function router(messages: CoreMessage[]) {
	const response = await streamText({
		model: bigModel,
		maxSteps: 5,
		temperature: 0.5,
		system: `
			You are an assistant to the user. Help the user with anything it asks.
			You have ${Object.keys(toolset).length} tools to assist the user with.
			Analyze carefully the user's intents or queries and use the available tools accordingly.
			Breakdown complex intents into smaller less complex intents.
		`,
		messages,
		tools: toolset,
	});

	return response;
}
