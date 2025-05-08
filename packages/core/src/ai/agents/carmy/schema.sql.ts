import {
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	vector,
} from "drizzle-orm/pg-core";
import { GOOGLE_TEXT_EMBEDDING_SIZE } from "../../config";

export const Recipe = pgTable("recipe", {
	recipeId: serial("recipeId").primaryKey(),
	userId: text("userId").notNull(),
	// houseId: text("houseId").notNull(),
	name: text("name").notNull(),
	ingredients: text("ingredients").notNull(),
	instructions: text("instructions").notNull(),
	url: text("url").notNull(),
	embedding: vector({
		dimensions: GOOGLE_TEXT_EMBEDDING_SIZE,
	}).notNull(),
	createdAt: timestamp().defaultNow(),
	updatedAt: timestamp().defaultNow(),
});
