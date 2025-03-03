export function cleanUrl(origin: string, url?: string): string {
	// Handle undefined, null, or empty URL
	if (!url || url.trim() === "") {
		return "";
	}

	try {
		// Check if the URL is already absolute
		const u = new URL(url, origin);

		// Get the pathname and remove trailing slashes
		let pathname = u.pathname;
		while (pathname.length > 1 && pathname.endsWith("/")) {
			pathname = pathname.slice(0, -1);
		}

		// Clean up double slashes in pathname (except after protocol)
		pathname = pathname.replace(/([^:])\/+/g, "$1/");

		// Remove empty segments like '//'
		pathname = pathname.replace(/\/\//g, "/");

		return `${u.origin}${pathname}`;
	} catch (e) {
		// Handle relative URLs
		if (e instanceof TypeError) {
			// Ensure origin ends with slash if url doesn't start with one
			let cleanOrigin = origin;
			if (!cleanOrigin.endsWith("/") && !url.startsWith("/")) {
				cleanOrigin += "/";
			}

			// Clean the relative path
			let cleanPath = url;
			// Remove trailing slashes (except if it's just '/')
			while (cleanPath.length > 1 && cleanPath.endsWith("/")) {
				cleanPath = cleanPath.slice(0, -1);
			}

			// Remove empty segments in the path
			cleanPath = cleanPath.replace(/\/\//g, "/");

			return `${cleanOrigin}${cleanPath}`;
		}

		console.error(e);

		// Return empty string for other errors
		return "";
	}
}
