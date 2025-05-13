import { appContext } from "./app-context";
import { selectProgram } from "./programs-cache";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "./gl";
import defaultVertex from "../shaders/default-vertex.glsl";
import basicFragment from "../shaders/basic-fragment.glsl";
import { templateLiteralRenderer } from "../shaders/template";

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

function createShaders() {
	const { gl, program } = appContext;
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
