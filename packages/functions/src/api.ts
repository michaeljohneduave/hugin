import { storePriorityUrls } from "@hugin-bot/core/src/ai/libs";
import { getSiteScrapingPurpose } from "@hugin-bot/core/src/ai/prompts";
import getSitemap from "@hugin-bot/scraper/src/utils/getSitemap";
import type { Handler } from "aws-lambda";
import { Resource } from "sst";
import { task } from "sst/aws/task";

export const scrapeCompanyUrl: Handler = async (event) => {
	const { messages } = JSON.parse(event.body);
	const result = await getSiteScrapingPurpose(
		messages[messages.length - 1].content,
	);

	console.log(result.object);

	const mainUrls = result.object.filter((item) => item.confidence > 0.9);

	if (mainUrls.length === 0) {
		return;
	}

	for (const item of mainUrls) {
		const sitemapUrls = await getSitemap(item.url);

		await storePriorityUrls(
			item.url,
			sitemapUrls.map((url) => ({ url })),
			item.purpose,
		);
	}

	await task.run(Resource.ScraperTask);
};
