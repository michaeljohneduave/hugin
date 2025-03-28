import webpush from "web-push";

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log("VAPID Keys:");
console.log("Public Key:", vapidKeys.publicKey);
console.log("Private Key:", vapidKeys.privateKey);

// Also show the keys in the format needed for SST config
console.log("\nFor infra/config.ts:");
console.log(`export const vapidPublicKey = new sst.Linkable("VapidPublicKey", {
  properties: {
    key: "${vapidKeys.publicKey}",
  },
});`);

console.log("\nFor your environment:");
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
