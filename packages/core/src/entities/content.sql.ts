import {
	bigserial,
	index,
	pgTable,
	serial,
	text,
	timestamp,
	vector,
} from "drizzle-orm/pg-core";
import { GOOGLE_TEXT_EMBEDDING_SIZE } from "../ai/config";

export const Contents = pgTable(
	"contents",
	{
		id: serial("id").primaryKey(),
		url: text("url").notNull(),
		text: text("text").notNull(),
		embedding: vector({
			dimensions: GOOGLE_TEXT_EMBEDDING_SIZE,
		}).notNull(),
		createdAt: timestamp().defaultNow(),
		updatedAt: timestamp().defaultNow(),
	},
	(table) => [
		index("embeddingIndex").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
	],
);
