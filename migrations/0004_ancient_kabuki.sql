CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"arn" text NOT NULL,
	"key" text,
	CONSTRAINT "tasks_key_unique" UNIQUE("key")
);
