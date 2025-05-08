import { bigModel, bigThinkingModel } from "@hugin-bot/core/src/ai/config";
import {
	generateEmbeddings,
	storePriorityUrls,
} from "@hugin-bot/core/src/ai/libs";
import {
	RELEVANCE_SCORE_CUTOFF,
	reformatTextToObjectWithPurpose,
} from "@hugin-bot/core/src/ai/prompts";
import { db } from "@hugin-bot/core/src/drizzle";
import { Contents } from "@hugin-bot/core/src/entities/content.sql";
import { type Url, Urls } from "@hugin-bot/core/src/entities/url.sql";
import { sleep } from "@hugin-bot/core/src/utils";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import Muppeteer from "./lib/puppeteer/muppeteer";

type PuppeterFnEvent = {
	urlset: {
		url: string;
		purpose: string;
	}[];
};

export const handler = async (event: PuppeterFnEvent) => {
	try {
		const startTime = process.hrtime();
		const muppet = new Muppeteer();

		await muppet.initialize();

		// TODOS: Handle errors and retries
		const results = await Promise.all(
			event.urlset.map(async (url) => {
				console.log("Scraping", url.url, "for", url.purpose);
				try {
					const page = await muppet.newPage(url.url);
					const [rawMarkdown] = await Promise.all([
						muppet.convertToMarkdown(page),
						muppet.extractText(page),
					]);
					await page.close();

					const markdown = await generateText({
						model: bigModel,
						temperature: 0,
						system: `
							You are a expert web scraper. You are given an unstructured contents of a website in markdown format. 
							Your job is to extract the most relevant information from the website based on the purpose provided by the user.
						`,
						messages: [
							{
								role: "user",
								content: `
								URL: ${url.url}
								Purpose: ${url.purpose}
							`,
							},
							{
								role: "user",
								content: `
								${rawMarkdown}
							`,
							},
						],
					});

					return {
						url: url.url,
						purpose: url.purpose,
						recipe: markdown.text,
						error: "",
					};
				} catch (e) {
					console.error(e);
					return {
						url: url.url,
						purpose: url.purpose,
						recipe: "Recipe not found",
						error: e instanceof Error ? e.message : "Unknown error",
					};
				}
			})
		);

		const endTime = process.hrtime(startTime);
		const duration = (endTime[0] * 1e9 + endTime[1]) / 1e9;
		console.log(`Scraping Duration: ${duration} seconds`);
		return {
			statusCode: 200,
			body: JSON.stringify(results),
		};
	} catch (e) {
		console.error(e);
		return {
			statusCode: 500,
			body: JSON.stringify({
				error: e instanceof Error ? e.message : "Unknown error",
			}),
		};
	}
};
