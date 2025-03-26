export function extractXMP(input) {
	const string = new TextDecoder().decode(input);
	const startTag = "<x:xmpmeta";
	let start = string.indexOf(startTag);
	const endTag = "</x:xmpmeta>";
	while (start !== -1) {
		const end = string.indexOf(endTag, start);
		if (start === -1 || end === -1) return null;
		const xml = string.slice(start, end + endTag.length);
		const parsedXML = new DOMParser().parseFromString(xml, "text/xml");

		const description = parsedXML.getElementsByTagName("rdf:Description")[0];
		const attributes = Object.fromEntries(
			Array.from(description.attributes)
				.map((n) => [n.name.split(":")[1], n.value])
				.map(([k, v]) => [k.substr(0, 3).toLowerCase() + k.substr(3), v])
				.map(([k, v]) => [k, isNaN(v) ? (v === "True" || v === "False" ? v === "True" : v) : parseFloat(v)])
				.slice(1),
		);

		if (attributes.hdrCapacityMax != null) {
			return attributes;
		}
		start = string.indexOf(startTag, end);
	}
	return null;
}
