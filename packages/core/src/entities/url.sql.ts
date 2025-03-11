import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
	date,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export type NewUrl = InferInsertModel<typeof Urls>;
export type Url = InferSelectModel<typeof Urls>;

export const statusEnum = pgEnum("status", ["pending", "complete", "error"]);
export const priorityEnum = pgEnum("priority", [
	"high",
	"medium-high",
	"medium",
	"low",
]);

export const Urls = pgTable("urls", {
	id: serial("id").primaryKey(),
	purpose: text("purpose").notNull(),
	mainUrl: text("mainUrl").notNull(),
	url: text("url").notNull().unique(),
	status: statusEnum("status").notNull(),
	priority: priorityEnum("priority").notNull(),
	createdAt: timestamp().defaultNow(),
	updatedAt: timestamp().defaultNow(),
});
