import { type CoreMessage, generateText, streamText } from "ai";
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

export async function streamRouter(messages: CoreMessage[]) {
	const response = await streamText({
		model: bigModel,
		maxSteps: 10,
		temperature: 0.5,
		system: `
			You are an intelligent assistant designed to help users with their requests. You have access to ${Object.keys(toolset).length} specialized tools to enhance your capabilities.

			When responding:
			1. Carefully analyze the user's query to understand their intent
			2. Select and utilize the most appropriate tool(s) when beneficial
			3. Do not mention the existence of tools unless directly relevant to the user's query
			4. If no tools are applicable, provide the most helpful response using your knowledge
			5. Always maintain a helpful, clear, and professional tone

			Your goal is to deliver the most effective assistance possible while keeping interactions natural and focused on the user's needs.
		`,
		messages,
		tools: toolset,
	});

	return response;
}

export async function router(messages: CoreMessage[]) {
	return await generateText({
		model: bigModel,
		maxSteps: 10,
		temperature: 0.5,
		system: `
			You are an intelligent assistant designed to help users with their requests. You have access to ${Object.keys(toolset).length} specialized tools to enhance your capabilities.

			When responding:
			1. Carefully analyze the user's query to understand their intent
			2. Select and utilize the most appropriate tool(s) when beneficial
			3. Do not mention the existence of tools unless directly relevant to the user's query
			4. If no tools are applicable, provide the most helpful response using your knowledge
			5. Always maintain a helpful, clear, and professional tone

			Your goal is to deliver the most effective assistance possible while keeping interactions natural and focused on the user's needs.
		`,
		messages,
		tools: toolset,
	});
}
