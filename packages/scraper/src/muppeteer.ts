import { load } from "cheerio";
import puppeteer from "puppeteer";
import type { Browser, LaunchOptions, Page } from "puppeteer";
import { cleanUrl } from "./utils/cleanUrl.js";
import { cleanHtml } from "./utils/index.js";

const launchConfig: LaunchOptions = {
	headless: true,
	args: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-accelerated-2d-canvas",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-infobars", // Prevent infobars from appearing, which can interfere with scraping
		"--disable-blink-features=AutomationControlled", // Try to evade detection - may become less effective over time
	],
	defaultViewport: {
		width: 1280,
		height: 720, // Or consider smaller for performance if layout is not critical
	},
	handleSIGINT: true,
	handleSIGTERM: true,
	handleSIGHUP: true,
	ignoreDefaultArgs: ["--enable-automation"], // Further reduce automation traces
	// executablePath: "/home/appuser/.cache/puppeteer", // Uncomment if you need specific Chrome
	// userDataDir: process.env.PUPPETEER_USER_DATA_DIR, // Uncomment to persist browser session (use with caution for scraping)
};

export default class Muppeteer {
	// @ts-ignore
	private browser: Browser;

	async initialize() {
		this.browser = await puppeteer.launch(launchConfig);
	}

	async newPage(url: string) {
		const page = await this.browser.newPage();

		await page.goto(url, {
			waitUntil: "networkidle0",
		});

		return page;
	}

	async extractLinks(page: Page) {
		const html = await page.content();

		const $ = load(html);

		return $("a")
			.filter((_, node) => $(node).attr("href") !== "#")
			.map((_, node) => {
				const pageUrl = new URL(page.url());
				const cleanedUrl = cleanUrl(pageUrl.origin, $(node).attr("href"));

				return {
					link: cleanedUrl,
					text: $(node).text().trim(),
				};
			})
			.toArray();
	}

	// TODO: Update biome to lint promises called with no await
	// https://github.com/biomejs/biome/issues/3187
	async extractText(page: Page) {
		const html = await page.content();
		return cleanHtml(html, page.url());
		// const cleanedHtml = cleanHtml(html);
		// return htmlToMarkdown(cleanedHtml);
	}
}
