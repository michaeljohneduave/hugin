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
import { eq } from "drizzle-orm";
import Muppeteer from "./muppeteer";

async function main() {
	let records: Url[];

	const muppet = new Muppeteer();

	await muppet.initialize();

	do {
		records = await db.query.Urls.findMany({
			where: (urls, { eq }) => eq(urls.status, "pending"),
			limit: 5,
		});

		for (const record of records) {
			try {
				const page = await muppet.newPage(record.url);
				const readable = await muppet.extractText(page);
				const links = await muppet.extractLinks(page);

				await page.close();

				if (!readable || !readable.textContent) {
					continue;
				}

				// TODO: Check token length since this is 1:1
				// TODO: Include more context to help llm filter out unrelated sites
				// Some urls are outside of the domain,
				const { object: embeddableObject } =
					await reformatTextToObjectWithPurpose(
						record.purpose,
						readable.textContent,
					);
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

	process.exit();
}

main().catch(console.error);
