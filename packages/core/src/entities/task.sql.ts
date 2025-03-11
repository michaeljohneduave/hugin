import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const Tasks = pgTable("tasks", {
	id: serial("id").primaryKey(),
	arn: text("arn").notNull(),
	key: text("key").unique(),
	createdAt: timestamp().defaultNow(),
	updatedAt: timestamp().defaultNow(),
});
