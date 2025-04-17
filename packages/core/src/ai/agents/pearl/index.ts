import {
	type CoreMessage,
	type GenerateTextResult,
	type StreamTextResult,
	generateText,
	streamText,
} from "ai";
import { bigModel } from "../../config";
import { queryVectorDb, searchUrlInDb, transformQuery } from "./query";
import { scrapeUrl, scrapingTaskStatus } from "./scraping";

const toolset = {
	queryVectorDb,
	transformQuery,
	searchUrlInDb,
	scrapeUrl,
	scrapingTaskStatus,
};

const routerPrompt = `
	You are a intelligent task manager that can help users with their requests.
	You have access to ${Object.keys(toolset).length} specialized tools to enhance your capabilities.

	When responding:
	1. Carefully analyze the user's query to understand their intent
	2. Select and utilize the most appropriate tool(s) when beneficial
	3. Do not mention the existence of tools unless directly relevant to the user's query
	4. If no tools are applicable, provide the most helpful response using your knowledge
	5. Always maintain a helpful, clear, and professional tone

	Your goal is to deliver the most effective assistance possible while keeping interactions natural and focused on the user's needs.
	If you can't help the user, say so.
`;

export async function pearlAgent(
	messages: CoreMessage[],
	mode: "stream",
): Promise<StreamTextResult<typeof toolset, string>>;
export async function pearlAgent(
	messages: CoreMessage[],
	mode: "generate",
): Promise<GenerateTextResult<typeof toolset, string>>;
export async function pearlAgent(
	messages: CoreMessage[],
	mode: "stream" | "generate" = "stream",
): Promise<
	| StreamTextResult<typeof toolset, string>
	| GenerateTextResult<typeof toolset, string>
> {
	if (mode === "stream") {
		const response = await streamText({
			model: bigModel,
			maxSteps: 10,
			temperature: 0.5,
			system: routerPrompt,
			messages,
			tools: toolset,
		});

		const x = response.text;

		return response;
	}

	const response = await generateText({
		model: bigModel,
		maxSteps: 10,
		temperature: 0.5,
		system: routerPrompt,
		messages,
		tools: toolset,
	});

	return response;
}
