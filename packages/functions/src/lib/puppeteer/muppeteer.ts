import chromium from "@sparticuz/chromium";
import { load } from "cheerio";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import TurndownService from "turndown";
import { cleanUrl } from "./utils/cleanUrl.js";

const YOUR_LOCAL_CHROMIUM_PATH =
	// "/home/mike/.cache/puppeteer/chrome/linux-133.0.6943.141/chrome-linux64/chrome";
	"/Users/michaeleduave/.cache/localChrome/chrome/mac_arm-133.0.6943.141/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

export default class Muppeteer {
	// @ts-ignore
	private browser: Browser;
	private turndownService: TurndownService;

	constructor() {
		this.turndownService = new TurndownService();
	}

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
			waitUntil: "domcontentloaded",
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
		try {
			await page.addScriptTag({
				url: "https://cdn.jsdelivr.net/npm/@mozilla/readability@0.6.0/Readability.min.js",
			});

			const result = await page.evaluate(() => {
				// @ts-ignore
				const reader = new Readability(document);
				return reader.parse().textContent;
			});

			return result as string;
		} catch (e) {
			console.error(e);
			return "";
		}
	}

	async convertToMarkdown(page: Page) {
		const html = await page.content();
		const $ = load(html);
		return this.turndownService.turndown($("body").html() || "");
	}

	async extractAllMatchesData(
		page: Page,
		cheerioQuery: string
		// Specify what to extract: 'html', 'text', or an attribute name like 'href'
	): Promise<string[]> {
		try {
			const html = await page.content();
			const $ = load(html);
			const elements = $(cheerioQuery);

			const results: string[] = elements
				.map((index, element) => {
					const $element = $(element);
					const data = $element.html();
					// Filter out null/undefined results if needed, ensure it's a string
					return data ?? "";
				})
				.get() // .get() converts Cheerio map result to a standard array
				.filter((item) => item !== ""); // Optional: remove empty strings

			return results;
		} catch (e) {
			console.error(`Error extracting data for selector "${cheerioQuery}"`, e);
			return []; // Return empty array on error
		}
	}
}
