import wobblyShader from "./wobbly.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { get } from "svelte/store";
import { appContext } from "../../store/engine-refactor.js";

/**
 * @typedef WobblyProps
 * @property {number} [frequency=0.04]
 * @property {number} [amplitude=1]
 */

/**
 *
 * @param {WobblyProps} props
 * @returns
 */
export const createWobblyAnimation = (props) => {
	return {
		...props,
		type: "vertex",
		requireTime: true,
		shader: templateLiteralRenderer(wobblyShader, {
			declaration: false,
			position: false,
		}),
		setupAnimation: setupWobbly(props),
	};
};

function setupWobbly({ frequency, amplitude }) {
	return function () {
		const { gl, program } = appContext;

		const frequencyLocation = gl.getUniformLocation(program, "wobblyFrequency");
		const amplitudeLocation = gl.getUniformLocation(program, "wobblyAmplitude");

		gl.uniform1f(frequencyLocation, frequency);
		gl.uniform1f(amplitudeLocation, amplitude);
	};
}
