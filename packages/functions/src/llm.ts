import { pearlAgent } from "@hugin-bot/core/src/ai/agents/pearl";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { type ResponseStream, streamifyResponse } from "lambda-stream";

export const scrapeCompanyUrl = streamifyResponse(handler);

async function handler(
	_event: APIGatewayProxyEventV2,
	responseStream: ResponseStream,
) {
	const { messages } = JSON.parse(_event.body || "");

	const res = await pearlAgent(messages, "stream");
	const readableStream = await res.toDataStream();
	const reader = readableStream.getReader();
	let continueReading = true;

	while (continueReading) {
		try {
			const { done, value } = await reader.read(); // Read a chunk from the readable stream

			if (done) {
				continueReading = false;
				responseStream.end();
				break;
			}

			if (value) {
				// console.log("stream value", new Buffer(value).toString());
				responseStream.write(value);
			}
		} catch (error) {
			console.error("Error reading from readable stream:", error);
			responseStream.destroy(error as Error);
			break;
		}
	}
	console.log(
		"steps.toolCalls",
		(await res.steps).flatMap((step) => step.toolCalls),
	);
	console.log("toolResults", await res.toolResults);
	console.log("reasoningDetails", await res.reasoningDetails);
	console.log("usage", res.usage);
}
