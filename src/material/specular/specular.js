import specularShader from "./specular.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { get } from "svelte/store";

export const createSpecular = ({ roughness = 0, ior = 1.5, intensity = 1, color = [1, 1, 1] } = props) => {
	return {
		...props,
		shader: (segment) => templateLiteralRenderer(segment, specularShader),
		setupSpecular: (context) => setupSpecular(context, props),
	};
};

function setupSpecular(context, { roughness, ior, intensity, color }) {
	return function () {
		context = get(context);
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = context;

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
