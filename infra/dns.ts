export const domain = {
	prod: "meduave.com",
}[$app.stage];

export const zone = cloudflare.getZoneOutput({
	name: "meduave.com",
});
