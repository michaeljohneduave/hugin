import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Resource } from "sst";

const google = createGoogleGenerativeAI({
	apiKey: Resource.GOOGLE_GENERATIVE_AI_API_KEY.value,
});

export const bigModel = google("gemini-2.0-flash-001");
export const brightModel = google("gemini-2.0-flash-thinking-exp-01-21");
export const smolModel = google("gemini-2.0-flash-lite-preview-02-05");
export const embeddingModel = google.textEmbeddingModel("text-embedding-004");
export const BIG_MODEL_MAX_TOKEN = 8192;
export const SMOL_MODEL_MAX_TOKEN = 8192;
