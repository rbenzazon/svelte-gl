import noiseShader from "./noise-distortion.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { get } from "svelte/store";

/**
 * @typedef NoiseProps
 * @property {number} [frequency=0.04]
 * @property {number} [amplitude=1]
 */

/**
 *
 * @param {NoiseProps} props
 * @returns
 */
export const createNoiseDistortionAnimation = (props) => {
	return {
		...props,
		type: "vertex",
		requireTime: true,
		shader: templateLiteralRenderer(noiseShader, {
			declaration: false,
			position: false,
		}),
		setupAnimation: (context) => setupNoise(context, props),
	};
};

function setupNoise(context, { frequency, amplitude }) {
	return function () {
		context = get(context);
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = context;

		const frequencyLocation = gl.getUniformLocation(program, "noiseDistortionFrequency");
		const amplitudeLocation = gl.getUniformLocation(program, "noiseDistortionAmplitude");

		gl.uniform1f(frequencyLocation, frequency);
		gl.uniform1f(amplitudeLocation, amplitude);
	};
}
