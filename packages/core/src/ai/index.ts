import type { GenerateTextResult, StreamTextResult, ToolSet } from "ai";

export const llmAgents = [
	{
		id: "carmy",
		name: "Carmy",
		avatar: "/carmy-avatar.webp",
	},
	{
		id: "pearl",
		name: "Pearl",
		avatar: "/pearl.svg",
	},
];

export const llmRouters = [];

export type LlmAgentId = (typeof llmAgents)[number]["id"];

export type AgentContext = {
	userId: string;
	userName: string;
};

// Map modes to their result types
export type ModeResultMap<T extends ToolSet> = {
	stream: StreamTextResult<T, string>;
	generate: GenerateTextResult<T, string>;
};
