/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "hugin-bot",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          profile: "alt_account",
        },
        aiven: {
          apiToken: process.env.AIVEN_TOKEN,
          version: "6.35.0",
        },
      },
    };
  },
  async run() {
    const storage = await import("./infra/storage");
    const api = await import("./infra/api");
    const {Postgres} = await import("./infra/postgres");
    const {POSTGRES_CONN_URI} = await import("./infra/secrets")

    new sst.x.DevCommand("DrizzleStudio", {
      link: [Postgres, POSTGRES_CONN_URI],
      dev: {
        command: "npx drizzle-kit studio",
      },
    });

    new sst.aws.StaticSite("ChatSite", {
      path: "apps/chat",
      environment: {
        VITE_API_URL: api.scraper.url,
      },
    });
    return {
      MyBucket: storage.bucket.name,
    };
  },
});
