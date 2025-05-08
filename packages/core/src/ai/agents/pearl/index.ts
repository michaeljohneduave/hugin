import {
	type CoreMessage,
	type GenerateTextResult,
	type StreamTextResult,
	generateText,
	streamText,
} from "ai";
import type { AgentContext } from "../..";
import { MessageEntity } from "../../../entities/message.dynamo";
import { bigModel } from "../../config";
import { pearlTools } from "./tools";

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

export async function pearlAgent({
	threadId,
	context,
	sendMessage,
}: {
	threadId: string;
	context: AgentContext;
	sendMessage: (message: string) => void;
}) {
	const tools = pearlTools(context);

	const messages = await MessageEntity.query
		.byThread({
			threadId: threadId,
		})
		.go();

	const threadMessages = messages.data.map((message) => ({
		role: message.type === "user" ? "user" : "assistant",
		content: message.message || "",
	})) as CoreMessage[];

	const response = await generateText({
		model: bigModel,
		maxSteps: 10,
		temperature: 0.1,
		system: systemPrompt,
		messages: threadMessages,
		tools,
		onStepFinish: (step) => {
			if (step.text && step.finishReason !== "stop") {
				sendMessage(step.text);
			}
		},
	});

	return {
		summary: response.text,
		metadata: {
			responseDetails: {
				tokenUsage: response.usage,
				finishReason: response.finishReason,
				steps: 0,
			},
			responseSteps: [],
		},
	};
}
