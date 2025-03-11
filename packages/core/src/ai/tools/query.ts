import { tool } from "ai";
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../drizzle";
import { Contents } from "../../entities/content.sql";
import { Urls } from "../../entities/url.sql";
import { generateEmbeddings } from "../libs";
import { transformToKeywords } from "../prompts";

export const searchUrlInDb = tool({
	description: `
		Takes a url from the users query and searched the database if there is existing data to be queried. The url string must be a complete and valid url.
	`,
	parameters: z.object({
		url: z.string(),
	}),
	async execute(params, toolOpts) {
		const result = await db
			.select({
				url: Urls.url,
			})
			.from(Urls)
			.where(eq(Urls.url, params.url))
			.limit(1);

		return result.length;
	},
});

export const queryVectorDb = tool({
	description: `
		Takes a query and creates embeddings of the message and query the vector database, tool returns relevant text information.
  `,
	parameters: z.object({
		message: z.string().describe("Message to create embeddings"),
		url: z.string().describe("Url from the user"),
	}),
	execute: async (params, toolOpts) => {
		try {
			const { embeddings } = await generateEmbeddings([params.message]);
			const similarity = sql<number>`1 - (${cosineDistance(Contents.embedding, embeddings[0])})`;
			let relevantContent = "No relevant information found!";

			const result = await db
				.select({
					content: Contents.text,
					url: Contents.url,
					similarity,
				})
				.from(Contents)
				.where(and(gt(similarity, 0.5), eq(Contents.url, params.url)))
				.orderBy((t) => desc(t.similarity));

			console.log(result.length);

			if (result.length) {
				relevantContent = result.map((record) => record.content).join("\n");
			}

			return {
				message: params.message,
				url: params.url,
				results: relevantContent,
			};
		} catch (e) {
			console.error(e);
		}
	},
});

export const transformQuery = tool({
	description: `
		Takes a query and helps expand it to yield more results from the vector database search.
	`,
	parameters: z.object({
		query: z.string(),
	}),
	async execute(params) {
		const { object: keywords } = await transformToKeywords(params.query);
		return keywords.join("\n");
	},
});
