import { bigModel } from "@hugin-bot/core/src/ai/config";
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
	console.log(event);
	try {
		const muppet = new Muppeteer();

		await muppet.initialize();

		const page = await muppet.newPage(event.urlset[0].url);
		const content = (await muppet.extractText(page))
			.split("\n")
			.filter((line) => line.trim() !== "")
			.join("\n");

		await page.close();

		// Send textContent to LLM
		// Do we pass the result as response or let the LLM decide?
		const response = await generateText({
			model: bigModel,
			temperature: 0,
			system: `
				You are a expert web scraper. You are given an unstructured text of a website.
				Your job is to extract the most relevant information from the website based on the purpose provided by the user.
			`,
			messages: [
				{
					role: "user",
					content: `
						URL: ${event.urlset[0].url}
						Purpose: ${event.urlset[0].purpose}
					`,
				},
				{
					role: "user",
					content: content,
				},
			],
		});

		console.log(response.text);

		return {
			statusCode: 200,
			body: response.text,
		};
	} catch (e) {
		console.error(e);

		if (e instanceof Error) {
			return {
				statusCode: 500,
				body: JSON.stringify({
					error: e.message,
				}),
			};
		}

		return {
			statusCode: 500,
			body: JSON.stringify({
				error: "Unknown error",
			}),
		};
	}
};

export const handler_OLD = async (event: PuppeterFnEvent) => {
	let records: Url[];

	const muppet = new Muppeteer();

	await muppet.initialize();

	const page = await muppet.newPage("http://spare.com/");
	console.log(await muppet.extractText(page));
	await page.close();

	do {
		records = await db.query.Urls.findMany({
			where: (urls, { eq }) => eq(urls.status, "pending"),
			limit: 5,
		});

		for (const record of records) {
			try {
				const page = await muppet.newPage(record.url);
				const textContent = await muppet.extractText(page);
				const links = await muppet.extractLinks(page);

				await page.close();

				if (!textContent || !textContent) {
					continue;
				}

				// TODO: Check token length since this is 1:1
				// TODO: Include more context to help llm filter out unrelated sites
				// Some urls are outside of the domain,
				const { object: embeddableObject } =
					await reformatTextToObjectWithPurpose(record.purpose, textContent);
				const texts = embeddableObject
					.filter((embed) => embed.relevanceScore >= RELEVANCE_SCORE_CUTOFF)
					.map((embed) => embed.text.toLowerCase());

				if (texts.length === 0) {
					// Update record to complete
					await db
						.update(Urls)
						.set({
							status: "complete",
						})
						.where(eq(Urls.id, record.id));

					continue;
				}

				const { embeddings } = await generateEmbeddings(texts);

				await db
					.insert(Contents)
					.values(
						embeddings.map((embedding, idx) => ({
							url: record.mainUrl,
							embedding,
							text: texts[idx],
						})),
					)
					.onConflictDoNothing()
					.execute();

				// Update record to complete
				await db
					.update(Urls)
					.set({
						status: "complete",
					})
					.where(eq(Urls.id, record.id));

				await storePriorityUrls(
					record.mainUrl,
					links.map((item) => ({
						url: item.link,
						description: item.text,
					})),
					record.purpose,
				);
			} catch (e) {
				console.error(e);
				await db
					.update(Urls)
					.set({
						status: "error",
					})
					.where(eq(Urls.id, record.id));
			}

			console.log(record.url, "done");
			await sleep(20_000);
		}
	} while (records.length);

	return {
		statusCode: 200,
	};
};
