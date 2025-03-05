ALTER TABLE "contents" ALTER COLUMN "url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "embedding" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "contents" USING hnsw ("embedding" vector_cosine_ops);