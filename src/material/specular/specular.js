import specularShader from "./specular.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { get } from "svelte/store";

export const createSpecular = ({ color, f90, roughness }) => {
	return {
		color,
		f90,
		roughness,
		shader: (segment) => templateLiteralRenderer(segment, specularShader),
		setupSpecular: (context) => setupSpecular(context, { color, f90, roughness }),
	};
};

function setupSpecular(context, specular) {
	return function () {
		context = get(context);
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = context;

		const colorLocation = gl.getUniformLocation(program, "specularColor");
		const f90Location = gl.getUniformLocation(program, "specularF90");
		const roughnessLocation = gl.getUniformLocation(program, "specularRoughness");

		gl.uniform3fv(colorLocation, specular.color);
		gl.uniform1f(f90Location, specular.f90);
		gl.uniform1f(roughnessLocation, specular.roughness);
	};
}
