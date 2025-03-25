import { type CoreMessage, streamText } from "ai";
import { bigModel } from "./config";
import { queryVectorDb, searchUrlInDb, transformQuery } from "./tools/query";
import { scrapeUrl, scrapingTaskStatus } from "./tools/scraping";

const toolset = {
	queryVectorDb,
	transformQuery,
	searchUrlInDb,
	scrapeUrl,
	scrapingTaskStatus,
};

export default async function router(messages: CoreMessage[]) {
	const response = await streamText({
		model: bigModel,
		maxSteps: 10,
		temperature: 0.5,
		system: `
			You are an assistant to the user. Help the user with anything it asks.
			You have ${Object.keys(toolset).length} tools to assist the user with.
			Analyze carefully the user's intent or query and use the available tools if needed.
		`,
		messages,
		tools: toolset,
	});

	return response;
}
