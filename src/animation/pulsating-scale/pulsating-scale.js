import pulsatingScaleShader from "./pulsating-scale.glsl";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { appContext } from "../../store/engine";

/**
 * @typedef PulsatingScaleProps
 * @property {number} [frequency=0.04]
 * @property {number} [minScale=0.8]
 * @property {number} [maxScale=1.2]
 */

/**
 *
 * @param {PulsatingScaleProps} props
 * @returns {SvelteGLMeshAnimation & PulsatingScaleProps}
 */
export const createPulsatingScaleAnimation = ({ frequency = 0.04, minScale = 0.8, maxScale = 1.2 }) => {
	return {
		frequency,
		minScale,
		maxScale,
		type: "vertex",
		requireTime: true,
		shader: templateLiteralRenderer(pulsatingScaleShader, {
			declaration: false,
			position: false,
		}),
		setupAnimation: setupPulsatingScale({ frequency, minScale, maxScale }),
	};
};

function setupPulsatingScale({ frequency, minScale, maxScale }) {
	return function () {
		const { gl, program } = appContext;

		const frequencyLocation = gl.getUniformLocation(program, "pScaleFrequency");
		const minScaleLocation = gl.getUniformLocation(program, "pScaleMinScale");
		const maxScaleLocation = gl.getUniformLocation(program, "pScaleMaxScale");

		gl.uniform1f(frequencyLocation, frequency);
		gl.uniform1f(minScaleLocation, minScale);
		gl.uniform1f(maxScaleLocation, maxScale);
	};
}
