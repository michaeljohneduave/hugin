import { cleanUrl } from "@hugin-bot/functions/src/lib/puppeteer/utils/cleanUrl";
import { embedMany } from "ai";
import { db } from "../drizzle";
import { type NewUrl, Urls } from "../entities/url.sql";
import { embeddingModel } from "./config";
import { prioritizeUrls } from "./prompts";

export async function storePriorityUrls(
	mainUrl: string,
	// Anti pattern
	links: Parameters<typeof prioritizeUrls>[2],
	purpose: string,
) {
	const { object: urls } = await prioritizeUrls(purpose, mainUrl, links);

	const urlsToScrape: NewUrl[] = urls
		.filter((url) => url.priority === "high" || url.priority === "medium-high")
		.map((url) => {
			const u = new URL(url.url);
			return {
				url: cleanUrl(u.origin, url.url),
				status: "pending",
				priority: url.priority,
				mainUrl: mainUrl,
				purpose: purpose,
			};
		});

	console.log(urlsToScrape);

	if (urlsToScrape.length > 0) {
		await db.insert(Urls).values(urlsToScrape).onConflictDoNothing().execute();
	}
}

export function generateEmbeddings(texts: string[]) {
	return embedMany({
		model: embeddingModel,
		values: texts,
	});
}
