// export const database = new sst.aws.Postgres("Postgres", {
// 	vpc,
// 	proxy: true,
// });

// export const database = new aiven.PgDatabase("Postgres", {
// 	serviceName: "pg-3f2b3744",
// 	databaseName: "mainDB",
// 	project: "meduave-16ca",
// });

// RDS is expensive af; so we'll manually provision other postgresql instance
// since I couldn't make the pulumi/aiven work
// This setup assumes user already has postgres instance live
// and has the pgvector extension installed in that instance
// TODO: Completely automate all of this shit
export const Postgres = new sst.Linkable("Postgres", {
	properties: {
		dbName: "defaultdb",
	},
});
