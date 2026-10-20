import basicFragment from "../shaders/basic-fragment.glsl";
import defaultVertex from "../shaders/default-vertex.glsl";
import { templateLiteralRenderer } from "../shaders/template";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "./gl";
import { selectProgram } from "./programs-cache";

/**
 *
 * @return {import("./programs").SvelteGLProgram}
 */
export function createDebugNormalsProgram() {
	const debugProgram = {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [],
		useProgram,
		selectProgram,
		updateProgram: [],
	};
	return debugProgram;
}

function createShaders(ctx) {
	const { gl, program } = ctx;
	const vertexShaderSource = templateLiteralRenderer(defaultVertex, {
		instances: false,
		declarations: "",
		positionModifier: "",
		uv1: false,
	})({
		instances: false,
		declarations: "",
		positionModifier: "",
	});
	compileShaders(gl, program, vertexShaderSource, basicFragment);
}
