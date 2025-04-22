import { generateText, streamText, type ToolSet, type CoreMessage, type GenerateTextResult, type StreamTextResult } from "ai";
import type { AgentContext } from "../..";
import { bigThinkingModel } from "../../config";

export const systemPrompt = `
    You are an expert in helping other people with their problems.
    These people will ask what do to next based on the things they have done and context available.

    You will then think carefully about what they need to do next to complete their specific task.
    You will try a thorough analysis and step by step approach to solve their problem.
    You will provide detailed explanations and reasoning for each step.
  `;

export async function albertAgent(
  messages: CoreMessage[],
) {
  const config = {
    model: bigThinkingModel,
    temperature: 0.7,
    system: systemPrompt,
    messages,
  }
  return await generateText(config);
}
