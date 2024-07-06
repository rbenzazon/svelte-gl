import pointLightShader from "../shaders/point-light.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";

export const createPointLight = (props) => {
	return {
		type: "point",
		position: [0, 0, 0],
		color: [1, 1, 1],
		intensity: 3,
		cutoffDistance: 5,
		decayExponent: 1,
		...props,
		shader: (segment) => templateLiteralRenderer(segment, pointLightShader),
	};
};
