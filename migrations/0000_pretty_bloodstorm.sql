CREATE TYPE "public"."priority" AS ENUM('high', 'medium-high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'complete', 'error');--> statement-breakpoint
CREATE TABLE "urls" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"mainUrl" text NOT NULL,
	"url" text NOT NULL,
	"status" "status" NOT NULL,
	"priority" "priority" NOT NULL,
	"createdAt" date DEFAULT now(),
	"updatedAt" date DEFAULT now(),
	CONSTRAINT "urls_url_unique" UNIQUE("url")
);
