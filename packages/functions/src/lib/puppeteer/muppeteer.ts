import chromium from "@sparticuz/chromium";
import { load } from "cheerio";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { cleanUrl } from "./utils/cleanUrl.js";

const YOUR_LOCAL_CHROMIUM_PATH =
	"/home/mike/.cache/puppeteer/chrome/linux-133.0.6943.141/chrome-linux64/chrome";

export default class Muppeteer {
	// @ts-ignore
	private browser: Browser;

	async initialize() {
		this.browser = await puppeteer.launch({
			args: chromium.args,
			defaultViewport: chromium.defaultViewport,
			executablePath: process.env.SST_DEV
				? YOUR_LOCAL_CHROMIUM_PATH
				: await chromium.executablePath(),
			headless: chromium.headless,
		});
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

	async extractText(page: Page) {
		await page.addScriptTag({
			url: "https://cdn.jsdelivr.net/npm/@mozilla/readability@0.6.0/Readability.min.js",
		});

		const result = await page.evaluate(() => {
			// @ts-ignore
			const reader = new Readability(document);
			return reader.parse().textContent;
		});

		return result as string;
	}
}
