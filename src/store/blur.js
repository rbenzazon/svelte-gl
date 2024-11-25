import vertexShaderSource from "../shaders/blur-vertex.glsl";
import fragmentShaderSource from "../shaders/blur-fragment.glsl";
import { drawModes } from "./webgl";
import { appContext } from "./engine-refactor";

export const BLUR_DIRECTION_HORIZONTAL = 0;
export const BLUR_DIRECTION_VERTICAL = 1;

// Generate a gaussian kernel based on a width
const generate1DKernel = (width) => {
	if ((width & 1) !== 1) throw new Error("Only odd guassian kernel sizes are accepted");

	// Small sigma gaussian kernels are a problem. You usually need to add an error correction
	// algorithm. But since our kernels grow in discrete intervals, we can just pre-compute the
	// problematic ones. These values are derived from the Pascal's Triangle algorithm.
	/*const smallKernelLerps = [
        [1.0],
        [0.25, 0.5, 0.25],
        [0.0625, 0.25, 0.375, 0.25, 0.0625],
        [0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125],
	];
	if (width < 9) return smallKernelLerps[(width - 1) >> 1];*/
	if (width < 9) throw new Error("Blur must be at least 9 pixels wide");

	const kernel = [];
	const sigma = width / 6; // Adjust as required
	const radius = (width - 1) / 2;

	let sum = 0;

	// Populate the array with gaussian kernel values
	for (let i = 0; i < width; i++) {
		const offset = i - radius;

		const coefficient = 1 / (sigma * Math.sqrt(2 * Math.PI));
		const exponent = -(offset * offset) / (2 * (sigma * sigma));
		const value = coefficient * Math.exp(exponent);

		// We'll need this for normalization below
		sum += value;

		kernel.push(value);
	}

	// Normalize the array
	for (let i = 0; i < width; i++) {
		kernel[i] /= sum;
	}

	return kernel;
};

// Convert a 1D gaussian kernel to value pairs, as an array of linearly interpolated
// UV coordinates and scaling factors. Gaussian kernels are always have an odd number of
// weights, so in this implementation, the first weight value is treated as the lone non-pair
// and then all remaining values are treated as pairs.
const convertKernelToOffsetsAndScales = (kernel) => {
	if ((kernel.length & 1) === 0) throw new Error("Only odd kernel sizes can be lerped");

	const radius = Math.ceil(kernel.length / 2);
	const data = [];

	// Prepopulate the array with the first cell as the lone weight value
	let offset = -radius + 1;
	let scale = kernel[0];
	data.push(offset, scale);

	const total = kernel.reduce((c, v) => c + v);

	for (let i = 1; i < kernel.length; i += 2) {
		const a = kernel[i];
		const b = kernel[i + 1];

		offset = -radius + 1 + i + b / (a + b);
		scale = (a + b) / total;
		data.push(offset, scale);
	}

	return data;
};

/**
 *
 * @param {boolean} mapCurrent makes the previous program the current one
 * which allows to reuse one program in two consecutive and different draw passes
 * This case is necessary to draw twice with different settings (unitforms)
 */
export function createBlurProgram(mapCurrent = false) {
	return function createBlurProgram(programStore) {
		return function createBlurProgram() {
			const { gl, programMap, vaoMap } = appContext;
			if (!programMap.has(programStore) && !mapCurrent) {
				const program = gl.createProgram();
				programMap.set(programStore, program);
				vaoMap.set(programStore, new Map());
				appContext.program = program;
			} else if (mapCurrent) {
				programMap.set(programStore, appContext.program);
				vaoMap.set(programStore, new Map());
			} else {
				//todo check if necessary, this check is done in engine already, if it exists, createProgram is not called
				appContext.program = appContext.programMap.get(programStore);
			}
		};
	};
}

export function createBlurShaders() {
	const { gl, program } = appContext;

	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

// Create a simple quad mesh for the blur shader
export function createBlurMesh() {
	return {
		attributes: {
			positionsSize: 2,
			positions: new Float32Array([
				// Pos (xy)
				-1, 1, -1, -1, 1, 1, 1, -1,
			]),
			uvs: new Float32Array([
				// UV coordinate
				0, 1, 0, 0, 1, 1, 1, 0,
			]),
		},
		drawMode: drawModes[5],
	};
}

// Set the blur stride uniform, which define the direction of the blur
export function setDirectionUniform(direction) {
	const { gl, program } = appContext;

	const unidirectionalUVStride =
		direction === BLUR_DIRECTION_HORIZONTAL ? [appContext.frameBufferWidth, 0] : [0, appContext.frameBufferHeight];
	const uvStrideUniformLocation = gl.getUniformLocation(program, "uvStride");
	gl.uniform2fv(uvStrideUniformLocation, unidirectionalUVStride);
}

// Generate a kernel
export function getKernel(size) {
	/*if (newWidth === kernelWidth) return;
	kernelWidth = newWidth;*/

	const kernel1D = generate1DKernel(size);
	console.log("kernel1D", kernel1D);
	const kernel = convertKernelToOffsetsAndScales(kernel1D);
	console.log("kernel", kernel);

	return kernel;
}

// Set the kernel uniforms
export function setKernelUniforms(kernel) {
	const { gl, program } = appContext;

	const offsetScaleLocation = gl.getUniformLocation(program, "offsetAndScale");

	gl.uniform2fv(offsetScaleLocation, kernel);
	const kernelWidthLocation = gl.getUniformLocation(program, "kernelWidth");
	gl.uniform1i(kernelWidthLocation, kernel.length / 2);
}
