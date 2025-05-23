import { generateText } from "ai";
import { smolModel } from "../config";

export async function titleGenerator(text: string) {
	const result = await generateText({
		model: smolModel,
		temperature: 0.2,
		prompt: `
		You are a title generator.
		Follow the following instructions:
		- Generate a title for the following text, not more than 2-5 words, title must be in plain text
		- The title should not be a question or a statement

		Text:
		${text}`,
	});

	return result.text.trim();
}
