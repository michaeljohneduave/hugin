export const Postgres = new sst.Linkable("Postgres", {
	properties: {
		dbName: "defaultdb",
	},
});

export const MessageTable = new sst.aws.Dynamo("MessageTable", {
	fields: {
		pk: "string",
		sk: "string",
		gsi1pk: "string",
		gsi1sk: "string",
		gsi2pk: "string",
		gsi2sk: "string",
		gsi3pk: "string",
		gsi3sk: "string",
	},
	primaryIndex: {
		hashKey: "pk",
		rangeKey: "sk",
	},
	globalIndexes: {
		gsi1: {
			hashKey: "gsi1pk",
			rangeKey: "gsi1sk",
		},
		gsi2: {
			hashKey: "gsi2pk",
			rangeKey: "gsi2sk",
		},
		gsi3: {
			hashKey: "gsi3pk",
			rangeKey: "gsi3sk",
		},
	},
	ttl: "expireAt",
});
