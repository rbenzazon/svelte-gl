import noiseShader from "./noise-distortion.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { get } from "svelte/store";
import { appContext } from "../../store/engine-refactor";

/**
 * @typedef NoiseProps
 * @property {number} [frequency=1]
 * @property {number} [speed=1]
 * @property {number} [amplitude=1]
 * @property {number} [normalTangentLength=0.01]
 */

/**
 *
 * @param {NoiseProps} props
 * @returns
 */
export const createNoiseDistortionAnimation = ({
	frequency = 1,
	speed = 1,
	amplitude = 1,
	normalTangentLength = 0.01,
}) => {
	return {
		frequency,
		speed,
		amplitude,
		normalTangentLength,
		type: "vertex",
		requireTime: true,
		shader: templateLiteralRenderer(noiseShader, {
			declaration: false,
			position: false,
		}),
		setupAnimation: setupNoise({ frequency, speed, amplitude, normalTangentLength }),
	};
};

function setupNoise({ frequency, speed, amplitude, normalTangentLength }) {
	return function () {
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = appContext;

		const frequencyLocation = gl.getUniformLocation(program, "noiseDistortionFrequency");
		const speedLocation = gl.getUniformLocation(program, "noiseDistortionSpeed");
		const amplitudeLocation = gl.getUniformLocation(program, "noiseDistortionAmplitude");
		const normalTangentLengthLocation = gl.getUniformLocation(program, "noiseDistortionTangentLength");

		gl.uniform1f(frequencyLocation, frequency * 2);
		gl.uniform1f(speedLocation, speed * 0.001);
		gl.uniform1f(amplitudeLocation, amplitude * 0.07);
		gl.uniform1f(normalTangentLengthLocation, normalTangentLength);
	};
}
