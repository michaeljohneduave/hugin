import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const Tasks = pgTable("tasks", {
	id: serial("id").primaryKey(),
	arn: text("arn").notNull(),
	key: text("key").unique(),
});
