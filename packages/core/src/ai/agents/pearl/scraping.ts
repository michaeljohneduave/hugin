import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import getSitemap from "@hugin-bot/functions/src/lib/puppeteer/utils/getSitemap";
import { tool } from "ai";
import { Resource } from "sst";
import { z } from "zod";
import { storePriorityUrls } from "../../libs";

export const scrapeUrl_OLD = tool({
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

		const lambda = new LambdaClient({});
		const command = new InvokeCommand({
			FunctionName: Resource.Puppeteer.name,
		});

		const response = await lambda.send(command);

		const payload = JSON.parse(new TextDecoder().decode(response.Payload));
	},
});

export const scrapeUrl = tool({
	description: `
    Scrapes the website for a specific purpose/s.
		To use this tool effectively. Provide the url and a verbose description of what you want to get from the website.
  `,
	parameters: z.object({
		urlset: z.array(
			z.object({
				url: z.string().describe("Url from the user"),
				purpose: z
					.string()
					.describe("Purpose or what you want to get from the website"),
			}),
		),
	}),
	execute: async (params, toolOpts) => {
		const lambda = new LambdaClient({});
		const payload = {
			urlset: params.urlset,
		};
		const command = new InvokeCommand({
			FunctionName: Resource.Puppeteer.name,
			InvocationType: "RequestResponse",
			Payload: JSON.stringify(payload),
		});

		const response = await lambda.send(command);
		const responsePayload = JSON.parse(
			new TextDecoder().decode(response.Payload),
		) as {
			statusCode: number;
			body: string;
		};
		return responsePayload.body;
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
		// const [currentTask] = await db
		// 	.select()
		// 	.from(Tasks)
		// 	.where(eq(Tasks.id, params.arn));
		// if (!currentTask) {
		// 	return "Task doesn't exist";
		// }
		// const response = await task.describe(Resource.ScraperTask, currentTask.arn);
		// return {
		// 	id: currentTask?.id,
		// 	status: response.status,
		// };
	},
});
