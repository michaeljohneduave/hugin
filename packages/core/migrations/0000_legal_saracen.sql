CREATE TYPE "public"."priority" AS ENUM('high', 'medium-high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'complete', 'error');--> statement-breakpoint
CREATE TABLE "foodPreference" (
	"userId" text NOT NULL,
	"houseId" text NOT NULL,
	"preferences" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"recipeId" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"ingredients" text NOT NULL,
	"instructions" text NOT NULL,
	"url" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"arn" text NOT NULL,
	"key" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "tasks_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "urls" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"mainUrl" text NOT NULL,
	"url" text NOT NULL,
	"status" "status" NOT NULL,
	"priority" "priority" NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "urls_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "contents" USING hnsw ("embedding" vector_cosine_ops);