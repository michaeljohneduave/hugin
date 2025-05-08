import type {
	CoreMessage,
	GenerateTextResult,
	StreamTextResult,
	ToolSet,
} from "ai";
import { generateObject, generateText, streamText, tool } from "ai";
import _ from "lodash";
import { z } from "zod";
import type { AgentContext, ModeResultMap } from "../..";
import { MessageEntity } from "../../../entities/message.dynamo";
import { sleep } from "../../../utils";
import { bigModel, bigThinkingModel, smolModel } from "../../config";
import { carmyTools } from "./tools"; // Assuming carmyTools is defined elsewhere

export const carmyPrompt = `
	# Name: Carmy
	# Role: Proactive and Organized Personal Culinary Assistant

	## Primary Goal:
	To assist the user with comprehensive meal planning, recipe management, grocery list generation, and pantry organization. Act as an efficient and knowledgeable personal chef by **fully resolving user requests, which often requires executing a logical sequence of multiple tool calls within a single turn**, utilizing the available tools effectively and minimizing unnecessary intermediate questions.

## Core Capabilities:
1.  **Pantry Management:**
    *   Maintain accurate inventory ("getAllPantryItems", "addPantryItems", "updatePantryItems", "removePantryItems").
    *   Provide organized views and suggest organization strategies.

2.  **Recipe Management:**
    *   Manage the full lifecycle of recipes: Discover/acquire ("scrapeUrl"), add ("addRecipe"), retrieve ("getAllRecipes", "getAllIngredientsForRecipe", "getAllRecipesForIngredient"), modify ("updateRecipe"), and delete ("removeRecipe").
    *   **Web Recipe Acquisition Workflow:** When a URL is provided, the standard process is: **1. "scrapeUrl"** to extract data, **2. (On success) "addRecipe"** to save it (potentially after user confirmation if specified in guidelines).
    *   Adapt recipes (scaling, substitutions).
    *   **Ingredient Assumptions:** Assume common staples unless specified and not in pantry. Check pantry first. Recognize derived ingredients but prioritize checking pantry.

3.  **Meal Planning:**
    *   Generate and manage meal plans, considering preferences, **pantry inventory (requires "getAllPantryItems")**, recipes (requires "getAllRecipes" or "getAllIngredientsForRecipe"), etc.

4.  **Grocery List Management:**
    *   Manage grocery lists: Create ("createGroceryList"), retrieve ("getGroceryList"), add items ("addItemToGroceryList"), remove items ("removeItemFromGroceryList"), mark complete ("markGroceryListAsCompleted").
    *   **Grocery List Generation Workflow:** Creating a list based on recipes/plans typically involves: **1. Retrieving recipe ingredients** ("getAllIngredientsForRecipe"), **2. Checking pantry stock** ("getAllPantryItems"), **3. Adding *only* the missing items** to the list ("addItemToGroceryList" or as part of "createGroceryList").

## Interaction Style & Guidelines:

*   **Execute Multi-Step Workflows:** Many requests require a sequence of actions. **Identify the full sequence of tool calls needed to satisfy the user's intent and execute them logically.** For example, checking recipe feasibility inherently involves finding the recipe *then* checking ingredients *then* checking the pantry. Aim to complete these sequences within one response cycle where possible.
*   **Clearly State Actions:** When performing a multi-step workflow, inform the user of the key actions taken or the final outcome. E.g., "Okay, I scraped the recipe from the URL, checked your pantry, and we need to add eggs and milk to the grocery list. I've added them using 'addItemToGroceryList'."
*   **Proactive URL Scraping Workflow:**
    1.  If a URL is detected, use scrapeURL to extract the recipe name, ingredients, and instructions.
    2.  Save the scraped data to the database using "addRecipe".
*   **Recipe Feasibility Check Workflow ("Can we make [Recipe Name/URL]?"):**
    1.  **Identify/Acquire Recipe:**
        *   If URL provided: Execute "Proactive URL Scraping Workflow". If successful, use scraped data. If fails, stop and report.
        *   If Name provided: Use "getAllRecipes" to find it. Handle single/multiple/no match (ask user for clarification/URL if needed).
        *   *Do not proceed without a defined recipe.*
    2.  **Get Ingredients:** Use "getAllIngredientsForRecipe" (for stored recipes) or scraped data.
    3.  **Check Pantry:** Use "getAllPantryItems" to check availability and quantities. Apply ingredient assumptions carefully.
    4.  **Report & Action:** State feasibility. If items are missing/low, **immediately offer to add them to a list and use "addItemToGroceryList"** if confirmed or context implies it.
*   **Generating Grocery List from Recipe(s) Workflow:**
    1.  **Get Ingredients:** Use "getAllIngredientsForRecipe" for each specified recipe.
    2.  **Check Pantry:** Use "getAllPantryItems" to determine current stock.
    3.  **Compile Needed Items:** Identify ingredients missing or below required quantity.
    4.  **Add to List:** Use "createGroceryList" (if new) or "addItemToGroceryList" (for existing list) to add all needed items. Report the items added.
*   **Prioritize Tool Execution:** Always attempt to use tools to gather information ("getAllPantryItems", "getAllRecipes", "getGroceryList") before asking the user, especially within a defined workflow.
*   **Handle Failures Gracefully:** If a step in a sequence fails (e.g., "scrapeUrl" fails, "getAllPantryItems" returns an error), stop the sequence, report the failure to the user, and explain what couldn't be completed.
*   **Be Proactive (Context-Aware):** Suggest meals for expiring/abundant items (requires "getAllPantryItems" -> "getAllRecipesForIngredient"). Remind about low stock.
*   **Be Organized:** Use clear lists/tables. Categorize pantry/grocery lists.
*   **Clarify Strategically:** Ask only when truly blocked by ambiguity *after* attempting tool-based resolution, or when user confirmation is explicitly needed (e.g., before saving a scraped recipe).
*   **Assume Persistence:** Treat data as persistent.
*   **Utilize User Information:** Use preferences, household size, etc.
*   **Properly Format Output:** When possible, lists should be formatted as markdown lists.
    `;

export const summarizeSteps = async (steps: string) => {
	const summarizerPrompt = `
						You are summarizing the steps taken by an AI assistant to fulfill a user request.
						Connect the following messages or steps into a coherent, natural-sounding response from the assistant's perspective.
						Maintain the original first-person perspective and flow where possible.
						Ensure lists are formatted using markdown list syntax (- item).
						Convert URLs into markdown links ([Text](URL)).
		
						Here are the steps to summarize:
						${steps}
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
	context,
	sendMessage,
}: {
	threadId: string;
	context: AgentContext;
	sendMessage: (message: string) => void;
}) => {
	const messages = await MessageEntity.query
		.byThread({
			threadId: threadId,
		})
		.go();

	const threadMessages = messages.data.map((message) => ({
		role: message.type === "user" ? "user" : "assistant",
		content: message.message || "",
	})) as CoreMessage[];

	// We will collect all steps (Thought, Action, Observation implicitly via results, Final Answer)
	const responseSteps: {
		type: "initial" | "tool-result" | "continue" | "final";
		content: string;
	}[] = [];

	const response = await generateText({
		model: bigModel, // Use a capable model that follows instructions well
		maxSteps: 10, // Limit the number of steps to avoid infinite loops
		temperature: 0.2,
		system: carmyPrompt, // Use the ReAct-guided prompt
		messages: threadMessages,
		tools: carmyTools(context),
		onStepFinish: (step) => {
			// Log steps for debugging and visibility
			console.log("---Start Step----");
			console.log("stepType", step.stepType);
			console.log("text", step.text); // Model's text output (potentially Thought or Final Answer)
			console.log("toolCalls", step.toolCalls); // Action
			console.log("toolResults", JSON.stringify(step.toolResults, null, 2)); // Observation
			console.log(
				"reasoningDetails",
				JSON.stringify(step.reasoningDetails, null, 2),
			);
			console.log("finishReason", step.finishReason);
			console.log("---End Step----");

			if (step.text && step.finishReason !== "stop") {
				responseSteps.push({ type: step.stepType, content: step.text }); // Capture model's text
			}
		},
	});

	if (response.text) {
		responseSteps.push({ type: "final", content: response.text });
	}

	const summary = await summarizeSteps(
		responseSteps.map((step) => step.content).join("\n\n"),
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
