import vertexShader from "./data-displace-vertex.glsl";
import fragmentShader from "./data-displace-fragment.glsl";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "../store/gl";
import { selectProgram } from "../store/programs-cache";

export function createDataDisplaceProgram(dataTexture) {
	let amplitude = 1;

	function createShaders(ctx) {
		const { gl, program } = ctx;
		compileShaders(gl, program, vertexShader, fragmentShader);
	}

	function setupAmplitude(ctx) {
		const { gl, program } = ctx;
		const location = gl.getUniformLocation(program, "amplitude");
		gl.uniform1f(location, amplitude);
	}

	return {
		setAmplitude(value) {
			amplitude = value;
		},
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [dataTexture.setupTexture],
		bindTextures: [dataTexture.bindTexture],
		updateProgram: [setupAmplitude],
		useProgram,
		selectProgram,
	};
}
