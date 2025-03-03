import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser();

type Sitemap = {
	urlset: {
		url: {
			loc: string;
			changefreq: string;
			priority: string;
			lastmod: string;
		}[];
	};
};

export default async function (url: string) {
	const site = new URL(url);

	const response = await fetch(`${site.origin}/sitemap.xml`);
	const sitemap = parser.parse(await response.text()) as Sitemap;

	return sitemap.urlset.url.map((url) => url.loc);
}
