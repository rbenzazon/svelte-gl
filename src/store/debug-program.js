import { appContext, selectProgram } from "./engine";
import { createProgram, linkProgram, useProgram, validateProgram } from "./gl";
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
	})({
		instances: false,
		declarations: "",
		positionModifier: "",
	});
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, basicFragment);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}
