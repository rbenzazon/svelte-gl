const templateGenerator = (props, template) => {
	return (propsValues) => Function.constructor(...props, `return \`${template}\``)(...propsValues);
};
export const templateLiteralRenderer = (props, template) => {
	return templateGenerator(Object.keys(props), template)(Object.values(props));
};

export const objectToDefines = (obj) => {
	return [
		"",
		...Object.entries(obj).map(([key, value]) => {
			return `#define ${key} ${value}`;
		}),
	].join("\n");
};

export function renderArrayToGLSLFloat(array) {
	if (typeof array === "string") {
		array = JSON.parse(array);
	}
	const types = ["", "vec2", "vec3", "vec4"];
	return `${types[array.length - 1]}(${array.map((val) => val.toLocaleString("en", { minimumFractionDigits: 1 })).join(",")})`;
}
