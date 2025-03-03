export default function getPage(url: string) {
	return fetch(url).then((response) => response.text());
}
