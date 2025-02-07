export function convertToVector4(color) {
	if (Array.isArray(color)) {
		if (color.length === 4) {
			return color;
		}
		return [...color, 1];
	}
	if (typeof color === "number") {
		return convertHexToVector4(color);
	}
	if (typeof color === "string" && color.startsWith("#")) {
		return convertHexToVector4(parseInt(color.replace("#", "0x")));
	}
	return color;
}

export function convertToVector3(color) {
	if (Array.isArray(color)) {
		return [...color];
	}
	if (typeof color === "number") {
		return convertHexToVector3(color);
	}
	if (typeof color === "string" && color.startsWith("#")) {
		return convertHexToVector3(parseInt(color.replace("#", "0x")));
	}
	return color;
}

export function convertHexToVector4(hex) {
	return [((hex >> 24) & 255) / 255, ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export function convertHexToVector3(hex) {
	return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export function convertSRGBToLinear3(hex) {
	hex = Math.floor(hex);
	return convertHexToVector3(hex).map(SRGBToLinear);
}

export function convertSRGBToLinear(hex) {
	hex = Math.floor(hex);
	return convertHexToVector4(hex).map(SRGBToLinear);
}

export function SRGBToLinear(c, index) {
	if (index === 3) {
		return c;
	}
	return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

export function linearArrayToCSSHashColor(array) {
	return array.map((num) => Math.floor(num * 255)).reduce((acc, num) => acc + num.toString(16).padStart(2, "0"), "#");
}
export function hexNumToCSSStringColor(hex) {
	return "#" + hex.toString(16).padStart(6, "0");
}
export function cssStringColorToHexNum(color) {
	return parseInt(color.slice(1), 16);
}
export function cssStringColorToLinearArray(color) {
	return [
		parseInt(color.slice(1, 3), 16) / 255,
		parseInt(color.slice(3, 5), 16) / 255,
		parseInt(color.slice(5, 7), 16) / 255,
	];
}

export const colorProps = ["diffuse", "color"];
