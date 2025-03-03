import { cleanUrl } from "@hugin-bot/scraper/src/utils/cleanUrl";
import { db } from "../drizzle";
import { type NewUrl, Urls } from "../entities/url.sql";
import { prioritizeUrls } from "./prompts";

export async function storePriorityUrls(
	mainUrl: string,
	links: Parameters<typeof prioritizeUrls>[1],
	purpose: string,
) {
	const { object: urls } = await prioritizeUrls(purpose, links);

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
