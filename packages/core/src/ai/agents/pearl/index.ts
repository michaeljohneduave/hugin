import {
	type CoreMessage,
	type GenerateTextResult,
	type StreamTextResult,
	generateText,
	streamText,
} from "ai";
import type { AgentContext } from "../..";
import { bigModel } from "../../config";
import type { carmyTools } from "../carmy/tools";
import { queryVectorDb, searchUrlInDb, transformQuery } from "./query";
import { scrapeUrl, scrapingTaskStatus } from "./scraping";
import { pearlTools } from "./tools";

type PearlToolsReturnType = ReturnType<typeof pearlTools>;

// Map modes to their result types
type ModeResultMap = {
	stream: StreamTextResult<PearlToolsReturnType, string>;
	generate: GenerateTextResult<PearlToolsReturnType, string>;
};

export const systemPrompt = `
You are a intelligent task manager that can help users with their requests.
You have access to specialized tools to enhance your capabilities.

When responding:
1. Carefully analyze the user's query to understand their intent
2. Select and utilize the most appropriate tool(s) when beneficial
3. Do not mention the existence of tools unless directly relevant to the user's query
4. If no tools are applicable, provide the most helpful response using your knowledge
5. Always maintain a helpful, clear, and professional tone

Your goal is to deliver the most effective assistance possible while keeping interactions natural and focused on the user's needs.
If you can't help the user, say so.
`;

export async function pearlAgent<
	TMode extends keyof ModeResultMap = "stream", // Generic for mode keys, defaults to 'stream'
>(
	messages: CoreMessage[],
	context: AgentContext,
	mode?: TMode, // Mode is now optional, defaults via the generic
): Promise<ModeResultMap[TMode]>; // Use lookup type for the return value
export async function pearlAgent(
	messages: CoreMessage[],
	context: AgentContext,
	mode: "stream" | "generate" = "stream",
): Promise<ModeResultMap["stream"] | ModeResultMap["generate"]> {
	const tools = pearlTools(context);

	if (mode === "stream") {
		const response = await streamText({
			model: bigModel,
			maxSteps: 10,
			temperature: 0.5,
			system: systemPrompt,
			messages,
			tools,
		});

		return response;
	}

	const response = await generateText({
		model: bigModel,
		maxSteps: 10,
		temperature: 0.5,
		system: systemPrompt,
		messages,
		tools,
	});

	return response;
}
