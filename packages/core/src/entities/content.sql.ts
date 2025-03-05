import {
	bigserial,
	index,
	pgTable,
	serial,
	text,
	vector,
} from "drizzle-orm/pg-core";

const GOOGLE_TEXT_EMBEDDING_SIZE = 768;

export const Contents = pgTable(
	"contents",
	{
		id: serial("id").primaryKey(),
		url: text("url").notNull(),
		text: text("text").notNull(),
		embedding: vector({
			dimensions: GOOGLE_TEXT_EMBEDDING_SIZE,
		}).notNull(),
	},
	(table) => [
		index("embeddingIndex").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
	],
);
