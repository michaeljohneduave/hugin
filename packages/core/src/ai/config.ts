import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Resource } from "sst";

const google = createGoogleGenerativeAI({
	apiKey: Resource.GOOGLE_GENERATIVE_AI_API_KEY.value,
});

export const bigModel = google("gemini-2.5-flash-preview-04-17");
export const bigThinkingModel = google("gemini-2.5-pro-exp-03-25");
export const bigModelWithSearch = google("gemini-2.5-flash-preview-04-17", {
	useSearchGrounding: true,
});
export const smolModel = google("gemini-2.0-flash-lite");
export const embeddingModel = google.textEmbeddingModel("text-embedding-004");
export const BIG_MODEL_MAX_TOKEN = 8192;
export const SMOL_MODEL_MAX_TOKEN = 8192;
export const GOOGLE_TEXT_EMBEDDING_SIZE = 768;
