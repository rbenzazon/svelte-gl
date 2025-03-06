/**
 * @callback TemplateRenderer
 * @param {Object.<string, any>} propsWithValues
 * @returns {string}
 */
/**
 *
 * @param {string} template
 * @param {Object.<string, string|boolean|number>} parameters
 * @returns {TemplateRenderer}
 */

export const templateLiteralRenderer = (template, parameters) => {
	const fn = Function.constructor(
		...Object.entries(parameters).map(([key, defaultValue]) => {
			if (defaultValue === "") {
				defaultValue = '""';
			}
			return `${key}${defaultValue != null ? `=${defaultValue}` : ""}`;
		}),
		`return \`${template}\``,
	);
	return (propsWithValues) =>
		fn(...Object.keys(parameters).map((key) => (propsWithValues[key] != null ? propsWithValues[key] : undefined)));
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
