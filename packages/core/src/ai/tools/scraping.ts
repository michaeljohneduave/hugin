import getSitemap from "@hugin-bot/scraper/src/utils/getSitemap";
import { tool } from "ai";
import { Resource } from "sst";
import { task } from "sst/aws/task";
import { z } from "zod";
import { db } from "../../drizzle";
import { Tasks } from "../../entities/task.sql";
import { storePriorityUrls } from "../libs";
import { getSiteScrapingPurpose } from "../prompts";

export const scrapeUrl = tool({
	description: `
    Scrapes the website for content and stores in inside a vector database.
    Returns the status of the task.
  `,
	parameters: z.object({
		urlset: z.array(
			z.object({
				url: z.string().describe("Url from the user"),
				purpose: z
					.string()
					.describe("Purpose or what the user wants to get from the website"),
			}),
		),
	}),
	execute: async (params, toolOpts) => {
		console.log("scrapeUrl.params", params);
		for (const item of params.urlset) {
			const sitemapUrls = await getSitemap(item.url);

			await storePriorityUrls(
				item.url,
				sitemapUrls.map((url) => ({ url })),
				item.purpose,
			);
		}

		const response = await task.run(Resource.ScraperTask);
		console.log("scrapeUrl", response);

		// TODO: Store the arn someplace else.
		// or truncate the arn
		return {
			arn: response.arn,
			status: response.status,
		};
	},
});

export const scrapingTaskStatus = tool({
	description: `
    Checks the status of a running scrapeUrl task.
    Tell the user to ask in a later time if the status is pending.
  `,
	parameters: z.object({
		arn: z.string(),
	}),
	execute: async (params) => {
		console.log("params.arn", params.arn);
		const response = await task.describe(Resource.ScraperTask, params.arn);

		return {
			arn: response.arn,
			status: response.status,
		};
	},
});
