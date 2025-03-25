import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { Resource } from "sst";

interface MigrationOptions {
	databaseName: string;
	migrationDir: string;
	accountId: string;
	apiToken: string;
	databaseId: string;
	zoneId?: string; // Optional zone ID
}

async function applyD1Migrations(options: MigrationOptions): Promise<void> {
	const {
		databaseName,
		migrationDir,
		accountId,
		apiToken,
		databaseId,
		zoneId,
	} = options;

	// 1. Create the wrangler.json content as a JavaScript object,
	//    including values from migrationOptions
	const wranglerConfig = {
		// name: "my-d1-worker", // Replace with your project name if necessary
		// main: "index.js", // Replace with your main file if different
		compatibility_date: new Date().toISOString().split("T")[0],
		compatibility_flags: ["nodejs_compat"],
		d1_databases: [
			{
				binding: "DB",
				database_name: databaseName,
				database_id: databaseId,
				migrations_dir: migrationDir,
			},
		],
		vars: {
			CLOUDFLARE_ACCOUNT_ID: accountId,
			CLOUDFLARE_API_TOKEN: apiToken,
		},
	};

	if (zoneId) {
		// @ts-ignore
		wranglerConfig.zone_id = zoneId;
	}

	// 2. Convert the JavaScript object to JSON string
	const jsonString = JSON.stringify(wranglerConfig, null, 2); // Pretty print

	// 3. Write the JSON string to a temporary file
	const tempJsonPath = path.join(process.cwd(), "wrangler.json");

	try {
		await fs.writeFile(tempJsonPath, jsonString, "utf8");

		const args: string[] = [
			"d1",
			"migrations",
			"apply",
			databaseName,
			"-c",
			tempJsonPath,
			"--cwd",
			process.cwd(),
			"--remote",
		];

		await new Promise((resolve, reject) => {
			const wrangler = spawn(
				"node",
				["node_modules/wrangler/bin/wrangler.js", ...args],
				{
					cwd: process.cwd(),
				},
			);

			wrangler.stdout.on("data", (data) => {
				console.log(`stdout: ${data}`);
			});

			wrangler.stderr.on("data", (data) => {
				console.error(`stderr: ${data}`);
			});

			wrangler.on("close", (code) => {
				if (code === 0) {
					console.log("D1 migrations applied successfully.");
					resolve(code);
				} else {
					console.error(`D1 migrations failed with code ${code}`);
					reject(new Error(`D1 migrations failed with code ${code}`));
				}
			});

			wrangler.on("error", (err) => {
				console.error("Failed to start wrangler.");
				reject(err);
			});
		}).finally(() => fs.rm(tempJsonPath, { recursive: true, force: true }));
	} catch (error) {
		console.error(error);
	}
}

async function main(): Promise<void> {
	try {
		const migrationOptions: MigrationOptions = {
			databaseName: Resource.ChatDBName.name,
			migrationDir: "packages/functions/migrations",
			accountId: Resource.CLOUDFLARE_ACCOUNT_ID.value,
			apiToken: Resource.CLOUDFLARE_API_TOKEN.value,
			databaseId: Resource.ChatDBId.id,
		};

		console.log(migrationOptions);

		await applyD1Migrations(migrationOptions);
		console.log("Migration completed successfully!");
	} catch (error) {
		console.error("Migration failed:", error);
	}
}

main();
