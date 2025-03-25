import getSitemap from "@hugin-bot/scraper/src/utils/getSitemap";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import { Resource } from "sst";
import { task } from "sst/aws/task";
import { z } from "zod";
import { db } from "../../drizzle";
import { Tasks } from "../../entities/task.sql";
import { storePriorityUrls } from "../libs";
import { getSiteScrapingPurpose } from "../prompts";

export const scrapeUrl = tool({
	description: `
    Scrapes the website for content and returns the status and id of the task.
		Use this tool when the intent is clear and there is a URL present.
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
		for (const item of params.urlset) {
			const sitemapUrls = await getSitemap(item.url);

			await storePriorityUrls(
				item.url,
				sitemapUrls.map((url) => ({ url })),
				item.purpose,
			);
		}

		const response = await task.run(Resource.ScraperTask);
		const str = response.arn.split("/").pop()!;

		const record = await db
			.insert(Tasks)
			.values({
				arn: response.arn,
			})
			.onConflictDoNothing()
			.returning({
				id: Tasks.id,
			});

		// TODO: Store the arn someplace else.
		// or truncate the arn
		return {
			id: record[0].id,
			status: response.status,
		};
	},
});

export const scrapingTaskStatus = tool({
	description: `
    Checks the status of a running scrapeUrl task.
    Tell the user to ask in a later time if the status is pending.
		Do not call along with the scrapeUrl tool.
  `,
	parameters: z.object({
		arn: z.string(),
	}),
	execute: async (params) => {
		const [currentTask] = await db
			.select()
			.from(Tasks)
			.where(eq(Tasks.id, params.arn));

		if (!currentTask) {
			return "Task doesn't exist";
		}

		const response = await task.describe(Resource.ScraperTask, currentTask.arn);

		return {
			id: currentTask?.id,
			status: response.status,
		};
	},
});
