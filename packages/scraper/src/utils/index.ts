import { Readability } from "@mozilla/readability";
import Dompurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";
import Turndown from "turndown";

export function cleanHtml(html: string, url: string) {
	// Purify and remove malicious code from html page
	const cleanHTML = Dompurify.sanitize(html, {
		FORBID_TAGS: ["style"],
		USE_PROFILES: {
			html: true,
		},
	});

	// Convert html string into document
	const dom = new JSDOM(cleanHTML, {
		url,
	});

	// Parse document object into mozilla's readability library
	return new Readability(dom.window.document, {
		charThreshold: 500, // Default
	}).parse();

	// return $.html();
}

export function htmlToMarkdown(html: string): string {
	const turndown = new Turndown();
	return turndown.turndown(html);
}
