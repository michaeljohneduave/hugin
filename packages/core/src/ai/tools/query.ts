import { tool } from "ai";
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../drizzle";
import { Contents } from "../../entities/content.sql";
import { Urls } from "../../entities/url.sql";
import { generateEmbeddings } from "../libs";

export const queryVectorDb = tool({
	description: `
    Creates embeddings of the message and query the database, tool returns relevant text infromation.
    Tool requires a url and a message text.
  `,
	parameters: z.object({
		message: z.string().describe("Message to create embeddings"),
		url: z.string().describe("Url from the user"),
	}),
	execute: async (params, toolOpts) => {
		const { embeddings } = await generateEmbeddings([params.message]);
		const similarity = sql<number>`1 - (${cosineDistance(Contents.embedding, embeddings[0])})`;
		let relevantContent =
			"No embeddings found! Run the scraping tool to get the site content and generate embeddings";

		const result = await db
			.select({
				content: Contents.text,
				url: Contents.url,
				similarity,
			})
			.from(Contents)
			.where(and(gt(similarity, 0.1), eq(Contents.url, params.url)))
			.orderBy((t) => desc(t.similarity))
			.limit(1);

		if (result.length) {
			relevantContent = result.map((record) => record.content).join("\n");
		}

		return relevantContent;
	},
});
