import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

const client = new DynamoDBClient({
	region: "us-east-1",
});

const DocumentClient = DynamoDBDocumentClient.from(client, {
	marshallOptions: {
		convertEmptyValues: true,
	},
});

export const dynamoConfig = {
	client: DocumentClient,
	table: Resource.MessageTable.name,
};
