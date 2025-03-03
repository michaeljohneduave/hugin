CREATE TABLE "contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text,
	"embedding" vector(768)
);
