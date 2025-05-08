import { tool } from "ai";
import { Resource } from "sst";
import { z } from "zod";
import type { BraveSearchResponse } from "../../types/brave";

export const today = tool({
	description:
		"Get the current date, use this tool to get the current date and time. You can also use it to calculate future dates like tomorrow, next week, next month, next year, next decade",
	parameters: z.object({}),
	execute() {
		// Set timezone to PST
		const date = new Date();
		date.setHours(date.getHours() - 8);
		return Promise.resolve(date.toISOString());
	},
});

export const webSearch = tool({
	description: "Search the web for information",
	parameters: z.object({
		query: z.string(),
	}),
	async execute(params) {
		const url = new URL("https://api.search.brave.com/res/v1/web/search");

		url.searchParams.set("q", params.query);

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"X-Subscription-Token": Resource.BRAVE_API_KEY.value,
			},
		});

		const results = (await response.json()) as BraveSearchResponse;
		return results.web?.results || [];
	},
});
