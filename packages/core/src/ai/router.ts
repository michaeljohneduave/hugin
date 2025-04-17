import { carmyAgent } from "./agents/carmy";
import { pearlAgent } from "./agents/pearl";

export const llmRouter = {
	pearl: pearlAgent,
	carmy: carmyAgent,
};

export type LlmRouter = (typeof llmRouter)[keyof typeof llmRouter];
