import specularShader from "./specular.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { get } from "svelte/store";
import { appContext } from "../../store/engine-refactor.js";

//{ roughness = 0, ior = 1.5, intensity = 1, color = [1, 1, 1] } =
/**
 * @typedef SpecularProps
 * @property {number} [roughness=0]
 * @property {number} [ior=1.5]
 * @property {number} [intensity=1]
 * @property {number[]} [color=[1, 1, 1]]
 */
/**
 * @typedef SpecularExtended
 * @property {import("../../shaders/template.js").TemplateRenderer} shader
 * @property {()=>void} setupSpecular
 */
/**
 * @typedef {SpecularProps & SpecularExtended} SvelteGLSpecular
 */

/**
 *
 * @param {SpecularProps} props
 * @returns
 */
export const createSpecular = (props) => {
	return {
		...props,
		shader: templateLiteralRenderer(specularShader, {
			declaration: false,
			irradiance: false,
		}),
		setupSpecular: setupSpecular(props),
	};
};

function setupSpecular({ roughness, ior, intensity, color }) {
	return function setupSpecular() {
		const { gl, program } = appContext;

		const colorLocation = gl.getUniformLocation(program, "specularColor");
		const roughnessLocation = gl.getUniformLocation(program, "roughness");
		const iorLocation = gl.getUniformLocation(program, "ior");
		const specularIntensityLocation = gl.getUniformLocation(program, "specularIntensity");

		gl.uniform3fv(colorLocation, color);
		gl.uniform1f(roughnessLocation, roughness);
		gl.uniform1f(iorLocation, ior);
		gl.uniform1f(specularIntensityLocation, intensity);
	};
}
