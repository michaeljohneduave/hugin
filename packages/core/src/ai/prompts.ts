import { generateObject } from "ai";
import { z } from "zod";
import { BIG_MODEL_MAX_TOKEN, bigModel, smolModel } from "./config";

export function getSiteScrapingPurpose(text: string) {
	return generateObject({
		model: bigModel,
		mode: "json",
		temperature: 0,
		maxTokens: BIG_MODEL_MAX_TOKEN,
		schema: z.array(
			z.object({
				url: z.string(),
				purpose: z.string(),
				confidence: z.number(),
			}),
		),
		system: `
      You are tasked in determining the purpose of the user or what they want for a specific url. Give a level of confidence (0 - 1) for each purpose/url,
			the user will explicitly say what they want.

			Example: I want to learn about the tech stack https://www.spare.com uses.
			Answer: 
				url: https://www.spare.com
				purpose: Learn about the company's tech stack
				confidence: {0-1}

			User must provide a valid url or website, do not infer the url from the company name or anything.
			For the purpose: Write a 1-2 verbose sentences about the purpose
			Return 0 confidence if url is missing.
			Return the fully constructed url. (www.spare.com to https://www.spare.com)
    `,
		prompt: text,
	});
}

export function prioritizeUrls(
	purpose: string,
	mainUrl: string,
	urls: {
		url: string;
		description?: string;
	}[],
) {
	return generateObject({
		model: bigModel,
		mode: "json",
		temperature: 0,
		maxTokens: BIG_MODEL_MAX_TOKEN,
		schema: z.array(
			z.object({
				url: z.string(),
				priority: z.enum(["high", "medium-high", "medium", "low"]),
			}),
		),
		system: `
      You are tasked with prioritizing the following URLs that are most relevant in helping the user find the most relevant information for the stated purpose.

      The priority can be one of the following:
      - high: the URL is very relevant to the main url and user's purpose
      - medium-high: the URL is relevant to the main url and user's purpose
      - medium: the URL is somewhat relevant to the main url and user's purpose
      - low: the URL is not relevant to the main url and user's purpose

			Additional Directives:
      Return only the high and medium-high priority URLs.
			Exclude social media urls and the like. Ex: linkedin, twitter, x, facebook, instagram, youtube.
			Check the urls and only include relevant to the Main URL.
    `,
		prompt: `
      Purpose: ${purpose}
			Main URL: ${mainUrl}
      URLS:
      ${urls.map(({ url, description }) => `- ${url}: ${description || "No description"}`).join("\n")}
      `,
	});
}

export const RELEVANCE_SCORE_CUTOFF = 0.85;
export function reformatTextToObject(text: string) {
	return generateObject({
		model: bigModel,
		mode: "json",
		temperature: 0,
		schema: z.array(
			z.object({
				text: z.string(),
				relevanceScore: z.number(),
			}),
		),
		system: `
			You are tasked in reorganizing of unstructured pieces of text. 
			Here are your directive:
				- Reformat text for efficient embedding conversion.
				- Preserve structure and organize into semantic segments.
				- No summarization or formatting changes.
				- Group semantically related paragraphs/sentences.
				- Carefully identify irrelevant segments and score accordingly
				- Error messages or segments should not be relevant
				- Use plain text only, attemp to fix merged words resulting from scraping
				- The "text" key must be in paragraph with line breaks
		`,
		prompt: text,
	});
}

export function reformatTextToObjectWithPurpose(purpose: string, text: string) {
	return generateObject({
		model: bigModel,
		mode: "json",
		temperature: 0,
		schema: z.array(
			z.object({
				text: z.string(),
				relevanceScore: z.number(),
			}),
		),
		system: `
		You have 2 tasks:
				1. Reorganization of unstructured pieces of text. 
				2. Identify reorganized text if it is relevant to the purpose or intent of the user
			Here are your directives:
				- Text must be related to the purpose.
				- Reformat text for efficient embedding conversion.
				- Preserve structure and organize into semantic segments.
				- No summarization or formatting changes.
				- Group semantically related paragraphs/sentences.
				- Carefully identify irrelevant segments and score accordingly
				- Error messages or segments should not be relevant
				- Use plain text only, attemp to fix merged words resulting from scraping
				- The "text" key must be in paragraph with line breaks
		`,
		prompt: `
			Purpose: ${purpose}

			Text:
			${text}
		`,
	});
}

export function transformToKeywords(query: string) {
	return generateObject({
		model: smolModel,
		mode: "json",
		temperature: 0.5,
		schema: z.array(z.string()),
		system: `
			You are a keyword assistant in case the vector database doesn't return any results for the query. Data has already been gathered but the query may have been too vague to match with the vector database. Transform this query into a set of effective keywords that will help return useful results.

			Query: ${query}
		`,
	});
}
