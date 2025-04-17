export const llmAgents = [
	{
		id: "carmy",
		name: "Carmy",
		avatar: "/carmy-avatar.webp",
	},
	{
		id: "pearl",
		name: "Pearl",
		avatar: "/pearl-avatar.webp",
	},
];

export const llmRouters = [];

export type LlmAgentId = (typeof llmAgents)[number]["id"];

export type AgentContext = {
	userId: string;
};
