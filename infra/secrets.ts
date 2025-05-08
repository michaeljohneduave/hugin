export const GOOGLE_GENERATIVE_AI_API_KEY = new sst.Secret(
	"GOOGLE_GENERATIVE_AI_API_KEY",
);
export const AIVEN_TOKEN = new sst.Secret("AIVEN_TOKEN");
export const POSTGRES_CONN_URI = new sst.Secret("POSTGRES_CONN_URI");

export const CLOUDFLARE_ACCOUNT_ID = new sst.Secret(
	"CLOUDFLARE_ACCOUNT_ID",
	process.env.CLOUDFLARE_ACCOUNT_ID,
);
export const CLOUDFLARE_API_TOKEN = new sst.Secret(
	"CLOUDFLARE_API_TOKEN",
	process.env.CLOUDFLARE_API_TOKEN,
);

export const CLERK_SECRET_KEY = new sst.Secret("CLERK_SECRET_KEY");
export const GIPHY_API_KEY = new sst.Secret("GIPHY_API_KEY");

export const VAPID_PRIVATE_KEY = new sst.Secret("VAPID_PRIVATE_KEY");

export const FIREBASE_PRIVATE_KEY = new sst.Secret("FIREBASE_PRIVATE_KEY");
export const FIREBASE_CLIENT_EMAIL = new sst.Secret("FIREBASE_CLIENT_EMAIL");
export const FIREBASE_PROJECT_ID = new sst.Secret("FIREBASE_PROJECT_ID");
export const BRAVE_API_KEY = new sst.Secret("BRAVE_API_KEY");