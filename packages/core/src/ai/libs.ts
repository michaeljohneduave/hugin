import { cleanUrl } from "@hugin-bot/functions/src/lib/puppeteer/utils/cleanUrl";
import { CoreMessage, embedMany, tool } from "ai";
import { db } from "../drizzle";
import { type NewUrl, Urls } from "../entities/url.sql";
import { embeddingModel } from "./config";
import { prioritizeUrls } from "./prompts";
import { z } from "zod";

export async function storePriorityUrls(
  mainUrl: string,
  // Anti pattern
  links: Parameters<typeof prioritizeUrls>[2],
  purpose: string,
) {
  const { object: urls } = await prioritizeUrls(purpose, mainUrl, links);

  const urlsToScrape: NewUrl[] = urls
    .filter((url) => url.priority === "high" || url.priority === "medium-high")
    .map((url) => {
      const u = new URL(url.url);
      return {
        url: cleanUrl(u.origin, url.url),
        status: "pending",
        priority: url.priority,
        mainUrl: mainUrl,
        purpose: purpose,
      };
    });

  console.log(urlsToScrape);

  if (urlsToScrape.length > 0) {
    await db.insert(Urls).values(urlsToScrape).onConflictDoNothing().execute();
  }
}

export function generateEmbeddings(texts: string[]) {
  return embedMany({
    model: embeddingModel,
    values: texts,
  });
}

export const callAlbertAgent = tool({
  description: `
    Use this tool if:
    - Intent is unclear
    - Goal is not clear
    - Unsure about what to do next
    - Unsure about what to ask

    This tool will help you guide your next steps. Based on the actions or steps you have taken. It will analyze your previous actions and provide insights on what to do next.
  `,
  parameters: z.object({
    messages: z.array(z.object({
      content: z.string(),
      role: z.enum(["user", "system", "assistant", "tool"]),
    }))
  }),
  execute: (
    { messages },
    toolOpts,
  ) => {
    console.log("Executing callAlbertAgent tool");
    console.log("Messages:", messages);
    console.log("Tool options:", toolOpts);

    return "I can't help you with that";
  }
})
