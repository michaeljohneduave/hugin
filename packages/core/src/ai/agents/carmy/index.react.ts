import type { CoreMessage } from "ai";
import { generateText } from "ai";
import type { AgentContext } from "../..";
import { MessageEntity } from "../../../entities/message.dynamo";
import { bigModel } from "../../config";
import { carmyTools } from "./tools"; // Assuming carmyTools is defined elsewhere

// Refactored Carmy Prompt to encourage ReAct-like output
export const carmyPrompt = `
  # Name: Carmy
  # Role: Proactive and Organized Personal Culinary Assistant

  ## Primary Goal:
  To assist the user with comprehensive meal planning, recipe management, grocery list generation, and pantry organization. Act as an efficient and knowledgeable personal chef by **fully resolving user requests, which often requires executing a logical sequence of multiple tool calls within a single turn**, utilizing the available tools effectively and minimizing unnecessary intermediate questions.

  ## Process (ReAct):
  You will follow a thinking process that alternates between Thoughts, Actions, and Observations.
  1.  **Thought:** Briefly explain your reasoning, plan, or the next step you intend to take.
  2.  **Action:** Call the appropriate tool(s) based on your thought.
  3.  **Observation:** The result of the tool call will be provided. Based on the observation, generate the next Thought or the Final Answer.
  Repeat this Thought/Action/Observation cycle until the user's request is fully addressed.

  After completing the necessary steps, provide the Final Answer to the user.

  Example structure:
  <thought>
		The user wants X. I need to use tool Y to get the necessary information.
  </thought>

  <action>
		Use tool Y with parameters A, B, C.
  </action>

  <observation>
		[Result of tool Y]
  </observation>

  <thought>
		Based on the observation, Z is true. I need to use tool W to do Q.
  </thought>

  <action>
		Use tool W with parameter D.
  </action>

  <observation>
		Result of tool W
  </observation>
	
  <final>
		[Summarize results and provide the complete response]
  </final>
`;

export const summarizeSteps = async (steps: string) => {
	// Filter for text-based steps for summarization
	const textSteps = steps;

	// Prepare the prompt for the summarizer
	const summarizerPrompt = `
        You are summarizing the steps taken by an AI assistant to fulfill a user request.
        Connect the following messages or steps into a coherent, natural-sounding response from the assistant's perspective.
        Maintain the original first-person perspective and flow where possible.
        Ensure lists are formatted using markdown list syntax (- item).
        Convert URLs into markdown links ([Text](URL)).

        Here are the steps to summarize:
        ${textSteps}
    `;

	const response = await generateText({
		model: bigModel,
		temperature: 0.2,
		system: `
      You're task is to connect multiple messages or steps into a coherent message.
      Keep the original first-person perspective and flow of the message.

      If you encounter lists, keep them as lists.
      For example:
      "item1, item2, item3"

      Should be converted into:
      - item1
      - item2
      - item3

      If you encounter links or urls, use markdown links.
      For example:
      "https://www.google.com"

      It should be converted into:
      [Google](https://www.google.com)
    `,
		prompt: summarizerPrompt,
	});

	return response.text;
};

export const carmyAgent = async ({
	threadId,
	roomId,
	msgs,
	context,
	sendMessage,
}: {
	threadId: string;
	roomId: string;
	msgs?: CoreMessage[];
	context: AgentContext;
	sendMessage?: (message: string) => void; // This is for streaming intermediate thoughts/actions if desired
}) => {
	let messages: CoreMessage[] = [];

	if (msgs && msgs.length > 0) {
		messages = msgs;
	} else {
		const threadMessages = await MessageEntity.query
			.byRoomAndThreadSortedByTime({
				roomId: roomId,
				threadId: threadId,
			})
			.go();

		messages = threadMessages.data.map((message) => ({
			role: message.type === "user" ? "user" : "assistant",
			content: message.message || "",
		})) as CoreMessage[];
	}

	// We will collect all steps (Thought, Action, Observation implicitly via results, Final Answer)
	const responseSteps: {
		type: "initial" | "tool-result" | "continue" | "final";
		content: string;
	}[] = [];

	console.log("threadMessages", messages);

	const response = await generateText({
		model: bigModel, // Use a capable model that follows instructions well
		maxSteps: 10, // Limit the number of steps to avoid infinite loops
		temperature: 0.2,
		system: carmyPrompt, // Use the ReAct-guided prompt
		messages: messages,
		tools: carmyTools(context),
		onStepFinish: (step) => {
			// Log steps for debugging and visibility
			// console.log("---Start Step----");
			// console.log("stepType", step.stepType);
			// console.log("text", step.text); // Model's text output (potentially Thought or Final Answer)
			// console.log("toolCalls", step.toolCalls); // Action
			// console.log("toolResults", JSON.stringify(step.toolResults, null, 2)); // Observation
			// console.log(
			// 	"reasoningDetails",
			// 	JSON.stringify(step.reasoningDetails, null, 2),
			// );
			// console.log("finishReason", step.finishReason);
			// console.log("---End Step----");

			// Collect steps. The model's 'text' output often contains the Thought and/or Final Answer.
			// The SDK handles executing the toolCalls and feeding back toolResults.
			// We collect the model's text outputs and potentially a representation of actions/observations
			// if we wanted to summarize the *process* rather than just the final text outputs.
			// For this refactor, let's prioritize collecting the text outputs which,
			// with the new prompt, should contain the ReAct 'Thought' and 'Final Answer'.

			if (step.finishReason !== "stop") {
				let content = step.text;

				if (step.toolCalls?.length > 0) {
					// Add tool calls and tool results to content
					for (let i = 0; i < step.toolCalls.length; i++) {
						content += [
							"<action>",
							JSON.stringify(step.toolCalls[i]),
							"</action>",
						].join("\n");

						if (step.toolResults?.[i]) {
							content += [
								"<tool-result>",
								JSON.stringify(step.toolResults[i]),
								"</tool-result>",
							].join("\n");
						}
					}
				}

				responseSteps.push({ type: step.stepType, content });
			}
		},
	});

	console.log("----Sources----");
	console.log(response.sources);
	console.log("----Sources----");

	// The final 'response.text' is the model's last output, typically the 'Final Answer'
	if (response.text) {
		responseSteps.push({ type: "final", content: response.text });
	}

	// Summarize the collected text steps (Thoughts and Final Answer)
	const summary = await summarizeSteps(
		responseSteps.map((step) => step.content).join("\n\n")
	);

	return {
		summary,
		metadata: {
			responseSteps,
			responseDetails: {
				tokenUsage: response.usage,
				finishReason: response.finishReason,
				steps: responseSteps.length,
			},
		},
	};
};
